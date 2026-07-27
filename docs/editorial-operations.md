# Editorial Operations

This document records operational shortcuts and release checks that affect public
content timing.

## Fashion Homepage Featured Image Swap

`src/pages/FashionHomePage.jsx` lets an authenticated admin-preview user change
which image is featured for a fashion look directly from the public homepage.
The page builds a full look payload with the updated image usage and saves it
through `api/admin/fashion?resource=looks`.

Treat this as a permanent editorial shortcut:

- Preserve the public-preview-only access model.
- Keep the save path aligned with the main fashion look admin form so image usage
  does not drift between routes.
- Verify that changing the featured image does not remove other look images,
  pieces, credits, collection placement, or creator ownership.
- When testing manually, confirm the public homepage, look detail page, and admin
  look editor agree on which image is featured.

## Release Hygiene Checks

Private SoundCloud URLs and scheduled visibility are release-operation concerns.
Use the release check script added in this repository before and after release
dates to confirm:

- Released songs no longer depend on `privateSoundcloudUrl`.
- Future-dated songs remain hidden from anonymous public reads.
- Songs configured with `autoShowOnRelease` become effectively visible once their
  release date arrives, without an admin edit or redeploy.
