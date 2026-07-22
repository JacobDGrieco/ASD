/**
 * Admin lyrics editor for one song.
 *
 * This page coordinates three related editing surfaces: raw lyric text, synced
 * playback timings, and annotation ranges. Lyrics are saved through
 * `api/admin/lyrics.js`; annotation creates/updates/deletes are saved through
 * `api/admin/annotations.js`.
 */
import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { TabPanel } from 'primereact/tabview';
import { FaCheck, FaPause, FaPlay, FaPlus, FaRedo, FaTrash } from 'react-icons/fa';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import SoundCloudPlayer from '../../components/shared/SoundCloudPlayer.jsx';
import PageTabs from '../../components/shared/PageTabs.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminLyricsPage.css';

function renderBackdrop(text, ranges) {
	if (ranges.length === 0) return text;
	const sorted = ranges.toSorted((a, b) => a.startChar - b.startChar);
	const parts = [];
	let cursor = 0;
	for (const range of sorted) {
		const start = Math.max(range.startChar, cursor);
		if (start >= range.endChar) continue;
		if (start > cursor) parts.push(text.slice(cursor, start));
		parts.push(<mark key={`${start}-${range.endChar}`}>{text.slice(start, range.endChar)}</mark>);
		cursor = range.endChar;
	}
	if (cursor < text.length) parts.push(text.slice(cursor));
	return parts;
}

function lyricLineEntries(text) {
	return String(text ?? '').split('\n').map((line, lineIndex) => ({
		line,
		lineIndex,
	})).filter((entry) => entry.line.trim() && !isBracketedLyricCue(entry.line));
}

function isBracketedLyricCue(line) {
	const trimmed = String(line ?? '').trim();
	return trimmed.length >= 2 && trimmed.startsWith('[') && trimmed.endsWith(']');
}

function normalizeLyricLineForSync(line) {
	return String(line ?? '').trim().replace(/\s+/g, ' ');
}

// When lyric text changes, keep existing sync timings only for lines we can still
// match by normalized text. Bracketed cue lines are intentionally not syncable.
function reconcileSyncedLinesForTextChange(oldText, newText, syncedLines) {
	if (!Array.isArray(syncedLines) || syncedLines.length === 0) return [];

	const oldLines = String(oldText ?? '').split('\n');
	const newLines = String(newText ?? '').split('\n');
	const sortedTimings = syncedLines.toSorted((left, right) => left.lineIndex - right.lineIndex);

	if (oldLines.length === newLines.length) {
		return sortedTimings.filter((timing) => (
			newLines[timing.lineIndex]?.trim() && !isBracketedLyricCue(newLines[timing.lineIndex])
		));
	}

	const newIndexesByLine = newLines.reduce((lineMap, line, lineIndex) => {
		if (isBracketedLyricCue(line)) return lineMap;
		const key = normalizeLyricLineForSync(line);
		if (!key) return lineMap;
		const indexes = lineMap.get(key) ?? [];
		indexes.push(lineIndex);
		lineMap.set(key, indexes);
		return lineMap;
	}, new Map());
	const usedNewIndexes = new Set();

	return sortedTimings.reduce((timings, timing) => {
		if (isBracketedLyricCue(oldLines[timing.lineIndex])) return timings;
		const oldKey = normalizeLyricLineForSync(oldLines[timing.lineIndex]);
		if (!oldKey) return timings;

		const candidates = newIndexesByLine.get(oldKey) ?? [];
		const preferredIndex = normalizeLyricLineForSync(newLines[timing.lineIndex]) === oldKey && !usedNewIndexes.has(timing.lineIndex)
			? timing.lineIndex
			: null;
		const nextLineIndex = preferredIndex ?? candidates.find((lineIndex) => !usedNewIndexes.has(lineIndex));
		if (typeof nextLineIndex !== 'number') return timings;

		usedNewIndexes.add(nextLineIndex);
		timings.push({ ...timing, lineIndex: nextLineIndex });
		return timings;
	}, []).sort((left, right) => left.lineIndex - right.lineIndex);
}

