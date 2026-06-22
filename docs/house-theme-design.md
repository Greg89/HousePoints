# House Theme Design

## Goal

Give each user an opt-in profile preference that lets the app borrow visual identity from their assigned house. The first production slice should make the app feel house-specific without turning every surface into a fully custom skin.

## UX Shape

- The control lives in Profile Settings.
- The control is a toggle labeled `Use my house theme`.
- The toggle is enabled only when the user has an assigned house with a valid house color.
- The dashboard and settings pages apply the theme when the preference is enabled.
- The app falls back to the default purple/green design tokens when the preference is off, the user is unassigned, or the house color is invalid.

## Theme Strategy

A single house color is treated as an anchor, not a full palette. The app generates a small semantic token set from that anchor:

- `--primary`
- `--primary-foreground`
- `--accent`
- `--accent-foreground`
- `--ring`

The first pass intentionally leaves core surfaces stable:

- `--background`
- `--foreground`
- `--card`
- `--muted`
- destructive/success colors

This keeps contrast and readability predictable while still changing the identity layer: buttons, tabs, focus rings, badges, and other primary/accent elements.

## Production Rules

- Validate house color input before applying theme variables.
- Only accept six-digit hex colors for phase one.
- Choose primary foreground color from contrast against the generated primary color.
- Persist the preference on the user record so it follows the account across devices.
- Do not rely on local storage for the source of truth.
- Keep the resolver centralized and unit tested.
- Keep the first implementation scoped; broader palette work can happen after visual QA with real house colors.

## Phase 1 Scope

- Add `houseThemeEnabled` to `User`.
- Include the preference in app-user/bootstrap responses.
- Extend profile update to persist the preference.
- Add a settings toggle.
- Add a theme resolver utility.
- Apply generated CSS variables on dashboard and settings surfaces.
- Add focused tests for contracts, API behavior, settings UI, and theme generation.

## Phase 2 Scope

- Add shared house color assessment next to the theme resolver.
- Keep strict six-digit hex validation for generated themes.
- Surface owner feedback in House Management before colors are saved.
- Show a live preview for badge, outline, and button treatment using the same semantic theme variables as the dashboard.
- Flag neutral colors as readable but visually subtle so owners can choose a stronger house identity.
- Add focused tests for color assessment and owner-facing house color preview states.

## Later Options

- Add preview cards for default vs house theme.
- Let owners tune house color palettes beyond one color.
- Support richer generated scales using a color library.
- Add contrast checks in house management when owners choose colors.
- Apply secondary/background/card variants after usability review.
