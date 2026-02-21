# Task Time Tracking System - Implementation Phases (Agent Runbook)

## 1. Goal
Build a robust time tracking system for tasks that supports:
- quick start/stop timer per task,
- clear visibility into focused time spent,
- a dedicated Analytics tab with time reports.

This document is for implementation agents. It is a delivery plan, not code.

## 2. Product Requirements

### Core requirements
- User can start a timer from any task in 1 click/tap.
- User can stop the active timer in 1 click/tap.
- Exactly one active timer per user at a time.
- User can see elapsed time on the active task in real time.
- User can see accumulated focused time for each task.
- User can open a new `Analytics` tab/page and review time reports by date range.

### Robustness requirements
- Survive refresh/tab close/reopen without losing active session state.
- Prevent duplicate active sessions caused by multi-tab usage.
- Handle offline transitions with safe reconciliation once online.
- Keep DB writes and reads efficient at scale.
- Enforce RLS and per-user isolation in all tracking tables.

### Non-goals (Phase 1 release)
- No billing/invoice time export.
- No team/shared timers.
- No AI auto-classification of sessions.

## 3. System Design (High Level)

### Data model strategy
Use session-based tracking:
- one row per focus session with `started_at`, `ended_at`, `duration_seconds`.
- active timer = session row with `ended_at IS NULL`.

This keeps history auditable, easy to aggregate, and safe for analytics.

### Primary entities
- `task_time_sessions` (new): immutable-ish session records with close/update rules.
- `task_time_daily_rollups` (new view or materialized view, optional in later phase).

### Key invariants
- At most one open session (`ended_at IS NULL`) per `user_id`.
- `ended_at > started_at` when closed.
- `duration_seconds >= 1` when closed.
- Session belongs to same user as linked task.

## 4. Proposed Database Changes

Create migration file: `scripts/sql/2026-02-20_task_time_tracking.sql`

### Table: `public.task_time_sessions`
Recommended columns:
- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `task_id uuid not null references public.tasks(id) on delete cascade`
- `started_at timestamptz not null default now()`
- `ended_at timestamptz null`
- `duration_seconds integer null`
- `source text not null default 'manual'` (values like `manual`, `focus_mode`, `recovered`)
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### Constraints and indexes
- Check constraint: `ended_at is null or ended_at > started_at`
- Check constraint: `duration_seconds is null or duration_seconds >= 1`
- Partial unique index to enforce one active timer per user:
  - unique on `(user_id)` where `ended_at is null`
- Read indexes:
  - `(user_id, started_at desc)`
  - `(user_id, task_id, started_at desc)`

### RLS and grants
Mirror existing patterns used in `project_categories` migration:
- Enable RLS.
- Policies for `select/insert/update/delete` scoped to `auth.uid() = user_id`.
- Restrict update policy to allow edits only on user's own rows.

### Optional DB helpers
- SQL function: `stop_active_task_timer(p_user_id uuid, p_stopped_at timestamptz default now())`
- SQL view: `task_time_daily_rollups` grouped by user/day/task/project for analytics reads.

## 5. Frontend Architecture Changes

### New domain module
Create `src/lib/timeTracking.ts` with pure API wrappers:
- `getActiveSession(userId)`
- `startSession(taskId, opts?)`
- `stopActiveSession(opts?)`
- `stopSession(sessionId, opts?)`
- `listSessionsByRange(range)`
- `getAnalytics(range, grouping)`

Behavior rules:
- Starting a new session should stop existing active session first (same user).
- Closing a session computes `duration_seconds` from server timestamps.
- Use optimistic UI, then reconcile with server response.

### New context/provider
Create `src/context/TimerContext.tsx`:
- State: `activeSession`, `elapsedSeconds`, `isSyncing`, `lastError`.
- Actions: `startTimer(taskId)`, `stopTimer()`, `toggleTimer(taskId)`, `refreshActiveTimer()`.
- Tick every 1 second for elapsed display.
- Persist active session snapshot in `localStorage` for quick restore.

### App wiring
- Wrap app tree with `TimerProvider` in `src/App.tsx` near existing providers.

## 6. UX Changes

### Task list quick controls
Update `src/components/TaskItem.tsx`:
- Add start/stop timer button in action area.
- Active task shows live elapsed badge (e.g., `01:12:09`).
- Disable start for completed tasks.
- Clicking start on another task auto-stops previous active timer and starts new one.

### Today page focus signal
Update `src/pages/Today.tsx`:
- Add small summary card: `Focused today: Xh Ym`.
- Optional quick action: `Stop Active Timer` if running.

### Focus mode integration
Update `src/components/FocusMode.tsx`:
- Add explicit timer controls inside focus mode.
- On entering focus mode, do not auto-start silently; require user tap for clarity.
- On completion, optionally prompt: `Stop timer and mark complete`.

### Keyboard shortcuts
Update `src/hooks/useKeyboardShortcuts.ts`:
- Add `g + r` (or `g + y`) to navigate to analytics route.
- Add shortcut for stopping active timer (example: `Shift+S`) if no input focused.

## 7. Analytics Tab Design

### Routing + nav
- Add lazy route in `src/App.tsx`: `/analytics`.
- Add nav item in `src/components/Layout.tsx`: `Analytics` with icon.

### New page
Create `src/pages/Analytics.tsx` with:
- Date range selector: `7d`, `30d`, `90d`, custom.
- KPI strip:
  - Total focused time
  - Total sessions
  - Average session length
  - Most focused project
