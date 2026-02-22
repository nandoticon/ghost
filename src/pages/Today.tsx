import { useMemo, useState, useCallback, useEffect } from 'react'
import { Plus, ChevronDown, ChevronRight, ChevronUp, LayoutList, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { format } from 'date-fns'
import confetti from 'canvas-confetti'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useTasks } from '../hooks/useTasks'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { FocusMode } from '../components/FocusMode'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import { Task } from '../types'
import { useShortcutContext } from '../context/ShortcutContext'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { SuggestTaskModal } from '../components/SuggestTaskModal'
import { useProfile } from '../hooks/useProfile'
import { useTimer } from '../context/TimerContext'
import { listSessionsByRange } from '../lib/timeTracking'
import { cn } from '../lib/cn'
import { useTaskById } from '../hooks/useTaskById'

const DAILY_BUDGET_OPTIONS_HOURS = [2, 4, 6, 8, 10, 12] as const
const DEFAULT_DAILY_BUDGET_HOURS = 6
const FOCUS_PANEL_MODES = ['collapsed', 'detailed'] as const
type FocusPanelMode = (typeof FOCUS_PANEL_MODES)[number]
const DEFAULT_FOCUS_PANEL_MODE: FocusPanelMode = 'collapsed'

function getDailyBudgetStorageKey(userId?: string): string {
    return `ghost.daily_budget_hours:${userId ?? 'default'}`
}

function getFocusPanelModeStorageKey(userId?: string): string {
    return `ghost.focus_panel_mode:${userId ?? 'default'}`
}

function parseDailyBudgetHours(value: unknown): number | null {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    if (!DAILY_BUDGET_OPTIONS_HOURS.includes(parsed as (typeof DAILY_BUDGET_OPTIONS_HOURS)[number])) return null
    return parsed
}

function parseFocusPanelMode(value: unknown): FocusPanelMode | null {
    if (typeof value !== 'string') return null
    if (value === 'compact') return 'detailed' // backward compatibility for older stored value
    if (!FOCUS_PANEL_MODES.includes(value as FocusPanelMode)) return null
    return value as FocusPanelMode
}

