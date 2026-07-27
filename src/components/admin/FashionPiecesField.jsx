/**
 * Admin editor for the ordered pieces that make up a fashion look.
 */
import { useState } from 'react';
import { FaGripVertical, FaTrash } from 'react-icons/fa';
import ImageCollectionField from './ImageCollectionField.jsx';
import CreditsField from './CreditsField.jsx';

const EMPTY_OPTIONS = [];

function createClientKey() {
	return `piece-${crypto.randomUUID()}`;
}

function pieceKey(piece) {
	return piece.id
		?? piece.clientKey
		?? `${piece.name || 'piece'}:${piece.buyUrl || ''}:${piece.image?.pathname || piece.image?.url || ''}`;
}

// value: [{ id?, name, buyUrl, image, credits }]
export default function FashionPiecesField({ value, onChange, token, lookTitle, talentOptions = EMPTY_OPTIONS, crewOptions = EMPTY_OPTIONS }) {
	const pieces = Array.isArray(value) ? value : [];
	const [draggedIndex, setDraggedIndex] = useState(null);

	const addPiece = () => {
		onChange([...pieces, { clientKey: createClientKey(), name: '', buyUrl: '', image: null, credits: [] }]);
	};

	const updatePiece = (index, patch) => {
		onChange(pieces.map((piece, i) => (i === index ? { ...piece, ...patch } : piece)));
	};

	const removePiece = (index) => {
		onChange(pieces.filter((_, i) => i !== index));
	};

	const movePiece = (index, direction) => {
		const nextIndex = index + direction;
		if (nextIndex < 0 || nextIndex >= pieces.length) return;

		const nextPieces = [...pieces];
		[nextPieces[index], nextPieces[nextIndex]] = [nextPieces[nextIndex], nextPieces[index]];
		onChange(nextPieces);
	};

	const reorderPiece = (fromIndex, toIndex) => {
		if (
			!Number.isInteger(fromIndex) ||
			!Number.isInteger(toIndex) ||
			fromIndex === toIndex ||
			fromIndex < 0 ||
			toIndex < 0 ||
			fromIndex >= pieces.length ||
			toIndex >= pieces.length
		) return;

		const nextPieces = [...pieces];
		const [movedPiece] = nextPieces.splice(fromIndex, 1);
		nextPieces.splice(toIndex, 0, movedPiece);
		onChange(nextPieces);
	};

	const startDrag = (event, index) => {
		setDraggedIndex(index);
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', String(index));
	};

	const dropPiece = (event, index) => {
		event.preventDefault();
		const dataTransferIndex = Number(event.dataTransfer.getData('text/plain'));
		const fromIndex = Number.isInteger(draggedIndex) ? draggedIndex : dataTransferIndex;
		reorderPiece(fromIndex, index);
		setDraggedIndex(null);
	};

	return (
		<div className="admin-fashion-pieces-field">
			{pieces.map((piece, index) => (
				<div
					key={pieceKey(piece)}
					className={`admin-fashion-piece-card ${draggedIndex === index ? 'admin-fashion-piece-card-dragging' : ''} ${draggedIndex !== null && draggedIndex !== index ? 'admin-fashion-piece-card-drop-target' : ''}`.trim()}
					onDragOver={(event) => {
						event.preventDefault();
						event.dataTransfer.dropEffect = 'move';
					}}
					onDrop={(event) => dropPiece(event, index)}
					onDragEnd={() => setDraggedIndex(null)}
				>
					<div className="admin-fashion-piece-card-header">
						<div className="admin-fashion-piece-card-title-row">
							<button
								type="button"
								className="admin-fashion-piece-drag-handle"
								draggable={pieces.length > 1}
								onDragStart={(event) => startDrag(event, index)}
								onKeyDown={(event) => {
									if (event.key === 'ArrowUp') {
										event.preventDefault();
										movePiece(index, -1);
									}
									if (event.key === 'ArrowDown') {
										event.preventDefault();
										movePiece(index, 1);
									}
								}}
								disabled={pieces.length <= 1}
								aria-label={`Drag to reorder piece ${index + 1}. Use arrow keys to move.`}
								title="Drag to reorder"
							>
								<FaGripVertical aria-hidden="true" />
							</button>
							<span className="admin-fashion-piece-card-title">Piece {index + 1}</span>
						</div>
						<button
							type="button"
							onClick={() => removePiece(index)}
							className="admin-button-danger admin-button-icon"
							aria-label={`Remove piece ${index + 1}`}
							title="Remove piece"
						>
							<FaTrash aria-hidden="true" />
						</button>
					</div>

					<div className="admin-fashion-piece-card-row">
						<div>
							<label htmlFor={`admin-fashion-piece-${piece.clientKey ?? index}-name`} className="admin-modal-label">Piece Name</label>
							<input
								id={`admin-fashion-piece-${piece.clientKey ?? index}-name`}
								type="text"
								placeholder="e.g. Oversized Wool Coat"
								value={piece.name ?? ''}
								onChange={(event) => updatePiece(index, { name: event.target.value })}
								className="admin-field-input"
							/>
						</div>
						<div>
							<label htmlFor={`admin-fashion-piece-${piece.clientKey ?? index}-buy-url`} className="admin-modal-label">Buy Link</label>
							<input
								id={`admin-fashion-piece-${piece.clientKey ?? index}-buy-url`}
								type="url"
								placeholder="External link to purchase"
								value={piece.buyUrl ?? ''}
								onChange={(event) => updatePiece(index, { buyUrl: event.target.value })}
								className="admin-field-input"
							/>
						</div>
					</div>

					<div>
						<div className="admin-modal-label">Image</div>
						<ImageCollectionField
							value={piece.image ? [piece.image] : []}
							onChange={(images) => updatePiece(index, { image: images[0] ?? null })}
							token={token}
							folder="fashion-pieces"
							entityLabel={piece.name || lookTitle || 'Piece image'}
						/>
					</div>

					<div>
						<div className="admin-modal-label admin-fashion-piece-card-credits-label">Credit overrides</div>
						<CreditsField
							value={piece.credits}
							onChange={(credits) => updatePiece(index, { credits })}
							talentOptions={talentOptions}
							crewOptions={crewOptions}
							placeholder="Add credit override"
						/>
					</div>
				</div>
			))}

			<button
				type="button"
				onClick={addPiece}
				className="admin-button-primary admin-full-width-icon-btn"
				aria-label="Add piece"
				title="Add piece"
			>
				<span aria-hidden="true">+</span>
			</button>
		</div>
	);
}
