-- Security hardening: enable RLS across public app tables.
alter table if exists public.users enable row level security;
alter table if exists public.projects enable row level security;
alter table if exists public.project_members enable row level security;
alter table if exists public.todos enable row level security;
alter table if exists public.tags enable row level security;
alter table if exists public.todo_tags enable row level security;
alter table if exists public.comments enable row level security;
alter table if exists public.attachments enable row level security;
alter table if exists public.activity_log enable row level security;

-- Performance: indexes aligned with current query paths.
create index if not exists idx_todos_creator_deleted_created on public.todos (creator_id, is_deleted, created_at desc);
create index if not exists idx_todos_creator_project_deleted on public.todos (creator_id, project_id, is_deleted);
create index if not exists idx_todos_creator_today_status on public.todos (creator_id, today, status);
create index if not exists idx_projects_owner_archived_created on public.projects (owner_id, is_archived, created_at desc);
create index if not exists idx_comments_todo_created on public.comments (todo_id, created_at desc);
create index if not exists idx_attachments_todo_created on public.attachments (todo_id, created_at desc);;
