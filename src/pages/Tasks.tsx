import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Plus, Filter, LayoutList, LayoutDashboard, ChevronDown, ChevronsUpDown, RotateCcw, Trash2, Star, CheckCircle2, X } from 'lucide-react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { useTasks } from '../hooks/useTasks'
import { useProjects } from '../hooks/useProjects'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { KanbanBoard } from '../components/KanbanBoard'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import { PageHeader } from '../components/PageHeader'
import { FilterPanelShell } from '../components/FilterPanelShell'
import { Task, TaskFilters } from '../types'
import { cn } from '../lib/cn'
import { useShortcutContext } from '../context/ShortcutContext'
import { useGlobalTasks } from '../context/TaskContext'
import { useSearchParams } from 'react-router-dom'

const STORAGE_KEY = 'ghost_tasks_filters'
const STATUS_GROUP_COLLAPSE_KEY = 'ghost_tasks_status_group_collapses'
const COMPLETE_OLDER_REVEAL_KEY = 'ghost_tasks_complete_older_revealed'

type TaskStatusGroupKey = 'todo' | 'doing' | 'waiting' | 'done'
type StatusCollapseState = Record<TaskStatusGroupKey, boolean>

const DEFAULT_STATUS_COLLAPSES: StatusCollapseState = {
    todo: false,
    doing: false,
    waiting: false,
    done: true
}

const DEFAULT_FILTERS: TaskFilters = {
    status: 'all',
    location: null,
    energy: null,
    focus: null,
    projectId: null,
    dateFilter: 'any'
}

