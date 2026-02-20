import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

interface ProjectTaskStats {
    total: number
    completed: number
    progress: number
}

export function useProjectTaskStats() {
    const { user } = useAuth()
    const [statsByProject, setStatsByProject] = useState<Record<string, ProjectTaskStats>>({})
    const [loading, setLoading] = useState(true)

    const fetchStats = useCallback(async () => {
        if (!user) {
            setStatsByProject({})
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('project_id, completed')
                .eq('user_id', user.id)
                .not('project_id', 'is', null)

            if (error) throw error

            const acc: Record<string, { total: number; completed: number }> = {}
            for (const row of data ?? []) {
                const projectId = row.project_id as string | null
                if (!projectId) continue

                if (!acc[projectId]) {
                    acc[projectId] = { total: 0, completed: 0 }
                }

                acc[projectId].total += 1
                if (row.completed) acc[projectId].completed += 1
            }

            const normalized: Record<string, ProjectTaskStats> = {}
            for (const [projectId, counts] of Object.entries(acc)) {
                normalized[projectId] = {
                    total: counts.total,
                    completed: counts.completed,
                    progress: counts.total > 0 ? (counts.completed / counts.total) * 100 : 0,
                }
            }

            setStatsByProject(normalized)
        } catch (error) {
            console.error('Error fetching project task stats:', error)
            setStatsByProject({})
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        void fetchStats()
    }, [fetchStats])

    const getStats = useMemo(
        () => (projectId: string): ProjectTaskStats => {
            return statsByProject[projectId] ?? { total: 0, completed: 0, progress: 0 }
        },
        [statsByProject]
    )

    return {
        loading,
        getStats,
        refresh: fetchStats,
    }
}
