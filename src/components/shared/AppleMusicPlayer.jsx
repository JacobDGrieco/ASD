import { useMemo } from 'react';

function buildAppleMusicEmbedUrl(url) {
	if (!url || typeof url !== 'string') return null;

	const trimmedUrl = url.trim();
	if (!trimmedUrl) return null;

	try {
		const parsed = new URL(trimmedUrl);
		const host = parsed.hostname.replace(/^www\./, '');

		if (host === 'embed.music.apple.com') {
			return parsed.toString();
		}

		if (host !== 'music.apple.com' && host !== 'itunes.apple.com') {
			return null;
		}

		parsed.hostname = 'embed.music.apple.com';
		return parsed.toString();
	} catch {
		return null;
	}
}

function getEmbedHeight(url) {
	if (!url) return 450;

	try {
		const parsed = new URL(url);
		return parsed.searchParams.has('i') ? 175 : 450;
	} catch {
		return 450;
	}
}

export default function AppleMusicPlayer({ url, onPlay = null }) {
	const src = useMemo(() => buildAppleMusicEmbedUrl(url), [url]);
	const height = useMemo(() => getEmbedHeight(src), [src]);

	if (!src) return null;

	return (
		<iframe
			title="Apple Music Player"
			src={src}
			onFocus={onPlay ?? undefined}
			width="100%"
			height={String(height)}
			frameBorder="0"
			allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
			sandbox="allow-forms allow-popups allow-scripts allow-top-navigation-by-user-activation"
			loading="lazy"
			style={{ borderRadius: '12px', background: 'transparent' }}
		/>
	);
}
