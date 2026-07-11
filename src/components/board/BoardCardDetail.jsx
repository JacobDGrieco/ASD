import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion'
import DOMPurify from 'dompurify'
import { renderBoardBodyMarkdown } from '../../lib/boardMarkdown.js'
import '../../styles/board-card.css'

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
}

const detailVariants = {
  hidden: { rotateY: -90, scale: 0.6, opacity: 0 },
  visible: {
    rotateY: 0,
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 280, damping: 24 },
  },
  exit: {
    rotateY: 90,
    scale: 0.6,
    opacity: 0,
    transition: { duration: 0.2 },
  },
}

export default function BoardCardDetail({ post, onClose }) {
  const safeBody = post ? DOMPurify.sanitize(renderBoardBodyMarkdown(post.body)) : ''

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {post && (
          <m.div
            className="board-detail-backdrop"
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            role="presentation"
          >
            <m.div
              className="board-detail-card"
              variants={detailVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              style={{ perspective: 1200 }}
              onClick={(e) => e.stopPropagation()}
              role="presentation"
            >
              <button type="button" className="board-detail-close" onClick={onClose} aria-label="Close">x</button>
              {post.imageUrl && (
                <div className="board-detail-media">
                  <img src={post.imageUrl} alt={post.title} className="board-detail-image" />
                </div>
              )}
              <div className="board-detail-body">
                <div className="board-detail-artist">{post.artist?.name}</div>
                <h2 className="board-detail-title">{post.title}</h2>
                <p className="board-detail-headline">{post.headline}</p>
                {safeBody && (
                  <div
                    className="board-detail-content"
                    dangerouslySetInnerHTML={{ __html: safeBody }}
                  />
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
