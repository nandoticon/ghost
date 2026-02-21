create index if not exists idx_attachments_uploaded_by on public.attachments(uploaded_by);
create index if not exists idx_todos_creator_deleted_created on public.todos(creator_id, is_deleted, created_at desc);
create index if not exists idx_todos_project_deleted_status on public.todos(project_id, is_deleted, status);
create index if not exists idx_comments_todo_deleted on public.comments(todo_id, is_deleted);
create index if not exists idx_project_members_user_project on public.project_members(user_id, project_id);
create index if not exists idx_todo_tags_tag_todo on public.todo_tags(tag_id, todo_id);;
