# Design System: A.S.D.

This document records the current design choices for the A.S.D. public site and admin CMS. It should guide new pages, components, and redesign work so the music label, fashion vertical, and management tools keep one recognizable visual language.

## 1. Visual Theme & Atmosphere

A.S.D. is a dark, editorial, media-first interface. The public experience should feel like a label archive, backstage runway, listening room, and fan-facing release hub sharing the same venue. Use near-black rooms, aged-gold UI signals, grainy light, hard-edged media, compact controls, and custom display typography.

- **Density:** Daily App Balanced, about 6/10. Public pages need spacious hero moments, but release grids, catalogue grids, lyrics, queues, and admin screens should stay efficient.
- **Variance:** Offset Asymmetric, about 7/10. Use image-led compositions, split layouts, sticky copy columns, staggered rows, and feature panels instead of generic centered blocks.
- **Motion:** Fluid CSS, about 7/10. Existing player launches, fashion spotlights, card reveals, shimmer placeholders, nav panels, and view transitions are part of the brand. Motion must remain purposeful and GPU-friendly.
- **Public mood:** Cinematic black stage with record-store tactility and fashion-show light.
- **Admin mood:** Dark professional CMS. Quieter than the public site, with denser spacing, clear editing affordances, and stable controls.

## 2. Color Palette & Roles

Use the root tokens in `src/styles/index.css` as the primary source of truth. Add new tokens only when a value becomes reused across screens.

- **Backstage Black** (`#0A0A0A`) - Primary app background via `--bg`.
- **Ink Surface** (`#111111`) - Sidebar, panels, modal bodies, nav panels via `--bg-surface`.
- **Raised Charcoal** (`#1A1A1A`) - Hovered cards, inputs, editor panels, elevated controls via `--bg-raised`.
- **Stage Black** (`#060606`) - Fashion and editorial page background where a deeper page field is needed.
- **Primary Text** (`#E8E8E8`) - Main copy via `--text`.
- **Muted Text** (`#777777`) - Metadata, secondary labels, disabled explanatory copy via `--text-muted`.
- **Aged Gold** (`#C8A96E`) - Single brand accent via `--accent`; use for active nav, CTAs, focus rings, section kickers, links, player states, and scrollbar thumbs.
- **Gold Wash** (`rgba(200, 169, 110, 0.15)`) - Soft active or hover backgrounds via `--accent-dim`.
- **Danger Red** (`#E06060`) - Hidden/unpublished markers, destructive actions, validation errors via `--danger`.
- **Hairline Border** (`rgba(255, 255, 255, 0.07)`) - Structural separators and low-emphasis card borders via `--border`.

Rules:

- Keep Aged Gold as the only dominant accent. Do not add a competing brand color for ordinary CTAs or active states.
- Use cyan, blue, green, or purple only as rare atmospheric lighting in art-directed backgrounds, never as button glows or system accents.
- Prefer tokenized near-black values over pure black for new UI. Existing art-directed gradients can remain, but new reusable surfaces should use `--bg`, `--bg-surface`, or `--bg-raised`.
- Gold hover/focus states should increase border/text contrast before adding shadow.
- Danger states must remain red and obvious, especially for hidden content and destructive admin actions.

## 3. Typography Rules

The site uses custom bundled fonts from `fonts/`, declared in `src/styles/index.css`.

- **Display and logo:** `Disko`, with `DiskoFill` for layered outlined/fill treatments. Use for A.S.D. branding, large route titles, and editorial display moments.
- **Secondary display:** `Alba`. Use for section titles and descriptive editorial copy that needs brand character without the full display treatment.
- **Navigation tabs and compact labels:** `Accessories`. Use for uppercase tabs, eyebrows, navigation labels, and compact CTA text.
- **Readable body and dense UI:** `Mono55`. Use for paragraphs, admin text, release metadata, lyric displays, queue rows, forms, and precise product UI.
- **Slanted mono:** `Mono56`. Use sparingly for alternate metadata or art-directed accents.
- **Artist names:** `Halloween`. Use only for artist-identity display moments where that expressive voice is intentional.
- **Admin shell:** Current admin layout uses `DM Sans` for utilitarian navigation and `Playfair Display` for selected admin headings. Keep that split unless a focused admin typography pass replaces it.

