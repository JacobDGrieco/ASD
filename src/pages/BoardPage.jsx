import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi.js';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { isAdminPreviewSession } from '../lib/publicPreview.js';
import { resolveAllPositions } from '../lib/boardPosition.js';
import BoardCanvas from '../components/board/BoardCanvas.jsx';
import BoardCard from '../components/board/BoardCard.jsx';
import BoardCardDetail from '../components/board/BoardCardDetail.jsx';
import '../styles/board-page.css';

const DRAG_HINT_KEY = 'board-drag-hint-seen';

function shouldShowDragHint() {
	if (typeof window === 'undefined') return false;
	return !window.localStorage.getItem(DRAG_HINT_KEY);
}

export default function BoardPage() {
	const { data: posts, loading } = useApi('/api/public?resource=boardPosts', { maxAge: 0 });
	const { session, token } = useAdminAuth();
	const canEditBoard = isAdminPreviewSession(session, token);
	const [editMode, setEditMode] = useState(false);
	const [selectedPost, setSelectedPost] = useState(null);
	const [showHint, setShowHint] = useState(shouldShowDragHint);
	const [localPosts, setLocalPosts] = useState(null);
	const [previousPosts, setPreviousPosts] = useState(posts);
	const [zOrder, setZOrder] = useState([]);
	const [contextMenu, setContextMenu] = useState(null);

	if (posts !== previousPosts) {
		setPreviousPosts(posts);
		setLocalPosts(null);
	}

	const displayPosts = posts !== previousPosts ? posts ?? [] : localPosts ?? posts ?? [];

	useEffect(() => {
		if (showHint) {
			setShowHint(true);
			const t = setTimeout(() => {
				setShowHint(false);
				window.localStorage.setItem(DRAG_HINT_KEY, '1');
			}, 5000);
			return () => clearTimeout(t);
		}
	}, [showHint]);

	useEffect(() => {
		if (!posts) return;
		setZOrder(prev => {
			const allIds = posts.map(p => p.id);
			const allIdSet = new Set(allIds);
			const previousIdSet = new Set(prev);
			const existing = prev.filter(id => allIdSet.has(id));
			const newIds = allIds.filter(id => !previousIdSet.has(id));
			return [...existing, ...newIds];
		});
	}, [posts]);

	const getZIndex = (postId) => {
		const i = zOrder.indexOf(postId);
		return i === -1 ? 1 : i + 1;
	};

	const bringToFront = (postId) =>
		setZOrder(prev => [...prev.filter(id => id !== postId), postId]);

	const bringForward = (postId) =>
		setZOrder(prev => {
			const i = prev.indexOf(postId);
			if (i >= prev.length - 1) return prev;
			const next = [...prev];
			next[i] = next[i + 1];
			next[i + 1] = postId;
			return next;
		});

	const sendBack = (postId) =>
		setZOrder(prev => {
			const i = prev.indexOf(postId);
			if (i <= 0) return prev;
			const next = [...prev];
			next[i] = next[i - 1];
			next[i - 1] = postId;
			return next;
		});

	const sendToBack = (postId) =>
		setZOrder(prev => [postId, ...prev.filter(id => id !== postId)]);

	const handleContextMenu = (postId, e) => {
		e.preventDefault();
		const x = Math.min(e.clientX, window.innerWidth - 172);
		const y = Math.min(e.clientY, window.innerHeight - 148);
		setContextMenu({ postId, x, y });
	};

	const positionedPosts = resolveAllPositions(displayPosts);

	const handlePositionChange = async (postId, { posX, posY, rotation }) => {
		const pinChoice = window.prompt(
			'Keep card pinned until date (YYYY-MM-DD), or leave blank for permanent:',
			''
		);
		const positionPinnedUntil = pinChoice?.trim() ? new Date(pinChoice.trim()).toISOString() : null;

		await fetch(`/api/admin/board?id=${postId}&action=position`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ posX, posY, rotation, positionPinnedUntil }),
		});

		setLocalPosts((prev) =>
			(prev ?? displayPosts).map((p) =>
				p.id === postId ? { ...p, posX, posY, rotation, positionPinnedUntil } : p
			)
		);
	};

	if (loading) return null;

	return (
		<>
			<BoardCanvas editMode={editMode}>
				{positionedPosts.map(({ post, position }) => (
					<BoardCard
						key={post.id}
						post={post}
						position={position}
						editMode={editMode}
						zIndex={getZIndex(post.id)}
						onFlip={setSelectedPost}
						onContextMenu={editMode ? (e) => handleContextMenu(post.id, e) : undefined}
						onPositionChange={({ posX, posY, rotation }) =>
							handlePositionChange(post.id, { posX, posY, rotation })
						}
					/>
				))}
			</BoardCanvas>

			<BoardCardDetail post={selectedPost} onClose={() => setSelectedPost(null)} />

			{showHint && !editMode && (
				<div className="board-drag-hint">Drag to explore the board</div>
			)}

			{editMode && (
				<div className="board-instructions">
					Drag cards to reposition&nbsp;&nbsp;·&nbsp;&nbsp;Right-click for layer order&nbsp;&nbsp;·&nbsp;&nbsp;Drag background to pan
				</div>
			)}

			{contextMenu && (
				<>
					<button
						type="button"
						className="board-context-overlay"
						onClick={() => setContextMenu(null)}
						aria-label="Close board context menu"
					/>
					<div className="board-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
						<button type="button" className="board-context-item" onClick={() => { bringToFront(contextMenu.postId); setContextMenu(null); }}>Bring to Front</button>
						<button type="button" className="board-context-item" onClick={() => { bringForward(contextMenu.postId); setContextMenu(null); }}>Bring Forward</button>
						<button type="button" className="board-context-item" onClick={() => { sendBack(contextMenu.postId); setContextMenu(null); }}>Send Back</button>
						<button type="button" className="board-context-item" onClick={() => { sendToBack(contextMenu.postId); setContextMenu(null); }}>Send to Back</button>
					</div>
				</>
			)}

			{canEditBoard && (
				<button
					type="button"
					className={`board-edit-fab board-edit-fab-stacked${editMode ? ' board-edit-fab-active' : ''}`}
					onClick={() => { setEditMode((v) => !v); setContextMenu(null); }}
				>
					{editMode ? 'Done Editing' : 'Edit Board'}
				</button>
			)}
		</>
	);
}
