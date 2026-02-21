import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Comment } from '../types'
import { useToast } from '../components/Toast'

export const useComments = (taskId: string | undefined) => {
    const [comments, setComments] = useState<Comment[]>([])
    const [loading, setLoading] = useState(false)
    const { showToast } = useToast()

    const fetchComments = useCallback(async (signal?: AbortSignal) => {
        if (!taskId) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('comments')
                .select('*')
                .eq('task_id', taskId)
                .order('created_at', { ascending: true })

            if (error) throw error
            if (!signal?.aborted) {
                setComments(data || [])
            }
        } catch (error) {
            if (!signal?.aborted) {
                console.error('Error fetching comments:', error)
            }
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }, [taskId])

    useEffect(() => {
        const controller = new AbortController()
        void fetchComments(controller.signal)

        if (!taskId) return

        // Subscribe to real-time changes
        const channel = supabase
            .channel(`comments:task_id=eq.${taskId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'comments',
                    filter: `task_id=eq.${taskId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setComments(prev => [...prev, payload.new as Comment])
                    } else if (payload.eventType === 'UPDATE') {
                        setComments(prev => prev.map(c => c.id === payload.new.id ? payload.new as Comment : c))
                    } else if (payload.eventType === 'DELETE') {
                        setComments(prev => prev.filter(c => c.id !== payload.old.id))
                    }
                }
            )
            .subscribe()

        return () => {
            controller.abort()
            supabase.removeChannel(channel)
        }
    }, [taskId, fetchComments])

    const addComment = async (body: string) => {
        if (!taskId || !body.trim()) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const tempId = crypto.randomUUID()
        const now = new Date().toISOString()

        // Optimistic Update
        const newComment: Comment = {
            id: tempId,
            task_id: taskId,
            body: body.trim(),
            created_at: now,
            updated_at: now
        }
        setComments(prev => [...prev, newComment])

        try {
            const { error } = await supabase
                .from('comments')
                .insert([{
                    task_id: taskId,
                    user_id: user.id,
                    body: body.trim()
                }])

            if (error) throw error
        } catch (error) {
            console.error('Error adding comment:', error)
            setComments(prev => prev.filter(c => c.id !== tempId)) // Rollback
            showToast('Could not add comment. Retry?', 'error', () => {
                void addComment(body)
            }, 7000)
        }
    }

    const editComment = async (id: string, body: string) => {
        if (!body.trim()) return

        const original = comments.find(c => c.id === id)
        if (!original) return

        // Optimistic Update
        setComments(prev => prev.map(c => c.id === id ? { ...c, body: body.trim() } : c))

        try {
            const { error } = await supabase
                .from('comments')
                .update({ body: body.trim(), updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error editing comment:', error)
            setComments(prev => prev.map(c => c.id === id ? original : c)) // Rollback
            showToast('Could not edit comment. Retry?', 'error', () => {
                void editComment(id, body)
            }, 7000)
        }
    }

    const deleteComment = async (id: string) => {
        const original = comments.find(c => c.id === id)
        if (!original) return

        // Optimistic Update
        setComments(prev => prev.filter(c => c.id !== id))

        try {
            const { error } = await supabase
                .from('comments')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting comment:', error)
            setComments(prev => [...prev, original]) // Rollback
            showToast('Could not delete comment. Restored.', 'error')
        }
    }

    return {
        comments,
        loading,
        addComment,
        editComment,
        deleteComment
    }
}
