import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { Plus, Folder, ChevronDown, ChevronRight, MoreVertical, Filter, LayoutGrid, LayoutList, SortAsc, CheckCircle2, Search, Pin, PinOff, ArchiveRestore, Archive, ChevronsUpDown } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProjects } from '../hooks/useProjects'
import { useTasks } from '../hooks/useTasks'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { ProjectForm } from '../components/ProjectForm'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { FilterPanelShell } from '../components/FilterPanelShell'
import { useToast } from '../components/Toast'
import { Project } from '../types'
import { cn } from '../lib/cn'

type SortOption = 'name' | 'progress' | 'tasks' | 'newest'
type ViewMode = 'grid' | 'list'
type ProjectStatusFilter = 'all' | Project['status']
type ProjectGroupingMode = 'status' | 'category' | 'none'
type CategoryCollapseMap = Record<string, boolean>

const PROJECTS_VIEW_MODE_KEY = 'ghost_projects_view_mode'
const PROJECTS_SORT_KEY = 'ghost_projects_sort'
const PROJECTS_GROUPING_KEY = 'ghost_projects_grouping_mode'
const PROJECTS_PINNED_KEY = 'ghost_projects_pinned_ids'
const PROJECTS_CATEGORY_COLLAPSE_KEY = 'ghost_projects_category_collapses'

