alter table public.todos
  add column if not exists today boolean not null default false;;
