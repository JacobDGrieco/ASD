/**
 * Whether the current browser session is an authenticated admin viewing a public
 * page. This gates public-preview behavior: hidden/unreleased records are included
 * in public API responses and marked with `isPubliclyVisible: false` so the UI can
 * draw the existing hidden/cross overlays.
 */
export function isAdminPreviewSession(session, token) {
	return Boolean(session?.role && token);
}
