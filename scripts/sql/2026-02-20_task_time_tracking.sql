-- Task time tracking foundation (sessions + security)

create table if not exists public.task_time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  duration_seconds integer null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint task_time_sessions_valid_time_range
    check (ended_at is null or ended_at > started_at),
  constraint task_time_sessions_valid_duration
    check (duration_seconds is null or duration_seconds >= 1)
);

-- Enforce one active timer per user.
create unique index if not exists idx_task_time_sessions_one_active_per_user
  on public.task_time_sessions(user_id)
  where ended_at is null;

-- Common read paths.
create index if not exists idx_task_time_sessions_user_started
  on public.task_time_sessions(user_id, started_at desc);

create index if not exists idx_task_time_sessions_user_task_started
  on public.task_time_sessions(user_id, task_id, started_at desc);

-- Keep updated_at fresh on updates.
create or replace function public.touch_task_time_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_task_time_sessions_updated_at on public.task_time_sessions;
create trigger trg_touch_task_time_sessions_updated_at
before update on public.task_time_sessions
for each row
execute function public.touch_task_time_sessions_updated_at();

alter table public.task_time_sessions enable row level security;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.task_time_sessions to anon, authenticated;

-- Read: only own sessions.
drop policy if exists "Users can select their own time sessions" on public.task_time_sessions;
create policy "Users can select their own time sessions"
  on public.task_time_sessions
  for select
  using (auth.uid() = user_id);

-- Insert: only own session rows, and only for own tasks.
drop policy if exists "Users can insert their own time sessions" on public.task_time_sessions;
create policy "Users can insert their own time sessions"
  on public.task_time_sessions
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.user_id = auth.uid()
    )
  );

-- Update: only own session rows, and keep task linkage to own tasks.
drop policy if exists "Users can update their own time sessions" on public.task_time_sessions;
create policy "Users can update their own time sessions"
  on public.task_time_sessions
  for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.user_id = auth.uid()
    )
  );

-- Delete: only own session rows.
drop policy if exists "Users can delete their own time sessions" on public.task_time_sessions;
create policy "Users can delete their own time sessions"
  on public.task_time_sessions
  for delete
  using (auth.uid() = user_id);

-- Helper: close currently active session for authenticated user.
-- Returns the closed row (or empty set when no active session exists).
create or replace function public.stop_active_task_timer(
  p_stopped_at timestamptz default now()
)
returns table (
  id uuid,
  user_id uuid,
  task_id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  source text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security invoker
as $$
begin
  return query
  update public.task_time_sessions s
  set ended_at = greatest(p_stopped_at, s.started_at + interval '1 second'),
      duration_seconds = greatest(
        1,
        floor(extract(epoch from (greatest(p_stopped_at, s.started_at + interval '1 second') - s.started_at)))::integer
      ),
      updated_at = now()
  where s.user_id = auth.uid()
    and s.ended_at is null
  returning
    s.id,
    s.user_id,
    s.task_id,
    s.started_at,
    s.ended_at,
    s.duration_seconds,
    s.source,
    s.created_at,
    s.updated_at;
end;
$$;
