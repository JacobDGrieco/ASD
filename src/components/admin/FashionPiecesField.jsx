import { FaArrowDown, FaArrowUp } from 'react-icons/fa';
import ImageCollectionField from './ImageCollectionField.jsx';
import CreditsField from './CreditsField.jsx';

function createClientKey() {
	return `piece-${crypto.randomUUID()}`;
}

function pieceKey(piece) {
	return piece.id
		?? piece.clientKey
		?? `${piece.name || 'piece'}:${piece.buyUrl || ''}:${piece.image?.pathname || piece.image?.url || ''}`;
}

// value: [{ id?, name, buyUrl, image, credits }]
export default function FashionPiecesField({ value, onChange, token, lookTitle, talentOptions = [], crewOptions = [] }) {
	const pieces = Array.isArray(value) ? value : [];

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

	return (
		<div className="admin-fashion-pieces-field">
			{pieces.map((piece, index) => (
				<div key={pieceKey(piece)} className="admin-fashion-piece-card">
					<div className="admin-fashion-piece-card-header">
						<span className="admin-fashion-piece-card-title">Piece {index + 1}</span>
						<div className="admin-fashion-piece-order-controls" aria-label={`Reorder piece ${index + 1}`}>
							<button
								type="button"
								onClick={() => movePiece(index, -1)}
								className="admin-artists-page-ghost-btn admin-artists-page-icon-btn admin-fashion-piece-order-btn"
								aria-label={`Move piece ${index + 1} up`}
								title="Move piece up"
								disabled={index === 0}
							>
								<FaArrowUp aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={() => movePiece(index, 1)}
								className="admin-artists-page-ghost-btn admin-artists-page-icon-btn admin-fashion-piece-order-btn"
								aria-label={`Move piece ${index + 1} down`}
								title="Move piece down"
								disabled={index === pieces.length - 1}
							>
								<FaArrowDown aria-hidden="true" />
							</button>
						</div>
						<button
							type="button"
							onClick={() => removePiece(index)}
							className="admin-artists-page-danger-btn admin-artists-page-icon-btn"
							aria-label={`Remove piece ${index + 1}`}
							title="Remove piece"
						>
							✕
						</button>
					</div>

					<div className="admin-fashion-piece-card-row">
						<div>
							<label className="admin-modal-label">Piece Name</label>
							<input
								type="text"
								placeholder="e.g. Oversized Wool Coat"
								value={piece.name ?? ''}
								onChange={(event) => updatePiece(index, { name: event.target.value })}
								className="admin-artists-page-input"
							/>
						</div>
						<div>
							<label className="admin-modal-label">Buy Link</label>
							<input
								type="url"
								placeholder="External link to purchase"
								value={piece.buyUrl ?? ''}
								onChange={(event) => updatePiece(index, { buyUrl: event.target.value })}
								className="admin-artists-page-input"
							/>
						</div>
					</div>

					<div>
						<label className="admin-modal-label">Image</label>
						<ImageCollectionField
							value={piece.image ? [piece.image] : []}
							onChange={(images) => updatePiece(index, { image: images[0] ?? null })}
							token={token}
							folder="fashion-pieces"
							entityLabel={piece.name || lookTitle || 'Piece image'}
						/>
					</div>

					<div>
						<label className="admin-modal-label admin-fashion-piece-card-credits-label">Credit overrides</label>
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
				className="admin-artists-page-primary-btn admin-full-width-icon-btn"
				aria-label="Add piece"
				title="Add piece"
			>
				<span aria-hidden="true">+</span>
			</button>
		</div>
	);
}
