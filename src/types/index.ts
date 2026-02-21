export interface Project {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    color: string;
    category_id: string | null;
    category?: Pick<ProjectCategory, 'id' | 'name'> | null;
    sort_order: number;
    archived: boolean;
    short_id: string;
    created_at: string;
    updated_at: string;
    sync_state?: 'syncing' | 'synced' | 'error';
}

export interface ProjectCategory {
    id: string;
    user_id: string;
    name: string;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Task {
    id: string;
    user_id: string;
    title: string;
    notes: string | null;
    completed: boolean;
    status: 'todo' | 'doing' | 'waiting' | 'done';
    today: boolean;
    project_id: string | null;
    start_at: string | null;
    end_at: string | null;
    location: 'home' | 'outside' | null;
    energy: 'high' | 'low' | null;
    focus: 'immersion' | 'process' | null;
    recurrence: 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null;
    recurrence_end_at: string | null;
    parent_task_id: string | null;
    sort_order: number;
    sort_order_today: number;
    estimated_effort: number | null; // in minutes
    short_id: string;
    created_at: string;
    updated_at: string;
    sync_state?: 'syncing' | 'synced' | 'error';
    project?: Project; // Included for joins
    subtasks?: Subtask[]; // Included for progress calculation without individual subscriptions
}

export interface Subtask {
    id: string;
    task_id: string;
    title: string;
    completed: boolean;
    sort_order: number;
    created_at: string;
}

export interface Comment {
    id: string;
    task_id: string;
    body: string;
    created_at: string;
    updated_at: string;
}

export interface TaskFilters {
    location?: 'home' | 'outside' | null;
    energy?: 'high' | 'medium' | 'low' | null;
    focus?: 'deep' | 'shallow' | null;
    completed?: boolean;
    today?: boolean;
    projectId?: string | null;
    status?: 'all' | 'todo' | 'doing' | 'waiting' | 'done';
    dateFilter?: 'any' | 'today' | 'upcoming' | 'overdue';
}

export interface Profile {
    id: string;
    full_name: string | null;
    pronouns: string | null;
    created_at: string;
    updated_at: string;
}