Rules:

- Public hero titles can be large, but they must fit without clipping at narrow widths. Use `clamp()` and short line lengths.
- Dense text, lyrics, and admin copy should prioritize readability over brand type. Keep `Mono55` or admin sans where sustained reading is required.
- Use uppercase sparingly: nav tabs, labels, section kickers, and compact CTAs. Do not uppercase paragraph copy.
- Body copy should stay around 55-65 characters per line where practical.
- Do not introduce `Inter` as a new visual dependency. It would flatten the current custom identity.
- Avoid generic serif defaults for new public UI. If a serif is needed, choose it deliberately and document why.

## 4. Layout Principles

- Use full-width dark page fields with constrained inner content. Common public max widths are `1360px`, `1440px`, `1540px`, and `1720px` depending on media density.
- Prefer CSS Grid for page-level layouts and catalogue grids. Flex is appropriate for controls, nav rows, chips, and simple alignment.
- Public sections should usually be split, sticky, or media-led rather than three equal cards in a row.
- Cards are for repeated content or true framed tools. Avoid cards inside cards.
- Maintain crisp image aspect ratios: square release art, 16:9 video, 4:5 fashion imagery, 7:9 credit portraits, and fixed player artwork.
- Preserve the sticky public navigation at `--nav-height`; page heroes should account for it with `100dvh` calculations.
- The Board is a fixed canvas experience. Keep its panning model and textured board background distinct from standard page layouts.
- Admin pages should favor stable panes, clear action rows, compact cards, tables/forms, and predictable scroll containers over editorial composition.

## 5. Components

### Navigation

The shared nav is a sticky card-nav system with three route groups: Home, Music, and Fashion.

- Keep the A.S.D. mark left-aligned on desktop and compact on mobile.
- Active section tabs use Aged Gold fill and Backstage Black text.
- The expanded nav panel uses a dark raised surface, grouped cards, icons, and short descriptions.
- Mobile nav should keep the active group visible and hide inactive groups inside the expanded panel.

### Buttons and Links

- Primary public CTAs use Aged Gold borders/fills with compact uppercase `Accessories` or `Mono55` text.
- Player and transport controls use circular icon buttons where the action is mechanical.
- Admin buttons should expose disabled, loading, active, focus-visible, and destructive states.
- Hover motion should be a small `translateY(-1px)` or `translateY(-2px)`. Active press can move down by `1px`.
- Do not use neon outer glows. If emphasis is needed, use border color, background wash, or a restrained shadow.

### Cards

- `src/styles/ContentCard.css` is the canonical public card language for releases and fashion catalogue items.
- Cards use thin borders, small radii, square media, centered titles/metadata, and gold focus/hover accents.
- Hidden/unpublished cards use red crossout treatment and line-through metadata.
- Repeated grids should constrain image sizes with aspect ratios so text changes do not shift the layout.

### Forms and Admin Surfaces

- Labels go above inputs. Errors and helper text belong below controls.
- Use dark fields, clear border states, and gold focus rings.
- Destructive controls use the danger red family, not gold.
- Admin modals must close through explicit controls only. Do not add overlay-click or Escape dismissal to admin form modals unless product behavior is changed intentionally.
- Keep admin scrollbars, sticky sidebars, and mobile collapsed behavior consistent with `AdminLayout.css`.

### Media

- Music pages should foreground album art, vinyl/turntable surfaces, player artwork, video thumbnails, and artist imagery.
- Fashion pages should foreground real look, model, runway, collection, and credit imagery.
- Avoid abstract placeholder graphics when a content image should exist. Empty image states may use dark geometric gradients, but they should not look like final artwork.
- Use meaningful `alt` text for content images and empty `alt=""` for decorative brand or background images.

