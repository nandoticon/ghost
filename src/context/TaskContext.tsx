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
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
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

    const completeTask = useCallback(async (id: string, completed: boolean) => {
        const task = tasks.find(t => t.id === id)
        if (!task) return { success: false }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed, updated_at: new Date().toISOString() } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ completed, updated_at: new Date().toISOString() })
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
            fetchTasks()
        }
    }, [fetchTasks])

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
