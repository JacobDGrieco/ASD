import { useApi } from '../../hooks/useApi.js';
import runwayBackdrop from '../../assets/fashion-runway-backdrop.png';
import '../../styles/FashionPages.css';
import '../../styles/HomePortal.css';

const CAMERA_FLASHES = [
	{ id: 'left-back-1', x: '11%', y: '35%', delay: '-0.4s', duration: '4.7s', size: '7px' },
	{ id: 'left-back-2', x: '16%', y: '43%', delay: '-2.8s', duration: '5.9s', size: '5px' },
	{ id: 'left-mid-1', x: '22%', y: '48%', delay: '-1.6s', duration: '3.8s', size: '8px' },
	{ id: 'left-mid-2', x: '25%', y: '54%', delay: '-3.4s', duration: '5.1s', size: '6px' },
	{ id: 'left-front-1', x: '17%', y: '61%', delay: '-4.2s', duration: '4.3s', size: '7px' },
	{ id: 'left-front-2', x: '27%', y: '63%', delay: '-0.9s', duration: '6.4s', size: '5px' },
	{ id: 'left-aisle-1', x: '20%', y: '39%', delay: '-5.3s', duration: '6.8s', size: '6px' },
	{ id: 'left-aisle-2', x: '24%', y: '58%', delay: '-2.1s', duration: '4.9s', size: '7px' },
	{ id: 'right-back-1', x: '89%', y: '35%', delay: '-1.3s', duration: '5.4s', size: '7px' },
	{ id: 'right-back-2', x: '84%', y: '43%', delay: '-4.8s', duration: '6.1s', size: '5px' },
	{ id: 'right-mid-1', x: '78%', y: '48%', delay: '-0.7s', duration: '4.1s', size: '8px' },
	{ id: 'right-mid-2', x: '75%', y: '54%', delay: '-3.1s', duration: '5.6s', size: '6px' },
	{ id: 'right-front-1', x: '83%', y: '61%', delay: '-2.4s', duration: '4.6s', size: '7px' },
	{ id: 'right-front-2', x: '73%', y: '63%', delay: '-5.8s', duration: '6.6s', size: '5px' },
	{ id: 'right-aisle-1', x: '80%', y: '39%', delay: '-3.9s', duration: '6.9s', size: '6px' },
	{ id: 'right-aisle-2', x: '76%', y: '58%', delay: '-1.8s', duration: '5.2s', size: '7px' },
];

export default function FashionHomePreview() {
	const { data: looks } = useApi('/api/fashion/looks');
	const featuredLook = looks?.[0] ?? null;
	const featuredImage = featuredLook?.images?.[0] ?? null;
	const imageSrc = featuredImage?.previewUrl || featuredImage?.url || '';
	const usage = typeof featuredImage?.usage === 'string' ? featuredImage.usage : '';
	const presentation = usage === 'runway-cutout' ? 'model' : 'framed';

	return (
		<div className="portal-preview portal-preview-fashion" aria-hidden="true">
			<div className="portal-live-preview">
				<div className="portal-live-preview-inner">
					<section className="fashion-home-runway">
						<img src={runwayBackdrop} alt="" className="fashion-runway-backdrop" />
						<div className="fashion-runway-vignette" />
						<div className="fashion-runway-light-rig">
							<span />
							<span />
							<span />
							<span />
							<span />
						</div>
						<div className="fashion-runway-spotlight fashion-runway-spotlight-left" />
						<div className="fashion-runway-spotlight fashion-runway-spotlight-right" />
						<div className="fashion-runway-stage-glow" />
						<div className="fashion-runway-flashes">
							{CAMERA_FLASHES.map((flash) => (
								<span
									key={flash.id}
									className="fashion-runway-flash"
									style={{
										'--flash-x': flash.x,
										'--flash-y': flash.y,
										'--flash-delay': flash.delay,
										'--flash-duration': flash.duration,
										'--flash-size': flash.size,
									}}
								/>
							))}
						</div>
						<div className={`fashion-runway-feature fashion-runway-feature-${presentation}`}>
							{featuredImage ? (
								<div className="fashion-runway-look-link">
									<img src={imageSrc} alt="" className="fashion-runway-look-image" />
								</div>
							) : (
								<div className="fashion-runway-look-empty" />
							)}
						</div>
						<div className="fashion-home-hero-copy fashion-runway-copy">
							<h2 className="fashion-home-hero-title">
								{featuredLook ? featuredLook.title : 'New looks, new ideas.'}
							</h2>
							<p className="fashion-home-hero-description">
								{featuredLook?.description || 'A live catalogue of looks, talent, and the pieces shaping the next ASD Fashion story.'}
							</p>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
