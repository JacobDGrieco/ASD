# Motion Review

This note records the motion policy used by the public site and admin UI after the reduced-motion cleanup.

## Policy

- Decorative loops and entrance effects must stop when `prefers-reduced-motion: reduce` is active.
- State-change transitions can remain only when they are short, local, and do not move large content regions.
- Player, portal, splash, fashion runway, side-rail, turntable, and public-home effects need explicit reduced-motion handling because they are the highest-motion surfaces.
- View Transition API rules stay wrapped in `prefers-reduced-motion: no-preference`.
- New Framer Motion usage should check `prefers-reduced-motion` before enabling springs, drag flourish, or layout movement that is not required to understand state.

## Current Coverage

- `src/styles/ViewTransitions.css` only animates under `no-preference`.
- `src/styles/AuroraBackground.css`, `src/styles/ArtistSplash.css`, `src/styles/FashionPages.css`, `src/styles/HomePortal.css`, `src/styles/Nav.css`, and `src/styles/Player.css` already include reduced-motion branches.
- `src/styles/HomePage.css`, `src/styles/MusicHomePage.css`, `src/styles/Turntable.css`, `src/styles/SideRails.css`, `src/styles/Discography.css`, and `src/styles/SongAlbums.css` now stop their remaining decorative keyframes when reduced motion is requested.
- Component-level checks already exist in `HomePage.jsx`, `MusicHomePage.jsx`, `FashionHomePage.jsx`, `ArtistSplash.jsx`, and `ArtistHero.jsx`.

## Review Notes

- The remaining admin form/table transitions are short color, opacity, or border changes and can stay unless a future accessibility review finds a specific issue.
- Board detail uses Framer Motion for modal/card state. Keep it under review if the board experience gains larger page-level movement.
- Turntable record spin is intentionally tied to playback in normal mode, but it is disabled for reduced-motion users.
