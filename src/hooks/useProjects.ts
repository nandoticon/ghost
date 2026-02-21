import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Project } from '../types'
import { useAuth } from './useAuth'

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchProjects = useCallback(async () => {
        if (!user) {
            setLoading(false)
            return
        }
        setLoading(true)

        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
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
        fetchProjects()
    }, [fetchProjects])

    const createProject = async (project: Partial<Project>) => {
        if (!user) return
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
            updated_at: new Date().toISOString(),
            ...project
        } as Project

        // Optimistic Update
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

            // Swap temp ID with real one
            setProjects(prev => prev.map(p => p.id === tempId ? data : p))
            return data
        } catch (error) {
            console.error('Error creating project:', error)
            setProjects(prev => prev.filter(p => p.id !== tempId)) // Rollback
            return null
        }
    }

    const updateProject = async (id: string, updates: Partial<Project>) => {
        const previousProjects = [...projects]

        // Optimistic Update
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))

        try {
            const { error } = await supabase
                .from('projects')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error updating project:', error)
            setProjects(previousProjects) // Rollback
        }
    }

    const deleteProject = async (id: string) => {
        const previousProjects = [...projects]

        // Optimistic Update
        setProjects(prev => prev.filter(p => p.id !== id))

        try {
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting project:', error)
            setProjects(previousProjects) // Rollback
        }
    }

    return {
        projects,
        loading,
        createProject,
        updateProject,
        deleteProject,
        refresh: fetchProjects
    }
}
