export const CANVAS_WIDTH = 3000
export const CANVAS_HEIGHT = 2000
const CANVAS_CENTER_X = CANVAS_WIDTH / 2
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2
const RADIUS_STEP = 300
const JITTER = 60
const MIN_CARD_WIDTH = 180
const MAX_CARD_WIDTH = 260
const MAX_ROTATION_DEG = 10
const MAX_OVERLAP_FRACTION = 0.10
const ANGLE_TRIES = 12

function seededHash(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function cardDimensions(id) {
  const h = seededHash(id)
  const width = MIN_CARD_WIDTH + (h % (MAX_CARD_WIDTH - MIN_CARD_WIDTH + 1))
  return { width, height: Math.round(width * 1.5) }
}

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

function isPinned(post) {
  return (
    post.posX != null &&
    post.posY != null &&
    post.rotation != null &&
    (!post.positionPinnedUntil || new Date(post.positionPinnedUntil) > new Date())
  )
}

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
