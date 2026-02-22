/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { useAuth } from '../hooks/useAuth'
import { generateNextTask } from '../lib/recurrence'
import { useToast } from '../components/Toast'

const TASK_SELECT = `
    id,
    user_id,
    title,
    notes,
    project_id,
    today,
    start_at,
    end_at,
    location,
    energy,
    focus,
    recurrence,
    recurrence_end_at,
    parent_task_id,
    status,
    completed,
    completed_at,
    estimated_effort,
    sort_order,
    sort_order_today,
    short_id,
    created_at,
    updated_at,
    project:projects(
        id,
        name,
        color,
        category_id,
        short_id,
        archived,
        category:project_categories(id,name)
    )
`

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

const RETRY_ATTEMPTS = 3
const RETRY_BASE_DELAY_MS = 150
const RETRYABLE_PG_CODES = new Set(['40001', '40P01', '53300', '57P03', '08000', '08003', '08006', '08001'])

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableError(error: unknown) {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { code?: string; status?: number; message?: string }
    if (typeof candidate.status === 'number' && candidate.status >= 500) return true
    if (candidate.code && RETRYABLE_PG_CODES.has(candidate.code)) return true
    const message = (candidate.message || '').toLowerCase()
    return message.includes('network') || message.includes('fetch') || message.includes('timeout')
}

async function withRetry<T>(fn: () => Promise<T>, attempts = RETRY_ATTEMPTS): Promise<T> {
    let lastError: unknown
    for (let i = 0; i < attempts; i += 1) {
        try {
            return await fn()
        } catch (error) {
            lastError = error
            if (i === attempts - 1 || !isRetryableError(error)) {
                throw error
            }
            await sleep(RETRY_BASE_DELAY_MS * 2 ** i)
        }
    }
    throw lastError
}