function formatSyncTime(milliseconds) {
	const safeMilliseconds = Math.max(0, Math.round(Number(milliseconds) || 0));
	const minutes = Math.floor(safeMilliseconds / 60000);
	const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
	const ms = safeMilliseconds % 1000;
	return `${minutes}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

function parseSyncTime(value) {
	const match = String(value ?? '').trim().match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
	if (!match) return null;
	const minutes = Number(match[1]);
	const seconds = Number(match[2]);
	const milliseconds = Number((match[3] ?? '0').padEnd(3, '0'));
	return (minutes * 60 * 1000) + (seconds * 1000) + milliseconds;
}

function isTextEditingTarget(target) {
	return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target?.tagName);
}

function scrollElementByOneLine(element, amount) {
	const scrollContainer = element?.closest?.('.admin-layout-main');
	if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
		scrollContainer.scrollBy({ top: amount, behavior: 'smooth' });
		return;
	}

	window.scrollBy({ top: amount, behavior: 'smooth' });
}

function createScrollRestorer(element) {
	if (typeof window === 'undefined' || !element) return null;

	const snapshots = [];
	let current = element.parentElement;
	while (current) {
		const style = window.getComputedStyle(current);
		const canScrollY = ['auto', 'scroll', 'overlay'].includes(style.overflowY);
		const canScrollX = ['auto', 'scroll', 'overlay'].includes(style.overflowX);
		if (
			(canScrollY && current.scrollHeight > current.clientHeight) ||
			(canScrollX && current.scrollWidth > current.clientWidth)
		) {
			snapshots.push({
				element: current,
				scrollLeft: current.scrollLeft,
				scrollTop: current.scrollTop,
			});
		}
		current = current.parentElement;
	}

	const windowSnapshot = {
		element: window,
		scrollLeft: window.scrollX,
		scrollTop: window.scrollY,
	};

	return () => {
		for (const snapshot of snapshots) {
			snapshot.element.scrollLeft = snapshot.scrollLeft;
			snapshot.element.scrollTop = snapshot.scrollTop;
		}
		window.scrollTo(windowSnapshot.scrollLeft, windowSnapshot.scrollTop);
	};
}

// Saves the lyric row first so new annotations always have a SongLyric id to
// reference, then upserts each annotation's ranges through the separate endpoint.
async function saveLyricsAndAnnotations({
	isSaving,
	annotations,
	songId,
	auth,
	lyricText,
	syncedLines,
	lyricIdRef,
	setAnnotations,
	setIsSaving,
}) {
	if (isSaving) return;

	const hasDirty = annotations.some((annotation) =>
		annotation.ranges.some((range) => range.dirty)
	);
	if (hasDirty) {
		alert('Fix or remove all invalid ranges before saving.');
		return;
	}

	setIsSaving(true);
	try {
		const lyricRes = await fetch(`/api/admin/lyrics?songId=${songId}`, {
			method: 'PUT',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: lyricText, syncedLines }),
		});
		if (!lyricRes.ok) throw new Error('Failed to save lyrics.');
		const lyricData = await lyricRes.json();
		const savedLyricId = lyricData.id;
		lyricIdRef.current = savedLyricId;

		const updatedAnnotations = await Promise.all(
			annotations.map(async (annotation) => {
				const body = {
					explanation: annotation.explanation,
					ranges: annotation.ranges.map((range) => ({
						startChar: range.startChar,
						endChar: range.endChar,
					})),
				};

				if (annotation.id === null) {
					const res = await fetch('/api/admin/annotations', {
						method: 'POST',
						headers: { ...auth, 'Content-Type': 'application/json' },
						body: JSON.stringify({ songLyricId: savedLyricId, ...body }),
					});
					if (!res.ok) throw new Error('Failed to create annotation.');
					const data = await res.json();
					return {
						id: data.id,
						explanation: data.explanation,
						ranges: (data.ranges ?? []).map((range) => ({
							id: range.id ?? null,
							startChar: range.startChar,
							endChar: range.endChar,
							dirty: false,
						})),
					};
				}

				const res = await fetch(`/api/admin/annotations?id=${annotation.id}`, {
					method: 'PUT',
					headers: { ...auth, 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
				if (!res.ok) throw new Error('Failed to update annotation.');
				const data = await res.json();
				return {
					id: data.id,
					explanation: data.explanation,
					ranges: (data.ranges ?? []).map((range) => ({
						id: range.id ?? null,
						startChar: range.startChar,
						endChar: range.endChar,
						dirty: false,
					})),
				};
			})
		);

		setAnnotations((prev) =>
			prev.map((annotation, index) => {
				const saved = updatedAnnotations[index];
				if (!saved) return annotation;
				return {
					...annotation,
					id: saved.id,
					ranges: annotation.ranges.map((range, rangeIndex) => ({
						...range,
						id: saved.ranges[rangeIndex]?.id ?? range.id,
						dirty: false,
					})),
				};
			})
		);
	} catch (err) {
		alert(err.message ?? 'An error occurred while saving.');
	} finally {
		setIsSaving(false);
	}
}

function LyricsHeader({ songTitle, isViewer, isLoading, isSaving, onSave }) {
	return (
		<div className="alp-header">
			<div>
				<Link to="/admin/songs" className="alp-back-link">← Songs</Link>
				<h1 className="alp-title">Music - Lyrics</h1>
				<p className="alp-subtitle">{songTitle}</p>
			</div>
			{!isViewer && !isLoading && (
				<div className="alp-header-actions">
					<button type="button" className="alp-save-btn" onClick={onSave} disabled={isSaving}>
						{isSaving ? 'Saving...' : 'Save All'}
					</button>
				</div>
			)}
		</div>
	);
}

function LyricsPanel({
	isViewer,
	isPicking,
	lyricText,
	highlightedRanges,
	textareaWrapperRef,
	textareaRef,
	onLyricChange,
	onTextareaInteraction,
	onTextareaMouseUp,
	onTextareaKeyUp,
}) {
	return (
		<div className="alp-lyrics-panel">
			<div className="alp-lyrics-header">
				<span>Lyrics</span>
			</div>

			<div className="alp-textarea-wrapper" ref={textareaWrapperRef}>
				{highlightedRanges.length > 0 && (
					<div className="alp-textarea-backdrop" aria-hidden="true">
						{renderBackdrop(lyricText, highlightedRanges)}
					</div>
				)}
				<textarea
					ref={textareaRef}
					className={`alp-lyric-textarea${isPicking ? ' alp-lyric-textarea-picking' : ''}${highlightedRanges.length > 0 ? ' alp-lyric-textarea-highlighting' : ''}`}
					value={lyricText}
					aria-label="Lyrics text"
					spellCheck={false}
					disabled={isViewer}
					onChange={onLyricChange}
					onSelect={onTextareaInteraction}
					onKeyDown={onTextareaInteraction}
					onMouseDown={onTextareaInteraction}
					onMouseUp={onTextareaMouseUp}
					onKeyUp={onTextareaKeyUp}
				/>
			</div>
		</div>
	);
}

function AnnotationNeutralCard({ annotation, annotationIndex, hasDirty, lyricText, onEdit, onHover, onLeave }) {
	return (
		<button
			type="button"
			className={`alp-annotation-card alp-annotation-card-neutral${hasDirty ? ' alp-annotation-card-dirty' : ''}`}
			onClick={() => onEdit(annotationIndex)}
			onMouseEnter={() => onHover(annotationIndex)}
			onMouseLeave={onLeave}
		>
			<div className="alp-annotation-neutral-ranges">
				{annotation.ranges.length === 0 ? (
					<span className="alp-annotation-neutral-empty">No ranges</span>
				) : annotation.ranges.map((range, rangeIndex) => (
					<span
						key={range.id ?? `range-${annotationIndex}-${rangeIndex}`}
						className={`alp-range-chip${range.dirty ? ' alp-range-chip-dirty' : ''}`}
					>
						{range.dirty
							? <span className="alp-range-chip-text">Re-highlight to fix</span>
							: <span className="alp-range-chip-text">&ldquo;{lyricText.slice(range.startChar, range.endChar)}&rdquo;</span>
						}
					</span>
				))}
			</div>
			{annotation.explanation && (
				<p className="alp-annotation-neutral-explanation">{annotation.explanation}</p>
			)}
		</button>
	);
}

function AnnotationEditingCard({
	annotation,
	annotationIndex,
	lyricText,
	isViewer,
	onDone,
	onDelete,
	onHover,
	onLeave,
	onRemoveRange,
	onAddRange,
	onUpdateExplanation,
}) {
	return (
		<div
			className="alp-annotation-card alp-annotation-card-editing"
			onMouseEnter={() => onHover(annotationIndex)}
			onMouseLeave={onLeave}
		>
			<div className="alp-annotation-card-edit-header">
				<div className="alp-annotation-card-actions">
					<button
						type="button"
						className="alp-annotation-icon-btn alp-annotation-done-btn"
						onClick={onDone}
						aria-label="Done editing annotation"
						title="Done"
					>
						<FaCheck aria-hidden="true" />
					</button>
					{!isViewer && (
						<ConfirmActionButton
							message="Delete this annotation?"
							onConfirm={() => onDelete(annotationIndex)}
							buttonClassName="alp-annotation-icon-btn alp-annotation-delete-btn"
							buttonAriaLabel="Delete annotation"
							buttonTitle="Delete"
						>
							<FaTrash aria-hidden="true" />
						</ConfirmActionButton>
					)}
				</div>
			</div>

			<div className="alp-ranges-list">
				<div>Ranges:</div>
				{annotation.ranges.map((range, rangeIndex) => (
					<div
						key={range.id ?? `range-${annotationIndex}-${rangeIndex}`}
						className={`alp-range-chip${range.dirty ? ' alp-range-chip-dirty' : ''}`}
					>
						{range.dirty ? (
							<span className="alp-range-chip-text">Re-highlight to fix</span>
						) : (
							<span className="alp-range-chip-text">
								&ldquo;{lyricText.slice(range.startChar, range.endChar)}&rdquo;
							</span>
						)}
						{!isViewer && (
							<button
								type="button"
								className="alp-range-chip-remove"
								onClick={() => onRemoveRange(annotationIndex, rangeIndex)}
								aria-label="Remove range"
							>
								x
							</button>
						)}
					</div>
				))}

				{!isViewer && (
					<button
						type="button"
						className="alp-add-range-btn"
						onClick={() => onAddRange(annotationIndex)}
					>
						+ Add range
					</button>
				)}
			</div>

			<textarea
				className="alp-annotation-explanation"
				value={annotation.explanation}
				disabled={isViewer}
				placeholder="Explanation..."
				onChange={(event) => onUpdateExplanation(annotationIndex, event.target.value)}
			/>
		</div>
	);
}

function AnnotationsPanel({
	isViewer,
	sortedAnnotationEntries,
	editingAnnotationIndex,
	lyricText,
	onAddAnnotation,
	onEditAnnotation,
	onDoneEditing,
	onHoverAnnotation,
	onLeaveAnnotation,
	onDeleteAnnotation,
	onRemoveRange,
	onAddRange,
	onUpdateExplanation,
}) {
	return (
		<div className="alp-annotations-panel">
			<div className="alp-annotations-header">
				<span>Annotations</span>
				{!isViewer && (
					<button
						type="button"
						className="alp-annotation-icon-btn alp-add-annotation-btn"
						onClick={onAddAnnotation}
						aria-label="Add annotation"
						title="Add annotation"
					>
						<FaPlus aria-hidden="true" />
					</button>
				)}
			</div>

			{sortedAnnotationEntries.map(({ annotation, annotationIndex }) => {
				const isEditing = editingAnnotationIndex === annotationIndex;
				const hasDirty = annotation.ranges.some((range) => range.dirty);
				const key = annotation.id ?? `unsaved-${annotationIndex}`;

				return isEditing ? (
					<AnnotationEditingCard
						key={key}
						annotation={annotation}
						annotationIndex={annotationIndex}
						lyricText={lyricText}
						isViewer={isViewer}
						onDone={onDoneEditing}
						onDelete={onDeleteAnnotation}
						onHover={onHoverAnnotation}
						onLeave={onLeaveAnnotation}
						onRemoveRange={onRemoveRange}
						onAddRange={onAddRange}
						onUpdateExplanation={onUpdateExplanation}
					/>
				) : (
					<AnnotationNeutralCard
						key={key}
						annotation={annotation}
						annotationIndex={annotationIndex}
						hasDirty={hasDirty}
						lyricText={lyricText}
						onEdit={onEditAnnotation}
						onHover={onHoverAnnotation}
						onLeave={onLeaveAnnotation}
					/>
				);
			})}
		</div>
	);
}

function SyncedLyricsPanel({
	isViewer,
	lyricText,
	song,
	syncedLines,
	onSyncedLinesChange,
}) {
	const playerRef = useRef(null);
	const panelRef = useRef(null);
	const lineRefs = useRef(new Map());
	const captureStartMsRef = useRef(null);
	const previousEntryIndexRef = useRef(0);
	const [position, setPosition] = useState(0);
	const [duration, setDuration] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isCapturing, setIsCapturing] = useState(false);
	const [currentEntryIndex, setCurrentEntryIndex] = useState(0);
	const [timeDrafts, setTimeDrafts] = useState({});

	const lineEntries = useMemo(() => lyricLineEntries(lyricText), [lyricText]);
	const timingByLineIndex = useMemo(() => new Map(
		(syncedLines ?? []).map((timing) => [timing.lineIndex, timing])
	), [syncedLines]);
	const syncedCount = lineEntries.filter((entry) => timingByLineIndex.has(entry.lineIndex)).length;
	const currentEntry = lineEntries[Math.min(currentEntryIndex, Math.max(lineEntries.length - 1, 0))] ?? null;
	const currentMs = Math.round((position || 0) * 1000);
	const maxDuration = Math.max(duration || 0, position || 0, 1);
	const soundcloudUrl = song?.adminSoundcloudUrl || song?.soundcloudUrl || '';
	const soundcloudSourceLabel = song?.adminSoundcloudSource === 'private'
		? 'Private SoundCloud link'
		: 'Official SoundCloud link';

	const focusSyncPanel = useCallback(() => {
		if (isViewer) return;
		window.requestAnimationFrame(() => {
			panelRef.current?.focus({ preventScroll: true });
		});
	}, [isViewer]);

	useEffect(() => {
		if (currentEntryIndex <= Math.max(lineEntries.length - 1, 0)) return;
		setCurrentEntryIndex(Math.max(lineEntries.length - 1, 0));
	}, [currentEntryIndex, lineEntries.length]);

	useEffect(() => {
		const currentLineIndex = lineEntries[currentEntryIndex]?.lineIndex;
		const previousEntryIndex = previousEntryIndexRef.current;
		previousEntryIndexRef.current = currentEntryIndex;
		if (typeof currentLineIndex !== 'number' || previousEntryIndex === currentEntryIndex) return;

		const lineElement = lineRefs.current.get(currentLineIndex);
		const direction = currentEntryIndex > previousEntryIndex ? 1 : -1;
		const lineHeight = lineElement?.getBoundingClientRect().height ?? 42;
		scrollElementByOneLine(panelRef.current, direction * (lineHeight + 6));
	}, [currentEntryIndex, lineEntries]);

	const updateLineTiming = useCallback((lineIndex, patch) => {
		onSyncedLinesChange((previous) => {
			const existing = previous.find((timing) => timing.lineIndex === lineIndex) ?? { lineIndex, startMs: 0, endMs: 0 };
			const nextTiming = { ...existing, ...patch };
			const withoutLine = previous.filter((timing) => timing.lineIndex !== lineIndex);
			if (nextTiming.endMs <= nextTiming.startMs) return previous;
			return [...withoutLine, nextTiming].sort((left, right) => left.lineIndex - right.lineIndex);
		});
	}, [onSyncedLinesChange]);

	const seekToMs = (milliseconds) => {
		const seconds = Math.max(0, milliseconds / 1000);
		playerRef.current?.seekTo(seconds);
		setPosition(seconds);
		focusSyncPanel();
	};

	const handleSpaceDown = (event) => {
		if (event.code !== 'Space' || isTextEditingTarget(event.target)) return;
		event.preventDefault();
		if (isViewer || event.repeat || !currentEntry) return;
		captureStartMsRef.current = currentMs;
		setIsCapturing(true);
		if (!isPlaying) setIsPlaying(true);
	};

	const handleSpaceUp = (event) => {
		if (event.code !== 'Space' || isTextEditingTarget(event.target)) return;
		event.preventDefault();
		if (isViewer || !currentEntry || captureStartMsRef.current === null) return;
		const startMs = captureStartMsRef.current;
		const endMs = Math.max(currentMs, startMs + 250);
		captureStartMsRef.current = null;
		setIsCapturing(false);
		updateLineTiming(currentEntry.lineIndex, { startMs, endMs });
		setCurrentEntryIndex((index) => Math.min(index + 1, Math.max(lineEntries.length - 1, 0)));
	};

	const updateTimeField = (lineIndex, field, value) => {
		const draftKey = `${lineIndex}:${field}`;
		setTimeDrafts((drafts) => ({ ...drafts, [draftKey]: value }));
		const parsed = parseSyncTime(value);
		if (parsed === null) return;
		updateLineTiming(lineIndex, { [field]: parsed });
	};

	const commitTimeField = (lineIndex, field, value) => {
		const draftKey = `${lineIndex}:${field}`;
		setTimeDrafts((drafts) => {
			const nextDrafts = { ...drafts };
			delete nextDrafts[draftKey];
			return nextDrafts;
		});

		const parsed = parseSyncTime(value);
		if (parsed === null) return;
		updateLineTiming(lineIndex, { [field]: parsed });
	};

	const resetSync = () => {
		if (window.confirm('Clear all synced lyric timing for this song?')) {
			onSyncedLinesChange([]);
			setCurrentEntryIndex(0);
			focusSyncPanel();
		}
	};

	return (
		<div
			ref={panelRef}
			className="alp-sync-panel"
			tabIndex={isViewer ? -1 : 0}
			onKeyDown={handleSpaceDown}
			onKeyUp={handleSpaceUp}
		>
			<div className="alp-sync-header">
				<div>
					<span className="alp-sync-kicker">Synced lyrics</span>
					<p className="alp-sync-status">
						{lineEntries.length ? `${syncedCount}/${lineEntries.length} lines timed` : 'Add lyrics before syncing'}
					</p>
				</div>
				<div className="alp-sync-actions">
					<button
						type="button"
						className="alp-annotation-icon-btn"
						onClick={() => {
							setIsPlaying((playing) => !playing);
							focusSyncPanel();
						}}
						disabled={!soundcloudUrl}
						aria-label={isPlaying ? 'Pause sync playback' : 'Play sync playback'}
						title={isPlaying ? 'Pause' : 'Play'}
					>
						{isPlaying ? <FaPause aria-hidden="true" /> : <FaPlay aria-hidden="true" />}
					</button>
					<button
						type="button"
						className="alp-annotation-icon-btn"
						onClick={resetSync}
						disabled={isViewer || syncedCount === 0}
						aria-label="Reset synced lyrics"
						title="Reset synced lyrics"
					>
						<FaRedo aria-hidden="true" />
					</button>
				</div>
			</div>

			{soundcloudUrl ? (
				<div className="alp-sync-player-wrap">
					<div className="alp-sync-source">{soundcloudSourceLabel}</div>
					<SoundCloudPlayer
						ref={playerRef}
						url={soundcloudUrl}
						isPlaying={isPlaying}
						onPlaybackStart={() => {
							setIsPlaying(true);
							focusSyncPanel();
						}}
						onPlaybackPause={() => setIsPlaying(false)}
						onPlaybackEnd={() => setIsPlaying(false)}
						onReady={({ duration: nextDuration }) => setDuration(nextDuration || 0)}
						onPlaybackProgress={({ position: nextPosition, duration: nextDuration }) => {
							setPosition(nextPosition || 0);
							if (nextDuration) setDuration(nextDuration);
						}}
					/>
				</div>
			) : (
				<div className="alp-sync-empty">Add a SoundCloud URL to this song before syncing lyrics.</div>
			)}

			<div className="alp-sync-transport">
				<input
					type="range"
					min="0"
					max={maxDuration}
					step="0.001"
					value={Math.min(position, maxDuration)}
					onChange={(event) => seekToMs(Number(event.target.value) * 1000)}
					aria-label="Sync playback position"
				/>
				<div className="alp-sync-time">
					<span>{formatSyncTime(currentMs)}</span>
					<span>{formatSyncTime(maxDuration * 1000)}</span>
				</div>
			</div>
			<div className="alp-sync-lines">
				{lineEntries.map((entry, index) => {
					const timing = timingByLineIndex.get(entry.lineIndex) ?? null;
					const isCurrent = currentEntry?.lineIndex === entry.lineIndex;
					return (
						<div
							key={`${entry.lineIndex}-${entry.line}`}
							ref={(element) => {
								if (element) lineRefs.current.set(entry.lineIndex, element);
								else lineRefs.current.delete(entry.lineIndex);
							}}
							className={`alp-sync-line${isCurrent ? ' alp-sync-line-current' : ''}`.trim()}
						>
							<button
								type="button"
								className="alp-sync-line-text"
								onClick={() => {
									setCurrentEntryIndex(index);
									focusSyncPanel();
								}}
							>
								<span>{entry.line}</span>
							</button>
							<div className="alp-sync-line-times">
								<input
									type="text"
									value={timing ? timeDrafts[`${entry.lineIndex}:startMs`] ?? formatSyncTime(timing.startMs) : ''}
									placeholder="0:00.000"
									disabled={isViewer || !timing}
									onChange={(event) => updateTimeField(entry.lineIndex, 'startMs', event.target.value)}
									onBlur={(event) => commitTimeField(entry.lineIndex, 'startMs', event.target.value)}
									aria-label={`Start time for ${entry.line}`}
								/>
								<input
									type="text"
									value={timing ? timeDrafts[`${entry.lineIndex}:endMs`] ?? formatSyncTime(timing.endMs) : ''}
									placeholder="0:00.000"
									disabled={isViewer || !timing}
									onChange={(event) => updateTimeField(entry.lineIndex, 'endMs', event.target.value)}
									onBlur={(event) => commitTimeField(entry.lineIndex, 'endMs', event.target.value)}
									aria-label={`End time for ${entry.line}`}
								/>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function LyricsEditPane({
	state,
	lyricText,
	songForSync,
	syncedLines,
	activeTabIndex,
	highlightedRanges,
	textareaWrapperRef,
	textareaRef,
	sortedAnnotationEntries,
	editingAnnotationIndex,
	onLyricChange,
	onSyncedLinesChange,
	onTabChange,
	onTextareaInteraction,
	onTextareaMouseUp,
	onTextareaKeyUp,
	onAddAnnotation,
	onEditAnnotation,
	onDoneEditing,
	onHoverAnnotation,
	onLeaveAnnotation,
	onDeleteAnnotation,
	onRemoveRange,
	onAddRange,
	onUpdateExplanation,
}) {
	const { isLoading, hasDirtyRanges, isPicking, isViewer } = state;

	return (
		<div className="alp-edit-pane">
			{isLoading ? (
				<div>Loading lyrics...</div>
			) : (
				<>
					<PageTabs
						activeIndex={activeTabIndex}
						onTabChange={onTabChange}
						className="alp-tabs"
						tabCount={2}
					>
						<TabPanel header="Plain Lyrics">
							{hasDirtyRanges && (
								<div className="alp-dirty-banner">
									Some annotation ranges were affected by your edits. Select the annotation card and re-highlight the text to fix them.
								</div>
							)}

							{isPicking && (
								<div className="alp-picking-banner">
									Highlight text in the lyrics to add a range to this annotation
								</div>
							)}

							<div className="alp-editor-columns">
								<LyricsPanel
									isViewer={isViewer}
									isPicking={isPicking}
									lyricText={lyricText}
									highlightedRanges={highlightedRanges}
									textareaWrapperRef={textareaWrapperRef}
									textareaRef={textareaRef}
									onLyricChange={onLyricChange}
									onTextareaInteraction={onTextareaInteraction}
									onTextareaMouseUp={onTextareaMouseUp}
									onTextareaKeyUp={onTextareaKeyUp}
								/>

								<AnnotationsPanel
									isViewer={isViewer}
									sortedAnnotationEntries={sortedAnnotationEntries}
									editingAnnotationIndex={editingAnnotationIndex}
									lyricText={lyricText}
									onAddAnnotation={onAddAnnotation}
									onEditAnnotation={onEditAnnotation}
									onDoneEditing={onDoneEditing}
									onHoverAnnotation={onHoverAnnotation}
									onLeaveAnnotation={onLeaveAnnotation}
									onDeleteAnnotation={onDeleteAnnotation}
									onRemoveRange={onRemoveRange}
									onAddRange={onAddRange}
									onUpdateExplanation={onUpdateExplanation}
								/>
							</div>
						</TabPanel>

						<TabPanel header="Synced Lyrics">
							<SyncedLyricsPanel
								isViewer={isViewer}
								lyricText={lyricText}
								song={songForSync}
								syncedLines={syncedLines}
								onSyncedLinesChange={onSyncedLinesChange}
							/>
						</TabPanel>
					</PageTabs>
				</>
			)}
		</div>
	);
}

export default function AdminMusicLyricsPage() {
	const { songId } = useParams();
	const { state } = useLocation();
	const { token, session } = useAdminAuth();
	const isViewer = session?.role === 'VIEWER';
	const songTitle = state?.songTitle ?? 'Song';
	const auth = { Authorization: `Bearer ${token}` };

	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [lyricText, setLyricText] = useState('');
	const [syncedLines, setSyncedLines] = useState([]);
	const [songForSync, setSongForSync] = useState(null);
	const [activeTabIndex, setActiveTabIndex] = useState(0);
	const [annotations, setAnnotations] = useState([]);
	const [editingAnnotationIndex, setEditingAnnotationIndex] = useState(null);
	const [hoveredAnnotationIndex, setHoveredAnnotationIndex] = useState(null);
	const [pendingRangeForAnnotationIndex, setPendingRangeForAnnotationIndex] = useState(null);

	const lyricIdRef = useRef(null);
	const preEditRef = useRef({ value: '', selectionStart: 0, selectionEnd: 0 });
	const textareaWrapperRef = useRef(null);
	const textareaRef = useRef(null);

	const resizeLyricTextarea = useCallback((el = textareaRef.current, { preserveScroll = false } = {}) => {
		if (!el) return;
		const restoreScroll = preserveScroll ? createScrollRestorer(el) : null;
		el.style.height = 'auto';
		const borderHeight = el.offsetHeight - el.clientHeight;
		el.style.height = `${el.scrollHeight + borderHeight}px`;
		if (restoreScroll) {
			restoreScroll();
			window.requestAnimationFrame(restoreScroll);
		}
	}, []);

	// Load 

	useEffect(() => {
		let ignore = false;
		setIsLoading(true);

		fetch(`/api/admin/lyrics?songId=${songId}`, { headers: auth })
			.then((res) => res.json())
			.then((data) => {
				if (ignore) return;
				lyricIdRef.current = data.id ?? null;
				setLyricText(data.text ?? '');
				setSyncedLines(Array.isArray(data.syncedLines) ? data.syncedLines : []);
				setSongForSync(data.song ?? null);
				setAnnotations(
					(data.annotations ?? []).map((annotation) => ({
						id: annotation.id ?? null,
						explanation: annotation.explanation ?? '',
						ranges: (annotation.ranges ?? []).map((range) => ({
							id: range.id ?? null,
							startChar: range.startChar,
							endChar: range.endChar,
							dirty: false,
						})),
					}))
				);
			})
			.finally(() => {
				if (!ignore) setIsLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [songId, token]); // eslint-disable-line react-hooks/exhaustive-deps

	useLayoutEffect(() => {
		if (isLoading) return;
		resizeLyricTextarea();
	}, [activeTabIndex, isLoading, resizeLyricTextarea]);

	useEffect(() => {
		const wrapper = textareaWrapperRef.current;
		if (!wrapper) return;

		const resizeObserver = new ResizeObserver(() => {
			resizeLyricTextarea(textareaRef.current, { preserveScroll: true });
		});
		resizeObserver.observe(wrapper);

		return () => resizeObserver.disconnect();
	}, [resizeLyricTextarea]);

	// Annotation range adjustment ‚

	const adjustAnnotationRanges = useCallback((changeStart, changeEnd, netDelta) => {
		setAnnotations((prev) =>
			prev.map((annotation) => ({
				...annotation,
				ranges: annotation.ranges.map((range) => {
					if (changeStart >= range.endChar) return range;
					if (changeEnd <= range.startChar) {
						return {
							...range,
							startChar: range.startChar + netDelta,
							endChar: range.endChar + netDelta,
						};
					}
					return { ...range, dirty: true };
				}),
			}))
		);
	}, []);

	// Textarea interaction capture 

	const handleTextareaInteraction = (e) => {
		preEditRef.current = {
			value: e.target.value,
			selectionStart: e.target.selectionStart,
			selectionEnd: e.target.selectionEnd,
		};
	};

	// Lyric text change

	const handleLyricChange = (e) => {
		const newValue = e.target.value;
		const { value: oldValue, selectionStart: oldSelStart, selectionEnd: oldSelEnd } = preEditRef.current;
		const charsRemoved = oldSelEnd - oldSelStart;
		const charsAdded = newValue.length - oldValue.length + charsRemoved;
		const changeStart = oldSelStart;
		const changeEnd = oldSelStart + charsRemoved;
		const netDelta = charsAdded - charsRemoved;

		setLyricText(newValue);
		setSyncedLines((current) => reconcileSyncedLinesForTextChange(oldValue, newValue, current));
		adjustAnnotationRanges(changeStart, changeEnd, netDelta);

		resizeLyricTextarea(e.target, { preserveScroll: true });

		preEditRef.current = {
			value: newValue,
			selectionStart: e.target.selectionStart,
			selectionEnd: e.target.selectionEnd,
		};
	};

	// Range picking

	const addRangeFromSelection = useCallback((annotationIndex, selectionStart, selectionEnd) => {
		setAnnotations((prev) =>
			prev.map((annotation, index) => {
				if (index !== annotationIndex) return annotation;
				return {
					...annotation,
					ranges: [
						...annotation.ranges,
						{ id: null, startChar: selectionStart, endChar: selectionEnd, dirty: false },
					],
				};
			})
		);
	}, []);

	const handleTextareaMouseUp = (e) => {
		if (pendingRangeForAnnotationIndex === null) return;
		const { selectionStart, selectionEnd } = e.target;
		if (selectionStart === selectionEnd) return;
		addRangeFromSelection(pendingRangeForAnnotationIndex, selectionStart, selectionEnd);
		setPendingRangeForAnnotationIndex(null);
	};

	const handleTextareaKeyUp = (e) => {
		if (pendingRangeForAnnotationIndex === null) return;
		const { selectionStart, selectionEnd } = e.target;
		if (selectionStart === selectionEnd) return;
		addRangeFromSelection(pendingRangeForAnnotationIndex, selectionStart, selectionEnd);
		setPendingRangeForAnnotationIndex(null);
	};

	// Annotation mutations 

	const addAnnotation = () => {
		setEditingAnnotationIndex(annotations.length);
		setAnnotations((prev) => [...prev, { id: null, explanation: '', ranges: [] }]);
	};

	const updateAnnotationExplanation = (annotationIndex, explanation) => {
		setAnnotations((prev) =>
			prev.map((annotation, index) =>
				index === annotationIndex ? { ...annotation, explanation } : annotation
			)
		);
	};

	const removeRange = (annotationIndex, rangeIndex) => {
		setAnnotations((prev) =>
			prev.map((annotation, index) => {
				if (index !== annotationIndex) return annotation;
				return {
					...annotation,
					ranges: annotation.ranges.filter((_, rIndex) => rIndex !== rangeIndex),
				};
			})
		);
	};

	const deleteAnnotation = async (annotationIndex) => {
		const annotation = annotations[annotationIndex];
		if (annotation.id !== null) {
			const res = await fetch(`/api/admin/annotations?id=${annotation.id}`, {
				method: 'DELETE',
				headers: auth,
			});
			if (!res.ok) {
				alert('Failed to delete annotation.');
				return;
			}
		}
		setAnnotations((prev) => prev.filter((_, index) => index !== annotationIndex));
		setEditingAnnotationIndex(null);
	};

	// Save 

	const saveAll = () => {
		void saveLyricsAndAnnotations({
			isSaving,
			annotations,
			songId,
			auth,
			lyricText,
			syncedLines,
			lyricIdRef,
			setAnnotations,
			setIsSaving,
		});
	};
	// Derived ‚

	const hasDirtyRanges = annotations.some((annotation) =>
		annotation.ranges.some((range) => range.dirty)
	);

	const isPicking = pendingRangeForAnnotationIndex !== null;

	const highlightedAnnotationIndex = hoveredAnnotationIndex ?? editingAnnotationIndex;
	const highlightedRanges = highlightedAnnotationIndex !== null
		? (annotations[highlightedAnnotationIndex]?.ranges ?? []).filter((r) => !r.dirty)
		: [];

	const sortedAnnotationEntries = annotations
		.map((annotation, annotationIndex) => ({
			annotation,
			annotationIndex,
			firstStartChar: annotation.ranges.reduce(
				(firstStartChar, range) => (range.dirty ? firstStartChar : Math.min(firstStartChar, range.startChar)),
				Number.POSITIVE_INFINITY
			),
		}))
		.toSorted((left, right) => {
			const leftStart = Number.isFinite(left.firstStartChar) ? left.firstStartChar : Number.POSITIVE_INFINITY;
			const rightStart = Number.isFinite(right.firstStartChar) ? right.firstStartChar : Number.POSITIVE_INFINITY;
			if (leftStart !== rightStart) return leftStart - rightStart;
			return left.annotationIndex - right.annotationIndex;
		});

	// Render 

	return (
		<div className="alp-page">
			<LyricsHeader
				songTitle={songTitle}
				isViewer={isViewer}
				isLoading={isLoading}
				isSaving={isSaving}
				onSave={saveAll}
			/>

			<LyricsEditPane
				state={{ isLoading, hasDirtyRanges, isPicking, isViewer }}
				lyricText={lyricText}
				songForSync={songForSync}
				syncedLines={syncedLines}
				activeTabIndex={activeTabIndex}
				highlightedRanges={highlightedRanges}
				textareaWrapperRef={textareaWrapperRef}
				textareaRef={textareaRef}
				sortedAnnotationEntries={sortedAnnotationEntries}
				editingAnnotationIndex={editingAnnotationIndex}
				onLyricChange={handleLyricChange}
				onSyncedLinesChange={setSyncedLines}
				onTabChange={(event) => setActiveTabIndex(event.index)}
				onTextareaInteraction={handleTextareaInteraction}
				onTextareaMouseUp={handleTextareaMouseUp}
				onTextareaKeyUp={handleTextareaKeyUp}
				onAddAnnotation={addAnnotation}
				onEditAnnotation={setEditingAnnotationIndex}
				onDoneEditing={() => setEditingAnnotationIndex(null)}
				onHoverAnnotation={setHoveredAnnotationIndex}
				onLeaveAnnotation={() => setHoveredAnnotationIndex(null)}
				onDeleteAnnotation={deleteAnnotation}
				onRemoveRange={removeRange}
				onAddRange={setPendingRangeForAnnotationIndex}
				onUpdateExplanation={updateAnnotationExplanation}
			/>
		</div>
	);
}
