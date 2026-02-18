import React, { useState, useEffect } from 'react'
import { X, Check, Trash2, AlertTriangle } from 'lucide-react'
import { Project } from '../types'
import { cn } from '../lib/cn'

interface ProjectFormProps {
    isOpen: boolean
    project?: Project
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
    onSave,
    onCancel,
    onDelete
}) => {
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [color, setColor] = useState(PRESET_COLORS[0])
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (project) {
            setName(project.name)
            setDescription(project.description || '')
            setColor(project.color || PRESET_COLORS[0])
        } else {
            setName('')
            setDescription('')
            setColor(PRESET_COLORS[0])
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
                color
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onCancel}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-border/50">
                    <h2 className="text-xl font-bold text-text-primary">
                        {project ? 'Edit Project' : 'New Project'}
                    </h2>
                    <button onClick={onCancel} className="text-text-muted hover:text-text-primary transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-4">
                        {/* Name Input */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">
                                Project Name
                            </label>
                            <input
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
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="What's this project about?"
                                rows={3}
                                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all resize-none"
                            />
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

                    <div className="flex flex-col space-y-3 pt-2">
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
