# Authentication and Permissions

## Session Model

Admin sessions are JWTs stored in the HttpOnly cookie `asd_admin_token`. Server helpers live in `src/lib/auth.js`.

`api/admin/login.js` creates sessions through three credential paths:

1. `ADMIN_PASSWORD` grants `SUPER_ADMIN`.
2. Active `ArtistAdminAccess` rows grant `ARTIST`, except the reserved `A.S.D.` artist is promoted to `SUPER_ADMIN`.
3. Active `FashionTalentAdminAccess` rows grant `TALENT`.

`DELETE /api/admin/login` clears the cookie.

## Client State

`src/lib/adminAuth.jsx` stores session metadata and a sentinel token value of `cookie`. The real JWT is never stored in JavaScript-readable state. Some older client requests still build `Authorization: Bearer cookie`; `src/lib/auth.js` rejects that value and authenticates from the cookie. That Authorization-header path is legacy and can be removed after auditing callers.

## Roles

- `SUPER_ADMIN`: full admin access.
- `ARTIST`: scoped to one `artistId`.
- `TALENT`: scoped to one `talentId`.
- `VIEWER`: read-only/public-ish access in selected admin views.

## Page Access

`src/lib/adminPageAccess.js` defines admin page keys, paths, defaults, and `pageAccess` filtering.

`pageAccess` controls navigation and route visibility, and several APIs also check it. It is not the only security boundary. The intended direction is a documented authorization policy where every admin API enforces session, role, ownership, and page-access rules consistently.

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

## Security Gaps and Follow-Up Work

- `api/admin/login.js` needs application-level rate limiting.
- `api/blob.js` currently serves private blobs by known pathname so public pages can render uploaded images. Future work should investigate admin-only blob protection with public-safe delivery.
- A written authorization policy should define required checks for every admin API, including `SUPER_ADMIN`, scoped `ARTIST`, scoped `TALENT`, and `VIEWER` behavior.
