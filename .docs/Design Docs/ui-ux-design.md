# Nudgly – UI/UX Design Document

**Project:** Nudgly  
**Type:** UI/UX design specification  
**Date:** 2026-03-09  

---

# 1. Design Approach

## 1.1 Visual Style

- **Clean / flat web design.** No skeuomorphism, gradients, or heavy shadows. Use flat color fills, clear hierarchy, and ample whitespace.
- **Intent-revealing UI.** Labels, icons, and layout should make actions and content purpose obvious.
- **Consistent patterns.** Same interaction patterns (e.g. add, filter, delete) reused across Tasks, Lists, and Habits where applicable.

## 1.2 Theme System

- The app supports a **user-selectable theme** that drives the global color palette.
- Themes are **hue-based**: same saturation and lightness, with **hue** adjusted to produce Red, Orange, Yellow, Green, Blue, Violet, and Turquoise variants.
- All theme palettes use **muted** colors (moderate saturation) for comfort and reduced visual noise, aligned with an ADHD-friendly, low-overwhelm experience.

---

# 2. Color Palettes

Palettes are defined with a fixed **saturation** and **lightness**; only **hue** changes per theme. Values below use HSL for specification; implement in CSS/design tokens as needed (hex or HSL).

**Base parameters (muted):**
- **Saturation:** ~35–45% (muted)
- **Lightness:** tuned per role (background lighter, accent slightly more saturated for emphasis)

## 2.1 Palette Structure (Per Theme)

Each theme provides:

| Role | Purpose |
|------|--------|
| **Primary** | Main brand/accent (buttons, links, selected state) |
| **Primary muted** | Softer accent (hover, secondary actions) |
| **Surface** | Main content background |
| **Surface elevated** | Cards, modals, dropdowns |
| **Border** | Dividers, input borders |
| **Text primary** | Body and headings |
| **Text secondary** | Hints, captions, metadata |
| **Success** | Complete, success states (can be theme hue or fixed green) |
| **Warning** | Caution, overdue (optional; fixed or theme) |
| **Destructive** | Delete, destructive actions (fixed red for consistency) |

## 2.2 Hue-Based Palettes (ROYGBV + Turquoise)

All palettes use the same saturation/lightness rules; only the **base hue** changes.

| Theme | Base hue (HSL) | Use case |
|-------|----------------|----------|
| **Red** | ~0° | Bold, high-energy |
| **Orange** | ~30° | Warm, active |
| **Yellow** | ~50° | Bright, optimistic |
| **Green** | ~140° | Calm, growth, completion |
| **Blue** | ~210° | Trust, focus |
| **Violet** | ~270° | Creative, distinct |
| **Turquoise** | ~175° | Fresh, balanced |

### Example token set (Blue theme)

- Primary: `hsl(210, 40%, 45%)`
- Primary muted: `hsl(210, 35%, 55%)`
- Surface: `hsl(210, 15%, 98%)`
- Surface elevated: `hsl(210, 12%, 100%)`
- Border: `hsl(210, 18%, 88%)`
- Text primary: `hsl(210, 25%, 15%)`
- Text secondary: `hsl(210, 15%, 45%)`
- Success: `hsl(140, 40%, 42%)` (or fixed)
- Destructive: `hsl(0, 55%, 48%)` (fixed across themes)

*Implementation note:* Define one set of roles (e.g. in CSS variables or a theme object) and, per theme, assign hue values from the table above while keeping saturation and lightness consistent.

## 2.3 Palette List (Quick Reference)

| Theme | Primary hue | Primary muted | Surface | Border | Text primary |
|-------|-------------|---------------|---------|--------|--------------|
| Red | 0° | 0° | 0° (low sat) | 0° | 0° |
| Orange | 30° | 30° | 30° | 30° | 30° |
| Yellow | 50° | 50° | 50° | 50° | 50° |
| Green | 140° | 140° | 140° | 140° | 140° |
| Blue | 210° | 210° | 210° | 210° | 210° |
| Violet | 270° | 270° | 270° | 270° | 270° |
| Turquoise | 175° | 175° | 175° | 175° | 175° |

Success and destructive colors may be fixed (e.g. green and red) for consistent semantics across themes.

