import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Calendar, CheckSquare, Folder, LogOut, Search as SearchIcon, HelpCircle, Settings as SettingsIcon, Plus, Ghost, MoreHorizontal, BarChart3 } from 'lucide-react'
import { cn } from '../lib/cn'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { QuickCapture } from './QuickCapture'
import { SearchBar } from './SearchBar'
import { TaskDetail } from './TaskDetail'
import { ThemeSwitcher } from './ThemeSwitcher'
import { KeyboardShortcutsModal } from './KeyboardShortcutsModal'
import { OfflineBanner } from './OfflineBanner'
import { InstallPrompt } from './InstallPrompt'
import { PWAUpdateNotification } from './PWAUpdateNotification'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useShortcutContext } from '../context/ShortcutContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useTimer } from '../context/TimerContext'
import { useToast } from './Toast'
import { prefetchRoute } from '../lib/routePrefetch'

export default function Layout() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const {
        isModalOpen,
        isQuickCaptureOpen,
        setQuickCaptureOpen,
        activeTaskId,
        setActiveTaskId,
        setModalOpen
    } = useShortcutContext()

    useKeyboardShortcuts()

    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
    const location = useLocation()
    const { lastError } = useTimer()
    const { showToast } = useToast()
    const lastShownTimerError = useRef<string | null>(null)

    useEffect(() => {
        if (!lastError) return
        if (lastShownTimerError.current === lastError) return

        showToast(lastError, 'info', undefined, 3500)
        lastShownTimerError.current = lastError
    }, [lastError, showToast])

    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key !== 'Escape') return

        // If a modal is open, let the modal or useModalA11y handle the escape key.
        // We only handle global UI elements that don't have their own focus trap/escape handler.
        if (isModalOpen || activeTaskId || isQuickCaptureOpen) return

        if (isMobileSearchOpen) {
            e.preventDefault()
            setIsMobileSearchOpen(false)
            return
        }
        if (isAccountMenuOpen) {
            e.preventDefault()
            setIsAccountMenuOpen(false)
        }
    }, [isModalOpen, activeTaskId, isQuickCaptureOpen, isMobileSearchOpen, isAccountMenuOpen])

    useEffect(() => {
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [handleEscape])

    const navItems = [
        { to: '/today', icon: Calendar, label: 'Today' },
        { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { to: '/projects', icon: Folder, label: 'Projects' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    ]

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    const initials = user?.email
        ? user.email.slice(0, 2).toUpperCase()
        : '?'
    const accountName = user?.email?.split('@')[0] || 'User'

    return (
        <div className="flex tablet:grid tablet:grid-cols-[250px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)] 4k:grid-cols-[380px_minmax(0,1fr)] h-[100dvh] min-h-0 w-full max-w-full bg-background overflow-hidden text-text-primary relative">
            <div className="absolute inset-0 pointer-events-none opacity-25">
                <div className="relative w-full h-full surface-texture" />
            </div>
            <aside className="hidden tablet:flex w-[250px] 2xl:w-[320px] 4k:w-[380px] flex-col border-r border-border bg-surface shrink-0 relative overflow-hidden surface-texture">
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent/60 to-transparent" />
                <div className="px-6 pt-8 pb-6 2xl:px-8">
                    <div className="flex items-center gap-2">
                        <Ghost className="w-7 h-7 text-accent opacity-90" />
                        <h1 className="text-3xl 2xl:text-4xl font-black tracking-tightest text-text-primary select-none">
                            Ghost
                        </h1>
                    </div>
                    <p className="text-xs 2xl:text-sm font-black uppercase tracking-widest text-text-muted/50 mt-1">Task Manager</p>
                </div>

                <div className="px-4 2xl:px-5 mb-4">
                    <SearchBar onTaskClick={(id) => {
                        setActiveTaskId(id)
                    }} />
                </div>

                <div className="px-4 2xl:px-5 mb-2">
                    <p className="text-xs 2xl:text-sm font-black uppercase tracking-widest text-text-muted/40">Navigation</p>
                </div>
                <nav className="flex-1 px-3 2xl:px-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            onMouseEnter={() => prefetchRoute(item.to)}
                            onFocus={() => prefetchRoute(item.to)}
                            className={() =>
                                cn(
                                    "flex items-center space-x-3 px-3 py-2.5 2xl:py-3 rounded-xl transition-all text-sm 2xl:text-base font-semibold",
                                    location.pathname.startsWith(item.to)
                                        ? "bg-accent/10 text-accent"
                                        : "text-text-muted hover:text-text-primary hover:bg-surface-secondary"
                                )
                            }
                        >
                            <item.icon className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px] shrink-0" />
                            <span>{item.label}</span>
                            {location.pathname.startsWith(item.to) && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                            )}
                        </NavLink>
                    ))}

                    <div className="pt-4 pb-2 px-2">
                        <div className="h-px bg-border/50" />
                        <p className="text-xs 2xl:text-sm font-black uppercase tracking-widest text-text-muted/40 mt-3">Quick Actions</p>
                    </div>

                    <button
                        onClick={() => {
                            setQuickCaptureOpen(true)
                        }}
                        className="flex items-center justify-between w-full px-3 py-2.5 2xl:py-3 rounded-xl text-sm 2xl:text-base font-semibold text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all group"
                    >
                        <span className="flex items-center space-x-3">
                            <Plus className="w-4 h-4 2xl:w-[18px] 2xl:h-[18px] shrink-0" />
                            <span>New Task</span>
                        </span>
                        <kbd className="text-xs 2xl:text-sm bg-surface-secondary px-1.5 py-0.5 rounded border border-border font-sans opacity-40 group-hover:opacity-80 transition-opacity">N</kbd>
                    </button>
                </nav>

                {user && (
                    <div className="p-4 2xl:p-5 border-t border-border">
                        <div className="flex items-center justify-between px-1 mb-3">
                            <div className="flex items-center space-x-3 min-w-0">
                                <div className="w-10 h-10 2xl:w-11 2xl:h-11 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 shadow-inner">
                                    <span className="text-sm 2xl:text-base font-black text-accent">{initials}</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs 2xl:text-sm uppercase font-black tracking-widest text-text-muted">Account</p>
                                    <p className="text-sm 2xl:text-base font-semibold text-text-primary truncate">{accountName}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/40 px-1 relative">
                            <ThemeSwitcher />
                            <div className="w-10 h-10 2xl:w-11 2xl:h-11 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 shadow-inner">
                                <button
                                    onClick={() => setIsAccountMenuOpen((prev) => !prev)}
                                    className="w-full h-full flex items-center justify-center rounded-full text-text-muted hover:text-text-primary hover:bg-surface-secondary/70 transition-all"
                                    title="Account menu"
                                    aria-label="Open account menu"
                                    aria-haspopup="menu"
                                    aria-expanded={isAccountMenuOpen}
                                >
                                    < MoreHorizontal className="w-5 h-5 2xl:w-6 2xl:h-6" />
                                </button>
                            </div>

                            {isAccountMenuOpen && (
                                <>
                                    <button
                                        className="fixed inset-0 z-40"
                                        aria-label="Close account menu"
                                        onClick={() => setIsAccountMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 bottom-14 z-50 w-56 bg-surface border border-border rounded-2xl shadow-2xl p-2 animate-in zoom-in-95 duration-150">
                                        <button
                                            onClick={() => {
                                                setIsAccountMenuOpen(false)
                                                navigate('/settings')
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
                                        >
                                            <SettingsIcon className="w-4 h-4" />
                                            <span>Settings</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsAccountMenuOpen(false)
                                                setModalOpen(true)
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
                                        >
                                            <HelpCircle className="w-4 h-4" />
                                            <span>Keyboard Shortcuts</span>
                                        </button>
                                        <div className="my-1 h-px bg-border/60" />
                                        <button
                                            onClick={() => {
                                                setIsAccountMenuOpen(false)
                                                handleSignOut()
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <LogOut className="w-4 h-4" />
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </aside>

            <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full relative">
                <header className="tablet:hidden flex items-center justify-between px-5 h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-surface/70 backdrop-blur-md border-b border-border sticky top-0 z-40">
                    <h1 className="text-xl font-black tracking-tightest text-text-primary">Ghost</h1>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => navigate('/settings')}
                            className="touch-target flex items-center justify-center p-2 hover:bg-surface-secondary rounded-xl text-text-muted transition-colors"
                            aria-label="Open settings"
                            title="Settings"
                        >
                            <SettingsIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                            className="touch-target flex items-center justify-center p-2 hover:bg-surface-secondary rounded-xl text-text-muted transition-colors"
                            aria-label="Search tasks"
                            title="Search"
                        >
                            <SearchIcon className="w-5 h-5" />
                        </button>
                    </div>
                    {isMobileSearchOpen && (
                        <div className="absolute top-[calc(3.5rem+env(safe-area-inset-top))] left-0 right-0 bg-surface border-b border-border p-4 animate-in slide-in-from-top duration-200 z-50">
                            <SearchBar onTaskClick={(id) => {
                                setActiveTaskId(id)
                                setIsMobileSearchOpen(false)
                            }} />
                        </div>
                    )}
                </header>

                <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 tablet:p-5 xl:p-7 2xl:p-12 4k:p-14 pb-[calc(5.75rem+env(safe-area-inset-bottom))] tablet:pb-9 relative">
                    <div
                        key={location.pathname}
                        className="w-full max-w-full min-w-0 4k:max-w-[1600px] 4k:mx-auto animate-in fade-in duration-200"
                    >
                        <Outlet />
                    </div>
                </main>

                <nav
                    className="tablet:hidden fixed inset-x-0 bottom-0 z-50 bg-surface border-t border-border h-[calc(4.35rem+env(safe-area-inset-bottom))] pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
                    aria-label="Bottom navigation"
                >
                    <div className="flex h-full items-end">
                        {navItems.slice(0, 2).map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onMouseEnter={() => prefetchRoute(item.to)}
                                onFocus={() => prefetchRoute(item.to)}
                                className={({ isActive }) =>
                                    cn(
                                        "flex-1 flex justify-center transition-colors relative",
                                        isActive ? "text-accent" : "text-text-muted"
                                    )
                                }
                                aria-label={item.label}
                            >
                                {({ isActive }) => (
                                    <span className={cn(
                                        "touch-target flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl transition-all min-w-[56px]",
                                        isActive ? "bg-accent/10" : ""
                                    )}>
                                        <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                                        <span className="text-[13px] font-bold">{item.to === '/today' ? 'Today' : item.label}</span>
                                    </span>
                                )}
                            </NavLink>
                        ))}

                        <div className="flex-none px-1.5 pb-0.5">
                            <button
                                onClick={() => {
                                    setQuickCaptureOpen(true)
                                }}
                                className="touch-target w-[3.25rem] h-[3.25rem] bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-all"
                                aria-label="Quick add task"
                                title="Quick add task"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        {navItems.slice(2).map((item) => (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                onMouseEnter={() => prefetchRoute(item.to)}
                                onFocus={() => prefetchRoute(item.to)}
                                className={({ isActive }) =>
                                    cn(
                                        "flex-1 flex justify-center transition-colors relative",
                                        isActive ? "text-accent" : "text-text-muted"
                                    )
                                }
                                aria-label={item.label}
                            >
                                {({ isActive }) => (
                                    <span className={cn(
                                        "touch-target flex flex-col items-center justify-center gap-1 px-2 py-1 rounded-xl transition-all min-w-[56px]",
                                        isActive ? "bg-accent/10" : ""
                                    )}>
                                        <item.icon className={cn("w-5 h-5", isActive && "fill-current")} />
                                        <span className="text-[13px] font-bold">{item.label}</span>
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </div>
                </nav>

                {/* Overlays */}
                <QuickCapture
                    isOpen={isQuickCaptureOpen}
                    onClose={() => {
                        setQuickCaptureOpen(false)
                    }}
                />
                <TaskDetail
                    taskId={activeTaskId}
                    onClose={() => {
                        setActiveTaskId(null)
                    }}
                />
                <KeyboardShortcutsModal />
                <OfflineBanner />
                <InstallPrompt />
                <PWAUpdateNotification />
            </div>
        </div>
    )
}
