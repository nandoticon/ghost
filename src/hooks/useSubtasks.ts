import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Subtask } from '../types'

export const useSubtasks = (taskId: string | undefined) => {
    const [subtasks, setSubtasks] = useState<Subtask[]>([])
    const [loading, setLoading] = useState(false)

    const fetchSubtasks = useCallback(async () => {
        if (!taskId || taskId.startsWith('temp-')) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('subtasks')
                .select('*')
                .eq('task_id', taskId)
                .order('sort_order', { ascending: true })

            if (error) throw error
            setSubtasks(data || [])
        } catch (error) {
            console.error('Error fetching subtasks:', error)
        } finally {
            setLoading(false)
        }
    }, [taskId])

    useEffect(() => {
        fetchSubtasks()

        if (!taskId || taskId.startsWith('temp-')) return

        const channel = supabase
            .channel(`subtasks:task_id=eq.${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'subtasks',
                    filter: `task_id=eq.${taskId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setSubtasks(prev => [...prev, payload.new as Subtask].sort((a, b) => a.sort_order - b.sort_order))
                    } else if (payload.eventType === 'UPDATE') {
                        setSubtasks(prev => prev.map(s => s.id === payload.new.id ? payload.new as Subtask : s).sort((a, b) => a.sort_order - b.sort_order))
                    } else if (payload.eventType === 'DELETE') {
                        setSubtasks(prev => prev.filter(s => s.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [taskId, fetchSubtasks])

    const addSubtask = async (title: string) => {
        if (!taskId || !title.trim()) return

        const nextSortOrder = subtasks.length > 0 ? Math.max(...subtasks.map(s => s.sort_order)) + 1 : 0
        const tempId = crypto.randomUUID()
        const now = new Date().toISOString()

        const newSubtask: Subtask = {
            id: tempId,
            task_id: taskId,
            title: title.trim(),
            completed: false,
            sort_order: nextSortOrder,
            created_at: now
        }

        setSubtasks(prev => [...prev, newSubtask])

        try {
            const { error } = await supabase
                .from('subtasks')
                .insert([{
                    task_id: taskId,
                    title: title.trim(),
                    sort_order: nextSortOrder
                }])

            if (error) throw error
        } catch (error) {
            console.error('Error adding subtask:', error)
            setSubtasks(prev => prev.filter(s => s.id !== tempId))
        }
    }

    const updateSubtask = async (id: string, updates: Partial<Subtask>) => {
        const original = subtasks.find(s => s.id === id)
        if (!original) return

        setSubtasks(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))

        try {
            const { error } = await supabase
                .from('subtasks')
                .update(updates)
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error updating subtask:', error)
            setSubtasks(prev => prev.map(s => s.id === id ? original : s))
        }
    }

    const deleteSubtask = async (id: string) => {
        const original = subtasks.find(s => s.id === id)
        if (!original) return

        setSubtasks(prev => prev.filter(s => s.id !== id))

        try {
            const { error } = await supabase
                .from('subtasks')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting subtask:', error)
            setSubtasks(prev => [...prev, original].sort((a, b) => a.sort_order - b.sort_order))
        }
    }

    const reorderSubtasks = async (orderedIds: string[]) => {
        const originalSubtasks = [...subtasks]
        const nextOrderById = new Map(orderedIds.map((id, index) => [id, index]))
        const changedIds = orderedIds.filter((id, index) => {
            const current = subtasks.find(s => s.id === id)?.sort_order ?? 0
            return current !== index
        })

        const newSubtasks = orderedIds.map((id, index) => {
            const subtask = subtasks.find(s => s.id === id)
            return subtask ? { ...subtask, sort_order: index } : null
        }).filter(Boolean) as Subtask[]

        setSubtasks(newSubtasks)

        try {
            const updates = changedIds.map((id) => {
                const index = nextOrderById.get(id)
                if (index === undefined) return Promise.resolve({ error: null })
                return supabase.from('subtasks').update({ sort_order: index }).eq('id', id)
            })
            await Promise.all(updates)
        } catch (error) {
            console.error('Error reordering subtasks:', error)
            setSubtasks(originalSubtasks)
        }
    }

    return {
        subtasks,
        loading,
        addSubtask,
        updateSubtask,
        deleteSubtask,
        reorderSubtasks
    }
}
