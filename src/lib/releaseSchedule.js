/**
 * Defines "release day" for the auto-show-on-release visibility feature
 * (see `contentVisibility.js`).
 *
 * Business rule: a release goes live at midnight **America/New_York** time on its
 * release date, not UTC midnight and not the server's local time. All the date math
 * here exists to translate between a UTC `releaseDate` timestamp and that NY-local
 * day boundary without relying on the host's timezone (Vercel Functions run in UTC).
 *
 * Runs server-side (visibility checks in `api/public.js`/`api/admin/*.js`) and
 * client-side (`useApi`'s midnight-refresh scheduling) — pure date math, no I/O.
 */
export const RELEASE_VISIBILITY_TIME_ZONE = 'America/New_York'

const DEFAULT_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: RELEASE_VISIBILITY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const DEFAULT_OFFSET_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: RELEASE_VISIBILITY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

// The offset math below is hardcoded for one time zone (via Intl.DateTimeFormat
// instances built for RELEASE_VISIBILITY_TIME_ZONE at module load). The timeZone
// parameter exists for readability/testability at call sites, not to support
// arbitrary zones — reject anything else rather than silently using the wrong offset.
function assertReleaseVisibilityTimeZone(timeZone) {
  if (timeZone !== RELEASE_VISIBILITY_TIME_ZONE) {
    throw new Error(`Unsupported release visibility time zone: ${timeZone}`)
  }
}

function dayPartsInTimeZone(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  assertReleaseVisibilityTimeZone(timeZone)
  return DEFAULT_DAY_FORMATTER.format(date).split('-').map(Number)
}

/**
 * The UTC instant at which "today" (in `timeZone`) ends — i.e. midnight at the
 * start of tomorrow, NY-local. A `releaseDate` strictly before this instant counts
 * as released. Note this is a day-granularity boundary derived from `now`'s
 * calendar date in NY, not `now`'s exact NY wall-clock time.
 */
export function releaseVisibilityUpperBound(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const [year, month, day] = dayPartsInTimeZone(now, timeZone)
  return new Date(Date.UTC(year, month - 1, day + 1))
}

/**
 * Whether `releaseDate` has released as of `now`, per the NY-midnight boundary. A
 * missing/invalid `releaseDate` is treated as "always released" (e.g. catalog items
 * without a release date shouldn't be hidden by this rule).
 */
export function isReleasedOnUtcDay(releaseDate, now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  if (!releaseDate) return true

  const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return true

  return date.getTime() < releaseVisibilityUpperBound(now, timeZone).getTime()
}

function getTimeZoneOffsetMilliseconds(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  assertReleaseVisibilityTimeZone(timeZone)
  const parts = DEFAULT_OFFSET_FORMATTER.formatToParts(date).reduce((dateParts, part) => {
    if (part.type !== 'literal') dateParts[part.type] = Number(part.value)
    return dateParts
  }, {})

  const asUtcTimestamp = Date.UTC(
    parts.year,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  )

  return asUtcTimestamp - date.getTime()
}

function timeZoneMidnightToUtc(year, month, day, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  const offset = getTimeZoneOffsetMilliseconds(new Date(utcGuess), timeZone)
  const resolved = utcGuess - offset
  const resolvedOffset = getTimeZoneOffsetMilliseconds(new Date(resolved), timeZone)

  return utcGuess - resolvedOffset
}

/**
 * Milliseconds from `now` until the next NY-local midnight — used by `useApi`'s
 * `refreshAtUtcMidnight` option to re-fetch public data right as new releases
 * become visible, despite the misleading "Utc" in the name (it's actually
 * NY-midnight; see the module header).
 */
export function millisecondsUntilNextUtcMidnight(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const [year, month, day] = dayPartsInTimeZone(now, timeZone)
  const nextMidnight = timeZoneMidnightToUtc(year, month, day + 1, timeZone)
  return Math.max(1, nextMidnight - now.getTime())
}
