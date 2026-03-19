# Document Code Changes

Update the documentation in **docs/** so it remains the **source of truth** for the state and intent of each part of the platform.

## Scope

1. **Determine what changed**
   - Use the current git status (modified/added files) to identify affected areas: backend (`apps/ec-backend/`), frontend (`apps/ec-frontend/`), or both.
   - If the user specifies particular files or features, focus on those; otherwise use git changes as the scope.

2. **Map changes to docs**
   - **Backend:** `docs/be/` — `setup.md`, `auth-api.md`, `profiles-api.md`, `connections-api.md`, `messaging-api.md`, `metrics-api.md`, `home-editor-api.md`. Use these for API contracts, endpoints, models, permissions, and backend expectations/practices.
   - **Frontend:** `docs/fe/` — `setup.md`, `style-guide.md`, `auth.md`, `profiles.md`, `connections.md`, `messaging.md`, `home-editor.md`. Use these for UI flows, routes, client API usage, and frontend expectations/practices.
   - **Planning:** `docs/Implementation Plan/` — Work Breakdown and related docs. Add or adjust implementation notes only when the change reflects a completed epic, a new capability, or a notable deviation from the plan.

3. **Update only affected docs**
   - Edit only documentation that is actually impacted by the code changes. Do not rewrite unrelated sections.
   - Preserve existing structure: documentation map tables, "Expectations and practices" paragraphs, and section headings. Match the tone and level of detail already in each file.

## What to document

- **State:** What exists now (endpoints, routes, models, env vars, scripts). Ensure names, URLs, and behavior match the current code.
- **Intent:** How a feature or module is meant to be used; conventions (e.g. `fetchApi`, permission classes, guards); and any caveats or gotchas that help developers work correctly.

## Output

1. List which doc files you are updating and why (briefly).
2. Apply the edits to those files.
3. If you added or changed implementation notes in the Work Breakdown (or similar), say so and where.

Do not commit. The user will review and commit the doc updates.
