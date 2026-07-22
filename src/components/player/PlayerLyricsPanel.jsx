import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { usePlayer } from '../../lib/playerContextCore.jsx';
import LyricsView from '../song/LyricsView.jsx';

const ACTIVE_LINE_TOP_ANCHOR = 0.46;
const CLOSE_LYRIC_GAP_MS = 500;

function isBracketedLyricCue(line) {
	const trimmed = String(line ?? '').trim();
	return trimmed.length >= 2 && trimmed.startsWith('[') && trimmed.endsWith(']');
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function syncedLyricsPlaybackState(syncedLines, currentTime) {
	if (!syncedLines.length) {
		return { activeLineIndex: null, anchorLineIndex: null, nextAnchorLineIndex: null, anchorProgress: 0, isCloseGap: false };
	}

	if (typeof currentTime !== 'number') {
		return {
			activeLineIndex: null,
			anchorLineIndex: syncedLines[0].lineIndex,
			nextAnchorLineIndex: null,
			anchorProgress: 0,
			isCloseGap: false,
		};
	}

	const currentMs = Math.max(0, currentTime * 1000);
	let current = null;
	let next = null;
	for (const line of syncedLines) {
		if (currentMs >= line.startMs) current = line;
		else if (!next) next = line;
	}

	const active = current && currentMs < current.endMs ? current : null;
	if (active) {
		return {
			activeLineIndex: active.lineIndex,
			anchorLineIndex: active.lineIndex,
			nextAnchorLineIndex: null,
			anchorProgress: 0,
			isCloseGap: false,
		};
	}

	if (current && next) {
		const gapMs = Math.max(0, next.startMs - current.endMs);
		return {
			activeLineIndex: null,
			anchorLineIndex: current.lineIndex,
			nextAnchorLineIndex: next.lineIndex,
			anchorProgress: gapMs > 0 ? clamp((currentMs - current.endMs) / gapMs, 0, 1) : 1,
			isCloseGap: gapMs <= CLOSE_LYRIC_GAP_MS,
		};
	}

	return {
		activeLineIndex: null,
		anchorLineIndex: next?.lineIndex ?? current?.lineIndex ?? syncedLines[0].lineIndex,
		nextAnchorLineIndex: null,
		anchorProgress: 0,
		isCloseGap: false,
	};
}

function buildSyncedLyricViewModel(lyric) {
	const rawLines = String(lyric?.text ?? '').split('\n');
	const validSyncedLines = Array.isArray(lyric?.syncedLines)
		? lyric.syncedLines
			.filter((line) => Number.isInteger(line.lineIndex) && Number.isFinite(line.startMs) && Number.isFinite(line.endMs))
			.filter((line) => rawLines[line.lineIndex]?.trim())
			.filter((line) => !isBracketedLyricCue(rawLines[line.lineIndex]))
			.toSorted((left, right) => left.startMs - right.startMs)
		: [];
	const timingByLineIndex = new Map(validSyncedLines.map((line) => [line.lineIndex, line]));
	const displayLines = rawLines
		.map((text, lineIndex) => ({
			text,
			lineIndex,
			isCue: isBracketedLyricCue(text),
			isTimed: timingByLineIndex.has(lineIndex),
		}))
		.filter((line) => line.text.trim());

	return { displayLines, validSyncedLines };
}

function SyncedLyricsCarousel({ lyric, currentTime }) {
	const viewportRef = useRef(null);
	const trackRef = useRef(null);
	const lineRefs = useRef(new Map());
	const [trackOffset, setTrackOffset] = useState(0);
	const { displayLines, validSyncedLines } = useMemo(() => buildSyncedLyricViewModel(lyric), [lyric]);
	const playbackState = syncedLyricsPlaybackState(validSyncedLines, currentTime);
	const focusLineIndex = playbackState.anchorProgress < 0.5
		? playbackState.anchorLineIndex
		: (playbackState.nextAnchorLineIndex ?? playbackState.anchorLineIndex);
	const focusDisplayIndex = Math.max(0, displayLines.findIndex((line) => line.lineIndex === focusLineIndex));

	useLayoutEffect(() => {
		const viewport = viewportRef.current;
		const anchorLine = lineRefs.current.get(playbackState.anchorLineIndex);
		if (!viewport || !anchorLine) return;

		const nextAnchorLine = lineRefs.current.get(playbackState.nextAnchorLineIndex);
		const anchorTop = nextAnchorLine
			? anchorLine.offsetTop + ((nextAnchorLine.offsetTop - anchorLine.offsetTop) * playbackState.anchorProgress)
			: anchorLine.offsetTop;
		const nextOffset = (viewport.clientHeight * ACTIVE_LINE_TOP_ANCHOR) - anchorTop;
		setTrackOffset(nextOffset);
	}, [playbackState.anchorLineIndex, playbackState.nextAnchorLineIndex, playbackState.anchorProgress, displayLines]);

	if (!displayLines.length) return null;

	return (
		<div className="player-synced-lyrics" ref={viewportRef} aria-label="Synced lyrics">
			<div
				ref={trackRef}
				className="player-synced-lyrics-track"
				style={{
					transform: `translate3d(0, ${trackOffset}px, 0)`,
					transitionDuration: playbackState.isCloseGap ? '0.42s' : undefined,
				}}
			>
				{displayLines.map((line, displayIndex) => {
					const distance = Math.abs(displayIndex - focusDisplayIndex);
					const isActive = line.lineIndex === playbackState.activeLineIndex;
					const depth = Math.min(distance, 4);
					return (
						<div
							key={`${line.lineIndex}-${line.text}`}
							ref={(element) => {
								if (element) lineRefs.current.set(line.lineIndex, element);
								else lineRefs.current.delete(line.lineIndex);
							}}
							className={`player-synced-lyrics-line${isActive ? ' player-synced-lyrics-line-active' : ''}${line.isCue ? ' player-synced-lyrics-line-cue' : ''}`.trim()}
							style={{ '--lyric-distance': depth }}
							aria-current={isActive ? 'true' : undefined}
						>
							{line.text}
						</div>
					);
				})}
			</div>
		</div>
	);
}

export default function PlayerLyricsPanel({ song }) {
	const { position } = usePlayer();
	const { data, loading, error } = useApi(song?.id ? `/api/songs/${song.id}` : null, {
		refreshAtUtcMidnight: true,
	});

	if (loading && !data) {
		return (
			<div className="player-panel-empty" aria-label="Loading lyrics">
				<span className="player-panel-spinner" aria-hidden="true" />
			</div>
		);
	}

	if (error || !data?.lyric?.text) {
		return <div className="player-panel-empty">Lyrics unavailable</div>;
	}

	const { validSyncedLines } = buildSyncedLyricViewModel(data.lyric);
	if (validSyncedLines.length > 0) {
		return (
			<div className="player-lyrics-panel player-lyrics-panel-synced">
				<SyncedLyricsCarousel lyric={data.lyric} currentTime={position} />
			</div>
		);
	}

	return (
		<div className="player-lyrics-panel">
			<LyricsView lyric={data.lyric} currentTime={position} autoFollow />
		</div>
	);
}
