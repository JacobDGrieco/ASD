/**
 * Central rules for the `isVisible` / `autoShowOnRelease` / `releaseDate` visibility
 * model shared by Artist, Album, Song, and Fashion entities.
 *
 * The model: a record is either explicitly visible (`isVisible: true`), or hidden
 * with `autoShowOnRelease: true` so it automatically becomes visible once its
 * `releaseDate` passes (see `releaseSchedule.js` for the exact release-day
 * boundary). `resolveEffectiveVisibility`/`isEffectivelyVisible` compute the *live*
 * visibility on every read, independent of whether the raw `isVisible` column has
 * been updated yet — the admin endpoints (`api/admin/albums.js`,
 * `api/admin/songs.js`) separately run a lazy sync to materialize that column after
 * release, but public reads never depend on that sync having run.
 *
 * Runs in both server (`api/public.js`, `api/admin/*.js`) and admin-client
 * (form default-visibility logic) contexts — pure functions, no I/O.
 */
import { isReleasedOnUtcDay } from './releaseSchedule.js';

/**
 * Default `isVisible`/`autoShowOnRelease` pair for a new record given its release
 * date: hidden-with-auto-show if the release date is in the future, otherwise
 * immediately visible. Used to prefill admin forms and as the fallback when a
 * caller doesn't explicitly set `isVisible`.
 */
export function defaultVisibilityForReleaseDate(releaseDate, now = new Date()) {
	if (releaseDate && !isReleasedOnUtcDay(releaseDate, now)) {
		return {
			isVisible: false,
			autoShowOnRelease: true,
		};
	}

	return {
		isVisible: true,
		autoShowOnRelease: false,
	};
}

/**
 * Normalizes admin-submitted visibility fields before a write. If the caller didn't
 * send an explicit boolean `isVisible`, falls back to `defaultVisibilityForReleaseDate`.
 * If `isVisible` is explicitly true, `autoShowOnRelease` is always forced false —
 * an admin manually showing a record overrides any pending auto-show.
 */
export function normalizeVisibilityInput(
	{ isVisible, autoShowOnRelease, releaseDate },
	now = new Date()
) {
	if (typeof isVisible !== 'boolean') {
		return defaultVisibilityForReleaseDate(releaseDate, now);
	}

	return {
		isVisible,
		autoShowOnRelease: isVisible ? false : Boolean(autoShowOnRelease),
	};
}

/**
 * Computes the *actual* current visibility of a record, as opposed to its stored
 * `isVisible` column: visible if explicitly `isVisible`, or if `autoShowOnRelease`
 * is set and the release date has passed. `shouldMaterialize` flags the case where
 * the DB row is stale (still `isVisible: false` but should now show) — the admin
 * sync jobs use this to decide which rows to flip.
 *
 * @returns {{isVisible: boolean, autoShowOnRelease: boolean, shouldMaterialize: boolean}}
 */
export function resolveEffectiveVisibility(
	{ isVisible, autoShowOnRelease, releaseDate },
	now = new Date()
) {
	const released = isReleasedOnUtcDay(releaseDate, now);
	const shouldAutoShow = Boolean(autoShowOnRelease) && released;
	return {
		isVisible: Boolean(isVisible) || shouldAutoShow,
		autoShowOnRelease: Boolean(autoShowOnRelease) && !released,
		shouldMaterialize: shouldAutoShow,
	};
}

/** Convenience wrapper: just the boolean from `resolveEffectiveVisibility`. */
export function isEffectivelyVisible(entity, releaseDate, now = new Date()) {
	return resolveEffectiveVisibility({
		isVisible: entity?.isVisible,
		autoShowOnRelease: entity?.autoShowOnRelease,
		releaseDate,
	}, now).isVisible;
}
