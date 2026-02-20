import { useState, useMemo } from 'react'
import { Plus, Folder, ChevronDown, ChevronRight, MoreVertical, Filter } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { ProjectForm } from '../components/ProjectForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Project } from '../types'

export default function Projects() {
    const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects()
    const { categories, loading: categoriesLoading } = useProjectCategories()
    const { tasks, loading: tasksLoading } = useTasks()
    const { showToast } = useToast()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
    const [showArchived, setShowArchived] = useState(false)
    const [categoryFilterId, setCategoryFilterId] = useState('')

    const activeProjects = useMemo(
        () =>
            projects.filter(
                (p) => !p.archived && (!categoryFilterId || p.category_id === categoryFilterId)
            ),
        [projects, categoryFilterId]
    )
    const archivedProjects = useMemo(
        () =>
            projects.filter(
                (p) => p.archived && (!categoryFilterId || p.category_id === categoryFilterId)
            ),
        [projects, categoryFilterId]
    )
    const categoryMap = useMemo(
        () => new Map(categories.map((category) => [category.id, category.name])),
        [categories]
    )

    const getProjectStats = (projectId: string) => {
        const projectTasks = tasks.filter(t => t.project_id === projectId)
        const total = projectTasks.length
        const completed = projectTasks.filter(t => t.completed).length
        const progress = total > 0 ? (completed / total) * 100 : 0
        return { total, completed, progress }
    }

    const handleSave = async (projectData: Partial<Project>) => {
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
    }

    const toggleArchive = async (project: Project) => {
        await updateProject(project.id, { archived: !project.archived })
        showToast(project.archived ? 'Project unarchived' : 'Project archived', 'success')
    }

    if (projectsLoading || tasksLoading || categoriesLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
                <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-base 2xl:text-lg text-text-muted font-bold tracking-tight">Gathering initiatives...</p>
            </div>
        )
    }

    return (
        <div className="w-full max-w-full space-y-12">
            <header className="flex items-end justify-between gap-4 flex-wrap border-b border-border/40 pb-8">
                <div className="space-y-2">
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">Projects</h1>
                    <p className="text-sm 2xl:text-base text-text-muted font-heavy uppercase tracking-widest">{activeProjects.length} active initiatives</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center space-x-2.5 px-6 py-3.5 2xl:px-8 2xl:py-4 bg-accent hover:bg-accent/90 text-white rounded-2xl text-sm 2xl:text-base font-black uppercase tracking-widest transition-all active:scale-95 shadow-2xl shadow-accent/20"
                >
                    <Plus className="w-5 h-5 2xl:w-6 2xl:h-6" />
                    <span className="hidden md:inline">New Project</span>
                    <span className="md:hidden">New</span>
                </button>
            </header>

            <section className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase font-black tracking-widest text-text-muted">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter by Category</span>
                </div>
                <select
                    value={categoryFilterId}
                    onChange={(e) => setCategoryFilterId(e.target.value)}
                    className="w-full max-w-sm bg-surface border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent/50 outline-none transition-all"
                >
                    <option value="">All Categories</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.name}
                        </option>
                    ))}
                </select>
            </section>

            {/* Active Projects Grid */}
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
            ) : (
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
            )}

            {/* Archived Projects Section */}
            {archivedProjects.length > 0 && (
                <div className="space-y-6 pt-10">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="flex items-center space-x-3 text-text-muted hover:text-text-primary transition-all group"
                    >
                        {showArchived ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        <span className="text-sm 2xl:text-base font-black uppercase tracking-widest">Archived ({archivedProjects.length})</span>
                    </button>

                    {showArchived && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-4 4k:grid-cols-4 gap-6 2xl:gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                            {archivedProjects.map(project => (
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
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Project Form Modal */}
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

function ProjectCard({
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

            <Link to={`/projects/${project.short_id || project.id}`} className="absolute inset-0 z-0 rounded-3xl" />

            <div className="relative z-10 flex-1 flex flex-col space-y-7">
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
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        className="relative z-20 mt-2 w-full py-2.5 2xl:py-3 text-xs 2xl:text-sm font-black uppercase tracking-widest text-accent border border-accent/20 rounded-2xl hover:bg-accent/10 transition-all font-heavy"
                    >
                        Unarchive
                    </button>
                )}
            </div>
        </div>
    )
}
