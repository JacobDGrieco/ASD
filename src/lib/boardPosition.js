export const CANVAS_WIDTH = 3000
export const CANVAS_HEIGHT = 2000
const CANVAS_CENTER_X = CANVAS_WIDTH / 2
const CANVAS_CENTER_Y = CANVAS_HEIGHT / 2
const RADIUS_STEP = 120
const MIN_CARD_WIDTH = 180
const MAX_CARD_WIDTH = 260
const MAX_ROTATION_DEG = 10

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

function formulaPosition(id, rank) {
  const h = seededHash(id)
  const angle = ((h % 10000) / 10000) * Math.PI * 2
  const radius = rank * RADIUS_STEP
  const { width, height } = cardDimensions(id)
  const rotation = ((h >> 8) % (MAX_ROTATION_DEG * 2 + 1)) - MAX_ROTATION_DEG
  return {
    posX: CANVAS_CENTER_X + radius * Math.cos(angle) - width / 2,
    posY: CANVAS_CENTER_Y + radius * Math.sin(angle) - height / 2,
    rotation,
    width,
    height,
  }
}

export function resolvePostPosition(post, rank) {
  const { width, height } = cardDimensions(post.id)
  const hasPin =
    post.posX != null &&
    post.posY != null &&
    post.rotation != null &&
    (!post.positionPinnedUntil || new Date(post.positionPinnedUntil) > new Date())

  if (hasPin) {
    return { posX: post.posX, posY: post.posY, rotation: post.rotation, width, height }
  }

  return formulaPosition(post.id, rank)
}
