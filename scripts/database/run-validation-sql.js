/**
 * Runs docs/database/validation.sql through Prisma for environments without psql.
 *
 * The script prints statement-level row counts and safe aggregate results only;
 * it avoids dumping full database rows to the terminal.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
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

function splitSqlStatements(sql) {
	return sql
		.split(/;\s*(?:\r?\n|$)/)
		.map((statement) => statement.trim())
		.filter(Boolean);
}

function serializeSafeValue(value) {
	if (typeof value === 'bigint') return Number(value);
	if (value instanceof Date) return value.toISOString();
	return value;
}

function summarizeRows(statementIndex, rows) {
	const safeSummary = {};
	if (rows.length === 1) {
		for (const [key, value] of Object.entries(rows[0])) {
			if (
				key.toLowerCase().includes('count')
				|| key.toLowerCase().includes('missing')
				|| key.toLowerCase().includes('needing')
				|| key.toLowerCase().includes('loose_look')
				|| key.toLowerCase().includes('legacy_')
			) {
				safeSummary[key] = serializeSafeValue(value);
			}
		}
	}

	const suffix = Object.keys(safeSummary).length
		? ` ${JSON.stringify(safeSummary)}`
		: '';
	console.log(`statement ${statementIndex}: ${rows.length} row(s)${suffix}`);
}

async function main() {
	await loadDotenvLocal();
	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL is required in the environment or .env.local.');
	}

	prisma = new PrismaClient();
	const sql = await readFile('docs/database/validation.sql', 'utf8');
	const statements = splitSqlStatements(sql);

	for (const [index, statement] of statements.entries()) {
		const rows = await prisma.$queryRawUnsafe(statement);
		summarizeRows(index + 1, rows);
	}
}

main()
	.catch((error) => {
		console.error(error.message);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma?.$disconnect();
	});
