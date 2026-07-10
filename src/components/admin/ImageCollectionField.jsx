import { useId, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { FaLink, FaUpload } from 'react-icons/fa';
import { buildClientImageUrl } from '../../lib/images.js';
import '../../styles/AdminArtistsPage.css';

function sanitizeSegment(value) {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function normalizePrimary(images) {
	if (!images.length) return [];
	const primaryIndex = images.findIndex((image) => image.isPrimary);
	return images.map((image, index) => ({
		...image,
		sortOrder: index,
		isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
	}));
}

function getDefaultUsage(folder) {
	if (folder === 'albums') return 'cover';
	if (folder === 'songs') return 'artwork';
	if (folder === 'fashion-collections') return 'cover';
	if (folder === 'fashion-looks') return 'lookbook';
	if (folder === 'fashion-pieces') return 'piece';
	return 'portrait';
}

function createClientImage(image, entityLabel, folder) {
	return {
		...image,
		usage: image?.usage || getDefaultUsage(folder),
		altText: image?.altText || entityLabel,
		isPrimary: Boolean(image?.isPrimary),
		previewUrl: buildClientImageUrl(image),
	};
}

export default function ImageCollectionField({ value, onChange, token, folder, entityLabel }) {
	const inputId = useId();
	const images = Array.isArray(value) ? normalizePrimary(value) : [];
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
	const [imageUrl, setImageUrl] = useState('');
	const [dragIndex, setDragIndex] = useState(null);
	const [dropIndex, setDropIndex] = useState(null);

	const setImages = (nextImages) => onChange(normalizePrimary(nextImages));

	const removeImage = (index) => setImages(images.filter((_, i) => i !== index));

	const handleDragStart = (index) => {
		setDragIndex(index);
		setDropIndex(null);
	};

	const handleDragOver = (event, index) => {
		event.preventDefault();
		if (dragIndex === null || dragIndex === index) return;
		setDropIndex(index);
	};

	const handleDrop = (index) => {
		if (dragIndex === null || dragIndex === index) {
			setDragIndex(null);
			setDropIndex(null);
			return;
		}
		const next = [...images];
		const [moved] = next.splice(dragIndex, 1);
		next.splice(index, 0, moved);
		setDragIndex(null);
		setDropIndex(null);
		setImages(next);
	};

	const handleDragEnd = () => {
		setDragIndex(null);
		setDropIndex(null);
	};

	const handleUpload = async (event) => {
		const files = Array.from(event.target.files ?? []);
		if (!files.length || !token) return;

		setUploading(true);
		setError('');

		try {
			const uploadedImages = await Promise.all(files.map(async (file, index) => {
				const pathname = `${folder}/${Date.now()}-${index}-${sanitizeSegment(file.name)}`;
				const blob = await upload(pathname, file, {
					access: 'public',
					handleUploadUrl: '/api/admin/uploads',
					clientPayload: JSON.stringify({ folder }),
					headers: { Authorization: `Bearer ${token}` },
				});

				const uploadedImage = {
					url: blob.url,
					pathname: blob.pathname ?? pathname,
					usage: getDefaultUsage(folder),
					altText: entityLabel,
					isPrimary: false,
				};

				return createClientImage(uploadedImage, entityLabel, folder);
			}));

			setImages([
				...images,
				...uploadedImages.map((image, index) => ({
					...image,
					isPrimary: images.length === 0 && index === 0,
				})),
			]);
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
		} finally {
			setUploading(false);
			event.target.value = '';
		}
	};

	const handleImportFromUrl = async () => {
		const trimmedUrl = imageUrl.trim();
		if (!trimmedUrl || !token) return;

		setUploading(true);
		setError('');

		try {
			const response = await fetch('/api/admin/uploads', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					type: 'image.import-from-url',
					folder,
					url: trimmedUrl,
					entityLabel,
				}),
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload.error || 'Image import failed');
			}

			if (!payload?.image) {
				throw new Error('Image import failed');
			}

			const nextImage = createClientImage(payload.image, entityLabel, folder);
			setImages([
				...images,
				{
					...nextImage,
					isPrimary: images.length === 0,
				},
			]);
			setImageUrl('');
		} catch (uploadError) {
			setError(uploadError instanceof Error ? uploadError.message : 'Image import failed');
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="admin-artists-page-image-field">
			<div className="admin-artists-page-upload-controls">
				<input
					type="url"
					value={imageUrl}
					onChange={(event) => setImageUrl(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'Enter') {
							event.preventDefault();
							void handleImportFromUrl();
						}
					}}
					placeholder="Paste image URL to download and store"
					className="admin-artists-page-input"
					disabled={uploading}
				/>
				<button
					type="button"
					onClick={() => void handleImportFromUrl()}
					className="admin-artists-page-ghost-btn admin-artists-page-upload-btn"
					disabled={uploading || !imageUrl.trim()}
					title="Import image from URL"
					aria-label="Import image from URL"
				>
					<FaLink aria-hidden="true" />
				</button>
				<label
					htmlFor={inputId}
					className="admin-artists-page-ghost-btn admin-artists-page-upload-btn"
				>
					<FaUpload aria-hidden="true" />
				</label>
				<input
					id={inputId}
					type="file"
					accept="image/*"
					multiple
					onChange={handleUpload}
					className="admin-artists-page-file-input"
					disabled={uploading}
				/>
			</div>

			{images.length > 0 ? (
				<div className="admin-artists-page-image-list">
					{images.map((image, index) => (
						<div
							key={image.id ?? image.pathname ?? image.url ?? index}
							className={[
								'admin-artists-page-image-card',
								dragIndex === index ? 'admin-artists-page-image-card-dragging' : '',
								dropIndex === index ? 'admin-artists-page-image-card-drop-target' : '',
							].filter(Boolean).join(' ')}
							draggable
							onDragStart={() => handleDragStart(index)}
							onDragOver={(e) => handleDragOver(e, index)}
							onDrop={() => handleDrop(index)}
							onDragEnd={handleDragEnd}
						>
							<img
								src={image.previewUrl || image.url}
								alt={image.altText || entityLabel || 'Uploaded image'}
								className="admin-artists-page-thumb"
							/>
							<button
								type="button"
								onClick={() => removeImage(index)}
								className="admin-artists-page-image-delete"
								title="Remove image"
								aria-label="Remove image"
							>
								✕
							</button>
						</div>
					))}
				</div>
			) : ""}

			{error ? <p className="admin-artists-page-upload-error">{error}</p> : null}
		</div>
	);
}
