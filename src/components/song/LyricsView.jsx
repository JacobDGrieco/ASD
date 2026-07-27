/**
 * Public lyrics and annotations renderer.
 *
 * Converts stored lyric text, synced lines, and annotation ranges into the
 * interactive lyric display used by song pages and the player.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnnotationPopup from './AnnotationPopup.jsx';
import '../../styles/LyricsView.css';

function LyricLine({
	lineText,
	lineRanges,
	isSynced,
	isActive,
	lineRef,
	hoveredAnnotationId,
	openAnnotationId,
	setHoveredAnnotationId,
	onToggleAnnotation,
	allAnnotations,
}) {
	if (lineText.trim() === '') {
		return <div className="lyrics-view-line lyrics-view-line-blank" aria-hidden="true" />;
	}

	if (lineRanges.length === 0) {
		return (
			<div ref={lineRef} className={`lyrics-view-line${isSynced ? ' lyrics-view-line-synced' : ''}${isActive ? ' lyrics-view-line-active' : ''}`.trim()}>
				<span className="lyrics-view-plain">{lineText}</span>
			</div>
		);
	}

	const spans = buildSpans(lineText, lineRanges);

	return (
		<div className="lyrics-view-line-wrap">
			<div ref={lineRef} className={`lyrics-view-line${isSynced ? ' lyrics-view-line-synced' : ''}${isActive ? ' lyrics-view-line-active' : ''}`.trim()}>
				{spans.map((span) => {
					if (!span.annotationId) {
						return <span key={`plain-${span.start}-${span.end}`} className="lyrics-view-plain">{span.text}</span>;
					}
					const annotation = allAnnotations.find(a => a.id === span.annotationId);
					if (!annotation) return <span key={`plain-${span.start}-${span.end}`} className="lyrics-view-plain">{span.text}</span>;
					const isOpen = openAnnotationId === span.annotationId;
					const isHovered = hoveredAnnotationId === span.annotationId;
					return (
						<button
							type="button"
							key={`${span.annotationId}-${span.start}-${span.end}`}
							className={`lyrics-view-annotated ${isHovered ? 'lyrics-view-hovered' : ''} ${isOpen ? 'lyrics-view-active' : ''}`.trim()}
							onMouseEnter={() => setHoveredAnnotationId(span.annotationId)}
							onMouseLeave={() => setHoveredAnnotationId((currentId) => (currentId === span.annotationId ? null : currentId))}
							onFocus={() => setHoveredAnnotationId(span.annotationId)}
							onBlur={() => setHoveredAnnotationId((currentId) => (currentId === span.annotationId ? null : currentId))}
							onClick={(event) => onToggleAnnotation(span.annotationId, event.currentTarget)}
							aria-expanded={isOpen}
							aria-controls={isOpen ? 'lyrics-annotation-popup' : undefined}
						>
							{span.text}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function annotationPopupPosition(triggerElement) {
	if (typeof window === 'undefined') return null;

	const rect = triggerElement.getBoundingClientRect();
	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const gutter = 16;
	const offset = 12;
	const width = Math.min(340, viewportWidth - (gutter * 2));
	const estimatedHeight = Math.min(260, viewportHeight - (gutter * 2));
	const unclampedLeft = rect.left + (rect.width / 2) - (width / 2);
	const left = Math.min(Math.max(unclampedLeft, gutter), Math.max(gutter, viewportWidth - width - gutter));
	const shouldPlaceAbove = rect.bottom + offset + estimatedHeight > viewportHeight && rect.top > estimatedHeight;
	const top = shouldPlaceAbove
		? Math.max(gutter, rect.top - offset)
		: Math.min(rect.bottom + offset, viewportHeight - gutter);

	return {
		left,
		top,
		width,
		placement: shouldPlaceAbove ? 'above' : 'below',
	};
}

function buildSpans(text, lineRanges) {
	const sorted = lineRanges.toSorted((a, b) => a.startChar - b.startChar);
	const spans = [];
	let cursor = 0;
	for (const range of sorted) {
		const start = Math.max(range.startChar, cursor);
		if (start >= range.endChar) continue;
		if (start > cursor) {
			spans.push({ text: text.slice(cursor, start), annotationId: null, start: cursor, end: start });
		}
		spans.push({ text: text.slice(start, range.endChar), annotationId: range.annotationId, start, end: range.endChar });
		cursor = range.endChar;
	}
	if (cursor < text.length) {
		spans.push({ text: text.slice(cursor), annotationId: null, start: cursor, end: text.length });
	}
	return spans;
}

function activeSyncedLineIndex(syncedLines, currentTime) {
	if (!Array.isArray(syncedLines) || typeof currentTime !== 'number') return null;
	const currentMs = Math.max(0, currentTime * 1000);
	const current = syncedLines.filter((line) => currentMs >= line.startMs).at(-1);
	return current && currentMs < current.endMs ? current.lineIndex : null;
}

function isBracketedLyricCue(line) {
	const trimmed = String(line ?? '').trim();
	return trimmed.length >= 2 && trimmed.startsWith('[') && trimmed.endsWith(']');
}

export default function LyricsView({ lyric, currentTime = null, autoFollow = false }) {
	const [openAnnotationId, setOpenAnnotationId] = useState(null);
	const [openAnnotationPosition, setOpenAnnotationPosition] = useState(null);
	const [hoveredAnnotationId, setHoveredAnnotationId] = useState(null);
	const lineRefs = useRef(new Map());

	const syncedLines = useMemo(() => (
		Array.isArray(lyric?.syncedLines)
			? lyric.syncedLines
				.filter((line) => Number.isInteger(line.lineIndex) && Number.isFinite(line.startMs) && Number.isFinite(line.endMs))
				.filter((line) => !isBracketedLyricCue(String(lyric?.text ?? '').split('\n')[line.lineIndex]))
				.toSorted((left, right) => left.startMs - right.startMs)
			: []
	), [lyric?.syncedLines, lyric?.text]);
	const activeLineIndex = activeSyncedLineIndex(syncedLines, currentTime);
	const syncedLineIndexes = useMemo(() => new Set(syncedLines.map((line) => line.lineIndex)), [syncedLines]);

	useEffect(() => {
		if (!autoFollow || activeLineIndex === null) return;
		const line = lineRefs.current.get(activeLineIndex);
		line?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}, [activeLineIndex, autoFollow]);

	useEffect(() => {
		if (!openAnnotationId) return undefined;

		const closeAnnotation = (event) => {
			if (event.type === 'keydown' && event.key !== 'Escape') return;
			const target = event.target;
			if (target instanceof Element && (target.closest('.annotation-popup-popup') || target.closest('.lyrics-view-annotated'))) return;
			setOpenAnnotationId(null);
			setOpenAnnotationPosition(null);
		};

		window.addEventListener('keydown', closeAnnotation);
		window.addEventListener('pointerdown', closeAnnotation, true);
		window.addEventListener('resize', closeAnnotation);
		window.addEventListener('scroll', closeAnnotation, true);
		return () => {
			window.removeEventListener('keydown', closeAnnotation);
			window.removeEventListener('pointerdown', closeAnnotation, true);
			window.removeEventListener('resize', closeAnnotation);
			window.removeEventListener('scroll', closeAnnotation, true);
		};
	}, [openAnnotationId]);

	if (!lyric) return null;

	// flatten ranges across all annotations
	const flatRanges = (lyric.annotations ?? []).flatMap(ann =>
		ann.ranges.map(r => ({ startChar: r.startChar, endChar: r.endChar, annotationId: ann.id }))
	).sort((a, b) => a.startChar - b.startChar);

	const lines = lyric.text.split('\n');
	let lineOffset = 0;
	const openAnnotation = openAnnotationId
		? (lyric.annotations ?? []).find((annotation) => annotation.id === openAnnotationId)
		: null;

	const handleToggleAnnotation = (annotationId, triggerElement) => {
		if (openAnnotationId === annotationId) {
			setOpenAnnotationId(null);
			setOpenAnnotationPosition(null);
			return;
		}

		setOpenAnnotationId(annotationId);
		setOpenAnnotationPosition(annotationPopupPosition(triggerElement));
	};

	return (
		<section className="lyrics-view-section">
			<div className="lyrics-view-lyrics">
				{lines.map((line, i) => {
					const lineStart = lineOffset;
					const lineEnd = lineStart + line.length;
					const lineRanges = flatRanges.reduce((ranges, r) => {
						if (r.startChar >= lineEnd || r.endChar <= lineStart) return ranges;
						ranges.push({
							startChar: Math.max(r.startChar - lineStart, 0),
							endChar: Math.min(r.endChar - lineStart, line.length),
							annotationId: r.annotationId,
						});
						return ranges;
					}, []);
					const result = (
						<LyricLine
							key={`line-${lineStart}`}
							lineText={line}
							lineRanges={lineRanges}
							isSynced={syncedLineIndexes.has(i)}
							isActive={activeLineIndex === i}
							lineRef={(element) => {
								if (element) lineRefs.current.set(i, element);
								else lineRefs.current.delete(i);
							}}
							hoveredAnnotationId={hoveredAnnotationId}
							openAnnotationId={openAnnotationId}
							setHoveredAnnotationId={setHoveredAnnotationId}
							onToggleAnnotation={handleToggleAnnotation}
							allAnnotations={lyric.annotations ?? []}
						/>
					);
					lineOffset += line.length + 1;
					return result;
				})}
			</div>
			{openAnnotation && openAnnotationPosition && typeof document !== 'undefined' && createPortal(
				<div className="lyrics-view-annotation-layer" aria-live="polite">
					<AnnotationPopup
						id="lyrics-annotation-popup"
						annotation={openAnnotation}
						className="lyrics-view-popup-overlay"
						placement={openAnnotationPosition.placement}
						onClose={() => {
							setOpenAnnotationId(null);
							setOpenAnnotationPosition(null);
						}}
						style={{
							left: `${openAnnotationPosition.left}px`,
							top: `${openAnnotationPosition.top}px`,
							'--annotation-popup-width': `${openAnnotationPosition.width}px`,
						}}
					/>
				</div>,
				document.body
			)}
		</section>
	);
}
