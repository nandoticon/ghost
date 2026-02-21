create extension if not exists pgcrypto;

create table if not exists public.users (
    id uuid primary key default gen_random_uuid(),
    email varchar(255) unique not null,
    username varchar(100) unique not null,
    password_hash varchar(255) not null,
    display_name varchar(255),
    avatar_url text,
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp,
    last_login_at timestamptz,
    is_active boolean default true
);

create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_username on public.users(username);

create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references public.users(id) on delete cascade,
    name varchar(255) not null,
    description text,
    color varchar(7),
    icon varchar(50),
    is_archived boolean default false,
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp
);

create index if not exists idx_projects_owner on public.projects(owner_id);
create index if not exists idx_projects_archived on public.projects(is_archived);

create table if not exists public.project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete cascade,
    role varchar(20) not null check (role in ('owner', 'admin', 'member', 'viewer')),
    joined_at timestamptz default current_timestamp,
    unique(project_id, user_id)
);

create index if not exists idx_project_members_project on public.project_members(project_id);
create index if not exists idx_project_members_user on public.project_members(user_id);

create table if not exists public.todos (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade,
    creator_id uuid not null references public.users(id) on delete set null,
    assignee_id uuid references public.users(id) on delete set null,
    parent_id uuid references public.todos(id) on delete cascade,
    title varchar(500) not null,
    description text,
    status varchar(20) not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
    priority varchar(10) default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
    due_date timestamptz,
    completed_at timestamptz,
    position integer default 0,
    is_deleted boolean default false,
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp
);

create index if not exists idx_todos_project on public.todos(project_id);
create index if not exists idx_todos_creator on public.todos(creator_id);
create index if not exists idx_todos_assignee on public.todos(assignee_id);
create index if not exists idx_todos_status on public.todos(status);
create index if not exists idx_todos_due_date on public.todos(due_date);
create index if not exists idx_todos_parent on public.todos(parent_id);
create index if not exists idx_todos_deleted on public.todos(is_deleted);

create table if not exists public.tags (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.users(id) on delete cascade,
    name varchar(50) not null,
    color varchar(7),
    created_at timestamptz default current_timestamp,
    unique(user_id, name)
);

create index if not exists idx_tags_user on public.tags(user_id);

create table if not exists public.todo_tags (
    todo_id uuid not null references public.todos(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    created_at timestamptz default current_timestamp,
    primary key (todo_id, tag_id)
);

create index if not exists idx_todo_tags_todo on public.todo_tags(todo_id);
create index if not exists idx_todo_tags_tag on public.todo_tags(tag_id);

create table if not exists public.comments (
    id uuid primary key default gen_random_uuid(),
    todo_id uuid not null references public.todos(id) on delete cascade,
    user_id uuid not null references public.users(id) on delete set null,
    content text not null,
    created_at timestamptz default current_timestamp,
    updated_at timestamptz default current_timestamp,
    is_deleted boolean default false
);

create index if not exists idx_comments_todo on public.comments(todo_id);
create index if not exists idx_comments_user on public.comments(user_id);

create table if not exists public.attachments (
    id uuid primary key default gen_random_uuid(),
    todo_id uuid not null references public.todos(id) on delete cascade,
    uploaded_by uuid not null references public.users(id) on delete set null,
    filename varchar(255) not null,
    file_url text not null,
    file_size bigint,
    mime_type varchar(100),
    created_at timestamptz default current_timestamp
);

create index if not exists idx_attachments_todo on public.attachments(todo_id);

create table if not exists public.activity_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references public.users(id) on delete set null,
    todo_id uuid references public.todos(id) on delete cascade,
    project_id uuid references public.projects(id) on delete cascade,
    action varchar(50) not null,
    entity_type varchar(50) not null,
    changes jsonb,
    created_at timestamptz default current_timestamp
);

create index if not exists idx_activity_log_user on public.activity_log(user_id);
create index if not exists idx_activity_log_todo on public.activity_log(todo_id);
create index if not exists idx_activity_log_project on public.activity_log(project_id);
create index if not exists idx_activity_log_created on public.activity_log(created_at);;
