import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ProjectCategory } from '../types'
import { useAuth } from './useAuth'

const DEFAULT_PROJECT_CATEGORIES = ['Work', 'Health', 'Home', 'Family', 'Writing']

export function useProjectCategories() {
  const [categories, setCategories] = useState<ProjectCategory[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  const fetchCategories = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('project_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (error) throw error

      const list = data || []
      if (list.length === 0) {
        const now = new Date().toISOString()
        const seed = DEFAULT_PROJECT_CATEGORIES.map((name, index) => ({
          user_id: user.id,
          name,
          sort_order: index,
          created_at: now,
          updated_at: now,
        }))

        const { data: seeded, error: seedError } = await supabase
          .from('project_categories')
          .insert(seed)
          .select('*')
          .order('sort_order', { ascending: true })

        if (seedError) throw seedError
        setCategories(seeded || [])
      } else {
        setCategories(list)
      }
    } catch (error) {
      console.error('Error fetching project categories:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  const createCategory = async (name: string) => {
    if (!user) return null

    const cleanedName = name.trim()
    if (!cleanedName) return null

    const nextSortOrder = categories.length > 0
      ? Math.max(...categories.map(c => c.sort_order || 0)) + 1
      : 0

    const now = new Date().toISOString()
    const payload = {
      user_id: user.id,
      name: cleanedName,
      sort_order: nextSortOrder,
      created_at: now,
      updated_at: now,
    }

    const { data, error } = await supabase
      .from('project_categories')
      .insert([payload])
      .select('*')
      .single()

    if (error) {
      console.error('Error creating category:', error)
      throw error
    }

    setCategories(prev => [...prev, data])
    return data
  }

  const updateCategory = async (id: string, name: string) => {
    const cleanedName = name.trim()
    if (!cleanedName) return

    const { error } = await supabase
      .from('project_categories')
      .update({ name: cleanedName, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('Error updating category:', error)
      throw error
    }

    setCategories(prev => prev.map(c => (c.id === id ? { ...c, name: cleanedName } : c)))
  }

  const deleteCategory = async (id: string) => {
    if (!user) return

    const { error: unlinkError } = await supabase
      .from('projects')
      .update({ category_id: null, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('category_id', id)

    if (unlinkError) {
      console.error('Error unlinking projects from category:', unlinkError)
      throw unlinkError
    }

    const { error } = await supabase
      .from('project_categories')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting category:', error)
      throw error
    }

    setCategories(prev => prev.filter(c => c.id !== id))
  }

  return {
    categories,
    loading,
    createCategory,
    updateCategory,
    deleteCategory,
    refresh: fetchCategories,
  }
}
