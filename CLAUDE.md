# Project Rules

---

## Frontend HTML IDs

> Applies to: all frontend work

Add a **unique, descriptive `id`** to **every** HTML element in the frontend so that:
- Changes can be directed to specific elements in the future.
- E2E tests and automation can target elements reliably.
- ARIA relationships (e.g. `aria-labelledby`, `aria-controls`) stay consistent.

### Requirement: IDs on every element

**Every** HTML element must have an `id`. No exceptions. This includes:

- **Landmarks**: `main`, `header`, `nav`, `footer`, `section` (e.g. `id="app-main"`, `id="site-header"`, `id="bottom-nav"`).
- **Interactive elements**: buttons, submit inputs, toggles, links (e.g. `id="login-submit"`, `id="mobile-menu-toggle"`).
- **Form controls**: inputs, selects, textareas (match `htmlFor` on labels).
- **Key sections**: cards, lists, dialogs, banners (e.g. `id="connection-card"`, `id="verification-banner"`).
- **Regions targeted by `aria-controls` or `aria-describedby`**: the controlled region must have the matching `id`.
- **Wrappers and layout**: every `div`, `span`, and other container (e.g. `id="login-form-wrapper"`, `id="card-inner"`, `id="hero-text"`).
- **Headings, paragraphs, lists, list items**: e.g. `id="page-title"`, `id="intro-paragraph"`, `id="feature-list"`, `id="feature-item-0"`.
- **Images, icons, SVGs**: e.g. `id="hero-image"`, `id="nav-home-icon"`.

If it's in the DOM and you render it, it gets an `id`.
