import { useMotionValue } from 'framer-motion'
import { motion } from 'framer-motion'
import '../../styles/board-card.css'

const PIN_COLORS = {
  default: ['#e06060', '#903030'],
  gold: ['#c8a96e', '#8a6a2e'],
  blue: ['#60a0e0', '#305080'],
  orange: ['#e0a060', '#905030'],
}

function PushPin({ color }) {
  const [light, dark] = color?.startsWith('#')
    ? [color, color]
    : PIN_COLORS[color] ?? PIN_COLORS.default
  return (
    <div className="board-card-pin">
      <div
        className="board-card-pin-head"
        style={{ background: `radial-gradient(circle at 35% 35%, ${light}, ${dark})` }}
      />
      <div className="board-card-pin-shaft" />
    </div>
  )
}

export default function BoardCard({ post, position, editMode, zIndex, onFlip, onContextMenu, onPositionChange }) {
  const dragX = useMotionValue(0)
  const dragY = useMotionValue(0)

  const handleDragEnd = () => {
    const newPosX = Math.round(position.posX + dragX.get())
    const newPosY = Math.round(position.posY + dragY.get())
    dragX.set(0)
    dragY.set(0)
    onPositionChange?.({ posX: newPosX, posY: newPosY, rotation: position.rotation })
  }

  return (
    <motion.div
      className={`board-card${editMode ? ' board-card-edit' : ''}`}
      style={{
        left: position.posX,
        top: position.posY,
        width: position.width,
        rotate: position.rotation,
        x: dragX,
        y: dragY,
        zIndex,
      }}
      drag={editMode}
      dragMomentum={false}
      dragElastic={0}
      onDragEnd={handleDragEnd}
      whileHover={!editMode ? { scale: 1.06, zIndex: 1000 } : {}}
      onClick={!editMode ? () => onFlip(post) : undefined}
      onContextMenu={onContextMenu}
    >
      <PushPin color={post.pinColor ?? 'default'} />
      <div className="board-card-inner">
        {post.imageUrl ? (
          <img src={post.imageUrl} alt={post.title} className="board-card-image" draggable={false} />
        ) : (
          <div
            className="board-card-placeholder"
            style={{ height: position.height - 0 }}
          >
            {post.title}
          </div>
        )}
      </div>
    </motion.div>
  )
}
