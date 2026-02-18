import React from 'react'
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
    RefreshCw
} from 'lucide-react'
import { Task } from '../types'
import { cn } from '../lib/cn'
import { format, isToday, isPast, startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'

interface SubtaskStats {
    total: number
    completed: number
}

interface TaskItemProps {
    task: Task
    onToggleComplete: (id: string, completed: boolean) => void
    onToggleToday: (id: string, today: boolean) => void
    onClick: (task: Task) => void
    onClickTitle?: (task: Task) => void
    dragHandleProps?: DraggableProvidedDragHandleProps | null
    isDragging?: boolean
    hideDragHandle?: boolean
}

export const TaskItem = React.memo<TaskItemProps>(({
    task,
    onToggleComplete,
    onToggleToday,
    onClick,
    onClickTitle,
    dragHandleProps,
    isDragging,
    hideDragHandle = false
}) => {
    const isCompleted = task.completed

    const getContextPills = () => {
        const pills = []

        if (task.location === 'home') pills.push(<ContextPill key="loc" icon={<Home className="w-2.5 h-2.5" />} label="Home" />)
        if (task.location === 'outside') pills.push(<ContextPill key="loc" icon={<MapPin className="w-2.5 h-2.5" />} label="Outside" />)

        if (task.energy === 'high') pills.push(<ContextPill key="en" icon={<Zap className="w-2.5 h-2.5 text-yellow-400" />} label="High" />)
        if (task.energy === 'low') pills.push(<ContextPill key="en" icon={<ZapOff className="w-2.5 h-2.5 text-blue-400" />} label="Low" />)

        if (task.focus === 'immersion') pills.push(<ContextPill key="fo" icon={<Target className="w-2.5 h-2.5 text-purple-400" />} label="Immersion" />)
        if (task.focus === 'process') pills.push(<ContextPill key="fo" icon={<Layers className="w-2.5 h-2.5 text-green-400" />} label="Process" />)

        return pills
    }

    const getDueDateStyle = () => {
        if (!task.end_at || isCompleted) return null
        const dueDate = new Date(task.end_at)

        if (isToday(dueDate)) {
            return "text-orange-400 bg-orange-400/10 border-orange-400/20"
        }

        if (isPast(dueDate) && startOfDay(dueDate) < startOfDay(new Date())) {
            return "text-red-400 bg-red-400/10 border-red-400/20 font-bold"
        }

        return "text-text-muted bg-surface/50 border-border/30"
    }

    const dueDateStyle = getDueDateStyle()
    const isOverdue = !isCompleted && task.end_at && isPast(new Date(task.end_at)) && !isToday(new Date(task.end_at))

    return (
        <div
            className={cn(
                "group flex items-center space-x-3 px-4 py-3.5 xl:py-5 rounded-lg border border-transparent transition-all cursor-pointer",
                isDragging
                    ? "bg-surface/80 border-accent/30 shadow-2xl ring-1 ring-accent/30 scale-[1.02] z-50"
                    : "hover:bg-surface/50 hover:border-border/50",
                isCompleted && "opacity-60"
            )}
            onClick={() => onClickTitle ? onClickTitle(task) : onClick(task)}
        >
            {/* Drag Handle */}
            {!hideDragHandle && !isCompleted && (
                <div
                    {...dragHandleProps}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                        "cursor-grab active:cursor-grabbing text-text-muted transition-opacity -ml-2 p-1",
                        isDragging ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-40"
                    )}
                >
                    <GripVertical className="w-4 h-4" />
                </div>
            )}

            {/* Checkbox */}
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    onToggleComplete(task.id, !isCompleted)
                }}
                className="text-text-muted hover:text-accent transition-all shrink-0 active:scale-125 hover:scale-110"
            >
                {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-accent transition-transform duration-200" />
                ) : (
                    <Circle className="w-5 h-5 transition-transform duration-200" />
                )}
            </button>

            {/* Title & Extra Info */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center space-x-2">
                    <span className={cn(
                        "text-sm xl:text-base font-medium truncate transition-all duration-300",
                        isCompleted
                            ? "line-through text-text-muted decoration-text-muted/60"
                            : "no-underline"
                    )}>
                        {task.title}
                    </span>
                    {task.recurrence && (
                        <RefreshCw className="w-3 h-3 text-text-muted shrink-0" />
                    )}
                    {task.today && !isCompleted && (
                        <span className="text-[11px] xl:text-xs uppercase font-bold tracking-widest text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded">
                            Today
                        </span>
                    )}
                    {isOverdue && (
                        <span className="text-[11px] xl:text-xs uppercase font-bold tracking-widest text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded">
                            Overdue
                        </span>
                    )}
                    {task.parent_task_id && (
                        <span className="text-[11px] xl:text-xs uppercase font-bold tracking-widest text-accent bg-accent/10 px-1.5 py-0.5 rounded flex items-center space-x-1">
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Recurring</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center flex-wrap gap-1.5 overflow-hidden">
                    {/* Project Dot */}
                    {task.project && (
                        <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: task.project.color || '#7c6aff' }}
                            title={task.project.name}
                        />
                    )}

                    {/* Context Pills */}
                    {getContextPills()}

                    {/* Dates */}
                    {task.end_at && (
                        <div className={cn(
                            "flex items-center space-x-1 text-[10px] xl:text-xs px-2 py-0.5 rounded border shrink-0",
                            dueDateStyle
                        )}>
                            <Clock className="w-2.5 h-2.5" />
                            <span>
                                {isToday(new Date(task.end_at)) ? 'Today' : format(new Date(task.end_at), 'MMM d')}
                                {task.end_at.includes('T') && !task.end_at.endsWith('00:00:00') && ` · ${format(new Date(task.end_at), 'p')}`}
                            </span>
                        </div>
                    )}

                    {/* Subtask Progress */}
                    <SubtaskProgress taskId={task.id} />
                </div>
            </div>

            {/* Today Star */}
            {!isCompleted && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleToday(task.id, !task.today)
                    }}
                    className={cn(
                        "shrink-0 transition-all p-1.5 rounded-full",
                        task.today ? "text-yellow-400 opacity-100" : "text-text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-secondary"
                    )}
                >
                    <Star className={cn("w-4 h-4", task.today && "fill-current")} />
                </button>
            )}
        </div>
    )
})

