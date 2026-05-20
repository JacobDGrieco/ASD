export const RELEASE_VISIBILITY_TIME_ZONE = 'America/New_York'

function dayPartsInTimeZone(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date).split('-').map(Number)
}

export function releaseVisibilityUpperBound(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const [year, month, day] = dayPartsInTimeZone(now, timeZone)
  return new Date(Date.UTC(year, month - 1, day + 1))
}

export function isReleasedOnUtcDay(releaseDate, now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  if (!releaseDate) return true

  const date = releaseDate instanceof Date ? releaseDate : new Date(releaseDate)
  if (Number.isNaN(date.getTime())) return true

  return date.getTime() < releaseVisibilityUpperBound(now, timeZone).getTime()
}

function getTimeZoneOffsetMilliseconds(date, timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  )

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

export function millisecondsUntilNextUtcMidnight(now = new Date(), timeZone = RELEASE_VISIBILITY_TIME_ZONE) {
  const [year, month, day] = dayPartsInTimeZone(now, timeZone)
  const nextMidnight = timeZoneMidnightToUtc(year, month, day + 1, timeZone)
  return Math.max(1, nextMidnight - now.getTime())
}
