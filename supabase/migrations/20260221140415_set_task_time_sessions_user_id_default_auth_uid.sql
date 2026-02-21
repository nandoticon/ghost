alter table public.task_time_sessions
  alter column user_id set default auth.uid();;
