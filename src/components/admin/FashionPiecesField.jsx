import ImageCollectionField from './ImageCollectionField.jsx';
import CreditsField from './CreditsField.jsx';

// value: [{ id?, name, buyUrl, image, credits }]
export default function FashionPiecesField({ value, onChange, token, lookTitle }) {
	const pieces = Array.isArray(value) ? value : [];

	const addPiece = () => {
		onChange([...pieces, { name: '', buyUrl: '', image: null, credits: [] }]);
	};

	const updatePiece = (index, patch) => {
		onChange(pieces.map((piece, i) => (i === index ? { ...piece, ...patch } : piece)));
	};

	const removePiece = (index) => {
		onChange(pieces.filter((_, i) => i !== index));
	};

	return (
		<div className="admin-fashion-pieces-field">
			{pieces.map((piece, index) => (
				<div key={index} className="admin-fashion-piece-card">
					<div className="admin-fashion-piece-card-header">
						<span className="admin-fashion-piece-card-title">Piece {index + 1}</span>
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
