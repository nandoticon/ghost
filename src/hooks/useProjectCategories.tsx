/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { ProjectCategory } from '../types'
import { useAuth } from './useAuth'

const DEFAULT_PROJECT_CATEGORIES = ['Work', 'Health', 'Home', 'Family', 'Writing']

interface ProjectCategoriesContextType {
    categories: ProjectCategory[]
    loading: boolean
    createCategory: (name: string) => Promise<ProjectCategory | null>
    updateCategory: (id: string, name: string) => Promise<void>
    deleteCategory: (id: string) => Promise<void>
    refresh: () => Promise<void>
}

const ProjectCategoriesContext = createContext<ProjectCategoriesContextType | undefined>(undefined)

export function ProjectCategoriesProvider({ children }: { children: ReactNode }) {
    const [categories, setCategories] = useState<ProjectCategory[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()
    const userId = user?.id ?? null
    const seedAttemptedRef = useRef(false)

    const seedDefaultsIfNeeded = useCallback(async (userId: string) => {
        if (seedAttemptedRef.current) return
        seedAttemptedRef.current = true

        for (const [index, name] of DEFAULT_PROJECT_CATEGORIES.entries()) {
            await supabase
                .from('project_categories')
                .insert({
                    user_id: userId,
                    name,
                    sort_order: index,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
        }
    }, [])

    const fetchCategories = useCallback(async () => {
        if (!userId) {
            setCategories([])
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('project_categories')
                .select('*')
                .eq('user_id', userId)
                .order('sort_order', { ascending: true })

            if (error) throw error

            const list = data || []
            if (list.length === 0) {
                await seedDefaultsIfNeeded(userId)
                const seeded = await supabase
                    .from('project_categories')
                    .select('*')
                    .eq('user_id', userId)
                    .order('sort_order', { ascending: true })
                if (seeded.error) throw seeded.error
                setCategories(seeded.data || [])
            } else {
                setCategories(list)
            }
        } catch (error) {
            console.error('Error fetching project categories:', error)
        } finally {
            setLoading(false)
        }
    }, [userId, seedDefaultsIfNeeded])

    useEffect(() => {
        seedAttemptedRef.current = false
        void fetchCategories()
    }, [fetchCategories])

    const createCategory = useCallback(async (name: string) => {
        if (!userId) return null
        const cleanedName = name.trim()
        if (!cleanedName) return null

        const tempId = crypto.randomUUID()
        const nextSortOrder = categories.length > 0
            ? Math.max(...categories.map(c => c.sort_order || 0)) + 1
            : 0

        const now = new Date().toISOString()
        const optimisticCategory: ProjectCategory = {
            id: tempId,
            user_id: userId,
            name: cleanedName,
            sort_order: nextSortOrder,
            created_at: now,
            updated_at: now,
        }

        setCategories(prev => [...prev, optimisticCategory])

        try {
            const { data, error } = await supabase
                .from('project_categories')
                .insert([{
                    user_id: userId,
                    name: cleanedName,
                    sort_order: nextSortOrder,
                }])
                .select('*')
                .single()

            if (error) throw error

            setCategories(prev => prev.map(c => (c.id === tempId ? data : c)))
            return data
        } catch (error) {
            console.error('Error creating category:', error)
            setCategories(prev => prev.filter(c => c.id !== tempId))
            throw error
        }
    }, [userId, categories])

    const updateCategory = useCallback(async (id: string, name: string) => {
        const cleanedName = name.trim()
        if (!cleanedName) return

        const previousCategories = [...categories]
        setCategories(prev => prev.map(c => (c.id === id ? { ...c, name: cleanedName } : c)))

        try {
            const { error } = await supabase
                .from('project_categories')
                .update({ name: cleanedName, updated_at: new Date().toISOString() })
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error updating category:', error)
            setCategories(previousCategories)
            throw error
        }
    }, [categories])

    const deleteCategory = useCallback(async (id: string) => {
        if (!userId) return
        const previousCategories = [...categories]
        setCategories(prev => prev.filter(c => c.id !== id))

        try {
            const { error: unlinkError } = await supabase
                .from('projects')
                .update({ category_id: null, updated_at: new Date().toISOString() })
                .eq('user_id', userId)
                .eq('category_id', id)

            if (unlinkError) throw unlinkError

            const { error } = await supabase
                .from('project_categories')
                .delete()
                .eq('id', id)

            if (error) throw error
        } catch (error) {
            console.error('Error deleting category:', error)
            setCategories(previousCategories)
            throw error
        }
    }, [userId, categories])

    const value = useMemo<ProjectCategoriesContextType>(() => ({
        categories,
        loading,
        createCategory,
        updateCategory,
        deleteCategory,
        refresh: fetchCategories,
    }), [categories, loading, createCategory, updateCategory, deleteCategory, fetchCategories])

    return <ProjectCategoriesContext.Provider value={value}>{children}</ProjectCategoriesContext.Provider>
}

export function useProjectCategories() {
    const context = useContext(ProjectCategoriesContext)
    if (!context) {
        throw new Error('useProjectCategories must be used within a ProjectCategoriesProvider')
    }
    return context
}

