import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Project } from '../types'
import { useAuth } from './useAuth'

interface ProjectsContextType {
    projects: Project[]
    loading: boolean
    createProject: (project: Partial<Project>) => Promise<Project | null>
    updateProject: (id: string, updates: Partial<Project>) => Promise<void>
    deleteProject: (id: string) => Promise<void>
    refresh: () => Promise<void>
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined)

export function ProjectsProvider({ children }: { children: ReactNode }) {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchProjects = useCallback(async () => {
        if (!user) {
            setLoading(false)
            setProjects([])
            return
        }
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id,user_id,name,description,color,category_id,sort_order,archived,short_id,created_at,updated_at')
                .eq('user_id', user.id)
                .order('sort_order', { ascending: true })

            if (error) throw error
            setProjects(data || [])
        } catch (error) {
            console.error('Error fetching projects:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        void fetchProjects()
    }, [fetchProjects])

    const createProject = useCallback(async (project: Partial<Project>) => {
        if (!user) return null
        const tempId = crypto.randomUUID()
        const maxSortOrder = projects.length > 0
            ? Math.max(...projects.map(p => p.sort_order || 0)) + 1
            : 0

        const optimisticProject: Project = {
            id: tempId,
            name: project.name || 'Untitled Project',
            description: project.description || '',
            color: project.color || '#7c6aff',
            user_id: user.id,
            category_id: project.category_id ?? null,
            sort_order: maxSortOrder,
            archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        } as Project

        setProjects(prev => [...prev, optimisticProject])

        try {
            const { data, error } = await supabase
                .from('projects')
                .insert([{
                    ...project,
                    user_id: user.id,
                    sort_order: maxSortOrder,
                    archived: false
                }])
                .select()
                .single()

            if (error) throw error

            setProjects(prev => prev.map(p => p.id === tempId ? data : p))
            return data
        } catch (error) {
            console.error('Error creating project:', error)
            setProjects(prev => prev.filter(p => p.id !== tempId))
            return null
        }
    }, [user, projects])

    const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
        const previousProjects = [...projects]
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

        try {
            const { error } = await supabase
                .from('projects')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error updating project:', error)
            setProjects(previousProjects)
        }
    }, [projects])

    const deleteProject = useCallback(async (id: string) => {
        const previousProjects = [...projects]
        setProjects(prev => prev.filter(p => p.id !== id))

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting project:', error)
            setProjects(previousProjects)
        }
    }, [projects])

    const value = useMemo<ProjectsContextType>(() => ({
        projects,
        loading,
        createProject,
        updateProject,
        deleteProject,
        refresh: fetchProjects
    }), [projects, loading, createProject, updateProject, deleteProject, fetchProjects])

    return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>
}

export function useProjects() {
    const context = useContext(ProjectsContext)
    if (!context) {
        throw new Error('useProjects must be used within a ProjectsProvider')
    }
    return context
}
