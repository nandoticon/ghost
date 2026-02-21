import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { useAuth } from '../hooks/useAuth'
import { generateNextTask } from '../lib/recurrence'

interface TaskContextType {
    tasks: Task[]
    loading: boolean
    createTask: (task: Partial<Task>, isToday?: boolean) => Promise<Task | null>
    updateTask: (id: string, updates: Partial<Task>) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    batchUpdateTasks: (ids: string[], updates: Partial<Task>) => Promise<void>
    batchDeleteTasks: (ids: string[]) => Promise<void>
    completeTask: (id: string, completed: boolean) => Promise<{ success: boolean; nextOccurrenceCreated?: boolean; nextOccurrenceDate?: string | null }>
    reorderTasks: (orderedIds: string[], isToday?: boolean) => Promise<void>
    refresh: () => Promise<void>
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

export function TaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

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
                        *,
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

    // Realtime subscription
    useEffect(() => {
        if (!user) return

        const channel = supabase
            .channel('tasks-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload

                    if (eventType === 'INSERT') {
                        setTasks(prev => {
                            // Avoid duplicates (e.g. if insert event arrives after optimistic set)
                            if (prev.some(t => t.id === newRecord.id)) return prev
                            // Filter out temporary tasks
                            const filtered = prev.filter(t => !t.id.startsWith('temp-'))
                            return [...filtered, newRecord as Task]
                        })
                    } else if (eventType === 'UPDATE') {
                        setTasks(prev => prev.map(t => t.id === newRecord.id ? { ...t, ...newRecord } : t))
                    } else if (eventType === 'DELETE') {
                        setTasks(prev => prev.filter(t => t.id !== oldRecord.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user])

    const createTask = useCallback(async (task: Partial<Task>, isToday?: boolean) => {
        if (!user) return null

        // Calculate max sort order from global tasks using client-side derivation
        const activeTasks = tasks.filter(t => !t.completed)
        const maxSortOrder = tasks.length > 0
            ? Math.max(...tasks.map(t => t.sort_order || 0)) + 1
            : 0

        const maxSortOrderToday = isToday
            ? (activeTasks.filter(t => t.today).length > 0 ? Math.max(...activeTasks.filter(t => t.today).map(t => t.sort_order_today || 0)) + 1 : 0)
            : 0

        const newTask = {
            ...task,
            user_id: user.id,
            sort_order: maxSortOrder,
            sort_order_today: maxSortOrderToday,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const tempId = 'temp-' + Math.random()
        setTasks(prev => [...prev, { ...newTask, id: tempId } as Task])

        const { data, error } = await supabase
            .from('tasks')
            .insert([newTask])
            .select(`
                *,
                project:projects(
                    *,
                    category:project_categories(id,name)
                ),
                subtasks(id, completed)
            `)
            .single()

        if (error) {
            console.error('Error creating task:', error)
            fetchTasks()
            return null
        }

        setTasks(prev => prev.map(t => t.id === tempId ? data : t))
        return data
    }, [user, tasks, fetchTasks])

    const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        if (updates.status !== undefined && updates.completed === undefined) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && updates.status === undefined) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...finalUpdates, updated_at: new Date().toISOString() } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ ...finalUpdates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error updating task:', error)
            fetchTasks()
        }
    }, [fetchTasks])

    const deleteTask = useCallback(async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id))

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting task:', error)
            fetchTasks()
        }
    }, [fetchTasks])

    const batchUpdateTasks = useCallback(async (ids: string[], updates: Partial<Task>) => {
        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        if (updates.status !== undefined && (updates.completed === undefined)) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && (updates.status === undefined)) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }

        // Apply immediately to local state
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...finalUpdates, updated_at: new Date().toISOString() } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ ...finalUpdates, updated_at: new Date().toISOString() })
            .in('id', ids)

        if (error) {
            console.error('Error batch updating tasks:', error)
            fetchTasks()
        }
    }, [fetchTasks])

    const batchDeleteTasks = useCallback(async (ids: string[]) => {
        // Apply immediately to local state
        setTasks(prev => prev.filter(t => !ids.includes(t.id)))

        const { error } = await supabase
            .from('tasks')
            .delete()
            .in('id', ids)

        if (error) {
            console.error('Error batch deleting tasks:', error)
            fetchTasks()
        }
    }, [fetchTasks])

    const completeTask = useCallback(async (id: string, completed: boolean) => {
        const task = tasks.find(t => t.id === id)
        if (!task) return { success: false }

        const newStatus = completed ? 'done' : 'todo'
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed, status: newStatus, updated_at: new Date().toISOString() } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ completed, status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error completing task:', error)
            fetchTasks()
            return { success: false }
        }

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
                            *,
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
    }, [tasks, fetchTasks, user])

    const reorderTasks = useCallback(async (orderedIds: string[], isToday?: boolean) => {
        const sortField = isToday ? 'sort_order_today' : 'sort_order'
        const previousTasks = [...tasks]

        // Apply immediately to global state
        setTasks(prev => {
            const newTasks = [...prev]
            orderedIds.forEach((id, index) => {
                const taskIndex = newTasks.findIndex(t => t.id === id)
                if (taskIndex !== -1) {
                    newTasks[taskIndex] = { ...newTasks[taskIndex], [sortField]: index }
                }
            })
            return newTasks
        })

        try {
            const updates = orderedIds.map((id, index) =>
                supabase
                    .from('tasks')
                    .update({ [sortField]: index, updated_at: new Date().toISOString() })
                    .eq('id', id)
            )

            const results = await Promise.all(updates)
            const error = results.find(r => r.error)

            if (error) throw error.error
        } catch (error) {
            console.error('Error reordering tasks:', error)
            setTasks(previousTasks) // Rollback to reliable state
        }
    }, [tasks])

    return (
        <TaskContext.Provider
            value={{
                tasks,
                loading,
                createTask,
                updateTask,
                deleteTask,
                batchUpdateTasks,
                batchDeleteTasks,
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
