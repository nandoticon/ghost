alter table public.todos
  add column if not exists start_date timestamptz,
  add column if not exists energy varchar(10),
  add column if not exists context varchar(20),
  add column if not exists focus varchar(20);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'todos_energy_check'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_energy_check
      check (energy is null or energy in ('low', 'high'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'todos_context_check'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_context_check
      check (context is null or context in ('home', 'outside'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'todos_focus_check'
      and conrelid = 'public.todos'::regclass
  ) then
    alter table public.todos
      add constraint todos_focus_check
      check (focus is null or focus in ('imersion', 'process'));
  end if;
end $$;;
