import { useState, useMemo } from 'react'
import { Plus, Folder, ChevronDown, ChevronRight, MoreVertical } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { ProjectForm } from '../components/ProjectForm'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import { Project } from '../types'

export default function Projects() {
    const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects()
    const { tasks, loading: tasksLoading } = useTasks()
    const { showToast } = useToast()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
    const [showArchived, setShowArchived] = useState(false)

    const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects])
    const archivedProjects = useMemo(() => projects.filter(p => p.archived), [projects])

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
        } catch (error) {
            showToast('Failed to save project', 'error')
        }
    }

    const toggleArchive = async (project: Project) => {
        await updateProject(project.id, { archived: !project.archived })
        showToast(project.archived ? 'Project unarchived' : 'Project archived', 'success')
    }

    if (projectsLoading || tasksLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm xl:text-base text-text-muted font-medium">Gathering projects...</p>
            </div>
        )
    }

    return (
        <div className="mx-auto px-4 py-8 md:py-12 space-y-10">
            <header className="flex items-center justify-between">
                <div className="space-y-1">
                    <h1 className="text-3xl md:text-4xl xl:text-5xl font-bold tracking-tight text-text-primary">Projects</h1>
                    <p className="text-sm xl:text-base text-text-muted font-medium">{activeProjects.length} active initiatives</p>
                </div>
                <button
                    onClick={() => setIsFormOpen(true)}
                    className="flex items-center space-x-2 px-5 py-2.5 xl:px-6 xl:py-3 bg-accent hover:bg-accent/90 text-white rounded-full text-sm xl:text-base font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                >
                    <Plus className="w-5 h-5 xl:w-6 xl:h-6" />
                    <span className="hidden md:inline">New Project</span>
                    <span className="md:hidden">New</span>
                </button>
            </header>

            {/* Active Projects Grid */}
            {activeProjects.length === 0 ? (
                <EmptyState
                    icon={Folder}
                    title="No active projects"
                    description="Organize your tasks into projects to track progress and stay focused."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 4k:grid-cols-4 gap-5 xl:gap-6">
                    {activeProjects.map(project => (
                        <ProjectCard
                            key={project.id}
                            project={project}
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
                <div className="space-y-4 pt-6 border-t border-border/50">
                    <button
                        onClick={() => setShowArchived(!showArchived)}
                        className="flex items-center space-x-2 text-text-muted hover:text-text-primary transition-colors group"
                    >
                        {showArchived ? <ChevronDown className="w-4 h-4 xl:w-5 xl:h-5" /> : <ChevronRight className="w-4 h-4 xl:w-5 xl:h-5" />}
                        <span className="text-sm xl:text-base font-bold uppercase tracking-widest">Archived ({archivedProjects.length})</span>
                    </button>

                    {showArchived && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 4k:grid-cols-4 gap-5 xl:gap-6 opacity-70">
                            {archivedProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
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
    stats,
    onEdit,
    onArchive,
    isArchived = false
}: {
    project: Project,
    stats: { total: number, completed: number, progress: number },
    onEdit: (p: Project) => void,
    onArchive: () => void,
    isArchived?: boolean
}) {
    return (
        <div className="group relative bg-surface border border-border rounded-2xl p-6 xl:p-8 hover:border-accent/30 transition-all hover:shadow-xl hover:-translate-y-1">
            <Link to={`/projects/${project.id}`} className="absolute inset-0 z-0" />

            <div className="relative z-10 space-y-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <div
                            className="w-3 h-3 xl:w-4 xl:h-4 rounded-full shadow-lg shrink-0"
                            style={{ backgroundColor: project.color || '#7c6aff', boxShadow: `0 0 10px ${project.color}40` }}
                        />
                        <h3 className="text-lg xl:text-xl font-bold text-text-primary group-hover:text-accent transition-colors">
                            {project.name}
                        </h3>
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                onEdit(project)
                            }}
                            className="p-1.5 xl:p-2 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors"
                        >
                            <MoreVertical className="w-4 h-4 xl:w-5 xl:h-5" />
                        </button>
                    </div>
                </div>

                {project.description && (
                    <p className="text-sm xl:text-base text-text-muted line-clamp-2 min-h-[2.5rem]">
                        {project.description}
                    </p>
                )}

                <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs xl:text-sm font-bold uppercase tracking-wider text-text-muted">
                        <span>{stats.total} tasks · {stats.completed} completed</span>
                        <span className="text-text-primary">{Math.round(stats.progress)}%</span>
                    </div>
                    <div className="h-1.5 xl:h-2 w-full bg-surface-secondary rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent transition-all duration-500 ease-out"
                            style={{
                                width: `${stats.progress}%`,
                                backgroundColor: project.color || '#7c6aff'
                            }}
                        />
                    </div>
                </div>

                {isArchived && (
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            onArchive()
                        }}
                        className="mt-2 w-full py-1.5 xl:py-2 text-xs xl:text-sm font-bold uppercase tracking-widest text-accent border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors"
                    >
                        Unarchive
                    </button>
                )}
            </div>
        </div>
    )
}