export function TaskProvider({ children }: { children: ReactNode }) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()
    const userId = user?.id ?? null
    const { showToast } = useToast()

    const fetchTasks = useCallback(async () => {
        if (!userId) {
            setLoading(false)
            setTasks([])
            return
        }
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from('tasks')
                .select(TASK_SELECT)
                .eq('user_id', userId)
                // Optionally we can order by created_at or sort_order here, 
                // but client-side filtering/sorting will reorder anyway.
                .order('sort_order', { ascending: true })

            if (error) throw error
            setTasks((data || []) as unknown as Task[])
        } catch (error) {
            console.error('Error fetching global tasks:', error)
        } finally {
            setLoading(false)
        }
    }, [userId])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    // Realtime subscription
    useEffect(() => {
        if (!userId) return

        const upsertTaskWithRelations = async (taskId: string) => {
            const { data, error } = await supabase
                .from('tasks')
                .select(TASK_SELECT)
                .eq('id', taskId)
                .maybeSingle()

            if (error || !data) {
                return false
            }

            setTasks(prev => {
                const filtered = prev.filter(t => t.id !== taskId && !t.id.startsWith('temp-'))
                return [...filtered, data as unknown as Task]
            })

            return true
        }

        const channel = supabase
            .channel('tasks-realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tasks',
                    filter: `user_id=eq.${userId}`
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload

                    if (eventType === 'INSERT') {
                        if (newRecord?.id) {
                            void upsertTaskWithRelations(newRecord.id)
                        }
                    } else if (eventType === 'UPDATE') {
                        if (newRecord?.id) {
                            void upsertTaskWithRelations(newRecord.id).then((synced) => {
                                if (!synced) {
                                    setTasks(prev => prev.map(t => t.id === newRecord.id ? { ...t, ...newRecord } : t))
                                }
                            })
                        }
                    } else if (eventType === 'DELETE') {
                        setTasks(prev => prev.filter(t => t.id !== oldRecord.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [userId])

    const createTask = useCallback(async (task: Partial<Task>, isToday?: boolean) => {
        if (!userId) return null

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
            user_id: userId,
            sort_order: maxSortOrder,
            sort_order_today: maxSortOrderToday,
            completed: false,
            completed_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const tempId = 'temp-' + Math.random()
        setTasks(prev => [...prev, { ...newTask, id: tempId } as Task])

        try {
            const { data } = await withRetry(async () => {
                const result = await supabase
                    .from('tasks')
                    .insert([newTask])
                    .select(TASK_SELECT)
                    .single()
                if (result.error) throw result.error
                return result
            })

            const createdTask = data as unknown as Task
            setTasks(prev => prev.map(t => t.id === tempId ? createdTask : t))
            return createdTask
        } catch (error) {
            console.error('Error creating task:', error)
            setTasks(prev => prev.filter(t => t.id !== tempId))
            showToast('Could not create task. Retry?', 'error', () => {
                void createTask(task, isToday)
            }, 7000)
            fetchTasks()
            return null
        }
    }, [userId, tasks, fetchTasks, showToast])

    const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
        const previousTask = tasks.find(t => t.id === id)
        if (!previousTask) return

        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        if (updates.status !== undefined && updates.completed === undefined) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && updates.status === undefined) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }
        if (finalUpdates.completed !== undefined && finalUpdates.completed_at === undefined) {
            finalUpdates.completed_at = finalUpdates.completed ? new Date().toISOString() : null
        }

        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...finalUpdates, updated_at: new Date().toISOString() } : t))

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('tasks')
                    .update({ ...finalUpdates, updated_at: new Date().toISOString() })
                    .eq('id', id)
                if (error) throw error
            })
        } catch (error) {
            console.error('Error updating task:', error)
            setTasks(prev => prev.map(t => t.id === id ? previousTask : t))
            showToast('Save failed. Changes were reverted. Retry?', 'error', () => {
                void updateTask(id, updates)
            }, 7000)
            fetchTasks()
        }
    }, [fetchTasks, tasks, showToast])

    const deleteTask = useCallback(async (id: string) => {
        const deletedTask = tasks.find(t => t.id === id)
        if (!deletedTask) return

        setTasks(prev => prev.filter(t => t.id !== id))

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('tasks')
                    .delete()
                    .eq('id', id)
                if (error) throw error
            })
            showToast('Task deleted', 'info', () => {
                const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...restored } = deletedTask
                void createTask(restored)
            }, 6000)
        } catch (error) {
            console.error('Error deleting task:', error)
            setTasks(prev => [...prev, deletedTask])
            showToast('Delete failed. Task restored.', 'error')
            fetchTasks()
        }
    }, [fetchTasks, tasks, showToast, createTask])

    const batchUpdateTasks = useCallback(async (ids: string[], updates: Partial<Task>) => {
        const previousById = new Map(tasks.filter(t => ids.includes(t.id)).map(t => [t.id, t]))

        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        if (updates.status !== undefined && (updates.completed === undefined)) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && (updates.status === undefined)) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }
        if (finalUpdates.completed !== undefined && finalUpdates.completed_at === undefined) {
            finalUpdates.completed_at = finalUpdates.completed ? new Date().toISOString() : null
        }

        // Apply immediately to local state
        setTasks(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...finalUpdates, updated_at: new Date().toISOString() } : t))

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('tasks')
                    .update({ ...finalUpdates, updated_at: new Date().toISOString() })
                    .in('id', ids)
                if (error) throw error
            })
        } catch (error) {
            console.error('Error batch updating tasks:', error)
            setTasks(prev => prev.map(t => previousById.get(t.id) || t))
            showToast('Batch update failed. Changes were reverted.', 'error')
            fetchTasks()
        }
    }, [fetchTasks, tasks, showToast])

    const batchDeleteTasks = useCallback(async (ids: string[]) => {
        const deletedTasks = tasks.filter(t => ids.includes(t.id))

        // Apply immediately to local state
        setTasks(prev => prev.filter(t => !ids.includes(t.id)))

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('tasks')
                    .delete()
                    .in('id', ids)
                if (error) throw error
            })
        } catch (error) {
            console.error('Error batch deleting tasks:', error)
            setTasks(prev => [...prev, ...deletedTasks])
            showToast('Batch delete failed. Tasks restored.', 'error')
            fetchTasks()
        }
    }, [fetchTasks, tasks, showToast])

    const completeTask = useCallback(async (id: string, completed: boolean) => {
        const task = tasks.find(t => t.id === id)
        if (!task) return { success: false }
        const previousTask = { ...task }

        const newStatus = completed ? 'done' : 'todo'
        const completedAt = completed ? new Date().toISOString() : null
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed, completed_at: completedAt, status: newStatus, updated_at: new Date().toISOString() } : t))

        try {
            await withRetry(async () => {
                const { error } = await supabase
                    .from('tasks')
                    .update({ completed, completed_at: completedAt, status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', id)
                if (error) throw error
            })
        } catch (error) {
            console.error('Error completing task:', error)
            setTasks(prev => prev.map(t => t.id === id ? previousTask : t))
            showToast('Could not update task status. Retry?', 'error', () => {
                void completeTask(id, completed)
            }, 7000)
            fetchTasks()
            return { success: false }
        }

        let nextOccurrenceCreated = false
        let nextOccurrenceDate: string | null = null

        if (completed && task.recurrence) {
            const nextTaskData = generateNextTask(task)
            if (nextTaskData) {
                const tempNextId = `temp-rec-${Math.random()}`
                const nowIso = new Date().toISOString()
                const optimisticNextTask = {
                    ...task,
                    ...nextTaskData,
                    id: tempNextId,
                    completed: false,
                    completed_at: null,
                    status: 'todo',
                    created_at: nowIso,
                    updated_at: nowIso,
                } as Task

                // Optimistic recurrence UX: show next occurrence immediately.
                setTasks(prev => [...prev, optimisticNextTask])
                nextOccurrenceCreated = true
                nextOccurrenceDate = nextTaskData.end_at || null

                try {
                    const { data: nextTask } = await withRetry(async () => {
                        const result = await supabase
                            .from('tasks')
                            .insert([{ ...nextTaskData, user_id: userId }])
                            .select(TASK_SELECT)
                            .single()
                        if (result.error) throw result.error
                        return result
                    })

                    if (nextTask) {
                        setTasks(prev => prev.map(t => t.id === tempNextId ? nextTask as unknown as Task : t))
                        nextOccurrenceDate = nextTask?.end_at || nextOccurrenceDate
                    }
                } catch (insertError) {
                    console.error('Error creating next occurrence:', insertError)
                    setTasks(prev => prev.filter(t => t.id !== tempNextId))
                    nextOccurrenceCreated = false
                    nextOccurrenceDate = null
                    showToast('Recurring task was completed, but next occurrence could not be created.', 'error')
                }
            }
        }

        return { success: true, nextOccurrenceCreated, nextOccurrenceDate }
    }, [tasks, fetchTasks, userId, showToast])

    const reorderTasks = useCallback(async (orderedIds: string[], isToday?: boolean) => {
        const sortField = isToday ? 'sort_order_today' : 'sort_order'
        const previousTasks = [...tasks]
        const previousOrderById = new Map(previousTasks.map(t => [t.id, t[sortField] || 0]))
        const nextOrderById = new Map(orderedIds.map((id, index) => [id, index]))
        const changedIds = orderedIds.filter((id, index) => (previousOrderById.get(id) ?? 0) !== index)

        // Apply immediately to global state
        setTasks(prev => {
            const newTasks = [...prev]
            changedIds.forEach((id) => {
                const index = nextOrderById.get(id)
                const taskIndex = newTasks.findIndex(t => t.id === id)
                if (taskIndex !== -1 && index !== undefined) {
                    newTasks[taskIndex] = { ...newTasks[taskIndex], [sortField]: index }
                }
            })
            return newTasks
        })

        try {
            const updates = changedIds.map((id) => {
                const index = nextOrderById.get(id)
                if (index === undefined) return Promise.resolve({ error: null })
                return withRetry(async () => {
                    const result = await supabase
                        .from('tasks')
                        .update({ [sortField]: index, updated_at: new Date().toISOString() })
                        .eq('id', id)
                    if (result.error) throw result.error
                    return result
                })
            })

            const results = await Promise.all(updates)
            const error = results.find(r => r?.error)

            if (error) throw error.error
        } catch (error) {
            console.error('Error reordering tasks:', error)
            setTasks(previousTasks) // Rollback to reliable state
            showToast('Could not reorder tasks. Order restored.', 'error')
        }
    }, [tasks, showToast])

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

