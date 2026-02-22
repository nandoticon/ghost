import { useState, useEffect, useRef, FC, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
    X, MoreVertical, Check, Calendar, Home, MapPin, Zap, ZapOff,
    Target, Layers, Star, Trash2, Copy, ChevronDown, Plus,
    CheckCircle2, Circle, Clock, GripVertical, RefreshCw, FolderKanban,
    SlidersHorizontal, Search, Sparkles, Loader2, Play, Pause, Pencil
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
import { useModalA11y } from '../hooks/useModalA11y'
import {
    TimeSession,
    listTaskSessions,
    createManualSession,
    updateSessionRange,
    deleteSession,
} from '../lib/timeTracking'

interface TaskDetailProps {
    taskId: string | null
    onClose: () => void
}

export const TaskDetail: FC<TaskDetailProps> = ({ taskId, onClose }) => {
    const { task } = useTaskById(taskId)
    const { deleteTask, completeTask, createTask, updateTask } = useTasks()
    const { projects, createProject } = useProjects()
    const { subtasks, addSubtask, updateSubtask, deleteSubtask, reorderSubtasks } = useSubtasks(task?.id)
    const { comments } = useComments(task?.id)
    const { showToast } = useToast()
    const { activeSession, elapsedSeconds, toggleTimer, isSyncing: isTimerSyncing } = useTimer()
    const resolvedTaskId = task?.id ?? null
    const isTimerActiveForTask = activeSession?.task_id === resolvedTaskId
    const isAnotherTaskTimerActive = Boolean(activeSession && resolvedTaskId && activeSession.task_id !== resolvedTaskId)

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
    const [isClosing, setIsClosing] = useState(false)
    const [taskSessions, setTaskSessions] = useState<TimeSession[]>([])
    const [isLoadingSessions, setIsLoadingSessions] = useState(false)
    const [isSavingSession, setIsSavingSession] = useState(false)
    const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
    const [sessionDeleteConfirm, setSessionDeleteConfirm] = useState<TimeSession | null>(null)
    const [isSessionEditorOpen, setIsSessionEditorOpen] = useState(false)
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
    const [sessionStartInput, setSessionStartInput] = useState('')
    const [sessionEndInput, setSessionEndInput] = useState('')
    const closeTimerRef = useRef<number | null>(null)
    const isClosingRef = useRef(false)
    const prevTaskIdRef = useRef(taskId)

    // Custom Popover states
    const [showProjectPicker, setShowProjectPicker] = useState(false)
    const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
    const [showStatusPicker, setShowStatusPicker] = useState(false)
    const [projectSearch, setProjectSearch] = useState('')
    const [isCreatingProject, setIsCreatingProject] = useState(false)
    const statusPickerRef = useRef<HTMLButtonElement>(null)
    const contentScrollRef = useRef<HTMLDivElement>(null)
    const titleTextareaRef = useRef<HTMLTextAreaElement>(null)
    const titleInputRef = useRef<HTMLInputElement>(null)

    const requestClose = useCallback(() => {
        if (isClosingRef.current) return
        isClosingRef.current = true
        setIsClosing(true)
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            setIsClosing(false)
            isClosingRef.current = false
            onClose()
        }, 140)
    }, [onClose])

    useEffect(() => {
        const wasOpen = Boolean(prevTaskIdRef.current)
        const isNowOpen = Boolean(taskId)
        prevTaskIdRef.current = taskId

        if (isNowOpen && !wasOpen) {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
            }
            isClosingRef.current = false
            setIsClosing(false)
        } else if (!isNowOpen && wasOpen) {
            if (!isClosingRef.current) {
                requestClose()
            }
        }
    }, [taskId, requestClose])

    useEffect(() => {
        return () => {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (task) {
            const active = document.activeElement
            const titleFocused = active === titleTextareaRef.current || active === titleInputRef.current
            if (!titleFocused) {
                setTitle(task.title)
            }
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

    const toLocalInputValue = (iso: string | null) => {
        if (!iso) return ''
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return ''

        const pad = (value: number) => String(value).padStart(2, '0')
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    const toIsoString = (localValue: string) => {
        if (!localValue) return null
        const date = new Date(localValue)
        if (Number.isNaN(date.getTime())) return null
        return date.toISOString()
    }

    const formatSessionDateTime = (iso: string) => {
        const date = new Date(iso)
        if (Number.isNaN(date.getTime())) return 'Invalid date'
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        })
    }

    const formatSessionDuration = (seconds: number | null) => {
        if (!seconds || seconds <= 0) return '0m'
        const hrs = Math.floor(seconds / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (hrs > 0) return `${hrs}h ${mins}m`
        return `${Math.max(1, mins)}m`
    }

    const loadTaskSessions = useCallback(async () => {
        if (!resolvedTaskId) {
            setTaskSessions([])
            return
        }

        setIsLoadingSessions(true)
        try {
            const sessions = await listTaskSessions(resolvedTaskId, { limit: 30 })
            setTaskSessions(sessions)
        } catch (error) {
            console.error('Failed to load task sessions:', error)
            showToast('Could not load tracked sessions', 'error')
        } finally {
            setIsLoadingSessions(false)
        }
    }, [resolvedTaskId, showToast])

    const handleToggleTimer = useCallback(async () => {
        if (!resolvedTaskId) return
        await toggleTimer(resolvedTaskId, 'task_detail')
        await loadTaskSessions()
    }, [resolvedTaskId, toggleTimer, loadTaskSessions])

    const openManualSessionEditor = () => {
        const now = new Date()
        const start = new Date(now.getTime() - 25 * 60 * 1000)
        setEditingSessionId(null)
        setSessionStartInput(toLocalInputValue(start.toISOString()))
        setSessionEndInput(toLocalInputValue(now.toISOString()))
        setIsSessionEditorOpen(true)
    }

    const openEditSessionEditor = (session: TimeSession) => {
        setEditingSessionId(session.id)
        setSessionStartInput(toLocalInputValue(session.started_at))
        setSessionEndInput(toLocalInputValue(session.ended_at))
        setIsSessionEditorOpen(true)
    }

    const closeSessionEditor = () => {
        setIsSessionEditorOpen(false)
        setEditingSessionId(null)
        setSessionStartInput('')
        setSessionEndInput('')
    }

    const submitSessionEditor = async () => {
        if (!resolvedTaskId) return

        const startedAtIso = toIsoString(sessionStartInput)
        const endedAtIso = toIsoString(sessionEndInput)
        if (!startedAtIso || !endedAtIso) {
            showToast('Please select valid start and end date/time', 'error')
            return
        }

        if (new Date(endedAtIso) <= new Date(startedAtIso)) {
            showToast('End time must be after start time', 'error')
            return
        }

        setIsSavingSession(true)
        try {
            if (editingSessionId) {
                await updateSessionRange(editingSessionId, { startedAt: startedAtIso, endedAt: endedAtIso })
                showToast('Tracked session updated', 'success')
            } else {
                await createManualSession({
                    taskId: resolvedTaskId,
                    startedAt: startedAtIso,
                    endedAt: endedAtIso,
                    source: 'manual',
                })
                showToast('Tracked session added', 'success')
            }
            closeSessionEditor()
            await loadTaskSessions()
        } catch (error) {
            console.error('Failed to save tracked session:', error)
            showToast('Could not save tracked session', 'error')
        } finally {
            setIsSavingSession(false)
        }
    }

    const handleDeleteSession = async (session: TimeSession) => {
        if (!session.id || session.ended_at === null) return
        setSessionDeleteConfirm(session)
    }

    const confirmDeleteSession = async () => {
        const session = sessionDeleteConfirm
        if (!session?.id || session.ended_at === null) return
        setDeletingSessionId(session.id)
        try {
            await deleteSession(session.id)
            if (editingSessionId === session.id) {
                closeSessionEditor()
            }
            showToast('Tracked session deleted', 'success')
            setSessionDeleteConfirm(null)
            await loadTaskSessions()
        } catch (error) {
            console.error('Failed to delete tracked session:', error)
            showToast('Could not delete tracked session', 'error')
        } finally {
            setDeletingSessionId(null)
        }
    }

    const triggerSave = (updates: Partial<Task>, debounceMs = 600) => {
        if (!resolvedTaskId) return

        // Accumulate updates so we don't clobber rapid changes
        pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates }

        setIsSaving(true)
        if (timerRef.current) clearTimeout(timerRef.current)

        timerRef.current = setTimeout(async () => {
            const finalUpdates = { ...pendingUpdatesRef.current }
            // Clear the accumulator before the async call to allow new updates to start fresh
            pendingUpdatesRef.current = {}

            await updateTask(resolvedTaskId, finalUpdates)
            setIsSaving(false)
        }, debounceMs)
    }

    const handleTitleChange = (val: string) => {
        setTitle(val)
        triggerSave({ title: val.trim() || 'Untitled Task' }, 350)
    }

    const handleNotesChange = (val: string) => {
        setNotes(val)
        triggerSave({ notes: val.trim() || null }, 350)
    }

    const handleFieldUpdate = (field: keyof Task, val: Task[keyof Task], debounceMs = 0) => {
        triggerSave({ [field]: val }, debounceMs)
    }

    const generateSubtasks = async () => {
        if (!title.trim() || !resolvedTaskId) return

        setIsGeneratingSubtasks(true)
        try {
            const existing = new Set(subtasks.map(s => s.title.trim().toLowerCase()))
            const response = await fetch('/api/generate-subtasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    notes,
                    status,
                    energy,
                    focus,
                    location,
                    today,
                    startAt,
                    endAt,
                    existingSubtasks: subtasks.map(s => s.title),
                    comments: comments.map(c => c.body),
                })
            })

            if (!response.ok) {
                throw new Error(`Subtask API returned ${response.status}`)
            }

            const data = await response.json()
            const candidates = Array.isArray(data?.subtasks) ? data.subtasks : []

            const generated = candidates
                .map((line: string) => line.replace(/\s+/g, ' ').trim())
                .filter((line: string) => line.length > 0 && !existing.has(line.toLowerCase()))
                .slice(0, 5)

            if (generated.length === 0) {
                showToast('No new subtasks to add.', 'info')
            } else {
                await Promise.all(generated.map((st: string) => addSubtask(st)))
                showToast('Magic breakdown complete.', 'success')
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
                if (showProjectPicker) {
                    e.preventDefault()
                    setShowProjectPicker(false)
                } else if (showRecurrencePicker) {
                    e.preventDefault()
                    setShowRecurrencePicker(false)
                } else if (showStatusPicker) {
                    e.preventDefault()
                    setShowStatusPicker(false)
                } else if (showMenu) {
                    e.preventDefault()
                    setShowMenu(false)
                } else {
                    requestClose()
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (resolvedTaskId) {
                    completeTask(resolvedTaskId, !completed)
                    requestClose()
                }
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [requestClose, showProjectPicker, showRecurrencePicker, showStatusPicker, showMenu, resolvedTaskId, completed, completeTask])

    useEffect(() => {
        if (!resolvedTaskId) return
        void loadTaskSessions()
    }, [resolvedTaskId, activeSession?.id, loadTaskSessions])

    useEffect(() => {
        if (!taskId) return
        window.requestAnimationFrame(() => {
            contentScrollRef.current?.scrollTo({ top: 0 })
        })
    }, [taskId])

    useEffect(() => {
        const titleEl = titleTextareaRef.current
        if (!titleEl) return

        titleEl.style.height = 'auto'
        titleEl.style.height = `${titleEl.scrollHeight}px`
    }, [title])

    const { modalRef } = useModalA11y<HTMLDivElement>({
        isOpen: Boolean(taskId),
        onClose: requestClose,
        lockBodyScroll: true,
        trapFocus: true,
        closeOnEscape: false,
    })

    if (!taskId && !isClosing) return null

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

    const activeTaskSession = taskSessions.find((session) => session.ended_at === null) || null
    const closedTaskSessions = taskSessions.filter((session) => session.ended_at !== null)
    const totalTrackedSeconds = closedTaskSessions.reduce((sum, session) => {
        if (session.duration_seconds) return sum + session.duration_seconds
        if (session.ended_at) {
            const duration = Math.floor((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
            return sum + Math.max(0, duration)
        }
        return sum
    }, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end overflow-hidden">
            {/* Backdrop */}
            <div
                className={cn(
                    "absolute inset-0 bg-background/60 backdrop-blur-sm animate-in fade-in duration-300",
                    isClosing && "animate-out fade-out duration-150"
                )}
                onClick={requestClose}
            />

            {/* Slide-over Panel */}
            <div
                ref={modalRef}
                className={cn(
                    "relative flex flex-col bg-surface border border-border md:border-l md:border-r-0 md:border-y-0 rounded-t-3xl md:rounded-none h-[min(96dvh,100%)] md:h-full w-full max-w-[900px] shadow-2xl overflow-hidden overflow-x-hidden overscroll-contain",
                    isClosing
                        ? "animate-out fade-out slide-out-to-bottom-2 md:slide-out-to-bottom-0 duration-150"
                        : "animate-in slide-in-from-bottom-2 md:slide-in-from-right duration-200 ease-out"
                )}
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-detail-heading"
                tabIndex={-1}
            >
                {/* Header */}
                <header className="sticky top-0 bg-surface/92 backdrop-blur-md border-b border-border/50 z-30 shrink-0">
                    <div className="md:hidden flex justify-center pt-2 pb-1">
                        <div className="h-1.5 w-11 rounded-full bg-text-muted/25" aria-hidden="true" />
                    </div>
                    <div className="flex items-center justify-between gap-2 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(0.75rem+env(safe-area-inset-right))] md:px-6 pt-1 md:pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3">
                    <div className="flex flex-1 items-center gap-2 md:gap-3 min-w-0 flex-wrap">
                        <h2 id="task-detail-heading" className="sr-only">Task details</h2>
                        <button
                            onClick={async () => {
                                if (!resolvedTaskId) return
                                const nextCompleted = !completed
                                setCompleted(nextCompleted)
                                if (nextCompleted) {
                                    setCompletionPulse(true)
                                    setTimeout(() => setCompletionPulse(false), 450)
                                }
                                const res = await completeTask(resolvedTaskId, nextCompleted)
                                if (res.success && res.nextOccurrenceCreated) {
                                    const dateStr = res.nextOccurrenceDate ? new Date(res.nextOccurrenceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'the future'
                                    showToast(`Task completed · Next on ${dateStr}`, 'success')
                                }
                            }}
                            className={cn(
                                "touch-target relative w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all shrink-0",
                                completed ? "bg-accent-warm border-accent-warm text-white" : "border-text-muted/40 hover:border-accent-warm"
                            )}
                            title="Complete Task (Ctrl+Enter)"
                            aria-label={completed ? 'Mark task as not completed' : 'Mark task as completed'}
                        >
                            {completionPulse && (
                                <span
                                    className="absolute inset-0 rounded-md border-2 border-accent-warm/50 pointer-events-none"
                                    style={{ animation: 'ring-pulse 0.45s ease-out forwards' }}
                                />
                            )}
                            {completed && <Check className="w-3.5 h-3.5" />}
                        </button>
                        <input
                            ref={titleInputRef}
                            value={title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            placeholder="Task title"
                            className="sm:hidden flex-1 min-w-0 bg-transparent text-xl font-black leading-tight text-text-primary placeholder:text-text-muted/80 focus:outline-none"
                            aria-label="Task title"
                        />
                        <span className="hidden sm:inline text-xs font-mono text-text-muted/60 tracking-wider shrink-0">
                            {task?.short_id || taskId?.substring(0, 8)}
                        </span>
                        {/* Saving Indicator */}
                        <div className="hidden sm:flex ml-1 md:ml-3 items-center h-4 shrink-0">
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
                                aria-label="Task actions"
                                aria-haspopup="menu"
                                aria-expanded={showMenu}
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
                        <button
                            onClick={requestClose}
                            className="touch-target flex items-center justify-center p-2 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors"
                            aria-label="Close task details"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    </div>
                </header>

                {/* Content Area - 2 Columns */}
                <div ref={contentScrollRef} className="flex flex-1 min-h-0 min-w-0 flex-col md:flex-row overflow-y-auto md:overflow-hidden overflow-x-hidden overscroll-contain">
                    <div className="md:hidden sticky top-0 z-20 px-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] py-2.5 border-b border-border/40 bg-surface/92 backdrop-blur-md">
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                            <button
                                onClick={() => void handleToggleTimer()}
                                disabled={isTimerSyncing}
                                className={cn(
                                    "touch-target shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black uppercase tracking-wider transition-all",
                                    isTimerActiveForTask
                                        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                                        : "border-border/60 bg-surface-secondary/50 text-text-primary",
                                    isTimerSyncing && "opacity-60 cursor-not-allowed"
                                )}
                            >
                                {isTimerActiveForTask ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                <span>
                                    {isTimerActiveForTask
                                        ? formatElapsed(elapsedSeconds)
                                        : isAnotherTaskTimerActive
                                            ? 'Switch Timer'
                                            : 'Start Timer'}
                                </span>
                            </button>

                            <button
                                onClick={() => {
                                    const nextToday = !today
                                    setToday(nextToday)
                                    handleFieldUpdate('today', nextToday)
                                }}
                                className={cn(
                                    "touch-target shrink-0 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-black uppercase tracking-wider transition-all",
                                    today
                                        ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
                                        : "border-border/60 bg-surface-secondary/50 text-text-muted hover:text-text-primary"
                                )}
                                aria-pressed={today}
                            >
                                <Star className={cn("w-4 h-4", today && "fill-current")} />
                                <span>{today ? 'Today' : 'Add Today'}</span>
                            </button>

                            <button
                                onClick={openManualSessionEditor}
                                className="touch-target shrink-0 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-surface-secondary/50 px-3 py-2 text-sm font-black uppercase tracking-wider text-text-primary transition-all"
                            >
                                <Clock className="w-4 h-4" />
                                <span>Log Time</span>
                            </button>

                            <div className="shrink-0 rounded-xl border border-border/60 bg-surface-secondary/35 px-3 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Tracked</p>
                                <p className="text-xs font-black text-text-primary">{formatSessionDuration(totalTrackedSeconds)}</p>
                            </div>
                        </div>
                    </div>

                    {/* LEFTSIDE: Main Content */}
                    <div className="min-w-0 overflow-visible md:flex-1 md:min-h-0 md:overflow-y-auto md:overflow-x-hidden custom-scrollbar p-4 md:p-10 pb-[calc(1.75rem+env(safe-area-inset-bottom))] space-y-7 md:space-y-10">
                        {/* Title & Description */}
                        <div className="space-y-4 md:space-y-6">
                            <textarea
                                ref={titleTextareaRef}
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Task title"
                                rows={1}
                                className="hidden sm:block bg-transparent text-2xl md:text-3xl 2xl:text-4xl leading-tight font-black text-text-primary outline-none w-full resize-none overflow-hidden focus:text-accent transition-colors py-1 min-h-[2.25rem]"
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
                                className="w-full bg-transparent p-0 text-base md:text-lg text-text-primary placeholder:text-text-muted focus:outline-none resize-none min-h-[96px] transition-all"
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
                                    <span className="text-sm md:text-xs font-black px-2 py-0.5 rounded-full bg-accent/10 text-accent">
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
                                            "touch-target items-center gap-1.5 px-3 py-1 bg-surface-secondary text-text-primary hover:text-white hover:bg-surface-secondary/80 border border-border/50 rounded-full text-sm md:text-xs font-bold tracking-wider uppercase transition-all shadow-sm shrink-0 whitespace-nowrap active:scale-95",
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
                    <div className="w-full md:w-[320px] lg:w-[380px] border-t md:border-t-0 md:border-l border-border/50 bg-surface/30 overflow-visible md:overflow-y-auto md:overflow-x-hidden custom-scrollbar p-4 md:p-6 pb-[calc(1.75rem+env(safe-area-inset-bottom))] space-y-6 md:space-y-8">
                        {/* Time Tracking */}
                        <div className="space-y-3 rounded-2xl border border-emerald-300/15 bg-emerald-400/5 p-4 md:p-5">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm md:text-xs uppercase font-bold tracking-[0.2em] text-emerald-200/90 flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" /> Time Tracking
                                </h4>
                                <button
                                    onClick={openManualSessionEditor}
                                    className="touch-target inline-flex items-center justify-center rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20 transition-colors"
                                    title="Add tracked session manually"
                                    aria-label="Add tracked session manually"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <button
                                onClick={() => void handleToggleTimer()}
                                disabled={isTimerSyncing}
                                className={cn(
                                    "touch-target w-full inline-flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl border text-base md:text-sm font-black uppercase tracking-wider transition-all",
                                    isTimerActiveForTask
                                        ? "bg-emerald-400/15 border-emerald-300/30 text-emerald-200"
                                        : "bg-surface-secondary/60 border-border/60 text-text-primary hover:border-emerald-300/25 hover:text-emerald-100",
                                    isTimerSyncing && "opacity-60 cursor-not-allowed"
                                )}
                                aria-live="polite"
                            >
                                {isTimerActiveForTask ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                <span>
                                    {isTimerActiveForTask
                                        ? `Stop · ${formatElapsed(elapsedSeconds)}`
                                        : isAnotherTaskTimerActive
                                            ? 'Switch Focus Timer'
                                            : 'Start Focus Timer'}
                                </span>
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-lg border border-border/40 bg-surface/50 px-3 py-2">
                                    <p className="text-sm md:text-xs uppercase tracking-widest text-text-muted">Tracked</p>
                                    <p className="text-sm font-black text-text-primary">{formatSessionDuration(totalTrackedSeconds)}</p>
                                </div>
                                <div className="rounded-lg border border-border/40 bg-surface/50 px-3 py-2">
                                    <p className="text-sm md:text-xs uppercase tracking-widest text-text-muted">Sessions</p>
                                    <p className="text-sm font-black text-text-primary">{closedTaskSessions.length}</p>
                                </div>
                            </div>

                            {isSessionEditorOpen && (
                                <div className="rounded-xl border border-border/60 bg-surface/80 p-3 space-y-2.5">
                                    <p className="text-sm md:text-xs uppercase font-bold tracking-[0.18em] text-text-muted">
                                        {editingSessionId ? 'Edit Session' : 'Add Session'}
                                    </p>
                                    <div className="space-y-2">
                                        <div>
                                            <label className="block text-sm md:text-xs uppercase tracking-wider text-text-muted mb-1">Start</label>
                                            <DateTimePicker
                                                value={sessionStartInput}
                                                onChange={setSessionStartInput}
                                                placeholder="Session start"
                                                type="datetime-local"
                                                className="bg-surface-secondary/50 border-border/60"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm md:text-xs uppercase tracking-wider text-text-muted mb-1">End</label>
                                            <DateTimePicker
                                                value={sessionEndInput}
                                                onChange={setSessionEndInput}
                                                placeholder="Session end"
                                                type="datetime-local"
                                                className="bg-surface-secondary/50 border-border/60"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={closeSessionEditor}
                                            className="touch-target px-3 py-1.5 text-sm md:text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => void submitSessionEditor()}
                                            disabled={isSavingSession}
                                            className="touch-target px-3 py-1.5 rounded-lg bg-accent text-white text-sm md:text-xs font-black uppercase tracking-wider hover:bg-accent/90 transition-colors disabled:opacity-50"
                                        >
                                            {isSavingSession ? 'Saving...' : editingSessionId ? 'Save Changes' : 'Add Session'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                                {isLoadingSessions ? (
                                    <p className="text-sm md:text-xs text-text-muted">Loading sessions...</p>
                                ) : taskSessions.length === 0 ? (
                                    <p className="text-sm md:text-xs text-text-muted">No tracked sessions yet.</p>
                                ) : (
                                    taskSessions.map((session) => {
                                        const isActiveRow = session.ended_at === null
                                        return (
                                            <div
                                                key={session.id}
                                                className="rounded-lg border border-border/40 bg-surface/60 px-3 py-2 space-y-1"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className={cn(
                                                        "text-sm md:text-xs uppercase tracking-widest font-bold",
                                                        isActiveRow ? "text-emerald-300" : "text-text-muted"
                                                    )}>
                                                        {isActiveRow ? 'Running' : formatSessionDuration(session.duration_seconds)}
                                                    </span>
                                                    {!isActiveRow && (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => openEditSessionEditor(session)}
                                                                className="touch-target inline-flex items-center gap-1 text-sm md:text-xs font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
                                                            >
                                                                <Pencil className="w-3 h-3" />
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => void handleDeleteSession(session)}
                                                                disabled={deletingSessionId === session.id}
                                                                className="touch-target inline-flex items-center gap-1 text-sm md:text-xs font-bold uppercase tracking-wider text-red-300/80 hover:text-red-300 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                                {deletingSessionId === session.id ? 'Deleting...' : 'Delete'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-base md:text-sm text-text-primary">
                                                    {formatSessionDateTime(session.started_at)}
                                                </p>
                                                <p className="text-base md:text-sm text-text-muted">
                                                    {session.ended_at ? `to ${formatSessionDateTime(session.ended_at)}` : `elapsed ${isTimerActiveForTask && activeTaskSession?.id === session.id ? formatElapsed(elapsedSeconds) : '--:--:--'}`}
                                                </p>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>

                        {/* Context Properties */}
                        <div className="space-y-6">
                            <h4 className="text-sm md:text-xs uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Properties
                            </h4>

                            <div className="space-y-5">
                                {/* Status Picker Selector */}
                                <div className="space-y-1.5 pt-1">
                                    <span className="text-sm md:text-xs font-bold text-text-muted/80 px-1 uppercase tracking-wider">Status</span>
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
                                    onChange={(val) => {
                                        const next = val as 'home' | 'outside' | null
                                        setLocation(next)
                                        handleFieldUpdate('location', next)
                                    }}
                                />
                                <PillGroup
                                    label="Energy"
                                    value={energy}
                                    options={[
                                        { value: 'high', icon: <Zap className="w-3.5 h-3.5" />, label: 'High' },
                                        { value: 'low', icon: <ZapOff className="w-3.5 h-3.5" />, label: 'Low' }
                                    ]}
                                    onChange={(val) => {
                                        const next = val as 'high' | 'low' | null
                                        setEnergy(next)
                                        handleFieldUpdate('energy', next)
                                    }}
                                />
                                <PillGroup
                                    label="Focus"
                                    value={focus}
                                    options={[
                                        { value: 'immersion', icon: <Target className="w-3.5 h-3.5" />, label: 'Immersion' },
                                        { value: 'process', icon: <Layers className="w-3.5 h-3.5" />, label: 'Process' }
                                    ]}
                                    onChange={(val) => {
                                        const next = val as 'immersion' | 'process' | null
                                        setFocus(next)
                                        handleFieldUpdate('focus', next)
                                    }}
                                />

                                <div className="space-y-2.5">
                                    <span className="text-sm md:text-xs uppercase font-bold tracking-[0.15em] text-text-primary block flex items-center gap-2">
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
                                                    "touch-target px-2.5 py-1 rounded-lg border text-sm md:text-xs font-bold transition-all",
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
                            <h4 className="text-sm md:text-xs uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
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
                            <h4 className="text-sm md:text-xs uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
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
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <DateTimePicker
                                            value={recurrenceEndAt}
                                            onChange={(val) => {
                                                setRecurrenceEndAt(val)
                                                handleFieldUpdate('recurrence_end_at', val || null)
                                            }}
                                            placeholder="Ends never"
                                            type="date"
                                            className="bg-surface/50 hover:bg-surface/80 border-border/50 hover:border-border rounded-xl"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="space-y-3">
                            <h4 className="text-sm md:text-xs uppercase font-bold tracking-[0.2em] text-text-muted/80 flex items-center gap-2">
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
                                    <span className="text-base md:text-sm font-bold uppercase tracking-wider">Do Today</span>
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
            {showDeleteConfirm && task && resolvedTaskId && (
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
                                        await deleteTask(resolvedTaskId)
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
                                            .or(`id.eq.${resolvedTaskId},parent_task_id.eq.${resolvedTaskId}`)
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
                                await deleteTask(resolvedTaskId)
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

            <ConfirmModal
                isOpen={Boolean(sessionDeleteConfirm)}
                title="Delete tracked session?"
                description="This cannot be undone."
                options={[
                    {
                        label: deletingSessionId === sessionDeleteConfirm?.id ? 'Deleting...' : 'Delete Session',
                        description: 'Permanently remove this tracked time entry.',
                        variant: 'danger',
                        onClick: () => { void confirmDeleteSession() }
                    }
                ]}
                onCancel={() => {
                    if (deletingSessionId) return
                    setSessionDeleteConfirm(null)
                }}
                onClose={() => {
                    if (deletingSessionId) return
                    setSessionDeleteConfirm(null)
                }}
            />
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
            <span className="text-sm md:text-xs uppercase font-bold tracking-[0.15em] text-text-primary block">{label}</span>
            <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                    <button
                        key={String(opt.value)}
                        onClick={() => onChange(value === opt.value ? null : opt.value)}
                        className={cn(
                            "touch-target flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-sm md:text-xs font-bold tracking-wide transition-all",
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
