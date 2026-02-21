create table subtasks (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references tasks(id) on delete cascade,
    title text not null,
    completed boolean default false,
    sort_order integer default 0,
    created_at timestamptz default now()
);

alter table subtasks enable row level security;
create policy "allow all" on subtasks for all using (true) with check (true);
;
