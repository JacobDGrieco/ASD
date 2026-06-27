import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi.js';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import LookCard from '../components/fashion/LookCard.jsx';
import TalentCard from '../components/fashion/TalentCard.jsx';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import runwayBackdrop from '../assets/fashion-runway-backdrop.png';
import '../styles/FashionPages.css';

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

function buildLookPayloadWithImageUsage(look, imageKey, usage) {
	return {
		...look,
		images: (look.images ?? []).map((image) => (
			getImageKey(image) === imageKey ? { ...image, usage } : image
		)),
	};
}

function getRecentTimestamp(item) {
	const timestamp = Date.parse(item?.createdAt ?? item?.updatedAt ?? '');
	return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getRecentItems(items, limit = 8) {
	return (items ?? [])
		.slice()
		.sort((left, right) => getRecentTimestamp(right) - getRecentTimestamp(left))
		.slice(0, limit);
}

function FashionHomeSection({ eyebrow, title, description, to, linkLabel, children }) {
	const sectionId = `fashion-home-${eyebrow.toLowerCase().replace(/\s+/g, '-')}`;

	return (
		<section className="fashion-home-showcase" aria-labelledby={sectionId}>
			<div className="fashion-home-showcase-copy">
				<p className="fashion-home-showcase-eyebrow">{eyebrow}</p>
				<h2 id={sectionId} className="fashion-home-showcase-title">{title}</h2>
				<p className="fashion-home-showcase-description">{description}</p>
				<Link to={to} className="fashion-home-hero-link fashion-home-hero-link-ghost fashion-home-showcase-link">
					{linkLabel}
				</Link>
			</div>
			<div className="fashion-home-showcase-grid">
				{children}
			</div>
		</section>
	);
}

function FashionHomeCardPlaceholders() {
	return Array.from({ length: 8 }, (_, index) => (
		<div key={index} className="fashion-home-card-placeholder" />
	));
}

function FashionRunwayFeature({ featuredLook, featuredImage, canSwapPresentation, onSwapPresentation, saving }) {
	const imageSrc = getImageSrc(featuredImage);
	const usage = typeof featuredImage?.usage === 'string' ? featuredImage.usage : '';
	const presentation = usage === 'runway-cutout' ? 'model' : 'framed';
	const nextPresentation = presentation === 'model' ? 'framed' : 'cutout';

	return (
		<div className={`fashion-runway-feature fashion-runway-feature-${presentation}`} aria-label={featuredLook ? `Featured look: ${featuredLook.title}` : 'Featured look'}>
			{featuredImage ? (
				<>
					{canSwapPresentation ? (
						<button
							type="button"
							className="fashion-runway-swap-btn"
							onClick={onSwapPresentation}
							disabled={saving}
							aria-label={`Switch runway image to ${nextPresentation} mode`}
							title={`Switch to ${nextPresentation} mode`}
						>
							{saving ? 'Saving' : 'Swap'}
						</button>
					) : null}
					<Link to={`/fashion/looks/${featuredLook.slug}`} className="fashion-runway-look-link">
						<img src={imageSrc} alt={featuredLook.title} className="fashion-runway-look-image" />
					</Link>
				</>
			) : (
				<div className="fashion-runway-look-empty" />
			)}
		</div>
	);
}

export default function FashionHomePage() {
	const { session, token } = useAdminAuth();
	const { data: looks, loading: looksLoading } = useApi('/api/fashion/looks');
	const { data: talent, loading: talentLoading } = useApi('/api/fashion/talent');
	const [imageUsageOverrides, setImageUsageOverrides] = useState({});
	const [savingImageKey, setSavingImageKey] = useState(null);

	const featuredLook = looks?.[0] ?? null;
	const rawFeaturedImage = featuredLook?.images?.[0] ?? null;
	const featuredImageKey = getImageKey(rawFeaturedImage);
	const featuredImage = rawFeaturedImage
		? { ...rawFeaturedImage, usage: imageUsageOverrides[featuredImageKey] ?? rawFeaturedImage.usage }
		: null;
	const recentLooks = useMemo(() => getRecentItems(looks, 8), [looks]);
	const recentTalent = useMemo(() => getRecentItems(talent, 8), [talent]);
	const canSwapPresentation = Boolean(session?.role === 'SUPER_ADMIN' && token && featuredLook && featuredImage);

	const handleSwapPresentation = async () => {
		if (!canSwapPresentation || !featuredLook || !featuredImageKey) return;

		const previousUsage = featuredImage.usage || 'lookbook';
		const nextUsage = previousUsage === 'runway-cutout' ? 'lookbook' : 'runway-cutout';

		setImageUsageOverrides((current) => ({ ...current, [featuredImageKey]: nextUsage }));
		setSavingImageKey(featuredImageKey);

		try {
			const response = await fetch(`/api/admin/fashion/looks?id=${featuredLook.id}`, {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(buildLookPayloadWithImageUsage(featuredLook, featuredImageKey, nextUsage)),
			});

			if (!response.ok) throw new Error('Failed to save runway presentation.');
		} catch (error) {
			setImageUsageOverrides((current) => ({ ...current, [featuredImageKey]: previousUsage }));
			window.alert(error instanceof Error ? error.message : 'Failed to save runway presentation.');
		} finally {
			setSavingImageKey(null);
		}
	};

	return (
		<div className="page aurora-page fashion-page">
			<AuroraBackground />
			<div className="aurora-page-content fashion-page-content">
				<section className="fashion-home-runway" aria-labelledby="fashion-home-runway-title">
					<img src={runwayBackdrop} alt="" className="fashion-runway-backdrop" aria-hidden="true" />
					<div className="fashion-runway-vignette" aria-hidden="true" />
					<div className="fashion-runway-light-rig" aria-hidden="true">
						<span />
						<span />
						<span />
						<span />
						<span />
					</div>
					<div className="fashion-runway-spotlight fashion-runway-spotlight-left" aria-hidden="true" />
					<div className="fashion-runway-spotlight fashion-runway-spotlight-right" aria-hidden="true" />
					<div className="fashion-runway-stage-glow" aria-hidden="true" />
					<div className="fashion-runway-flashes" aria-hidden="true">
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

					<FashionRunwayFeature
						featuredLook={featuredLook}
						featuredImage={featuredImage}
						canSwapPresentation={canSwapPresentation}
						onSwapPresentation={() => void handleSwapPresentation()}
						saving={savingImageKey === featuredImageKey}
					/>

					<div className="fashion-home-hero-copy fashion-runway-copy">
						<h1 id="fashion-home-runway-title" className="fashion-home-hero-title">
							{featuredLook ? featuredLook.title : (looksLoading ? '' : '')}
						</h1>
						<p className="fashion-home-hero-description">
							{featuredLook?.description || ''}
						</p>
					</div>
				</section>

				{recentLooks.length > 0 || looksLoading ? (
					<FashionHomeSection
						eyebrow="Latest looks"
						title="Recent silhouettes from the ASD runway."
						description="The newest lookbook entries, pulled straight from the fashion archive as they are published."
						to="/fashion/catalogue"
						linkLabel="View all looks"
					>
						{recentLooks.length > 0
							? recentLooks.map((look) => <LookCard key={look.id} look={look} />)
							: <FashionHomeCardPlaceholders />}
					</FashionHomeSection>
				) : (
					<FashionHomeSection
						eyebrow="Latest looks"
						title="Recent silhouettes from the ASD runway."
						description="New looks will appear here once public catalogue data is available."
						to="/fashion/catalogue"
						linkLabel="View catalogue"
					>
						<div className="fashion-home-showcase-empty">Looks will appear here once they are published.</div>
					</FashionHomeSection>
				)}

				{recentTalent.length > 0 || talentLoading ? (
					<FashionHomeSection
						eyebrow="Latest talent"
						title="Faces and makers behind the newest work."
						description="Models, stylists, photographers, designers, and editors recently added to the fashion roster."
						to="/fashion/talent"
						linkLabel="View all talent"
					>
						{recentTalent.length > 0
							? recentTalent.map((person) => <TalentCard key={person.id} talent={person} />)
							: <FashionHomeCardPlaceholders />}
					</FashionHomeSection>
				) : (
					<FashionHomeSection
						eyebrow="Latest talent"
						title="Faces and makers behind the newest work."
						description="New talent will appear here once public roster data is available."
						to="/fashion/talent"
						linkLabel="View talent"
					>
						<div className="fashion-home-showcase-empty">Talent will appear here once profiles are published.</div>
					</FashionHomeSection>
				)}

				{!looksLoading && !talentLoading && !looks?.length && !talent?.length && (
					<p className="fashion-page-empty">Fashion content coming soon.</p>
				)}
			</div>
		</div>
	);
}
