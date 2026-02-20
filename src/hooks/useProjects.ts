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
        fetchProjects()
    }, [fetchProjects])

    const createProject = useCallback(async (project: Partial<Project>) => {
        if (!user) return null

        const currentProjects = projectsRef.current

        const maxSortOrder = currentProjects.length > 0
            ? Math.max(...currentProjects.map(p => p.sort_order || 0)) + 1
            : 0

        const baseProject = {
            ...project,
            user_id: user.id,
            category_id: project.category_id ?? null,
            sort_order: maxSortOrder,
            archived: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }
        const optimisticProject = { ...baseProject, sync_state: 'syncing' as const }

        const tempId = `temp-${Math.random().toString(36).slice(2, 10)}`
        setProjects(prev => [...prev, { ...optimisticProject, id: tempId } as Project])

        const { data, error } = await supabase
            .from('projects')
            .insert([baseProject])
            .select('id,user_id,name,description,color,category_id,sort_order,archived,short_id,created_at,updated_at')
            .single()

        if (error) {
            console.error('Error creating project:', error)
            setProjects(prev => prev.map(p => p.id === tempId ? { ...p, sync_state: 'error' } : p))
            return null
        }

        setProjects(prev => prev.map(p => (p.id === tempId ? { ...data, sync_state: 'synced' } : p)))
        return data
    }, [user])

    const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
        const snapshot = projectsRef.current
        const optimisticUpdatedAt = new Date().toISOString()
        const dbUpdates = { ...updates }
        delete dbUpdates.sync_state

        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates, updated_at: optimisticUpdatedAt, sync_state: 'syncing' } : p))

        const { error } = await supabase
            .from('projects')
            .update({ ...dbUpdates, updated_at: optimisticUpdatedAt })
            .eq('id', id)

        if (error) {
            console.error('Error updating project:', error)
            setProjects(snapshot.map(p => p.id === id ? { ...p, sync_state: 'error' } : p))
            return
        }
        setProjects(prev => prev.map(p => p.id === id ? { ...p, sync_state: 'synced' } : p))
    }, [])

    const deleteProject = useCallback(async (id: string) => {
        const snapshot = projectsRef.current
        setProjects(prev => prev.filter(p => p.id !== id))

        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting project:', error)
            setProjects(snapshot)
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
