/**
 * Applies the safe additive database changes when Prisma migration history is
 * unavailable locally.
 *
 * Use only after creating a verified backup/copy. The statements are idempotent:
 * they add nullable columns and indexes only if they are missing.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const args = new Set(process.argv.slice(2));
const backupDirArg = process.argv
	.slice(2)
	.find((arg) => arg.startsWith('--backup-dir='));

let prisma;

function unquoteDotenvValue(value) {
	const trimmed = value.trim();
	const quote = trimmed[0];
	if ((quote === '"' || quote === "'") && trimmed.endsWith(quote)) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
}

async function loadDotenvLocal() {
	if (!existsSync('.env.local')) return;

	const contents = await readFile('.env.local', 'utf8');
	for (const line of contents.split(/\r?\n/)) {
		const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
		if (!match || match[1].startsWith('#')) continue;
		if (process.env[match[1]] !== undefined) continue;
		process.env[match[1]] = unquoteDotenvValue(match[2]);
	}
}

function requireWriteApproval() {
	const backupDir = backupDirArg?.slice('--backup-dir='.length);
	if (!backupDir || !existsSync(backupDir)) {
		throw new Error('A valid --backup-dir=<path> is required before applying database changes.');
	}

	if (!args.has('--execute') || !args.has('--confirm-approved-db')) {
		throw new Error('Writes require --execute --confirm-approved-db.');
	}

	if (process.env.ALLOW_APPROVED_DB_WRITE !== '1') {
		throw new Error('Writes require ALLOW_APPROVED_DB_WRITE=1.');
	}
}

async function execute(statementName, sql) {
	await prisma.$executeRawUnsafe(sql);
	console.log(statementName);
}

async function main() {
	await loadDotenvLocal();

	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required in the environment or .env.local.');
	}

	requireWriteApproval();
	if (process.env.DATABASE_URL_UNPOOLED) {
		process.env.DATABASE_URL = process.env.DATABASE_URL_UNPOOLED;
	}
	prisma = new PrismaClient();

	await execute(
		'MusicOutsideArtist.normalizedName column ensured',
		'ALTER TABLE "MusicOutsideArtist" ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;',
	);
	await execute(
		'Song timestamp columns ensured',
		'ALTER TABLE "Song" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);',
	);
	await execute(
		'FashionCrew.normalizedName column ensured',
		'ALTER TABLE "FashionCrew" ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;',
	);
	await execute(
		'MusicOutsideArtist.normalizedName index ensured',
		'CREATE INDEX IF NOT EXISTS "MusicOutsideArtist_normalizedName_idx" ON "MusicOutsideArtist"("normalizedName");',
	);
	await execute(
		'Album artist/releaseDate index ensured',
		'CREATE INDEX IF NOT EXISTS "Album_artistId_releaseDate_idx" ON "Album"("artistId", "releaseDate");',
	);
	await execute(
		'SongMeta.releaseDate index ensured',
		'CREATE INDEX IF NOT EXISTS "SongMeta_releaseDate_idx" ON "SongMeta"("releaseDate");',
	);
	await execute(
		'SongMeta.roles GIN index ensured',
		'CREATE INDEX IF NOT EXISTS "SongMeta_roles_gin_idx" ON "SongMeta" USING GIN ("roles");',
	);
	await execute(
		'RecordPlayerTrack active/position index ensured',
		'CREATE INDEX IF NOT EXISTS "RecordPlayerTrack_active_position_idx" ON "RecordPlayerTrack"("active", "position");',
	);
	await execute(
		'BoardPost artist/archive/published index ensured',
		'CREATE INDEX IF NOT EXISTS "BoardPost_artistId_archivedAt_publishedAt_idx" ON "BoardPost"("artistId", "archivedAt", "publishedAt");',
	);
	await execute(
		'FashionCrew.normalizedName index ensured',
		'CREATE INDEX IF NOT EXISTS "FashionCrew_normalizedName_idx" ON "FashionCrew"("normalizedName");',
	);
}

main()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma?.$disconnect();
	});
