# Theme tokens

Semantic theme tokens define all themeable colors for the UI. Components must use these tokens only; do not use hard-coded hex or Tailwind palette literals for theme colors. The base theme (Teal) maps to the Mystic Aqua Serenity palette.

## Token contract

| Token | Use | Teal (Mystic Aqua Serenity) value |
|-------|-----|-----------------------------------|
| `--color-primary` | Primary dark (strong contrast) | #17252A (Jet Black) |
| `--color-surface` | Primary light background | #FEFFFF (White) |
| `--color-surface-alt` | Light panels, subtle backgrounds | #DEF2F1 (Azure Mist) |
| `--color-accent` | CTAs, links, focus ring | #3AAFA9 (Tropical Teal) |
| `--color-secondary` | Borders, secondary accents | #2B7A78 (Pine Blue) |
| `--color-text` | Primary text | #17252A (Jet Black) |
| `--color-text-muted` | Secondary text | #2B7A78 (Pine Blue) |
| `--color-border` | Borders, dividers | #2B7A78 (Pine Blue) |
| `--color-focus` | Focus outline color | #3AAFA9 (Tropical Teal) |
| `--color-alert` | Error/denial text and borders | #CD5B5B (Alert) |
| `--color-alert-bg` | Error message background | #fef2f2 (light tint) |
| `--color-on-alert` | Text on alert background | #CD5B5B |
| `--color-on-accent` | Text on accent (e.g. primary button) | #FEFFFF (White) |
| `--color-warning` | Caution states | #E8D4A1 (Warning) |

## Usage

- **CSS:** Use `var(--color-*)` for all themeable colors (e.g. `color: var(--color-text)`, `background-color: var(--color-surface)`).
- **Focus:** Use `outline: 2px solid var(--color-focus)` (or equivalent) for visible focus indicators.
- **New themes:** A future theme (e.g. from Account Settings) can override the `:root` variables; the Teal theme is the only one implemented for this pass. Theme picker (Account Settings → Theme) is out of scope until that feature exists.

## File location

Token definitions live in `frontend/src/styles/theme-tokens.css`. The app loads this file before global styles (e.g. in `main.tsx`).
