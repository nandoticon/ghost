import { useState, useEffect, useCallback } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export function useTheme() {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('ghost-theme') as Theme) || 'system'
        }
        return 'system'
    })

    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

    const applyTheme = useCallback((t: Theme) => {
        const root = window.document.documentElement
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

        const isDark = t === 'dark' || (t === 'system' && prefersDark)

        if (isDark) {
            root.classList.add('dark')
            setResolvedTheme('dark')
        } else {
            root.classList.remove('dark')
            setResolvedTheme('light')
        }

        localStorage.setItem('ghost-theme', t)
    }, [])

    const setTheme = useCallback((t: Theme) => {
        setThemeState(t)
        applyTheme(t)
    }, [applyTheme])

    useEffect(() => {
        applyTheme(theme)

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const handleChange = () => applyTheme('system')

            mediaQuery.addEventListener('change', handleChange)
            return () => mediaQuery.removeEventListener('change', handleChange)
        }
    }, [theme, applyTheme])

    return { theme, resolvedTheme, setTheme }
}
