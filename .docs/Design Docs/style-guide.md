# Frontend Style Guide

Use this document when building or reviewing frontend components and pages. It defines the intended visual style, responsiveness, and accessibility expectations for the EllipsisConnect UI. Context-specific overrides are allowed when justified (e.g. marketing vs app shell); otherwise follow the guide.

---

## Color palette – Mystic Aqua Serenity

The primary colors for the site are from the **Mystic Aqua Serenity** palette. 

<!-- markdownlint-disable MD060 -->
| Name          | Hex     | Use (short)                                 |
| ------------- | ------- | ------------------------------------------- |
| Jet Black     | #17252A | Primary dark (text, strong contrast, drama) |
| Pine Blue     | #2B7A78 | Secondary dark (accents, depth, evergreen)  |
| Tropical Teal | #3AAFA9 | Primary accent (CTAs, links, energy)         |
| Azure Mist    | #DEF2F1 | Light backgrounds, subtle panels            |
| White         | #FEFFFF | Primary light background, clarity           |
| Warning       | #E8D4A1 | Caution states (backgrounds, borders)       |
| Alert         | #CD5B5B | Denial/error states (same saturation as Tropical Teal) |
<!-- markdownlint-enable MD060 -->

These are the primary colors for the site; use them by default. Exceptions only when context demands.

For component styling, use **semantic theme tokens only** (e.g. `primary`, `surface`, `text-muted`, `alert`, `on-alert`) for all themeable colors; token contract and usage: [theme-tokens.md](theme-tokens.md). The base theme (Teal) maps these tokens to the palette above. Full UI migration to tokens (Epic TS.9) is complete; do not add hard-coded palette or Tailwind color literals. Users can change the active theme from **Account Settings** → Theme ([theme-tokens.md](theme-tokens.md)#theme-picker-account-settings).

---

## Flat design

The page follows a **flat** design style: minimal depth, no faux-3D, focus on content and usability.

- **No gradients, heavy shadows, or skeuomorphism.** Use solid fills and simple borders.
- **Clear hierarchy via color and typography**, not 3D effects or drop shadows.
- **Minimal decoration;** focus on content and usability.

Flat design paired with the teal/aqua palette supports a clean, modern look that stays readable and consistent across components.

---

## Responsive design

All UIs must work on **web and mobile.**

- Use a **mobile-first or breakpoint-based** approach; test at multiple viewport sizes.
- **Touch targets:** ensure interactive elements meet WCAG AA minimum (24px; see WCAG 2.2 SC 2.5.8). **Only** the global navbar (main app nav) uses 44px for better mobile navigation; all other UI (connection pane nav, back button, section navs, editors, etc.) uses 24px minimum. Standardized in Phase Two epic P2.1b; see [EC_-_ConnectionsPageV2.md](../Implementation%20Plan/EC_-_ConnectionsPageV2.md) for implementation notes.
- **Readable text** without zoom; avoid fixed small font sizes.
- **Flexible layouts** (e.g. grid, flexbox); avoid fixed widths that cause horizontal scroll.
- **No horizontal scroll** on viewports; content should reflow.

The project uses Tailwind; when standardizing breakpoints, use Tailwind’s (`sm`, `md`, `lg`, etc.) for consistency.

---

## ADA compliance

All frontend work must comply with **ADA** (accessibility) requirements at **WCAG 2.2 Level AA** (bare minimum).

- **Color contrast:** Meet WCAG AA for text. Use Jet Black, Pine Blue, or Tropical Teal on Azure Mist or White for sufficient contrast; verify combinations with a contrast checker.
- **Target size (SC 2.5.8):** Interactive elements at least 24×24 CSS pixels. Navbar controls use 44px for better mobile usability.
- **Semantic HTML and ARIA:** Use landmarks, labels, and roles where needed (headings, `aria-label`, `role` when appropriate).
- **Keyboard navigation:** All interactive elements must be reachable and operable via keyboard; ensure visible focus indicators. Overlay menus (e.g. the mobile nav) are dismissible via Escape and expose a focusable “Close” control (e.g. backdrop with `role="button"` and `aria-label`) so keyboard users can close without tabbing through menu items.
- **Alternatives for non-text content:** Provide `alt` text for images; captions or transcripts where relevant.

When building components, test with keyboard-only navigation and a screen reader. For detailed criteria, see [WCAG 2.x Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/).

---

## Theme

The app supports multiple color themes via **semantic theme tokens**. Users change the active theme under **Account Settings** ([/settings/account](/settings/account)) in the Theme section. For the token contract, how to add a new theme, and Theme Provider usage, see [theme-tokens.md](theme-tokens.md). For a per-theme breakdown of all token colors, see [theme-palettes-reference.md](theme-palettes-reference.md).

---

## Quick reference for component work

When building a component, check:

1. **Palette / theme tokens** – use semantic tokens only (see [theme-tokens.md](theme-tokens.md)); no hard-coded hex or Tailwind palette literals for themeable colors. Exceptions (e.g. logos) justified and documented.
2. **Flat styling** – solid fills, simple borders, no gradients/heavy shadows.
3. **Responsive behavior** – works on web and mobile; touch targets, no horizontal scroll.
4. **Accessibility** – contrast, semantics, keyboard, and alternatives for non-text content.