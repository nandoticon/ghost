import React, { useState, useEffect, useRef } from 'react'
import { Plus, X, Folder, Calendar } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { useToast } from './Toast'
import { cn } from '../lib/cn'

interface QuickCaptureProps {
    isOpen: boolean
    onClose: () => void
}

export function QuickCapture({ isOpen, onClose }: QuickCaptureProps) {
    const { createTask } = useTasks()
    const { projects } = useProjects()
    const { categories } = useProjectCategories()
    const { showToast } = useToast()
    const [title, setTitle] = useState('')
    const [projectId, setProjectId] = useState<string | null>(null)
    const [today, setToday] = useState(true)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen) {
            setTitle('')
            setProjectId(null)
            setToday(true)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }, [isOpen])

    const categoryMap = new Map(categories.map((category) => [category.id, category.name]))
    const selectedProject = projectId ? projects.find((project) => project.id === projectId) : null
    const selectedCategoryName =
        selectedProject?.category_id ? categoryMap.get(selectedProject.category_id) || null : null

    const handleSave = async (e?: React.FormEvent) => {
        e?.preventDefault()
        if (!title.trim()) return

        await createTask({
            title: title.trim(),
            project_id: projectId,
            today: today
        })
        showToast('Task captured ✓', 'success')
        onClose()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            <div className="relative w-full max-w-xl xl:max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <form onSubmit={handleSave} className="p-6 xl:p-8 space-y-4 xl:space-y-5">
                    <div className="flex items-center justify-between border-b border-border pb-4 mb-2">
                        <div className="flex items-center space-x-2 text-accent">
                            <Plus className="w-5 h-5" />
                            <h2 className="text-sm font-bold uppercase tracking-widest">Quick Capture</h2>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="touch-target flex items-center justify-center p-1 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="What's on your mind?"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent text-xl font-medium text-text-primary placeholder-text-muted outline-none py-2"
                    />

                    <div className="flex flex-wrap items-center gap-2 pt-2">
                        {/* Project Selector */}
                        <div className="relative group/select">
                            <select
                                value={projectId || ''}
                                onChange={(e) => setProjectId(e.target.value || null)}
                                className={cn(
                                    "pl-8 pr-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-border bg-surface-secondary transition-all appearance-none cursor-pointer",
                                    projectId ? "border-accent/50 text-accent" : "text-text-muted hover:text-white"
                                )}
                            >
                                <option value="">No Project</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.name}{p.category_id ? ` · ${categoryMap.get(p.category_id) || 'Uncategorized'}` : ''}
                                    </option>
                                ))}
                            </select>
                            <Folder className={cn(
                                "absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none",
                                projectId ? "text-accent" : "text-text-muted"
                            )} />
                        </div>

                        {selectedCategoryName && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-accent/10 border border-accent/25 text-accent">
                                {selectedCategoryName}
                            </span>
                        )}

                        {/* Today Toggle */}
                        <button
                            type="button"
                            onClick={() => setToday(!today)}
                            className={cn(
                                "flex items-center space-x-2 pl-3 pr-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all",
                                today
                                    ? "bg-accent/10 border-accent/50 text-accent"
                                    : "bg-surface-secondary border-border text-text-muted hover:text-text-primary"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Today</span>
                        </button>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-border">
                        <span className="text-xs text-text-muted font-medium italic">
                            Press <kbd className="font-sans bg-surface-secondary px-1.5 py-0.5 rounded border border-border">Enter</kbd> to save
                        </span>
                        <div className="flex items-center space-x-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-bold text-text-muted hover:text-text-primary transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!title.trim()}
                                className="px-6 py-2 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all active:scale-95"
                            >
                                Save Task
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    )
}
