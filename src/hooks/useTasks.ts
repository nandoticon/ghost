import { useMemo, useCallback } from 'react'
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

        if (filters?.status === 'active') {
            result = result.filter(t => !t.completed)
        } else if (filters?.status === 'completed') {
            result = result.filter(t => t.completed)
        } else if (filters?.completed !== undefined) {
            result = result.filter(t => t.completed === filters.completed)
        }

        if (filters?.dateFilter === 'has_date') {
            result = result.filter(t => t.start_at || t.end_at)
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

    return {
        tasks: filteredTasks,
        loading,
        createTask,
        updateTask,
        deleteTask,
        completeTask,
        reorderTasks,
        refresh
    }
}