function SubtaskProgress({ taskId }: { taskId: string }) {
    const [stats, setStats] = React.useState<SubtaskStats | null>(null)

    React.useEffect(() => {
        // Skip for temporary (optimistic) tasks
        if (taskId.startsWith('temp-')) return

        const fetchStats = async () => {
            const { data, error } = await supabase
                .from('subtasks')
                .select('completed')
                .eq('task_id', taskId)

            if (!error && data) {
                setStats({
                    total: data.length,
                    completed: data.filter(s => s.completed).length
                })
            }
        }

        fetchStats()

        const channel = supabase
            .channel(`subtask_stats:${taskId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'subtasks', filter: `task_id=eq.${taskId}` },
                fetchStats
            )
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [taskId])

    if (!stats || stats.total === 0) return null

    const percent = Math.round((stats.completed / stats.total) * 100)

    return (
        <div className="flex items-center space-x-2 text-[10px] text-text-muted bg-surface/30 px-2 py-0.5 rounded border border-border/20 shrink-0">
            {/* Progress Circle SVG */}
            <svg className="w-2.5 h-2.5 -rotate-90">
                <circle
                    cx="5"
                    cy="5"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-border"
                />
                <circle
                    cx="5"
                    cy="5"
                    r="4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeDasharray={25.12}
                    strokeDashoffset={25.12 * (1 - percent / 100)}
                    className="text-accent transition-all duration-500"
                />
            </svg>
            <span className="font-bold tabular-nums">{stats.completed}/{stats.total}</span>
        </div>
    )
}

function ContextPill({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex items-center space-x-1 px-2 py-0.5 bg-surface-secondary/50 rounded border border-border/30 text-[9px] xl:text-[11px] text-text-muted font-medium shrink-0">
            {icon}
            <span>{label}</span>
        </div>
    )
}
