/**
 * Thin React wrapper around the SoundCloud iframe widget API.
 *
 * Used both as visible embeds and as the hidden transport for the global player in
 * `src/lib/playerContext.jsx`. The wrapper normalizes SoundCloud private-track
 * URLs, loads the widget script once, reports widget failures, and listens for the
 * global `asd-player-pause-external-audio` event unless explicitly opted out.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

const WIDGET_SCRIPT_SRC = 'https://w.soundcloud.com/player/api.js';
const WIDGET_READY_TIMEOUT_MS = 8000;
const HIDDEN_WIDGET_WIDTH = 300;
const HIDDEN_WIDGET_HEIGHT = 166;
let widgetApiRequest = null;
let soundCloudConsoleFilterInstalled = false;

function isSoundCloudEmbedBanner(args) {
	const message = args
		.flatMap((arg) => (typeof arg === 'string' ? [arg] : []))
		.join(' ');

	return message.includes('SoundCloud Embed Player') && message.includes('api-web');
}

function installSoundCloudConsoleFilter() {
	if (typeof window === 'undefined' || soundCloudConsoleFilterInstalled) return;

	soundCloudConsoleFilterInstalled = true
		;['log', 'info'].forEach((method) => {
			const original = window.console?.[method];
			if (typeof original !== 'function') return;

			window.console[method] = (...args) => {
				if (isSoundCloudEmbedBanner(args)) return;
				original.apply(window.console, args);
			};
		});
}

// SoundCloud private links often end with `/s-...`; the widget expects that token
// as `secret_token`, while share/tracking params can be dropped for stable embeds.
function soundCloudEmbedUrl(value) {
	const rawUrl = String(value ?? '').trim();
	if (!rawUrl) return '';

	try {
		const parsed = new URL(rawUrl);
		const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
		if (host !== 'soundcloud.com' && host !== 'on.soundcloud.com') return rawUrl;

		if (host === 'soundcloud.com') {
			const pathParts = parsed.pathname.split('/').filter(Boolean);
			const maybeSecretToken = pathParts[pathParts.length - 1] ?? '';
			if (/^s-[A-Za-z0-9]+$/.test(maybeSecretToken) && pathParts.length >= 3) {
				pathParts.pop();
				parsed.pathname = `/${pathParts.join('/')}`;
				parsed.searchParams.set('secret_token', maybeSecretToken);
			}
		}

		for (const key of [...parsed.searchParams.keys()]) {
			if (key === 'si' || key.startsWith('utm_')) parsed.searchParams.delete(key);
		}

		return parsed.toString();
	} catch {
		return rawUrl;
	}
}

function loadWidgetApi() {
	if (typeof window === 'undefined') return Promise.resolve(null);
	installSoundCloudConsoleFilter();
	if (window.SC?.Widget) return Promise.resolve(window.SC.Widget);
	if (widgetApiRequest) return widgetApiRequest;

	const existingScript = document.querySelector(`script[src="${WIDGET_SCRIPT_SRC}"]`);

	widgetApiRequest = new Promise((resolve, reject) => {
		const script = document.createElement('script');
		const activeScript = existingScript || script;

		activeScript.addEventListener('load', () => resolve(window.SC?.Widget ?? null), { once: true });
		activeScript.addEventListener('error', reject, { once: true });

		if (!existingScript) {
			script.src = WIDGET_SCRIPT_SRC;
			script.async = true;
			document.body.appendChild(script);
		}
	})
		.then((Widget) => {
			if (!Widget) widgetApiRequest = null;
			return Widget;
		})
		.catch((error) => {
			widgetApiRequest = null;
			throw error;
		});

	return widgetApiRequest;
}

export function preloadSoundCloudWidgetApi() {
	return loadWidgetApi().catch(() => null);
}

const SoundCloudPlayer = forwardRef(function SoundCloudPlayer({
	url,
	isPlaying = false,
	hidden = false,
	autoPlayOnReady = false,
	restartToken = 0,
	respondsToGlobalPause = true,
	onPlaybackStart = null,
	onPlaybackPause = null,
	onPlaybackEnd = null,
	onPlaybackProgress = null,
	onReady = null,
	onWidgetApiError = null,
}, ref) {
	const iframeRef = useRef(null);
	const widgetRef = useRef(null);
	const hasStartedTrackRef = useRef(false);
	const onPlaybackStartRef = useRef(onPlaybackStart);
	const onPlaybackPauseRef = useRef(onPlaybackPause);
	const onPlaybackEndRef = useRef(onPlaybackEnd);
	const onPlaybackProgressRef = useRef(onPlaybackProgress);
	const onReadyRef = useRef(onReady);
	const onWidgetApiErrorRef = useRef(onWidgetApiError);
	const readyTimeoutRef = useRef(null);
	const hasReportedWidgetErrorRef = useRef(false);
	const srcUrlRef = useRef(null);
	const srcAutoPlayRef = useRef(false);
	const [isReady, setIsReady] = useState(false);
	const [widgetApiFailed, setWidgetApiFailed] = useState(false);

	if (url !== srcUrlRef.current) {
		srcUrlRef.current = url;
		srcAutoPlayRef.current = Boolean(autoPlayOnReady);
	}

	const src = useMemo(() => {
		if (!url) return null;

		const autoPlay = srcAutoPlayRef.current ? 'true' : 'false';
		const embedUrl = soundCloudEmbedUrl(url);

		return `https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23c8a96e&auto_play=${autoPlay}&hide_related=true&show_comments=false&show_user=false&show_reposts=false&visual=false`;
	}, [url]);

	useEffect(() => {
		onPlaybackStartRef.current = onPlaybackStart;
		onPlaybackPauseRef.current = onPlaybackPause;
		onPlaybackEndRef.current = onPlaybackEnd;
		onPlaybackProgressRef.current = onPlaybackProgress;
		onReadyRef.current = onReady;
		onWidgetApiErrorRef.current = onWidgetApiError;
	}, [onPlaybackEnd, onPlaybackPause, onPlaybackProgress, onPlaybackStart, onReady, onWidgetApiError]);

	useEffect(() => {
		hasStartedTrackRef.current = false;
	}, [restartToken]);

	const reportWidgetApiError = useCallback(() => {
		if (hasReportedWidgetErrorRef.current) return;
		hasReportedWidgetErrorRef.current = true;
		setWidgetApiFailed(true);
		onWidgetApiErrorRef.current?.();
	}, []);

	useImperativeHandle(ref, () => ({
		pause() {
			widgetRef.current?.pause?.();
		},
		play() {
			widgetRef.current?.play?.();
		},
		seekTo(seconds) {
			const nextSeconds = Number(seconds);
			if (!Number.isFinite(nextSeconds)) return;
			widgetRef.current?.seekTo?.(Math.max(0, nextSeconds) * 1000);
		},
		getPosition() {
			return new Promise((resolve) => {
				widgetRef.current?.getPosition?.((milliseconds) => resolve((milliseconds ?? 0) / 1000));
			});
		},
		getDuration() {
			return new Promise((resolve) => {
				widgetRef.current?.getDuration?.((milliseconds) => resolve((milliseconds ?? 0) / 1000));
			});
		},
	}), []);

	useEffect(() => {
		setIsReady(false);
		widgetRef.current = null;
		setWidgetApiFailed(false);
		hasReportedWidgetErrorRef.current = false;
		hasStartedTrackRef.current = false;
		if (readyTimeoutRef.current !== null) {
			window.clearTimeout(readyTimeoutRef.current);
			readyTimeoutRef.current = null;
		}

		if (!url || !iframeRef.current) return undefined;

		let isCancelled = false;
		let widget = null;
		readyTimeoutRef.current = window.setTimeout(() => {
			if (!isCancelled) reportWidgetApiError();
		}, WIDGET_READY_TIMEOUT_MS);

		loadWidgetApi()
			.then((Widget) => {
				if (isCancelled || !iframeRef.current) return;
				if (!Widget) {
					reportWidgetApiError();
					return;
				}

				widget = Widget(iframeRef.current);
				widgetRef.current = widget;

				widget.bind(Widget.Events.READY, () => {
					if (isCancelled) return;
					if (readyTimeoutRef.current !== null) {
						window.clearTimeout(readyTimeoutRef.current);
						readyTimeoutRef.current = null;
					}
					setIsReady(true);
					widget.getDuration?.((milliseconds) => {
						if (!isCancelled) onReadyRef.current?.({ duration: (milliseconds ?? 0) / 1000 });
					});
				});

				widget.bind(Widget.Events.PLAY, () => {
					if (isCancelled) return;
					onPlaybackStartRef.current?.();
				});

				widget.bind(Widget.Events.PAUSE, () => {
					if (isCancelled) return;
					onPlaybackPauseRef.current?.();
				});

				widget.bind(Widget.Events.FINISH, () => {
					if (isCancelled) return;
					hasStartedTrackRef.current = false;
					onPlaybackEndRef.current?.();
				});

				widget.bind(Widget.Events.PLAY_PROGRESS, (event) => {
					if (isCancelled) return;
					const position = Number(event?.currentPosition ?? 0) / 1000;
					const duration = Number(event?.duration ?? 0) / 1000;
					onPlaybackProgressRef.current?.({ position, duration });
				});

				if (Widget.Events.ERROR) {
					widget.bind(Widget.Events.ERROR, () => {
						if (!isCancelled) reportWidgetApiError();
					});
				}
			})
			.catch(() => {
				if (!isCancelled) reportWidgetApiError();
			});

		return () => {
			isCancelled = true;
			if (readyTimeoutRef.current !== null) {
				window.clearTimeout(readyTimeoutRef.current);
				readyTimeoutRef.current = null;
			}
			setIsReady(false);
		};
	}, [reportWidgetApiError, url]);

	useEffect(() => {
		if (!url || !isReady || !widgetRef.current) return;

		const shouldPlay = isPlaying || autoPlayOnReady;

		if (shouldPlay) {
			widgetRef.current.setVolume?.(100);

			if (!hasStartedTrackRef.current) {
				widgetRef.current.seekTo?.(0);
				hasStartedTrackRef.current = true;
			}

			widgetRef.current.play();
			return;
		}

		widgetRef.current.pause();
	}, [autoPlayOnReady, isPlaying, isReady, restartToken, url]);

	useEffect(() => {
		if (!respondsToGlobalPause) return undefined;

		const handleGlobalPause = () => {
			widgetRef.current?.pause?.();
		};

		window.addEventListener('asd-player-pause-external-audio', handleGlobalPause);
		return () => window.removeEventListener('asd-player-pause-external-audio', handleGlobalPause);
	}, [respondsToGlobalPause]);

	if (!url) return null;

	return (
		<iframe
			key={src}
			ref={iframeRef}
			title="SoundCloud Player"
			width={hidden ? String(HIDDEN_WIDGET_WIDTH) : '100%'}
			height={hidden ? String(HIDDEN_WIDGET_HEIGHT) : '166'}
			scrolling="no"
			frameBorder="no"
			allow="autoplay; encrypted-media"
			src={src}
			style={
				hidden
					? {
						position: 'fixed',
						left: `-${HIDDEN_WIDGET_WIDTH + 100}px`,
						top: `-${HIDDEN_WIDGET_HEIGHT + 100}px`,
						width: `${HIDDEN_WIDGET_WIDTH}px`,
						height: `${HIDDEN_WIDGET_HEIGHT}px`,
						opacity: 0,
						border: 0,
						pointerEvents: 'none',
					}
					: { borderRadius: '4px' }
			}
			aria-hidden={hidden || undefined}
			data-widget-api-failed={widgetApiFailed ? 'true' : 'false'}
		/>
	);
});

export default SoundCloudPlayer;
