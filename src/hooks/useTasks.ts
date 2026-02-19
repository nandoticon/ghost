import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Task, TaskFilters } from '../types'
import { useAuth } from './useAuth'
import { generateNextTask } from '../lib/recurrence'

export function useTasks(filters?: TaskFilters) {
    const [tasks, setTasks] = useState<Task[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const filtersString = JSON.stringify(filters)

    const fetchTasks = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }
        setLoading(true)

        try {
            let query = supabase
                .from('tasks')
                .select(`
          *,
          project:projects(
            *,
            category:project_categories(id,name)
          )
        `)
                .eq('user_id', user.id)

            // Apply ordering based on context
            if (filters?.today) {
                query = query.order('sort_order_today', { ascending: true })
            } else {
                query = query.order('sort_order', { ascending: true })
            }

            // Apply Filters
            if (filters?.projectId) {
                query = query.eq('project_id', filters.projectId)
            }

            if (filters?.today) {
                query = query.eq('today', true)
            }

            if (filters?.location) {
                query = query.eq('location', filters.location)
            }

            if (filters?.energy) {
                query = query.eq('energy', filters.energy)
            }

            if (filters?.focus) {
                query = query.eq('focus', filters.focus)
            }

            // Status Filter
            if (filters?.status === 'active') {
                query = query.eq('completed', false)
            } else if (filters?.status === 'completed') {
                query = query.eq('completed', true)
            } else if (filters?.completed !== undefined) {
                query = query.eq('completed', filters.completed)
            }

            // Date Filter
            if (filters?.dateFilter === 'has_date') {
                query = query.or('start_at.not.is.null,end_at.not.is.null')
            } else if (filters?.dateFilter === 'overdue') {
                const now = new Date().toISOString()
                query = query
                    .lt('end_at', now)
                    .eq('completed', false)
                    .not('end_at', 'is', null)
            }

            const { data, error } = await query

            if (error) throw error
            setTasks(data || [])
        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }, [user, filtersString])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    const createTask = async (task: Partial<Task>) => {
        if (!user) return

        // Calculate max sort order
        const maxSortOrder = tasks.length > 0
            ? Math.max(...tasks.map(t => t.sort_order || 0)) + 1
            : 0

        const maxSortOrderToday = filters?.today
            ? (tasks.length > 0 ? Math.max(...tasks.map(t => t.sort_order_today || 0)) + 1 : 0)
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

        // Optimistic update
        setTasks(prev => [...prev, { ...newTask, id: 'temp-' + Math.random() } as Task])

        const { data, error } = await supabase
            .from('tasks')
            .insert([newTask])
            .select()
            .single()

        if (error) {
            console.error('Error creating task:', error)
            fetchTasks() // Rollback
            return null
        }

        setTasks(prev => prev.map(t => t.id.toString().startsWith('temp-') ? data : t))
        return data
    }

    const updateTask = async (id: string, updates: Partial<Task>) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error updating task:', error)
            fetchTasks() // Rollback
        }
    }

    const deleteTask = async (id: string) => {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== id))

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting task:', error)
            fetchTasks() // Rollback
        }
    }

    const completeTask = async (id: string, completed: boolean) => {
        const task = tasks.find(t => t.id === id)
        if (!task) return { success: false }

        // Optimistic update for the current task
        setTasks(prev => prev.map(t => t.id === id ? { ...t, completed } : t))

        const { error } = await supabase
            .from('tasks')
            .update({ completed, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error completing task:', error)
            fetchTasks() // Rollback
            return { success: false }
        }

        let nextOccurrenceCreated = false
        let nextOccurrenceDate: string | null = null

        if (completed && task.recurrence) {
            const nextTaskData = generateNextTask(task)
            if (nextTaskData) {
                // We don't use the createTask function here because we want to avoid double optimistic updates
                // and we need precise control over the insert
                const { data: nextTask, error: insertError } = await supabase
                    .from('tasks')
                    .insert([{ ...nextTaskData, user_id: user?.id }])
                    .select()
                    .single()

                if (!insertError && nextTask) {
                    nextOccurrenceCreated = true
                    nextOccurrenceDate = nextTask.end_at
                    // Refresh to show the new task in relevant views
                    fetchTasks()
                } else {
                    console.error('Error creating next occurrence:', insertError)
                }
            }
        }

        return { success: true, nextOccurrenceCreated, nextOccurrenceDate }
    }

    const reorderTasks = async (orderedIds: string[]) => {
        const isToday = filters?.today
        const sortField = isToday ? 'sort_order_today' : 'sort_order'

        // Optimistic update
        const currentTasksMap = new Map(tasks.map(t => [t.id, t]))
        const newTasks = orderedIds.map(id => currentTasksMap.get(id)).filter(Boolean) as Task[]
        setTasks(newTasks)

        // Batch update
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
            fetchTasks() // Rollback
        }
    }

    return {
        tasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        completeTask,
        reorderTasks,
        refresh: fetchTasks
    }
}
