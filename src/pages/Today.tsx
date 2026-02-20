import { useMemo, useState, useCallback } from 'react'
import { Plus, ChevronDown, ChevronRight, LayoutList, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useTasks } from '../hooks/useTasks'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import { Task } from '../types'
import { useShortcutContext } from '../context/ShortcutContext'
import { useAuth } from '../hooks/useAuth'

export default function Today() {
    const { user } = useAuth()
    const filters = useMemo(() => ({ today: true }), [])
    const { tasks, loading, createTask, updateTask, completeTask, reorderTasks } = useTasks(filters)
    const { showToast } = useToast()
    const { setActiveTaskId } = useShortcutContext()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isCompletedExpanded, setIsCompletedExpanded] = useState(false)
    const [showClearConfirm, setShowClearConfirm] = useState(false)

    // Split tasks
    const remainingTasks = useMemo(() => tasks.filter(t => !t.completed), [tasks])
    const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks])

    const totalCount = tasks.length
    const completedCount = completedTasks.length
    const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0
    const displayName = useMemo(() => {
        const raw = user?.email?.split('@')[0] ?? 'there'
        const firstToken = raw.split(/[._-]/)[0] || 'there'
        return firstToken.charAt(0).toUpperCase() + firstToken.slice(1)
    }, [user?.email])
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
        if (res.success && res.nextOccurrenceCreated) {
            showToast(`Task completed · Next on ${res.nextOccurrenceDate ? format(new Date(res.nextOccurrenceDate), 'MMM d') : 'the future'}`, 'success')
        }
    }, [completeTask, showToast])

    const handleToggleToday = useCallback((id: string, today: boolean) => {
        updateTask(id, { today })
    }, [updateTask])

    const handleTaskClick = useCallback(() => { }, [])

    const handleTitleClick = useCallback((t: Task) => setActiveTaskId(t.id, t.short_id), [setActiveTaskId])

    return (
        <div className="w-full max-w-full mx-auto px-4 py-8 md:py-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">
                        Today
                    </h1>
                    <p className="text-xs md:text-sm uppercase tracking-widest font-black text-accent-warm/90">{greeting}</p>
                    <p className="text-sm md:text-base 2xl:text-lg text-text-muted font-medium">
                        {format(new Date(), 'EEEE, MMMM do')}
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="hidden md:flex items-center space-x-2 px-5 py-2.5 2xl:px-6 2xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-sm 2xl:text-base font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                >
                    <Plus className="w-4 h-4 2xl:w-5 2xl:h-5" />
                    <span>Add Task</span>
                </button>
            </header>

            {/* Progress — always shown */}
            <div className="space-y-3 bg-surface-secondary/25 border border-border/40 rounded-2xl p-4 md:p-5">
                <div className="flex items-center justify-between text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted">
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
                    <span className={progress === 100 ? 'text-accent-warm font-black' : ''}>
                        {Math.round(progress)}% · {completedCount} of {totalCount}
                    </span>
                </div>
                <p className={progress === 100 ? "text-xs md:text-sm text-accent-warm font-semibold" : "text-xs md:text-sm text-text-muted"}>
                    {progress === 100 ? 'Everything scheduled for today is complete.' : `${remainingTasks.length} task${remainingTasks.length !== 1 ? 's' : ''} left to finish.`}
                </p>
                <div className="relative h-3 2xl:h-3.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{
                            width: `${progress}%`,
                            background: progress === 100
                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                : 'linear-gradient(90deg, var(--color-accent), #a78bfa)'
                        }}
                    />
                    {/* Shimmer overlay */}
                    {progress > 0 && progress < 100 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                    )}
                </div>
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
                                <span className="text-xs 2xl:text-sm font-bold uppercase tracking-widest">
                                    Completed · {completedCount}
                                </span>
                            </button>

                            {isCompletedExpanded && (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted hover:text-red-400 transition-colors"
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

            {/* Mobile FAB */}
            <button
                onClick={() => setIsFormOpen(true)}
                className="md:hidden fixed bottom-24 right-6 w-14 h-14 bg-accent text-white rounded-full flex items-center justify-center shadow-2xl shadow-accent/40 active:scale-95 transition-all z-40"
            >
                <Plus className="w-6 h-6" />
            </button>

            {/* Form Modal (Create only) */}
            <TaskForm
                isOpen={isFormOpen}
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
        </div>
    )
}
