/** Builds and applies `document.title` from route-specific parts, deduped against the site name. Client-only. */
import { useEffect } from 'react';

export const SITE_TITLE = 'A.S.D.';

/** Joins non-empty `parts` with `' | '` and appends the site name, e.g. `formatPageTitle(['Some Song', 'Some Artist'])` -> `"Some Song | Some Artist | A.S.D."`. */
export function formatPageTitle(parts) {
	const rawParts = Array.isArray(parts) ? parts : [parts];
	const titleParts = rawParts.flatMap((part) => {
		const trimmed = String(part ?? '').trim();
		return trimmed && trimmed !== SITE_TITLE ? [trimmed] : [];
	});

	return titleParts.length ? `${titleParts.join(' | ')} | ${SITE_TITLE}` : SITE_TITLE;
}

/** Sets `document.title` from `parts` whenever they change; does nothing while `parts` is falsy (e.g. before a page's data has loaded). */
export function usePageTitle(parts) {
	useEffect(() => {
		if (!parts) return;
		document.title = formatPageTitle(parts);
	}, [parts]);
}
