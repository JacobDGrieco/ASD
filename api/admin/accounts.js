/**
 * Admin CRUD for login accounts (`ArtistAdminAccess`/`FashionTalentAdminAccess`) —
 * i.e. who besides the global `ADMIN_PASSWORD` super admin can log into the CMS,
 * and which pages/permissions each account has. SUPER_ADMIN only.
 *
 * GET returns one row per Artist/FashionTalent (whether or not it has an account
 * yet) so the accounts page can show "no account" rows alongside real ones. Every
 * write path re-validates password uniqueness across accounts and against the
 * global admin password (`validateUniqueAccountPassword`) and normalizes
 * `pageAccess` to a default set when the caller doesn't specify one.
 *
 * Server-only (Vercel Function). Consumed by `AdminAccountsPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js';
import { requireSuperAdmin } from '../../src/lib/auth.js';
import { hashPassword } from '../../src/lib/passwords.js';
import { validateUniqueAccountPassword } from '../../src/lib/adminAccounts.js';
import {
	ADMIN_ACCOUNT_TYPES,
	getDefaultAdminPageAccess,
	normalizeAdminPageAccess,
} from '../../src/lib/adminPageAccess.js';
import { isAsdRecordsArtist } from '../../src/lib/publicVisibility.js';

function formatSubject(subject) {
	return {
		id: subject.id,
		name: subject.name,
		slug: subject.slug,
	};
}

function formatAccount(account, accountType) {
	const subjectId = accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT ? account.talentId : account.artistId;

	return {
		id: account.id,
		accountType,
		subjectId,
		name: account.name ?? '',
		active: account.active,
		pageAccess: normalizeAdminPageAccess(account.pageAccess),
		createdAt: account.createdAt,
		updatedAt: account.updatedAt,
	};
}

// Selects the account fields used by the admin UI; the app now assumes the
// current account schema is present.
function artistAdminAccessSelect() {
	return {
		id: true,
		artistId: true,
		name: true,
		active: true,
		pageAccess: true,
		createdAt: true,
		updatedAt: true,
	};
}

function artistAdminAccessData(data) {
	return {
		artistId: data.artistId,
		name: data.name,
		passwordHash: data.passwordHash,
		active: data.active,
		pageAccess: data.pageAccess,
	};
}

function artistAdminAccessUpdateData(data) {
	return {
		name: data.name,
		passwordHash: data.passwordHash,
		active: data.active,
		pageAccess: data.pageAccess,
	};
}

// The reserved "A.S.D." label artist's account is really a super-admin login in
// disguise (see isAsdRecordsArtist / login.js) — flag it so the UI can label it
// "Admin" instead of "Music Artist" and sort it to the top.
function formatRow(subject, account, accountType) {
	const isSuperAdminAccount = accountType === ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST && isAsdRecordsArtist(subject);

	return {
		rowId: `${accountType}:${subject.id}`,
		accountType,
		isSuperAdminAccount,
		subject: formatSubject(subject),
		account: account ? { ...formatAccount(account, accountType), isSuperAdminAccount } : null,
		hasAccount: Boolean(account),
	};
}

function normalizedAccessForSave(value, accountType) {
	const access = normalizeAdminPageAccess(value);
	return access.length > 0 ? access : getDefaultAdminPageAccess(accountType);
}

async function findAccountById(id) {
	const artistAccess = await prisma.artistAdminAccess.findUnique({
		where: { id },
		select: {
			...artistAdminAccessSelect(),
			artist: {
				select: {
					id: true,
					name: true,
					slug: true,
				},
			},
		},
	});

	if (artistAccess) {
		return {
			account: artistAccess,
			accountType: ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST,
			subject: artistAccess.artist,
			currentPasswordScope: { artistId: artistAccess.artistId },
		};
	}

	const talentAccess = await prisma.fashionTalentAdminAccess.findUnique({
		where: { id },
		include: {
			talent: {
				select: {
					id: true,
					name: true,
					slug: true,
				},
			},
		},
	});

	if (talentAccess) {
		return {
			account: talentAccess,
			accountType: ADMIN_ACCOUNT_TYPES.FASHION_TALENT,
			subject: talentAccess.talent,
			currentPasswordScope: { talentId: talentAccess.talentId },
		};
	}

	return null;
}

export default async function handler(req, res) {
	const session = requireSuperAdmin(req, res);
	if (!session) return;

	const { id } = req.query;
	if (req.method === 'GET') {
		const [artists, talent] = await Promise.all([
			prisma.artist.findMany({
				orderBy: [{ order: 'asc' }, { name: 'asc' }],
				select: {
					id: true,
					name: true,
					slug: true,
					adminAccess: {
						select: artistAdminAccessSelect(),
					},
				},
			}),
			prisma.fashionTalent.findMany({
				orderBy: [{ order: 'asc' }, { name: 'asc' }],
				select: {
					id: true,
					name: true,
					slug: true,
					adminAccess: {
						select: {
							id: true,
							talentId: true,
							name: true,
							active: true,
							pageAccess: true,
							createdAt: true,
							updatedAt: true,
						},
					},
				}
			}),
		]);

		const rows = [
			...artists.map((artist) => formatRow(artist, artist.adminAccess, ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST)),
			...talent.map((person) => formatRow(person, person.adminAccess, ADMIN_ACCOUNT_TYPES.FASHION_TALENT)),
		];

		return res.status(200).json(rows.sort((left, right) => {
			if (left.isSuperAdminAccount !== right.isSuperAdminAccount) return left.isSuperAdminAccount ? -1 : 1;
			return left.subject.name.localeCompare(right.subject.name, undefined, { sensitivity: 'base', numeric: true });
		}));
	}

	if (req.method === 'POST') {
		const {
			accountType = ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST,
			subjectId,
			name = '',
			password,
			active,
			pageAccess,
		} = req.body ?? {};

		if (!Object.values(ADMIN_ACCOUNT_TYPES).includes(accountType)) {
			return res.status(400).json({ error: 'Account type is invalid.' });
		}
		if (!subjectId) return res.status(400).json({ error: 'Person is required.' });
		if (!password) return res.status(400).json({ error: 'Password is required.' });

		if (accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
			const existingAccount = await prisma.fashionTalentAdminAccess.findUnique({ where: { talentId: subjectId } });
			if (existingAccount) return res.status(400).json({ error: 'That fashion talent already has an account.' });

			const passwordError = await validateUniqueAccountPassword(password, { talentId: subjectId });
			if (passwordError) return res.status(400).json({ error: passwordError });

			const account = await prisma.fashionTalentAdminAccess.create({
				data: {
					talentId: subjectId,
					name,
					passwordHash: hashPassword(password),
					active: active ?? true,
					pageAccess: normalizedAccessForSave(pageAccess, accountType),
				},
				include: {
					talent: {
						select: {
							id: true,
							name: true,
							slug: true,
						},
					},
				},
			});

			return res.status(201).json({
				...formatAccount(account, accountType),
				subject: formatSubject(account.talent),
			});
		}

		const existingAccount = await prisma.artistAdminAccess.findUnique({ where: { artistId: subjectId }, select: { id: true } });
		if (existingAccount) return res.status(400).json({ error: 'That music artist already has an account.' });

		const passwordError = await validateUniqueAccountPassword(password, { artistId: subjectId });
		if (passwordError) return res.status(400).json({ error: passwordError });

		const account = await prisma.artistAdminAccess.create({
			data: artistAdminAccessData({
				artistId: subjectId,
				name,
				passwordHash: hashPassword(password),
				active: active ?? true,
				pageAccess: normalizedAccessForSave(pageAccess, accountType),
			}),
			select: {
				...artistAdminAccessSelect(),
				artist: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
		});

		return res.status(201).json({
			...formatAccount(account, accountType),
			isSuperAdminAccount: isAsdRecordsArtist(account.artist),
			subject: formatSubject(account.artist),
		});
	}

	if (!id) return res.status(400).json({ error: 'Account id is required.' });

	const existing = await findAccountById(id);
	if (!existing) return res.status(404).json({ error: 'Account not found.' });

	if (req.method === 'PUT') {
		const { name, password, active, pageAccess } = req.body ?? {};
		if (
			typeof name !== 'string' &&
			typeof active !== 'boolean' &&
			!password &&
			pageAccess === undefined
		) {
			return res.status(400).json({ error: 'Nothing to update.' });
		}

		const passwordError = password ? await validateUniqueAccountPassword(password, existing.currentPasswordScope) : null;
		if (passwordError) return res.status(400).json({ error: passwordError });

		const data = {
			name: typeof name === 'string' ? name : undefined,
			active: typeof active === 'boolean' ? active : undefined,
			passwordHash: password ? hashPassword(password) : undefined,
			pageAccess: pageAccess === undefined ? undefined : normalizedAccessForSave(pageAccess, existing.accountType),
		};

		if (existing.accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
			const account = await prisma.fashionTalentAdminAccess.update({
				where: { id },
				data,
				include: {
					talent: {
						select: {
							id: true,
							name: true,
							slug: true,
						},
					},
				},
			});

			return res.status(200).json({
				...formatAccount(account, existing.accountType),
				subject: formatSubject(account.talent),
			});
		}

		const account = await prisma.artistAdminAccess.update({
			where: { id },
			data: artistAdminAccessUpdateData(data),
			select: {
				...artistAdminAccessSelect(),
				artist: {
					select: {
						id: true,
						name: true,
						slug: true,
					},
				},
			},
		});

		return res.status(200).json({
			...formatAccount(account, existing.accountType),
			isSuperAdminAccount: isAsdRecordsArtist(account.artist),
			subject: formatSubject(account.artist),
		});
	}

	if (req.method === 'DELETE') {
		if (existing.accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT) {
			await prisma.fashionTalentAdminAccess.delete({ where: { id } });
		} else {
			await prisma.artistAdminAccess.delete({ where: { id } });
		}
		return res.status(204).end();
	}

	return res.status(405).json({ error: 'Method not allowed' });
}