---

# 3. Design Scheme

## 3.1 Typography

- **Font stack:** System fonts or one clean sans-serif (e.g. system-ui, -apple-system, Segoe UI, Roboto) for performance and readability.
- **Hierarchy:** Clear distinction between page title, section headers, list/item titles, and body/captions. Use size and weight, not color alone.
- **Line height:** Generous (e.g. 1.4–1.5) for body text to reduce cognitive load.

## 3.2 Spacing & Layout

- **Consistent spacing scale** (e.g. 4px base: 4, 8, 12, 16, 24, 32, 48).
- **Content width:** Max-width on large screens to keep line length readable; full width within that for lists/cards.
- **Touch targets:** Minimum 44px height for interactive elements on mobile.

## 3.3 Components (Flat)

- **Buttons:** Flat fill, clear label or icon; primary vs secondary vs ghost by color role.
- **Inputs:** Flat borders, no heavy shadows; focus state with border or outline in primary.
- **Cards / list rows:** Subtle border or background difference from surface; no drop shadows or minimal (e.g. 1px).
- **Icons:** Simple, consistent stroke/style (e.g. 24px default); same style for nav and actions.
- **Component approach:** Use a shared component library or custom components as the team prefers; keep styling consistent with this design scheme.

## 3.4 Motion & Feedback

- **Minimal animation:** Short transitions (e.g. 150–250ms) for state changes (expand/collapse, nav switch). Avoid decorative motion that could distract.
- **Feedback:** Clear feedback on tap (e.g. checkbox check, delete confirmation) so the user never doubts the outcome.

## 3.5 UI States

- **Empty:** When there are no tasks, lists, or habits, show a clear empty state (e.g. short message + primary action to add the first item). Avoid blank space with no guidance.
- **Loading:** Show a loading indicator (e.g. skeleton or spinner) while data is fetched; avoid layout shift where possible.
- **Error:** On load or action failure, show a clear error message and a retry or recovery action where applicable.

---

# 4. Responsive Layout

## 4.1 Global Structure

- **Three regions:**
  1. **Header (top):** Always visible. App name/logo, global actions (e.g. account/settings access).
  2. **Center (main content):** Scrollable; shows Tasks, Lists, or Habits depending on section.
  3. **Footer (bottom):** Always visible on mobile; contains primary navigation.

- **Desktop:** Footer nav may become a side nav or top tab bar; header and center behavior remain. Center area scrolls independently when content overflows.

## 4.2 Mobile-First Behavior

- **One section at a time:** On mobile, only one of **Tasks**, **Lists**, or **Habits** is visible in the center at once.
- **Navigation:** A **persistent bottom bar** with three items: Tasks | Lists | Habits. Tapping a item replaces the center panel with that section’s view (no nested full-screen stack for the main three; list drill-down is within the Lists section).
- **Header and footer:** Always visible (sticky top and sticky bottom). Center content scrolls between them.
- **No horizontal scroll** for main layout; only intentional horizontal gestures (e.g. swipe to delete) where specified.

---

# 5. Screen Specifications

## 5.1 Tasks Screen

- **Purpose:** List the user’s tasks (default “Tasks” list; i.e. `list_id` null or virtual Tasks list).
- **Top bar (within center or below header):**
  - **Search:** Text input to filter tasks by title/notes.
  - **Filter:** Control for category, priority, tag, due date, etc., as per app-idea.
  - **Add:** Button or FAB to create a new task.
- **List:**
  - Each row: checkbox (check-off to complete), task title, optional due date/priority/category indicators.
  - **Check-off:** Tapping the checkbox marks task complete (and archives to completed); state updates immediately with clear feedback.
  - **Swipe / drag right to delete:** Dragging a row to the right reveals a delete affordance (e.g. red area or trash icon). Releasing triggers **delete confirmation** (modal or inline “Undo” + “Delete”); deletion is committed only after confirmation. Canceling returns the row.
- **Scrolling:** List scrolls within the center area; header and bottom nav remain fixed.

## 5.2 Lists Screen

