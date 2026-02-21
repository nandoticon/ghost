import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Profile } from '../types'
import { useAuth } from './useAuth'

export function useProfile() {
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchProfile = useCallback(async () => {
        if (!user) {
            setProfile(null)
            setLoading(false)
            return
        }

        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .maybeSingle()

            if (error) {
                console.error('Error fetching profile:', error)
            } else {
                setProfile(data)
            }
        } catch (error) {
            console.error('Unexpected error fetching profile:', error)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        fetchProfile()
    }, [fetchProfile])

    const updateProfile = async (updates: Partial<Profile>) => {
        if (!user) return

        try {
            const { data, error } = await supabase
                .from('profiles')
                .upsert({
                    id: user.id,
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .select()
                .maybeSingle()

            if (error) throw error
            setProfile(data)
            return data
        } catch (error) {
            console.error('Error updating profile:', error)
            throw error
        }
    }

    return {
        profile,
        loading,
        updateProfile,
        refresh: fetchProfile
    }
}
