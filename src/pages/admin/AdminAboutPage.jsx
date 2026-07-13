import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/AdminAboutPage.css';

const emptyMemberForm = {
	id: '',
	name: '',
	role: '',
	bio: '',
	image: null,
	isVisible: true,
	sortOrder: 0,
};

function primaryImage(member) {
	return member?.image ?? (member?.imageUrl ? {
		url: member.imageUrl,
		previewUrl: member.imageUrl,
		altText: member.name,
		usage: 'portrait',
		isPrimary: true,
	} : null);
}

function formatDate(value) {
	if (!value) return '-';
	return new Date(value).toLocaleString();
}

function renderMemberImage(member) {
	const image = primaryImage(member);
	if (!image) return <span className="admin-artists-page-empty-value">-</span>;

	return (
		<div className="admin-artists-page-image-summary">
			<div className={`admin-artists-page-thumb-frame ${member.isVisible ? '' : 'admin-artists-page-thumb-frame-hidden'}`.trim()}>
				<img src={image.previewUrl || image.url} alt={member.name} className="admin-artists-page-thumb" />
			</div>
		</div>
	);
}

function validateMemberForm(form) {
	if (!form.name.trim()) return 'Name is required.';
	if (!form.role.trim()) return 'Role is required.';
	if (!form.bio.trim()) return 'Bio is required.';
	if (!primaryImage(form)?.url) return 'Image is required.';
	return null;
}

