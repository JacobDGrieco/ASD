/**
 * Defines "release day" for the auto-show-on-release visibility feature.
 *
 * A release goes live at midnight in the configured release visibility time
 * zone, not UTC midnight and not the server's local time. The default remains
 * America/New_York to preserve existing behavior. Override it with
 * `RELEASE_VISIBILITY_TIME_ZONE` on the server and
 * `VITE_RELEASE_VISIBILITY_TIME_ZONE` in the client build when needed.
 */
function configuredReleaseVisibilityTimeZone() {
	const viteTimeZone = import.meta.env?.VITE_RELEASE_VISIBILITY_TIME_ZONE;
	if (typeof viteTimeZone === 'string' && viteTimeZone.trim()) return viteTimeZone.trim();

	const processTimeZone = globalThis.process?.env?.RELEASE_VISIBILITY_TIME_ZONE;
	if (typeof processTimeZone === 'string' && processTimeZone.trim()) return processTimeZone.trim();

	return 'America/New_York';
}

export const RELEASE_VISIBILITY_TIME_ZONE = configuredReleaseVisibilityTimeZone();

const dayFormatters = new Map();
const offsetFormatters = new Map();

function dayFormatter(timeZone) {
	if (!dayFormatters.has(timeZone)) {
		dayFormatters.set(timeZone, new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}));
	}

	return dayFormatters.get(timeZone);
}

function offsetFormatter(timeZone) {
	if (!offsetFormatters.has(timeZone)) {
		offsetFormatters.set(timeZone, new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		}));
	}

	return offsetFormatters.get(timeZone);
}

function dayPartsInTimeZone(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	return dayFormatter(timeZone).format(date).split('-').map(Number);
}

/**
 * The UTC instant at which "today" in `timeZone` ends. A `releaseDate` strictly
 * before this instant counts as released.
 */
export function releaseVisibilityUpperBound(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	const [year, month, day] = dayPartsInTimeZone(now, timeZone);
	return new Date(Date.UTC(year, month - 1, day + 1));
}

/**
 * Whether `releaseDate` has released as of `now`. Missing or invalid release
 * dates are treated as already released.
 */
export function isReleasedOnUtcDay(releaseDate, now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	if (!releaseDate) return true;

	const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate);
	if (Number.isNaN(date.getTime())) return true;

	return date.getTime() < releaseVisibilityUpperBound(now, timeZone).getTime();
}

function getTimeZoneOffsetMilliseconds(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	const parts = offsetFormatter(timeZone).formatToParts(date).reduce((dateParts, part) => {
		if (part.type !== 'literal') dateParts[part.type] = Number(part.value);
		return dateParts;
	}, {});

	const asUtcTimestamp = Date.UTC(
		parts.year,
		(parts.month ?? 1) - 1,
		parts.day ?? 1,
		parts.hour ?? 0,
		parts.minute ?? 0,
		parts.second ?? 0
	);

	return asUtcTimestamp - date.getTime();
}

function timeZoneMidnightToUtc(year, month, day, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
	const offset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timeZone);
	const resolved = utcGuess - offset;
	const resolvedOffset = getTimeZoneOffsetMilliseconds(new Date(resolved), timeZone);

	return utcGuess - resolvedOffset;
}

/**
 * Milliseconds from `now` until the next configured local midnight. The function
 * name is kept for compatibility with existing callers.
 */
export function millisecondsUntilNextUtcMidnight(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
	const [year, month, day] = dayPartsInTimeZone(now, timeZone);
	const nextMidnight = timeZoneMidnightToUtc(year, month, day + 1, timeZone);
	return Math.max(1, nextMidnight - now.getTime());
}
