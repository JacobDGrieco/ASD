# Code Standards

These are proposed standards for the A.S.D. repository based on the current React/Vite, Vercel Functions, Prisma, and global CSS codebase. They are not a generic style guide.

## 1. Variables

### General naming

- Use `camelCase` for local variables, parameters, and non-exported mutable values.
- Use `UPPER_SNAKE_CASE` for module-level immutable constants that represent enum-like values, environment variable names, storage keys, cookie names, or integration constants.
- Use `PascalCase` only for React components, classes if introduced, and Prisma model names.
- Preserve database fields, API response properties, query-string fields, route params, cookie names, storage keys, and env vars unless an explicit migration is approved.

### Booleans

Use predicate names:

- `isLoading`
- `isVisible`
- `hasResults`
- `canEdit`
- `shouldRedirect`
- `wasInAdmin`

Avoid ambiguous booleans such as `loading`, `open`, `saved`, or `valid` when the scope is not tiny. Existing short state names can be migrated opportunistically:

- `loading` -> `isLoading`
- `open` -> `isOpen`
- `saved` -> `hasSaved`
- `valid` -> `isValid` or a domain-specific predicate

### Collections and maps

- Arrays should use plural nouns: `artists`, `albums`, `roleEntries`, `catalogueItems`.
- Maps should describe their key: `artistsById`, `albumById`, `poolBySongId`, `slugByName`.
- Sets should describe membership: `managedBlobPathnames`, `selectedSongIds`, `playedIndexes`.

### Counts, units, and dates

- Counts end with `Count`: `imageCount`, `lookCount`.
- Durations include units: `timeoutMs`, `maxAgeMs`, `durationSeconds`.
- Sizes include units: `maxFileSizeBytes`.
- Dates should identify source/meaning: `releaseDate`, `publishAt`, `expiresAt`, `releaseDayBoundary`.
- Avoid generic `time`, `size`, `date`, or `value` outside very small scopes.

### API and database records

- Rename parsed responses to domain names as soon as practical:
  - Good: `const song = await response.json();`
  - Acceptable only in small scopes: `const data = await response.json();`
- Keep Vercel handler parameters as `req` and `res`; they are conventional and clear in `api/*`.
- Use `session` for authenticated admin session data and avoid `token` for the client-side sentinel unless touching legacy code.

### React state and refs

- State tuple names should match:
  - `const [isLoading, setIsLoading] = useState(false);`
  - `const [saveErrorMessage, setSaveErrorMessage] = useState('');`
- Refs end with `Ref`: `rootRef`, `popoverRef`, `previousPathnameRef`.
- Derived values should describe derivation or result: `visibleAlbums`, `sortedLooks`, `normalizedRoles`, `effectiveReleaseDate`.

## 2. Functions

### Verb meanings

Use these project-specific verb distinctions:

- `getX`: read or derive a value already available locally, without network I/O.
- `loadX`: orchestrate a UI/admin data load, often using cache or multiple sources.
- `fetchX`: perform direct network fetches.
- `findX`: search and possibly return nothing.
- `requireX`: validate presence/permission and throw or reject when absent.
- `buildX`: construct an object, URL, payload, route list, or CSS class string.
- `formatX`: convert database/internal shape into client/public display shape.
- `normalizeX`: accept messy/legacy input and return canonical shape.
- `parseX`: turn a string or external payload into structured data.
- `validateX`: return errors or throw based on rules.
- `resolveX`: connect references, links, identities, or external IDs.
- `compareX`: comparator for sorting.
- `syncX`: coordinate two persisted representations.
- `deleteX`: perform deletion or cleanup side effects.

### Event handlers

- Use `handleX` for local handlers passed to events: `handleSave`, `handleSubmit`, `handleDeleteClick`.
- Use `onX` for callback props: `onSave`, `onClose`, `onConfirm`.
- Avoid `saveHandler`, `doSave`, or `onSave` as a local function unless it is directly a prop passthrough.

### Async functions

