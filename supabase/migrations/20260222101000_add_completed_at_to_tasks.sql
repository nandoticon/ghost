alter table tasks add column if not exists completed_at timestamptz;

-- Backfill existing completed tasks for historical visibility in analytics.
update tasks
set completed_at = coalesce(completed_at, updated_at)
where completed = true;

create index if not exists tasks_user_completed_at_idx on tasks(user_id, completed_at);