export default function Today() {
    const { user, loading: authLoading } = useAuth()
    const userId = user?.id
    const filters = useMemo(() => ({ today: true }), [])
    const { tasks, loading, createTask, updateTask, completeTask, reorderTasks, snoozeTask } = useTasks(filters)
    const { showToast } = useToast()
    const { setActiveTaskId } = useShortcutContext()
    const { profile } = useProfile()
    const { activeSession, elapsedSeconds, stopTimer } = useTimer()
    const { task: activeTimerTask } = useTaskById(activeSession?.task_id ?? null)

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isSuggestModalOpen, setIsSuggestModalOpen] = useState(false)
    const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
    const [showClearConfirm, setShowClearConfirm] = useState(false)
    const [focusedTask, setFocusedTask] = useState<Task | null>(null)
    const [focusedTodaySeconds, setFocusedTodaySeconds] = useState(0)
    const [dailyBudgetHours, setDailyBudgetHours] = useState<number>(DEFAULT_DAILY_BUDGET_HOURS)
    const [focusPanelMode, setFocusPanelMode] = useState<FocusPanelMode>(DEFAULT_FOCUS_PANEL_MODE)
    const [preferencesHydrated, setPreferencesHydrated] = useState(false)

    // Split tasks
    const remainingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks])
    const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks])
    const completedTodayCount = useMemo(() => {
        const now = new Date()
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const endOfToday = startOfToday + 24 * 60 * 60 * 1000
        return completedTasks.filter((task) => {
            if (!task.completed_at) return false
            const completedAtMs = new Date(task.completed_at).getTime()
            return completedAtMs >= startOfToday && completedAtMs < endOfToday
        }).length
    }, [completedTasks])

    const totalCount = tasks.length
    const completedCount = completedTasks.length
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

    // Capacity Calculations
    const dailyCapacityMins = dailyBudgetHours * 60
    const totalRemainingEffort = useMemo(() => remainingTasks.reduce((acc, t) => acc + (t.estimated_effort || 0), 0), [remainingTasks])
    const totalCompletedEffort = useMemo(() => completedTasks.reduce((acc, t) => acc + (t.estimated_effort || 0), 0), [completedTasks])
    const totalScheduledEffort = totalRemainingEffort + totalCompletedEffort
    const capacityUsage = (totalScheduledEffort / dailyCapacityMins) * 100
    const focusedTodayMins = Math.floor(focusedTodaySeconds / 60)
    const focusedBudgetUsage = (focusedTodayMins / dailyCapacityMins) * 100

    const formatMins = (mins: number) => {
        if (mins === 0) return '0m'
        const h = Math.floor(mins / 60)
        const m = mins % 60
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
    }

    const formatHoursMins = (seconds: number) => {
        const mins = Math.floor(seconds / 60)
        return formatMins(mins)
    }

    const refreshFocusedToday = useCallback(async () => {
        const now = new Date()
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)

        try {
            const sessions = await listSessionsByRange({
                from: start.toISOString(),
                to: now.toISOString(),
            })

            const closedSeconds = sessions.reduce((acc, session) => {
                if (session.ended_at && session.duration_seconds) {
                    return acc + session.duration_seconds
                }
                return acc
            }, 0)

            const liveSeconds = activeSession && !activeSession.ended_at
                ? elapsedSeconds
                : 0

            setFocusedTodaySeconds(closedSeconds + liveSeconds)
        } catch {
            setFocusedTodaySeconds(activeSession && !activeSession.ended_at ? elapsedSeconds : 0)
        }
    }, [activeSession, elapsedSeconds])

    useEffect(() => {
        void refreshFocusedToday()
    }, [refreshFocusedToday])

    useEffect(() => {
        let cancelled = false

        const hydrateTodayPreferences = async () => {
            const budgetStorageKey = getDailyBudgetStorageKey(userId)
            const panelStorageKey = getFocusPanelModeStorageKey(userId)
            const localBudgetFallback = parseDailyBudgetHours(localStorage.getItem(budgetStorageKey))
            const localPanelFallback = parseFocusPanelMode(localStorage.getItem(panelStorageKey))

            if (!userId) {
                if (!cancelled) {
                    setDailyBudgetHours(localBudgetFallback ?? DEFAULT_DAILY_BUDGET_HOURS)
                    setFocusPanelMode(localPanelFallback ?? DEFAULT_FOCUS_PANEL_MODE)
                    setPreferencesHydrated(true)
                }
                return
            }

            const { data } = await supabase.auth.getUser()
            const remoteBudget = parseDailyBudgetHours(data.user?.user_metadata?.daily_budget_hours)
            const remotePanelMode = parseFocusPanelMode(data.user?.user_metadata?.today_focus_panel_mode)

            const resolvedBudget = remoteBudget ?? localBudgetFallback ?? DEFAULT_DAILY_BUDGET_HOURS
            const resolvedPanelMode = remotePanelMode ?? localPanelFallback ?? DEFAULT_FOCUS_PANEL_MODE

            if (!cancelled) {
                setDailyBudgetHours(resolvedBudget)
                setFocusPanelMode(resolvedPanelMode)
                setPreferencesHydrated(true)
            }
        }

        setPreferencesHydrated(false)
        void hydrateTodayPreferences()

        return () => {
            cancelled = true
        }
    }, [userId])

    useEffect(() => {
        if (!preferencesHydrated) return

        const budgetStorageKey = getDailyBudgetStorageKey(userId)
        const panelStorageKey = getFocusPanelModeStorageKey(userId)
        localStorage.setItem(budgetStorageKey, String(dailyBudgetHours))
        localStorage.setItem(panelStorageKey, focusPanelMode)
    }, [dailyBudgetHours, focusPanelMode, userId, preferencesHydrated])

    useEffect(() => {
        if (!preferencesHydrated || !user) return

        const currentRemoteBudget = parseDailyBudgetHours(user.user_metadata?.daily_budget_hours)
        const currentRemotePanelMode = parseFocusPanelMode(user.user_metadata?.today_focus_panel_mode)
        if (currentRemoteBudget === dailyBudgetHours && currentRemotePanelMode === focusPanelMode) return

        const timeoutId = window.setTimeout(async () => {
            const { error } = await supabase.auth.updateUser({
                data: {
                    ...user.user_metadata,
                    daily_budget_hours: dailyBudgetHours,
                    today_focus_panel_mode: focusPanelMode,
                },
            })

            if (error) {
                console.error('Failed to sync Today preferences to account metadata:', error)
            }
        }, 250)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [preferencesHydrated, dailyBudgetHours, focusPanelMode, user])

    const displayName = useMemo(() => {
        if (profile?.full_name) {
            return profile.full_name.split(' ')[0]
        }
        const raw = user?.email?.split('@')[0] ?? 'there'
        const firstToken = raw.split(/[._-]/)[0] || 'there'
        return firstToken.charAt(0).toUpperCase() + firstToken.slice(1)
    }, [user?.email, profile?.full_name])

    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        if (hour < 12) return `Good morning, ${displayName} ☀`
        if (hour < 18) return `Good afternoon, ${displayName} 🌤`
        return `Good evening, ${displayName} 🌙`
    }, [displayName])

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination) return

        const items = Array.from(remainingTasks)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        // Reconstruct full list for persistence
        const newOrderedIds = [...items, ...completedTasks].map(i => i.id)
        reorderTasks(newOrderedIds)
    }

    const handleSave = async (taskData: Partial<Task>) => {
        try {
            await createTask({ ...taskData, today: true })
            showToast('Task created for today', 'success')
            setIsFormOpen(false)
        } catch (_error) {
            showToast('Failed to create task', 'error')
        }
    }

    const clearCompleted = async () => {
        const updates = completedTasks.map(t => updateTask(t.id, { today: false }))
        await Promise.all(updates)
        setShowClearConfirm(false)
    }

    const handleToggleComplete = useCallback(async (id: string, completed: boolean) => {
        const res = await completeTask(id, completed)
        if (res.success && completed) {
            // Trigger celebration
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFA500', '#FF4500', '#87CEEB', '#98FB98'],
                zIndex: 1000
            })

            if (res.nextOccurrenceCreated) {
                showToast(`Task completed · Next on ${res.nextOccurrenceDate ? format(new Date(res.nextOccurrenceDate), 'MMM d') : 'the future'}`, 'success')
            } else {
                showToast("Task crushed! 🏆", "success")
            }
        }
    }, [completeTask, showToast])

    const handleToggleToday = useCallback((id: string, today: boolean) => {
        updateTask(id, { today })
    }, [updateTask])

    const handleTaskClick = useCallback(() => { }, [])
    const handleTitleClick = useCallback((t: Task) => setActiveTaskId(t.id, t.short_id), [setActiveTaskId])
    const isFocusPanelCollapsed = focusPanelMode === 'collapsed'
    const isFocusPanelDetailed = focusPanelMode === 'detailed'

    return (
        <div className="w-full max-w-full mx-auto px-4 pt-4 pb-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">
                        Today
                    </h1>
                    {authLoading ? (
                        <div className="h-5 md:h-6 w-48 bg-surface-secondary animate-pulse rounded-lg mt-1" />
                    ) : (
                        <p className="text-xs md:text-sm uppercase tracking-widest font-black text-accent-warm/90">{greeting}</p>
                    )}
                    <p className="text-sm md:text-base 2xl:text-lg text-text-muted font-medium">
                        {format(new Date(), 'EEEE, MMMM do')}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsSuggestModalOpen(true)}
                        className="flex items-center space-x-2 px-4 sm:px-5 py-2.5 2xl:px-6 2xl:py-3 bg-surface-secondary hover:bg-surface-secondary/80 border border-border/50 text-white rounded-full text-xs sm:text-sm 2xl:text-base font-bold transition-all active:scale-95 shadow-lg shadow-black/10"
                    >
                        <Sparkles className="w-4 h-4 2xl:w-5 2xl:h-5 text-accent-warm" />
                        <span className="hidden md:inline">Magic Suggestion</span>
                    </button>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="hidden md:flex items-center space-x-2 px-4 sm:px-5 py-2.5 2xl:px-6 2xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-xs sm:text-sm 2xl:text-base font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                    >
                        <Plus className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        <span>Add Task</span>
                    </button>
                </div>
            </header>

            {/* Progress/Capacity Bar */}
            <div className={isFocusPanelCollapsed ? "space-y-2.5 bg-surface-secondary/20 border border-border/40 rounded-2xl p-3.5" : "space-y-2.5 bg-surface-secondary/20 border border-border/40 rounded-2xl p-3.5 md:p-4"}>
                {activeSession && (
                    <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/5 px-3 py-2.5">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-[10px] md:text-xs uppercase tracking-[0.18em] font-black text-emerald-200/90">
                                    Active Timer · {formatHoursMins(elapsedSeconds)}
                                </div>
                                <div className="truncate text-sm md:text-base font-bold text-text-primary">
                                    {activeTimerTask?.title || 'Focus timer running'}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeSession.task_id && (
                                    <button
                                        onClick={() => setActiveTaskId(activeSession.task_id, activeTimerTask?.short_id)}
                                        className="touch-target px-3 py-1.5 rounded-lg border border-border/60 bg-surface/70 text-text-primary text-sm md:text-xs font-bold uppercase tracking-wider hover:border-accent/40 hover:text-accent transition-colors"
                                    >
                                        Open Task
                                    </button>
                                )}
                                <button
                                    onClick={() => void stopTimer()}
                                    className="touch-target px-3 py-1.5 rounded-lg border border-emerald-300/25 bg-emerald-400/10 text-emerald-300 text-sm md:text-xs font-bold uppercase tracking-wider hover:bg-emerald-400/15 transition-colors"
                                >
                                    Stop Timer
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="flex items-center justify-between gap-2 text-sm md:text-xs text-text-muted min-w-0">
                    <div className="flex items-center justify-between md:justify-start md:gap-2 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-bold uppercase tracking-widest">Focused today</span>
                            <button
                                onClick={() => setFocusPanelMode(isFocusPanelCollapsed ? 'detailed' : 'collapsed')}
                                className="touch-target inline-flex items-center justify-center rounded-lg hover:bg-surface-secondary/60 text-text-muted hover:text-text-primary transition-colors"
                                title={isFocusPanelCollapsed ? 'Expand focus panel' : 'Collapse focus panel'}
                                aria-label={isFocusPanelCollapsed ? 'Expand focus panel' : 'Collapse focus panel'}
                            >
                                {isFocusPanelCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                            </button>
                        </div>
                        {isFocusPanelCollapsed && (
                            <span className="md:hidden text-text-primary font-black text-base">{formatHoursMins(focusedTodaySeconds)}</span>
                        )}
                    </div>
                    <div className="w-[4.5rem] shrink-0">
                        <select
                            value={dailyBudgetHours}
                            onChange={(e) => setDailyBudgetHours(Number(e.target.value))}
                            className="touch-target h-10 w-full px-2 py-1 rounded-lg border border-border/60 bg-surface text-text-primary font-black uppercase tracking-wider text-base md:text-xs focus:outline-none focus:border-accent"
                            aria-label="Select daily time budget"
                        >
                            {DAILY_BUDGET_OPTIONS_HOURS.map((hours) => (
                                <option key={hours} value={hours}>
                                    {hours}h
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {isFocusPanelCollapsed ? (
                    <div className="grid grid-cols-3 gap-2 text-sm md:text-xs min-w-0">
                        <div className="rounded-lg border border-border/40 bg-surface/40 px-2.5 py-2">
                            <p className="text-sm md:text-xs uppercase tracking-wider text-text-muted">Focused</p>
                            <p className="text-text-primary font-black">{formatHoursMins(focusedTodaySeconds)}</p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-surface/40 px-2.5 py-2">
                            <p className="text-sm md:text-xs uppercase tracking-wider text-text-muted">Done</p>
                            <p className={cn("font-black", progress === 100 ? 'text-accent-warm' : 'text-text-primary')}>
                                {Math.round(progress)}%
                            </p>
                        </div>
                        <div className="rounded-lg border border-border/40 bg-surface/40 px-2.5 py-2">
                            <p className="text-sm md:text-xs uppercase tracking-wider text-text-muted">Budget</p>
                            <p className={cn("font-black truncate", capacityUsage > 100 ? 'text-red-400' : 'text-text-primary')}>
                                {formatMins(totalScheduledEffort)} / {formatMins(dailyCapacityMins)}
                            </p>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between text-sm md:text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted">
                            <span className="flex items-center gap-2">
                                {progress === 100 ? (
                                    <span className="text-accent-warm inline-flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        All done!
                                    </span>
                                ) : (
                                    <span>Progress</span>
                                )}
                            </span>
                            <div className="flex items-center gap-3">
                                <span className={progress === 100 ? 'text-accent-warm font-black' : ''}>
                                    {Math.round(progress)}% · {completedCount} of {totalCount}
                                </span>
                                <span className="text-text-primary font-black text-sm md:text-base">{formatHoursMins(focusedTodaySeconds)}</span>
                                {activeSession && isFocusPanelDetailed && (
                                    <span className="hidden md:inline text-emerald-200 font-black uppercase tracking-widest text-xs">
                                        Timer Running
                                    </span>
                                )}
                            </div>
                        </div>
                        {isFocusPanelDetailed && (
                            <p className={progress === 100 ? "text-sm md:text-xs text-accent-warm font-semibold" : "text-sm md:text-xs text-text-muted"}>
                                {progress === 100 ? 'Everything scheduled for today is complete.' : `${remainingTasks.length} task${remainingTasks.length !== 1 ? 's' : ''} left to finish.`}
                            </p>
                        )}
                        <div className="relative h-2.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                style={{
                                    width: `${progress}%`,
                                    background: progress === 100
                                        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                        : 'linear-gradient(90deg, var(--color-accent), #a78bfa)'
                                }}
                            />
                            {progress > 0 && progress < 100 && (
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                            )}
                        </div>

                        {/* Focused Time Visualization */}
                        <div className="pt-2 mt-1 border-t border-border/20 space-y-2">
                            <div className="flex items-center justify-between text-sm md:text-xs uppercase font-bold tracking-widest text-text-muted">
                                <span className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-emerald-300" />
                                    Focused Time
                                </span>
                                <span className={focusedBudgetUsage > 100 ? 'text-emerald-200 font-black' : 'text-text-primary'}>
                                    {formatMins(focusedTodayMins)} / {formatMins(dailyCapacityMins)}
                                </span>
                            </div>
                            <div className="relative h-1.5 w-full bg-surface-secondary/50 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-300/70 transition-all duration-700"
                                    style={{ width: `${Math.min(100, focusedBudgetUsage)}%` }}
                                />
                                {focusedBudgetUsage > 100 && (
                                    <div className="absolute top-0 right-0 bottom-0 w-1 bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]" />
                                )}
                            </div>
                            <div className="flex justify-between items-center text-sm md:text-xs text-text-muted italic">
                                {focusedBudgetUsage > 100 ? (
                                    <span className="text-emerald-300 font-medium">You exceeded your focus budget today.</span>
                                ) : (
                                    <span>{formatMins(Math.max(0, dailyCapacityMins - focusedTodayMins))} left in today’s focus budget</span>
                                )}
                            </div>
                        </div>

                        {/* Planned Capacity Visualization */}
                        {isFocusPanelDetailed && totalScheduledEffort > 0 && (
                            <div className="pt-2 mt-1 border-t border-border/20 space-y-2">
                                <div className="flex items-center justify-between text-sm md:text-xs uppercase font-bold tracking-widest text-text-muted">
                                    <span className="flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-accent-warm" />
                                        Planned Load
                                    </span>
                                    <span className={capacityUsage > 100 ? 'text-red-400 font-black animate-pulse' : 'text-text-primary'}>
                                        {formatMins(totalScheduledEffort)} / {formatMins(dailyCapacityMins)}
                                    </span>
                                </div>
                                <div className="relative h-1.5 w-full bg-surface-secondary/50 rounded-full overflow-hidden flex">
                                    {/* Completed Effort */}
                                    <div
                                        className="h-full bg-accent-warm/40 transition-all duration-1000"
                                        style={{ width: `${Math.min(100, (totalCompletedEffort / dailyCapacityMins) * 100)}%` }}
                                    />
                                    {/* Remaining Effort */}
                                    <div
                                        className="h-full bg-accent/30 transition-all duration-1000 border-l border-white/10"
                                        style={{ width: `${Math.min(100 - (totalCompletedEffort / dailyCapacityMins) * 100, (totalRemainingEffort / dailyCapacityMins) * 100)}%` }}
                                    />
                                    {/* Over-capacity indicator */}
                                    {capacityUsage > 100 && (
                                        <div className="absolute top-0 right-0 bottom-0 w-1 bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
                                    )}
                                </div>
                                <div className="flex justify-between items-center text-sm md:text-xs text-text-muted italic">
                                    {capacityUsage > 100 ? (
                                        <span className="text-red-400 font-medium">Over-capacity by {formatMins(totalScheduledEffort - dailyCapacityMins)}</span>
                                    ) : (
                                        <span>{formatMins(dailyCapacityMins - totalScheduledEffort)} remaining in your focus budget</span>
                                    )}
                                    <span className="opacity-60">Goal: {dailyBudgetHours}h / day</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Task Sections */}
            <div className="space-y-12">
                {/* Remaining */}
                <div className="space-y-4">
                    {loading && tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm 2xl:text-base text-text-muted">Gathering your tasks...</p>
                        </div>
                    ) : remainingTasks.length === 0 && completedTasks.length === 0 ? (
                        <EmptyState
                            icon={LayoutList}
                            title="Nothing for today"
                            description="Add a task or mark one for today to get started."
                        />
                    ) : (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId="remaining-today">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {remainingTasks.map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps}>
                                                        <TaskItem
                                                            task={task}
                                                            onToggleComplete={handleToggleComplete}
                                                            onToggleToday={handleToggleToday}
                                                            onSnooze={snoozeTask}
                                                            onFocus={setFocusedTask}
                                                            onClick={handleTaskClick}
                                                            onClickTitle={handleTitleClick}
                                                            dragHandleProps={provided.dragHandleProps}
                                                            isDragging={snapshot.isDragging}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}

                    {/* Quick Add Inline */}
                    {remainingTasks.length > 0 && (
                        <button
                            onClick={() => setIsFormOpen(true)}
                            className="group w-full flex items-center space-x-3 px-10 py-3 2xl:py-4 text-text-muted hover:text-accent transition-all"
                        >
                            <Plus className="w-4 h-4 2xl:w-5 2xl:h-5" />
                            <span className="text-sm 2xl:text-base font-medium">Add task</span>
                        </button>
                    )}
                </div>

                {/* Completed Section */}
                {completedTasks.length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <button
                                onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                                className="flex items-center space-x-2 text-text-muted hover:text-text-primary transition-colors group"
                            >
                                {isCompletedExpanded ? <ChevronDown className="w-4 h-4 2xl:w-5 2xl:h-5" /> : <ChevronRight className="w-4 h-4 2xl:w-5 2xl:h-5" />}
                                <div className="flex flex-col items-start">
                                    <span className="text-sm md:text-xs 2xl:text-sm font-black uppercase tracking-widest text-accent-warm">
                                        Daily Wins · {completedTodayCount}
                                    </span>
                                    {isCompletedExpanded && (
                                        <span className="text-xs 2xl:text-xs font-bold text-text-muted/70 lowercase italic">
                                            {completedTodayCount === 0 ? "Let's get some wins!" : `${completedTodayCount} tasks crushed today! 🏆`}
                                        </span>
                                    )}
                                </div>
                            </button>

                            {isCompletedExpanded && (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="touch-target text-sm md:text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted hover:text-red-400 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {isCompletedExpanded && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                {completedTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onToggleComplete={handleToggleComplete}
                                        onToggleToday={handleToggleToday}
                                        onFocus={setFocusedTask}
                                        onClick={handleTaskClick}
                                        onClickTitle={handleTitleClick}
                                        hideDragHandle
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Form Modal (Create only) */}
            <TaskForm
                isOpen={isFormOpen}
                defaultToday={true}
                onSave={handleSave}
                onCancel={() => setIsFormOpen(false)}
            />

            {/* Clear Completed Confirmation */}
            {showClearConfirm && (
                <ConfirmModal
                    title="Remove completed tasks?"
                    description={`This will remove ${completedTasks.length} completed task${completedTasks.length !== 1 ? 's' : ''} from Today. They won't be deleted.`}
                    options={[{
                        label: `Remove ${completedTasks.length} task${completedTasks.length !== 1 ? 's' : ''} from Today`,
                        variant: 'danger',
                        onClick: clearCompleted
                    }]}
                    onCancel={() => setShowClearConfirm(false)}
                />
            )}

            {/* Suggest Task Modal */}
            <SuggestTaskModal
                isOpen={isSuggestModalOpen}
                onClose={() => setIsSuggestModalOpen(false)}
            />

            {/* Ambient Focus Mode Overlay */}
            {focusedTask && (
                <FocusMode
                    task={focusedTask}
                    onClose={() => setFocusedTask(null)}
                    onComplete={handleToggleComplete}
                />
            )}
        </div>
    )
}