- Async names should imply I/O or orchestration: `loadSlots`, `syncCrosshairFromYouTube`, `deleteUnusedBlobPathnames`.
- If an async function mutates the database, prefer a verb that says so: `createArtist`, `updateLook`, `deleteAlbum`.

## 3. Components

### Names and files

- Component files use `PascalCase.jsx`.
- Page route components end in `Page`: `AlbumPage`, `AdminMusicAlbumsPage`.
- Shared field/control components describe role: `AdminDateInput`, `ImageCollectionField`, `ConfirmActionButton`.
- Keep framework entry points as-is: `src/App.jsx`, `src/main.jsx`.

### Props

- Callback props use `onX`.
- Boolean props use predicate names where practical: `isOpen`, `isHidden`, `isDisabled`, `shouldEagerLoad`.
- Variants should use explicit role names, not visual-only labels unless the design token is the public contract:
  - Prefer `variant="danger"` over `red`.
  - Prefer `tone="muted"` over `gray`.

### Shared vs feature-specific

Create or keep a component shared only when it improves at least one of:

- Behavior consistency.
- Accessibility.
- Maintainability.
- Testing.
- Reuse across at least two real call sites.
- Design-system adherence.

Do not extract a component only because two JSX fragments look similar.

### Canonical current shared components

- `PageTabs.jsx`: canonical tab wrapper.
- `ArtworkGallery.jsx`: canonical public gallery trigger/modal.
- `PlayButton.jsx`: canonical public playback button.
- `ImageCollectionField.jsx`: canonical admin image collection editor.
- `ConfirmActionButton.jsx`: canonical inline destructive confirmation control.
- `AdminEntityCard.jsx`: canonical admin card for grid-style entity lists.
- `src/styles/ContentCard.css`: canonical shared public card styling for music release cards and fashion catalogue cards.

### Proposed shared components

Only after approval:

- `AdminModal`: admin modal shell, close behavior, header/body/footer.
- `AdminButton`: role-based admin button styles.
- `AdminTable`: table shell, empty row, action-cell conventions.
- `AdminPagination`: shared pagination controls.
- `AdminField`: label/control/error structure.

## 4. Files and Directories

### Directory ownership

- `src/pages/`: route-level orchestration, data loading, page-local state.
- `src/pages/admin/`: CMS route orchestration and admin CRUD flows.
- `src/components/admin/`: reusable CMS controls and layout pieces.
- `src/components/shared/`: public/shared UI that crosses features.
- `src/components/{artist,album,song,fashion,board,home,player}/`: feature-specific UI.
- `src/lib/`: shared logic, data transforms, auth, cache, visibility, integrations.
- `src/hooks/`: React hooks intended to be called by components.
- `src/styles/`: global CSS, grouped by component, page, or shared subsystem.
- `api/`: Vercel Functions. Do not put non-handler source here unless Vercel should deploy it as a function.
- `prisma/`: schema and seed only; generated client output stays excluded.
- `scripts/`: manual or validation scripts.

### File naming

- Components/pages: `PascalCase.jsx`.
- Hooks: `useThing.js`.
- Utility modules: `camelCase.js`.
- API handlers: keep current route-oriented names; use kebab-case for new filenames only when the route or existing directory uses it.
- CSS: `PascalCase.css` when matching a component/page; kebab-case only for already-established lower-case surfaces such as `board-card.css`.

### Barrel files

Avoid adding barrel files unless a directory has many stable shared exports. This repo currently imports files directly, which keeps ownership obvious.

## 5. HTML and JSX Classes

### Canonical strategy

Use semantic, prefix-based kebab-case global classes. This fits the current plain CSS architecture better than CSS Modules or utility-first classes.

Pattern:

```css
component-name-root
component-name-element
component-name-element-subpart
component-name-state
```

Examples:

```css
player-widget
player-widget-title
player-widget-returning-home
admin-modal-header
admin-modal-label-required
fashion-look-model-card
```

### Shared class naming

- Shared admin primitives should use role-based `admin-*` classes, not page-owned prefixes such as `admin-artists-page-*`.
- Shared public cards use `content-card-*` when they serve both music and fashion.
- Feature-specific names should remain feature-prefixed: `artist-hero-*`, `fashion-look-*`, `board-card-*`.