- **Default view:** List of lists. Same pattern as Tasks for **search, filter, and add** at the top (search/filter by list name, category, etc.; add = new list).
- **Drill-down:** Tapping a list opens that list’s detail view within the same section (e.g. back button or breadcrumb to return to “List of lists”).
- **List detail view:**
  - **Header:** List name; optional list-level actions (edit list, mute, archive, delete with confirmation).
  - **Content:** List items (tasks in that list). Each item is check-off-able; optional inline edit (e.g. tap to edit title/notes).
  - **Bottom:** A **text box** plus **“Add”** button. User types an item and taps Add to append; can repeat in succession. New items get list-level category/tag/priority by default.
  - **Per-item settings:** Each list item has an **edit** action. In edit mode, the user can set **item-level** fields that may differ from the list (e.g. category, priority, notes), as per app-idea.
- **Scrolling:** List of lists and list-detail content scroll in the center; header and bottom nav stay visible.

## 5.3 Habits Screen

- **Purpose:** List habits and support quick increment + streak visibility.
- **Layout:** List of habits. Each row (or card) shows:
  - Habit name.
  - **Streak count** (e.g. “7 day streak” or “3/7 this week” depending on target frequency).
  - **Increment action:** Control (e.g. “Done” or “+” button) to log completion for today/current period.
- **Top:** Search/filter/add (add = new habit) consistent with Tasks and Lists.
- **Optional:** Tap habit to view history or edit (reminder times, target frequency, etc.).
- **Scrolling:** Habit list scrolls in the center; header and bottom nav fixed.

## 5.4 Friends & Invites

- **Purpose:** Manage friends and invitations (invite by email/username, accept/decline, remove friend); support linking friends to tasks and creating tasks for friends (see app-idea §4).
- **Access:** From the header or Settings (e.g. “Friends” link). Alternatively a fourth nav item if the product prefers; otherwise a dedicated Friends view reachable from header or settings.
- **Content:** List of friends; sent and received invitations (pending, accepted, declined). Actions: invite (enter email/username), accept/decline invite, remove friend. When creating or editing a task, allow attaching friends (link friends to task) and optionally creating a task for a friend (task appears in friend’s list).
- **Consistency:** Same empty/loading/error and confirmation patterns as Tasks, Lists, Habits (e.g. confirm before removing a friend).

## 5.5 Account & Settings

- **Access:** From the header (e.g. profile icon or “Settings” link). Available from every section.
- **Contents:**
  - **Theme:** User-selectable theme (Red, Orange, Yellow, Green, Blue, Violet, Turquoise). Selection applies the corresponding palette immediately.
  - **Account:** Profile, email, password change, logout (per app-idea account requirements).
  - **Preferences:** Timezone, notification preferences, etc., as needed for MVP.
- **Layout:** Dedicated settings view (full center panel or modal); no change to global header/footer visibility.

---

# 6. Interaction Summary

| Area | Key interactions |
|------|------------------|
| **Navigation** | Bottom bar: Tasks / Lists / Habits. One section visible at a time on mobile; center panel swaps. |
| **Tasks** | Search, filter, add. Check-off to complete. Drag right to delete → confirm. |
| **Lists** | List of lists: search, filter, add. Drill into list → add items via text box + Add; edit item for per-item settings. |
| **Habits** | List habits; increment (e.g. Done); show streak. Search, filter, add habit. |
| **Friends** | Invite, accept/decline, list friends, remove; link friends to tasks; create task for friend. |
| **Settings** | Header entry → theme picker (ROYGBV + Turquoise), account, preferences. |

---

# 7. Accessibility & Consistency

- **Target:** WCAG 2.1 Level AA where applicable (contrast, focus, labels, structure).
- **Focus order:** Keyboard and screen-reader order match visual order; focus visible in theme primary.
- **Color:** Don’t rely on color alone for state (e.g. completed = strikethrough + icon + color).
- **Confirmation:** All destructive actions (e.g. delete task, delete list) require explicit confirmation before applying.
- **Naming:** Use the same terms as the product (Tasks, Lists, Habits) and app-idea (category, priority, mute, etc.) so UI and docs stay aligned.

---

*This document should be updated when new screens, themes, or interaction patterns are added. Implementation can reference it for layout, tokens, and behavior.*
