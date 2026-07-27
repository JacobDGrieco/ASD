# Authentication and Permissions

## Session Model

Admin sessions are JWTs stored in the HttpOnly cookie `asd_admin_token`. Server helpers live in `src/lib/auth.js`.

`api/admin/login.js` creates sessions through three credential paths:

1. `ADMIN_PASSWORD` grants `SUPER_ADMIN`.
2. Active `ArtistAdminAccess` rows grant `ARTIST`, except the reserved `A.S.D.` artist is promoted to `SUPER_ADMIN`.
3. Active `FashionTalentAdminAccess` rows grant `TALENT`.

`DELETE /api/admin/login` clears the cookie.

## Client State

`src/lib/adminAuth.jsx` stores session metadata and a sentinel token value of `cookie`. The real JWT is never stored in JavaScript-readable state. Admin API requests authenticate through the HttpOnly cookie.

## Roles

- `SUPER_ADMIN`: full admin access.
- `ARTIST`: scoped to one `artistId`.
- `TALENT`: scoped to one `talentId`.
- `VIEWER`: read-only/public-ish access in selected admin views.

## Page Access

`src/lib/adminPageAccess.js` defines admin page keys, paths, defaults, and `pageAccess` filtering.

`pageAccess` controls navigation and route visibility, and admin APIs enforce it server-side for each protected resource. It is not the only security boundary; role and ownership checks still apply.

## API Authorization Policy

Every `api/admin/*` handler must enforce these rules in this order:

1. Require a valid admin session with `requireAdmin` or `requireSuperAdmin`.
2. Deny `VIEWER` for every write path.
3. Check the relevant `pageAccess` key before reading or writing a page-owned resource.
4. Apply ownership scoping for non-super-admin accounts.
5. Return 403 for authenticated callers who lack access; return 404 when revealing existence would leak another account's private resource.

Resource policy:

| Resource | Required access | Ownership rule |
| --- | --- | --- |
| Accounts and About | `SUPER_ADMIN` | Super admin only. |
| Artists | `music_artists`; Board reads may also use `board` for picker data | `ARTIST` can access only its own artist. |
| Albums | `music_albums` for writes; selected music pages may read album picker data | `ARTIST` rows are scoped by `artistScopedAlbumWhere`. |
| Songs, lyrics, annotations | `music_songs` | `ARTIST` rows are scoped by `artistScopedSongWhere`. |
| Outside artists | `music_outside_artists` for writes | Shared read access only where music picker pages require it. |
| Board | `board` | `ARTIST` can manage only its own posts; `SUPER_ADMIN` can archive/reposition label-level posts. |
| Crosshair | `music_crosshair` | No scoped ownership; viewers denied. |
| Record player | `music_record_player` | Viewers may read public-visible song options; writes require non-viewer access. |
| Fashion talent | `fashion_talent` | `TALENT` can access only its own talent profile. |
| Fashion crew/outside talent | `fashion_outside_talent` | Shared read access only where fashion picker pages require it. |
| Fashion looks | `fashion_looks` | `TALENT` can manage only looks with matching `creatorTalentId`. |
| Fashion collections | `fashion_collections` | `TALENT` can manage only collections with matching `creatorTalentId`. |
| Uploads | Folder-specific page access | Upload and delete requests are limited to folders mapped to pages the session can access; `about-members` requires `SUPER_ADMIN`. |

## Ownership Rules

Music:

- `ARTIST` accounts can edit their own artist profile.
- `ARTIST` accounts can only access albums/songs scoped by `artistScopedAlbumWhere` and `artistScopedSongWhere`.
- Song placement writes re-check that selected albums belong to the artist.
- Reserved pseudo-artists are not editable through normal artist CRUD.

Fashion:

- `TALENT` accounts can edit their own talent profile.
- `TALENT` accounts can edit looks/collections only when `creatorTalentId` matches their talent id.
- Talent/crew read access is shared with fashion pages that need picker data.

Board:

- `ARTIST` accounts can create/edit/delete their own posts.
- `SUPER_ADMIN` can post as the label, reposition posts, and archive/unarchive posts.
- `VIEWER` is read-only.

## Viewer Behavior

Viewer visibility for albums/songs is not a direct `isVisible` check. `viewerAlbumVisibilityWhere` and `viewerSongVisibilityWhere` approximate public release visibility, including auto-show-on-release and release-date rules.

## Password Rules

`src/lib/adminAccounts.js` requires account passwords to be unique across artist and fashion talent admin accounts and to differ from `ADMIN_PASSWORD`.

## Login Rate Limiting

`api/admin/login.js` rate-limits failed `POST` attempts per client address in a 15-minute application-level window. This is intentionally dependency-free and per runtime instance; deployment-level edge throttling can still be added later for distributed attack resistance.
