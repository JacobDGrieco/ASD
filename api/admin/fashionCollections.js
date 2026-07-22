/**
 * Admin CRUD for fashion collections (groupings of looks, e.g. a runway season).
 * Read access is shared with the Looks page (they need collections for the
 * placement picker); writes require `FASHION_COLLECTIONS` access. A TALENT session
 * only sees/edits collections it created (`fashionCollectionCreatorWhere`).
 *
 * Shares the same free-text-credit-auto-registration rule as `fashion.js` — see
 * `resolveTypedOutsideTalentCredits` there for the canonical explanation.
 *
 * Server-only (Vercel Function). Consumed by `AdminFashionCollectionsPage.jsx` and
 * read-only by `AdminFashionLooksPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js';
import { canAccessAdminPage, isSuperAdmin, isTalentAdmin, requireAdmin } from '../../src/lib/auth.js';
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js';
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js';
import { clientImages, normalizeImageInput, primaryImageReference } from '../../src/lib/images.js';
import { normalizedPersonName } from '../../src/lib/normalizedNames.js';
import { slugify } from '../../src/lib/slugify.js';

function selectCollectionList() {
	return {
		id: true,
		title: true,
		slug: true,
		type: true,
		description: true,
		season: true,
		releaseDate: true,
		location: true,
		coverImage: true,
		coverPathname: true,
		isVisible: true,
		order: true,
		creatorTalentId: true,
		_count: { select: { lookPlacements: true } },
	};
}

function withCollectionCover(collection) {
	const coverImage = collection.coverImage
		? clientImages([{
			id: `${collection.id}-cover`,
			url: collection.coverImage,
			pathname: collection.coverPathname,
			usage: 'cover',
			altText: collection.title,
			sortOrder: 0,
			isPrimary: true,
		}])[0]
		: null;
	return { ...collection, coverImage, lookCount: collection._count?.lookPlacements ?? 0 };
}

function creditsCreateManyData(credits) {
	return (Array.isArray(credits) ? credits : []).reduce((data, credit) => {
		if (!credit?.talentId && !credit?.crewId && !credit?.creditName?.trim()) return data;
		data.push({
			talentId: credit.talentId || null,
			crewId: credit.crewId || null,
			creditName: credit.creditName?.trim() ?? '',
			roleLabel: credit.roleLabel ?? '',
			sortOrder: data.length,
		});
		return data;
	}, []);
}

function normalizedCreditName(value) {
	return normalizedPersonName(value);
}

function collectUnlinkedCreditNames(credits, namesByKey) {
	for (const credit of Array.isArray(credits) ? credits : []) {
		if (credit?.talentId || credit?.crewId) continue;
		const name = normalizedCreditName(credit?.creditName);
		if (!name || namesByKey.has(name)) continue;
		namesByKey.set(name, {
			name: String(credit.creditName).trim().replace(/\s+/g, ' '),
			role: credit.roleLabel ?? '',
		});
	}
}

// See fashion.js's resolveTypedOutsideTalentCredits — same auto-registration rule,
// duplicated here rather than shared since the two endpoints' credit shapes
// (collection credits vs. look/piece credits) differ slightly.
async function resolveTypedOutsideTalentCredits(tx, credits) {
	const namesByKey = new Map();
	collectUnlinkedCreditNames(credits, namesByKey);

	if (!namesByKey.size) return credits;

	const [talent, crew] = await Promise.all([
		tx.fashionTalent.findMany({ select: { id: true, name: true } }),
		tx.fashionCrew.findMany({ select: { id: true, name: true } }),
	]);
	const talentByName = new Map(talent.map((person) => [normalizedCreditName(person.name), person.id]));
	const crewByName = new Map(crew.map((person) => [normalizedCreditName(person.name), person.id]));

	const newCrewEntries = [];
	for (const [nameKey, entry] of namesByKey) {
		if (talentByName.has(nameKey) || crewByName.has(nameKey)) continue;
		newCrewEntries.push({ nameKey, entry });
	}

	const createdCrew = await Promise.all(newCrewEntries.map(({ entry }) => (
		tx.fashionCrew.create({
			data: {
				name: entry.name,
				normalizedName: normalizedCreditName(entry.name),
				role: entry.role,
				externalUrl: '',
				imageUrl: '',
				pathname: null,
			},
			select: { id: true, name: true },
		})
	)));

	for (const created of createdCrew) {
		crewByName.set(normalizedCreditName(created.name), created.id);
	}

	return (Array.isArray(credits) ? credits : []).map((credit) => {
		if (credit?.talentId || credit?.crewId) return credit;
		const nameKey = normalizedCreditName(credit?.creditName);
		if (!nameKey) return credit;
		const talentId = talentByName.get(nameKey);
		if (talentId) return { ...credit, talentId, crewId: '' };
		const crewId = crewByName.get(nameKey);
		if (crewId) return { ...credit, talentId: '', crewId };
		return credit;
	});
}

function includeCollectionDetail() {
	return {
		_count: { select: { lookPlacements: true } },
		credits: {
			orderBy: { sortOrder: 'asc' },
			include: {
				talent: { select: { id: true, name: true, slug: true, role: true } },
				crew: { select: { id: true, name: true, role: true } },
			},
		},
	};
}

function normalizeCoverInput(coverInput) {
	if (coverInput === undefined) return null;
	const normalized = normalizeImageInput(coverInput ? [coverInput] : [], 'cover');
	const coverImage = primaryImageReference(normalized);
	const coverPathname = normalized[0]?.pathname ?? null;
	return { coverImage: coverImage || '', coverPathname: coverPathname || null };
}

function normalizeReleaseDateInput(value) {
	if (value === undefined) return undefined;
	if (!value) return null;
	return new Date(value);
}

function collectionOrderBy() {
	return [
		{ releaseDate: { sort: 'desc', nulls: 'last' } },
		{ order: 'asc' },
		{ createdAt: 'asc' },
	];
}

function fashionCollectionCreatorWhere(session) {
	if (isSuperAdmin(session)) return {};
	if (isTalentAdmin(session)) return { creatorTalentId: session.talentId };
	return { AND: [{ id: '__no_access__' }] };
}

function collectionUpdateData(body, cover) {
	const { title, slug, type, description, about, season, releaseDate, location, isVisible, order } = body;
	return {
		title,
		slug: slug !== undefined ? (slug || slugify(title)) : undefined,
		type: type !== undefined ? type : undefined,
		description: description !== undefined ? description ?? '' : undefined,
		about: about !== undefined ? about ?? '' : undefined,
		season: season !== undefined ? season ?? '' : undefined,
		releaseDate: normalizeReleaseDateInput(releaseDate),
		location: location !== undefined ? location ?? '' : undefined,
		isVisible,
		order,
		...(cover ? { coverImage: cover.coverImage, coverPathname: cover.coverPathname } : {}),
	};
}

export default async function handler(req, res) {
	const session = requireAdmin(req, res);
	if (!session) return;
	const canReadCollections = [
		ADMIN_PAGE_KEYS.FASHION_COLLECTIONS,
		ADMIN_PAGE_KEYS.FASHION_LOOKS,
	].some((pageKey) => canAccessAdminPage(session, pageKey));
	if (!canReadCollections) return res.status(403).json({ error: 'Forbidden' });

	const { id } = req.query;

	if (id) {
		const existing = await prisma.fashionCollection.findFirst({
			where: { id, ...fashionCollectionCreatorWhere(session) },
			select: { id: true, coverImage: true, coverPathname: true },
		});
		if (!existing) return res.status(404).json({ error: 'Collection not found' });

		if (req.method === 'GET') {
			const collection = await prisma.fashionCollection.findFirst({
				where: { id, ...fashionCollectionCreatorWhere(session) },
				include: includeCollectionDetail(),
			});
			return res.status(200).json(withCollectionCover(collection));
		}

		if (req.method === 'PUT') {
			if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_COLLECTIONS)) return res.status(403).json({ error: 'Forbidden' });
			const { credits, coverImage: coverInput } = req.body;
			const cover = normalizeCoverInput(coverInput);

			const collection = await prisma.$transaction(async (tx) => {
				const data = collectionUpdateData(req.body, cover);

				if (credits !== undefined) {
					const resolvedCredits = await resolveTypedOutsideTalentCredits(tx, credits);
					const creditData = creditsCreateManyData(resolvedCredits);
					await tx.fashionCollectionCredit.deleteMany({ where: { collectionId: id } });
					return tx.fashionCollection.update({
						where: { id },
						data: {
							...data,
							credits: creditData.length ? { createMany: { data: creditData } } : undefined,
						},
						include: includeCollectionDetail(),
					});
				}

				return tx.fashionCollection.update({
					where: { id },
					data,
					include: includeCollectionDetail(),
				});
			});

			if (cover !== null) {
				await deleteRemovedBlobPathnames(
					[existing.coverPathname, existing.coverImage],
					[cover.coverPathname, cover.coverImage],
				);
			}
			return res.status(200).json(withCollectionCover(collection));
		}

		if (req.method === 'DELETE') {
			if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_COLLECTIONS)) return res.status(403).json({ error: 'Forbidden' });
			const blobPathnames = collectBlobPathnames(existing.coverPathname, existing.coverImage);
			await prisma.fashionCollection.delete({ where: { id } });
			await deleteUnusedBlobPathnames(blobPathnames);
			return res.status(204).end();
		}

		return res.status(405).json({ error: 'Method not allowed' });
	}

	if (req.method === 'GET') {
		const collections = await prisma.fashionCollection.findMany({
			where: fashionCollectionCreatorWhere(session),
			orderBy: collectionOrderBy(),
			select: selectCollectionList(),
		});
		return res.status(200).json(collections.map(withCollectionCover));
	}

	if (req.method === 'POST') {
		if (!canAccessAdminPage(session, ADMIN_PAGE_KEYS.FASHION_COLLECTIONS)) return res.status(403).json({ error: 'Forbidden' });
		const { title, slug, type, description, about, season, releaseDate, location, isVisible, order, coverImage: coverInput, credits } = req.body;
		if (!title) return res.status(400).json({ error: 'Title is required.' });
		const cover = normalizeCoverInput(coverInput) ?? { coverImage: '', coverPathname: null };

		const collection = await prisma.$transaction(async (tx) => {
			const resolvedCredits = await resolveTypedOutsideTalentCredits(tx, credits);
			const creditData = creditsCreateManyData(resolvedCredits);

			return tx.fashionCollection.create({
				data: {
					title,
					slug: slug || slugify(title),
					type: type || 'COLLECTION',
					description: description ?? '',
					about: about ?? '',
					season: season ?? '',
					releaseDate: releaseDate ? new Date(releaseDate) : null,
					location: location ?? '',
					isVisible: isVisible ?? true,
					order: order ?? 0,
					creatorTalentId: isTalentAdmin(session) ? session.talentId : null,
					coverImage: cover.coverImage,
					coverPathname: cover.coverPathname,
					credits: creditData.length ? { createMany: { data: creditData } } : undefined,
				},
				select: selectCollectionList(),
			});
		});

		return res.status(201).json(withCollectionCover(collection));
	}

	return res.status(405).json({ error: 'Method not allowed' });
}
