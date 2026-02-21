create table if not exists public.project_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_categories_user_name_unique unique (user_id, name)
);

create index if not exists idx_project_categories_user_sort
  on public.project_categories(user_id, sort_order, created_at);

alter table public.project_categories enable row level security;

drop policy if exists "Users can select their own project categories" on public.project_categories;
create policy "Users can select their own project categories"
  on public.project_categories
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own project categories" on public.project_categories;
create policy "Users can insert their own project categories"
  on public.project_categories
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own project categories" on public.project_categories;
create policy "Users can update their own project categories"
  on public.project_categories
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own project categories" on public.project_categories;
create policy "Users can delete their own project categories"
  on public.project_categories
  for delete
  using (auth.uid() = user_id);

alter table public.projects
  add column if not exists category_id uuid null references public.project_categories(id) on delete set null;

create index if not exists idx_projects_user_category
  on public.projects(user_id, category_id);;
