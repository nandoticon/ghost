import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import {
    ChevronLeft,
    MoreVertical,
    Plus,
    Target,
    CheckCircle2,
    AlertCircle,
    Archive,
    Trash2,
    Edit3,
    X
} from 'lucide-react'
import { useProjects } from '../hooks/useProjects'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { useTasks } from '../hooks/useTasks'
import { TaskItem } from '../components/TaskItem'
import { TaskForm } from '../components/TaskForm'
import { TaskDetail } from '../components/TaskDetail'
import { ProjectForm } from '../components/ProjectForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Task, TaskFilters } from '../types'
import { cn } from '../lib/cn'
import { Filter, LayoutList } from 'lucide-react'

export default function ProjectDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const location = useLocation()
    const { projects, updateProject, deleteProject, loading: projectsLoading } = useProjects()
    const { categories } = useProjectCategories()

    // Find current project
    const project = useMemo(() => projects.find(p => p.short_id === id || p.id === id), [projects, id])
    const projectCategoryName = useMemo(() => {
        if (!project?.category_id) return null
        return categories.find((category) => category.id === project.category_id)?.name || null
    }, [categories, project?.category_id])
    const projectStatusLabel = useMemo(() => {
        if (!project) return ''
        if (project.status === 'backlog') return 'Backlog'
        if (project.status === 'active') return 'Active'
        return 'Completed'
    }, [project])

    // Filters for the task list
    const [filters, setFilters] = useState<TaskFilters>({
        status: 'all',
        location: null,
        energy: null,
        focus: null,
        projectId: project?.id || id, // Scoped to this project (UUID preferred)
        dateFilter: 'any'
    })

    const { tasks, loading: tasksLoading, createTask, updateTask, completeTask, reorderTasks } = useTasks({
        ...filters,
        projectId: project?.id || id // Fallback to id if project not yet loaded
    })
    const { showToast } = useToast()

    // UI State
    const [isEditingInline, setIsEditingInline] = useState(false)
    const [isProjectFormOpen, setIsProjectFormOpen] = useState(false)
    const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
    const [showMenu, setShowMenu] = useState(false)
    const [isClosingPanel, setIsClosingPanel] = useState(false)
    const closeTimerRef = useRef<number | null>(null)
    const isClosingRef = useRef(false)

    // Inline edit state
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')

    useEffect(() => {
        if (isEditingInline) return
        if (project) {
            setEditName(project.name)
            setEditDesc(project.description || '')
        }
    }, [project, isEditingInline])

    const handleInlineSave = async () => {
        if (!project || !editName.trim()) return
        try {
            await updateProject(project.id, {
                name: editName.trim(),
                description: editDesc.trim() || null
            })
            showToast('Project updated', 'success')
            setIsEditingInline(false)
        } catch (_error) {
            showToast('Failed to update project', 'error')
        }
    }

    // Stats Calculation
    const stats = useMemo(() => {
        const projectTasks = tasks // Already filtered by projectId in useTasks hook
        const total = projectTasks.length
        const completed = projectTasks.filter(t => t.completed).length
        const remaining = total - completed
        const now = new Date().toISOString()
        const overdue = projectTasks.filter(t => !t.completed && t.end_at && t.end_at < now).length
        return { total, completed, remaining, overdue }
    }, [tasks])

    const isReorderingEnabled = useMemo(() => {
        return filters.status === 'all' &&
            filters.location === null &&
            filters.energy === null &&
            filters.focus === null &&
            filters.dateFilter === 'any'
    }, [filters])

    const handleDragEnd = (result: DropResult) => {
        if (!result.destination || !isReorderingEnabled) return

        const items = Array.from(tasks)
        const [reorderedItem] = items.splice(result.source.index, 1)
        items.splice(result.destination.index, 0, reorderedItem)

        reorderTasks(items.map(i => i.id))
    }

    const handleTaskSave = async (taskData: Partial<Task>) => {
        try {
            if (!project) {
                throw new Error('Project not loaded')
            }
            await createTask({ ...taskData, project_id: project.id })
            showToast('Task added to project', 'success')
            setIsTaskFormOpen(false)
        } catch (_error) {
            showToast('Failed to add task', 'error')
        }
    }

    const requestClose = useCallback(() => {
        if (isClosingRef.current) return
        isClosingRef.current = true
        setIsClosingPanel(true)
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            const routeState = location.state as { backgroundLocation?: Location } | undefined
            if (routeState?.backgroundLocation) {
                navigate(-1)
                return
            }
            navigate('/projects')
        }, 150)
    }, [navigate, location.state])

    useEffect(() => () => {
        if (closeTimerRef.current) {
            window.clearTimeout(closeTimerRef.current)
        }
    }, [])

    if (projectsLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="max-w-[720px] mx-auto px-4 py-20 text-center space-y-4">
                <h1 className="text-2xl font-bold text-text-primary">Project not found</h1>
                <Link to="/projects" className="text-accent hover:underline">Back to Projects</Link>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-40 flex justify-end overflow-hidden">
            <button
                type="button"
                aria-label="Dismiss project panel backdrop"
                onClick={requestClose}
                className={cn(
                    "absolute inset-0 bg-background/60 backdrop-blur-sm",
                    isClosingPanel ? "animate-out fade-out duration-150" : "animate-in fade-in duration-200"
                )}
            />

            <div
                className={cn(
                    "relative h-full w-full max-w-[1200px] border-l border-border bg-background md:bg-surface shadow-2xl overflow-y-auto custom-scrollbar",
                    isClosingPanel
                        ? "animate-out fade-out duration-150"
                        : "animate-in slide-in-from-right duration-200"
                )}
            >
                <div className="w-full max-w-full mx-auto px-4 pt-2 pb-8 tablet:pt-4 tablet:pb-12 space-y-8">
            {/* Navigation */}
            <nav className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={requestClose}
                    className="flex items-center space-x-2 text-text-muted hover:text-text-primary transition-colors group"
                >
                    <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Projects</span>
                </button>

                <div className="flex items-center gap-1">
                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-colors"
                        aria-label="Project actions"
                    >
                        <MoreVertical className="w-5 h-5" />
                    </button>
                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-xl shadow-2xl z-30 py-2 animate-in zoom-in-95 duration-200">
                                <button
                                    onClick={() => {
                                        setIsProjectFormOpen(true)
                                        setShowMenu(false)
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                                >
                                    <Edit3 className="w-4 h-4" />
                                    <span>Edit Project</span>
                                </button>
                                <button
                                    onClick={async () => {
                                        await updateProject(project.id, { archived: !project.archived })
                                        setShowMenu(false)
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                                >
                                    <Archive className="w-4 h-4" />
                                    <span>{project.archived ? 'Unarchive' : 'Archive'}</span>
                                </button>
                                <div className="h-px bg-border/50 my-1" />
                                <button
                                    onClick={() => {
                                        setIsProjectFormOpen(true) // ProjectForm handles delete confirmation
                                        setShowMenu(false)
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={requestClose}
                    className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-colors"
                    aria-label="Close project panel"
                >
                    <X className="w-5 h-5" />
                </button>
                </div>
            </nav>

            {/* Project Header */}
            <header className="space-y-4">
                <div className="flex items-start space-x-4">
                    <div
                        className="w-4 h-4 rounded-full mt-2.5 shrink-0 shadow-lg"
                        style={{ backgroundColor: project.color || '#7c6aff', boxShadow: `0 0 15px ${project.color}40` }}
                    />
                    <div className="flex-1 min-w-0">
                        {isEditingInline ? (
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleInlineSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleInlineSave()}
                                className="w-full bg-transparent text-3xl md:text-4xl font-bold text-text-primary outline-none border-b-2 border-accent/50 pb-1"
                            />
                        ) : (
                            <h1
                                onClick={() => setIsEditingInline(true)}
                                className="text-3xl md:text-4xl xl:text-4xl 2xl:text-5xl font-black tracking-tightest title-gradient cursor-pointer hover:opacity-80 transition-opacity truncate"
                            >
                                {project.name}
                            </h1>
                        )}

                        <div className="mt-2 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                {projectCategoryName && (
                                    <div className="inline-flex items-center px-2.5 py-1 rounded-full border border-accent/25 bg-accent/10 text-xs font-black uppercase tracking-widest text-accent">
                                        {projectCategoryName}
                                    </div>
                                )}
                                <div className={cn(
                                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-widest border",
                                    project.status === 'completed'
                                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                        : project.status === 'active'
                                            ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                            : "border-text-muted/20 bg-text-muted/5 text-text-muted"
                                )}>
                                    {projectStatusLabel}
                                </div>
                                {project.status === 'completed' && project.completed_at && (
                                    <div className="text-xs text-text-muted">
                                        Completed {new Date(project.completed_at).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                            {isEditingInline ? (
                                <textarea
                                    value={editDesc}
                                    onChange={(e) => setEditDesc(e.target.value)}
                                    onBlur={handleInlineSave}
                                    className="w-full bg-transparent text-sm text-text-muted outline-none border-b border-border/50 py-1 resize-none h-20"
                                    placeholder="Add a description..."
                                />
                            ) : (
                                <p
                                    onClick={() => setIsEditingInline(true)}
                                    className="text-sm text-text-muted font-medium cursor-pointer hover:text-text-primary transition-colors max-w-2xl"
                                >
                                    {project.description || 'No description provided. Click to add one.'}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stat Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Total" value={stats.total} icon={<LayoutList className="w-4 h-4" />} color="text-text-primary" />
                    <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="w-4 h-4" />} color="text-green-500" />
                    <StatCard label="Remaining" value={stats.remaining} icon={<Target className="w-4 h-4" />} color="text-accent" />
                    <StatCard label="Overdue" value={stats.overdue} icon={<AlertCircle className="w-4 h-4" />} color="text-red-500" />
                </div>
            </header>

            {/* Tasks Filter Bar */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-text-primary">Project Tasks</h2>
                    <button
                        onClick={() => setIsTaskFormOpen(true)}
                        className="flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-full text-xs font-bold transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Task</span>
                    </button>
                </div>

                {/* Simple Horizontal Filter Bar (Project-filtered) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs uppercase font-bold tracking-widest text-text-muted">
                        <div className="flex items-center space-x-2">
                            <Filter className="w-3 h-3" />
                            <span>Filter Tasks</span>
                        </div>
                    </div>

                    <div className="flex overflow-x-auto gap-2 no-scrollbar scroll-smooth">
                        <FilterButton
                            active={filters.status === 'all'}
                            onClick={() => setFilters(f => ({ ...f, status: 'all' }))}
                            label="All"
                        />
                        <FilterButton
                            active={filters.status === 'todo'}
                            onClick={() => setFilters(f => ({ ...f, status: 'todo' }))}
                            label="To-Do"
                        />
                        <FilterButton
                            active={filters.status === 'done'}
                            onClick={() => setFilters(f => ({ ...f, status: 'done' }))}
                            label="Done"
                        />
                        <div className="w-px h-6 bg-border mx-1" />
                        <FilterButton
                            active={filters.dateFilter === 'overdue'}
                            onClick={() => setFilters(f => ({ ...f, dateFilter: f.dateFilter === 'overdue' ? 'any' : 'overdue' }))}
                            label="Overdue"
                        />
                    </div>
                </div>

                {/* Task List */}
                <div className="space-y-4">
                    {tasksLoading && tasks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10">
                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : tasks.length === 0 ? (
                        <EmptyState
                            icon={LayoutList}
                            title="No tasks here"
                            description="This project is looking a bit empty. Add some tasks to get it moving!"
                        />
                    ) : (
                        <DragDropContext onDragEnd={handleDragEnd}>
                            <Droppable droppableId={`project-${id}-tasks`} isDropDisabled={!isReorderingEnabled}>
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                        {tasks.map((task, index) => (
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
                                                            onClickTitle={(t) => setSelectedTaskId(t.id)}
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
                    )}
                </div>
            </div>

            {/* Modals */}
            <ProjectForm
                isOpen={isProjectFormOpen}
                project={project}
                categories={categories}
                onSave={async (data) => {
                    await updateProject(project.id, data)
                    setIsProjectFormOpen(false)
                }}
                onCancel={() => setIsProjectFormOpen(false)}
                onDelete={async (id) => {
                    await deleteProject(id)
                    navigate('/projects')
                }}
            />

            <TaskForm
                isOpen={isTaskFormOpen}
                onSave={handleTaskSave}
                onCancel={() => setIsTaskFormOpen(false)}
            />

            <TaskDetail
                taskId={selectedTaskId}
                onClose={() => setSelectedTaskId(null)}
            />
                </div>
            </div>
        </div>
    )
}

function StatCard({ label, value, icon, color }: { label: string, value: number, icon: React.ReactNode, color: string }) {
    return (
        <div className="bg-surface border border-border p-4 rounded-2xl space-y-2">
            <div className={cn("flex items-center space-x-2 text-xs font-bold uppercase tracking-widest", color)}>
                {icon}
                <span>{label}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
        </div>
    )
}

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all flex-shrink-0",
                active
                    ? "bg-accent border-accent text-white"
                    : "bg-surface border-border text-text-muted hover:text-text-primary hover:border-text-muted"
            )}
        >
            {label}
        </button>
    )
}
