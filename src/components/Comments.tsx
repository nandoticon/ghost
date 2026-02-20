import React, { useState } from 'react'
import { SlidersHorizontal, MessageSquare, Send, Pencil, Trash2, X, Check } from 'lucide-react'
import { format } from 'date-fns'
import { useComments } from '../hooks/useComments'
import { Comment } from '../types'
import { cn } from '../lib/cn'

function formatCommentTime(dateStr: string): string {
    const date = new Date(dateStr)
    // Offset for GMT-3 is handled by browser local time if configured, 
    // but the user specifically asked for GMT-3 representation.
    // Using date-fns format to show exact date and time.
    return format(date, 'dd/MM/yyyy HH:mm')
}

interface CommentsProps {
    taskId: string
}

export const Comments: React.FC<CommentsProps> = ({ taskId }) => {
    const { comments, loading, addComment, editComment, deleteComment } = useComments(taskId)
    const [newComment, setNewComment] = useState('')
    const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
    const [editText, setEditText] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(() => {
        return (localStorage.getItem('ghost_comments_sort') as 'newest' | 'oldest') || 'oldest'
    })

    const toggleSortOrder = () => {
        const nextOrder = sortOrder === 'newest' ? 'oldest' : 'newest'
        setSortOrder(nextOrder)
        localStorage.setItem('ghost_comments_sort', nextOrder)
    }

    const sortedComments = [...comments].sort((a, b) => {
        const timeA = new Date(a.created_at).getTime()
        const timeB = new Date(b.created_at).getTime()
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })

    const handleAddComment = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!newComment.trim() || isSubmitting) return

        setIsSubmitting(true)
        await addComment(newComment)
        setNewComment('')
        setIsSubmitting(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleAddComment()
        }
    }

    const startEdit = (comment: Comment) => {
        setEditingCommentId(comment.id)
        setEditText(comment.body)
        setDeleteConfirmId(null)
    }

    const saveEdit = async (id: string) => {
        if (!editText.trim()) return
        await editComment(id, editText)
        setEditingCommentId(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-[10px] uppercase font-black tracking-[0.2em] text-accent">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Comments ({comments.length})</span>
                </div>
                <button
                    onClick={toggleSortOrder}
                    className="flex items-center space-x-1.5 px-2 py-1 rounded-lg hover:bg-surface-secondary text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-primary transition-all"
                >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>Sort: {sortOrder}</span>
                </button>
            </div>

            <div className="space-y-4">
                {comments.length === 0 && !loading && (
                    <p className="text-xs text-text-muted italic px-1">No comments yet. Start the conversation.</p>
                )}

                {sortedComments.map((comment) => (
                    <div key={comment.id} className="group relative space-y-1 animate-in fade-in duration-300">
                        <div className="flex items-start justify-between group-hover:bg-surface-secondary/50 -mx-2 px-2 py-1 rounded-lg transition-colors">
                            <div className="flex-1 min-w-0">
                                {editingCommentId === comment.id ? (
                                    <div className="space-y-2 mt-1">
                                        <textarea
                                            autoFocus
                                            value={editText}
                                            onChange={(e) => setEditText(e.target.value)}
                                            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && saveEdit(comment.id)}
                                            className="w-full bg-surface border border-border rounded-lg p-2 text-sm text-text-primary focus:outline-none focus:border-accent resize-none min-h-[60px]"
                                        />
                                        <div className="flex items-center space-x-2">
                                            <button
                                                onClick={() => saveEdit(comment.id)}
                                                className="px-3 py-1 bg-accent text-white text-[10px] font-bold rounded hover:bg-accent/90"
                                            >
                                                Save
                                            </button>
                                            <button
                                                onClick={() => setEditingCommentId(null)}
                                                className="px-3 py-1 bg-surface-secondary text-text-muted text-[10px] font-bold rounded hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                                        {comment.body}
                                    </p>
                                )}

                                <div className="flex items-center space-x-3 mt-1 text-[10px] text-text-muted font-medium">
                                    <span title={format(new Date(comment.created_at), 'MMM d, yyyy · p')}>
                                        {formatCommentTime(comment.created_at)}
                                    </span>
                                    {comment.updated_at !== comment.created_at && (
                                        <span>(edited)</span>
                                    )}
                                </div>
                            </div>

                            {/* Comment Actions */}
                            {!editingCommentId && (
                                <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {deleteConfirmId === comment.id ? (
                                        <div className="flex items-center bg-surface border border-border/50 rounded-lg px-2 py-1 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                                            <span className="text-[10px] font-bold text-red-500 mr-2">Sure?</span>
                                            <button
                                                onClick={() => deleteComment(comment.id)}
                                                className="p-1 hover:text-red-500 transition-colors"
                                            >
                                                <Check className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(null)}
                                                className="p-1 hover:text-white transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => startEdit(comment)}
                                                className="p-1.5 hover:bg-surface-secondary rounded text-text-muted hover:text-white transition-colors"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(comment.id)}
                                                className="p-1.5 hover:bg-red-500/10 rounded text-text-muted hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Add Comment */}
            <form onSubmit={handleAddComment} className="relative pt-4 border-t border-border/30">
                <textarea
                    placeholder="Write a comment... (Ctrl+Enter to send)"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-surface-secondary/50 border border-border rounded-xl p-3 pr-12 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none min-h-[80px] transition-all"
                />
                <button
                    type="submit"
                    disabled={!newComment.trim() || isSubmitting}
                    className={cn(
                        "absolute bottom-4 right-3 p-2 rounded-lg transition-all active:scale-90",
                        newComment.trim() ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-white"
                    )}
                >
                    <Send className="w-4 h-4" />
                </button>
            </form>
        </div>
    )
}
