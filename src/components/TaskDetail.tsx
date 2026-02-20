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
    RefreshCw,
    FolderKanban,
    SlidersHorizontal,
    NotebookPen
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
    const [activeTab, setActiveTab] = useState<'overview' | 'subtasks'>('overview');

    const [showMenu, setShowMenu] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [completionPulse, setCompletionPulse] = useState(false)

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 lg:p-10 overflow-hidden">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Panel */}
            <div
                className={cn(
                    "relative flex flex-col bg-surface border border-border h-full max-h-[90vh] w-full max-w-5xl shadow-2xl overflow-hidden",
                    "animate-in zoom-in-95 duration-200",
                    "rounded-[2rem] md:rounded-3xl"
                )}
            >
                {/* Header (Full Width) */}
                <header className="flex items-center justify-between px-6 py-5 border-b border-border/50 bg-surface/85 backdrop-blur-xl z-20 shrink-0">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
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
                                "relative w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all shrink-0",
                                completed ? "bg-accent-warm border-accent-warm text-white" : "border-border hover:border-accent-warm"
                            )}
                        >
                            {completionPulse && (
                                <span
                                    className="absolute inset-0 rounded-xl border-2 border-accent-warm/50 pointer-events-none"
                                    style={{ animation: 'ring-pulse 0.45s ease-out forwards' }}
                                />
                            )}
                            {completed && <Check className="w-4 h-4" />}
                        </button>
                        <input
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Task title"
                            className="bg-transparent text-xl md:text-2xl font-bold text-text-primary outline-none w-full truncate focus:text-accent transition-colors"
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
                                    <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
                                    <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] z-[70] py-2 animate-in zoom-in-95 duration-200">
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

                {/* Content Area */}
                <div className="flex flex-1 flex-col overflow-hidden bg-surface">
                    {/* Tab Bar (Full Width) */}
                    <div className="flex items-center space-x-8 px-8 pt-4 border-b border-border/50 bg-surface/85 backdrop-blur z-20 shrink-0">
                        {[
                            { id: 'overview', label: 'Overview', icon: NotebookPen },
                            { id: 'subtasks', label: 'Subtasks', icon: Layers, count: subtasks.length }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as 'overview' | 'subtasks')}
                                className={cn(
                                    "flex items-center space-x-2 pb-4 border-b-2 transition-all relative",
                                    activeTab === tab.id
                                        ? "border-accent text-accent font-bold"
                                        : "border-transparent text-text-muted hover:text-text-primary hover:border-border/50"
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="text-sm tracking-tight">{tab.label}</span>
                                {tab.count !== undefined && tab.count > 0 && (
                                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent/10 text-accent text-[10px] font-black">
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
                        {activeTab === 'overview' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                {/* Description Header-like Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-text-muted">
                                        <NotebookPen className="w-4 h-4" />
                                        <h3 className="text-[10px] uppercase font-black tracking-[0.2em]">Description</h3>
                                    </div>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => handleNotesChange(e.target.value)}
                                        onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && (e.target as HTMLTextAreaElement).blur()}
                                        placeholder="Capture details, links, blockers, and the next concrete step for this task."
                                        className="w-full bg-surface-secondary/30 border border-border/50 rounded-3xl p-6 text-sm md:text-base text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:border-accent/50 focus:bg-surface-secondary/50 resize-none min-h-[160px] transition-all shadow-inner"
                                    />
                                </div>

                                {/* Properties Responsive Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {/* Context Pills */}
                                    <SectionCard icon={<SlidersHorizontal className="w-4 h-4 text-accent" />} title="Context">
                                        <div className="space-y-5">
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
                                        </div>
                                    </SectionCard>

                                    {/* Project & Repeat */}
                                    <div className="space-y-6">
                                        <SectionCard icon={<FolderKanban className="w-4 h-4 text-accent" />} title="Project">
                                            <div className="relative group">
                                                <select
                                                    value={projectId || ''}
                                                    onChange={(e) => {
                                                        const nextProjectId = e.target.value || null
                                                        setProjectId(nextProjectId)
                                                        handleFieldUpdate('project_id', nextProjectId)
                                                    }}
                                                    className="w-full bg-surface/50 border border-border/70 rounded-xl px-4 py-3 text-sm text-text-primary appearance-none focus:border-accent/50 outline-none transition-all pr-10 hover:bg-surface"
                                                >
                                                    <option value="">No Project</option>
                                                    {projects.map(p => (
                                                        <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-primary transition-colors" />
                                            </div>
                                        </SectionCard>

                                        <SectionCard icon={<RefreshCw className="w-4 h-4 text-accent" />} title="Repeat">
                                            <div className="space-y-4">
                                                <div className="relative group">
                                                    <select
                                                        value={recurrence || ''}
                                                        onChange={(e) => {
                                                            const val = (e.target.value || null) as 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | null
                                                            setRecurrence(val)
                                                            handleFieldUpdate('recurrence', val)
                                                        }}
                                                        className="w-full bg-surface/50 border border-border/70 rounded-xl px-4 py-3 text-sm text-text-primary appearance-none focus:border-accent/50 outline-none transition-all pr-10 hover:bg-surface"
                                                    >
                                                        <option value="">No repeat</option>
                                                        <option value="daily">Daily</option>
                                                        <option value="weekdays">Weekdays</option>
                                                        <option value="weekly">Weekly</option>
                                                        <option value="monthly">Monthly</option>
                                                        <option value="yearly">Yearly</option>
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none group-hover:text-text-primary transition-colors" />
                                                </div>

                                                {recurrence && (
                                                    <div className="relative group animate-in fade-in slide-in-from-top-2 duration-300">
                                                        <input
                                                            type="date"
                                                            value={recurrenceEndAt}
                                                            onChange={(e) => {
                                                                setRecurrenceEndAt(e.target.value)
                                                                handleFieldUpdate('recurrence_end_at', e.target.value || null)
                                                            }}
                                                            className="w-full bg-surface/50 border border-border/70 rounded-xl px-4 py-3 text-xs text-text-primary focus:border-accent/50 outline-none transition-all"
                                                        />
                                                        {!recurrenceEndAt && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] text-text-muted pointer-events-none uppercase font-bold">Ends Never</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </SectionCard>
                                    </div>

                                    {/* Dates & Schedule */}
                                    <SectionCard icon={<Calendar className="w-4 h-4 text-accent-warm" />} title="Schedule">
                                        <div className="space-y-4">
                                            <button
                                                onClick={() => {
                                                    const nextToday = !today
                                                    setToday(nextToday)
                                                    handleFieldUpdate('today', nextToday)
                                                }}
                                                className={cn(
                                                    "flex items-center space-x-2 px-4 py-2 rounded-xl border transition-all w-full justify-center",
                                                    today ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-500 shadow-lg shadow-yellow-400/5" : "bg-surface/50 border-border/70 text-text-muted hover:text-text-primary hover:bg-surface"
                                                )}
                                            >
                                                <Star className={cn("w-4 h-4", today && "fill-current")} />
                                                <span className="text-xs font-bold uppercase tracking-wider">Today</span>
                                            </button>

                                            <div className="space-y-3">
                                                <div className="relative group">
                                                    <input
                                                        type="datetime-local"
                                                        value={startAt}
                                                        onChange={(e) => {
                                                            setStartAt(e.target.value)
                                                            handleFieldUpdate('start_at', e.target.value || null)
                                                        }}
                                                        className="w-full bg-surface/50 border border-border/70 rounded-xl px-10 py-2.5 text-[11px] text-text-primary focus:border-accent/50 outline-none transition-all"
                                                    />
                                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                                    {!startAt && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[10px] text-text-muted pointer-events-none">Start</span>}
                                                </div>
                                                <div className="relative group">
                                                    <input
                                                        type="datetime-local"
                                                        value={endAt}
                                                        onChange={(e) => {
                                                            setEndAt(e.target.value)
                                                            handleFieldUpdate('end_at', e.target.value || null)
                                                        }}
                                                        className="w-full bg-surface/50 border border-border/70 rounded-xl px-10 py-2.5 text-[11px] text-text-primary focus:border-accent/50 outline-none transition-all"
                                                    />
                                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-hover:text-text-primary transition-colors" />
                                                    {!endAt && <span className="absolute left-10 top-1/2 -translate-y-1/2 text-[10px] text-text-muted pointer-events-none">End</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </SectionCard>
                                </div>

                                {taskId && (
                                    <div className="pt-8 border-t border-border/30">
                                        <Comments taskId={taskId} />
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'subtasks' && (
                            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 max-w-3xl mx-auto">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between px-2 border-b border-border/30 pb-4">
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4 text-accent" />
                                            <h3 className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Subtasks</h3>
                                        </div>
                                        {subtasks.length > 0 && (
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                                                {subtasks.filter(s => s.completed).length}/{subtasks.length} COMPLETE
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
                                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                                    {subtasks.map((subtask, index) => (
                                                        <Draggable key={subtask.id} draggableId={subtask.id} index={index}>
                                                            {(provided, snapshot) => (
                                                                <div
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    className={cn(
                                                                        "flex items-center space-x-3 p-3 rounded-2xl group/sub transition-all",
                                                                        snapshot.isDragging ? "bg-surface-secondary shadow-2xl scale-[1.02] border-accent/20 border" : "hover:bg-surface-secondary/50 border border-transparent hover:border-border/50"
                                                                    )}
                                                                >
                                                                    <div {...provided.dragHandleProps} className="text-text-muted opacity-0 group-hover/sub:opacity-40 transition-opacity cursor-grab">
                                                                        <GripVertical className="w-4 h-4" />
                                                                    </div>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            updateSubtask(subtask.id, { completed: !subtask.completed })
                                                                        }}
                                                                        className="relative group transition-transform active:scale-90"
                                                                    >
                                                                        {subtask.completed ? <CheckCircle2 className="w-5 h-5 text-accent" /> : <Circle className="w-5 h-5 text-text-muted group-hover:text-accent" />}
                                                                    </button>
                                                                    <input
                                                                        type="text"
                                                                        value={subtask.title}
                                                                        onChange={(e) => updateSubtask(subtask.id, { title: e.target.value })}
                                                                        className={cn(
                                                                            "flex-1 bg-transparent text-sm md:text-base text-text-primary outline-none",
                                                                            subtask.completed && "line-through text-text-muted"
                                                                        )}
                                                                    />
                                                                    <button
                                                                        onClick={() => deleteSubtask(subtask.id)}
                                                                        className="p-2 text-text-muted hover:text-red-400 opacity-0 group-hover/sub:opacity-100 transition-all hover:bg-red-400/10 rounded-lg"
                                                                    >
                                                                        <X className="w-4 h-4" />
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

                                    <div className="flex items-center space-x-3 px-10 py-4 bg-surface-secondary/20 rounded-2xl border border-dashed border-border/50">
                                        <Plus className="w-5 h-5 text-text-muted opacity-40" />
                                        <input
                                            type="text"
                                            placeholder="Add a quick subtask..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const input = e.target as HTMLInputElement
                                                    if (input.value.trim()) {
                                                        addSubtask(input.value.trim())
                                                        input.value = ''
                                                    }
                                                }
                                            }}
                                            className="flex-1 bg-transparent text-sm md:text-base text-text-primary placeholder:text-text-muted outline-none"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Footer / Saving Indicator */}
                    <footer className="px-8 py-4 border-t border-border/30 bg-surface-secondary/10 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-2">
                            {isSaving ? (
                                <div className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Auto-saving</span>
                                </div>
                            ) : (
                                <div className="flex items-center space-x-2 text-text-muted/60">
                                    <Check className="w-3 h-3" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">All Changes Saved</span>
                                </div>
                            )}
                        </div>
                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-muted/40">
                            Ghost System v2.0
                        </div>
                    </footer>
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

function SectionCard({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) {
    return (
        <section className="bg-surface-secondary/20 border border-border/50 rounded-2xl p-4 space-y-3">
            <header className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface-secondary border border-border/70">
                    {icon}
                </span>
                <h3 className="text-[11px] uppercase font-black tracking-widest text-text-muted">{title}</h3>
            </header>
            {children}
        </section>
    )
}

function PillGroup<T>({ label, value, options, onChange }: {
    label: string,
    value: T | null,
    options: { value: T, icon: React.ReactNode, label: string }[],
    onChange: (val: T | null) => void
}) {
    return (
        <div className="space-y-3">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted block">{label}</span>
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
