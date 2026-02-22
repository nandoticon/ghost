import React, { useEffect, useState } from 'react'
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd'
import {
    Circle,
    CheckCircle2,
    Star,
    Home,
    MapPin,
    Zap,
    ZapOff,
    Target,
    Layers,
    Clock,
    GripVertical,
    RefreshCw,
    Moon,
    Maximize2,
    Pause,
    Play
} from 'lucide-react'
import { Task } from '../types'
import { cn } from '../lib/cn'
import { format, isToday, isPast, startOfDay } from 'date-fns'
import { useTimer } from '../context/TimerContext'
import { interactiveListCardShell, interactiveListCardHover, interactiveListCardSelected } from './cardTokens'

interface TaskItemProps {
    task: Task
    onToggleComplete: (id: string, completed: boolean) => void
    onToggleToday: (id: string, today: boolean) => void
    onSnooze?: (id: string) => void
    onFocus?: (task: Task) => void
    onClick: (task: Task) => void
    onClickTitle?: (task: Task) => void
    dragHandleProps?: DraggableProvidedDragHandleProps | null
    isDragging?: boolean
    hideDragHandle?: boolean
    isSelected?: boolean
    onSelect?: (taskId: string, event: React.MouseEvent) => void
}

export const TaskItem = React.memo<TaskItemProps>(({
    task,
    onToggleComplete,
    onToggleToday,
    onClick,
    onClickTitle,
    dragHandleProps,
    isDragging,
    hideDragHandle = false,
    onSnooze,
    onFocus,
    isSelected,
    onSelect
}) => {
    const isCompleted = task.completed
    const { activeSession, toggleTimer, isSyncing } = useTimer()
    const isTimerActiveForTask = activeSession?.task_id === task.id
    const isAnotherTimerActive = Boolean(activeSession && activeSession.task_id !== task.id)
    const [liveElapsedSeconds, setLiveElapsedSeconds] = useState(0)

    useEffect(() => {
        if (!isTimerActiveForTask || !activeSession?.started_at) {
            setLiveElapsedSeconds(0)
            return
        }

        const startedAtMs = new Date(activeSession.started_at).getTime()
        if (Number.isNaN(startedAtMs)) {
            setLiveElapsedSeconds(0)
            return
        }

        const updateElapsed = () => {
            const seconds = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
            setLiveElapsedSeconds(seconds)
        }

        updateElapsed()
        const interval = window.setInterval(updateElapsed, 1000)
        return () => window.clearInterval(interval)
    }, [isTimerActiveForTask, activeSession?.started_at])

    const formatElapsed = (seconds: number) => {
        const h = Math.floor(seconds / 3600)
        const m = Math.floor((seconds % 3600) / 60)
        const s = seconds % 60

        const hh = String(h).padStart(2, '0')
        const mm = String(m).padStart(2, '0')
        const ss = String(s).padStart(2, '0')

        return `${hh}:${mm}:${ss}`
    }

    const getContextPills = () => {
        const pills = []

        if (task.location === 'home') pills.push(<ContextPill key="loc" icon={<Home className="w-3 h-3" />} label="Home" />)
        if (task.location === 'outside') pills.push(<ContextPill key="loc" icon={<MapPin className="w-3 h-3" />} label="Outside" />)

        if (task.energy === 'high') pills.push(<ContextPill key="en" icon={<Zap className="w-3 h-3 text-accent-warm" />} label="High" />)
        if (task.energy === 'low') pills.push(<ContextPill key="en" icon={<ZapOff className="w-3 h-3 text-blue-400" />} label="Low" />)

        if (task.focus === 'immersion') pills.push(<ContextPill key="fo" icon={<Target className="w-3 h-3 text-purple-400" />} label="Immersion" />)
        if (task.focus === 'process') pills.push(<ContextPill key="fo" icon={<Layers className="w-3 h-3 text-green-400" />} label="Process" />)

        return pills
    }

    const getDueDateStyle = () => {
        if (!task.end_at || isCompleted) return null
        const dueDate = new Date(task.end_at)

        if (isToday(dueDate)) {
            return "text-accent-warm bg-accent-warm/10 border-accent-warm/20"
        }

        if (isPast(dueDate) && startOfDay(dueDate) < startOfDay(new Date())) {
            return "text-red-500 bg-red-500/10 border-red-500/20 font-heavy"
        }

        return "text-text-muted bg-surface-secondary/40 border-border/40"
    }

    const dueDateStyle = getDueDateStyle()
    const isOverdue = !isCompleted && task.end_at && isPast(new Date(task.end_at)) && !isToday(new Date(task.end_at))
    const handleFocus = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onFocus?.(task)
    }
    const handleToggleTimer = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        void toggleTimer(task.id, 'manual')
    }
    const handleSnooze = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onSnooze?.(task.id)
    }
    const handleToggleToday = (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onToggleToday(task.id, !task.today)
    }
    const timerActionLabel = isTimerActiveForTask
        ? 'Stop timer'
        : isAnotherTimerActive
            ? 'Switch timer'
            : 'Start timer'
    const timerAriaLabel = isTimerActiveForTask
        ? 'Stop focus timer for task'
        : isAnotherTimerActive
            ? 'Switch active timer to this task'
            : 'Start focus timer for task'

    const openTask = () => {
        if (onClickTitle) {
            onClickTitle(task)
            return
        }
        onClick(task)
    }

    return (
        <div
            className={cn(
                interactiveListCardShell,
                "flex items-start md:items-center gap-2 md:gap-4 px-3 md:px-4 py-3 md:py-4 2xl:py-5 cursor-pointer overflow-hidden min-w-0",
                isDragging
                    ? "bg-surface shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border-accent/30 scale-[1.03] z-50 ring-2 ring-accent/20"
                    : cn(interactiveListCardHover, "hover:-translate-y-0.5"),
                isCompleted && "opacity-60",
                isSelected && cn(interactiveListCardSelected, "-translate-y-0.5")
            )}
            onClick={(e) => {
                if (onSelect) onSelect(task.id, e)
                else openTask()
            }}
        >
            {/* Project Color Side-Bar Indicator */}
            <div
                className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full transition-all duration-300 group-hover:w-2"
                style={{ backgroundColor: task.project?.color || 'transparent' }}
            />

            {/* Drag Handle */}
            {!hideDragHandle && !isCompleted && (
                <div
                    {...dragHandleProps}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "hidden md:block cursor-grab active:cursor-grabbing text-text-muted transition-opacity -ml-1 p-1",
                        isDragging ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-60"
                    )}
                >
                    <GripVertical className="w-4 h-4 2xl:w-5 2xl:h-5" />
                </div>
            )}

            {/* Checkbox Container */}
            <div className="relative shrink-0 flex items-center justify-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleComplete(task.id, !isCompleted)
                    }}
                    className="touch-target relative z-10 flex items-center justify-center rounded-xl text-text-muted hover:text-accent-warm transition-all active:scale-125 hover:scale-110"
                    aria-label={isCompleted ? 'Mark task as not completed' : 'Mark task as completed'}
                >
                    {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 2xl:w-[26px] 2xl:h-[26px] text-accent-warm animate-in zoom-in-50 duration-200" />
                    ) : (
                        <Circle className="w-6 h-6 2xl:w-[26px] 2xl:h-[26px] transition-transform duration-200" />
                    )}
                </button>
                {/* Rings animation could be added here on click */}
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-1 min-w-0">
                    <span className={cn(
                        "text-base md:text-[1.05rem] 2xl:text-[1.15rem] leading-snug font-bold tracking-tight transition-all duration-300 break-words line-clamp-2",
                        isCompleted
                            ? "line-through text-text-muted decoration-text-muted/60"
                            : isSelected ? "text-accent" : "text-text-primary group-hover:text-accent no-underline"
                    )}>
                        {task.title}
                    </span>
                    {task.recurrence && (
                        <RefreshCw className="hidden sm:block w-3.5 h-3.5 text-text-muted shrink-0" />
                    )}
                    {isTimerActiveForTask && (
                        <span className="text-xs 2xl:text-sm uppercase font-black tracking-widest text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-300/20 tabular-nums">
                            {formatElapsed(liveElapsedSeconds)}
                        </span>
                    )}
                    {task.today && !isCompleted && (
                        <span className="text-xs 2xl:text-sm uppercase font-black tracking-widest text-accent-warm bg-accent-warm/10 px-2 py-0.5 rounded-full border border-accent-warm/10">
                            Today
                        </span>
                    )}
                    {isOverdue && (
                        <span className="text-xs 2xl:text-sm uppercase font-black tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/10">
                            Overdue
                        </span>
                    )}
                </div>

                <div className="flex items-center flex-wrap gap-2 overflow-hidden">
                    {/* Project Name (if exists) */}
                    {task.project && (
                        <>
                            <span className="text-sm md:text-xs 2xl:text-sm font-semibold md:font-black normal-case md:uppercase tracking-normal md:tracking-widest text-text-muted truncate max-w-[10rem] sm:max-w-[16rem]">
                                {task.project.name}
                            </span>
                            {task.project.category?.name && (
                                <span className="hidden sm:inline-flex text-xs 2xl:text-sm uppercase tracking-widest font-black text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full">
                                    {task.project.category.name}
                                </span>
                            )}
                        </>
                    )}

                    {/* Status Badges */}
                    {task.status === 'doing' && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] 2xl:text-xs uppercase tracking-widest font-black text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full shrink-0">
                            <RefreshCw className="w-3 h-3 hidden sm:block" /> Doing
                        </span>
                    )}
                    {task.status === 'waiting' && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] 2xl:text-xs uppercase tracking-widest font-black text-orange-500 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full shrink-0">
                            <Clock className="w-3 h-3 hidden sm:block" /> Waiting
                        </span>
                    )}

                    {/* Context Pills */}
                    <div className="hidden sm:contents">
                        {getContextPills()}
                    </div>

                    {/* Due Date */}
                    {task.end_at && (
                        <div className={cn(
                            "hidden sm:flex items-center space-x-1.5 text-xs 2xl:text-sm px-2.5 py-1 rounded-full border shrink-0 font-bold uppercase tracking-wider",
                            dueDateStyle
                        )}>
                            <Clock className="w-3 h-3" />
                            <span>
                                {isToday(new Date(task.end_at)) ? 'Today' : format(new Date(task.end_at), 'MMM d')}
                                {task.end_at.includes('T') && !task.end_at.endsWith('00:00:00') && ` · ${format(new Date(task.end_at), 'p')}`}
                            </span>
                        </div>
                    )}

                    {/* Subtask Progress */}
                    <div className="hidden sm:block">
                        <SubtaskProgress task={task} />
                    </div>
                </div>

                {/* Mobile action row */}
                {!isCompleted && (
                    <div className="md:hidden mt-2 flex items-center gap-1.5">
                        {onFocus && (
                            <button
                                onClick={handleFocus}
                                className="touch-target inline-flex items-center justify-center rounded-lg border border-border/60 bg-surface-secondary/35 text-text-muted hover:text-accent hover:border-accent/35 transition-all"
                                title="Focus Mode"
                                aria-label="Open focus mode"
                            >
                                <Maximize2 className="w-[18px] h-[18px]" />
                            </button>
                        )}
                        <button
                            onClick={handleToggleTimer}
                            disabled={isSyncing}
                            className={cn(
                                "touch-target inline-flex items-center justify-center rounded-lg border transition-all",
                                isTimerActiveForTask
                                    ? "text-emerald-300 bg-emerald-400/10 border-emerald-300/20"
                                    : "text-text-muted bg-surface-secondary/35 border-border/60 hover:text-emerald-300 hover:border-emerald-300/30",
                                isSyncing && "opacity-60 cursor-not-allowed"
                            )}
                            title={timerActionLabel}
                            aria-label={timerAriaLabel}
                        >
                            {isTimerActiveForTask ? (
                                <Pause className="w-[18px] h-[18px]" />
                            ) : (
                                <Play className="w-[18px] h-[18px]" />
                            )}
                        </button>
                        {onSnooze && task.today && (
                            <button
                                onClick={handleSnooze}
                                className="touch-target inline-flex items-center justify-center rounded-lg border border-border/60 bg-surface-secondary/35 text-text-muted hover:text-blue-400 hover:border-blue-400/40 transition-all"
                                title="Snooze to tomorrow"
                                aria-label="Snooze task to tomorrow"
                            >
                                <Moon className="w-[18px] h-[18px]" />
                            </button>
                        )}
                        <button
                            onClick={handleToggleToday}
                            className={cn(
                                "touch-target inline-flex items-center justify-center rounded-lg border transition-all",
                                task.today
                                    ? "text-accent-warm bg-accent-warm/10 border-accent-warm/25"
                                    : "text-text-muted bg-surface-secondary/35 border-border/60 hover:bg-surface-secondary hover:text-accent-warm hover:border-accent-warm/30"
                            )}
                            aria-label={task.today ? "Remove task from Today" : "Add task to Today"}
                        >
                            <Star className={cn("w-[18px] h-[18px]", task.today && "fill-current")} />
                        </button>
                    </div>
                )}
            </div>

            {/* Snooze and Today Star */}
            <div className="hidden md:flex items-center space-x-0.5 md:space-x-1 shrink-0">
                {!isCompleted && onFocus && (
                    <button
                        onClick={handleFocus}
                        className="touch-target flex items-center justify-center text-text-muted transition-all p-2 rounded-xl hover:text-accent hover:bg-surface-secondary md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto"
                        title="Focus Mode"
                        aria-label="Open focus mode"
                    >
                        <Maximize2 className="w-5 h-5 2xl:w-6 2xl:h-6" />
                    </button>
                )}
                {!isCompleted && (
                    <button
                        onClick={handleToggleTimer}
                        disabled={isSyncing}
                        className={cn(
                            "touch-target flex items-center justify-center transition-all p-2 rounded-xl opacity-100",
                            isTimerActiveForTask
                                ? "text-emerald-300 bg-emerald-400/10 border border-emerald-300/20"
                                : "text-text-muted md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto hover:text-emerald-300 hover:bg-surface-secondary",
                            isSyncing && "opacity-60 cursor-not-allowed"
                        )}
                        title={timerActionLabel}
                        aria-label={timerAriaLabel}
                    >
                        {isTimerActiveForTask ? (
                            <Pause className="w-5 h-5 2xl:w-6 2xl:h-6" />
                        ) : (
                            <Play className="w-5 h-5 2xl:w-6 2xl:h-6" />
                        )}
                    </button>
                )}
                {!isCompleted && onSnooze && task.today && (
                    <button
                        onClick={handleSnooze}
                        className="hidden md:flex touch-target items-center justify-center text-text-muted opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto hover:text-blue-400 hover:bg-surface-secondary transition-all p-2 rounded-xl"
                        title="Snooze to tomorrow"
                        aria-label="Snooze task to tomorrow"
                    >
                        <Moon className="w-5 h-5 2xl:w-6 2xl:h-6" />
                    </button>
                )}
                {!isCompleted && (
                    <button
                        onClick={handleToggleToday}
                        className={cn(
                            "touch-target flex items-center justify-center transition-all p-2 rounded-xl opacity-100",
                            task.today ? "text-accent-warm" : "text-text-muted md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto hover:bg-surface-secondary"
                        )}
                        aria-label={task.today ? "Remove task from Today" : "Add task to Today"}
                    >
                        <Star className={cn("w-5 h-5 2xl:w-6 2xl:h-6", task.today && "fill-current")} />
                    </button>
                )}
            </div>
        </div>
    )
})

function SubtaskProgress({ task }: { task: Task }) {
    if (!task.subtasks || task.subtasks.length === 0) return null

    const total = task.subtasks.length
    const completed = task.subtasks.filter(s => s.completed).length
    const percent = Math.round((completed / total) * 100)

    return (
        <div className="flex items-center space-x-2 text-xs 2xl:text-sm text-text-muted font-black uppercase tracking-widest bg-surface-secondary/40 px-2.5 py-1 rounded-full border border-border/20 shrink-0">
            <svg className="w-3 h-3 -rotate-90">
                <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-border"
                />
                <circle
                    cx="6"
                    cy="6"
                    r="5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={31.4}
                    strokeDashoffset={31.4 * (1 - percent / 100)}
                    className="text-accent transition-all duration-500"
                />
            </svg>
            <span className="tabular-nums">{completed}/{total}</span>
        </div>
    )
}

function ContextPill({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-surface-secondary/60 rounded-full border border-border/40 text-xs 2xl:text-sm text-text-muted font-bold tracking-tight shrink-0 uppercase">
            {icon}
            <span>{label}</span>
        </div>
    )
}
