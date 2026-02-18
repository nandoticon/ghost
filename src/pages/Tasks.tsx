import { useState, useEffect, useMemo } from 'react'
import { Plus, Filter, LayoutList, AlertCircle, ChevronDown, Home, MapPin, Zap, ZapOff, Target, Layers } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Task, TaskFilters } from '../types'
import { cn } from '../lib/cn'
import { useShortcutContext } from '../context/ShortcutContext'

const STORAGE_KEY = 'ghost_tasks_filters'

const DEFAULT_FILTERS: TaskFilters = {
    status: 'all',
    location: null,
    energy: null,
    focus: null,
    projectId: null,
    dateFilter: 'any'
}

export default function Tasks() {
    const [filters, setFilters] = useState<TaskFilters>(() => {
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : DEFAULT_FILTERS
    })

    const { projects } = useProjects()
    const { tasks, loading, createTask, updateTask, completeTask, reorderTasks } = useTasks(filters)
    const { showToast } = useToast()
    const { setActiveTaskId } = useShortcutContext()

    const [isFormOpen, setIsFormOpen] = useState(false)

    // Persist filters
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    }, [filters])

    const hasActiveFilters = useMemo(() => {
        return filters.status !== 'all' ||
            filters.location !== null ||
            filters.energy !== null ||
            filters.focus !== null ||
            filters.projectId !== null ||
            filters.dateFilter !== 'any'
    }, [filters])

    const isReorderingEnabled = !hasActiveFilters

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !isReorderingEnabled) return

        const items = Array.from(tasks)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        reorderTasks(items.map(i => i.id))
    }

    const handleSave = async (taskData: Partial<Task>) => {
        try {
            await createTask(taskData)
            showToast('Task added successfully', 'success')
            setIsFormOpen(false)
        } catch (error) {
            showToast('Failed to add task', 'error')
        }
    }

    const clearFilters = () => setFilters(DEFAULT_FILTERS)

    const updateFilter = (updates: Partial<TaskFilters>) => {
        setFilters(prev => ({ ...prev, ...updates }))
    }

    // Group by project logic for sticky headers
    const groupedTasks = useMemo(() => {
        if (filters.projectId) {
            const project = projects.find(p => p.id === filters.projectId)
            return [{
                id: filters.projectId,
                name: project?.name || 'Selected Project',
                color: project?.color,
                tasks: tasks
            }]
        }
        return [{ id: 'all', name: null, tasks }]
    }, [tasks, filters.projectId, projects])

    return (
        <div className="mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight text-text-primary">Tasks</h1>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center space-x-2 px-5 py-2.5 xl:px-6 xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-sm xl:text-base font-bold transition-all active:scale-95"
                >
                    <Plus className="w-4 h-4 xl:w-5 xl:h-5" />
                    <span>Add Task</span>
                </button>
            </header>

            {/* Filter Bar */}
            <div className="space-y-4">
                <div className="flex items-center justify-between text-xs xl:text-sm uppercase font-bold tracking-widest text-text-muted">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-3 h-3 xl:w-4 xl:h-4" />
                        <span>Filters</span>
                    </div>
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="text-accent hover:underline lowercase tracking-normal font-medium"
                        >
                            Clear filters
                        </button>
                    )}
                </div>

                {/* All filter groups in a single wrapping row — no horizontal scroll */}
                <div className="flex flex-wrap items-center gap-2 xl:gap-3">
                    {/* Status */}
                    <FilterGroup
                        options={['all', 'active', 'completed']}
                        value={filters.status ?? 'all'}
                        onChange={(val) => updateFilter({ status: val as TaskFilters['status'] })}
                    />

                    {/* Date */}
                    <FilterGroup
                        options={['any', 'has_date', 'overdue']}
                        value={filters.dateFilter ?? 'any'}
                        onChange={(val) => updateFilter({ dateFilter: val as TaskFilters['dateFilter'] })}
                    />

                    {/* Project Selector */}
                    <div className="relative group/select">
                        <select
                            value={filters.projectId || ''}
                            onChange={(e) => updateFilter({ projectId: e.target.value || null })}
                            className={cn(
                                "pl-3 pr-8 py-1.5 xl:py-2 rounded-full text-xs xl:text-sm font-bold uppercase tracking-wider border border-border bg-surface transition-all appearance-none cursor-pointer",
                                filters.projectId ? "bg-accent/10 border-accent/50 text-accent" : "text-text-muted hover:border-text-muted hover:text-text-primary"
                            )}
                        >
                            <option value="">Project: Any</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none group-hover/select:text-text-primary transition-colors" />
                    </div>

                    {/* Location */}
                    <FilterGroup
                        options={[null, 'home', 'outside']}
                        value={filters.location ?? null}
                        onChange={(val) => updateFilter({ location: val as TaskFilters['location'] })}
                        icons={{ home: <Home className="w-3 h-3 xl:w-3.5 xl:h-3.5" />, outside: <MapPin className="w-3 h-3 xl:w-3.5 xl:h-3.5" /> }}
                    />

                    {/* Energy */}
                    <FilterGroup
                        options={[null, 'high', 'low']}
                        value={filters.energy ?? null}
                        onChange={(val) => updateFilter({ energy: val as TaskFilters['energy'] })}
                        icons={{ high: <Zap className="w-3 h-3 xl:w-3.5 xl:h-3.5" />, low: <ZapOff className="w-3 h-3 xl:w-3.5 xl:h-3.5" /> }}
                    />

                    {/* Focus */}
                    <FilterGroup
                        options={[null, 'immersion', 'process']}
                        value={filters.focus ?? null}
                        onChange={(val) => updateFilter({ focus: val as TaskFilters['focus'] })}
                        icons={{ immersion: <Target className="w-3 h-3 xl:w-3.5 xl:h-3.5" />, process: <Layers className="w-3 h-3 xl:w-3.5 xl:h-3.5" /> }}
                    />
                </div>

                <div className="text-xs xl:text-sm text-text-muted uppercase font-bold tracking-widest flex items-center justify-between">
                    <span>Showing {tasks.length} tasks</span>
                    {!isReorderingEnabled && (
                        <span className="text-yellow-500/80 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 xl:w-4 xl:h-4" />
                            Clear filters to reorder
                        </span>
                    )}
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-8">
                {loading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-4">
                        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm xl:text-base text-text-muted font-medium">Loading tasks...</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <EmptyState
                        icon={LayoutList}
                        title={hasActiveFilters ? "No matching tasks" : "No tasks yet"}
                        description={hasActiveFilters ? "Try adjusting your filters to find what you're looking for." : "Be the master of your own destiny. Add a task to start."}
                    />
                ) : (
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="tasks-master-list" isDropDisabled={!isReorderingEnabled}>
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-10">
                                    {groupedTasks.map((group) => (
                                        <div key={group.id} className="space-y-4">
                                            {group.name && (
                                                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur py-2 flex items-center space-x-2 border-b border-border/50">
                                                    {group.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />}
                                                    <h3 className="text-sm xl:text-base font-bold tracking-tight text-text-primary">{group.name}</h3>
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                {group.tasks.map((task, index) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!isReorderingEnabled}>
                                                        {(provided, snapshot) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                <TaskItem
                                                                    task={task}
                                                                    onToggleComplete={async (id, completed) => {
                                                                        const res = await completeTask(id, completed)
                                                                        if (res.success && res.nextOccurrenceCreated) {
                                                                            const dateStr = res.nextOccurrenceDate ? new Date(res.nextOccurrenceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'the future'
                                                                            showToast(`Task completed · Next on ${dateStr}`, 'success')
                                                                        }
                                                                    }}
                                                                    onToggleToday={(id, today) => updateTask(id, { today })}
                                                                    onClick={() => { }}
                                                                    onClickTitle={(t) => setActiveTaskId(t.id)}
                                                                    dragHandleProps={isReorderingEnabled ? provided.dragHandleProps : undefined}
                                                                    isDragging={snapshot.isDragging}
                                                                    hideDragHandle={!isReorderingEnabled}
                                                                />
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                )}
            </div>

            {/* Form Modal (Create only) */}
            <TaskForm
                isOpen={isFormOpen}
                onSave={handleSave}
                onCancel={() => setIsFormOpen(false)}
            />
        </div>
    )
}

function FilterGroup<T extends string | null>({ options, value, onChange, icons }: {
    options: T[],
    value: T,
    onChange: (val: T) => void,
    icons?: Record<string, React.ReactNode>
}) {
    return (
        <div className="flex items-center bg-surface border border-border rounded-full p-0.5 flex-shrink-0">
            {options.map((opt) => (
                <button
                    key={String(opt)}
                    onClick={() => onChange(opt)}
                    className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 xl:px-4 xl:py-2 rounded-full text-[10px] xl:text-xs font-bold uppercase tracking-wider transition-all",
                        value === opt ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary"
                    )}
                >
                    {opt && icons?.[opt] && <span>{icons[opt]}</span>}
                    <span className={cn(opt && icons?.[opt] && "hidden md:inline")}>
                        {opt === null || opt === 'all' || opt === 'any' ? 'Any' : opt}
                    </span>
                </button>
            ))}
        </div>
    )
}
