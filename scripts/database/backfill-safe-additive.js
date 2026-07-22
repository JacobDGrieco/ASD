/**
 * Disposable-database backfill for the safe additive Prisma migration.
 *
 * The script fills normalized contributor names and nullable Song timestamps
 * after `20260722094500_safe_additive_indexes_and_metadata` has been applied.
 * It is dry-run by default and requires explicit disposable-database flags
 * before issuing writes.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has('--execute');
const hasDisposableConfirmation = args.has('--confirm-disposable');
const hasApprovedConfirmation = args.has('--confirm-approved-db');
const allowsRemoteDisposable = args.has('--allow-remote-disposable')
	|| process.env.ALLOW_REMOTE_DISPOSABLE_DB === '1';
const allowsDisposableWrite = process.env.ALLOW_DISPOSABLE_DB_WRITE === '1';
const allowsApprovedWrite = process.env.ALLOW_APPROVED_DB_WRITE === '1';

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

function requireDisposableTarget() {
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required.');
	}

	if (process.env.VERCEL_ENV === 'production') {
		throw new Error('Refusing to write while VERCEL_ENV=production.');
	}

	let parsedUrl;
	try {
		parsedUrl = new URL(process.env.DATABASE_URL);
	} catch {
		throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
	}

	const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
	const isLocal = localHosts.has(parsedUrl.hostname);

	if (!shouldExecute) return;

	const hasApprovedRemoteWrite = hasApprovedConfirmation && allowsApprovedWrite;
	const hasDisposableWrite = hasDisposableConfirmation && allowsDisposableWrite;

	if (!hasApprovedRemoteWrite && !hasDisposableWrite) {
		throw new Error(
			'Writes require either --confirm-disposable with ALLOW_DISPOSABLE_DB_WRITE=1 or --confirm-approved-db with ALLOW_APPROVED_DB_WRITE=1.',
		);
	}

	if (!isLocal && !allowsRemoteDisposable && !hasApprovedRemoteWrite) {
		throw new Error(
			'Remote disposable writes require --allow-remote-disposable or ALLOW_REMOTE_DISPOSABLE_DB=1.',
		);
	}
}

function bigintToNumber(value) {
	return typeof value === 'bigint' ? Number(value) : value;
}

async function countRows(label, sql) {
	const rows = await prisma.$queryRawUnsafe(sql);
	const count = bigintToNumber(rows[0]?.count ?? 0);
	console.log(`${label}: ${count}`);
	return count;
}

async function executeBackfill(label, sql) {
	if (!shouldExecute) {
		console.log(`${label}: skipped (dry-run)`);
		return 0;
	}

	const updated = await prisma.$executeRawUnsafe(sql);
	console.log(`${label}: updated ${updated}`);
	return updated;
}

const normalizedNameExpression = `lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'))`;

async function main() {
	await loadDotenvLocal();
	requireDisposableTarget();
	prisma = new PrismaClient();

	console.log(shouldExecute ? 'Mode: execute' : 'Mode: dry-run');

	await countRows(
		'MusicOutsideArtist rows needing normalizedName',
		`SELECT COUNT(*) AS count
		FROM "MusicOutsideArtist"
		WHERE btrim("name") <> ''
			AND "normalizedName" IS DISTINCT FROM ${normalizedNameExpression};`,
	);

	await executeBackfill(
		'MusicOutsideArtist normalizedName',
		`UPDATE "MusicOutsideArtist"
		SET "normalizedName" = ${normalizedNameExpression}
		WHERE btrim("name") <> ''
			AND "normalizedName" IS DISTINCT FROM ${normalizedNameExpression};`,
	);

	await countRows(
		'FashionCrew rows needing normalizedName',
		`SELECT COUNT(*) AS count
		FROM "FashionCrew"
		WHERE btrim("name") <> ''
			AND "normalizedName" IS DISTINCT FROM ${normalizedNameExpression};`,
	);

	await executeBackfill(
		'FashionCrew normalizedName',
		`UPDATE "FashionCrew"
		SET "normalizedName" = ${normalizedNameExpression}
		WHERE btrim("name") <> ''
			AND "normalizedName" IS DISTINCT FROM ${normalizedNameExpression};`,
	);

	await countRows(
		'Song rows needing timestamps',
		`SELECT COUNT(*) AS count
		FROM "Song"
		WHERE "createdAt" IS NULL
			OR "updatedAt" IS NULL;`,
	);

	await executeBackfill(
		'Song timestamps',
		`WITH song_dates AS (
			SELECT
				s.id,
				COALESCE(sm."releaseDate", MIN(a."releaseDate"), CURRENT_TIMESTAMP) AS inferred_at
			FROM "Song" AS s
			LEFT JOIN "SongMeta" AS sm ON sm."songId" = s.id
			LEFT JOIN "SongAlbum" AS sa ON sa."songId" = s.id
			LEFT JOIN "Album" AS a ON a.id = sa."albumId"
			GROUP BY s.id, sm."releaseDate"
		)
		UPDATE "Song" AS s
		SET
			"createdAt" = COALESCE(s."createdAt", song_dates.inferred_at),
			"updatedAt" = COALESCE(s."updatedAt", s."createdAt", song_dates.inferred_at)
		FROM song_dates
		WHERE s.id = song_dates.id
			AND (s."createdAt" IS NULL OR s."updatedAt" IS NULL);`,
	);

	await countRows(
		'Song rows still missing timestamps',
		`SELECT COUNT(*) AS count
		FROM "Song"
		WHERE "createdAt" IS NULL
			OR "updatedAt" IS NULL;`,
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
