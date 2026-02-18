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

    return (
        <div
            className={cn(
                "group relative flex items-center space-x-4 px-4 py-4 xl:py-5 rounded-2xl border border-transparent transition-all cursor-pointer overflow-hidden",
                isDragging
                    ? "bg-surface shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] border-accent/30 scale-[1.03] z-50 ring-2 ring-accent/20"
                    : "hover:bg-surface hover:border-border/60 hover:shadow-lg hover:-translate-y-0.5",
                isCompleted && "opacity-50"
            )}
            onClick={() => onClickTitle ? onClickTitle(task) : onClick(task)}
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
                        "cursor-grab active:cursor-grabbing text-text-muted transition-opacity -ml-1 p-1",
                        isDragging ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-60"
                    )}
                >
                    <GripVertical className="w-4 h-4 xl:w-5 xl:h-5" />
                </div>
            )}

            {/* Checkbox Container */}
            <div className="relative shrink-0 flex items-center justify-center">
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onToggleComplete(task.id, !isCompleted)
                    }}
                    className="relative z-10 text-text-muted hover:text-accent transition-all active:scale-125 hover:scale-110"
                >
                    {isCompleted ? (
                        <CheckCircle2 className="w-6 h-6 xl:w-[26px] xl:h-[26px] text-accent animate-in zoom-in-50 duration-200" />
                    ) : (
                        <Circle className="w-6 h-6 xl:w-[26px] xl:h-[26px] transition-transform duration-200" />
                    )}
                </button>
                {/* Rings animation could be added here on click */}
            </div>

            {/* Title & Metadata */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex items-center space-x-2 mb-1">
                    <span className={cn(
                        "text-[15px] xl:text-[17px] font-heavy tracking-tight transition-all duration-300",
                        isCompleted
                            ? "line-through text-text-muted decoration-text-muted/60"
                            : "text-text-primary no-underline"
                    )}>
                        {task.title}
                    </span>
                    {task.recurrence && (
                        <RefreshCw className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    )}
                    {task.today && !isCompleted && (
                        <span className="text-[10px] xl:text-[11px] uppercase font-black tracking-widest text-accent-warm bg-accent-warm/10 px-2 py-0.5 rounded-full border border-accent-warm/10">
                            Today
                        </span>
                    )}
                    {isOverdue && (
                        <span className="text-[10px] xl:text-[11px] uppercase font-black tracking-widest text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/10">
                            Overdue
                        </span>
                    )}
                </div>

                <div className="flex items-center flex-wrap gap-2 overflow-hidden">
                    {/* Project Name (if exists) */}
                    {task.project && (
                        <span className="text-[10px] xl:text-[11px] font-black uppercase tracking-widest text-text-muted/80">
                            {task.project.name}
                        </span>
                    )}

                    {/* Context Pills */}
                    {getContextPills()}

                    {/* Due Date */}
                    {task.end_at && (
                        <div className={cn(
                            "flex items-center space-x-1.5 text-[10px] xl:text-[11px] px-2.5 py-1 rounded-full border shrink-0 font-bold uppercase tracking-wider",
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
                        "shrink-0 transition-all p-2 rounded-xl",
                        task.today ? "text-accent-warm" : "text-text-muted opacity-0 group-hover:opacity-100 hover:bg-surface-secondary"
                    )}
                >
                    <Star className={cn("w-5 h-5 xl:w-6 xl:h-6", task.today && "fill-current")} />
                </button>
            )}
        </div>
    )
})

function SubtaskProgress({ taskId }: { taskId: string }) {
    const [stats, setStats] = React.useState<SubtaskStats | null>(null)

    React.useEffect(() => {
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
        <div className="flex items-center space-x-2 text-[10px] xl:text-[11px] text-text-muted font-black uppercase tracking-widest bg-surface-secondary/40 px-2.5 py-1 rounded-full border border-border/20 shrink-0">
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
            <span className="tabular-nums">{stats.completed}/{stats.total}</span>
        </div>
    )
}

function ContextPill({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-surface-secondary/60 rounded-full border border-border/40 text-[10px] xl:text-[11px] text-text-muted font-bold tracking-tight shrink-0 uppercase">
            {icon}
            <span>{label}</span>
        </div>
    )
}
