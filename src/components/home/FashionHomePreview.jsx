import { useApi } from '../../hooks/useApi.js';
import AuroraBackground from '../shared/AuroraBackground.jsx';
import '../../styles/FashionPages.css';
import '../../styles/HomePortal.css';

export default function FashionHomePreview() {
	const { data: looks } = useApi('/api/fashion/looks');
	const featuredLook = looks?.[0] ?? null;
	const featuredImage = featuredLook?.images?.[0] ?? null;

	return (
		<div className="portal-preview portal-preview-fashion" aria-hidden="true">
			<div className="portal-live-preview">
				<div className="portal-live-preview-inner">
					<div className="page aurora-page fashion-page">
						<AuroraBackground />
						<div className="aurora-page-content fashion-page-content portal-fashion-content">
							<section className="fashion-home-hero">
								<div className="fashion-home-hero-media">
									{featuredImage ? (
										<img
											src={featuredImage.previewUrl || featuredImage.url}
											alt=""
											className="fashion-home-hero-image"
											loading="eager"
											decoding="async"
										/>
									) : (
										<div className="fashion-home-hero-image-blank" />
									)}
								</div>
								<div className="fashion-home-hero-copy">
									<span className="fashion-home-hero-eyebrow">ASD Fashion</span>
									<h2 className="fashion-home-hero-title">
										{featuredLook ? featuredLook.title : 'New looks, new ideas.'}
									</h2>
								</div>
							</section>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
