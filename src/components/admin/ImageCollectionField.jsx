import { useId, useState } from 'react';
import { upload } from '@vercel/blob/client';
import { FaImage, FaUpload } from 'react-icons/fa';
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
	return 'portrait';
}

export default function ImageCollectionField({ value, onChange, token, folder, entityLabel }) {
	const inputId = useId();
	const images = Array.isArray(value) ? normalizePrimary(value) : [];
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');
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
			const uploadedImages = [];

			for (const file of files) {
				const pathname = `${folder}/${Date.now()}-${sanitizeSegment(file.name)}`;
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

				uploadedImages.push({
					...uploadedImage,
					previewUrl: buildClientImageUrl(uploadedImage),
				});
			}

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

	return (
		<div className="admin-artists-page-image-field">
			<label
				htmlFor={inputId}
				className="admin-artists-page-ghost-btn admin-artists-page-upload-btn"
				title={uploading ? 'Uploading…' : 'Upload images'}
				aria-label={uploading ? 'Uploading…' : 'Upload images'}
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