### Avoid

- Generic global classes such as `.container`, `.wrapper`, `.inner`, `.left`, `.right`, `.box`, `.item`.
- Visual-only names such as `.red-button` or `.large-text`.
- Page-owned class names reused as global primitives.

### State classes

Use consistent state suffixes:

- `*-active`
- `*-hidden`
- `*-disabled`
- `*-open`
- `*-loading`
- `*-empty`
- `*-error`

Do not rename animation-specific classes such as player launch/transition classes without testing view transitions.

## 6. Data Attributes and Test Selectors

### Runtime data attributes

Use data attributes for runtime state or integration hooks when CSS/JS needs stable state:

- `data-player-transition`
- `data-loop-mode`
- `data-widget-api-failed`
- `data-error`
- `data-placement`

Prefer class names for ordinary styling states unless JavaScript or view-transition code needs a state hook.

### Test selectors

No test selector convention exists yet. When tests are added, use:

```html
data-testid="admin-album-row"
```

Do not use CSS classes as test selectors in new tests. Do not add `data-testid` broadly until there is a test suite.

## 7. CSS Standards

### Token usage

Keep existing root tokens and expand them incrementally:

- Colors: background, surface, raised surface, text, muted text, accent, danger.
- Borders/focus: standard border, accent focus ring, danger focus ring.
- Radii: control, card, pill, circle.
- Motion: fast, normal, slow durations and common easing.
- Z-index: nav, modal, popover, player, view-transition layers.
- Breakpoints: at least mobile, tablet, desktop, wide.

Do not replace every literal. Tokenize reusable decisions, not one-off art-directed values.

### Selector rules

- Prefer one root class plus child classes.
- Keep specificity low unless overriding PrimeReact or view-transition pseudo-elements.
- Avoid `!important`; document and isolate it if unavoidable.
- Keep third-party selectors such as `.p-tabview-*` in files that clearly own the override.

### Responsive rules

- Use a small standard breakpoint set for new work:
  - 480px: narrow phones.
  - 640px: mobile layout.
  - 720px or 768px: admin/tablet layout. Pick one during migration.
  - 900px: tablet/compact desktop.
  - 1200px: wide desktop grids.
- Existing breakpoints can remain until touched, but new patterns should avoid adding another one-off breakpoint.

### Interaction states

Every interactive custom control should define or inherit:

- Hover state where pointer hover exists.
- Focus-visible state.
- Disabled state if it can be disabled.
- Active/current state if selection is possible.

### Motion and accessibility

- Any non-trivial animation should have reduced-motion behavior.
- Icon-only buttons need `aria-label` and usually `title`.
- Images need meaningful `alt` when content-bearing and empty `alt=""` when decorative.
- Modal/dialog work must verify approved close behavior, focus order, and screen-reader labels.

### CSS file boundaries

- Global tokens/reset: `src/styles/index.css`.
- Shared admin primitives: current shared selectors live in `AdminArtistsPage.css`; move them to `AdminShared.css` only in a future CSS-file reorganization.
- Shared public cards: `ContentCard.css`.
- Page-specific layout stays in page CSS.
- Component-specific visuals stay in component CSS.

### Admin modal close behavior

Admin modals should close only through explicit close, cancel, save, or delete controls. Do not add overlay-click or Escape-key dismissal to admin form modals.

## 8. Enforcement Plan

### Current tooling baseline

- ESLint parses JSX, includes Node/browser globals for the mixed client/server repo, and ignores generated Prisma output.
- The baseline disables React compiler/fast-refresh strict rules that do not match the current code structure; revisit those only during focused React behavior refactors.
- Stylelint has not been added; defer it until CSS selector migration is stable enough to avoid noisy false positives.

### Later enforcement

- Add Stylelint with a class selector pattern only after agreeing on the prefix-based convention.
- Add scripts only when they work locally:
  - `lint`
  - `lint:fix`
  - `format`
  - `format:check`
  - `check`

Do not add overlapping formatters.
