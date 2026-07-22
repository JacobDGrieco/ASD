/**
 * Reusable admin editor for structured profile/release links.
 */
import { FaPlus, FaTrash } from 'react-icons/fa';
import {
	PROFILE_LINK_PLATFORM_LABELS,
	PROFILE_LINK_PLATFORM_OPTIONS,
	PROFILE_LINK_TYPES,
	normalizeProfileLinks,
	sortProfileLinks,
} from '../../lib/profileLinks.js';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';

function createLinkRow() {
	const id = globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return {
		id,
		platform: 'spotify',
		type: 'professional',
		url: '',
	};
}

export default function AdminProfileLinksField({ value, onChange, showTypeField = true }) {
	const links = Array.isArray(value) ? value : [];
	const sortedLinks = sortProfileLinks(links);

	const updateLink = (id, patch) => {
		onChange(links.map((link) => (link.id === id ? { ...link, ...patch } : link)));
	};

	const addLink = () => {
		onChange([...links, createLinkRow()]);
	};

	const deleteLink = (id) => {
		onChange(links.filter((link) => link.id !== id));
	};

	const usedLinks = normalizeProfileLinks(links);

	return (
		<div className="admin-profile-links-field">
			<div className="admin-profile-links-list">
				{sortedLinks.map((link) => {
					const platformLabel = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
					return (
						<div key={link.id} className={`admin-profile-link-row ${showTypeField ? '' : 'admin-profile-link-row-no-type'}`.trim()}>
							<div className="admin-profile-link-icon" title={platformLabel} aria-hidden="true">
								<ProfileLinkIcon platform={link.platform} />
							</div>
							<select
								value={link.platform}
								onChange={(event) => updateLink(link.id, { platform: event.target.value })}
								className="admin-field-input admin-profile-link-platform"
								aria-label="Platform"
							>
								{PROFILE_LINK_PLATFORM_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>{option.label}</option>
								))}
							</select>
							{showTypeField && (
								<select
									value={link.type}
									onChange={(event) => updateLink(link.id, { type: event.target.value })}
									className="admin-field-input admin-profile-link-type"
									aria-label="Link type"
								>
									{PROFILE_LINK_TYPES.map((option) => (
										<option key={option.value} value={option.value}>{option.label}</option>
									))}
								</select>
							)}
							<input
								type="text"
								placeholder={link.platform === 'email' ? 'name@example.com' : 'https://'}
								value={link.url}
								onChange={(event) => updateLink(link.id, { url: event.target.value })}
								className="admin-field-input admin-profile-link-url"
								aria-label={`${platformLabel} link`}
							/>
							<button
								type="button"
								onClick={() => deleteLink(link.id)}
								className="admin-button-danger admin-button-icon"
								aria-label={`Delete ${platformLabel} link`}
								title="Delete link"
							>
								<FaTrash aria-hidden="true" />
							</button>
						</div>
					);
				})}
			</div>
			{links.length === 0 && (
				<p className="admin-profile-links-empty">No links yet.</p>
			)}
			<div className="admin-profile-links-actions">
				<button type="button" onClick={addLink} className="admin-button-secondary admin-profile-links-add">
					<FaPlus aria-hidden="true" />
					<span>Add link</span>
				</button>
				{usedLinks.length !== links.length && links.length > 0 && (
					<span className="admin-profile-links-note">Blank rows are ignored when saved.</span>
				)}
			</div>
		</div>
	);
}
