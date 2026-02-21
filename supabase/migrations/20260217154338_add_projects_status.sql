alter table public.projects
  add column if not exists status varchar(20) not null default 'backlog';

update public.projects
set status = coalesce(status, 'backlog')
where status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_status_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_status_check
      check (status in ('backlog', 'active', 'complete'));
  end if;
end $$;;
