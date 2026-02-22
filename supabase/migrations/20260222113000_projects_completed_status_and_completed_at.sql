alter table public.projects
  add column if not exists completed_at timestamptz;

alter table public.projects
  add column if not exists status varchar(20) not null default 'backlog';

update public.projects
set status = case
  when status = 'complete' then 'completed'
  when status in ('backlog', 'active', 'completed') then status
  else 'backlog'
end;

alter table public.projects
  alter column status set default 'backlog';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'projects_status_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects drop constraint projects_status_check;
  end if;

  alter table public.projects
    add constraint projects_status_check
    check (status in ('backlog', 'active', 'completed'));
end $$;

update public.projects
set completed_at = coalesce(completed_at, updated_at)
where status = 'completed'
  and completed_at is null;

update public.projects
set completed_at = null
where status <> 'completed'
  and completed_at is not null;

create index if not exists projects_user_status_idx
  on public.projects(user_id, status);

create index if not exists projects_user_completed_at_idx
  on public.projects(user_id, completed_at);
