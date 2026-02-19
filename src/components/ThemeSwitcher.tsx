import { Sun, Moon } from 'lucide-react'
import { useThemeContext } from './ThemeProvider'
import { cn } from '../lib/cn'

export function ThemeSwitcher() {
    const { resolvedTheme, setTheme } = useThemeContext()
    const isDark = resolvedTheme === 'dark'
    const Icon = isDark ? Sun : Moon

    return (
        <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={cn(
                "inline-flex items-center gap-2 px-3 py-2 rounded-xl border transition-all group",
                "bg-surface-secondary/50 border-border/50 text-text-muted hover:text-text-primary hover:bg-surface-secondary"
            )}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <Icon className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
                {isDark ? 'Light' : 'Dark'}
            </span>
        </button>
    )
}