export default function Projects() {
    const [searchParams, setSearchParams] = useSearchParams()
    const { projects, loading: projectsLoading, createProject, updateProject, deleteProject } = useProjects()
    const { categories, loading: categoriesLoading } = useProjectCategories()
    const { tasks, loading: tasksLoading } = useTasks()
    const { showToast } = useToast()

    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | undefined>(undefined)
    const [showArchived, setShowArchived] = useState(false)
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
    const [categoryFilterId, setCategoryFilterId] = useState(() => searchParams.get('category') || '')
    const [statusFilter, setStatusFilter] = useState<ProjectStatusFilter>(() => (searchParams.get('status') as ProjectStatusFilter) || 'all')
    const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '')
    const [viewMode, setViewMode] = useState<ViewMode>(() => (searchParams.get('view') as ViewMode) || (localStorage.getItem(PROJECTS_VIEW_MODE_KEY) as ViewMode) || 'list')
    const [sortBy, setSortBy] = useState<SortOption>(() => (searchParams.get('sort') as SortOption) || (localStorage.getItem(PROJECTS_SORT_KEY) as SortOption) || 'newest')
    const [groupingMode, setGroupingMode] = useState<ProjectGroupingMode>(() => (searchParams.get('group') as ProjectGroupingMode) || (localStorage.getItem(PROJECTS_GROUPING_KEY) as ProjectGroupingMode) || 'status')
    const [projectFormDefaultCategoryId, setProjectFormDefaultCategoryId] = useState<string | null>(null)
    const [pinnedProjectIds, setPinnedProjectIds] = useState<string[]>(() => {
        const saved = localStorage.getItem(PROJECTS_PINNED_KEY)
        return saved ? JSON.parse(saved) : []
    })
    const [categoryCollapsed, setCategoryCollapsed] = useState<CategoryCollapseMap>(() => {
        const saved = localStorage.getItem(PROJECTS_CATEGORY_COLLAPSE_KEY)
        return saved ? JSON.parse(saved) : {}
    })
    const filtersPanelRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        localStorage.setItem(PROJECTS_VIEW_MODE_KEY, viewMode)
    }, [viewMode])
    useEffect(() => {
        localStorage.setItem(PROJECTS_SORT_KEY, sortBy)
    }, [sortBy])
    useEffect(() => {
        localStorage.setItem(PROJECTS_GROUPING_KEY, groupingMode)
    }, [groupingMode])
    useEffect(() => {
        localStorage.setItem(PROJECTS_PINNED_KEY, JSON.stringify(pinnedProjectIds))
    }, [pinnedProjectIds])
    useEffect(() => {
        localStorage.setItem(PROJECTS_CATEGORY_COLLAPSE_KEY, JSON.stringify(categoryCollapsed))
    }, [categoryCollapsed])
    useEffect(() => {
        const next = new URLSearchParams(searchParams)
        if (viewMode !== 'grid') next.set('view', viewMode)
        else next.delete('view')
        if (sortBy !== 'newest') next.set('sort', sortBy)
        else next.delete('sort')
        if (groupingMode !== 'status') next.set('group', groupingMode)
        else next.delete('group')
        if (categoryFilterId) next.set('category', categoryFilterId)
        else next.delete('category')
        if (statusFilter !== 'all') next.set('status', statusFilter)
        else next.delete('status')
        if (searchQuery.trim()) next.set('q', searchQuery.trim())
        else next.delete('q')
        setSearchParams(next, { replace: true })
    }, [viewMode, sortBy, groupingMode, categoryFilterId, statusFilter, searchQuery, searchParams, setSearchParams])

    const categoryMap = useMemo(
        () => new Map(categories.map((category) => [category.id, category.name])),
        [categories]
    )

    const projectStatsMap = useMemo(() => {
        const stats = new Map<string, { total: number; completed: number; progress: number; lastActivityAt: string | null; lastCompletedAt: string | null }>()
        for (const task of tasks) {
            if (!task.project_id) continue
            const current = stats.get(task.project_id) || { total: 0, completed: 0, progress: 0, lastActivityAt: null, lastCompletedAt: null }
            current.total += 1
            if (task.completed) current.completed += 1
            const activityCandidates = [task.updated_at, task.completed_at, task.created_at].filter(Boolean) as string[]
            for (const candidate of activityCandidates) {
                if (!current.lastActivityAt || new Date(candidate).getTime() > new Date(current.lastActivityAt).getTime()) {
                    current.lastActivityAt = candidate
                }
            }
            if (task.completed_at && (!current.lastCompletedAt || new Date(task.completed_at).getTime() > new Date(current.lastCompletedAt).getTime())) {
                current.lastCompletedAt = task.completed_at
            }
            stats.set(task.project_id, current)
        }
        for (const [projectId, current] of stats) {
            current.progress = current.total > 0 ? (current.completed / current.total) * 100 : 0
            stats.set(projectId, current)
        }
        return stats
    }, [tasks])

    const getProjectStats = useCallback((projectId: string) => {
        return projectStatsMap.get(projectId) || { total: 0, completed: 0, progress: 0, lastActivityAt: null, lastCompletedAt: null }
    }, [projectStatsMap])

    const processProjects = useCallback((projectList: Project[]) => {
        const query = searchQuery.trim().toLowerCase()
        const filtered = projectList.filter(p => {
            if (categoryFilterId && p.category_id !== categoryFilterId) return false
            if (statusFilter !== 'all' && p.status !== statusFilter) return false
            if (!query) return true
            const haystack = `${p.name} ${p.description || ''}`.toLowerCase()
            return haystack.includes(query)
        })

        return [...filtered].sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name)
            if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()

            const statsA = getProjectStats(a.id)
            const statsB = getProjectStats(b.id)

            if (sortBy === 'progress') return statsB.progress - statsA.progress
            if (sortBy === 'tasks') return statsB.total - statsA.total
            return 0
        })
    }, [categoryFilterId, statusFilter, searchQuery, sortBy, getProjectStats])

    const activeProjects = useMemo(() => processProjects(projects.filter(p => !p.archived)), [projects, processProjects])
    const archivedProjects = useMemo(() => processProjects(projects.filter(p => p.archived)), [projects, processProjects])
    const groupProjectsByCategory = useCallback((projectList: Project[]) => {
        const grouped = new Map<string, { key: string; label: string; projects: Project[] }>()
        for (const project of projectList) {
            const key = project.category_id || 'uncategorized'
            const label = project.category_id ? (categoryMap.get(project.category_id) || 'Unknown Category') : 'Uncategorized'
            const existing = grouped.get(key)
            if (existing) {
                existing.projects.push(project)
            } else {
                grouped.set(key, { key, label, projects: [project] })
            }
        }
        return Array.from(grouped.values())
            .filter(group => group.projects.length > 0)
            .sort((a, b) => {
                if (a.key === 'uncategorized') return 1
                if (b.key === 'uncategorized') return -1
                return a.label.localeCompare(b.label)
            })
    }, [categoryMap])
    const pinnedActiveProjects = useMemo(() => {
        const pinned = new Set(pinnedProjectIds)
        return activeProjects.filter(p => pinned.has(p.id))
    }, [activeProjects, pinnedProjectIds])
    const unpinnedActiveProjects = useMemo(() => {
        const pinned = new Set(pinnedProjectIds)
        return activeProjects.filter(p => !pinned.has(p.id))
    }, [activeProjects, pinnedProjectIds])
    const groupProjectsByStatus = useCallback((projectList: Project[]) => {
        const order: Project['status'][] = ['backlog', 'active', 'completed']
        const labels: Record<Project['status'], string> = {
            backlog: 'Backlog',
            active: 'Active',
            completed: 'Completed'
        }
        return order
            .map((status) => ({
                key: status,
                label: labels[status],
                projects: projectList.filter((project) => project.status === status)
            }))
            .filter((group) => group.projects.length > 0)
    }, [])
    const unpinnedActiveStatusGroups = useMemo(() => (
        groupProjectsByStatus(unpinnedActiveProjects).map((statusGroup) => ({
            ...statusGroup,
            categoryGroups: groupProjectsByCategory(statusGroup.projects)
        }))
    ), [groupProjectsByStatus, groupProjectsByCategory, unpinnedActiveProjects])
    const unpinnedActiveCategoryGroups = useMemo(
        () => groupProjectsByCategory(unpinnedActiveProjects),
        [groupProjectsByCategory, unpinnedActiveProjects]
    )
    const archivedStatusGroups = useMemo(() => (
        groupProjectsByStatus(archivedProjects).map((statusGroup) => ({
            ...statusGroup,
            categoryGroups: groupProjectsByCategory(statusGroup.projects)
        }))
    ), [groupProjectsByStatus, groupProjectsByCategory, archivedProjects])
    const archivedCategoryGroups = useMemo(
        () => groupProjectsByCategory(archivedProjects),
        [groupProjectsByCategory, archivedProjects]
    )

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
    const togglePinned = useCallback((projectId: string) => {
        setPinnedProjectIds(prev => prev.includes(projectId) ? prev.filter(id => id !== projectId) : [projectId, ...prev])
    }, [])
    const toggleCategoryCollapsed = useCallback((scope: 'active' | 'archived', key: string) => {
        const storageKey = `${scope}:${key}`
        setCategoryCollapsed(prev => ({ ...prev, [storageKey]: !prev[storageKey] }))
    }, [])
    const isCategoryCollapsed = useCallback((scope: 'active' | 'archived', key: string) => {
        return Boolean(categoryCollapsed[`${scope}:${key}`])
    }, [categoryCollapsed])
    const getGroupSummary = useCallback((projectList: Project[]) => {
        let totalTasks = 0
        let completedTasks = 0
        for (const project of projectList) {
            const stats = getProjectStats(project.id)
            totalTasks += stats.total
            completedTasks += stats.completed
        }
        const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
        return { progress }
    }, [getProjectStats])
    const visibleCategoryGroupKeys = useMemo(() => {
        if (viewMode !== 'list') return [] as string[]
        if (groupingMode !== 'category') return [] as string[]
        return unpinnedActiveCategoryGroups.map((g) => g.key)
    }, [viewMode, groupingMode, unpinnedActiveCategoryGroups])

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
                setViewMode(v => v === 'grid' ? 'list' : 'grid')
                return
            }
            const n = Number(e.key)
            if (!Number.isInteger(n) || n < 1 || n > 9) return
            const key = visibleCategoryGroupKeys[n - 1]
            if (!key) return
            e.preventDefault()
            if (e.shiftKey) {
                toggleCategoryCollapsed('active', key)
            } else {
                document.querySelector<HTMLElement>(`[data-project-category-group="${key}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [visibleCategoryGroupKeys, toggleCategoryCollapsed, isFiltersExpanded])

    return (
        <div className="w-full max-w-full mx-auto px-3 sm:px-4 pt-2 pb-8 tablet:pt-4 tablet:pb-12 space-y-6 md:space-y-10 animate-in fade-in duration-500">
            <PageHeader
                title="Projects"
                subtitle={`${activeProjects.length} active initiatives`}
                actions={
                    <>
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
                        className="flex items-center space-x-2 px-4 sm:px-6 py-2.5 sm:py-3 2xl:px-8 2xl:py-4 bg-accent hover:bg-accent/90 text-white rounded-xl sm:rounded-2xl text-xs sm:text-sm 2xl:text-base font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl sm:shadow-2xl shadow-accent/20"
                    >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5 2xl:w-6 2xl:h-6" />
                        <span className="hidden md:inline">New Project</span>
                        <span className="md:hidden">New</span>
                    </button>
                    </>
                }
            />

            {/* Filter & Sort Bar */}
            <FilterPanelShell className="flex flex-col gap-3 p-2.5 sm:p-3 2xl:p-4" >
            <div ref={filtersPanelRef} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 w-full">
                    <div className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-3 py-2 w-full min-w-0">
                        <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-text-muted shrink-0" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search projects"
                            className="bg-transparent outline-none text-xs sm:text-sm 2xl:text-sm text-text-primary placeholder:text-text-muted w-full min-w-0"
                        />
                    </div>
                    <div className="flex md:hidden items-center bg-surface-secondary/50 p-1 rounded-xl border border-border/50 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "p-2 rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                            )}
                            title="Grid View"
                            aria-label="Grid View"
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
                            aria-label="List View"
                        >
                            <LayoutList className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => setIsFiltersExpanded((v) => !v)}
                    className="md:hidden w-full text-left rounded-xl border border-border/60 bg-surface/60 px-3 py-3 transition-all hover:border-border hover:bg-surface"
                    aria-expanded={isFiltersExpanded}
                >
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-text-primary shrink-0">
                                    <Filter className="w-3 h-3" />
                                    Filters
                                </span>
                            </div>
                            <p className="text-xs text-text-muted truncate">
                                {[
                                    statusFilter !== 'all' ? `status: ${statusFilter}` : null,
                                    categoryFilterId ? `category: ${categoryMap.get(categoryFilterId) || 'selected'}` : null,
                                    groupingMode !== 'status' ? `group: ${groupingMode}` : null,
                                    sortBy !== 'newest' ? `sort: ${sortBy}` : null,
                                ].filter(Boolean).join(' · ') || 'No filters applied'}
                            </p>
                        </div>
                        <ChevronsUpDown className="w-4 h-4 text-text-muted shrink-0" />
                    </div>
                </button>
                <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 w-full md:w-auto", !isFiltersExpanded && "hidden md:grid")}>
                    <div className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-2.5 sm:px-3 py-2 min-w-0">
                        <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as ProjectStatusFilter)}
                            className="bg-transparent outline-none text-[11px] sm:text-sm 2xl:text-sm text-text-primary cursor-pointer w-full min-w-0"
                            aria-label="Filter projects by status"
                        >
                            <option value="all">All Statuses</option>
                            <option value="backlog">Backlog</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-2.5 sm:px-3 py-2 min-w-0">
                        <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <select
                            value={categoryFilterId}
                            onChange={(e) => setCategoryFilterId(e.target.value)}
                            className="bg-transparent outline-none text-[11px] sm:text-sm 2xl:text-sm text-text-primary cursor-pointer w-full min-w-0"
                            aria-label="Filter projects by category"
                        >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-2.5 sm:px-3 py-2 min-w-0">
                        <SortAsc className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <select
                            value={groupingMode}
                            onChange={(e) => setGroupingMode(e.target.value as ProjectGroupingMode)}
                            className="bg-transparent outline-none text-[11px] sm:text-sm 2xl:text-sm text-text-primary cursor-pointer w-full min-w-0"
                            aria-label="Group projects in list view"
                        >
                            <option value="status">Group by Status</option>
                            <option value="category">Group by Category</option>
                            <option value="none">No Grouping</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2 bg-surface border border-border/50 rounded-xl px-2.5 sm:px-3 py-2 min-w-0">
                        <SortAsc className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="bg-transparent outline-none text-[11px] sm:text-sm 2xl:text-sm text-text-primary cursor-pointer w-full min-w-0"
                            aria-label="Sort projects"
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
            </FilterPanelShell>
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
                            actionLabel={categoryFilterId ? 'Create Project In Category' : 'New Project'}
                            onAction={() => {
                                setProjectFormDefaultCategoryId(categoryFilterId || null)
                                setIsFormOpen(true)
                            }}
                        />
                    ) : viewMode === 'grid' ? (
                        <div className="space-y-6 md:space-y-8">
                            {pinnedActiveProjects.length > 0 && (
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <h3 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">Pinned</h3>
                                        <span className="text-xs font-black uppercase tracking-widest text-text-muted">{pinnedActiveProjects.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-4 4k:grid-cols-4 gap-6 2xl:gap-8">
                                        {pinnedActiveProjects.map(project => (
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
                                </section>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1500px]:grid-cols-4 4k:grid-cols-4 gap-6 2xl:gap-8">
                                {unpinnedActiveProjects.map(project => (
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
                        </div>
                    ) : (
                        <div className="space-y-6 md:space-y-8">
                            {pinnedActiveProjects.length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <h3 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">Pinned</h3>
                                        <span className="text-xs font-black uppercase tracking-widest text-text-muted">{pinnedActiveProjects.length}</span>
                                    </div>
                                    <div className="space-y-3">
                                        {pinnedActiveProjects.map(project => (
                                            <ProjectListItem
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                onArchive={() => toggleArchive(project)}
                                                onTogglePinned={() => togglePinned(project.id)}
                                                isPinned={pinnedProjectIds.includes(project.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                            {groupingMode === 'none' ? (
                                <section className="space-y-3">
                                    <div className="space-y-3">
                                        {unpinnedActiveProjects.map(project => (
                                            <ProjectListItem
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                onArchive={() => toggleArchive(project)}
                                                onTogglePinned={() => togglePinned(project.id)}
                                                isPinned={pinnedProjectIds.includes(project.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ) : groupingMode === 'category' ? (
                                unpinnedActiveCategoryGroups.map((group) => {
                                    const summary = getGroupSummary(group.projects)
                                    const collapsed = isCategoryCollapsed('active', group.key)
                                    return (
                                        <section key={group.key} className="space-y-3" data-project-category-group={group.key}>
                                            <button
                                                onClick={() => toggleCategoryCollapsed('active', group.key)}
                                                className="w-full flex items-center justify-between border-b border-border/40 pb-2 text-left"
                                            >
                                                <div className="flex items-center gap-3">
                                                    {collapsed ? <ChevronRight className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                                                    <h4 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">
                                                        {group.label}
                                                    </h4>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-muted">
                                                    <span>{summary.progress}% complete</span>
                                                </div>
                                            </button>
                                            {!collapsed && (
                                                <div className="space-y-3">
                                                    {group.projects.map(project => (
                                                        <ProjectListItem
                                                            key={project.id}
                                                            project={project}
                                                            categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                            stats={getProjectStats(project.id)}
                                                            onEdit={(p) => {
                                                                setEditingProject(p)
                                                                setIsFormOpen(true)
                                                            }}
                                                            onArchive={() => toggleArchive(project)}
                                                            onTogglePinned={() => togglePinned(project.id)}
                                                            isPinned={pinnedProjectIds.includes(project.id)}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    )
                                })
                            ) : (
                            unpinnedActiveStatusGroups.map((statusGroup) => (
                                <section key={statusGroup.key} className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                        <h3 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">
                                            {statusGroup.label}
                                        </h3>
                                        <span className="text-xs font-black uppercase tracking-widest text-text-muted">
                                            {statusGroup.projects.length}
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {statusGroup.projects.map(project => (
                                            <ProjectListItem
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                onArchive={() => toggleArchive(project)}
                                                onTogglePinned={() => togglePinned(project.id)}
                                                isPinned={pinnedProjectIds.includes(project.id)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))
                            )}
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
                                        : "space-y-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500"
                                )}>
                                    {viewMode === 'grid' ? archivedProjects.map(project => (
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
                                    )) : groupingMode === 'none' ? (
                                        archivedProjects.map(project => (
                                            <ProjectListItem
                                                key={project.id}
                                                project={project}
                                                categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                stats={getProjectStats(project.id)}
                                                onEdit={(p) => {
                                                    setEditingProject(p)
                                                    setIsFormOpen(true)
                                                }}
                                                onArchive={() => toggleArchive(project)}
                                                onTogglePinned={() => togglePinned(project.id)}
                                                isPinned={pinnedProjectIds.includes(project.id)}
                                                isArchived
                                            />
                                        ))
                                    ) : groupingMode === 'category' ? (
                                        archivedCategoryGroups.map((group) => {
                                            const summary = getGroupSummary(group.projects)
                                            const collapsed = isCategoryCollapsed('archived', group.key)
                                            return (
                                                <section key={group.key} className="space-y-3">
                                                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                                        <button
                                                            onClick={() => toggleCategoryCollapsed('archived', group.key)}
                                                            className="flex items-center gap-2 text-left"
                                                        >
                                                            {collapsed ? <ChevronRight className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                                                            <h4 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">
                                                                {group.label}
                                                            </h4>
                                                        </button>
                                                        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest text-text-muted">
                                                            <span>{summary.progress}% complete</span>
                                                        </div>
                                                    </div>
                                                    {!collapsed && (
                                                        <div className="space-y-3">
                                                            {group.projects.map(project => (
                                                                <ProjectListItem
                                                                    key={project.id}
                                                                    project={project}
                                                                    categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                                    stats={getProjectStats(project.id)}
                                                                    onEdit={(p) => {
                                                                        setEditingProject(p)
                                                                        setIsFormOpen(true)
                                                                    }}
                                                                    onArchive={() => toggleArchive(project)}
                                                                    onTogglePinned={() => togglePinned(project.id)}
                                                                    isPinned={pinnedProjectIds.includes(project.id)}
                                                                    isArchived
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </section>
                                            )
                                        })
                                    ) : archivedStatusGroups.map((statusGroup) => (
                                        <section key={statusGroup.key} className="space-y-4">
                                            <div className="flex items-center justify-between border-b border-border/40 pb-2">
                                                <h3 className="text-sm 2xl:text-base font-black uppercase tracking-widest text-text-primary">
                                                    {statusGroup.label}
                                                </h3>
                                                <span className="text-xs font-black uppercase tracking-widest text-text-muted">
                                                    {statusGroup.projects.length}
                                                </span>
                                            </div>
                                            <div className="space-y-3">
                                                {statusGroup.projects.map(project => (
                                                    <ProjectListItem
                                                        key={project.id}
                                                        project={project}
                                                        categoryName={project.category_id ? categoryMap.get(project.category_id) || null : null}
                                                        stats={getProjectStats(project.id)}
                                                        onEdit={(p) => {
                                                            setEditingProject(p)
                                                            setIsFormOpen(true)
                                                        }}
                                                        onArchive={() => toggleArchive(project)}
                                                        onTogglePinned={() => togglePinned(project.id)}
                                                        isPinned={pinnedProjectIds.includes(project.id)}
                                                        isArchived
                                                    />
                                                ))}
                                            </div>
                                        </section>
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
                defaultCategoryId={projectFormDefaultCategoryId}
                categories={categories}
                onSave={handleSave}
                onCancel={() => {
                    setIsFormOpen(false)
                    setEditingProject(undefined)
                    setProjectFormDefaultCategoryId(null)
                }}
                onDelete={async (id) => {
                    await deleteProject(id)
                    setIsFormOpen(false)
                    setEditingProject(undefined)
                    setProjectFormDefaultCategoryId(null)
                }}
            />
        </div>
    )
}

const ProjectListItem = React.memo<{
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number, lastActivityAt: string | null, lastCompletedAt: string | null },
    onEdit: (p: Project) => void,
    onArchive: () => void,
    onTogglePinned: () => void,
    isPinned?: boolean,
    isArchived?: boolean
}>(function ProjectListItem({
    project,
    categoryName,
    stats,
    onEdit,
    onArchive,
    onTogglePinned,
    isPinned = false,
    isArchived = false
}: {
    project: Project,
    categoryName: string | null,
    stats: { total: number, completed: number, progress: number, lastActivityAt: string | null, lastCompletedAt: string | null },
    onEdit: (p: Project) => void,
    onArchive: () => void,
    onTogglePinned: () => void,
    isPinned?: boolean,
    isArchived?: boolean
}) {
    const lastActivityLabel = stats.lastActivityAt
        ? new Date(stats.lastActivityAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'No activity'

    return (
        <div className="group relative flex items-center bg-surface-secondary/30 hover:bg-surface border border-border/40 hover:border-accent/40 rounded-2xl p-3 sm:p-4 transition-all hover:shadow-lg gap-3 sm:gap-6">
            <Link to={`/projects/${project.short_id || project.id}`} className="absolute inset-0 z-[5] rounded-2xl" />

            <div
                className="w-1.5 self-stretch rounded-full shrink-0"
                style={{ backgroundColor: project.color || '#7c6aff' }}
            />

            <div className="flex-1 min-w-0 pointer-events-none">
                <div className="flex items-center flex-wrap gap-2 sm:gap-3 mb-1">
                    <h3 className="text-sm sm:text-base 2xl:text-lg font-bold text-text-primary group-hover:text-accent transition-colors truncate max-w-full">
                        {project.name}
                    </h3>
                    {categoryName && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-accent/20 bg-accent/5 text-accent uppercase tracking-widest font-black">
                            {categoryName}
                        </span>
                    )}
                    <span className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full uppercase tracking-widest font-black border",
                        project.status === 'completed'
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                            : project.status === 'active'
                                ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                : "border-text-muted/20 bg-text-muted/5 text-text-muted"
                    )}>
                        {project.status === 'completed' ? 'Completed' : project.status === 'active' ? 'Active' : 'Backlog'}
                    </span>
                    {isArchived && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-text-muted/20 bg-text-muted/5 text-text-muted uppercase tracking-widest font-black">
                            Archived
                        </span>
                    )}
                    {isPinned && (
                        <span className="px-2 py-0.5 text-[10px] rounded-full border border-yellow-400/20 bg-yellow-400/10 text-yellow-300 uppercase tracking-widest font-black">
                            Pinned
                        </span>
                    )}
                </div>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] sm:text-xs text-text-muted font-medium">
                    <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                        <span>{stats.completed} / {stats.total} tasks</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="uppercase tracking-widest font-black text-[10px] text-text-muted/80">Last</span>
                        <span>{lastActivityLabel}</span>
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

            <div className="relative z-20 flex items-center gap-0.5 sm:gap-1 flex-shrink-0 pointer-events-auto">
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        onTogglePinned()
                    }}
                    className="p-1.5 sm:p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-yellow-300 transition-all"
                    title={isPinned ? 'Unpin project' : 'Pin project'}
                >
                    {isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        onArchive()
                    }}
                    className="p-1.5 sm:p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all"
                    title={isArchived ? 'Unarchive project' : 'Archive project'}
                >
                    {isArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                </button>
                <button
                    onClick={(e) => {
                        e.preventDefault()
                        onEdit(project)
                    }}
                    className="p-1.5 sm:p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all"
                >
                    <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>
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
                            <span className={cn(
                                "px-2 py-0.5 text-[10px] 2xl:text-xs rounded-full border uppercase tracking-widest font-black",
                                project.status === 'completed'
                                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
                                    : project.status === 'active'
                                        ? "border-blue-400/20 bg-blue-400/10 text-blue-300"
                                        : "border-text-muted/20 bg-text-muted/5 text-text-muted"
                            )}>
                                {project.status === 'completed' ? 'Completed' : project.status === 'active' ? 'Active' : 'Backlog'}
                            </span>
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
