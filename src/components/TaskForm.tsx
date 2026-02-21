import React, { useState, useEffect, useRef } from 'react'
import {
    X,
    ChevronDown,
    Home,
    MapPin,
    Zap,
    ZapOff,
    Target,
    Layers,
    Star,
    RefreshCw,
    Clock
} from 'lucide-react'
import { Task, Project } from '../types'
import { cn } from '../lib/cn'
import { supabase } from '../lib/supabase'
import { DateTimePicker } from './DateTimePicker'
import { StatusMenu, StatusOptions } from './StatusMenu'

interface TaskFormProps {
    task?: Task
    defaultProjectId?: string | null
    defaultToday?: boolean
    onSave: (task: Partial<Task>) => void
    onCancel: () => void
    isOpen: boolean
}

export const TaskForm = ({
    task,
    defaultProjectId,
    defaultToday = false,
    onSave,
    onCancel,
    isOpen
}: TaskFormProps) => {
    const [title, setTitle] = useState(task?.title || '')
    const [notes, setNotes] = useState(task?.notes || '')
    const [projectId, setProjectId] = useState(task?.project_id || defaultProjectId || '')
    const [today, setToday] = useState(task?.today ?? defaultToday)
    const [startAt, setStartAt] = useState(task?.start_at || '')
    const [endAt, setEndAt] = useState(task?.end_at || '')
    const [location, setLocation] = useState(task?.location || null)
    const [energy, setEnergy] = useState(task?.energy || null)
    const [focus, setFocus] = useState(task?.focus || null)
    const [recurrence, setRecurrence] = useState<'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null>(task?.recurrence || null)
    const [recurrenceEndAt, setRecurrenceEndAt] = useState(task?.recurrence_end_at || '')
    const [status, setStatus] = useState<Task['status']>(task?.status || 'todo')
    const [estimatedEffort, setEstimatedEffort] = useState(task?.estimated_effort || 0)

    const [projects, setProjects] = useState<Project[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [showStatusPicker, setShowStatusPicker] = useState(false)
    const statusPickerRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase.from('projects').select('*').order('name')
            if (data) setProjects(data)
        }
        fetchProjects()

        // Reset form if task changes
        if (task) {
            setTitle(task.title || '')
            setNotes(task.notes || '')
            setProjectId(task.project_id || '')
            setToday(task.today || false)
            setStartAt(task.start_at ? task.start_at.substring(0, 16) : '')
            setEndAt(task.end_at ? task.end_at.substring(0, 16) : '')
            setLocation(task.location || null)
            setEnergy(task.energy || null)
            setFocus(task.focus || null)
            setRecurrence(task.recurrence || null)
            setRecurrenceEndAt(task.recurrence_end_at || '')
            setStatus(task.status || 'todo')
            setEstimatedEffort(task.estimated_effort || 0)
        } else {
            setTitle('')
            setNotes('')
            setProjectId(defaultProjectId || '')
            setToday(defaultToday)
            setStartAt('')
            setEndAt('')
            setLocation(null)
            setEnergy(null)
            setFocus(null)
            setRecurrence(null)
            setRecurrenceEndAt('')
            setStatus('todo')
            setEstimatedEffort(0)
        }
    }, [task, isOpen, defaultProjectId])

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        setSubmitting(true)
        const taskData: Partial<Task> = {
            title,
            notes,
            project_id: projectId || null,
            today,
            start_at: startAt || null,
            end_at: endAt || null,
            location,
            energy,
            focus,
            recurrence,
            recurrence_end_at: recurrenceEndAt || null,
            status,
            estimated_effort: estimatedEffort
        }

        try {
            await onSave(taskData)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6 transition-all animate-in fade-in duration-200">
            <div
                className="absolute inset-0 bg-background/75 backdrop-blur-md"
                onClick={onCancel}
            />
            <div
                className="relative w-full max-w-xl 4k:max-w-2xl bg-surface border-t md:border border-border rounded-t-[2rem] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col md:max-h-[85vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-accent to-accent-warm/70" />
                <div className="flex items-center justify-between px-7 py-5 border-b border-border bg-surface/85 backdrop-blur sticky top-0 z-10">
                    <h2 className="text-lg font-bold tracking-tight text-text-primary">
                        {task ? 'Edit Task' : 'New Task'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-1 rounded-full hover:bg-surface-secondary transition-colors"
                    >
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-7 space-y-6">
                    {/* Title - Auto Focused */}
                    <div className="space-y-1">
                        <input
                            autoFocus
                            placeholder="What needs to be done?"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-transparent text-xl md:text-2xl font-bold text-text-primary placeholder:text-text-muted focus:outline-none tracking-tight"
                        />
                    </div>

                    {/* Notes */}
                    <div className="space-y-1">
                        <textarea
                            placeholder="Add notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none resize-none px-0"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Project Selector */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Project</label>
                            <div className="relative">
                                <select
                                    value={projectId}
                                    onChange={(e) => setProjectId(e.target.value)}
                                    className="w-full appearance-none bg-surface-secondary border border-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none"
                                >
                                    <option value="" className="bg-surface text-text-primary">No Project</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id} className="bg-surface text-text-primary">{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
                            </div>
                        </div>

                        {/* Today Toggle */}
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Schedule</label>
                            <button
                                type="button"
                                onClick={() => setToday(!today)}
                                className={cn(
                                    "flex w-full items-center justify-between px-4 py-2 border rounded-lg transition-all",
                                    today ? "bg-yellow-400/10 border-yellow-400/50 text-yellow-500" : "bg-surface-secondary border-border text-text-muted"
                                )}
                            >
                                <div className="flex items-center space-x-2">
                                    <Star className={cn("w-4 h-4", today && "fill-current")} />
                                    <span className="text-sm font-medium">Add to Today</span>
                                </div>
                                <div className={cn(
                                    "w-8 h-4 rounded-full relative transition-colors",
                                    today ? "bg-yellow-400" : "bg-border"
                                )}>
                                    <div className={cn(
                                        "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all",
                                        today ? "right-0.5" : "left-0.5"
                                    )} />
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Start</label>
                            <DateTimePicker
                                value={startAt}
                                onChange={setStartAt}
                                placeholder="Start Date & Time"
                                className="bg-surface-secondary border-border"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted">End</label>
                            <DateTimePicker
                                value={endAt}
                                onChange={setEndAt}
                                placeholder="Due Date & Time"
                                className="bg-surface-secondary border-border"
                            />
                        </div>
                    </div>

                    {/* Context Pills */}
                    <div className="space-y-4 pt-2 border-t border-border/50">
                        <h3 className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Fields</h3>

                        <div className="space-y-4">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-primary font-medium">Status</span>
                                <div className="relative">
                                    <button
                                        type="button"
                                        ref={statusPickerRef}
                                        onClick={() => setShowStatusPicker(!showStatusPicker)}
                                        className="flex items-center space-x-2 px-3 py-1.5 bg-surface-secondary/50 rounded-lg border border-border transition-all group hover:bg-surface-secondary"
                                    >
                                        {StatusOptions.find(opt => opt.value === status)?.icon && (() => {
                                            const Icon = StatusOptions.find(opt => opt.value === status)!.icon
                                            const color = StatusOptions.find(opt => opt.value === status)!.color
                                            return <Icon className={cn("w-3.5 h-3.5", color)} />
                                        })()}
                                        <span className={cn("text-xs font-medium uppercase tracking-wider", StatusOptions.find(opt => opt.value === status)?.color)}>
                                            {StatusOptions.find(opt => opt.value === status)?.label}
                                        </span>
                                    </button>
                                    <StatusMenu
                                        isOpen={showStatusPicker}
                                        onClose={() => setShowStatusPicker(false)}
                                        triggerRef={statusPickerRef}
                                        currentStatus={status}
                                        onSelect={(newStatus) => setStatus(newStatus)}
                                    />
                                </div>
                            </div>

                            {/* Location */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-primary font-medium">Location</span>
                                <div className="flex bg-surface-secondary/50 p-1 rounded-lg border border-border">
                                    {[null, 'home', 'outside'].map((val) => (
                                        <button
                                            key={String(val)}
                                            type="button"
                                            onClick={() => setLocation(val as 'home' | 'outside' | null)}
                                            className={cn(
                                                "flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-all",
                                                location === val ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                                            )}
                                        >
                                            {val === 'home' && <Home className="w-3 h-3" />}
                                            {val === 'outside' && <MapPin className="w-3 h-3" />}
                                            <span>{val ? (val.charAt(0).toUpperCase() + val.slice(1)) : 'None'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Energy */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-primary font-medium">Energy</span>
                                <div className="flex bg-surface-secondary/50 p-1 rounded-lg border border-border">
                                    {[null, 'high', 'low'].map((val) => (
                                        <button
                                            key={String(val)}
                                            type="button"
                                            onClick={() => setEnergy(val as 'high' | 'low' | null)}
                                            className={cn(
                                                "flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-all",
                                                energy === val ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                                            )}
                                        >
                                            {val === 'high' && <Zap className="w-3 h-3" />}
                                            {val === 'low' && <ZapOff className="w-3 h-3" />}
                                            <span>{val ? (val.charAt(0).toUpperCase() + val.slice(1)) : 'None'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Focus */}
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-text-primary font-medium">Focus</span>
                                <div className="flex bg-surface-secondary/50 p-1 rounded-lg border border-border">
                                    {[null, 'immersion', 'process'].map((val) => (
                                        <button
                                            key={String(val)}
                                            type="button"
                                            onClick={() => setFocus(val as 'immersion' | 'process' | null)}
                                            className={cn(
                                                "flex items-center space-x-1.5 px-3 py-1 rounded text-xs transition-all",
                                                focus === val ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
                                            )}
                                        >
                                            {val === 'immersion' && <Target className="w-3 h-3" />}
                                            {val === 'process' && <Layers className="w-3 h-3" />}
                                            <span>{val ? (val.charAt(0).toUpperCase() + val.slice(1)) : 'None'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Estimated Effort */}
                            <div className="flex flex-col space-y-3 pt-4 border-t border-border/50">
                                <div className="flex items-center space-x-2">
                                    <Clock className="w-3.5 h-3.5 text-text-muted" />
                                    <span className="text-xs text-text-primary font-medium">Estimated Effort</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {[5, 15, 30, 60, 120, 240].map((mins) => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setEstimatedEffort(estimatedEffort === mins ? 0 : mins)}
                                            className={cn(
                                                "px-3 py-1.5 rounded-lg border text-xs font-bold transition-all",
                                                estimatedEffort === mins
                                                    ? "bg-accent-warm/20 border-accent-warm/40 text-accent-warm"
                                                    : "bg-surface-secondary border-border text-text-muted hover:text-text-primary hover:border-border"
                                            )}
                                        >
                                            {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Recurrence */}
                            <div className="pt-4 border-t border-border/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                        <RefreshCw className="w-3.5 h-3.5 text-text-muted" />
                                        <span className="text-xs text-text-primary font-medium">Repeat</span>
                                    </div>
                                    <select
                                        value={recurrence || ''}
                                        onChange={(e) => setRecurrence((e.target.value || null) as 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null)}
                                        className="bg-surface-secondary border border-border rounded-lg px-3 py-1 text-xs text-text-primary focus:border-accent outline-none appearance-none cursor-pointer"
                                    >
                                        <option value="">None</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekdays">Weekdays</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="yearly">Yearly</option>
                                    </select>
                                </div>

                                {recurrence && (
                                    <div className="flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
                                        <span className="text-xs text-text-primary font-medium shrink-0 mr-4">End Repeat</span>
                                        <DateTimePicker
                                            value={recurrenceEndAt}
                                            onChange={setRecurrenceEndAt}
                                            placeholder="Ends Never"
                                            className="bg-surface-secondary border-border"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                <div className="p-7 border-t border-border bg-surface/85 backdrop-blur flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-6 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        type="button"
                        disabled={submitting || !title.trim()}
                        className={cn(
                            "px-8 py-2 rounded-full bg-accent text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                            !submitting && "hover:bg-accent/90"
                        )}
                    >
                        {submitting ? 'Saving...' : (task ? 'Update Task' : 'Create Task')}
                    </button>
                </div>
            </div>
        </div>
    )
}
