# Nudgly -- My Day Sprint Plan

**Purpose:** Break the My Day feature into small epics with explicit FE and BE components. At the end of each epic, the delivered slice can be built, tested, and validated before proceeding.

**Scope:** Per [nudgly_my_day_v2.md](nudgly_my_day_v2.md). A calm, focused dashboard that balances **Focus** (what you chose to do today) and **Awareness** (what you shouldn't forget).

**Standards:** Unit tests with every change; reuse existing TanStack Query patterns, query key factories, and component conventions. CSS BEM naming. Native `<dialog>` for modals.

---

## Context

The app currently defaults to `/tasks` after login -- a full task list that doesn't distinguish "what matters today" from everything else. The My Day feature introduces a curated daily dashboard showing focus tasks, today's habits, and upcoming reminders with progress tracking and context-aware UX. This brings the app closer to its core philosophy: *"Show just enough to guide, never enough to overwhelm."*

---

## Epic MD-1: Today's Focus -- Data Model & API ✅ COMPLETED

**Objective:** Add the ability to pin tasks to "Today's Focus" with ordering support.

### Backend
- Add two fields to `Task` model (new migration):
  - `focus_date` (`DateField`, nullable, blank, indexed) -- when set to today's date, the task appears in Today's Focus. Yesterday's focus items automatically stop appearing without a cleanup job.
  - `focus_sort_order` (`IntegerField`, default=0) -- controls position within the focus list.
- Add composite index on `(user, focus_date)`.
- Update `TaskPatchSerializer` to accept `focus_date` and `focus_sort_order`.
- Update `task_payload()` to include both new fields in responses.
- New endpoint: `POST /api/tasks/reorder-focus/` accepting `{ ordered_ids: [4, 7, 2] }` -- bulk-updates `focus_sort_order` for all user's focus tasks. Avoids N PATCH calls for drag-reorder.
- Tests: migration, serializer validation, reorder endpoint (ownership, ordering, error cases).

### Frontend
- Update `Task` type in `types/task.ts` with `focus_date: string | null` and `focus_sort_order: number`.
- Update `TaskUpdatePayload` with `focus_date` and `focus_sort_order`.
- Add `reorderFocusTasks(deps, orderedIds)` to `taskApi.ts`.
- Add `useReorderFocusTasks()` hook in `useTasks.ts` with optimistic update.
- No UI changes -- data layer only.

### Dependencies
- None.

### Critical Files
- `backend/core/models.py` -- add fields
- `backend/core/tasks/serializers.py` -- expose fields
- `backend/core/tasks/views.py` -- reorder endpoint
- `frontend/src/types/task.ts` -- type updates
- `frontend/src/services/taskApi.ts` -- reorder API call
- `frontend/src/hooks/useTasks.ts` -- reorder hook

### Implementation Notes:
- **Migration:** `0016_task_focus_date_focus_sort_order` adds both fields and the composite index.
- **Reorder endpoint** uses Django `Case/When` for a single-query bulk update. Ownership is validated by comparing `filter(user=request.user, pk__in=ids).count()` against `len(ordered_ids)` -- this also rejects duplicates since `pk__in` deduplicates.
- **`TaskCreateSerializer` was not updated** -- focus fields are set post-creation via PATCH or the reorder endpoint, not at task creation time. If a future epic needs to create tasks already in focus, add the fields there.
- **No frontend tests exist yet** in this repo. The `useReorderFocusTasks` hook follows the same optimistic update pattern as `useToggleTaskComplete` and was verified via TypeScript compilation. When a test suite is established, add coverage for the reorder hook's optimistic update and rollback.

---

## Epic MD-2: My Day Aggregation Endpoint ✅ COMPLETED

**Objective:** Single backend endpoint returning all My Day data in one request.

### Backend
- New module `backend/core/my_day/` with `views.py`, `urls.py`, `__init__.py`.
- `GET /api/my-day/` (authenticated) returns:
  ```json
  {
    "focus_tasks": [...],
    "habits": [...],
    "upcoming_reminders": [...],
    "metrics": {
      "focus_total": 3,
      "focus_completed": 1,
      "habits_remaining": 2,
      "upcoming_reminder_count": 1
    },
    "tasks_due_today_count": 2
  }
  ```
- `focus_tasks`: tasks where `focus_date=today` (user's timezone), ordered by `focus_sort_order`. Reuse `task_payload()`.
- `habits`: habits where `period_completions < target_count` for current period.
- `upcoming_reminders`: active standalone reminders where `next_trigger_at` is within 24h, ordered ascending, limit 3.
- `tasks_due_today_count`: count of non-focus pending tasks with `due_date=today` (powers "Plan My Day" CTA).
- "Today" computed in user's timezone via `zoneinfo.ZoneInfo(user.timezone)`.
- Register in `api_urls.py`.
- Tests: empty state, mixed data, timezone handling, habit filtering, reminder window.

### Frontend
- New `frontend/src/types/myDay.ts` with `MyDayResponse` interface.
- New `frontend/src/services/myDayApi.ts` with `getMyDay()`.
- New `frontend/src/hooks/useMyDay.ts` with `myDayKeys` factory and `useMyDay()` hook (`staleTime: 60000`, `refetchInterval: 300000`).
- No UI -- data layer only.

### Dependencies
- Epic MD-1 (`focus_date` field must exist).

### Critical Files
- `backend/core/my_day/views.py` -- new endpoint
- `backend/core/api_urls.py` -- register route
- `frontend/src/types/myDay.ts` -- new types
- `frontend/src/services/myDayApi.ts` -- new API service
- `frontend/src/hooks/useMyDay.ts` -- new hook

### Implementation Notes:
- **Habit N+1 queries:** Each habit requires a `count_completions_in_period()` call (one query per habit). Acceptable for typical user habit counts (<20). Matches the pattern in `HabitListCreateView.get()`. If performance becomes an issue, completions can be annotated with a subquery.
- **No shared reminder serializer:** Existing `ReminderAcknowledgeView` returns HTTP 204 with no body, so there is no reusable reminder payload function. `_upcoming_reminder_payload()` is defined inline in `my_day/views.py`, returning a lightweight `{id, name, next_trigger_at, recurrence}` shape from the `ReminderSchedule` → `StandaloneReminder` join.
- **`UpcomingReminder` frontend type:** A new interface rather than reusing `StandaloneReminder`, because the endpoint returns a different field set (schedule's `next_trigger_at` rather than the reminder's `remind_at`).
- **No `freezegun`:** Timezone test uses `unittest.mock.patch("django.utils.timezone.now")` + `patch("core.my_day.views.timezone.now")` since `freezegun` is not a project dependency.

---

## Epic MD-3: My Day Screen -- Core Layout & Focus Section ✅ COMPLETED

**Objective:** Render the My Day screen with header, Today's Focus section, and micro progress bar.

### Backend
- No backend work.

### Frontend
- New `frontend/src/pages/MyDayScreen.tsx` and `MyDayScreen.css` (BEM: `my-day__*`).
- **Header section:**
  - Time-of-day greeting ("Good morning/afternoon/evening") + date ("Monday, March 30").
  - Mini metrics badges: focus progress (1/3), habits remaining (2), reminders (1).
  - All data from `useMyDay()`.
- **Today's Focus section:**
  - Clean list of focus tasks with checkbox completion (reuse `useToggleTaskComplete()`).
  - Each item: title + optional due time + checkbox. Minimal chrome -- no category/priority indicators.
  - "Add to Focus" link (navigates to `/tasks` for now; picker comes in MD-5).
  - Empty state: "No focus tasks yet. What's most important today?"
- **Micro Progress:** "X down, Y to go" text + CSS-only progress bar below focus section.
- New `frontend/src/utils/timeOfDay.ts` with `getTimeOfDay()` and `getGreeting()`.
- Add `/my-day` route in `App.tsx` (wrapped in `ProtectedRoute`). Do NOT change default redirect yet.
- Invalidate `myDayKeys` when tasks are toggled complete.
- Tests: screen renders sections, greeting logic, progress bar states (0%, partial, 100%), empty state.

### Dependencies
- Epic MD-2 (`useMyDay()` hook).

### Critical Files
- `frontend/src/pages/MyDayScreen.tsx` -- new screen
- `frontend/src/pages/MyDayScreen.css` -- new styles
- `frontend/src/utils/timeOfDay.ts` -- new utility
- `frontend/src/App.tsx` -- add route

### Implementation Notes:
- **`useToggleTaskComplete` modified globally:** `onSettled` in `useTasks.ts` now invalidates both `taskKeys.lists()` and `myDayKeys.all`. This means every task toggle (from any screen) triggers a My Day refetch. One-directional import (`useTasks` → `useMyDay`), no circular dependency.
- **Progress bar hidden when `focus_total === 0`:** Rather than showing an empty bar, the entire progress section is conditionally rendered only when focus tasks exist. At 100% completion the text reads "All done!" instead of "0 to go".
- **Checkbox touch targets:** Each checkbox is wrapped in a 44×44px container (`my-day__focus-checkbox-wrap`) matching the `task-list-item-checkbox-wrap` accessibility pattern used elsewhere.
- **`getGreeting` / `getTimeOfDay` accept an optional `Date` parameter** for deterministic testing without mocking `Date`. The component calls them with no argument (uses current time).
- **No `TaskListItem` reuse:** Focus items are rendered inline as simple `<li>` elements (checkbox + title + optional time) rather than reusing `TaskListItem`, which carries expand/collapse, badges, and action buttons that are not wanted here. If MD-5 adds more interactivity (drag handles, remove button), a dedicated `FocusTaskItem` component may be worth extracting.
- **20 tests added:** `timeOfDay.test.ts` (7 tests, boundary hours) and `MyDayScreen.test.tsx` (13 tests, loading/error/greeting/badges/task list/due time/toggle/empty state/progress states/link).

---

## Epic MD-4: My Day Screen -- Habits & Reminders Sections

**Objective:** Add Habits (Quick Wins) and Upcoming Reminders sections with collapsible wrappers and context-aware ordering.

### Backend
- No backend work.

### Frontend
- **Habits section:**
  - Render from `useMyDay().habits` (max 4 visible, "Show all" link to `/habits`).
  - New `frontend/src/components/MyDayHabitItem.tsx` -- simplified: name + subtle streak indicator + quick-complete (+) button.
  - Wire `useCompleteHabit()`. On success, invalidate `myDayKeys` alongside `habitKeys`.
- **Reminders section:**
  - Render from `useMyDay().upcoming_reminders` (max 3).
  - Soft styling: muted color, smaller font, clock icon.
  - New `frontend/src/components/MyDayReminderItem.tsx` -- name + relative time ("In 2 hours").
  - "See all" link to `/reminders`.
- **Collapsible sections:**
  - New `frontend/src/components/CollapsibleSection.tsx` -- title, count badge, expand/collapse toggle with CSS transition. Stores collapsed state in `localStorage` per section key.
  - Wrap Habits and Reminders in `CollapsibleSection`. Focus is NOT collapsible.
- **Context-aware ordering:**
  - Morning: Focus, Habits, Reminders.
  - Afternoon: Focus, Reminders, Habits.
  - Evening: Focus (completed summary), Habits, Reminders.
  - Frontend-only logic using `getTimeOfDay()`.
- **Gentle nudge banner:**
  - New `frontend/src/utils/nudgeCopy.ts` with `getNudgeMessage(metrics, timeOfDay)`.
  - Examples: "Quick win? Complete a habit!", "Almost done -- just X left", "All caught up!"
- Tests: habit completion from My Day, collapsible toggle, context ordering, nudge copy selection.

### Dependencies
- Epic MD-3 (screen shell must exist).

### Critical Files
- `frontend/src/pages/MyDayScreen.tsx` -- add sections
- `frontend/src/components/MyDayHabitItem.tsx` -- new
- `frontend/src/components/MyDayReminderItem.tsx` -- new
- `frontend/src/components/CollapsibleSection.tsx` -- new
- `frontend/src/utils/nudgeCopy.ts` -- new

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic MD-5: Focus Task Management (Drag Reorder & Focus Picker)

**Objective:** Reorder focus tasks via drag-and-drop; add/remove tasks from focus via a picker dialog.

### Backend
- No backend work (reorder and PATCH APIs exist from MD-1).

### Frontend
- **Drag-and-drop reorder:**
  - HTML Drag and Drop API (no library) with touch event fallback for mobile.
  - New `frontend/src/hooks/useDragReorder.ts` custom hook.
  - On drop, call `useReorderFocusTasks()` with optimistic update.
  - Drag handle icon on each focus task. CSS for placeholder/drop-target indicators.
- **Focus picker dialog:**
  - New `frontend/src/components/FocusPickerDialog.tsx` (native `<dialog>`).
  - Shows pending tasks via `useTaskList({ status: 'pending' })`.
  - Toggle to add/remove from focus (PATCHes `focus_date` to today or null).
  - Search/filter (reuse pattern from `TaskFilterBar`).
  - Limit: 5 focus tasks max. When at limit, disable adding + show message ("Focus works best with 3-5 tasks").
  - "Add to Focus" button on My Day screen opens this dialog.
- **Remove from focus:** (x) icon on each focus task that PATCHes `focus_date` to null.
- Invalidate `myDayKeys` and `taskKeys` on all focus mutations.
- Tests: drag reorder, picker open/close, add/remove from focus, 5-task limit.

### Dependencies
- Epic MD-3 (Focus section UI).

### Critical Files
- `frontend/src/components/FocusPickerDialog.tsx` -- new
- `frontend/src/hooks/useDragReorder.ts` -- new
- `frontend/src/pages/MyDayScreen.tsx` -- wire picker + reorder

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Epic MD-6: Navigation Update & Plan My Day CTA

**Objective:** Make My Day the home screen, update navigation, and add the Plan My Day call-to-action.

### Backend
- No backend work (or minimal: `tasks_due_today_count` already in MD-2 response).

### Frontend
- **Navigation update:**
  - `LandingScreen.tsx`: change redirect from `/tasks` to `/my-day`.
  - `BottomNav.tsx`: add "My Day" as first nav item (sun/home icon). Keep Tasks, Lists, Habits, Reminders.
  - Update `AppHeader.tsx` if any home link references exist.
- **Plan My Day CTA** at bottom of `MyDayScreen.tsx`:
  - Shown when no focus tasks, or all focus tasks complete.
  - Context-aware: "You have 3 tasks due today -- want to focus on them?" / "Pick your top priorities" / "Great day! All done."
  - CTA button opens Focus Picker from MD-5.
- **Polish:**
  - Progress bar animation on completion.
  - Celebration micro-interaction when all focus tasks complete (CSS checkmark pulse or confetti).
  - Smooth section transitions.
- Tests: nav renders My Day link, LandingScreen redirects to `/my-day`, CTA visibility logic.

### Dependencies
- Epic MD-5 (FocusPickerDialog for CTA).

### Critical Files
- `frontend/src/pages/LandingScreen.tsx` -- redirect change
- `frontend/src/components/BottomNav.tsx` -- add My Day item
- `frontend/src/pages/MyDayScreen.tsx` -- CTA section + polish

### Implementation Notes:
*(To be completed when epic is done.)*

---

## Sprint Order

| Order | Epic | Scope | BE | FE | Rationale |
|-------|------|-------|----|----|-----------|
| MD-1 | Focus data model + reorder API | Yes | Types/hooks only | Foundation data model |
| MD-2 | Aggregation endpoint | Yes | Types/hooks only | Single-request data loading |
| MD-3 | Core layout + Focus UI | No | Yes | Primary screen shell |
| MD-4 | Habits & Reminders sections | No | Yes | Secondary sections (parallel with MD-5) |
| MD-5 | Drag reorder + Focus picker | No | Yes | Focus interactivity (parallel with MD-4) |
| MD-6 | Navigation + Plan My Day CTA | No | Yes | Final integration + polish |

> MD-4 and MD-5 can be built in parallel -- they modify different parts of the My Day screen.

---

## Key Design Decisions

1. **`focus_date` on Task (not a separate model):** A `DateField` is simpler than a `FocusItem` join table. Setting it to today marks the task as focused; querying `WHERE focus_date = today` retrieves the list. Yesterday's items automatically fall off without a cleanup job.

2. **Aggregation endpoint:** `GET /api/my-day/` avoids 3-4 separate API calls. Returns pre-filtered, pre-sorted data in the user's timezone.

3. **Time-of-day logic is frontend-only:** The device clock determines morning/afternoon/evening. No backend involvement -- the user's device time reflects their current experience.

4. **Drag-and-drop without a library:** HTML Drag and Drop API + touch fallback keeps the bundle small. If insufficient, `@dnd-kit/core` (~8KB) is the recommended swap.

5. **Navigation change is last (MD-6):** My Day becomes home only after all sections are built and tested.

---

## Verification

After all epics are complete:
1. **Login flow:** Authenticate -> lands on `/my-day` (not `/tasks`).
2. **Focus tasks:** Add 3-5 tasks to focus via picker -> see them on My Day -> reorder via drag -> complete via checkbox -> progress bar updates.
3. **Habits:** See incomplete habits -> quick-complete (+) -> count decrements -> "All caught up" nudge appears.
4. **Reminders:** See upcoming reminders with relative times -> navigate to `/reminders` via "See all".
5. **Time-of-day:** Test at different hours -> greeting changes, section order shifts.
6. **Empty state:** New user with no data -> sees Plan My Day CTA -> opens picker.
7. **Bottom nav:** My Day icon active on `/my-day`, navigation to all other screens works.
