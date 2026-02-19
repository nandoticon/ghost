import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { useAuth } from './useAuth'

/**
 * Fetches a single task by ID directly from Supabase instead of loading all tasks.
 * Used in TaskDetail for O(1) lookup instead of filtering the full task array.
 */
export function useTaskById(taskId: string | null) {
    const [task, setTask] = useState<Task | null>(null)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchTask = useCallback(async () => {
        if (!user || !taskId || taskId.startsWith('temp-')) {
            setTask(null)
            setLoading(false)
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
                    )
                `)
                .eq('id', taskId)
                .eq('user_id', user.id)
                .single()

            if (error) throw error
            setTask(data)
        } catch (error) {
            console.error('Error fetching task:', error)
            setTask(null)
        } finally {
            setLoading(false)
        }
    }, [user, taskId])

    useEffect(() => {
        fetchTask()
    }, [fetchTask])

    const updateTaskField = async (updates: Partial<Task>) => {
        if (!taskId || !task) return

        // Optimistic update
        setTask(prev => prev ? { ...prev, ...updates } : prev)

        const { error } = await supabase
            .from('tasks')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', taskId)

        if (error) {
            console.error('Error updating task:', error)
            fetchTask() // Rollback
        }
    }

    return { task, loading, updateTaskField, refresh: fetchTask }
}
