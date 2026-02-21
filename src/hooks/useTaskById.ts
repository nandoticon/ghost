import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { useAuth } from './useAuth'
import { useGlobalTasks } from '../context/TaskContext'

/**
 * Fetches a single task by ID directly from Supabase instead of loading all tasks.
 * Used in TaskDetail for O(1) lookup instead of filtering the full task array.
 */
export function useTaskById(taskId: string | null) {
    const { tasks, updateTask } = useGlobalTasks()
    const [remoteTask, setRemoteTask] = useState<Task | null>(null)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    // Optimized lookup: memoize the task from global context
    const taskFromContext = useMemo(() => {
        if (!taskId) return null
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)
        return tasks.find(t => isUuid ? t.id === taskId : t.short_id === taskId) || null
    }, [tasks, taskId])

    const fetchTask = useCallback(async () => {
        if (!user || !taskId || taskId.startsWith('temp-') || taskFromContext) {
            if (taskFromContext) setLoading(false)
            return
        }

        setLoading(true)
        try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(taskId)

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

            if (isUuid) {
                query = query.eq('id', taskId)
            } else {
                query = query.eq('short_id', taskId)
            }

            const { data, error } = await query.single()

            if (error) {
                if (error.code === 'PGRST116') {
                    setRemoteTask(null)
                    return
                }
                throw error
            }
            setRemoteTask(data)
        } catch (error) {
            console.error('Error fetching task:', error)
            setRemoteTask(null)
        } finally {
            setLoading(false)
        }
    }, [user, taskId, taskFromContext])

    useEffect(() => {
        fetchTask()
    }, [fetchTask])

    // Priority: context-synced task, then remote-fetched task
    const task = taskFromContext || remoteTask

    const updateTaskField = async (updates: Partial<Task>) => {
        if (!taskId || !task) return

        // Sync logic for status/completed bridging
        const finalUpdates = { ...updates }
        if (updates.status !== undefined && (updates.completed === undefined)) {
            finalUpdates.completed = updates.status === 'done'
        } else if (updates.completed !== undefined && (updates.status === undefined)) {
            finalUpdates.status = updates.completed ? 'done' : 'todo'
        }

        // Sync with global context - this will update taskFromContext optimistically
        await updateTask(task.id, finalUpdates)
    }

    return { task, loading, updateTaskField, refresh: fetchTask }
}
