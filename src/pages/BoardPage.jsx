import { useState, useEffect } from 'react'
import { useApi } from '../hooks/useApi.js'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { resolvePostPosition } from '../lib/boardPosition.js'
import BoardCanvas from '../components/board/BoardCanvas.jsx'
import BoardCard from '../components/board/BoardCard.jsx'
import BoardCardDetail from '../components/board/BoardCardDetail.jsx'
import '../styles/board-page.css'

const DRAG_HINT_KEY = 'board-drag-hint-seen'

export default function BoardPage() {
  const { data: posts, loading } = useApi('/api/public?resource=boardPosts', { maxAge: 0 })
  const { session, token } = useAdminAuth()
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'
  const [editMode, setEditMode] = useState(false)
  const [selectedPost, setSelectedPost] = useState(null)
  const [showHint, setShowHint] = useState(false)
  const [localPosts, setLocalPosts] = useState(null)

  const displayPosts = localPosts ?? posts ?? []

  useEffect(() => {
    if (!localStorage.getItem(DRAG_HINT_KEY)) {
      setShowHint(true)
      const t = setTimeout(() => {
        setShowHint(false)
        localStorage.setItem(DRAG_HINT_KEY, '1')
      }, 5000)
      return () => clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    if (posts) setLocalPosts(null)
  }, [posts])

  const positionedPosts = displayPosts.map((post, i) => ({
    post,
    position: resolvePostPosition(post, i),
  }))

  const handlePositionChange = async (postId, { posX, posY, rotation }) => {
    const pinChoice = window.prompt(
      'Keep card pinned until date (YYYY-MM-DD), or leave blank for permanent:',
      ''
    )
    const positionPinnedUntil = pinChoice?.trim() ? new Date(pinChoice.trim()).toISOString() : null

    await fetch(`/api/admin/board?id=${postId}&action=position`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ posX, posY, rotation, positionPinnedUntil }),
    })

    setLocalPosts((prev) =>
      (prev ?? displayPosts).map((p) =>
        p.id === postId ? { ...p, posX, posY, rotation, positionPinnedUntil } : p
      )
    )
  }

  if (loading) return null

  return (
    <>
      <BoardCanvas editMode={editMode}>
        {positionedPosts.map(({ post, position }) => (
          <BoardCard
            key={post.id}
            post={post}
            position={position}
            editMode={editMode}
            onFlip={setSelectedPost}
            onPositionChange={({ posX, posY, rotation }) =>
              handlePositionChange(post.id, { posX, posY, rotation })
            }
          />
        ))}
      </BoardCanvas>

      <BoardCardDetail post={selectedPost} onClose={() => setSelectedPost(null)} />

      {showHint && (
        <div className="board-drag-hint">Drag to explore the board</div>
      )}

      {isSuperAdmin && (
        <button
          className={`board-edit-fab${editMode ? ' board-edit-fab-active' : ''}`}
          onClick={() => setEditMode((v) => !v)}
        >
          {editMode ? 'Done Editing' : 'Edit Board'}
        </button>
      )}
    </>
  )
}
