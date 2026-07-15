import { useEffect } from 'react';

export const SITE_TITLE = 'A.S.D.';

export function formatPageTitle(parts) {
	const rawParts = Array.isArray(parts) ? parts : [parts];
	const titleParts = rawParts.flatMap((part) => {
		const trimmed = String(part ?? '').trim();
		return trimmed && trimmed !== SITE_TITLE ? [trimmed] : [];
	});

	return titleParts.length ? `${titleParts.join(' | ')} | ${SITE_TITLE}` : SITE_TITLE;
}

export function usePageTitle(parts) {
	useEffect(() => {
		if (!parts) return;
		document.title = formatPageTitle(parts);
	}, [parts]);
}
