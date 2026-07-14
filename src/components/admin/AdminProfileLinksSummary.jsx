import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../../lib/profileLinks.js';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';

export default function AdminProfileLinksSummary({ links }) {
	const normalizedLinks = normalizeProfileLinks(links);
	if (!normalizedLinks.length) return <span className="admin-artists-page-empty-value">-</span>;

	const sortedLinks = [...normalizedLinks].sort((a, b) => {
		if (a.type === b.type) return 0;
		return a.type === 'professional' ? -1 : 1;
	});
	const firstPersonalIndex = sortedLinks.findIndex((link) => link.type === 'personal');

	return (
		<div className="admin-profile-links-summary">
			{sortedLinks.map((link, index) => {
				const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
				const startsPersonalGroup = index === firstPersonalIndex && firstPersonalIndex > 0;
				return (
					<a
						key={`${link.platform}-${link.type}-${link.url}-${index}`}
						href={hrefForProfileLink(link)}
						target={link.platform === 'email' ? undefined : '_blank'}
						rel={link.platform === 'email' ? undefined : 'noreferrer'}
						className={[
							'admin-profile-link-summary-item',
							`admin-profile-link-summary-item-${link.type}`,
							startsPersonalGroup ? 'admin-profile-link-summary-item-group-start' : '',
						].filter(Boolean).join(' ')}
						aria-label={`Open ${label} link`}
						title={`${label} (${link.type})`}
					>
						<ProfileLinkIcon platform={link.platform} aria-hidden="true" />
					</a>
				);
			})}
		</div>
	);
}