export default function Tasks() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [filters, setFilters] = useState<TaskFilters>(() => {
        const status = searchParams.get('status') as TaskFilters['status'] | null
        const dateFilter = searchParams.get('date') as TaskFilters['dateFilter'] | null
        const projectId = searchParams.get('project')
        if (status || dateFilter || projectId) {
            return {
                ...DEFAULT_FILTERS,
                ...(status ? { status } : {}),
                ...(dateFilter ? { dateFilter } : {}),
                ...(projectId ? { projectId } : {})
            }
        }
        const saved = localStorage.getItem(STORAGE_KEY)
        return saved ? JSON.parse(saved) : DEFAULT_FILTERS
    })

    const { projects } = useProjects()
    const { tasks, loading, createTask, updateTask, completeTask, reorderTasks } = useTasks(filters)
    const { showToast } = useToast()
    const { setActiveTaskId } = useShortcutContext()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
    const filtersPanelRef = useRef<HTMLDivElement | null>(null)
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => (searchParams.get('view') === 'kanban' ? 'kanban' : 'list'))
    const [taskFormDefaults, setTaskFormDefaults] = useState<{ defaultProjectId?: string | null; defaultToday?: boolean }>({})
    const [statusGroupCollapses, setStatusGroupCollapses] = useState<StatusCollapseState>(() => {
        const saved = localStorage.getItem(STATUS_GROUP_COLLAPSE_KEY)
        return saved ? { ...DEFAULT_STATUS_COLLAPSES, ...JSON.parse(saved) } : DEFAULT_STATUS_COLLAPSES
    })
    const [isCompleteOlderRevealed, setIsCompleteOlderRevealed] = useState<boolean>(() => {
        const saved = localStorage.getItem(COMPLETE_OLDER_REVEAL_KEY)
        return saved ? JSON.parse(saved) : false
    })

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false)
    const { batchUpdateTasks, batchDeleteTasks } = useGlobalTasks()

    // Persist filters
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
    }, [filters])
    useEffect(() => {
        const next = new URLSearchParams(searchParams)
        if (viewMode !== 'list') next.set('view', viewMode)
        else next.delete('view')
        if (filters.status && filters.status !== 'all') next.set('status', filters.status)
        else next.delete('status')
        if (filters.dateFilter && filters.dateFilter !== 'any') next.set('date', filters.dateFilter)
        else next.delete('date')
        if (filters.projectId) next.set('project', filters.projectId)
        else next.delete('project')
        setSearchParams(next, { replace: true })
    }, [viewMode, filters.status, filters.dateFilter, filters.projectId, searchParams, setSearchParams])
    useEffect(() => {
        localStorage.setItem(STATUS_GROUP_COLLAPSE_KEY, JSON.stringify(statusGroupCollapses))
    }, [statusGroupCollapses])
    useEffect(() => {
        localStorage.setItem(COMPLETE_OLDER_REVEAL_KEY, JSON.stringify(isCompleteOlderRevealed))
    }, [isCompleteOlderRevealed])

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
    const activeFilterSummary = useMemo(() => {
        const parts: string[] = []
        if (filters.status && filters.status !== 'all') parts.push(`status: ${filters.status}`)
        if (filters.dateFilter && filters.dateFilter !== 'any') parts.push(`date: ${filters.dateFilter}`)
        if (filters.projectId) {
            const projectName = projects.find((p) => p.id === filters.projectId)?.name || 'project'
            parts.push(`project: ${projectName}`)
        }
        if (filters.location) parts.push(`location: ${filters.location}`)
        if (filters.energy) parts.push(`energy: ${filters.energy}`)
        if (filters.focus) parts.push(`focus: ${filters.focus}`)
        return parts
    }, [filters, projects])

    const isReorderingEnabled = !hasActiveFilters

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !isReorderingEnabled) return
        if (result.source.droppableId !== 'tasks-todo-list' || result.destination.droppableId !== 'tasks-todo-list') return

        const todoTasks = tasks.filter(t => (t.status || (t.completed ? 'done' : 'todo')) === 'todo')
        const nonTodoTasks = tasks.filter(t => (t.status || (t.completed ? 'done' : 'todo')) !== 'todo')
        const reorderedTodos = Array.from(todoTasks)
        const [reorderedItem] = reorderedTodos.splice(result.source.index, 1)
        reorderedTodos.splice(result.destination.index, 0, reorderedItem)

        reorderTasks([...reorderedTodos, ...nonTodoTasks].map(i => i.id))
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

    const clearFilters = () => {
        setFilters(DEFAULT_FILTERS)
    }

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

    const projectHeaderGroup = useMemo(() => {
        if (!filters.projectId) return null
        const project = projects.find(p => p.id === filters.projectId)
        return {
            id: filters.projectId,
            name: project?.name || 'Selected Project',
            color: project?.color
        }
    }, [filters.projectId, projects])

    const statusGroups = useMemo(() => {
        const buckets: Record<'todo' | 'doing' | 'waiting' | 'done', Task[]> = {
            todo: [],
            doing: [],
            waiting: [],
            done: []
        }
        for (const task of tasks) {
            const status = task.status || (task.completed ? 'done' : 'todo')
            buckets[status].push(task)
        }
        return [
            { key: 'todo', label: 'Todo', tasks: buckets.todo },
            { key: 'doing', label: 'Doing', tasks: buckets.doing },
            { key: 'waiting', label: 'Waiting', tasks: buckets.waiting },
            { key: 'done', label: 'Complete', tasks: buckets.done }
        ] as const
    }, [tasks])

    const completedBuckets = useMemo(() => {
        const now = new Date()
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const startWeek = new Date(startToday)
        startWeek.setDate(startToday.getDate() - 6)
        const start30Days = new Date(startToday)
        start30Days.setDate(startToday.getDate() - 29)

        const recentDone = statusGroups.find(g => g.key === 'done')?.tasks ?? []
        const today: Task[] = []
        const thisWeek: Task[] = []
        const older30Days: Task[] = []

        for (const task of recentDone) {
            const sourceDate = task.completed_at || task.updated_at || task.created_at
            const completedDate = new Date(sourceDate)
            if (Number.isNaN(completedDate.getTime())) continue
            const day = new Date(completedDate.getFullYear(), completedDate.getMonth(), completedDate.getDate())

            if (day >= startToday) {
                today.push(task)
                continue
            }
            if (day >= startWeek) {
                thisWeek.push(task)
                continue
            }
            if (day >= start30Days) {
                older30Days.push(task)
            }
        }

        return { today, thisWeek, older30Days }
    }, [statusGroups])

    const toggleStatusGroup = useCallback((key: TaskStatusGroupKey) => {
        setStatusGroupCollapses(prev => ({ ...prev, [key]: !prev[key] }))
    }, [])
    const statusGroupOrder = useMemo(() => statusGroups.map(g => g.key), [statusGroups])

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
            if (e.key === 'Escape' && isFiltersExpanded) {
                e.preventDefault()
                setIsFiltersExpanded(false)
                return
            }
            if (!e.altKey) return

            if (e.key.toLowerCase() === 'v') {
                e.preventDefault()
                setViewMode(v => v === 'list' ? 'kanban' : 'list')
                return
            }

            const n = Number(e.key)
            if (!Number.isInteger(n) || n < 1 || n > 4) return
            const key = statusGroupOrder[n - 1]
            if (!key) return
            e.preventDefault()
            if (e.shiftKey) {
                toggleStatusGroup(key)
            } else {
                document.querySelector<HTMLElement>(`[data-task-status-group="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [statusGroupOrder, toggleStatusGroup, isFiltersExpanded])

    useEffect(() => {
        if (!isFiltersExpanded) return

        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as Node | null
            if (!target) return
            if (filtersPanelRef.current?.contains(target)) return
            setIsFiltersExpanded(false)
        }

        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [isFiltersExpanded])

    return (
        <div className="w-full max-w-full mx-auto px-3 sm:px-4 pt-3 sm:pt-4 pb-12 space-y-5 sm:space-y-8 animate-in fade-in duration-500">
            <PageHeader
                title="Tasks"
                compact
                actions={
                    <>
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
                        className="flex items-center space-x-2 px-4 sm:px-5 py-2.5 2xl:px-6 2xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-xs sm:text-sm 2xl:text-base font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        <span className="hidden sm:inline">Add Task</span>
                        <span className="sm:hidden">Add</span>
                    </button>
                    </>
                }
            />

            {/* Filter Bar */}
            <FilterPanelShell>
            <div ref={filtersPanelRef} className="space-y-3">
                <div className="flex items-center justify-end gap-2 text-xs 2xl:text-sm uppercase font-bold tracking-widest text-text-muted">
                    <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="text-accent hover:underline lowercase tracking-normal font-medium text-xs sm:text-sm"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setIsFiltersExpanded((v: boolean) => !v)}
                    className={cn(
                        "w-full text-left rounded-xl border border-border/60 bg-surface/60 px-3 py-3 transition-all",
                        isFiltersExpanded ? "border-accent/30 bg-accent/5" : "hover:border-border hover:bg-surface"
                    )}
                    aria-expanded={isFiltersExpanded}
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-text-primary shrink-0">
                                    <Filter className="w-3 h-3" />
                                    Filters
                                </span>
                                {activeFilterCount > 0 && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] tracking-normal font-black bg-accent-warm/10 text-accent-warm border border-accent-warm/20 shrink-0">
                                        {activeFilterCount} active
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-text-muted leading-relaxed truncate">
                                {activeFilterSummary.length > 0
                                    ? activeFilterSummary.join(' · ')
                                    : 'No filters applied'}
                            </p>
                        </div>
                        <ChevronsUpDown className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    </div>
                </button>

                {isFiltersExpanded && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="relative group/select min-w-0">
                                <select
                                    value={filters.status ?? 'all'}
                                    onChange={(e) => updateFilter({ status: e.target.value as TaskFilters['status'] })}
                                    className={cn(
                                    "w-full pl-3 pr-8 py-2.5 rounded-xl text-[11px] sm:text-xs 2xl:text-sm font-bold uppercase tracking-wide sm:tracking-wider border border-border bg-surface transition-all appearance-none cursor-pointer",
                                        (filters.status ?? 'all') !== 'all' ? "bg-accent/10 border-accent/50 text-accent" : "text-text-muted hover:border-text-muted hover:text-text-primary"
                                    )}
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="todo">Todo</option>
                                    <option value="doing">Doing</option>
                                    <option value="waiting">Waiting</option>
                                    <option value="done">Done</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none group-hover/select:text-text-primary transition-colors" />
                            </div>

                            <div className="relative group/select min-w-0">
                                <select
                                    value={filters.projectId || ''}
                                    onChange={(e) => updateFilter({ projectId: e.target.value || null })}
                                    className={cn(
                                    "w-full pl-3 pr-8 py-2.5 rounded-xl text-[11px] sm:text-xs 2xl:text-sm font-bold uppercase tracking-wide sm:tracking-wider border border-border bg-surface transition-all appearance-none cursor-pointer",
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
                        </div>
                    </div>
                )}

                {isFiltersExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 2xl:gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <FilterSection label="Location">
                            <FilterGroup
                                options={[null, 'home', 'outside']}
                                value={filters.location ?? null}
                                onChange={(val) => updateFilter({ location: val as TaskFilters['location'] })}
                            />
                        </FilterSection>

                        <FilterSection label="Energy">
                            <FilterGroup
                                options={[null, 'high', 'low']}
                                value={filters.energy ?? null}
                                onChange={(val) => updateFilter({ energy: val as TaskFilters['energy'] })}
                            />
                        </FilterSection>

                        <FilterSection label="Focus">
                            <FilterGroup
                                options={[null, 'immersion', 'process']}
                                value={filters.focus ?? null}
                                onChange={(val) => updateFilter({ focus: val as TaskFilters['focus'] })}
                            />
                        </FilterSection>
                    </div>
                )}

                {isFiltersExpanded && (
                    <button
                        onClick={() => setIsFiltersExpanded(false)}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-wider hover:bg-accent/90 transition-all"
                    >
                        Apply Filters
                    </button>
                )}

                {!isReorderingEnabled && <div className="h-0" aria-hidden="true" />}
            </div>
            </FilterPanelShell>

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
                        actionLabel={hasActiveFilters ? 'Create Task In This View' : 'Add Task'}
                        onAction={() => {
                            setTaskFormDefaults({
                                defaultProjectId: filters.projectId || null,
                                defaultToday: filters.dateFilter === 'today'
                            })
                            setIsFormOpen(true)
                        }}
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
                    <div className="space-y-10">
                        {projectHeaderGroup && (
                            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur py-2 flex items-center space-x-2 border-b border-border/50">
                                {projectHeaderGroup.color && <div className="w-2 h-2 rounded-full" style={{ backgroundColor: projectHeaderGroup.color }} />}
                                <h3 className="text-sm 2xl:text-base font-bold tracking-tight text-text-primary">{projectHeaderGroup.name}</h3>
                            </div>
                        )}

                        {statusGroups.map((group) => {
                            if (group.tasks.length === 0) return null
                            const isCollapsed = statusGroupCollapses[group.key]
                            return (
                                <div key={group.key} className="space-y-4" data-task-status-group={group.key}>
                                    <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/40 py-2 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm 2xl:text-base font-bold tracking-tight text-text-primary">{group.label}</h3>
                                            <span className="text-xs uppercase tracking-widest font-black text-text-muted">{group.tasks.length}</span>
                                        </div>
                                        <button
                                            onClick={() => toggleStatusGroup(group.key)}
                                            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest font-black text-text-muted hover:text-text-primary transition-colors"
                                        >
                                            <ChevronsUpDown className="w-3.5 h-3.5" />
                                            {isCollapsed ? 'Reveal' : 'Hide'}
                                        </button>
                                    </div>

                                    {!isCollapsed && (
                                        group.key === 'done' ? (
                                            <div className="space-y-5">
                                                <CompletedSubsection
                                                    label="Today"
                                                    tasks={completedBuckets.today}
                                                    selectedIds={selectedIds}
                                                    onToggleComplete={handleToggleComplete}
                                                    onToggleToday={handleToggleToday}
                                                    onSelect={handleTaskSelect}
                                                    onClickTitle={handleTitleClick}
                                                />
                                                <CompletedSubsection
                                                    label="This Week"
                                                    tasks={completedBuckets.thisWeek}
                                                    selectedIds={selectedIds}
                                                    onToggleComplete={handleToggleComplete}
                                                    onToggleToday={handleToggleToday}
                                                    onSelect={handleTaskSelect}
                                                    onClickTitle={handleTitleClick}
                                                />
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-xs uppercase tracking-widest font-black text-text-muted">Older (Last 30 Days)</h4>
                                                            <span className="text-xs uppercase tracking-widest font-black text-text-muted/80">{completedBuckets.older30Days.length}</span>
                                                        </div>
                                                        {completedBuckets.older30Days.length > 0 && (
                                                            <button
                                                                onClick={() => setIsCompleteOlderRevealed(v => !v)}
                                                                className="text-xs uppercase tracking-widest font-black text-text-muted hover:text-text-primary"
                                                            >
                                                                {isCompleteOlderRevealed ? 'Hide' : 'Reveal'}
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isCompleteOlderRevealed && completedBuckets.older30Days.length > 0 && (
                                                        <div className="space-y-2">
                                                            {completedBuckets.older30Days.map((task) => (
                                                                <TaskItem
                                                                    key={task.id}
                                                                    task={task}
                                                                    onToggleComplete={handleToggleComplete}
                                                                    onToggleToday={handleToggleToday}
                                                                    onClick={() => { }}
                                                                    onSelect={handleTaskSelect}
                                                                    isSelected={selectedIds.has(task.id)}
                                                                    onClickTitle={handleTitleClick}
                                                                    hideDragHandle
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) :
                                        group.key === 'todo' && isReorderingEnabled ? (
                                            <DragDropContext onDragEnd={handleDragEnd}>
                                                <Droppable droppableId="tasks-todo-list" isDropDisabled={!isReorderingEnabled}>
                                                    {(provided) => (
                                                        <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
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
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </DragDropContext>
                                        ) : (
                                            <div className="space-y-2">
                                                {group.tasks.map((task) => (
                                                    <TaskItem
                                                        key={task.id}
                                                        task={task}
                                                        onToggleComplete={handleToggleComplete}
                                                        onToggleToday={handleToggleToday}
                                                        onClick={() => { }}
                                                        onSelect={handleTaskSelect}
                                                        isSelected={selectedIds.has(task.id)}
                                                        onClickTitle={handleTitleClick}
                                                        hideDragHandle
                                                    />
                                                ))}
                                            </div>
                                        )
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Form Modal (Create only) */}
            <TaskForm
                isOpen={isFormOpen}
                defaultProjectId={taskFormDefaults.defaultProjectId}
                defaultToday={taskFormDefaults.defaultToday}
                onSave={handleSave}
                onCancel={() => {
                    setIsFormOpen(false)
                    setTaskFormDefaults({})
                }}
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
                                label="Doing"
                                color="text-blue-400"
                                onClick={async () => {
                                    await batchUpdateTasks(Array.from(selectedIds), { status: 'doing', completed: false })
                                    setSelectedIds(new Set())
                                    showToast(`Marked ${selectedIds.size} tasks as doing`, 'success')
                                }}
                            />
                            <BatchActionBtn
                                icon={<RotateCcw className="w-4 h-4" />}
                                label="Waiting"
                                color="text-orange-400"
                                onClick={async () => {
                                    await batchUpdateTasks(Array.from(selectedIds), { status: 'waiting', completed: false })
                                    setSelectedIds(new Set())
                                    showToast(`Marked ${selectedIds.size} tasks as waiting`, 'success')
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
                                onClick={() => setShowBulkDeleteConfirm(true)}
                            />
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={showBulkDeleteConfirm}
                title={`Delete ${selectedIds.size} task${selectedIds.size === 1 ? '' : 's'}?`}
                description="This action cannot be undone."
                options={[
                    {
                        label: 'Delete Tasks',
                        description: 'Permanently remove the selected tasks.',
                        variant: 'danger',
                        onClick: async () => {
                            const count = selectedIds.size
                            await batchDeleteTasks(Array.from(selectedIds))
                            setSelectedIds(new Set())
                            setShowBulkDeleteConfirm(false)
                            showToast(`Deleted ${count} task${count === 1 ? '' : 's'}`, 'info')
                        }
                    }
                ]}
                onCancel={() => setShowBulkDeleteConfirm(false)}
                onClose={() => setShowBulkDeleteConfirm(false)}
            />
        </div>
    )
}

function CompletedSubsection({
    label,
    tasks,
    selectedIds,
    onToggleComplete,
    onToggleToday,
    onSelect,
    onClickTitle,
    onEmpty = 'None'
}: {
    label: string
    tasks: Task[]
    selectedIds: Set<string>
    onToggleComplete: (id: string, completed: boolean) => void
    onToggleToday: (id: string, today: boolean) => void
    onSelect: (taskId: string, event: React.MouseEvent) => void
    onClickTitle: (task: Task) => void
    onEmpty?: string
}) {
    if (tasks.length === 0) {
        return (
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <h4 className="text-xs uppercase tracking-widest font-black text-text-muted">{label}</h4>
                    <span className="text-xs uppercase tracking-widest font-black text-text-muted/80">0</span>
                </div>
                <p className="text-xs text-text-muted/70">{onEmpty}</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <h4 className="text-xs uppercase tracking-widest font-black text-text-muted">{label}</h4>
                <span className="text-xs uppercase tracking-widest font-black text-text-muted/80">{tasks.length}</span>
            </div>
            <div className="space-y-2">
                {tasks.map((task) => (
                    <TaskItem
                        key={task.id}
                        task={task}
                        onToggleComplete={onToggleComplete}
                        onToggleToday={onToggleToday}
                        onClick={() => { }}
                        onSelect={onSelect}
                        isSelected={selectedIds.has(task.id)}
                        onClickTitle={onClickTitle}
                        hideDragHandle
                    />
                ))}
            </div>
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
                        "flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 rounded-lg text-[11px] sm:text-xs 2xl:text-sm font-bold uppercase tracking-wider transition-all whitespace-nowrap",
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
