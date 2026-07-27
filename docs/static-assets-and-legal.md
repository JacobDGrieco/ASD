# Static Assets and Legal Copy

This document records source-of-truth rules for static assets that are easy to
mismanage because they live outside the CMS and database.

## Fonts

Custom font binaries live in `fonts/` and are loaded from `src/styles/index.css`.

Current font files:

- `fonts/accessories soft.ttf`
- `fonts/ALBA____.TTF`
- `fonts/ALBAM___.TTF`
- `fonts/ALBAS___.TTF`
- `fonts/BILLO___.TTF`
- `fonts/Disko.ttf`
- `fonts/Disko-Fill.ttf`
- `fonts/Disko_OT.otf`
- `fonts/Halloween Season.otf`
- `fonts/monof55.ttf`
- `fonts/monof56.ttf`

These files were previously noted as DaFont-sourced. The exact redistribution
license text is not committed in this repository, so do not add new commercial
uses, redistribute the font bundle independently, or replace these files without
recording the license/source URL and any attribution requirements.

Before adding or replacing a font:

1. Record the source URL, license name, and redistribution terms in this file.
2. Keep the binary in `fonts/`.
3. Add or update the matching `@font-face` declaration in `src/styles/index.css`.
4. Verify the public pages that use the font still render with acceptable fallback
   behavior while the font is loading.

## Legal Copy

Until a separate legal-document source of truth exists, the editable legal-copy
sources are:

- `public/legal/privacy-policy.html`
- `public/legal/terms-of-service.html`

`src/pages/LegalPage.jsx` renders those files. Do not duplicate canonical legal
copy into React components, markdown docs, or CMS fields unless the source-of-truth
model is intentionally changed.

Legal-copy updates should be reviewed as content changes, not as generated build
output. Keep the HTML semantic and avoid inline scripts.
