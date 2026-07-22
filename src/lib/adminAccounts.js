/**
 * Password-uniqueness validation for admin accounts (`api/admin/accounts.js`).
 * Business rule: every account password must be unique across both artist and
 * fashion-talent admin accounts, and none may match the global `ADMIN_PASSWORD`
 * super-admin password — prevents an account holder from accidentally (or
 * deliberately) reusing another account's credential.
 */
import { prisma } from './prisma.js';
import { getAdminAccountSchemaCapabilities } from './adminAccountSchema.js';
import { verifyPassword } from './passwords.js';

/**
 * Checks a candidate password against the global admin password and every other
 * account's password hash, excluding the account currently being edited (if any).
 * @returns {string|null} A user-facing validation error, or null if the password is unique.
 */
export async function validateUniqueArtistPassword(password, currentArtistId = null, currentTalentId = null) {
	if (!password) return null;

	if (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD) {
		return 'Account passwords cannot match the global admin password.';
	}

	const capabilities = await getAdminAccountSchemaCapabilities(prisma);
	const [artistAccessList, talentAccessList] = await Promise.all([
		prisma.artistAdminAccess.findMany({
			where: currentArtistId
				? {
					artistId: {
						not: currentArtistId,
					},
				}
				: undefined,
			select: {
				passwordHash: true,
			},
		}),
		capabilities.hasFashionTalentAdminAccess
			? prisma.fashionTalentAdminAccess.findMany({
				where: currentTalentId
					? {
						talentId: {
							not: currentTalentId,
						},
					}
					: undefined,
				select: {
					passwordHash: true,
				},
			})
			: [],
	]);

	const duplicate = [...artistAccessList, ...talentAccessList].some((access) => verifyPassword(password, access.passwordHash));
	if (duplicate) return 'Each account password must be unique.';

	return null;
}

/** Object-argument convenience wrapper around `validateUniqueArtistPassword`. */
export async function validateUniqueAccountPassword(password, current = {}) {
	return validateUniqueArtistPassword(password, current.artistId ?? null, current.talentId ?? null);
}
