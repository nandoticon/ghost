import { useState, useEffect, useMemo, useCallback } from 'react'
import { Plus, Filter, LayoutList, LayoutDashboard, AlertCircle, ChevronDown, Home, MapPin, Zap, ZapOff, Target, Layers, ChevronsUpDown, RotateCcw, Trash2, Star, CheckCircle2, X } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { KanbanBoard } from '../components/KanbanBoard'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Task, TaskFilters } from '../types'
import { cn } from '../lib/cn'
import { useShortcutContext } from '../context/ShortcutContext'
import { useGlobalTasks } from '../context/TaskContext'

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
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
    const { batchUpdateTasks, batchDeleteTasks } = useGlobalTasks()

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
    const activeFilterCount = useMemo(() => {
        return [
            filters.status !== 'all',
            filters.dateFilter !== 'any',
            filters.projectId !== null,
            filters.location !== null,
            filters.energy !== null,
            filters.focus !== null
        ].filter(Boolean).length
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
        } catch (_error) {
            showToast('Failed to add task', 'error')
        }
    }

    const clearFilters = () => setFilters(DEFAULT_FILTERS)

    const updateFilter = (updates: Partial<TaskFilters>) => {
        setFilters((prev: TaskFilters) => ({ ...prev, ...updates }))
    }

    const handleToggleComplete = useCallback(async (id: string, completed: boolean) => {
        const res = await completeTask(id, completed)
        if (res.success && res.nextOccurrenceCreated) {
            const dateStr = res.nextOccurrenceDate ? new Date(res.nextOccurrenceDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'the future'
            showToast(`Task completed · Next on ${dateStr}`, 'success')
        }
    }, [completeTask, showToast])

    const handleToggleToday = useCallback((id: string, today: boolean) => {
        updateTask(id, { today })
    }, [updateTask])

    const handleTaskSelect = useCallback((taskId: string, event: React.MouseEvent) => {
        const isSelected = selectedIds.has(taskId)

        if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            const next = new Set(selectedIds)
            if (isSelected) next.delete(taskId)
            else next.add(taskId)
            setSelectedIds(next)
            setLastSelectedId(taskId)
        } else if (event.shiftKey && lastSelectedId) {
            // Range selection
            const currentIdx = tasks.findIndex(t => t.id === taskId)
            const lastIdx = tasks.findIndex(t => t.id === lastSelectedId)

            if (currentIdx !== -1 && lastIdx !== -1) {
                const start = Math.min(currentIdx, lastIdx)
                const end = Math.max(currentIdx, lastIdx)
                const rangeIds = tasks.slice(start, end + 1).map(t => t.id)
                setSelectedIds(new Set([...Array.from(selectedIds), ...rangeIds]))
            }
        } else {
            // Normal click: Open sidebar immediately and clear selection
            const task = tasks.find(t => t.id === taskId)
            if (task) {
                setActiveTaskId(task.id, task.short_id)
                setSelectedIds(new Set())
                setLastSelectedId(taskId)
            }
        }
    }, [selectedIds, lastSelectedId, tasks, setActiveTaskId])

    const handleTitleClick = useCallback((t: Task) => setActiveTaskId(t.id, t.short_id), [setActiveTaskId])

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
        <div className="w-full max-w-full mx-auto px-4 pt-4 pb-12 space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">Tasks</h1>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-surface-secondary/50 p-1 rounded-full border border-border/50">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2 rounded-full transition-all",
                                viewMode === 'list' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary hover:bg-surface"
                            )}
                            title="List View"
                        >
                            <LayoutList className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={cn(
                                "p-2 rounded-full transition-all",
                                viewMode === 'kanban' ? "bg-accent text-white shadow-sm" : "text-text-muted hover:text-text-primary hover:bg-surface"
                            )}
                            title="Kanban Board"
                        >
                            <LayoutDashboard className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        </button>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center space-x-2 px-5 py-2.5 2xl:px-6 2xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-sm 2xl:text-base font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        <span className="hidden sm:inline">Add Task</span>
                    </button>
                </div>
            </header>

            {/* Filter Bar */}
            <div className="space-y-3 bg-surface-secondary/25 border border-border/40 rounded-2xl p-4">
                <div className="flex items-center justify-between text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-3 h-3 2xl:w-4 2xl:h-4" />
                        <span>Filters</span>
                        {activeFilterCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs tracking-normal font-black bg-accent-warm/10 text-accent-warm border border-accent-warm/20">
                                {activeFilterCount} active
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-accent hover:underline lowercase tracking-normal font-medium"
                            >
                                Clear filters
                            </button>
                        )}
                        <button
                            onClick={() => setIsFiltersExpanded((v: boolean) => !v)}
                            className="inline-flex items-center gap-1 text-text-muted hover:text-text-primary transition-colors lowercase tracking-normal font-medium"
                        >
                            <ChevronsUpDown className="w-3.5 h-3.5" />
                            {isFiltersExpanded ? 'collapse' : 'expand'}
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar pb-1">
                    <div className="min-w-[290px]">
                        <FilterGroup
                            options={['all', 'todo', 'doing', 'waiting', 'done']}
                            value={filters.status ?? 'all'}
                            onChange={(val) => updateFilter({ status: val as TaskFilters['status'] })}
                        />
                    </div>

                    <div className="min-w-[250px]">
                        <FilterGroup
                            options={['any', 'today', 'upcoming', 'overdue']}
                            value={filters.dateFilter ?? 'any'}
                            onChange={(val) => updateFilter({ dateFilter: val as TaskFilters['dateFilter'] })}
                        />
                    </div>

                    <div className="relative group/select min-w-[170px] w-[170px]">
                        <select
                            value={filters.projectId || ''}
                            onChange={(e) => updateFilter({ projectId: e.target.value || null })}
                            className={cn(
                                "w-full pl-3 pr-8 py-2 rounded-xl text-xs 2xl:text-sm font-bold uppercase tracking-wider border border-border bg-surface transition-all appearance-none cursor-pointer",
                                filters.projectId ? "bg-accent/10 border-accent/50 text-accent" : "text-text-muted hover:border-text-muted hover:text-text-primary"
                            )}
                        >
                            <option value="">Any project</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none group-hover/select:text-text-primary transition-colors" />
                    </div>

                    <button
                        onClick={() => setIsFiltersExpanded((v: boolean) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-xs font-black uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors"
                    >
                        {isFiltersExpanded ? 'Simple' : 'Advanced'}
                    </button>
                </div>

                {isFiltersExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 2xl:gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <FilterSection label="Location">
                            <FilterGroup
                                options={[null, 'home', 'outside']}
                                value={filters.location ?? null}
                                onChange={(val) => updateFilter({ location: val as TaskFilters['location'] })}
                                icons={{ home: <Home className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />, outside: <MapPin className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" /> }}
                            />
                        </FilterSection>

                        <FilterSection label="Energy">
                            <FilterGroup
                                options={[null, 'high', 'low']}
                                value={filters.energy ?? null}
                                onChange={(val) => updateFilter({ energy: val as TaskFilters['energy'] })}
                                icons={{ high: <Zap className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />, low: <ZapOff className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" /> }}
                            />
                        </FilterSection>

                        <FilterSection label="Focus">
                            <FilterGroup
                                options={[null, 'immersion', 'process']}
                                value={filters.focus ?? null}
                                onChange={(val) => updateFilter({ focus: val as TaskFilters['focus'] })}
                                icons={{ immersion: <Target className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" />, process: <Layers className="w-3 h-3 2xl:w-3.5 2xl:h-3.5" /> }}
                            />
                        </FilterSection>
                    </div>
                )}

                <div className="text-xs 2xl:text-sm text-text-muted uppercase font-bold tracking-widest flex items-center justify-between">
                    <span>Showing {tasks.length} tasks</span>
                    {!isReorderingEnabled && (
                        <span className="text-yellow-500/80 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 2xl:w-4 2xl:h-4" />
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
                        <p className="text-sm 2xl:text-base text-text-muted font-medium">Loading tasks...</p>
                    </div>
                ) : tasks.length === 0 ? (
                    <EmptyState
                        icon={LayoutList}
                        title={hasActiveFilters ? "No matching tasks" : "No tasks yet"}
                        description={hasActiveFilters ? "Try adjusting your filters to find what you're looking for." : "Be the master of your own destiny. Add a task to start."}
                    />
                ) : viewMode === 'kanban' ? (
                    <KanbanBoard
                        tasks={tasks}
                        onUpdateTask={updateTask}
                        onTaskClick={(id) => {
                        const task = tasks.find(t => t.id === id)
                        if (task) setActiveTaskId(task.id, task.short_id)
                    }}
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
                                                    <h3 className="text-sm 2xl:text-base font-bold tracking-tight text-text-primary">{group.name}</h3>
                                                </div>
                                            )}
                                            <div className="space-y-2">
                                                {group.tasks.map((task, index) => (
                                                    <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={!isReorderingEnabled}>
                                                        {(provided, snapshot) => (
                                                            <div ref={provided.innerRef} {...provided.draggableProps}>
                                                                <TaskItem
                                                                    task={task}
                                                                    onToggleComplete={handleToggleComplete}
                                                                    onToggleToday={handleToggleToday}
                                                                    onClick={() => { }}
                                                                    onSelect={handleTaskSelect}
                                                                    isSelected={selectedIds.has(task.id)}
                                                                    onClickTitle={handleTitleClick}
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

            {/* Batch Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 duration-300">
                    <div className="bg-surface/95 backdrop-blur-md border border-border shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl px-4 py-3 flex items-center space-x-6 ring-1 ring-white/10">
                        <div className="flex items-center space-x-3 pr-4 border-r border-border">
                            <button
                                onClick={() => setSelectedIds(new Set())}
                                className="p-1.5 hover:bg-surface-secondary rounded-lg text-text-muted transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <span className="text-sm font-bold text-text-primary whitespace-nowrap">
                                {selectedIds.size} selected
                            </span>
                        </div>

                        <div className="flex items-center space-x-2">
                            <BatchActionBtn
                                icon={<CheckCircle2 className="w-4 h-4" />}
                                label="Complete"
                                color="text-accent-warm"
                                onClick={async () => {
                                    await batchUpdateTasks(Array.from(selectedIds), { status: 'done', completed: true })
                                    setSelectedIds(new Set())
                                    showToast(`Marked ${selectedIds.size} tasks as done`, 'success')
                                }}
                            />
                            <BatchActionBtn
                                icon={<RotateCcw className="w-4 h-4" />}
                                label="To-do"
                                onClick={async () => {
                                    await batchUpdateTasks(Array.from(selectedIds), { status: 'todo', completed: false })
                                    setSelectedIds(new Set())
                                    showToast(`Marked ${selectedIds.size} tasks as to-do`, 'success')
                                }}
                            />
                            <BatchActionBtn
                                icon={<Star className="w-4 h-4" />}
                                label="Do Today"
                                color="text-yellow-500"
                                onClick={async () => {
                                    await batchUpdateTasks(Array.from(selectedIds), { today: true })
                                    setSelectedIds(new Set())
                                    showToast(`Added ${selectedIds.size} tasks to Today`, 'success')
                                }}
                            />
                            <BatchActionBtn
                                icon={<Trash2 className="w-4 h-4" />}
                                label="Delete"
                                color="text-red-500"
                                onClick={async () => {
                                    if (confirm(`Delete ${selectedIds.size} tasks?`)) {
                                        await batchDeleteTasks(Array.from(selectedIds))
                                        setSelectedIds(new Set())
                                        showToast(`Deleted ${selectedIds.size} tasks`, 'info')
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function BatchActionBtn({ icon, label, onClick, color = "text-text-muted" }: {
    icon: React.ReactNode,
    label: string,
    onClick: () => void,
    color?: string
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:bg-surface-secondary active:scale-95 group",
                color
            )}
        >
            <span className="group-hover:scale-110 transition-transform">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
        </button>
    )
}

function FilterGroup<T extends string | null>({ options, value, onChange, icons }: {
    options: T[],
    value: T,
    onChange: (val: T) => void,
    icons?: Record<string, React.ReactNode>
}) {
    return (
        <div className="flex flex-nowrap items-center bg-surface border border-border/70 rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar">
            {options.map((opt) => (
                <button
                    key={String(opt)}
                    onClick={() => onChange(opt)}
                    className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs 2xl:text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap",
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

function FilterSection({ label, children }: { label: string, children: React.ReactNode }) {
    return (
        <div className="space-y-1.5 p-2 rounded-2xl bg-surface-secondary/40 border border-border/40">
            <p className="text-xs uppercase tracking-widest font-black text-text-muted/80 px-1">{label}</p>
            {children}
        </div>
    )
}
