# Nudgly – Documentation

Start here for product and technical design. Use these docs and the repo’s coding standards when breaking the app into epics and implementing.

## Design docs

- **[Functional & technical design (app-idea)](Design%20Docs/app-idea.md)** — Purpose, goals, MVP scope, functional requirements, system architecture, tech stack, backend services, database schema, nudge engine, deployment, security, observability, risks, and handoff checklist for epic planning.
- **[UI/UX design](Design%20Docs/ui-ux-design.md)** — Visual style, theme system, color palettes, typography, layout, screen specs (Tasks, Lists, Habits, Friends, Settings), and accessibility.

## Implementation plan

- **[MVP Sprint Plan](Implementation%20Plan/MVP-Sprint-Plan.md)** — Epic breakdown for the MVP: small-scope epics, each with FE and BE components for testable delivery. Includes suggested sprint order and placeholder Implementation Notes per epic.

## Coding and quality standards

- **`.cursor/rules/`** — Project rules for AI and developers:
  - **unit-tests-with-changes.mdc** — Unit tests required with every production code change (BE and FE).
  - **frontend-modular-functional.mdc** — Frontend: modular, functional components and dependency injection (applies to `.tsx`, `.jsx`, `.vue`).
  - **html-element-ids.mdc** — Every HTML element must have a unique, descriptive `id` for targeting and automation.

Epic planning and implementation should align with the MVP definition, handoff checklist, and Definition of Done in the [app-idea](Design%20Docs/app-idea.md) document (§16–§17).
