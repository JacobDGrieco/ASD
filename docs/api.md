# API

All API files are Vercel Functions under `api/`.

## Public API

`api/public.js` accepts `GET` only. Friendly routes in `vercel.json` rewrite to `api/public.js` with a `resource` query parameter.

| Public path | Internal resource | Notes |
| --- | --- | --- |
| `/api/artists` | `artists` | Visible music artists list. |
| `/api/artists/:slug` | `artist` | Artist detail by slug. |
| `/api/albums/:id` | `album` | Album detail by id. |
| `/api/songs/:id` | `song` | Song detail, lyrics, annotations, release links. |
| `/api/player-pool?type=...` | `playerPool` | Builds a playable pool by sitewide/artist/album/song context. |
| `/api/record-player` | `recordPlayer` | Active record-player tracks. |
| `/api/crosshair` | `crosshair` | Public Crosshair videos. |
| `/api/fashion/talent` | `fashionTalentList` | Fashion talent list. |
| `/api/fashion/talent/:slug` | `fashionTalent` | Talent profile. |
| `/api/fashion/looks` | `fashionLooksList` | Fashion look list. |
| `/api/fashion/looks/:slug` | `fashionLook` | Look detail. |
| `/api/fashion/catalogue` | `fashionCatalogue` | Collections and loose looks. |
| `/api/fashion/collections/:slug` | `fashionCollection` | Collection detail. |
| `/api/public?resource=boardPosts` | `boardPosts` | Public board posts. |
| `/api/public?resource=about` | `about` | Company profile and members. |

Public responses are marked `Cache-Control: no-store`, but `src/hooks/useApi.js` may cache them in memory in the browser.

If a valid admin cookie is present, `api/public.js` can include hidden/unreleased records for preview. Private SoundCloud URLs for unreleased songs can be returned in admin-preview player contexts.

## Blob API

`api/blob.js` accepts `GET` with:

- `pathname`: required managed/private blob pathname.
- `redirect=1`: optional redirect to the resolved blob URL.

The route reads private blobs only when the pathname is authorized. A valid admin cookie can read managed blobs, and anonymous public reads are allowed only for blob pathnames still referenced by public, visible content. Unreferenced or hidden-content pathnames return 404.

## Admin API

Every admin route authenticates with `src/lib/auth.js`. Most routes return JSON for success and `{ error: string }` for validation/permission failures.

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/admin/login` | `GET`, `POST`, `DELETE` | Hydrate session, login, logout. |
| `/api/admin/accounts` | `GET`, `POST`, `PUT`, `DELETE` | Super-admin account management. |
| `/api/admin/about` | `GET`, `POST`, `PUT`, `DELETE` | Company profile and members. |
| `/api/admin/artists` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Music artist CRUD and artist picker data. |
| `/api/admin/board` | `GET`, `POST`, `PUT`, `DELETE`, `PATCH` | Rewritten to `api/admin/artists?resource=board`; board post CRUD/reposition/archive. |
| `/api/admin/outside-artists` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Music outside artist CRUD. |
| `/api/admin/albums` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Album CRUD and album picker data. |
| `/api/admin/songs` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Song CRUD, placements, roles, metadata. |
| `/api/admin/lyrics?songId=` | `GET`, `PUT` | Song lyric text and synced lines. |
| `/api/admin/annotations` | `POST`, `PUT ?id=`, `DELETE ?id=` | Song lyric annotations and ranges. |
| `/api/admin/record-player` | `GET`, `PUT` | Record-player slots. |
| `/api/admin/record-player?resource=songs&q=` | `GET` | Song picker search for slots. |
| `/api/admin/crosshair` | `GET`, `POST`, `PUT ?id=`, `DELETE ?id=` | Crosshair video CRUD. |
| `/api/admin/crosshair?action=config` | `GET` | YouTube sync config status. |
| `/api/admin/crosshair?action=sync` | `POST` | Manual YouTube channel sync. |
| `/api/admin/uploads` | `POST`, `DELETE` | Vercel Blob direct-upload token/import/delete. |
| `/api/admin/fashion?resource=talent` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Fashion talent CRUD. |
| `/api/admin/fashion?resource=crew` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Fashion crew/outside talent CRUD. |
| `/api/admin/fashion?resource=looks` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Fashion look CRUD. |
| `/api/admin/fashionCollections` | `GET`, `POST`, `GET/PUT/DELETE ?id=` | Fashion collection CRUD. |

## Permission Notes

Route-level UI access is not sufficient. Server handlers enforce permissions again. See `docs/authentication-and-permissions.md` for role behavior.

## Request Shapes

Detailed request bodies are currently defined by the admin page components and the corresponding API handler code rather than formal schemas. Important shared shapes:

- Images: normalized by `src/lib/images.js`.
- Profile links: normalized by `src/lib/profileLinks.js`.
- Music roles: ordered by `src/lib/songRoles.js`.
- Board markdown: validated by `src/lib/boardMarkdown.js`.
- Fashion credits: normalized/auto-linked in `api/admin/fashion.js` and `api/admin/fashionCollections.js`.
