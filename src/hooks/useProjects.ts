import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Project } from '../types'
import { useAuth } from './useAuth'

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const projectsRef = useRef<Project[]>([])

    useEffect(() => {
        projectsRef.current = projects
    }, [projects])

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

    const createProject = useCallback(async (project: Partial<Project>) => {
        if (!user) return

        const currentProjects = projectsRef.current

        const maxSortOrder = currentProjects.length > 0
            ? Math.max(...currentProjects.map(p => p.sort_order || 0)) + 1
            : 0

        const newProject = {
            ...project,
            user_id: user.id,
            category_id: project.category_id ?? null,
            sort_order: maxSortOrder,
            archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        const { data, error } = await supabase
            .from('projects')
            .insert([newProject])
            .select()
            .single()

        if (error) {
            console.error('Error creating project:', error)
            return null
        }

        setProjects(prev => [...prev, data])
        return data
    }, [user])

    const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
        const { error } = await supabase
            .from('projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error updating project:', error)
        } else {
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
        }
    }, [])

    const deleteProject = useCallback(async (id: string) => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting project:', error)
        } else {
            setProjects(prev => prev.filter(p => p.id !== id))
        }
    }, [])

    return {
        projects,
        loading,
        createProject,
        updateProject,
        deleteProject,
        refresh: fetchProjects
    }
}
