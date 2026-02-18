# Ghost — Design & Layout Overhaul Proposals

> **Target devices:** iPhone 15, iPad 9th gen, MacBook Air M1, Desktop Win 11 4K 29"
> Pick the items you want (by number). I'll implement your selections.

---

## 🔴 Tier 1 — High Impact (Layout & Spacing)

### 1. Content area feels lost on large screens
The main content column is narrow (`max-w-860px`) with massive gutters on 4K. On the other end, it's cramped on mobile.
- **Fix:** Use a fluid `max-w-[clamp(600px, 70%, 1400px)]` content width that scales elegantly across all breakpoints. Add more generous padding on tablet/desktop.

### 2. Sidebar needs more visual weight & hierarchy
Sidebar blends into the background — no clear user identity section, no visual logo, navigation items are small and plain.
- **Fix:** Redesign sidebar with:
  - Larger branding area with a subtle gradient or accent line
  - User avatar/initials circle instead of raw email text
  - Clearer section separators (nav / quick actions / user)
  - Slightly wider sidebar on large screens

### 3. Task list items are too flat / generic
Task rows look identical — no visual differentiation between tasks. Hard to quickly scan titles vs. metadata.
- **Fix:** Redesign [TaskItem](file:///c:/Users/nando/Documents/GitHub/personal/ghost/src/components/TaskItem.tsx#27-37) with:
  - Subtle left-border color indicator (using project color or priority)
  - Better typographic hierarchy — larger title, smaller but clearer metadata row
  - Hover state with a soft surface lift effect, not just opacity
  - More breathing room between items (`gap-2` → `gap-3`)

### 4. Project cards lack personality
Cards are dark boxes with text. No visual identity apart from a tiny color dot.
- **Fix:** Redesign [ProjectCard](file:///c:/Users/nando/Documents/GitHub/personal/ghost/src/pages/Projects.tsx#152-230) with:
  - A colored accent bar or gradient header strip using the project color
  - Better stat layout (visual progress ring instead of / alongside the bar)
  - Larger, bolder project name
  - Card min-height so they align in the grid

---

## 🟡 Tier 2 — Medium Impact (Visual Polish)

### 5. Progress bar on Today is too thin & lacks context
The 2px thin bar is barely visible on 4K. No motivational cues.
- **Fix:** Thicker bar (`h-3`), pill-shaped ends, and show the percentage number inline. Add a subtle gradient to the fill (accent → lighter shade). Show a celebratory state when 100% done (confetti animation or checkmark icon).

### 6. Filter pills on Tasks page look cluttered
ALL/ANY filter groups are visually homogeneous — hard to distinguish categories (status vs. location vs. energy).
- **Fix:** Add subtle category dividers or labels above each filter group. Use a more refined pill design with softer backgrounds. Show active filter count badge.

### 7. TaskDetail side panel feels utilitarian
The detail panel is functional but stark. Form fields have inconsistent spacing and the header is cramped.
- **Fix:** Redesign with:
  - More spacious header with a checklist-style completion animation
  - Card-style sections (Project, Schedule, Context) instead of flat rows
  - Visual section icons next to labels
  - Improved notes area with a richer placeholder

### 8. Empty states need more life
Current empty states are okay but static. The decorative dots feel random.
- **Fix:** Add a gentle floating/breathing animation to the main icon. Use contextual illustrations or a subtle gradient mesh behind the empty state area.

### 9. Color system needs a secondary accent
Everything uses the same `#7c6aff` purple for all interactions (buttons, active states, pills, progress, links). This creates "accent fatigue".
- **Fix:** Introduce a warm secondary accent (amber/gold) for:
  - Today star / schedule elements
  - Success states and completions
  - Keep purple for primary actions (buttons, navigation)

---

## 🟢 Tier 3 — Polish & Delight

### 10. Add a greeting/contextual header to Today
Today page just says "Today" + date. It could be more personal.
- **Fix:** Time-based greeting ("Good morning, Nando") based on the hour of day, with a subtle emoji. Optional: show a motivational micro-copy when all tasks are done.

### 11. Mobile bottom nav lacks visual distinction
Tab icons are small and share the same monotone style.
- **Fix:** Active tab gets a filled icon variant + subtle dot indicator or background pill. Add a centered FAB button for "New Task" directly in the tab bar.

### 12. Modals (TaskForm, ProjectForm) need a backdrop blur upgrade
Current modals are functional but don't feel "premium".
- **Fix:** Unified modal component with:
  - Stronger backdrop blur
  - Entrance animation (scale + fade from slight below)
  - Header accent line matching the action context
  - More spacious internal padding

### 13. Add subtle texture/noise to surface backgrounds
The flat `#161616` surfaces feel too uniform on large screens.
- **Fix:** Add an extremely subtle CSS noise texture (via SVG filter or tiny repeating pattern) to the background layer. This adds perceived depth without performance cost.

### 14. Typography scale needs a bolder headline treatment
Page titles (Today, Tasks, Projects) are bold but feel standard.
- **Fix:** Use a tighter tracking (`-0.03em`), heavier weight (800/900 or a display font weight), and slightly larger sizing. Consider adding a subtle text gradient to page titles for a premium feel.

### 15. Improve scrollbar and overflow handling on iPad
iPad landscape has an awkward mid-point between mobile and desktop layout. The sidebar may not be visible while the content area is still narrow.
- **Fix:** Tailwind [md](file:///c:/Users/nando/Documents/GitHub/personal/ghost/GEMINI.md) breakpoint is 768px. iPad 9th gen is exactly 810px wide in landscape. Ensure the sidebar is properly visible and content doesn't overflow at this breakpoint. Add a tablet-specific layout adjustment.

---

## 🔵 Tier 4 — Micro-Interactions & Animations

### 16. Stagger task list entrance animation
When opening Today or Tasks, all items appear simultaneously.
- **Fix:** Stagger each [TaskItem](file:///c:/Users/nando/Documents/GitHub/personal/ghost/src/components/TaskItem.tsx#27-37) entrance by 30–50ms for a cascade/waterfall effect.

### 17. Checkbox completion animation
Current checkbox toggle is instant. No reward feedback.
- **Fix:** Add a brief "pop + rings" animation when completing a task — a radial pulse originating from the checkbox circle, plus a smooth check-draw SVG path animation.

### 18. Skeleton loading states
Current loading is a simple spinner. It feels like the app is "empty".
- **Fix:** Replace spinner with shimmer/skeleton placeholders matching the shape of task items and project cards. This makes load times feel faster.

### 19. Page transition improvements
Current fade-in is subtle. Page changes feel slightly flat.
- **Fix:** Use a shared layout animation concept — outgoing page fades up while incoming fades in from below. Optionally, make the sidebar active indicator animate smoothly between items (e.g., a sliding highlight).

---

## Summary — Quick Pick

| # | Proposal | Impact |
|---|----------|--------|
| 1 | Fluid content width | 🔴 High |
| 2 | Sidebar visual redesign | 🔴 High |
| 3 | TaskItem visual redesign | 🔴 High |
| 4 | Project card redesign | 🔴 High |
| 5 | Progress bar upgrade | 🟡 Medium |
| 6 | Filter pills cleanup | 🟡 Medium |
| 7 | TaskDetail panel redesign | 🟡 Medium |
| 8 | Better empty states | 🟡 Medium |
| 9 | Secondary color accent | 🟡 Medium |
| 10 | Contextual greeting | 🟢 Polish |
| 11 | Mobile bottom nav upgrade | 🟢 Polish |
| 12 | Premium modal design | 🟢 Polish |
| 13 | Subtle noise texture | 🟢 Polish |
| 14 | Bolder headline typography | 🟢 Polish |
| 15 | iPad layout fix | 🟢 Polish |
| 16 | Staggered list animation | 🔵 Micro |
| 17 | Checkbox completion anim | 🔵 Micro |
| 18 | Skeleton loading states | 🔵 Micro |
| 19 | Page transition upgrade | 🔵 Micro |

> Reply with the numbers you want (e.g., "1, 3, 5, 10, 16") and I'll start implementing.
