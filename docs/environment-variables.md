# Environment Variables

This file lists variables detected from source code and `.env.local` variable names. Do not commit real values.

| Name | Required | Client-safe | Used by | Purpose / format |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Yes | No | `prisma/schema.prisma`, `src/lib/prisma.js` | PostgreSQL connection URL used by Prisma. |
| `DATABASE_URL_UNPOOLED` | Optional/Prisma datasource field | No | `prisma/schema.prisma` | Direct PostgreSQL URL for Prisma `directUrl`. |
| `JWT_SECRET` | Yes for admin auth | No | `src/lib/auth.js` | Secret used to sign admin JWT cookies. Use a long random value. |
| `ADMIN_PASSWORD` | Optional but needed for global admin login | No | `api/admin/login.js`, `src/lib/adminAccounts.js` | Global super-admin password checked before DB-backed accounts. |
| `BLOB_READ_WRITE_TOKEN` | Yes for Blob uploads/deletes | No | Vercel Blob SDK calls in `api/admin/uploads.js`, `src/lib/blobCleanup.js`, `api/blob.js` | Vercel Blob read/write token. |
| `VITE_API_PROXY_TARGET` | Optional local dev | Yes if exposed through Vite config only | `vite.config.js` | Target for Vite `/api` proxy. Defaults to `http://127.0.0.1:3000`. |
| `YOUTUBE_API_KEY` | Optional | No | `src/lib/youtubeChannelSync.js` | Public/API-key Crosshair sync mode. Needs channel id or handle. |
| `YOUTUBE_CHANNEL_ID` | Optional | No | `src/lib/youtubeChannelSync.js` | YouTube channel id for public or OAuth sync. |
| `YOUTUBE_CHANNEL_HANDLE` | Optional | No | `src/lib/youtubeChannelSync.js` | YouTube handle for API-key sync when channel id is not supplied. |
| `YOUTUBE_CLIENT_ID` | Optional | No | `src/lib/youtubeChannelSync.js` | OAuth client id for sync with refresh token. |
| `YOUTUBE_CLIENT_SECRET` | Optional | No | `src/lib/youtubeChannelSync.js` | OAuth client secret. |
| `YOUTUBE_REFRESH_TOKEN` | Optional | No | `src/lib/youtubeChannelSync.js` | OAuth refresh token used to fetch an access token for each sync. |
| `NODE_ENV` | Set by runtime | No | `src/lib/auth.js`, `src/lib/prisma.js` | Controls secure cookie flag and Prisma log level. |

The following variables were present in the local environment file names and appear to be provider/platform aliases rather than direct source-code reads in this checkout: `NEON_PROJECT_ID`, `PGDATABASE`, `PGHOST`, `PGHOST_UNPOOLED`, `PGPASSWORD`, `PGUSER`, `POSTGRES_DATABASE`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL`, `POSTGRES_URL_NO_SSL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, and `VERCEL_OIDC_TOKEN`.

## Example Placeholders

```env
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
DATABASE_URL_UNPOOLED="postgresql://user:password@host/database?sslmode=require"
JWT_SECRET="replace-with-a-long-random-secret"
ADMIN_PASSWORD="replace-with-a-strong-admin-password"
BLOB_READ_WRITE_TOKEN="vercel-blob-token"
YOUTUBE_API_KEY="optional-youtube-api-key"
YOUTUBE_CHANNEL_ID="optional-channel-id"
YOUTUBE_CHANNEL_HANDLE="optional-channel-handle"
YOUTUBE_CLIENT_ID="optional-oauth-client-id"
YOUTUBE_CLIENT_SECRET="optional-oauth-client-secret"
YOUTUBE_REFRESH_TOKEN="optional-refresh-token"
```

## Security Notes

- `JWT_SECRET`, database URLs, `ADMIN_PASSWORD`, Blob tokens, and YouTube OAuth credentials are server-only secrets.
- Vite only exposes variables prefixed with `VITE_` to browser code by convention. `VITE_API_PROXY_TARGET` is local-dev configuration, not a secret.
- `api/blob.js` serves private blobs only to valid admin sessions or anonymous callers requesting blob pathnames referenced by public, visible content.
