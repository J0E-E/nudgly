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

Once implementation is complete, run the `/epic-code-review` skill against the current changes. Do NOT stop or present findings to the user — immediately proceed to Phase 4.

## Phase 4: Address Review Findings

Using the review output from Phase 3, fix every actionable finding. Re-run relevant tests to confirm fixes. Do not commit. If the review found no issues, proceed directly to Phase 5.

Do NOT pause here — continue to Phase 5 immediately.

## Phase 5: Complete the Epic

Run the `/complete-epic` skill to mark the epic as completed and update implementation notes.

## Important Notes
- Only pause to confirm the build plan in Phase 1. Do NOT pause between any other phases — continue through all phases without stopping.
- If any phase fails or encounters blockers, stop and ask the user for guidance.
- Do not commit at any point — the user will handle commits separately.
