import { useState, useEffect, useRef, FC } from 'react'
import { supabase } from '../lib/supabase'
import {
    X, MoreVertical, Check, Calendar, Home, MapPin, Zap, ZapOff,
    Target, Layers, Star, Trash2, Copy, ChevronDown, Plus,
    CheckCircle2, Circle, Clock, GripVertical, RefreshCw, FolderKanban,
    SlidersHorizontal, Search, Sparkles, Loader2, Play, Pause
} from 'lucide-react'
import { Task } from '../types'
import { useTasks } from '../hooks/useTasks'
import { useTaskById } from '../hooks/useTaskById'
import { useProjects } from '../hooks/useProjects'
import { useSubtasks } from '../hooks/useSubtasks'
import { useComments } from '../hooks/useComments'
import { useToast } from './Toast'
import { ConfirmModal } from './ConfirmModal'
import { Comments } from './Comments'
import { DateTimePicker } from './DateTimePicker'
import { StatusMenu, StatusOptions } from './StatusMenu'
import { cn } from '../lib/cn'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { useTimer } from '../context/TimerContext'

interface TaskDetailProps {
    taskId: string | null
    onClose: () => void
}

export const TaskDetail: FC<TaskDetailProps> = ({ taskId, onClose }) => {
    const { task, updateTaskField } = useTaskById(taskId)
    const { deleteTask, completeTask, createTask } = useTasks()
    const { projects, createProject } = useProjects()
    const { subtasks, addSubtask, updateSubtask, deleteSubtask, reorderSubtasks } = useSubtasks(task?.id)
    const { comments } = useComments(task?.id)
    const { showToast } = useToast()
    const { activeSession, elapsedSeconds, toggleTimer, isSyncing: isTimerSyncing } = useTimer()
    const isTimerActiveForTask = activeSession?.task_id === taskId

    // Local state
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
    const [status, setStatus] = useState<Task['status']>('todo')
    const [estimatedEffort, setEstimatedEffort] = useState<number | null>(0)

    // UI state
    const [showMenu, setShowMenu] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [completionPulse, setCompletionPulse] = useState(false)
    const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false)

    // Custom Popover states
    const [showProjectPicker, setShowProjectPicker] = useState(false)
    const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
    const [showStatusPicker, setShowStatusPicker] = useState(false)
    const [projectSearch, setProjectSearch] = useState('')
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    const statusPickerRef = useRef<HTMLButtonElement>(null)

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
            setStatus(task.status)
            setEstimatedEffort(task.estimated_effort || 0)
        }
    }, [task])

    const timerRef = useRef<number | null>(null)
    const pendingUpdatesRef = useRef<Partial<Task>>({})

    const formatElapsed = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    }

    const triggerSave = (updates: Partial<Task>) => {
        if (!taskId) return

        // Accumulate updates so we don't clobber rapid changes
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }

        setIsSaving(true)
        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(async () => {
            const finalUpdates = { ...pendingUpdatesRef.current }
            // Clear the accumulator before the async call to allow new updates to start fresh
            pendingUpdatesRef.current = {}

            await updateTaskField(finalUpdates)
            setIsSaving(false)
        }, 600)
    }

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

    const generateSubtasks = async () => {
        if (!title.trim() || !taskId) return

        setIsGeneratingSubtasks(true)
        try {
            const context = [
                `Status: ${status}`,
                `Recommended energy: ${energy || 'Any'}`,
                `Focus mode: ${focus || 'Standard'}`,
                `Location context: ${location || 'Anywhere'}`,
                `Marked as today's sprint: ${today ? 'Yes' : 'No'}`,
                startAt ? `Start date: ${startAt}` : null,
                endAt ? `Due date: ${endAt}` : null,
                subtasks.length > 0 ? `Current subtasks (DO NOT DUPLICATE THESE): ${subtasks.map(s => s.title).join(', ')}` : null,
                comments.length > 0 ? `Recent discussion/context: ${comments.slice(-5).map(c => c.body).join(' | ')}` : null
            ].filter(Boolean).join('\n')

            const prompt = `You are an ADHD coach that breaks down overwhelming tasks into bite-sized, incredibly actionable, and satisfyingly simple steps. 
            
TASK CONTEXT:
${context}

THE MAIN TASK IS: "${title}"
USER'S ADDITIONAL NOTES: "${notes || 'No additional notes'}"

GOAL:
Generate 3-5 very specific, action-oriented subtasks for this. 
CRITICAL RULES:
1. They MUST be something I can do immediately without much thought.
2. Don't make them too broad.
3. DO NOT repeat any existing subtasks listed above.
4. Consider the user's energy, focus, and recent comments to make the steps tailored.

Format your response as a simple list separated by newlines, with NO formatting, bullets, or numbers. Just the raw text of the subtasks. For example:
Find the folder
Open the first document
Write the title
Click save`

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=AIzaSyA6CM4aSu-AMNgPbs3I8A_ljkX1Th4O8MU`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            })

            const data = await response.json()
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                const subtaskLines = data.candidates[0].content.parts[0].text
                    .split('\n')
                    .map((s: string) => s.trim().replace(/^[-*•]/, '').trim())
                    .filter((s: string) => s.length > 0)

                for (const st of subtaskLines) {
                    await addSubtask(st)
                }
                showToast("Magic Breakdown complete! 🪄", "success")
            } else {
                showToast("Could not generate subtasks.", "error")
            }
        } catch (error) {
            console.error(error)
            showToast("Failed to connect to AI.", "error")
        } finally {
            setIsGeneratingSubtasks(false)
        }
    }

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showProjectPicker) setShowProjectPicker(false)
                else if (showRecurrencePicker) setShowRecurrencePicker(false)
                else if (showStatusPicker) setShowStatusPicker(false)
                else if (showMenu) setShowMenu(false)
                else onClose()
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (taskId) {
                    completeTask(taskId, !completed)
                    onClose()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [onClose, showProjectPicker, showRecurrencePicker, showStatusPicker, showMenu, taskId, completed, completeTask])

    if (!taskId) return null

    const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
    const canCreateProject = projectSearch.trim().length > 0 && !projects.some(
        p => p.name.toLowerCase() === projectSearch.trim().toLowerCase()
    )

    const createProjectFromSearch = async () => {
        const name = projectSearch.trim()
        if (!name || isCreatingProject) return

        const existing = projects.find((p) => p.name.toLowerCase() === name.toLowerCase())
        if (existing) {
            setProjectId(existing.id)
            handleFieldUpdate('project_id', existing.id)
            setShowProjectPicker(false)
            setProjectSearch('')
            return
        }

        setIsCreatingProject(true)
        try {
            const created = await createProject({
                name,
                color: '#7c6aff',
            })
            if (created?.id) {
                setProjectId(created.id)
                handleFieldUpdate('project_id', created.id)
                setShowProjectPicker(false)
                setProjectSearch('')
            }
        } finally {
            setIsCreatingProject(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Slide-over Panel */}
            <div
                className={cn(
                    "relative flex flex-col bg-surface border-l border-border h-full w-full max-w-[900px] shadow-2xl overflow-hidden overflow-x-hidden",
                    "animate-in slide-in-from-right duration-300"
                )}
            >
                {/* Header */}
                <header className="flex items-start justify-between gap-2 px-4 md:px-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 border-b border-transparent z-20 shrink-0">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-wrap">
                        <button
                            onClick={async () => {
                                if (!taskId) return
                                const nextCompleted = !completed
                                setCompleted(nextCompleted)
                                if (nextCompleted) {
                                    setCompletionPulse(true)
                                    setTimeout(() => setCompletionPulse(false), 450)
                                }
                                const res = await completeTask(taskId, nextCompleted)
                                if (res.success && res.nextOccurrenceCreated) {
                                    const dateStr = res.nextOccurrenceDate ? new Date(res.nextOccurrenceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'the future'
                                    showToast(`Task completed · Next on ${dateStr}`, 'success')
                                }
                            }}
                            className={cn(
                                "touch-target relative w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                                completed ? "bg-accent-warm border-accent-warm text-white" : "border-text-muted/40 hover:border-accent-warm"
                            )}
                            title="Complete Task (Ctrl+Enter)"
                        >
                            {completionPulse && (
                                <span
                                    className="absolute inset-0 rounded-md border-2 border-accent-warm/50 pointer-events-none"
                                    style={{ animation: 'ring-pulse 0.45s ease-out forwards' }}
                                />
                            )}
                            {completed && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <span className="text-[11px] md:text-xs font-mono text-text-muted/50 tracking-wider shrink-0">
                            {task?.short_id || taskId.substring(0, 8)}
                        </span>
                        {taskId && (
                            <button
                                onClick={() => void toggleTimer(taskId, 'task_detail')}
                                disabled={isTimerSyncing}
                                className={cn(
                                    "touch-target inline-flex items-center gap-1.5 px-2 md:px-2.5 rounded-lg border text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                                    isTimerActiveForTask
                                        ? "bg-emerald-400/10 border-emerald-300/25 text-emerald-300"
                                        : "bg-surface-secondary/60 border-border/60 text-text-muted hover:text-text-primary",
                                    isTimerSyncing && "opacity-60 cursor-not-allowed"
                                )}
                                title={isTimerActiveForTask ? 'Stop timer' : 'Start timer'}
                            >
                                {isTimerActiveForTask ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                                <span>{isTimerActiveForTask ? formatElapsed(elapsedSeconds) : 'Track'}</span>
                            </button>
                        )}

                        {/* Saving Indicator */}
                        <div className="ml-1 md:ml-3 flex items-center h-4 shrink-0">
                            {isSaving ? (
                                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" title="Saving..." />
                            ) : (
                                <div title="Saved"><Check className="w-3.5 h-3.5 text-text-muted/30" /></div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-0.5 md:space-x-1 shrink-0">
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="touch-target flex items-center justify-center p-2 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors"
                            >
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 mt-1 w-48 bg-surface border border-border rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-[70] py-1 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={async () => {
                                                if (task) {
                                                    await createTask({ ...task, id: undefined, created_at: undefined, updated_at: undefined })
                                                    setShowMenu(false)
                                                }
                                            }}
                                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                                        >
                                            <Copy className="w-4 h-4 text-text-muted" />
                                            <span>Duplicate Task</span>
                                        </button>
                                        <div className="h-px bg-border/50 my-1" />
                                        <button
                                            onClick={() => {
                                                setShowMenu(false)
                                                setShowDeleteConfirm(true)
                                            }}
                                            className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            <span>Delete Task</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={onClose} className="touch-target flex items-center justify-center p-2 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                {/* Content Area - 2 Columns */}
                <div className="flex flex-1 overflow-hidden overflow-x-hidden flex-col md:flex-row min-w-0">

                    {/* LEFTSIDE: Main Content */}
                    <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-10 space-y-10">
                        {/* Title & Description */}
                        <div className="space-y-6">
                            <textarea
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Task title"
                                rows={1}
                                className="bg-transparent text-3xl md:text-5xl font-black text-text-primary outline-none w-full resize-none focus:text-accent transition-colors py-2"
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                }}
                            />

                            <textarea
                                value={notes}
                                onChange={(e) => handleNotesChange(e.target.value)}
                                placeholder="Add description, notes, or links..."
                                className="w-full bg-transparent p-0 text-base md:text-lg text-text-primary placeholder:text-text-muted/50 focus:outline-none resize-none min-h-[100px] transition-all"
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = target.scrollHeight + 'px';
                                }}
                            />
                        </div>

                        {/* Subtasks (Inline) */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-accent" />
                                    Subtasks
                                </h3>
                                {subtasks.length > 0 && (
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                        {subtasks.filter(s => s.completed).length}/{subtasks.length}
                                    </span>
                                )}
                            </div>

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
                                                                "flex items-center space-x-3 py-1.5 group/sub transition-all",
                                                                snapshot.isDragging ? "bg-surface-secondary shadow-xl rounded-lg px-2" : ""
                                                            )}
                                                        >
                                                            <div {...provided.dragHandleProps} className="text-text-muted opacity-0 group-hover/sub:opacity-40 transition-opacity cursor-grab hover:text-text-primary">
                                                                <GripVertical className="w-3.5 h-3.5" />
                                                            </div>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    updateSubtask(subtask.id, { completed: !subtask.completed })
                                                                }}
                                                                className="touch-target relative group transition-transform active:scale-90 flex items-center justify-center rounded-md"
                                                            >
                                                                {subtask.completed ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <Circle className="w-4 h-4 text-text-muted group-hover:text-accent" />}
                                                            </button>
                                                            <input
                                                                type="text"
                                                                value={subtask.title}
                                                                onChange={(e) => updateSubtask(subtask.id, { title: e.target.value })}
                                                                className={cn(
                                                                    "flex-1 bg-transparent text-sm text-text-primary outline-none focus:border-b focus:border-border/50 transition-all",
                                                                    subtask.completed && "line-through text-text-muted/60"
                                                                )}
                                                            />
                                                            <button
                                                                onClick={() => deleteSubtask(subtask.id)}
                                                                className="touch-target p-1.5 text-text-muted hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all hover:bg-red-400/10 rounded-md flex items-center justify-center"
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

                            <div className="flex items-center space-x-3 py-1 pl-6 group">
                                <Plus className="w-4 h-4 text-accent" />
                                <div className="flex-1 flex items-center pr-2">
                                    <input
                                        type="text"
                                        placeholder="Add subtask..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const input = e.target as HTMLInputElement
                                                if (input.value.trim()) {
                                                    addSubtask(input.value.trim())
                                                    input.value = ''
                                                }
                                            }
                                        }}
                                        className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted/50 outline-none"
                                    />
                                    <button
                                        onClick={generateSubtasks}
                                        disabled={isGeneratingSubtasks}
                                        className={cn(
                                            "items-center gap-1.5 px-3 py-1 bg-surface-secondary text-text-primary hover:text-white hover:bg-surface-secondary/80 border border-border/50 rounded-full text-[11px] font-bold tracking-wider uppercase transition-all shadow-sm shrink-0 whitespace-nowrap active:scale-95",
                                            isGeneratingSubtasks
                                                ? "flex"
                                                : subtasks.length === 0
                                                    ? "flex md:hidden md:group-hover:flex"
                                                    : "hidden group-hover:flex"
                                        )}
                                    >
                                        {isGeneratingSubtasks ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                            <Sparkles className="w-3 h-3 text-accent-warm" />
                                        )}
                                        {isGeneratingSubtasks ? 'Generating...' : 'Magic Breakdown'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Comments */}
                        {task?.id && (
                            <div className="pt-8 border-t border-border/20">
                                <Comments taskId={task.id} />
                            </div>
                        )}
                    </div>

                    {/* RIGHTSIDE: Sidebar Metadata */}
                    <div className="w-full md:w-[320px] lg:w-[380px] border-t md:border-t-0 md:border-l border-border/50 bg-surface/30 overflow-y-auto overflow-x-hidden custom-scrollbar p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-8">

                        {/* Context Properties */}
                        <div className="space-y-6">
                            <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Properties
                            </h4>

                            <div className="space-y-5">
                                {/* Status Picker Selector */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-xs font-bold text-text-muted/80 px-1 uppercase tracking-wider">Status</span>
                                    <div className="relative">
                                        <button
                                            ref={statusPickerRef}
                                            onClick={() => setShowStatusPicker(!showStatusPicker)}
                                            className="w-full bg-surface-secondary/20 hover:bg-surface-secondary/50 border border-transparent hover:border-border/30 rounded-xl px-4 py-3 text-sm transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                {StatusOptions.find(opt => opt.value === status)?.icon && (() => {
                                                    const Icon = StatusOptions.find(opt => opt.value === status)!.icon
                                                    const color = StatusOptions.find(opt => opt.value === status)!.color
                                                    const bg = StatusOptions.find(opt => opt.value === status)!.bg
                                                    return (
                                                        <div className={cn("p-1 rounded-md", bg)}>
                                                            <Icon className={cn("w-3.5 h-3.5", color)} />
                                                        </div>
                                                    )
                                                })()}
                                                <span className={cn("font-medium", StatusOptions.find(opt => opt.value === status)?.color)}>
                                                    {StatusOptions.find(opt => opt.value === status)?.label || 'To-do'}
                                                </span>
                                            </div>
                                            <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                        </button>
                                        <StatusMenu
                                            isOpen={showStatusPicker}
                                            onClose={() => setShowStatusPicker(false)}
                                            triggerRef={statusPickerRef}
                                            currentStatus={status}
                                            onSelect={(newStatus) => {
                                                const isDone = newStatus === 'done'
                                                setStatus(newStatus)
                                                setCompleted(isDone)
                                                triggerSave({ status: newStatus, completed: isDone })
                                            }}
                                        />
                                    </div>
                                </div>

                                <div className="h-px bg-border/20 w-full my-4" />

                                <PillGroup
                                    label="Location"
                                    value={location}
                                    options={[
                                        { value: 'home', icon: <Home className="w-3.5 h-3.5" />, label: 'Home' },
                                        { value: 'outside', icon: <MapPin className="w-3.5 h-3.5" />, label: 'Outside' }
                                    ]}
                                    onChange={(val) => handleFieldUpdate('location', val)}
                                />
                                <PillGroup
                                    label="Energy"
                                    value={energy}
                                    options={[
                                        { value: 'high', icon: <Zap className="w-3.5 h-3.5" />, label: 'High' },
                                        { value: 'low', icon: <ZapOff className="w-3.5 h-3.5" />, label: 'Low' }
                                    ]}
                                    onChange={(val) => handleFieldUpdate('energy', val)}
                                />
                                <PillGroup
                                    label="Focus"
                                    value={focus}
                                    options={[
                                        { value: 'immersion', icon: <Target className="w-3.5 h-3.5" />, label: 'Immersion' },
                                        { value: 'process', icon: <Layers className="w-3.5 h-3.5" />, label: 'Process' }
                                    ]}
                                    onChange={(val) => handleFieldUpdate('focus', val)}
                                />

                                <div className="space-y-2.5">
                                    <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-text-primary block flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-accent-warm" /> Estimated Effort
                                    </span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {[5, 15, 30, 60, 120, 240].map((mins) => (
                                            <button
                                                key={mins}
                                                onClick={() => {
                                                    const newVal = estimatedEffort === mins ? 0 : mins
                                                    setEstimatedEffort(newVal)
                                                    handleFieldUpdate('estimated_effort', newVal)
                                                }}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all",
                                                    estimatedEffort === mins
                                                        ? "bg-accent-warm/20 border-accent-warm/40 text-accent-warm"
                                                        : "bg-surface/50 border-border/50 text-text-muted hover:text-text-primary hover:border-border"
                                                )}
                                            >
                                                {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-border/40 w-full" />

                        {/* Project Picker (Custom Popover) */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
                                <FolderKanban className="w-3.5 h-3.5" /> Project
                            </h4>
                            <div className="relative">
                                <button
                                    onClick={() => setShowProjectPicker(!showProjectPicker)}
                                    className="w-full bg-surface-secondary/20 hover:bg-surface-secondary/50 border border-transparent rounded-xl px-4 py-3 text-sm text-text-primary transition-all flex items-center justify-between group"
                                >
                                    <span className={!projectId ? "text-text-muted" : "font-semibold"}>
                                        {projectId ? projects.find(p => p.id === projectId)?.name || 'Unknown Project' : 'Assign to project...'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                </button>

                                {showProjectPicker && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowProjectPicker(false)} />
                                        <div className="absolute top-12 left-0 right-0 max-h-64 overflow-hidden bg-surface border border-border/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-xl z-50 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                                            <div className="p-2 border-b border-border/50 flex items-center gap-2 bg-surface/50">
                                                <Search className="w-4 h-4 text-text-muted ml-2" />
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="Search or create project..."
                                                    className="bg-transparent border-none outline-none text-sm p-1 w-full text-text-primary"
                                                    value={projectSearch}
                                                    onChange={e => setProjectSearch(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault()
                                                            void createProjectFromSearch()
                                                        }
                                                    }}
                                                />
                                            </div>
                                            <div className="overflow-y-auto custom-scrollbar p-1">
                                                <button
                                                    onClick={() => { setProjectId(null); handleFieldUpdate('project_id', null); setShowProjectPicker(false) }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2",
                                                        !projectId ? "bg-accent/10 text-accent font-medium" : "text-text-muted hover:bg-surface-secondary"
                                                    )}
                                                >
                                                    Inbox
                                                </button>
                                                {filteredProjects.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => { setProjectId(p.id); handleFieldUpdate('project_id', p.id); setShowProjectPicker(false) }}
                                                        className={cn(
                                                            "w-full text-left px-3 py-2 text-sm rounded-lg transition-colors flex items-center gap-2",
                                                            projectId === p.id ? "bg-accent/10 text-accent font-medium" : "text-text-primary hover:bg-surface-secondary"
                                                        )}
                                                    >
                                                        {p.name}
                                                    </button>
                                                ))}
                                            </div>
                                            {canCreateProject && (
                                                <div className="p-2 border-t border-border/50">
                                                    <button
                                                        onClick={() => void createProjectFromSearch()}
                                                        disabled={isCreatingProject}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm font-semibold disabled:opacity-50"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        <span>{isCreatingProject ? 'Creating...' : `Create "${projectSearch.trim()}"`}</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Recurrence Picker (Custom Popover) */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
                                <RefreshCw className="w-3.5 h-3.5" /> Repeat
                            </h4>
                            <div className="relative">
                                <button
                                    onClick={() => setShowRecurrencePicker(!showRecurrencePicker)}
                                    className="w-full bg-surface-secondary/20 hover:bg-surface-secondary/50 border border-transparent rounded-xl px-4 py-3 text-sm text-text-primary transition-all flex items-center justify-between group"
                                >
                                    <span className={!recurrence ? "text-text-muted" : "font-semibold capitalize"}>
                                        {recurrence || 'Does not repeat'}
                                    </span>
                                    <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                </button>

                                {showRecurrencePicker && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setShowRecurrencePicker(false)} />
                                        <div className="absolute top-12 left-0 right-0 bg-surface border border-border/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-xl z-50 animate-in fade-in zoom-in-95 duration-200 p-1">
                                            {[
                                                { val: null, label: 'Never' },
                                                { val: 'daily', label: 'Daily' },
                                                { val: 'weekdays', label: 'Weekdays' },
                                                { val: 'weekly', label: 'Weekly' },
                                                { val: 'monthly', label: 'Monthly' },
                                                { val: 'yearly', label: 'Yearly' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.val || 'none'}
                                                    onClick={() => {
                                                        const val = opt.val as 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null
                                                        setRecurrence(val)
                                                        handleFieldUpdate('recurrence', val)
                                                        setShowRecurrencePicker(false)
                                                    }}
                                                    className={cn(
                                                        "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors",
                                                        recurrence === opt.val ? "bg-accent/10 text-accent font-medium" : "text-text-primary hover:bg-surface-secondary"
                                                    )}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {recurrence && (
                                    <div className="mt-3 relative group animate-in fade-in slide-in-from-top-2 duration-300">
                                        <input
                                            type="date"
                                            value={recurrenceEndAt}
                                            onChange={(e) => {
                                                setRecurrenceEndAt(e.target.value)
                                                handleFieldUpdate('recurrence_end_at', e.target.value || null)
                                            }}
                                            className="w-full bg-surface/50 hover:bg-surface/80 border border-border/50 hover:border-border rounded-xl px-4 py-3 pl-10 text-xs text-text-primary outline-none transition-all"
                                        />
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
                                        {!recurrenceEndAt && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-xs text-text-muted pointer-events-none font-medium">Ends Never</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5" /> Schedule
                            </h4>
                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        const nextToday = !today
                                        setToday(nextToday)
                                        handleFieldUpdate('today', nextToday)
                                    }}
                                    className={cn(
                                        "flex items-center space-x-2 px-4 py-2.5 rounded-xl border transition-all w-full justify-center",
                                        today ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 shadow-[0_0_15px_rgba(250,204,21,0.1)]" : "bg-transparent border-border/50 text-text-muted hover:text-text-primary hover:bg-surface-secondary/50"
                                    )}
                                >
                                    <Star className={cn("w-4 h-4", today && "fill-current")} />
                                    <span className="text-xs font-bold uppercase tracking-wider">Do Today</span>
                                </button>

                                <div className="space-y-2">
                                    <DateTimePicker
                                        value={startAt}
                                        onChange={(val) => {
                                            setStartAt(val)
                                            handleFieldUpdate('start_at', val || null)
                                        }}
                                        placeholder="Start Date..."
                                        className="bg-transparent hover:bg-surface-secondary/30 border-border/50 hover:border-border rounded-xl px-2 py-0.5"
                                    />
                                    <DateTimePicker
                                        value={endAt}
                                        onChange={(val) => {
                                            setEndAt(val)
                                            handleFieldUpdate('end_at', val || null)
                                        }}
                                        placeholder="Due Date..."
                                        className="bg-transparent hover:bg-surface-secondary/30 border-border/50 hover:border-border rounded-xl px-2 py-0.5"
                                    />
                                </div>
                            </div>
                        </div>

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
        <div className="space-y-2.5">
            <span className="text-[10px] uppercase font-bold tracking-[0.15em] text-text-primary block">{label}</span>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={String(opt.value)}
                        onClick={() => onChange(value === opt.value ? null : opt.value)}
                        className={cn(
                            "flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold tracking-wide transition-all",
                            value === opt.value
                                ? "bg-accent/10 border-accent/30 text-accent"
                                : "bg-surface/50 border-border/50 text-text-muted hover:text-text-primary hover:border-border hover:bg-surface-secondary/40"
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