- Charts/tables:
  - Daily focus time trend (bar/line)
  - Top tasks by focused time
  - Top projects by focused time
  - Session distribution by hour-of-day (optional)

### Data shaping
- Prefer server-side grouped queries if performant.
- If using client aggregation, cap raw row fetch and paginate by date window.

## 8. Offline and Multi-Tab Reliability

### Multi-tab coordination
- Use `BroadcastChannel('ghost-timer')` to notify timer start/stop events across tabs.
- On receiving event, refresh active session state.

### Offline behavior
- If start/stop fails due to network:
  - keep pending action queue in `localStorage` (`ghost.timer.queue`).
  - retry on reconnect (`window.online` event).
- Show non-blocking toast on delayed sync.

### App restore
- On boot, hydrate from server first.
- If server unavailable, fallback to local cached active session to keep UX responsive.

## 9. Phase-by-Phase Execution Plan

## Phase 0 - Discovery and contract
Objective: Align on UX behavior and schema contract before coding.

Decision record:
- See `docs/adr/2026-02-20-time-tracking-phase-0-contract.md` for accepted timer semantics, KPI definitions, and range rules.

Deliverables:
- Finalized timer rules (single active timer, auto-stop semantics).
- Confirmed analytics KPIs and date presets.
- Published ADR with no unresolved policy items.

Files to touch:
- This doc only (or a short ADR file).

Acceptance criteria:
- No unresolved decisions blocking Phase 1.
- Phase 1+ agents treat ADR as canonical for behavior and reporting logic.

## Phase 1 - Database and security foundation
Objective: Introduce durable session storage with strong constraints.

Deliverables:
- Migration SQL in `scripts/sql/2026-02-20_task_time_tracking.sql`.
- RLS policies + indexes + optional helper function.

Acceptance criteria:
- Can insert/start session for own task.
- Cannot read or modify another user's session.
- Unique active session constraint prevents duplicate active timers.

## Phase 2 - Timer domain layer and provider
Objective: Implement canonical timer state/actions with reconciliation.

Deliverables:
- `src/lib/timeTracking.ts`
- `src/context/TimerContext.tsx`
- Provider wired in `src/App.tsx`

Acceptance criteria:
- Start/stop works from any page.
- Refresh keeps active timer state.
- Cross-tab updates sync within 1-2 seconds.

## Phase 3 - Task-level quick controls
Objective: Add fast start/stop controls directly on tasks.

Deliverables:
- `src/components/TaskItem.tsx` updates.
- `src/pages/Today.tsx` focused time summary.
- Optional focus mode timer controls in `src/components/FocusMode.tsx`.

Acceptance criteria:
- User can start and stop timer in 1 click.
- Active session elapsed updates every second.
- Starting task B while task A active switches cleanly.

## Phase 4 - Analytics tab
Objective: Ship reporting interface for focused time insights.

Deliverables:
- New page `src/pages/Analytics.tsx`.
- Route registration in `src/App.tsx`.
- Nav item in `src/components/Layout.tsx`.
- Aggregation/query helpers in timer domain module.

Acceptance criteria:
- Reports render for all presets (`7d`, `30d`, `90d`).
- KPI totals match source session data.
- Empty state and loading state handled cleanly.

## Phase 5 - QA hardening and rollout
Objective: Validate edge cases and prepare safe release.

Deliverables:
- Manual QA checklist execution.
- Lint/build pass.
- Regression checks for existing task flows.

Acceptance criteria:
- No crash on route transitions with active timer.
- Offline start/stop queue recovers after reconnect.
- App remains responsive with large session history.

## 10. Suggested Task Split Across Agents

- Agent A: Phase 1 (SQL, constraints, RLS).
- Agent B: Phase 2 (domain + provider state machine).
- Agent C: Phase 3 (TaskItem/Today/FocusMode UX).
- Agent D: Phase 4 (Analytics page + route/nav).
- Agent E: Phase 5 (QA, bug bash, final polish).

Execution order:
1. Agent A first.
2. Agent B starts after schema is merged.
3. Agents C and D can run in parallel after B baseline API is stable.
4. Agent E runs after C and D merge.

## 11. QA Matrix (Must Pass)

Functional:
- Start timer from task list.
- Stop active timer from task list.
- Switch active timer between two tasks.
- Refresh browser while timer running.
- Close/reopen tab while timer running.
- Navigate between pages while timer running.
- Analytics numbers reflect started/stopped sessions.

Edge cases:
- Start timer on completed task (should block).
- Two tabs start timer simultaneously (single active timer preserved).
- Offline start then reconnect.
- Offline stop then reconnect.
- Clock drift between client and server (server timestamps win).

Security:
- User A cannot query User B session rows.
- User A cannot insert session for User B task.

Performance:
- Analytics query for 90 days returns quickly.
- No N+1 fetch pattern for tasks/projects in analytics.

## 12. Risks and Mitigations

- Risk: duplicate active sessions due to race conditions.
  - Mitigation: DB partial unique index + transactional start/stop flow.

- Risk: stale timer UI after network blips.
  - Mitigation: periodic revalidation and reconnect sync.

- Risk: analytics mismatch from client-side calculations.
  - Mitigation: derive core totals from DB grouped query/view.

- Risk: UI clutter on task rows.
  - Mitigation: keep timer control compact and hide secondary text on small screens.

## 13. Definition of Done
A release is done when:
- timer start/stop is fast and reliable,
- focused time totals are visible at task + page + analytics levels,
- analytics tab is accessible and accurate,
- single active timer invariant is enforced by database,
- QA matrix passes and build/lint are clean.
