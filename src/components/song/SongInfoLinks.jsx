import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import '../../styles/SongInfoLinks.css';
import { SONG_ROLES, ROLE_DISPLAY_LABELS } from '../../lib/songRoles.js';
import SongPersonCard from './SongPersonCard.jsx';

export default function SongInfoLinks({ song }) {
	const peopleListRef = useRef(null);
	const [personCardWidth, setPersonCardWidth] = useState(null);
	const meta = song.meta ?? {};
	const roleGroups = meta?.roleGroups ?? {};
	const roleRows = SONG_ROLES.reduce((rows, role) => {
		if (roleGroups[role]?.length) {
			rows.push({ label: ROLE_DISPLAY_LABELS[role], links: roleGroups[role] });
		}
		return rows;
	}, []);
	const releaseDate = meta.releaseDate
		? new Date(meta.releaseDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC',
		})
		: null;
	const basicRows = [
		{ label: 'Length', value: song.duration },
		{ label: 'BPM', value: meta.bpm },
		{ label: 'Key', value: meta.key },
		{ label: 'Release date', value: releaseDate },
		{ label: 'Genre', value: meta.genre },
	].filter((row) => row.value);
	const hasAboutInfo = Boolean(meta.aboutText);
	const hasBasicInfo = basicRows.length > 0 || meta.tags?.length > 0;
	const hasPeopleInfo = roleRows.length > 0;
	const peopleMeasureKey = useMemo(() => (
		roleRows
			.flatMap((row) => [row.label, ...row.links.map((link) => link.name ?? '')])
			.join('|')
	), [roleRows]);

	useLayoutEffect(() => {
		const list = peopleListRef.current;
		if (!list) return undefined;
		let isActive = true;

		const measureCards = () => {
			if (!isActive) return;
			const cards = Array.from(list.querySelectorAll('.song-person-card'));
			if (cards.length === 0) {
				setPersonCardWidth(null);
				return;
			}

			const toNumber = (value) => Number.parseFloat(value) || 0;
			const getCardContentWidth = (card) => {
				const styles = window.getComputedStyle(card);
				const image = card.querySelector('.song-person-card-image-wrap');
				const copy = card.querySelector('.song-person-card-copy');
				const imageWidth = image?.getBoundingClientRect().width ?? 0;
				const copyWidth = copy?.scrollWidth ?? 0;
				const hasGap = imageWidth > 0 && copyWidth > 0;
				const gap = hasGap ? toNumber(styles.columnGap || styles.gap) : 0;

				return (
					toNumber(styles.paddingLeft)
					+ toNumber(styles.paddingRight)
					+ toNumber(styles.borderLeftWidth)
					+ toNumber(styles.borderRightWidth)
					+ imageWidth
					+ gap
					+ copyWidth
				);
			};
			const nextWidth = Math.ceil(Math.max(...cards.map(getCardContentWidth)));

			if (nextWidth > 0) {
				list.style.setProperty('--song-info-person-card-width', `${nextWidth}px`);
				setPersonCardWidth(nextWidth);
			} else {
				list.style.removeProperty('--song-info-person-card-width');
				setPersonCardWidth(null);
			}
		};

		measureCards();
		document.fonts?.ready.then(measureCards);
		window.addEventListener('resize', measureCards);

		return () => {
			isActive = false;
			window.removeEventListener('resize', measureCards);
		};
	}, [peopleMeasureKey]);

	if (!hasAboutInfo && !hasBasicInfo && !hasPeopleInfo) return null;

	return (
		<section className="song-info-links-section">
			{hasAboutInfo && (
				<div className="song-info-links-block">
					<h2 className="song-info-links-heading">About</h2>
					<p className="song-info-links-about">{meta.aboutText}</p>
				</div>
			)}
			{hasBasicInfo && (
				<div className="song-info-links-block">
					<h2 className="song-info-links-heading">Song Details</h2>
					{basicRows.length > 0 && (
						<div className="song-info-links-list">
							{basicRows.map((row) => (
								<InfoRow key={row.label} label={row.label} value={row.value} />
							))}
						</div>
					)}
					{meta.tags?.length > 0 && <TagRow label="Tags" tags={meta.tags} />}
				</div>
			)}
			{hasPeopleInfo && (
				<div className="song-info-links-block">
					<h2 className="song-info-links-heading">People & Roles</h2>
					<div
						ref={peopleListRef}
						className="song-info-links-list song-info-links-list--people"
						style={personCardWidth ? { '--song-info-person-card-width': `${personCardWidth}px` } : undefined}
					>
						{roleRows.map((row) => (
							<InfoRow key={row.label} label={row.label} links={row.links} />
						))}
					</div>
				</div>
			)}
		</section>
	);
}

function InfoRow({ label, value, links }) {
	return (
		<div className={`song-info-links-row${links ? ' song-info-links-row--people' : ''}`}>
			<span className="song-info-links-label">{label}</span>
			<span className="song-info-links-value">
				{links
					? (
						<span className="song-info-links-person-grid">
							{links.map((item) => (
								<SongPersonCard key={`${label}-${item.slug || item.externalUrl || item.name}`} person={item} />
							))}
						</span>
					)
					: value}
			</span>
		</div>
	);
}

function TagRow({ label, tags }) {
	return (
		<div className="song-info-links-row song-info-links-row--tags">
			<span className="song-info-links-label">{label}</span>
			<div className="song-info-links-tags">
				{tags.map((tag) => (
					<span key={tag} className="song-info-links-tag">{tag}</span>
				))}
			</div>
		</div>
	);
}
