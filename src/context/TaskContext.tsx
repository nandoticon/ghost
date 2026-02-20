import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { useAuth } from '../hooks/useAuth'
import { generateNextTask } from '../lib/recurrence'
import { useRef } from 'react'

interface TaskContextType {
    tasks: Task[]
    loading: boolean
    createTask: (task: Partial<Task>, isToday?: boolean) => Promise<Task | null>
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    completeTask: (id: string, completed: boolean) => Promise<{ success: boolean; nextOccurrenceCreated?: boolean; nextOccurrenceDate?: string | null }>
    reorderTasks: (orderedIds: string[], isToday?: boolean) => Promise<void>
    refresh: () => Promise<void>
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()
    const tasksRef = useRef<Task[]>([])

    useEffect(() => {
        tasksRef.current = tasks
    }, [tasks])

    const fetchTasks = useCallback(async () => {
        if (!user) {
            setLoading(false)
            setTasks([])
            return
        }
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(`
                    *,
                    project:projects(
                        id,
                        user_id,
                        name,
                        description,
                        color,
                        category_id,
                        sort_order,
                        archived,
                        short_id,
                        created_at,
                        updated_at,
                        category:project_categories(id,name)
                    ),
                    subtasks(id, completed)
                `)
                .eq('user_id', user.id)
                // Optionally we can order by created_at or sort_order here, 
                // but client-side filtering/sorting will reorder anyway.
                .order('sort_order', { ascending: true })

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching global tasks:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    const createTask = useCallback(async (task: Partial<Task>, isToday?: boolean) => {
        if (!user) return null

        const currentTasks = tasksRef.current

        // Calculate max sort order from global tasks using client-side derivation
        const activeTasks = currentTasks.filter(t => !t.completed)
        const maxSortOrder = currentTasks.length > 0
            ? Math.max(...currentTasks.map(t => t.sort_order || 0)) + 1
            : 0

        const maxSortOrderToday = isToday
            ? (activeTasks.filter(t => t.today).length > 0 ? Math.max(...activeTasks.filter(t => t.today).map(t => t.sort_order_today || 0)) + 1 : 0)
            : 0

        const baseTask = {
            ...task,
            user_id: user.id,
            sort_order: maxSortOrder,
            sort_order_today: maxSortOrderToday,
            completed: false,
            updated_at: new Date().toISOString(),
        }
        const optimisticTask = { ...baseTask, sync_state: 'syncing' as const }

        const tempId = 'temp-' + Math.random()
        setTasks(prev => [...prev, { ...optimisticTask, id: tempId } as Task])

        const { data, error } = await supabase
            .from('tasks')
            .insert([baseTask])
            .select(`
                *,
                project:projects(
                    id,
                    user_id,
                    name,
                    description,
                    color,
                    category_id,
                    sort_order,
                    archived,
                    short_id,
                    created_at,
                    updated_at,
                    category:project_categories(id,name)
                ),
                subtasks(id, completed)
            `)
            .single()

        if (error) {
            console.error('Error creating task:', error)
            setTasks(prev => prev.map(t => t.id === tempId ? { ...t, sync_state: 'error' } : t))
            return null
        }

        setTasks(prev => prev.map(t => t.id === tempId ? { ...data, sync_state: 'synced' } : t))
        return data
    }, [user])

    const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
        const snapshot = tasksRef.current

        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        delete (finalUpdates as Partial<Task>).sync_state
        if (updates.status !== undefined && updates.completed === undefined) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && updates.status === undefined) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...finalUpdates, updated_at: new Date().toISOString(), sync_state: 'syncing' } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ ...finalUpdates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error updating task:', error)
            setTasks(snapshot.map(t => t.id === id ? { ...t, sync_state: 'error' } : t))
            return
        }
        setTasks(prev => prev.map(t => t.id === id ? { ...t, sync_state: 'synced' } : t))
    }, [])

    const deleteTask = useCallback(async (id: string) => {
        const snapshot = tasksRef.current
        setTasks(prev => prev.filter(t => t.id !== id))

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting task:', error)
            setTasks(snapshot)
        }
    }, [])

    const completeTask = useCallback(async (id: string, completed: boolean) => {
        const currentTasks = tasksRef.current
        const task = currentTasks.find(t => t.id === id)
        if (!task) return { success: false }
        const snapshot = currentTasks

        const newStatus = completed ? 'done' : 'todo'
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed, status: newStatus, updated_at: new Date().toISOString(), sync_state: 'syncing' } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ completed, status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error completing task:', error)
            setTasks(snapshot.map(t => t.id === id ? { ...t, sync_state: 'error' } : t))
            return { success: false }
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, sync_state: 'synced' } : t))

        let nextOccurrenceCreated = false
        let nextOccurrenceDate: string | null = null

        if (completed && task.recurrence) {
            const nextTaskData = generateNextTask(task)
            if (nextTaskData) {
                const { data: nextTask, error: insertError } = await supabase
                    .from('tasks')
                    .insert([{ ...nextTaskData, user_id: user?.id }])
                    .select(`
                        *,
                        project:projects(
                            id,
                            user_id,
                            name,
                            description,
                            color,
                            category_id,
                            sort_order,
                            archived,
                            short_id,
                            created_at,
                            updated_at,
                            category:project_categories(id,name)
                        ),
                        subtasks(id, completed)
                    `)
                    .single()

                if (!insertError && nextTask) {
                    nextOccurrenceCreated = true
                    nextOccurrenceDate = nextTask.end_at

                    setTasks(prev => [...prev, nextTask])
                } else {
                    console.error('Error creating next occurrence:', insertError)
                }
            }
        }

        return { success: true, nextOccurrenceCreated, nextOccurrenceDate }
    }, [user])

    const reorderTasks = useCallback(async (orderedIds: string[], isToday?: boolean) => {
        const sortField = isToday ? 'sort_order_today' : 'sort_order'
        const snapshot = tasksRef.current

        // Apply immediately to global state
        setTasks(prev => {
            const newTasks = [...prev]
            orderedIds.forEach((id, index) => {
                const taskIndex = newTasks.findIndex(t => t.id === id)
                if (taskIndex !== -1) {
                    newTasks[taskIndex] = { ...newTasks[taskIndex], [sortField]: index }
                }
            })
            // Since ordering applies locally in useTasks mostly via sorting, updating just the sortField works
            return newTasks
        })

        const updates = orderedIds.map((id, index) =>
            supabase
                .from('tasks')
                .update({ [sortField]: index })
                .eq('id', id)
        )

        const results = await Promise.all(updates)
        const error = results.find(r => r.error)

        if (error) {
            console.error('Error reordering tasks:', error)
            setTasks(snapshot)
        }
    }, [])

    return (
        <TaskContext.Provider
            value={{
                tasks,
                loading,
                createTask,
                updateTask,
                deleteTask,
                completeTask,
                reorderTasks,
                refresh: fetchTasks
            }}
        >
            {children}
        </TaskContext.Provider>
    )
}

export function useGlobalTasks() {
    const context = useContext(TaskContext)
    if (context === undefined) {
        throw new Error('useGlobalTasks must be used within a TaskProvider')
    }
    return context
}
