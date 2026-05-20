import { isReleasedOnUtcDay, releaseVisibilityUpperBound } from './releaseSchedule.js'

export function defaultVisibilityForReleaseDate(releaseDate, now = new Date()) {
  if (releaseDate && !isReleasedOnUtcDay(releaseDate, now)) {
    return {
      isVisible: false,
      autoShowOnRelease: true,
    }
  }

  return {
    isVisible: true,
    autoShowOnRelease: false,
  }
}

export function normalizeVisibilityInput(
  { isVisible, autoShowOnRelease, releaseDate },
  now = new Date()
) {
  if (typeof isVisible !== 'boolean') {
    return defaultVisibilityForReleaseDate(releaseDate, now)
  }

  return {
    isVisible,
    autoShowOnRelease: isVisible ? false : Boolean(autoShowOnRelease),
  }
}

export function resolveEffectiveVisibility(
  { isVisible, autoShowOnRelease, releaseDate },
  now = new Date()
) {
  const released = isReleasedOnUtcDay(releaseDate, now)
  const shouldAutoShow = Boolean(autoShowOnRelease) && released
  return {
    isVisible: Boolean(isVisible) || shouldAutoShow,
    autoShowOnRelease: Boolean(autoShowOnRelease) && !released,
    shouldMaterialize: shouldAutoShow,
  }
}

export function isEffectivelyVisible(entity, releaseDate, now = new Date()) {
  return resolveEffectiveVisibility({
    isVisible: entity?.isVisible,
    autoShowOnRelease: entity?.autoShowOnRelease,
    releaseDate,
  }, now).isVisible
}

export function releaseVisibilityWhere(now = new Date()) {
  return {
    OR: [
      { isVisible: true },
      {
        AND: [
          { isVisible: false },
          { autoShowOnRelease: true },
          { releaseDate: { lt: releaseVisibilityUpperBound(now) } },
        ],
      },
    ],
  }
}
