# ADR-2026-02-20: Time Tracking Phase 0 Contract

## Status
Accepted

## Date
2026-02-20

## Context
The project needs a robust task time-tracking system with quick start/stop actions and an Analytics tab. Before implementation phases, we need concrete product and technical contracts so multiple agents can work in parallel without ambiguity.

## Decisions

### D1. Active timer model
- The system uses session rows (`task_time_sessions`) with `started_at`, `ended_at`, `duration_seconds`.
- Active timer is the single row with `ended_at IS NULL` for a user.
- Exactly one active timer per user is enforced at DB level.

### D2. Start behavior
- Starting timer on task `T` when no active timer exists: create active session for `T`.
- Starting timer on task `T` when another task `U` is active: auto-stop `U`, then start `T`.
- Starting timer on the same already-active task is idempotent and returns current active session.

### D3. Stop behavior
- Stop always targets the user's active session by default.
- If no active session exists, stop operation is a no-op success.
- Duration is computed from server timestamps when session closes.

### D4. Eligibility rules
- Completed tasks cannot start new timers.
- Deleted tasks close any active linked session via FK cascade and session close logic.
- Recurring tasks track time per occurrence (no cross-occurrence carryover).

### D5. Time authority and timezone
- Server time is authoritative for `started_at`, `ended_at`, and duration.
- Analytics day boundaries use the user's local timezone in the UI.
- Stored timestamps remain UTC (`timestamptz`).

### D6. Offline and multi-tab contract
- Multi-tab sync uses `BroadcastChannel('ghost-timer')`.
- Offline actions are queued in local storage and retried on reconnect.
- UI may show a pending-sync state while preserving perceived timer continuity.

### D7. Analytics scope for first release
Required presets:
- `Last 7 days`
- `Last 30 days`
- `Last 90 days`
- `Custom range`

Required KPIs:
- `Total Focused Time`
- `Total Sessions`
- `Average Session Length`
- `Most Focused Project`

Required reports:
- Daily focused time trend
- Top tasks by focused time
- Top projects by focused time

### D8. KPI definitions (canonical)
- Total Focused Time: sum of `duration_seconds` for closed sessions in selected range.
- Total Sessions: count of closed sessions in selected range.
- Average Session Length: `sum(duration_seconds) / count(sessions)` for closed sessions; display `0` if none.
- Most Focused Project: project with max focused seconds via task->project mapping; null-safe for tasks without project.

### D9. Range filtering rules
- Include sessions where `started_at` is within the selected range.
- Active sessions are excluded from finalized KPI sums until stopped.
- Optionally show active session time separately as "Live (not yet finalized)".

### D10. Security contract
- Users can only access their own sessions (RLS).
- Session insert/update/delete restricted to `auth.uid() = user_id`.
- Schema constraints must prevent multiple concurrent active sessions per user.

## Consequences

### Positive
- Parallel agent work is unblocked (DB, state layer, UI, analytics can proceed).
- Analytics metrics are deterministic and testable.
- Race conditions are minimized through DB-enforced uniqueness.

### Trade-offs
- Auto-stop/start behavior may surprise users initially; UI needs clear feedback.
- Excluding active sessions from finalized KPIs can differ from user expectation unless labeled.

## Implementation Notes
- Phase 1 must enforce partial unique index for active sessions.
- Phase 2 should centralize start/stop semantics in one domain module.
- Phase 4 must use KPI definitions in this ADR exactly.

## Acceptance for Phase 0
- No unresolved policy decisions remain for start/stop semantics.
- KPI definitions and date-range behavior are fixed.
- This ADR is referenced by the implementation phase document.
