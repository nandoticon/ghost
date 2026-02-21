-- PROJECTS
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  color text default '#7c6aff',
  sort_order integer default 0,
  archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- TASKS
create table tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  notes text,
  completed boolean default false,
  today boolean default false,
  project_id uuid references projects(id) on delete set null,
  start_at timestamptz,
  end_at timestamptz,
  location text check (location in ('home', 'outside', null)),
  energy text check (energy in ('high', 'low', null)),
  focus text check (focus in ('immersion', 'process', null)),
  sort_order integer default 0,
  sort_order_today integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- COMMENTS
create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at via trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at before update on tasks
  for each row execute function update_updated_at();

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();

create trigger comments_updated_at before update on comments
  for each row execute function update_updated_at();

-- Enable RLS and allow all access (single-user personal app, auth enforced at login)
alter table projects enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;

create policy "allow all" on projects for all using (true) with check (true);
create policy "allow all" on tasks for all using (true) with check (true);
create policy "allow all" on comments for all using (true) with check (true);;
