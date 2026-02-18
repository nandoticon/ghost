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

        const maxSortOrder = projects.length > 0
            ? Math.max(...projects.map(p => p.sort_order || 0)) + 1
            : 0

        const newProject = {
            ...project,
            user_id: user.id,
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
    }

    const updateProject = async (id: string, updates: Partial<Project>) => {
        const { error } = await supabase
            .from('projects')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) {
            console.error('Error updating project:', error)
        } else {
            setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
        }
    }

    const deleteProject = async (id: string) => {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id)

        if (error) {
            console.error('Error deleting project:', error)
        } else {
            setProjects(prev => prev.filter(p => p.id !== id))
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
