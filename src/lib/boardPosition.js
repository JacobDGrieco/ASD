/**
 * Deterministic pseudo-random layout engine for the public "board" corkboard UI
 * (`BoardPage.jsx`/`BoardCanvas.jsx`). Each post's position, rotation, and size are
 * derived from a hash of its id — the same post always lands in the same spot on
 * every render/reload — with a best-effort collision-avoidance pass so unpinned
 * cards don't stack on top of pinned ones.
 *
 * Runs client-side only (used directly by the public board page to lay out fetched
 * posts). Pure math, no I/O; all layout constants below are visual tuning values
 * with no independent "correct" value — they were chosen to look right on the
 * `CANVAS_WIDTH`x`CANVAS_HEIGHT` canvas, not derived from a formula.
 */
export const CANVAS_WIDTH = 3000
export const CANVAS_HEIGHT = 2000
const CANVAS_CENTER_X = CANVAS_WIDTH / 2
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2
const RADIUS_STEP = 300 // px each "ring" of unpinned cards moves out from center
const JITTER = 60 // px of random position wobble so cards don't land in a perfect grid
const MIN_CARD_WIDTH = 180
const MAX_CARD_WIDTH = 260
const MAX_ROTATION_DEG = 10 // cards rotate up to +/- this many degrees, pin-board style
const MAX_OVERLAP_FRACTION = 0.10 // reject a candidate spot if it overlaps an obstacle by more than 10% of the smaller card's area
const ANGLE_TRIES = 12 // angular positions sampled per ring when avoiding collisions

// Deterministic string hash (same algorithm as Java's String.hashCode) — gives each
// post id a stable pseudo-random number to derive its position/size/rotation from,
// without needing to store those values or call an actual RNG.
function seededHash(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/** Deterministic width/height for a card, derived from its id's hash. */
export function cardDimensions(id) {
  const h = seededHash(id)
  const width = MIN_CARD_WIDTH + (h % (MAX_CARD_WIDTH - MIN_CARD_WIDTH + 1))
  return { width, height: Math.round(width * 1.5) }
}

// Axis-aligned bounding box of a rotated card, used for cheap overlap testing
// (rotating the card enlarges its AABB, so this is conservative, not exact).
function aabb(posX, posY, width, height, rotation) {
  const sinA = Math.abs(Math.sin(rotation * Math.PI / 180))
  const cosA = Math.abs(Math.cos(rotation * Math.PI / 180))
  const bw = width * cosA + height * sinA
  const bh = width * sinA + height * cosA
  const cx = posX + width / 2
  const cy = posY + height / 2
  return { left: cx - bw / 2, top: cy - bh / 2, right: cx + bw / 2, bottom: cy + bh / 2, area: width * height }
}

function overlapFraction(a, b) {
  const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  return (ix * iy) / Math.min(a.area, b.area)
}

function collidesWithAny(candidate, obstacles) {
  const box = aabb(candidate.posX, candidate.posY, candidate.width, candidate.height, candidate.rotation)
  return obstacles.some(obs => {
    const obsBox = aabb(obs.posX, obs.posY, obs.width, obs.height, obs.rotation)
    return overlapFraction(box, obsBox) > MAX_OVERLAP_FRACTION
  })
}

// Pure formula placement with no collision awareness — the fallback used when
// `placeWithAvoidance` can't find a clear spot within its search budget.
function formulaPosition(id, rank) {
  const h = seededHash(id)
  const angle = ((h % 10000) / 10000) * Math.PI * 2
  const radius = rank * RADIUS_STEP
  const jitterX = ((h >> 12) % (JITTER * 2 + 1)) - JITTER
  const jitterY = ((h >> 16) % (JITTER * 2 + 1)) - JITTER
  const { width, height } = cardDimensions(id)
  const rotation = ((h >> 8) % (MAX_ROTATION_DEG * 2 + 1)) - MAX_ROTATION_DEG
  return {
    posX: CANVAS_CENTER_X + radius * Math.cos(angle) - width / 2 + jitterX,
    posY: CANVAS_CENTER_Y + radius * Math.sin(angle) - height / 2 + jitterY,
    rotation,
    width,
    height,
  }
}

// Tries up to 5 radius rings x ANGLE_TRIES angular steps outward from `rank`'s base
// radius, returning the first candidate spot that doesn't collide with `obstacles`.
// Falls back to the uncontested formula position if nothing clears within budget.
function placeWithAvoidance(id, rank, obstacles) {
  const h = seededHash(id)
  const baseAngle = ((h % 10000) / 10000) * Math.PI * 2
  const { width, height } = cardDimensions(id)
  const rotation = ((h >> 8) % (MAX_ROTATION_DEG * 2 + 1)) - MAX_ROTATION_DEG
  const jitterX = ((h >> 12) % (JITTER * 2 + 1)) - JITTER
  const jitterY = ((h >> 16) % (JITTER * 2 + 1)) - JITTER

  for (let extra = 0; extra < 5; extra++) {
    const radius = Math.max(rank + extra, 1) * RADIUS_STEP
    for (let step = 0; step < ANGLE_TRIES; step++) {
      const angle = baseAngle + (step * Math.PI * 2) / ANGLE_TRIES
      const candidate = {
        posX: CANVAS_CENTER_X + radius * Math.cos(angle) - width / 2 + (step === 0 ? jitterX : 0),
        posY: CANVAS_CENTER_Y + radius * Math.sin(angle) - height / 2 + (step === 0 ? jitterY : 0),
        rotation,
        width,
        height,
      }
      if (!collidesWithAny(candidate, obstacles)) return candidate
    }
  }

  return formulaPosition(id, rank)
}

// A post is "pinned" once a super admin has manually dragged it (setting posX/posY/
// rotation) — that placement holds until positionPinnedUntil expires (or forever if
// unset), after which it reverts to floating in the deterministic formula layout.
function isPinned(post) {
  return (
    post.posX != null &&
    post.posY != null &&
    post.rotation != null &&
    (!post.positionPinnedUntil || new Date(post.positionPinnedUntil) > new Date())
  )
}

/**
 * Computes a `{ post, position }` layout for every post on the board: pinned posts
 * keep their stored position and become obstacles; unpinned posts are placed
 * outward from the center in id order, avoiding both pinned posts and previously
 * placed unpinned posts.
 */
export function resolveAllPositions(posts) {
  const obstacles = []
  const result = []

  // Collect pinned positions first so formula cards avoid them
  for (const post of posts) {
    if (isPinned(post)) {
      const { width, height } = cardDimensions(post.id)
      obstacles.push({ posX: post.posX, posY: post.posY, rotation: post.rotation, width, height })
    }
  }

  let formulaRank = 0
  for (const post of posts) {
    const { width, height } = cardDimensions(post.id)
    if (isPinned(post)) {
      result.push({ post, position: { posX: post.posX, posY: post.posY, rotation: post.rotation, width, height } })
    } else {
      const position = placeWithAvoidance(post.id, formulaRank, obstacles)
      result.push({ post, position })
      obstacles.push(position)
      formulaRank++
    }
  }

  return result
}
