function toUtcDayValue(value) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function isReleasedOnUtcDay(releaseDate, now = new Date()) {
  const releaseDay = toUtcDayValue(releaseDate)
  if (releaseDay === null) return true

  return releaseDay <= toUtcDayValue(now)
}

export function millisecondsUntilNextUtcMidnight(now = new Date()) {
  const nextUtcMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  )

  return Math.max(1, nextUtcMidnight - now.getTime())
}
