# Epic Code Review

1. **Resolve the epic and work plan**
   - From the prompt, identify the epic (e.g. epic number, name, or ID).
   - In `docs/` (especially `docs/Implementation Plan/`), find the work plan that defines that epic.
   - Use that plan as the source of truth for scope and deliverables.

2. **Review current code changes**
   - Review only the **modified/added code** (e.g. from `git status` / `git diff` or the files in context).
   - Evaluate against:
     - **Clean, modular, scalable code**: single responsibility, clear boundaries, minimal coupling, reuse where appropriate.
     - **No breaking changes**: existing behavior and contracts (APIs, props, routes, config) preserved unless the plan explicitly allows changes.
     - **Deliverables met**: each planned deliverable/task for this epic is satisfied by the current changes (no gaps, no scope creep that blocks completion).

3. **Output format**
   - **Do not** include positive feedback or praise; only report what is wrong or missing.
   - **If nothing is wrong**: state briefly that no changes are required.
   - **If changes are required**: list them in an **actionable, plan-ready** form:
     - One clear finding per item.
     - What is wrong or missing (deliverable, breaking change, or code-quality issue).
     - What must be fixed or added (enough detail that a follow-up plan or task list can be built from it).
   - Keep notes concise; no filler.

If the prompt does not mention an epic, request an epic from the user.
