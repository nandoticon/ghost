import { useMemo, useState } from 'react'
import { Plus, ChevronDown, ChevronRight, LayoutList } from 'lucide-react'
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

export default function Today() {
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
        } catch (error) {
            showToast('Failed to create task', 'error')
        }
    }

    const clearCompleted = async () => {
        const updates = completedTasks.map(t => updateTask(t.id, { today: false }))
        await Promise.all(updates)
        setShowClearConfirm(false)
    }

    return (
        <div className="mx-auto px-4 py-8 md:py-12 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <header className="flex items-start justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight text-text-primary">
                        Today
                    </h1>
                    <p className="text-sm md:text-base xl:text-lg text-text-muted font-medium">
                        {format(new Date(), 'EEEE, MMMM do')}
                    </p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="hidden md:flex items-center space-x-2 px-5 py-2.5 xl:px-6 xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-sm xl:text-base font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                >
                    <Plus className="w-4 h-4 xl:w-5 xl:h-5" />
                    <span>Add Task</span>
                </button>
            </header>

            {/* Progress — always shown */}
            <div className="space-y-2">
                <div className="flex items-center justify-between text-xs xl:text-sm uppercase font-bold tracking-widest text-text-muted">
                    <span>Progress</span>
                    <span>{completedCount} of {totalCount} done</span>
                </div>
                <div className="h-2 xl:h-2.5 w-full bg-surface-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-accent transition-all duration-1000 ease-out rounded-full"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Task Sections */}
            <div className="space-y-12">
                {/* Remaining */}
                <div className="space-y-4">
                    {loading && tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm xl:text-base text-text-muted">Gathering your tasks...</p>
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
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1">
                                        {remainingTasks.map((task, index) => (
                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps}>
                                                        <TaskItem
                                                            task={task}
                                                            onToggleComplete={async (id, completed) => {
                                                                const res = await completeTask(id, completed)
                                                                if (res.success && res.nextOccurrenceCreated) {
                                                                    showToast(`Task completed · Next on ${res.nextOccurrenceDate ? format(new Date(res.nextOccurrenceDate), 'MMM d') : 'the future'}`, 'success')
                                                                }
                                                            }}
                                                            onToggleToday={(id, today) => updateTask(id, { today })}
                                                            onClick={() => { }}
                                                            onClickTitle={(t) => setActiveTaskId(t.id)}
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
                            className="group w-full flex items-center space-x-3 px-10 py-3 xl:py-4 text-text-muted hover:text-accent transition-all"
                        >
                            <Plus className="w-4 h-4 xl:w-5 xl:h-5" />
                            <span className="text-sm xl:text-base font-medium">Add task</span>
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
                                {isCompletedExpanded ? <ChevronDown className="w-4 h-4 xl:w-5 xl:h-5" /> : <ChevronRight className="w-4 h-4 xl:w-5 xl:h-5" />}
                                <span className="text-xs xl:text-sm font-bold uppercase tracking-widest">
                                    Completed · {completedCount}
                                </span>
                            </button>

                            {isCompletedExpanded && (
                                <button
                                    onClick={() => setShowClearConfirm(true)}
                                    className="text-xs xl:text-sm uppercase font-bold tracking-widest text-text-muted hover:text-red-400 transition-colors"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {isCompletedExpanded && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                                {completedTasks.map((task) => (
                                    <TaskItem
                                        key={task.id}
                                        task={task}
                                        onToggleComplete={async (id, completed) => {
                                            const res = await completeTask(id, completed)
                                            if (res.success && res.nextOccurrenceCreated) {
                                                showToast(`Task completed · Next on ${res.nextOccurrenceDate ? format(new Date(res.nextOccurrenceDate), 'MMM d') : 'the future'}`, 'success')
                                            }
                                        }}
                                        onToggleToday={(id, today) => updateTask(id, { today })}
                                        onClick={() => { }}
                                        onClickTitle={(t) => setActiveTaskId(t.id)}
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
