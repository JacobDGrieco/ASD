import { useEffect, useMemo, useState } from 'react';
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

function getImageSrc(image) {
	return image?.previewUrl || image?.url || '';
}

function getImageKey(image) {
	return image?.id ?? image?.pathname ?? image?.url ?? '';
}

function getRunwaySlidesFromCatalogueItem(item) {
	const looks = item?.looks?.length ? item.looks : (item?.linkedLook ? [item.linkedLook] : []);

	return looks.flatMap((look) => (
		(look.images ?? [])
			.map((image, index) => ({
				id: `${look.id}-${getImageKey(image) || index}`,
				look,
				image,
			}))
			.filter((slide) => getImageSrc(slide.image))
	));
}

export default function FashionHomePreview() {
	const { data: catalogueItems } = useApi('/api/fashion/catalogue');
	const [activeRunwayImageIndex, setActiveRunwayImageIndex] = useState(0);
	const [readyImageSrc, setReadyImageSrc] = useState('');
	const latestRunwayItem = catalogueItems?.[0] ?? null;
	const runwaySlides = useMemo(() => getRunwaySlidesFromCatalogueItem(latestRunwayItem), [latestRunwayItem]);
	const activeRunwaySlide = runwaySlides.length
		? runwaySlides[activeRunwayImageIndex % runwaySlides.length]
		: null;
	const featuredImage = activeRunwaySlide?.image ?? null;
	const imageSrc = getImageSrc(featuredImage);
	const usage = typeof featuredImage?.usage === 'string' ? featuredImage.usage : '';
	const presentation = usage === 'runway-cutout' ? 'model' : 'framed';
	const runwayReady = Boolean(activeRunwaySlide?.look && imageSrc && readyImageSrc === imageSrc);

	useEffect(() => {
		setActiveRunwayImageIndex(0);
	}, [latestRunwayItem?.id, runwaySlides.length]);

	useEffect(() => {
		if (runwaySlides.length < 2) return undefined;

		const interval = window.setInterval(() => {
			setActiveRunwayImageIndex((current) => (current + 1) % runwaySlides.length);
		}, 10000);

		return () => window.clearInterval(interval);
	}, [latestRunwayItem?.id, runwaySlides.length]);

	useEffect(() => {
		if (!imageSrc) {
			setReadyImageSrc('');
			return undefined;
		}

		let cancelled = false;
		setReadyImageSrc('');

		const image = new Image();
		image.onload = () => {
			if (!cancelled) setReadyImageSrc(imageSrc);
		};
		image.onerror = () => {
			if (!cancelled) setReadyImageSrc('');
		};
		image.src = imageSrc;

		if (image.complete && image.naturalWidth > 0) {
			setReadyImageSrc(imageSrc);
		}

		return () => {
			cancelled = true;
		};
	}, [imageSrc]);

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
						{runwayReady ? (
							<div className={`fashion-runway-feature fashion-runway-feature-${presentation} fashion-runway-reveal`}>
								<div className="fashion-runway-look-link">
									<img src={imageSrc} alt="" className="fashion-runway-look-image" />
								</div>
							</div>
						) : null}
					</section>
				</div>
			</div>
		</div>
	);
}
