import React, { useState, useMemo, useCallback } from 'react'
import { Plus, Folder, ChevronDown, ChevronRight, MoreVertical, Filter, LayoutGrid, LayoutList, SortAsc, CheckCircle2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { ProjectForm } from '../components/ProjectForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Project } from '../types'
import { cn } from '../lib/cn'

type SortOption = 'name' | 'progress' | 'tasks' | 'newest'
type ViewMode = 'grid' | 'list'

export default function Projects() {
    const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects()
    const { categories, loading: categoriesLoading } = useProjectCategories()
    const { tasks, loading: tasksLoading } = useTasks()
    const { showToast } = useToast()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
    const [showArchived, setShowArchived] = useState(false)
    const [categoryFilterId, setCategoryFilterId] = useState('')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [sortBy, setSortBy] = useState<SortOption>('newest')

    const categoryMap = useMemo(
        () => new Map(categories.map((category) => [category.id, category.name])),
        [categories]
    )

    const projectStatsMap = useMemo(() => {
        const stats = new Map<string, { total: number; completed: number; progress: number }>()
        for (const task of tasks) {
            if (!task.project_id) continue
            const current = stats.get(task.project_id) || { total: 0, completed: 0, progress: 0 }
            current.total += 1
            if (task.completed) current.completed += 1
            stats.set(task.project_id, current)
        }
        for (const [projectId, current] of stats) {
            current.progress = current.total > 0 ? (current.completed / current.total) * 100 : 0
            stats.set(projectId, current)
        }
        return stats
    }, [tasks])

    const getProjectStats = useCallback((projectId: string) => {
        return projectStatsMap.get(projectId) || { total: 0, completed: 0, progress: 0 }
    }, [projectStatsMap])

    const processProjects = useCallback((projectList: Project[]) => {
        const filtered = projectList.filter(p => !categoryFilterId || p.category_id === categoryFilterId)

        return [...filtered].sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

            const statsA = getProjectStats(a.id)
            const statsB = getProjectStats(b.id)

            if (sortBy === 'progress') return statsB.progress - statsA.progress
            if (sortBy === 'tasks') return statsB.total - statsA.total
            return 0
        })
    }, [categoryFilterId, sortBy, getProjectStats])

    const activeProjects = useMemo(() => processProjects(projects.filter(p => !p.archived)), [projects, processProjects])
    const archivedProjects = useMemo(() => processProjects(projects.filter(p => p.archived)), [projects, processProjects])

    const handleSave = useCallback(async (projectData: Partial<Project>) => {
        try {
            if (editingProject) {
                await updateProject(editingProject.id, projectData)
                showToast('Project updated', 'success')
            } else {
                await createProject(projectData)
                showToast('Project created', 'success')
            }
            setIsFormOpen(false)
            setEditingProject(undefined)
        } catch (_error) {
            showToast('Failed to save project', 'error')
        }
    }, [editingProject, updateProject, createProject, showToast])

    const toggleArchive = useCallback(async (project: Project) => {
        await updateProject(project.id, { archived: !project.archived })
        showToast(project.archived ? 'Project unarchived' : 'Project archived', 'success')
    }, [updateProject, showToast])

    return (
        <div className="w-full max-w-full mx-auto px-4 pt-2 pb-8 tablet:pt-4 tablet:pb-12 space-y-10 animate-in fade-in duration-500">
            <header className="flex items-end justify-between gap-6 flex-wrap border-b border-border/40 pb-8">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">Projects</h1>
                    <p className="text-sm 2xl:text-base text-text-muted font-heavy uppercase tracking-widest">{activeProjects.length} active initiatives</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center bg-surface-secondary/50 p-1 rounded-xl border border-border/50">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <LayoutGrid className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'list' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            <LayoutList className="w-4 h-4 2xl:w-5 2xl:h-5" />
                        </button>
                    </div>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center space-x-2.5 px-6 py-3 2xl:px-8 2xl:py-4 bg-accent hover:bg-accent/90 text-white rounded-2xl text-sm 2xl:text-base font-black uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-accent/20"
                    >
                        <Plus className="w-5 h-5 2xl:w-6 2xl:h-6" />
                        <span className="hidden md:inline">New Project</span>
                        <span className="md:hidden">New</span>
                    </button>
                </div>
            </header>

            {/* Filter & Sort Bar */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-surface-secondary/20 p-3 2xl:p-4 rounded-2xl border border-border/40">
                <div className="flex flex-wrap items-center gap-4 md:gap-8 w-full md:w-auto">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-text-muted">
                            <Filter className="w-3.5 h-3.5" />
                            <span>Category</span>
                        </div>
                        <select
                            value={categoryFilterId}
                            onChange={(e) => setCategoryFilterId(e.target.value)}
                            className="bg-surface border border-border/50 rounded-xl px-3 py-1.5 text-xs 2xl:text-sm text-text-primary focus:border-accent/50 outline-none transition-all cursor-pointer min-w-[140px]"
                        >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-text-muted">
                            <SortAsc className="w-3.5 h-3.5" />
                            <span>Sort By</span>
                        </div>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-surface border border-border/50 rounded-xl px-3 py-1.5 text-xs 2xl:text-sm text-text-primary focus:border-accent/50 outline-none transition-all cursor-pointer min-w-[140px]"
                        >
                            <option value="newest">Newest First</option>
                            <option value="name">Alphanumerical</option>
                            <option value="progress">Highest Progress</option>
                            <option value="tasks">Most Tasks</option>
                        </select>
                    </div>
                </div>

                <div className="hidden md:flex items-center bg-surface-secondary/50 p-1 rounded-xl border border-border/50">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'grid' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                        )}
                        title="Grid View"
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                            "p-2 rounded-lg transition-all",
                            viewMode === 'list' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                        )}
                        title="List View"
                    >
                        <LayoutList className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Content Area with Loading State */}
            {projectsLoading || tasksLoading || categoriesLoading ? (
                <div className="flex flex-col items-center justify-center py-20 2xl:py-32 space-y-6">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-base 2xl:text-lg text-text-muted font-bold tracking-tight">Gathering initiatives...</p>
                </div>
            ) : (
                <>
                    {/* Active Projects Content */}
                    {activeProjects.length === 0 ? (
                        <EmptyState
                            icon={Folder}
                            title={categoryFilterId ? 'No projects in this category' : 'No active projects'}
                            description={
                                categoryFilterId
                                    ? 'Try another category filter or create a project in this category.'
                                    : 'Organize your tasks into projects to track progress and stay focused.'
                            }
                        />
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-4 4k:grid-cols-4 gap-6 2xl:gap-8">
                            {activeProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                    stats={getProjectStats(project.id)}
                                    onEdit={(p) => {
                                        setEditingProject(p)
                                        setIsFormOpen(true)
                                    }}
                                    onArchive={() => toggleArchive(project)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeProjects.map(project => (
                                <ProjectListItem
                                    key={project.id}
                                    project={project}
                                    categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                    stats={getProjectStats(project.id)}
                                    onEdit={(p) => {
                                        setEditingProject(p)
                                        setIsFormOpen(true)
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {/* Archived Projects Section */}
                    {archivedProjects.length > 0 && (
                        <div className="space-y-6 pt-10">
                            <button
                                onClick={() => setShowArchived(!showArchived)}
                                className="flex items-center space-x-3 text-text-muted hover:text-text-primary transition-all group"
                            >
                                {showArchived ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                                <span className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-muted group-hover:text-text-primary transition-colors">Archived ({archivedProjects.length})</span>
                            </button>

                            {showArchived && (
                                <div className={cn(
                                    viewMode === 'grid'
                                        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-4 4k:grid-cols-4 gap-6 2xl:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                                        : "space-y-3 opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                                )}>
                                    {archivedProjects.map(project => (
                                        viewMode === 'grid' ? (
                                            <ProjectCard
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                onArchive={() => toggleArchive(project)}
                                                isArchived
                                            />
                                        ) : (
                                            <ProjectListItem
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                isArchived
                                            />
                                        )
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                </>
            )}

            <ProjectForm
                isOpen={isFormOpen}
                project={editingProject}
                categories={categories}
                onSave={handleSave}
                onCancel={() => {
                    setIsFormOpen(false)
                    setEditingProject(undefined)
                }}
                onDelete={async (id) => {
                    await deleteProject(id)
                    setIsFormOpen(false)
                    setEditingProject(undefined)
                }}
            />
        </div>
    )
}

const ProjectListItem = React.memo<{
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number },
    onEdit: (p: Project) => void,
    isArchived?: boolean
}>(function ProjectListItem({
    project,
    categoryName,
    stats,
    onEdit,
    isArchived = false
}: {
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number },
    onEdit: (p: Project) => void,
    isArchived?: boolean
}) {
    return (
        <div className="group relative flex items-center bg-surface-secondary/30 hover:bg-surface border border-border/40 hover:border-accent/40 rounded-2xl p-4 transition-all hover:shadow-lg gap-6">
            <Link to={`/projects/${project.short_id || project.id}`} className="absolute inset-0 z-[5] rounded-2xl" />

            <div
                className="w-1.5 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: project.color || '#7c6aff' }}
            />

            <div className="flex-1 min-w-0 pointer-events-none">
                <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-base 2xl:text-lg font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                        {project.name}
                    </h3>
                    {categoryName && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-accent/20 bg-accent/5 text-accent uppercase tracking-widest font-black">
                            {categoryName}
                        </span>
                    )}
                    {isArchived && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-text-muted/20 bg-text-muted/5 text-text-muted uppercase tracking-widest font-black">
                            Archived
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted font-medium">
                    <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                        <span>{stats.completed} / {stats.total} tasks</span>
                    </div>
                </div>
            </div>

            <div className="hidden md:flex flex-col items-end gap-1 px-4 min-w-[120px] pointer-events-none">
                <div className="text-xs font-black uppercase tracking-widest text-text-muted">Progress</div>
                <div className="text-sm font-black text-text-primary">{Math.round(stats.progress)}%</div>
                <div className="w-24 h-1.5 bg-surface-secondary rounded-full overflow-hidden border border-border/20">
                    <div
                        className="h-full bg-accent transition-all duration-1000"
                        style={{ width: `${stats.progress}%`, backgroundColor: project.color || '#7c6aff' }}
                    />
                </div>
            </div>

            <button
                onClick={(e) => {
                    e.preventDefault()
                    onEdit(project)
                }}
                className="relative z-20 p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all flex-shrink-0 pointer-events-auto"
            >
                <MoreVertical className="w-5 h-5" />
            </button>
        </div>
    )
})

const ProjectCard = React.memo<{
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number },
    onEdit: (p: Project) => void,
    onArchive: () => void,
    isArchived?: boolean
}>(function ProjectCard({
    project,
    categoryName,
    stats,
    onEdit,
    onArchive,
    isArchived = false
}: {
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number },
    onEdit: (p: Project) => void,
    onArchive: () => void,
    isArchived?: boolean
}) {
    return (
        <div className="group relative flex flex-col bg-surface border border-border/60 rounded-3xl p-7 2xl:p-9 hover:border-accent/40 transition-all hover:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)] hover:-translate-y-2 overflow-hidden min-h-[320px] 2xl:min-h-[360px]">
            {/* Background noise texture */}
            <div className="surface-texture" />

            {/* Color Accent Bar */}
            <div
                className="absolute top-0 left-0 right-0 h-2 2xl:h-2.5 opacity-80 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: project.color || '#7c6aff' }}
            />

            <Link to={`/projects/${project.short_id || project.id}`} className="absolute inset-0 z-[5] rounded-3xl" />

            <div className="relative z-10 flex-1 flex flex-col space-y-7 pointer-events-none">
                <div className="flex items-start justify-between min-h-[64px]">
                    <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center space-x-3">
                            <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: project.color || '#7c6aff', boxShadow: `0 0 12px ${project.color}60` }}
                            />
                            {categoryName && (
                                <span className="px-2 py-0.5 text-xs 2xl:text-sm rounded-full border border-accent/25 bg-accent/10 text-accent uppercase tracking-widest font-black">
                                    {categoryName}
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl 2xl:text-3xl font-black tracking-tight text-text-primary group-hover:text-accent transition-colors whitespace-normal break-words">
                            {project.name}
                        </h3>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto">
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                onEdit(project)
                            }}
                            className="relative z-20 p-2.5 2xl:p-3 hover:bg-surface-secondary rounded-2xl text-text-muted hover:text-text-primary transition-all active:scale-90"
                        >
                            <MoreVertical className="w-5 h-5 2xl:w-6 2xl:h-6" />
                        </button>
                    </div>
                </div>

                {project.description ? (
                    <p className="text-sm 2xl:text-base text-text-muted line-clamp-2 min-h-[3rem] leading-relaxed">
                        {project.description}
                    </p>
                ) : (
                    <div className="flex-1 min-h-[3rem]" />
                )}

                <div className="space-y-4 mt-auto">
                    <div className="flex items-center justify-between">
                        {/* Stats text */}
                        <div className="space-y-1">
                            <p className="text-xs 2xl:text-sm font-black uppercase tracking-widest text-text-muted">Progress</p>
                            <p className="text-lg 2xl:text-xl font-black text-text-primary tabular-nums">
                                {Math.round(stats.progress)}%
                            </p>
                            <span className="text-xs 2xl:text-sm font-heavy text-text-muted">
                                {stats.completed} / {stats.total} done
                            </span>
                        </div>
                        {/* SVG Progress Ring */}
                        <div className="relative shrink-0 w-16 h-16 2xl:w-20 2xl:h-20">
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                                <circle
                                    cx="32" cy="32" r="26"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="6"
                                    className="text-surface-secondary"
                                />
                                <circle
                                    cx="32" cy="32" r="26"
                                    fill="none"
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 26}`}
                                    strokeDashoffset={`${2 * Math.PI * 26 * (1 - stats.progress / 100)}`}
                                    style={{ stroke: project.color || '#7c6aff', transition: 'stroke-dashoffset 1s ease-out', filter: `drop-shadow(0 0 6px ${project.color}60)` }}
                                />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center text-xs 2xl:text-sm font-black text-text-primary tabular-nums">
                                {Math.round(stats.progress)}%
                            </span>
                        </div>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="h-2 2xl:h-2.5 w-full bg-surface-secondary rounded-full overflow-hidden border border-border/10 p-[1px]">
                        <div
                            className="h-full rounded-full transition-all duration-1000 ease-out relative group-hover:opacity-100 opacity-90"
                            style={{
                                width: `${stats.progress}%`,
                                backgroundColor: project.color || '#7c6aff',
                                boxShadow: `0 0 20px ${project.color}30`
                            }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" />
                        </div>
                    </div>
                </div>

                {isArchived && (
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            onArchive()
                        }}
                        className="relative z-20 mt-2 w-full py-2.5 2xl:py-3 text-xs 2xl:text-sm font-black uppercase tracking-widest text-accent border border-accent/20 rounded-2xl hover:bg-accent/10 transition-all font-heavy pointer-events-auto"
                    >
                        Unarchive
                    </button>
                )}
            </div>
        </div>
    )
})
