# A.S.D.

The site for A.S.D. — a music label/artist portal with a companion fashion vertical, backed by a shared admin CMS. React + Vite frontend, Vercel Functions in `api/`, Prisma-backed data access.

## Site Structure

The root (`/`) is a portal that expands into two sections, each with its own nav and sub-pages:

### Music (`/music`)
- Artist and album/song pages (`/artists/:slug`, `/albums/:albumId`, `/songs/:songId`) with lyrics and annotations
- **The Board** (`/board`) — a freeform, drag-and-drop pinboard of posts
- **The Stage** (`/videos`) — artist videos
- **The Crosshair** (`/crosshair`) — a filterable video player (shorts/long-form)
- A record-player widget backed by `RecordPlayerTrack` data

### Fashion (`/fashion`)
- **The Talent** (`/fashion/talent`) — model/talent profiles with photo galleries and "featured in" credits
- **The Catalogue** (`/fashion/catalogue`) — collections of editorial looks (`/fashion/collections/:slug`)
- Individual look pages (`/fashion/looks/:slug`) with image galleries, piece breakdowns, and a two-tier credit system (talent + outside/crew credits)

### Admin (`/admin/*`)
A protected CMS covering both verticals: artists, albums, songs, lyrics, videos, crosshair videos, the record player, board posts, and — gated behind `SUPER_ADMIN`/fashion access — fashion talent, outside talent, looks, and collections. Login is at `/admin/login`.

## Tech Stack

- **Frontend**: React 19, React Router 7, Vite, PrimeReact, Framer Motion, Tiptap (rich text)
- **API**: Vercel Functions (`api/`)
- **Data**: Prisma ORM (`prisma/schema.prisma`) — Artist, Album, Song, BoardPost, CrosshairVideo, FashionTalent, FashionCollection, FashionLook, and their related credit/image tables
- **Storage**: Vercel Blob for uploaded images (`api/blob.js`, `api/admin/uploads.js`)
- **Analytics**: Vercel Analytics

## Development

- `npm run dev`: frontend-only Vite dev server
- `npm run dev:vercel`: full-stack local dev with the React app and Vercel API routes
- `npm run build`: production frontend build
- `npm run test:run`: run the test suite
- `npm run db:migrate` / `db:push` / `db:studio` / `db:seed`: Prisma workflows

Use `npm run dev:vercel` for any page that depends on `/api/*` routes, including the homepage.

## Deployment Notes

- Vercel Hobby limits function count per deployment, not across all of your projects.
- Only deployable runtime handlers should live under `api/`.
- API tests live in `src/test/api/` so they do not get counted as Vercel Functions.
