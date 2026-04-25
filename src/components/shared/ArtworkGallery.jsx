import { useMemo, useState } from 'react';
import { Image } from 'primereact/image';
import { FaImages } from "react-icons/fa";
import '../../styles/ArtworkGallery.css';

export default function ArtworkGallery({ images, title, className = '', buttonLabel = 'View artworks', showLabel = false }) {
	const normalizedImages = useMemo(
		() => (Array.isArray(images) ? images.filter((image) => image?.previewUrl || image?.url) : []),
		[images]
	);
	const [open, setOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);

	if (normalizedImages.length <= 1) return null;

	const selectedImage = normalizedImages[selectedIndex] ?? normalizedImages[0];

	return (
		<>
			<button
				type="button"
				className={`artwork-gallery-trigger ${className}`.trim()}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setOpen(true);
				}}
				aria-label={buttonLabel}
				title={buttonLabel}
			>
				{showLabel && <span className="artwork-gallery-trigger-label"><FaImages /></span>}
			</button>

			{open && (
				<div
					className="artwork-gallery-overlay"
					onClick={() => setOpen(false)}
					role="dialog"
					aria-modal="true"
					aria-label={`${title} artworks`}
				>
					<div className="artwork-gallery-modal" onClick={(event) => event.stopPropagation()}>
						<div className="artwork-gallery-header">
							<h3 className="artwork-gallery-title">{title}</h3>
							<button
								type="button"
								className="artwork-gallery-close"
								onClick={() => setOpen(false)}
								aria-label="Close artwork gallery"
							>
								×
							</button>
						</div>

						<div className="artwork-gallery-body">
							<div className="artwork-gallery-main">
								<Image
									src={selectedImage.previewUrl || selectedImage.url}
									alt={selectedImage.altText || title}
									preview
									imageClassName="artwork-gallery-main-image"
								/>
							</div>

							<div className="artwork-gallery-thumbs">
								{normalizedImages.map((image, index) => (
									<button
										key={image.id ?? image.pathname ?? image.url ?? index}
										type="button"
										className={`artwork-gallery-thumb ${index === selectedIndex ? 'artwork-gallery-thumb-active' : ''}`}
										onClick={() => setSelectedIndex(index)}
										aria-label={`Select artwork ${index + 1}`}
									>
										<img src={image.previewUrl || image.url} alt={image.altText || `${title} artwork ${index + 1}`} />
									</button>
								))}
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
