# House Theme Design

## Goal

Give members an opt-in profile preference that makes House Points feel connected to their assigned house without sacrificing readability, accessibility, or maintainability. The theme should feel like a meaningful app-wide identity shift, not just a button color swap.

## Current State

- Users can enable `houseThemeEnabled` from Account Settings.
- The app derives a tiny token set from `House.color`.
- The current resolver only changes `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`, and `--ring`.
- Core surfaces stay neutral, which keeps the UI readable but makes the feature feel anemic.
- House data stores one color only, so every generated theme depends on a single accent.

## Product Principles

- The setting is personal. One user can use their house theme while another keeps the default theme.
- The house identity is organization-scoped. If a user switches orgs, the active theme follows the selected org and assigned house.
- Owners define house branding. Members opt into using that branding.
- The theme must be readable first, expressive second.
- Destructive, warning, and success semantics should remain stable and recognizable.
- The default House Points theme remains the fallback when theme data is missing, invalid, or disabled.

## UX Shape

### Member Preference

- Keep the Account Settings control named `Use my house theme`.
- Show the assigned house name and a small preview of the active theme.
- Disable the toggle when the user has no active house assignment.
- Disable the toggle when the house theme does not pass accessibility validation.
- Explain that the setting follows the current organization and active house.

### Owner Configuration

Owners need more than one color to make themes feel intentional. Expand house setup from a single color to a small theme palette:

- `Primary`: main house identity color.
- `Secondary`: supporting color used for gradients, subtle accents, and selected surfaces.
- `Surface tint`: optional soft background tint for cards and page wash.

The UI should still feel simple:

- Default to generating secondary and surface tint from the primary color.
- Let owners override generated colors in an `Advanced theme` section.
- Show a live preview before save.
- Surface validation messages near the color controls.

## Theme Token Strategy

Keep theme generation centralized in `apps/web/src/lib/house-theme.ts`. The resolver should return semantic CSS variables, not component-specific styles.

### Identity Tokens

These can vary by house:

- `--primary`
- `--primary-foreground`
- `--secondary`
- `--secondary-foreground`
- `--accent`
- `--accent-foreground`
- `--ring`
- `--house-surface`
- `--house-surface-foreground`
- `--house-gradient-from`
- `--house-gradient-to`
- `--house-muted`
- `--house-muted-foreground`

### Stable Tokens

These should not be house-themed:

- `--destructive`
- `--destructive-foreground`
- success colors
- warning colors
- audit severity colors
- medal/ranking colors
- base text color unless a high-contrast theme explicitly supports it

### Surface Philosophy

Do not replace every neutral surface. Instead, add a visible identity layer:

- Page background gets a very subtle house wash or radial accent.
- Header gets a faint house-tinted border or gradient line.
- Cards can use a `--house-surface` wash for featured panels only.
- Primary buttons, tabs, focus rings, and selected states use house identity tokens.
- House badges and report bars continue using direct house colors.

This keeps the product readable while making the theme feel present across the app.

## Data Model

Phase one can still generate a richer theme from the existing `House.color`. A fuller implementation should persist owner-tuned palette fields on `House`.

Proposed fields:

- `color`: existing primary color, keep for compatibility.
- `themeSecondaryColor`: optional string.
- `themeSurfaceColor`: optional string.
- `themeMode`: enum-like string, initially `GENERATED` or `CUSTOM`.

Rules:

- `color` remains required and is the canonical primary identity color.
- Optional colors must pass the same strict six-digit hex validation.
- If optional colors are absent, generate them from `color`.
- Existing contracts should expose the expanded theme as a nested `houseTheme` object once the UI needs it.

## Accessibility Rules

- Primary foreground contrast must be at least WCAG AA for normal text, `4.5:1`.
- Button, tab, and badge text must always use computed foreground colors.
- Surface tint must not reduce body text contrast below `7:1` against foreground.
- Focus ring must be visually distinct from both background and primary surfaces.
- Very low saturation colors can be allowed, but the UI should warn owners that the theme will feel subtle.
- Bright colors such as yellow should use dark foreground text automatically.

## Application Surfaces

### Dashboard

The dashboard should show the strongest theme expression:

- page-level soft gradient wash
- house-themed top border or header accent
- primary action buttons
- selected tab state
- focus rings
- season selector badge
- empty-state illustration/accent

### Account Settings

Settings should preview and explain the theme:

- account nav active state
- profile icon treatment
- theme preference preview card
- selected organization accent

### Manage

Manage is operational and should stay calmer:

- active navigation states
- focus rings
- owner preview cards
- primary save buttons

Avoid turning audit tables, destructive actions, and validation states into house colors.

## Implementation Phases

### Phase 1: Richer Generated Theme

Status: complete.

No database migration.

- Expand `resolveHouseThemeStyle` to generate secondary, surface, gradient, and muted house tokens from the existing `House.color`.
- Add global CSS helpers for house theme surfaces.
- Apply the new tokens to dashboard shell, settings shell, and key account/profile surfaces.
- Update the settings copy to say the theme changes page accents and selected surfaces.
- Add tests for generated tokens, bright colors, neutral colors, and invalid colors.

### Phase 2: Owner Preview

Status: complete.

No database migration required unless custom colors are included in this phase.

- Add a richer house theme preview to House Management.
- Show examples for page wash, primary button, badge, and card accent.
- Warn when a house color is valid but visually subtle.
- Keep current save behavior if custom palette fields are deferred.

### Phase 3: Persist Custom House Palettes

Requires a database migration and contract updates.

- Add optional palette fields to `House`.
- Update house create/edit contracts and API routes.
- Add owner controls for generated vs custom palette.
- Keep generated palette as the default for existing houses.
- Audit palette changes as house configuration updates.

### Phase 4: Theme QA Matrix

- Test representative house colors: purple, green, blue, orange, yellow, red, gray, near-black, and near-white.
- Verify dashboard, settings, manage, award/deduct dialogs, notification tray, and mobile layouts.
- Capture screenshots for future regression checks.

## First Implementation Slice

Start with Phase 1. It gives users a meaningful visual difference without schema risk:

1. Expand the theme resolver.
2. Add the new semantic tokens.
3. Apply them to dashboard and settings shells.
4. Update tests.
5. Revisit the owner palette fields only after the generated version feels worth keeping.

## Open Questions

- Should custom palette fields be owner-only, or should admins be able to configure house branding too?
- Should the app eventually support a dark house theme mode?
- Should season/event themes ever override house themes?
- Should the account setting be renamed from `House theme` to `House style` or `Use my house colors`?
