# Implement Epic

You are orchestrating a full epic implementation lifecycle. Follow these phases strictly in order. Do not skip phases or combine them.

## Phase 1: Plan the Epic

Run the `/plan-epic` skill. Include the epic text from the user's selection/prompt as context. Wait for the plan to be created and approved before proceeding.

## Phase 2: Implement the Plan

Exit plan mode and implement the plan created in Phase 1. Work through each task methodically:
- Follow the plan exactly as written.
- Run tests as you go to verify correctness.
- Do not commit — commits are handled later.

## Phase 3: Code Review

Once implementation is complete, run the `/epic-code-review` skill against the current changes. Review its output carefully.

## Phase 4: Address Review Findings

If the code review identified issues:
- Fix every actionable finding from the review.
- Re-run relevant tests to confirm fixes.
- Do not commit yet.

If the code review found no issues, skip this phase.

## Phase 5: Complete the Epic

Run the `/complete-epic` skill to mark the epic as completed and update implementation notes.

## Important Notes
- Pause between phases to confirm each phase completed successfully before moving on.
- If any phase fails or encounters blockers, stop and ask the user for guidance.
- Do not commit at any point — the user will handle commits separately.
