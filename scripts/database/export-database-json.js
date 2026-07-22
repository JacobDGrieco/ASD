/**
 * Exports all public PostgreSQL tables to local JSON files before migrations.
 *
 * This is a fallback backup/copy mechanism for environments without `pg_dump`.
 * It loads `.env.local`, connects through Prisma, writes one JSON file per table,
 * and records row counts in a manifest without printing database contents.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

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

function quoteIdentifier(identifier) {
	return `"${String(identifier).replaceAll('"', '""')}"`;
}

function timestampStamp() {
	return new Date().toISOString().replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z');
}

async function exportTable(outputDir, tableName) {
	const quotedTable = quoteIdentifier(tableName);
	const rows = await prisma.$queryRawUnsafe(`SELECT row_to_json(t) AS row FROM ${quotedTable} AS t`);
	const data = rows.map((entry) => entry.row);
	const fileName = `${tableName}.json`;
	await writeFile(path.join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`);
	return { tableName, fileName, rowCount: data.length };
}

async function main() {
	await loadDotenvLocal();

	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required in the environment or .env.local.');
	}

	prisma = new PrismaClient();

	const outputDir = path.join('backups', 'database', `pre-safe-additive-${timestampStamp()}`);
	await mkdir(outputDir, { recursive: true });

	const tables = await prisma.$queryRaw`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_type = 'BASE TABLE'
		ORDER BY table_name;
	`;

	const manifest = {
		createdAt: new Date().toISOString(),
		purpose: 'Pre-migration JSON copy before safe additive Prisma migration.',
		tableCount: tables.length,
		tables: [],
	};

	for (const table of tables) {
		const entry = await exportTable(outputDir, table.table_name);
		manifest.tables.push(entry);
		console.log(`${entry.tableName}: ${entry.rowCount}`);
	}

	await writeFile(path.join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
	console.log(`Backup directory: ${outputDir}`);
}

main()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma?.$disconnect();
	});
