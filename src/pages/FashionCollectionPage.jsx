/**
 * Public fashion collection detail route.
 *
 * Shows a collection or loose-look grouping with its ordered looks and credits.
 */
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TabPanel } from 'primereact/tabview';
import { useApi } from '../hooks/useApi.js';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import PageTabs from '../components/shared/PageTabs.jsx';
import LookCard from '../components/fashion/LookCard.jsx';
import { CreditsCarousel } from './FashionLookPage.jsx';
import { usePageTitle } from '../lib/pageTitle.js';
import '../styles/FashionPages.css';
import '../styles/SongHeader.css';
import '../styles/SongPage.css';
import '../styles/AlbumDetails.css';

export default function FashionCollectionPage() {
	const { slug } = useParams();
	const apiUrl = `/api/fashion/collections/${slug}`;
	const { data: collection, loading, error } = useApi(apiUrl);
	const titleParts = useMemo(() => {
		if (!collection) return null;
		const primaryCredit = collection.credits?.find((credit) => credit.creditName || credit.talent?.name);
		const primaryName = primaryCredit?.creditName || primaryCredit?.talent?.name;
		return [collection.title, primaryName];
	}, [collection]);
	usePageTitle(titleParts);

	if (!loading && (error || !collection)) {
		return <div className="page not-found"><h1>Collection not found</h1></div>;
	}
	if (!collection) return null;

	return (
		<div className="page aurora-page fashion-page">
			<AuroraBackground />
			<div className="aurora-page-content fashion-page-content fashion-collection-page-content">
				<CollectionHeader collection={collection} />
				<div className="song-page-body fashion-collection-tabs-body">
					<PageTabs className="fashion-collection-tabview" tabCount={3}>
						<TabPanel header="Looks">
							{collection.looks?.length ? (
								<div className="fashion-collection-looks-panel">
									<div className="fashion-talent-grid">
										{collection.looks.map((look) => (
											<LookCard key={look.id} look={look} />
										))}
									</div>
								</div>
							) : (
								<p className="fashion-page-empty">No looks in this collection yet.</p>
							)}
						</TabPanel>
						<TabPanel header="Credits">
							{collection.credits?.length ? (
								<div className="fashion-collection-credits-grid-wrap">
									<CreditsCarousel credits={collection.credits} />
								</div>
							) : (
								<p className="fashion-page-empty">No credits listed.</p>
							)}
						</TabPanel>
						<TabPanel header="About">
							<CollectionAboutDetails collection={collection} />
						</TabPanel>
					</PageTabs>
				</div>
			</div>
		</div>
	);
}

function CollectionAboutDetails({ collection }) {
	const lookCount = collection.looks?.length || 0;
	const infoRows = [
		{ label: 'Looks', value: lookCount ? `${lookCount} look${lookCount === 1 ? '' : 's'}` : null },
	].filter((row) => row.value);

	if (!collection.about && infoRows.length === 0) {
		return (
			<section className="album-details-section">
				<p className="album-details-empty">No description added yet.</p>
			</section>
		);
	}

	return (
		<section className="album-details-section">
			{collection.about && (
				<div className="album-details-copy">
					<h2 className="album-details-heading">About</h2>
					<p className="album-details-text">{collection.about}</p>
				</div>
			)}
			{infoRows.length > 0 && (
				<div className="album-details-meta">
					<h2 className="album-details-heading">Info</h2>
					<div className="album-details-list">
						{infoRows.map((row) => (
							<div key={row.label} className="album-details-row">
								<span className="album-details-label">{row.label}</span>
								<span className="album-details-value">{row.value}</span>
							</div>
						))}
					</div>
				</div>
			)}
		</section>
	);
}

function CollectionHeader({ collection }) {
	const coverImg = collection.coverImage;
	const meta = [collection.season, collection.location].filter(Boolean).join(' · ');

	return (
		<section className={`song-header-header song-header-album-header fashion-collection-header ${collection.isVisible === false ? 'song-header-hidden' : ''}`.trim()}>
			<div className="song-header-media-column fashion-collection-media-column">
				<div className="song-header-art-wrap fashion-collection-cover-wrap">
					{coverImg ? (
						<img
							src={coverImg.previewUrl || coverImg.url}
							alt={collection.title}
							className="song-header-art fashion-collection-cover"
						/>
					) : (
						<div className="song-header-art-blank fashion-collection-cover-blank" />
					)}
				</div>
			</div>
			<div className="song-header-info fashion-collection-info">
				{collection.isVisible === false && <span className="song-header-visibility-badge">Hidden in public view</span>}
				<h1 className="fashion-collection-title">{collection.title}</h1>
				{meta && <p className="song-header-meta fashion-collection-meta">{meta}</p>}
				{collection.description && (
					<p className="fashion-collection-description">{collection.description}</p>
				)}
			</div>
		</section>
	);
}