export default function AdminAboutPage() {
	const { token, session } = useAdminAuth();
	const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
	const [profile, setProfile] = useState({ id: 'main', bio: '' });
	const [bioDraft, setBioDraft] = useState('');
	const [members, setMembers] = useState([]);
	const [form, setForm] = useState(null);
	const [savingBio, setSavingBio] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		if (session?.role !== 'SUPER_ADMIN' || !token) return undefined;

		let ignore = false;
		setLoading(true);

		loadAdminResource({ cacheKey: 'admin-about', url: '/api/admin/about', token })
			.then((about) => {
				if (ignore) return;
				setProfile(about.profile ?? { id: 'main', bio: '' });
				setBioDraft(about.profile?.bio ?? '');
				setMembers(about.members ?? []);
			})
			.finally(() => {
				if (!ignore) setLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [session?.role, token]);

	if (session?.role !== 'SUPER_ADMIN') {
		return <Navigate to="/admin" replace />;
	}

	const primeAbout = (nextProfile, nextMembers) => {
		primeAdminResource('admin-about', token, {
			profile: nextProfile,
			members: nextMembers,
		});
	};

	const openCreate = () => {
		setForm({
			...emptyMemberForm,
			sortOrder: members.length,
		});
	};

	const openEdit = (member) => {
		setForm({
			...emptyMemberForm,
			...member,
			image: primaryImage(member),
			sortOrder: member.sortOrder ?? 0,
		});
	};

	const closeForm = () => setForm(null);

	const handleSaveBio = async () => {
		const bio = bioDraft.trim();
		if (!bio) {
			window.alert('Company bio is required.');
			return;
		}

		setSavingBio(true);
		try {
			const response = await fetch('/api/admin/about', {
				method: 'PUT',
				headers: { ...auth, 'Content-Type': 'application/json' },
				body: JSON.stringify({ bio }),
			});

			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				window.alert(payload.error ?? 'Failed to save company bio.');
				return;
			}

			setProfile(payload);
			setBioDraft(payload.bio ?? '');
			primeAbout(payload, members);
		} finally {
			setSavingBio(false);
		}
	};

	const handleSaveMember = async () => {
		const validationError = validateMemberForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const response = await fetch(isEdit ? `/api/admin/about?id=${form.id}` : '/api/admin/about', {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: form.name,
				role: form.role,
				bio: form.bio,
				image: primaryImage(form),
				isVisible: form.isVisible,
				sortOrder: Number(form.sortOrder) || 0,
			}),
		});

		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			window.alert(payload.error ?? 'Failed to save member.');
			return;
		}

		const nextMembers = (isEdit
			? members.map((member) => (member.id === payload.id ? payload : member))
			: [...members, payload])
			.slice()
			.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

		setMembers(nextMembers);
		primeAbout(profile, nextMembers);
		closeForm();
	};

	const handleDeleteMember = async (member) => {
		await fetch(`/api/admin/about?id=${member.id}`, {
			method: 'DELETE',
			headers: auth,
		});

		const nextMembers = members.filter((candidate) => candidate.id !== member.id);
		setMembers(nextMembers);
		primeAbout(profile, nextMembers);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Admin - About Us</h1>
					<button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Member</button>
				</div>
			</div>

			<section className="admin-about-profile-panel" aria-labelledby="admin-about-company-bio-title">
				<div className="admin-about-profile-heading">
					<div>
						<h2 id="admin-about-company-bio-title">Company Bio</h2>
						<p>Required public bio used on the About Us page.</p>
					</div>
					<span className="admin-about-profile-updated">Updated {formatDate(profile.updatedAt)}</span>
				</div>
				<label htmlFor="admin-about-company-bio" className="admin-modal-label">
					Company bio <span className="admin-modal-label-required">*</span>
				</label>
				<textarea
					id="admin-about-company-bio"
					value={bioDraft}
					onChange={(event) => setBioDraft(event.target.value)}
					className="admin-artists-page-input admin-modal-textarea admin-about-bio-input"
					rows={4}
					required
				/>
				<div className="admin-about-profile-actions">
					<button type="button" onClick={() => setBioDraft(profile.bio ?? '')} className="admin-artists-page-ghost-btn">
						Reset
					</button>
					<button type="button" onClick={() => void handleSaveBio()} className="admin-artists-page-primary-btn" disabled={savingBio}>
						{savingBio ? 'Saving...' : 'Save Bio'}
					</button>
				</div>
			</section>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table">
					<thead>
						<tr>
							<th className="admin-artists-page-col-image">Image</th>
							<th className="admin-artists-page-col-lg">Name</th>
							<th className="admin-artists-page-col-lg">Role</th>
							<th className="admin-about-bio-col">Bio</th>
							<th className="admin-artists-page-col-sm">Visible</th>
							<th className="admin-artists-page-col-sm">Order</th>
							<th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
						</tr>
					</thead>
					<tbody>
						{members.map((member) => (
							<tr key={member.id} className={member.isVisible ? '' : 'admin-artists-page-hidden-row'}>
								<td className="admin-artists-page-col-image">{renderMemberImage(member)}</td>
								<td className="admin-artists-page-col-lg">
									<span className="admin-artists-page-cell-value" title={member.name}>{member.name}</span>
								</td>
								<td className="admin-artists-page-col-lg">
									<span className="admin-artists-page-cell-value" title={member.role}>{member.role}</span>
								</td>
								<td className="admin-about-bio-col">
									<span className="admin-artists-page-wrap-value" title={member.bio}>{member.bio}</span>
								</td>
								<td className="admin-artists-page-col-sm admin-artists-page-center-cell">
									<span className="admin-about-visibility-icon" title={member.isVisible ? 'Visible' : 'Hidden'}>
										{member.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
									</span>
								</td>
								<td className="admin-artists-page-col-sm">
									<span className="admin-artists-page-cell-value">{member.sortOrder ?? 0}</span>
								</td>
								<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
									<div className="admin-artists-page-actions">
										<button
											type="button"
											onClick={() => openEdit(member)}
											className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
											aria-label={`Edit ${member.name}`}
											title="Edit"
										>
											<FaPencilAlt aria-hidden="true" />
										</button>
										<ConfirmActionButton
											message={`Delete ${member.name}?`}
											onConfirm={() => handleDeleteMember(member)}
											buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
											buttonAriaLabel={`Delete ${member.name}`}
											buttonTitle="Delete"
										>
											<FaTrash aria-hidden="true" />
										</ConfirmActionButton>
									</div>
								</td>
							</tr>
						))}
						{!loading && members.length === 0 ? (
							<tr>
								<td colSpan={7}>
									<span className="admin-about-empty">No company members yet. Add the first person with New Member.</span>
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</div>

			{form ? (
				<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
					<div className="admin-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{form.id ? 'Edit Member' : 'New Member'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">&times;</button>
						</div>
						<div className="admin-modal-body">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-artists-page-name-field">
										<button
											type="button"
											onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
											className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Member is visible to the public. Click to hide.' : 'Member is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artists-page-name-field-main">
											<label htmlFor="admin-about-member-name" className="admin-modal-label">Name <span className="admin-modal-label-required">*</span></label>
											<input
												id="admin-about-member-name"
												type="text"
												value={form.name}
												onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
												className="admin-artists-page-input"
												placeholder="Full name"
											/>
										</div>
									</div>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Image <span className="admin-modal-label-required">*</span></div>
									<ImageCollectionField
										value={primaryImage(form) ? [primaryImage(form)] : []}
										onChange={(images) => {
											const nextImage = images[0] ?? null;
											setForm((current) => ({
												...current,
												image: nextImage,
												imageUrl: nextImage?.url ?? '',
												imagePathname: nextImage?.pathname ?? null,
											}));
										}}
										token={token}
										folder="about-members"
										entityLabel={form.name || 'Company member'}
									/>
								</div>
								<div className="admin-modal-field">
									<label htmlFor="admin-about-member-role" className="admin-modal-label">Role <span className="admin-modal-label-required">*</span></label>
									<input
										id="admin-about-member-role"
										type="text"
										value={form.role}
										onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
										className="admin-artists-page-input"
										placeholder="Founder / Creative Director"
									/>
								</div>
								<div className="admin-modal-field">
									<label htmlFor="admin-about-member-order" className="admin-modal-label">Order</label>
									<input
										id="admin-about-member-order"
										type="number"
										value={form.sortOrder}
										onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
										className="admin-artists-page-input"
										min="0"
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-about-member-bio" className="admin-modal-label">Bio <span className="admin-modal-label-required">*</span></label>
									<textarea
										id="admin-about-member-bio"
										value={form.bio}
										onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
										className="admin-artists-page-input admin-modal-textarea"
										rows={5}
										placeholder="Short public bio"
									/>
								</div>
							</div>
						</div>
						<div className="admin-modal-footer">
							<button type="button" onClick={closeForm} className="admin-artists-page-ghost-btn">Cancel</button>
							<button type="button" onClick={() => void handleSaveMember()} className="admin-artists-page-primary-btn">Save</button>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
