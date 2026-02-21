-- Performance indexes for common app query paths.

-- Tasks list views
create index if not exists idx_tasks_user_sort_order
  on public.tasks(user_id, sort_order);

create index if not exists idx_tasks_user_today_sort_order
  on public.tasks(user_id, today, sort_order);

create index if not exists idx_tasks_user_project_sort_order
  on public.tasks(user_id, project_id, sort_order);

-- Subtasks and comments detail views
create index if not exists idx_subtasks_task_sort
  on public.subtasks(task_id, sort_order);

create index if not exists idx_comments_task_created
  on public.comments(task_id, created_at);

-- Projects list view
create index if not exists idx_projects_user_sort
  on public.projects(user_id, sort_order);
