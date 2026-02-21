import { useMemo, useCallback } from 'react'
import { addDays, isPast, isToday } from 'date-fns'
import { Task, TaskFilters } from '../types'
import { useGlobalTasks } from '../context/TaskContext'

export function useTasks(filters?: TaskFilters) {
    const {
        tasks: globalTasks,
        loading,
        createTask: globalCreateTask,
        updateTask,
        deleteTask,
        completeTask,
        reorderTasks: globalReorderTasks,
        refresh
    } = useGlobalTasks()

    // Memoize stringified filters strictly for effect dependency checks if needed
    const filtersString = JSON.stringify(filters)

    const filteredTasks = useMemo(() => {
        let result = [...globalTasks]

        // Filters applied sequentially:
        if (filters?.projectId) {
            result = result.filter(t => t.project_id === filters.projectId)
        }

        if (filters?.today) {
            result = result.filter(t => t.today)
        }

        if (filters?.location) {
            result = result.filter(t => t.location === filters.location)
        }

        if (filters?.energy) {
            result = result.filter(t => t.energy === filters.energy)
        }

        if (filters?.focus) {
            result = result.filter(t => t.focus === filters.focus)
        }

        if (filters?.status && filters.status !== 'all') {
            result = result.filter(t => t.status === filters.status)
        } else if (filters?.completed !== undefined) {
            result = result.filter(t => t.completed === filters.completed)
        }

        if (filters?.dateFilter === 'any') {
            // No date-based filtering applied, show all tasks matching other filters
        } else if (filters?.dateFilter === 'today') {
            const todayStart = new Date()
            todayStart.setHours(0, 0, 0, 0)
            const todayEnd = new Date()
            todayEnd.setHours(23, 59, 59, 999)
            result = result.filter(t =>
                (t.start_at && new Date(t.start_at) <= todayEnd && (!t.end_at || new Date(t.end_at) >= todayStart)) ||
                (t.end_at && new Date(t.end_at) >= todayStart && new Date(t.end_at) <= todayEnd)
            )
        } else if (filters?.dateFilter === 'upcoming') {
            const now = new Date().toISOString()
            result = result.filter(t => !t.completed && t.start_at && t.start_at > now)
        } else if (filters?.dateFilter === 'overdue') {
            const now = new Date().toISOString()
            result = result.filter(t => !t.completed && t.end_at && t.end_at < now)
        }

        // Apply ordering based on context
        if (filters?.today) {
            result.sort((a, b) => (a.sort_order_today || 0) - (b.sort_order_today || 0))
        } else {
            result.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        }

        return result
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalTasks, filtersString])

    const createTask = useCallback((task: Partial<Task>) => {
        return globalCreateTask(task, filters?.today)
    }, [globalCreateTask, filters?.today])

    const reorderTasks = useCallback((orderedIds: string[]) => {
        return globalReorderTasks(orderedIds, filters?.today)
    }, [globalReorderTasks, filters?.today])

    const snoozeTask = useCallback(async (id: string) => {
        const task = globalTasks.find(t => t.id === id)
        if (!task) return

        const updates: Partial<Task> = { today: false }

        // If dates exist and are for today or earlier, move them forward by 1 day
        if (task.start_at) {
            const start = new Date(task.start_at)
            if (isToday(start) || isPast(start)) {
                updates.start_at = addDays(start, 1).toISOString()
            }
        }

        if (task.end_at) {
            const end = new Date(task.end_at)
            if (isToday(end) || isPast(end)) {
                updates.end_at = addDays(end, 1).toISOString()
            }
        }

        return updateTask(id, updates)
    }, [globalTasks, updateTask])

    return {
        tasks: filteredTasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        completeTask,
        reorderTasks,
        snoozeTask,
        refresh
    }
}