### Loading, Empty, and Error States

- Loading states should match the shape of the final content: card placeholders, runway shimmer panels, skeleton rows, or media blanks.
- Avoid generic circular spinners for public content. A small spinner is acceptable only in constrained utility panels where no layout skeleton is practical.
- Empty states should explain the missing content in the domain voice: no releases, no videos, no looks, no catalogue entries.
- Error states should be inline and actionable. Admin errors must identify what failed to save, load, delete, or validate.

## 6. Motion & Interaction

Motion is part of the site identity, but it must remain performant and respectful.

- Animate `transform` and `opacity` first. Avoid animating layout properties such as `top`, `left`, `width`, or `height` unless the component is isolated and measured.
- Use existing timing tokens: `--transition` (`0.2s ease`) and `--transition-fast` (`0.15s ease`) for standard controls.
- Larger public motion can use custom cubic easing such as `cubic-bezier(0.22, 1, 0.36, 1)` for player and lyrics transitions.
- Keep perpetual animations subtle: runway sweeps, stage glows, camera flashes, shimmer placeholders, title panning, and board/player atmosphere.
- Every non-trivial animation needs a `prefers-reduced-motion` path.
- View-transition names are contract-sensitive. Do not rename player, fashion, or route transition hooks without checking the corresponding CSS and JS together.

## 7. Responsive Rules

- Minimum supported width is `320px`.
- Use `100dvh` and `min-height: calc(100dvh - var(--nav-height))` for viewport-height public sections. Avoid `100vh` for new mobile-sensitive hero work.
- Public multi-column layouts collapse to one column around `900px-980px`, then tighten padding at `640px`.
- Catalogue grids can remain two columns on small phones only when card widths and text truncation have been checked.
- Interactive targets should be at least `40px`, and ideally `44px`, on touch devices.
- Never introduce horizontal page overflow. Horizontal scrolling is acceptable only for intentional media rows or board/canvas interactions.
- Mobile typography should use `clamp()` with a readable lower bound. Do not scale text directly with viewport width alone.
- Fixed player controls must respect mobile bottom controls, preview banners, and safe-area insets.

## 8. Accessibility & Semantics

- Icon-only controls require `aria-label`.
- Expandable controls must maintain `aria-expanded` and `aria-controls` where applicable.
- Focus-visible states should be as visible as hover states.
- Do not rely on hover-only disclosure for navigation, player, admin actions, or popovers.
- Preserve logical DOM order even when layouts are visually asymmetric.
- Ensure hidden/unpublished states are visible beyond color alone, using crossout treatment or text labels where needed.

## 9. Anti-Patterns

Do not introduce these patterns:

- Generic SaaS landing-page sections that explain the product instead of showing the actual music/fashion experience.
- Centered hero blocks as the default page pattern.
- Three identical feature cards in a row for major public sections.
- Competing accent colors for ordinary CTAs.
- Neon purple/blue gradients, glowing buttons, or generic AI-style aurora as the main brand surface.
- Large gradient text treatments.
- Pure black reusable surfaces when a tokenized near-black surface is available.
- Custom mouse cursors.
- Decorative emoji.
- Placeholder names such as "John Doe", "Acme", or generic demo content in user-facing UI.
- AI copywriting cliches such as "Elevate", "Unleash", "Next-Gen", or "Seamless".
- Untested changes to player view-transition names, admin modal close behavior, or public card dimensions.

## 10. Source References

- Global tokens and fonts: `src/styles/index.css`
- Shared public navigation: `src/components/shared/Nav.jsx`, `src/styles/Nav.css`
- Shared public cards: `src/styles/ContentCard.css`
- Music homepage and player surfaces: `src/styles/MusicHomePage.css`, `src/styles/Player.css`
- Fashion routes and runway language: `src/styles/FashionPages.css`
- Board canvas: `src/styles/board-canvas.css`
- Admin shell: `src/styles/AdminLayout.css`
- Route map: `src/App.jsx`
