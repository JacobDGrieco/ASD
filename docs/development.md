# Development

## Install

```sh
npm install
npm run db:generate
```

`npm install` also runs Prisma generate through the `postinstall` script.

## Environment

Create `.env.local` from the variables in `docs/environment-variables.md`. At minimum, full-stack local development needs database, JWT, and Blob configuration for the CMS and upload paths.

## Running Locally

Use Vite-only development for browser-only work:

```sh
npm run dev
```

Use Vercel dev whenever the page calls `/api/*`:

```sh
npm run dev:vercel
```

For LAN/device testing:

```sh
npm run dev:vercel:host
```

## Validation Commands

```sh
npm run lint
npm run build
npm run check:api-entrypoints
```

No automated test script is present in this checkout. Add tests before relying on automated behavioral coverage.

## Prisma

Useful scripts:

```sh
npm run db:generate
npm run db:migrate
npm run db:push
```

`prisma/migrations/` is absent in this checkout. Confirm the intended production migration workflow before changing schema or running commands against shared databases.

The Prisma seed command is configured in `package.json` as:

```sh
npx prisma db seed
```

which runs `node prisma/seed.js`.

## Operational Scripts

`npm run check:api-entrypoints` imports every Vercel function from `scripts/vercel-api-entrypoints.js` so static tooling can see route modules that Vercel normally discovers from the filesystem.

`scripts/sync-single-release-fields.js` synchronizes links and roles between `SINGLE` albums and their songs. Run it with `--dry-run` first:

```sh
node scripts/sync-single-release-fields.js --dry-run
```

This script was mainly for a one-time migration. Treat it as a manual repair tool, and remove it if code search confirms no active workflow calls it.
