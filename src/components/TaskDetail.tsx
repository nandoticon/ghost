import { useState, useEffect, useRef, FC } from 'react'
import { supabase } from '../lib/supabase'
import {
    X,
    MoreVertical,
    Check,
    Calendar,
    Home,
    MapPin,
    Zap,
    ZapOff,
    Target,
    Layers,
    Star,
    Trash2,
    Copy,
    ChevronDown,
    Clock,
    Plus,
    CheckCircle2,
    Circle,
    GripVertical,
    RefreshCw
} from 'lucide-react'
import { Task } from '../types'
import { useTasks } from '../hooks/useTasks'
import { useTaskById } from '../hooks/useTaskById'
import { useProjects } from '../hooks/useProjects'
import { useSubtasks } from '../hooks/useSubtasks'
import { useToast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { Comments } from './Comments'
import { cn } from '../lib/cn'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'

interface TaskDetailProps {
    taskId: string | null
    onClose: () => void
}

export const TaskDetail: FC<TaskDetailProps> = ({ taskId, onClose }) => {
    // Direct single-task query — avoids loading all tasks just to find one
    const { task, updateTaskField } = useTaskById(taskId)
    // Keep useTasks only for actions that affect the task list (delete, complete, create)
    const { deleteTask, completeTask, createTask } = useTasks()
    const { projects } = useProjects()
    const { subtasks, addSubtask, updateSubtask, deleteSubtask, reorderSubtasks } = useSubtasks(taskId || undefined)
    const { showToast } = useToast()

    // Local state for inline editing
    const [title, setTitle] = useState('')
    const [notes, setNotes] = useState('')
    const [projectId, setProjectId] = useState<string | null>(null)
    const [today, setToday] = useState(false)
    const [startAt, setStartAt] = useState('')
    const [endAt, setEndAt] = useState('')
    const [location, setLocation] = useState<'home' | 'outside' | null>(null)
    const [energy, setEnergy] = useState<'high' | 'low' | null>(null)
    const [focus, setFocus] = useState<'immersion' | 'process' | null>(null)
    const [recurrence, setRecurrence] = useState<'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null>(null)
    const [recurrenceEndAt, setRecurrenceEndAt] = useState('')
    const [completed, setCompleted] = useState(false)

    const [showMenu, setShowMenu] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Handle initialization and external updates
    useEffect(() => {
        if (task) {
            setTitle(task.title)
            setNotes(task.notes || '')
            setProjectId(task.project_id)
            setToday(task.today)
            setStartAt(task.start_at ? task.start_at.substring(0, 16) : '')
            setEndAt(task.end_at ? task.end_at.substring(0, 16) : '')
            setLocation(task.location)
            setEnergy(task.energy)
            setFocus(task.focus)
            setRecurrence(task.recurrence)
            setRecurrenceEndAt(task.recurrence_end_at || '')
            setCompleted(task.completed)
        }
    }, [task])

    // Auto-save logic with debounce
    const timerRef = useRef<number | null>(null)

    const triggerSave = (updates: Partial<Task>) => {
        if (!taskId) return
        setIsSaving(true)
        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(async () => {
            await updateTaskField(updates)
            setIsSaving(false)
        }, 500)
    }

    // Explicit effect handlers for each field to avoid bulk-overwrite race conditions
    const handleTitleChange = (val: string) => {
        setTitle(val)
        triggerSave({ title: val.trim() || 'Untitled Task' })
    }

    const handleNotesChange = (val: string) => {
        setNotes(val)
        triggerSave({ notes: val.trim() || null })
    }

    const handleFieldUpdate = (field: keyof Task, val: Task[keyof Task]) => {
        triggerSave({ [field]: val })
    }

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    if (!taskId) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "relative flex flex-col bg-surface border-t md:border-t-0 md:border-l border-border h-[90vh] md:h-full w-full md:w-[440px] xl:w-[560px] shadow-2xl transition-transform duration-300 ease-out overflow-x-hidden",
                    "animate-in slide-in-from-bottom md:slide-in-from-right",
                    "rounded-t-[2.5rem] md:rounded-none"
                )}
            >
                {/* Mobile Drag Handle */}
                <div className="md:hidden flex justify-center py-4">
                    <div className="w-12 h-1.5 bg-border rounded-full" />
                </div>

                {/* Header */}
                <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 sticky top-0 bg-surface/80 backdrop-blur-xl z-20">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <button
                            onClick={async () => {
                                if (!taskId) return
                                const res = await completeTask(taskId, !completed)
                                if (res.success && res.nextOccurrenceCreated) {
                                    const dateStr = res.nextOccurrenceDate ? new Date(res.nextOccurrenceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'the future'
                                    showToast(`Task completed · Next on ${dateStr}`, 'success')
                                }
                            }}
                            className={cn(
                                "w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0",
                                completed ? "bg-accent border-accent text-white" : "border-border hover:border-accent"
                            )}
                        >
                            {completed && <Check className="w-4 h-4" />}
                        </button>
                        <input
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Task title"
                            className="bg-transparent text-lg font-bold text-text-primary outline-none w-full truncate focus:text-accent transition-colors"
                        />
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-colors"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-30 py-2 animate-in zoom-in-95 duration-200">
                                        <button
                                            onClick={async () => {
                                                if (task) {
                                                    await createTask({ ...task, id: undefined, created_at: undefined, updated_at: undefined })
                                                    setShowMenu(false)
                                                }
                                            }}
                                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                                        >
                                            <Copy className="w-4 h-4" />
                                            <span>Duplicate Task</span>
                                        </button>
                                        <div className="h-px bg-border/50 my-1" />
                                        <button
                                            onClick={() => {
                                                setShowMenu(false)
                                                setShowDeleteConfirm(true)
                                            }}
                                            className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Delete Task</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 pb-12">
                    {/* Recurrence Banner */}
                    {recurrence && (
                        <div className="flex items-center space-x-3 px-4 py-3 bg-accent/5 rounded-2xl border border-accent/20 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="p-2 bg-accent/10 rounded-xl">
                                <RefreshCw className="w-4 h-4 text-accent animate-spin-slow" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-text-primary">Recurring Task</p>
                                <p className="text-xs text-text-muted">This task repeats {recurrence}.</p>
                            </div>
                        </div>
                    )}

                    {/* Metadata Section */}
                    <div className="space-y-6">
                        {/* Project */}
                        <div className="grid grid-cols-[100px,1fr] items-center gap-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Project</span>
                            <div className="relative group">
                                <select
                                    value={projectId || ''}
                                    onChange={(e) => handleFieldUpdate('project_id', e.target.value || null)}
                                    className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-2 text-sm text-text-primary appearance-none focus:border-accent/50 outline-none transition-all pr-10"
                                >
                                    <option value="">No Project</option>
                                    {projects.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-primary transition-colors" />
                            </div>
                        </div>

                        {/* Today Toggle */}
                        <div className="grid grid-cols-[100px,1fr] items-center gap-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Schedule</span>
                            <button
                                onClick={() => handleFieldUpdate('today', !today)}
                                className={cn(
                                    "flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all w-fit",
                                    today ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 shadow-lg shadow-yellow-400/5 scale-105" : "bg-surface-secondary border-border text-text-muted hover:text-text-primary"
                                )}
                            >
                                <Star className={cn("w-4 h-4", today && "fill-current")} />
                                <span className="text-xs font-bold uppercase tracking-wider">Today</span>
                            </button>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-[100px,1fr] items-start gap-4">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted mt-2.5">Timeline</span>
                            <div className="space-y-3">
                                <div className="relative group">
                                    <input
                                        type="datetime-local"
                                        value={startAt}
                                        onChange={(e) => {
                                            setStartAt(e.target.value)
                                            handleFieldUpdate('start_at', e.target.value || null)
                                        }}
                                        className="w-full bg-surface-secondary border border-border rounded-xl px-10 py-2.5 text-xs text-text-primary focus:border-accent/50 outline-none transition-all"
                                    />
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                    {!startAt && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">Add start date</span>}
                                </div>
                                <div className="relative group">
                                    <input
                                        type="datetime-local"
                                        value={endAt}
                                        onChange={(e) => {
                                            setEndAt(e.target.value)
                                            handleFieldUpdate('end_at', e.target.value || null)
                                        }}
                                        className="w-full bg-surface-secondary border border-border rounded-xl px-10 py-2.5 text-xs text-text-primary focus:border-accent/50 outline-none transition-all"
                                    />
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                    {!endAt && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none">Add end date</span>}
                                </div>
                            </div>
                        </div>

                        {/* Pills */}
                        <div className="space-y-4">
                            <PillGroup
                                label="Location"
                                value={location}
                                options={[
                                    { value: 'home', icon: <Home className="w-3 h-3" />, label: 'Home' },
                                    { value: 'outside', icon: <MapPin className="w-3 h-3" />, label: 'Outside' }
                                ]}
                                onChange={(val) => handleFieldUpdate('location', val)}
                            />
                            <PillGroup
                                label="Energy"
                                value={energy}
                                options={[
                                    { value: 'high', icon: <Zap className="w-3 h-3" />, label: 'High' },
                                    { value: 'low', icon: <ZapOff className="w-3 h-3" />, label: 'Low' }
                                ]}
                                onChange={(val) => handleFieldUpdate('energy', val)}
                            />
                            <PillGroup
                                label="Focus"
                                value={focus}
                                options={[
                                    { value: 'immersion', icon: <Target className="w-3 h-3" />, label: 'Immersion' },
                                    { value: 'process', icon: <Layers className="w-3 h-3" />, label: 'Process' }
                                ]}
                                onChange={(val) => handleFieldUpdate('focus', val)}
                            />

                            {/* Recurrence Selection */}
                            <div className="pt-4 border-t border-border/30 space-y-4">
                                <div className="grid grid-cols-[100px,1fr] items-center gap-4">
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Repeat</span>
                                    <div className="relative group">
                                        <select
                                            value={recurrence || ''}
                                            onChange={(e) => {
                                                const val = (e.target.value || null) as 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null
                                                setRecurrence(val)
                                                handleFieldUpdate('recurrence', val)
                                            }}
                                            className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-2 text-sm text-text-primary appearance-none focus:border-accent/50 outline-none transition-all pr-10"
                                        >
                                            <option value="">None</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekdays">Weekdays</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="monthly">Monthly</option>
                                            <option value="yearly">Yearly</option>
                                        </select>
                                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-primary transition-colors" />
                                    </div>
                                </div>

                                {recurrence && (
                                    <div className="grid grid-cols-[100px,1fr] items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Ends</span>
                                        <div className="relative group">
                                            <input
                                                type="date"
                                                value={recurrenceEndAt}
                                                onChange={(e) => {
                                                    setRecurrenceEndAt(e.target.value)
                                                    handleFieldUpdate('recurrence_end_at', e.target.value || null)
                                                }}
                                                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-2 text-xs text-text-primary focus:border-accent/50 outline-none transition-all"
                                            />
                                            {!recurrenceEndAt && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-text-muted pointer-events-none">Never</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    <div className="space-y-3">
                        <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => handleNotesChange(e.target.value)}
                            onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && (e.target as HTMLTextAreaElement).blur()}
                            placeholder="Add notes..."
                            className="w-full bg-surface-secondary/50 border border-border rounded-2xl p-4 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 resize-none min-h-[120px] transition-all"
                        />
                    </div>

                    {/* Subtasks Section */}
                    <div className="space-y-4 pt-4 border-t border-border/30">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Subtasks</h3>
                            {subtasks.length > 0 && (
                                <span className="text-[10px] font-bold text-accent">
                                    {subtasks.filter(s => s.completed).length}/{subtasks.length}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            <DragDropContext onDragEnd={(result) => {
                                if (!result.destination) return
                                const items = Array.from(subtasks)
                                const [reorderedItem] = items.splice(result.source.index, 1)
                                items.splice(result.destination.index, 0, reorderedItem)
                                reorderSubtasks(items.map(i => i.id))
                            }}>
                                <Droppable droppableId="subtasks-list">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                            {subtasks.map((subtask, index) => (
                                                <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                                                    {(provided, snapshot) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            className={cn(
                                                                "flex items-center space-x-3 p-2 rounded-xl group/sub transition-colors",
                                                                snapshot.isDragging ? "bg-surface-secondary shadow-lg" : "hover:bg-surface-secondary/30"
                                                            )}
                                                        >
                                                            <div {...provided.dragHandleProps} className="text-text-muted opacity-0 group-hover/sub:opacity-40 transition-opacity cursor-grab">
                                                                <GripVertical className="w-3.5 h-3.5" />
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    updateSubtask(subtask.id, { completed: !subtask.completed })
                                                                }}
                                                                className="text-text-muted hover:text-accent transition-colors"
                                                            >
                                                                {subtask.completed ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Circle className="w-4 h-4" />}
                                                            </button>
                                                            <input
                                                                type="text"
                                                                value={subtask.title}
                                                                onChange={(e) => updateSubtask(subtask.id, { title: e.target.value })}
                                                                className={cn(
                                                                    "flex-1 bg-transparent text-sm text-text-primary outline-none",
                                                                    subtask.completed && "line-through text-text-muted"
                                                                )}
                                                            />
                                                            <button
                                                                onClick={() => deleteSubtask(subtask.id)}
                                                                className="p-1 text-text-muted hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-opacity"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>

                            <div className="flex items-center space-x-3 px-10 py-2">
                                <Plus className="w-3.5 h-3.5 text-text-muted opacity-40" />
                                <input
                                    type="text"
                                    placeholder="Add a subtask..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const input = e.target as HTMLInputElement
                                            if (input.value.trim()) {
                                                addSubtask(input.value.trim())
                                                input.value = ''
                                            }
                                        }
                                    }}
                                    className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Comments Section */}
                    <div className="pt-4 border-t border-border/30">
                        {taskId && <Comments taskId={taskId} />}
                    </div>
                </div>

                {/* Footer / Saving Indicator */}
                <div className="px-6 py-3 border-t border-border/30 bg-surface-secondary/30 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        {isSaving ? (
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Auto-saving...</span>
                            </div>
                        ) : (
                            <div className="flex items-center space-x-2 text-text-muted">
                                <Check className="w-3 h-3" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Changes saved</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && task && taskId && (
                task.recurrence ? (
                    <ConfirmModal
                        title="Delete recurring task?"
                        description="Choose how to delete this recurring task."
                        options={[
                            {
                                label: 'Delete just this task',
                                description: 'Only this occurrence will be removed.',
                                variant: 'default',
                                onClick: async () => {
                                    try {
                                        await deleteTask(taskId)
                                        showToast('Task deleted', 'info')
                                        setShowDeleteConfirm(false)
                                        onClose()
                                    } catch (_err) {
                                        showToast('Failed to delete task', 'error')
                                    }
                                }
                            },
                            {
                                label: 'Delete this and all future occurrences',
                                description: 'All upcoming repeats will also be removed.',
                                variant: 'danger',
                                onClick: async () => {
                                    try {
                                        const { error } = await supabase
                                            .from('tasks')
                                            .delete()
                                            .or(`id.eq.${taskId},parent_task_id.eq.${taskId}`)
                                        if (error) throw error
                                        showToast('Recurring task deleted', 'info')
                                        setShowDeleteConfirm(false)
                                        onClose()
                                    } catch (_err) {
                                        showToast('Failed to delete task', 'error')
                                    }
                                }
                            }
                        ]}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                ) : (
                    <ConfirmModal
                        title="Delete task?"
                        description={`"${task.title}" will be permanently deleted.`}
                        options={[{
                            label: 'Delete task',
                            variant: 'danger',
                            onClick: async () => {
                                const snapshot = { ...task }
                                setShowDeleteConfirm(false)
                                onClose()
                                await deleteTask(taskId)
                                showToast(
                                    'Task deleted',
                                    'info',
                                    async () => {
                                        await createTask({
                                            ...snapshot,
                                            id: undefined,
                                            created_at: undefined,
                                            updated_at: undefined
                                        })
                                    },
                                    5000
                                )
                            }
                        }]}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                )
            )}
        </div>
    )
}

function PillGroup<T>({ label, value, options, onChange }: {
    label: string,
    value: T | null,
    options: { value: T, icon: React.ReactNode, label: string }[],
    onChange: (val: T | null) => void
}) {
    return (
        <div className="grid grid-cols-[100px,1fr] items-center gap-4">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">{label}</span>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={String(opt.value)}
                        onClick={() => onChange(value === opt.value ? null : opt.value)}
                        className={cn(
                            "flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all",
                            value === opt.value
                                ? "bg-accent border-accent text-white shadow-lg shadow-accent/10 scale-105"
                                : "bg-surface-secondary border-border text-text-muted hover:text-white hover:border-text-muted"
                        )}
                    >
                        {opt.icon}
                        <span>{opt.label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}
