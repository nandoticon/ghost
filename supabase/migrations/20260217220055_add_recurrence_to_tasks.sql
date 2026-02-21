alter table tasks add column recurrence text 
  check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly', 'yearly', null));
alter table tasks add column recurrence_end_at date;
alter table tasks add column parent_task_id uuid references tasks(id) on delete set null;

-- Index for finding children of a recurring task
create index on tasks(parent_task_id);;
