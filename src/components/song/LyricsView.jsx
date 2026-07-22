import { useEffect, useMemo, useRef, useState } from 'react';
import AnnotationPopup from './AnnotationPopup.jsx';
import '../../styles/LyricsView.css';

function LyricLine({
	lineText,
	lineRanges,
	lineIndex,
	isSynced,
	isActive,
	lineRef,
	hoveredAnnotationId,
	openAnnotationId,
	openAnnotationAnchorLineIndex,
	setHoveredAnnotationId,
	setOpenAnnotationId,
	setOpenAnnotationAnchorLineIndex,
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
							onClick={() => {
								setOpenAnnotationId(isOpen && openAnnotationAnchorLineIndex === lineIndex ? null : span.annotationId);
								setOpenAnnotationAnchorLineIndex(isOpen && openAnnotationAnchorLineIndex === lineIndex ? -1 : lineIndex);
							}}
						>
							{span.text}
						</button>
					);
				})}
			</div>
			{openAnnotationId && lineIndex === openAnnotationAnchorLineIndex && spans.some(s => s.annotationId === openAnnotationId) && (() => {
				const openAnnotation = allAnnotations.find(a => a.id === openAnnotationId);
				return openAnnotation ? <AnnotationPopup annotation={openAnnotation} className="lyrics-view-popup-overlay" /> : null;
			})()}
		</div>
	);
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
	const [openAnnotationAnchorLineIndex, setOpenAnnotationAnchorLineIndex] = useState(-1);
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

	if (!lyric) return null;

	// flatten ranges across all annotations
	const flatRanges = (lyric.annotations ?? []).flatMap(ann =>
		ann.ranges.map(r => ({ startChar: r.startChar, endChar: r.endChar, annotationId: ann.id }))
	).sort((a, b) => a.startChar - b.startChar);

	const lines = lyric.text.split('\n');
	let lineOffset = 0;

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
							lineIndex={i}
							isSynced={syncedLineIndexes.has(i)}
							isActive={activeLineIndex === i}
							lineRef={(element) => {
								if (element) lineRefs.current.set(i, element);
								else lineRefs.current.delete(i);
							}}
							hoveredAnnotationId={hoveredAnnotationId}
							openAnnotationId={openAnnotationId}
							openAnnotationAnchorLineIndex={openAnnotationAnchorLineIndex}
							setHoveredAnnotationId={setHoveredAnnotationId}
							setOpenAnnotationId={setOpenAnnotationId}
							setOpenAnnotationAnchorLineIndex={setOpenAnnotationAnchorLineIndex}
							allAnnotations={lyric.annotations ?? []}
						/>
					);
					lineOffset += line.length + 1;
					return result;
				})}
			</div>
		</section>
	);
}
