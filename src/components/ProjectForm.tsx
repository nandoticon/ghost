import React, { useState, useEffect } from 'react'
import { X, Check, Trash2, AlertTriangle } from 'lucide-react'
import { Project, ProjectCategory } from '../types'
import { cn } from '../lib/cn'
import { useRef } from 'react'

interface ProjectFormProps {
    isOpen: boolean
    project?: Project
    categories: ProjectCategory[]
    onSave: (project: Partial<Project>) => Promise<void>
    onCancel: () => void
    onDelete?: (id: string) => Promise<void>
}

const PRESET_COLORS = [
    '#7c6aff', // Ghost Purple
    '#ef4444', // Red
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#3b82f6', // Blue
    '#8b5cf6', // Violet
    '#ec4899', // Pink
    '#6b7280', // Gray
]

export const ProjectForm: React.FC<ProjectFormProps> = ({
    isOpen,
    project,
    categories,
    onSave,
    onCancel,
    onDelete
}) => {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState(PRESET_COLORS[0])
    const [categoryId, setCategoryId] = useState('')
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const nameInputRef = useRef<HTMLInputElement>(null)
    const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        if (project) {
            const active = document.activeElement
            const nameFocused = active === nameInputRef.current
            const descriptionFocused = active === descriptionTextareaRef.current
            if (!nameFocused) setName(project.name)
            if (!descriptionFocused) setDescription(project.description || '')
            setColor(project.color || PRESET_COLORS[0])
            setCategoryId(project.category_id || '')
        } else {
            setName('')
            setDescription('')
            setColor(PRESET_COLORS[0])
            setCategoryId('')
        }
        setShowDeleteConfirm(false)
    }, [project, isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            await onSave({
                name: name.trim(),
                description: description.trim() || null,
                color,
                category_id: categoryId || null
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDelete = async () => {
        if (!project || !onDelete) return
        setIsSubmitting(true)
        try {
            await onDelete(project.id)
        } finally {
            setIsSubmitting(false)
            setShowDeleteConfirm(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 pb-[env(safe-area-inset-bottom)] md:p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onCancel}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-surface border-t md:border border-border rounded-t-[2rem] md:rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 overflow-hidden max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:max-h-[85vh] flex flex-col">
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 65%, #ffffff))` }} />
                <div className="flex items-center justify-between p-7 border-b border-border/50 bg-surface/85 backdrop-blur">
                    <h2 className="text-xl font-bold text-text-primary">
                        {project ? 'Edit Project' : 'New Project'}
                    </h2>
                    <button onClick={onCancel} className="touch-target inline-flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-7 space-y-7 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">
                                Project Name
                            </label>
                            <input
                                ref={nameInputRef}
                                autoFocus
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Work, Personal, Fitness"
                                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Description Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">
                                Description
                            </label>
                            <textarea
                                ref={descriptionTextareaRef}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this project about?"
                                rows={3}
                                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none"
                            />
                        </div>

                        {/* Category Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">
                                Category
                            </label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all"
                            >
                                <option value="">No Category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Color Picker */}
                        <div className="space-y-3">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">
                                Theme Color
                            </label>
                            <div className="flex flex-wrap gap-2.5">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={cn(
                                            "w-9 h-9 4k:w-11 4k:h-11 rounded-full transition-all flex items-center justify-center border-2",
                                            color === c ? "border-white scale-110 shadow-lg" : "border-transparent hover:scale-105"
                                        )}
                                        style={{ backgroundColor: c }}
                                    >
                                        {color === c && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                ))}
                                {/* Custom Hex */}
                                <div className="relative flex items-center">
                                    <input
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        className="w-9 h-9 4k:w-11 4k:h-11 rounded-full border-none p-0 cursor-pointer overflow-hidden bg-transparent"
                                    />
                                    <div
                                        className="absolute inset-0 pointer-events-none rounded-full border-2 border-border/50"
                                        style={{ backgroundColor: PRESET_COLORS.includes(color) ? 'transparent' : color }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col space-y-3 pt-3">
                        <button
                            type="submit"
                            disabled={isSubmitting || !name.trim()}
                            className="w-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Project'}
                        </button>

                        {project && (
                            <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-3">
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex items-center justify-center space-x-2 w-full text-red-500 hover:text-red-400 py-1.5 text-sm font-medium transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete Project</span>
                                </button>
                            </div>
                        )}
                    </div>
                </form>

                {/* Deletion Confirmation Overlay */}
                {showDeleteConfirm && (
                    <div className="absolute inset-0 z-10 bg-background flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-200">
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">Delete Project?</h3>
                        <p className="text-sm text-text-muted mb-8 max-w-[240px]">
                            This will remove the project from all associated tasks. <span className="text-white font-medium">Tasks will not be deleted.</span>
                        </p>
                        <div className="flex flex-col w-full space-y-3">
                            <button
                                onClick={handleDelete}
                                disabled={isSubmitting}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition-all active:scale-[0.98]"
                            >
                                {isSubmitting ? 'Deleting...' : 'Yes, Delete Project'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="w-full bg-surface-secondary text-white font-bold py-3 rounded-xl hover:bg-surface-secondary/80 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
