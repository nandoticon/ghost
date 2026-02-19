import { Sun, Moon, Monitor, Sparkles, MoonStar } from 'lucide-react'
import { useThemeContext } from './ThemeProvider'
import { cn } from '../lib/cn'

export function ThemeSwitcher() {
    const { theme, setTheme } = useThemeContext()

    const options = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'system', icon: Monitor, label: 'System' },
        { value: 'dark', icon: Moon, label: 'Dark' },
    ] as const

    return (
        <div className="flex items-center gap-1 bg-surface-secondary/50 p-1 rounded-xl border border-border/50">
            <Sparkles className="w-3.5 h-3.5 text-accent-warm/80 ml-1" />
            {options.map((opt) => {
                const Icon = opt.icon
                const isActive = theme === opt.value

                return (
                    <button
                        key={opt.value}
                        onClick={() => setTheme(opt.value)}
                        className={cn(
                            "flex-1 flex items-center justify-center p-2 rounded-lg transition-all relative group",
                            isActive
                                ? "bg-surface shadow-sm text-accent"
                                : "text-text-muted hover:text-text-primary hover:bg-surface-secondary"
                        )}
                        title={opt.label}
                    >
                        <Icon className="w-4 h-4 relative z-10" />
                        {/* Tooltip */}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-border rounded-md text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {opt.label}
                        </span>
                    </button>
                )
            })}
            <MoonStar className="w-3.5 h-3.5 text-accent/80 mr-1" />
        </div>
    )
}
