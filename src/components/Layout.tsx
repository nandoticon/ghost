import { NavLink, useNavigate, Outlet, useLocation } from 'react-router-dom'
import { Calendar, CheckSquare, Folder, LogOut, Search as SearchIcon, HelpCircle, Settings as SettingsIcon, Plus } from 'lucide-react'
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
import { useState } from 'react'
import { useShortcutContext } from '../context/ShortcutContext'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

export default function Layout() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const {
        isQuickCaptureOpen,
        setQuickCaptureOpen,
        activeTaskId,
        setActiveTaskId,
        setModalOpen
    } = useShortcutContext()

    // Initialize global keyboard shortcuts
    useKeyboardShortcuts()

    const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false)
    const location = useLocation()

    const navItems = [
        { to: '/today', icon: Calendar, label: 'Today' },
        { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
        { to: '/projects', icon: Folder, label: 'Projects' },
    ]

    const handleSignOut = async () => {
        await supabase.auth.signOut()
        navigate('/login')
    }

    return (
        <div className="flex h-[100dvh] bg-background overflow-hidden text-text-primary">
            {/* Sidebar - Hidden on mobile */}
            <aside className="hidden md:flex w-[280px] xl:w-[320px] 4k:w-[400px] flex-col border-r border-border bg-surface/30 overflow-x-hidden shrink-0">
                <div className="p-6 xl:p-8">
                    <h1 className="text-2xl xl:text-3xl font-bold tracking-tighter text-text-primary">Ghost</h1>
                </div>

                <SearchBar onTaskClick={(id) => setActiveTaskId(id)} />

                <nav className="flex-1 px-3 xl:px-4 space-y-1 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={() =>
                                cn(
                                    "flex items-center space-x-3 px-4 py-3 xl:py-3.5 rounded transition-all text-sm xl:text-base font-medium",
                                    location.pathname.startsWith(item.to)
                                        ? "bg-accent/10 text-accent border-l-2 border-accent -ml-4 pl-4"
                                        : "text-text-muted hover:text-text-primary hover:bg-surface/50"
                                )
                            }
                        >
                            <item.icon className="w-4 h-4 xl:w-5 xl:h-5 shrink-0" />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}

                    <button
                        onClick={() => setQuickCaptureOpen(true)}
                        className="flex items-center justify-between w-full px-4 py-3 xl:py-3.5 rounded text-sm xl:text-base font-medium text-text-muted hover:text-text-primary hover:bg-surface/50 transition-all mt-4 group"
                    >
                        <span className="flex items-center space-x-3">
                            <Plus className="w-4 h-4 xl:w-5 xl:h-5 shrink-0" />
                            <span>New Task</span>
                        </span>
                        <kbd className="text-[10px] xl:text-xs bg-surface-secondary px-1.5 py-0.5 rounded border border-border font-sans opacity-50 group-hover:opacity-100 transition-opacity">N</kbd>
                    </button>
                </nav>

                {user && (
                    <div className="p-4 border-t border-border space-y-2 overflow-x-hidden">
                        <div className="px-4 py-2">
                            <p className="text-[10px] xl:text-xs uppercase font-bold tracking-widest text-text-muted">User</p>
                            <p className="text-xs xl:text-sm font-medium truncate text-text-primary">{user.email}</p>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="flex w-full items-center space-x-3 px-4 py-2.5 text-sm xl:text-base text-text-muted hover:text-red-400 transition-colors"
                        >
                            <LogOut className="w-4 h-4 xl:w-5 xl:h-5 shrink-0" />
                            <span>Sign Out</span>
                        </button>

                        <div className="px-4 py-2 mt-2 border-t border-border/30 pt-4 flex items-center justify-between">
                            <ThemeSwitcher />
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="p-2 xl:p-2.5 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95 group relative"
                                    title="Settings"
                                >
                                    <SettingsIcon className="w-4 h-4 xl:w-5 xl:h-5" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-border rounded text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                        Settings
                                    </span>
                                </button>
                                <button
                                    onClick={() => setModalOpen(true)}
                                    className="p-2 xl:p-2.5 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95 group relative"
                                    title="Keyboard shortcuts (?)"
                                >
                                    <HelpCircle className="w-4 h-4 xl:w-5 xl:h-5" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-border rounded text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                        Shortcuts (?)
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
                {/* Mobile Top Bar */}
                <header className="md:hidden flex items-center justify-between px-6 h-16 bg-surface/50 backdrop-blur-md border-b border-border sticky top-0 z-40">
                    <h1 className="text-xl font-bold tracking-tighter text-text-primary">Ghost</h1>
                    <button
                        onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                        className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted transition-colors"
                    >
                        <SearchIcon className="w-5 h-5" />
                    </button>
                    {isMobileSearchOpen && (
                        <div className="absolute top-16 left-0 right-0 bg-surface border-b border-border p-4 animate-in slide-in-from-top duration-200">
                            <SearchBar onTaskClick={(id) => {
                                setActiveTaskId(id)
                                setIsMobileSearchOpen(false)
                            }} />
                        </div>
                    )}
                </header>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 xl:p-12 pb-24 md:pb-8">
                    <div
                        key={location.pathname}
                        className="max-w-[860px] xl:max-w-[1100px] 4k:max-w-[1500px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                        <Outlet />
                    </div>
                </main>

                {/* Bottom Nav - Mobile Only */}
                <nav className="md:hidden flex items-center justify-around bg-surface/90 backdrop-blur border-t border-border fixed bottom-0 left-0 right-0 h-16 px-4 z-50">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex flex-col items-center space-y-1 transition-colors",
                                    isActive ? "text-accent" : "text-text-muted"
                                )
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="text-[10px] font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
                {/* Overlays */}
                <QuickCapture
                    isOpen={isQuickCaptureOpen}
                    onClose={() => setQuickCaptureOpen(false)}
                />
                <TaskDetail
                    taskId={activeTaskId}
                    onClose={() => setActiveTaskId(null)}
                />
                <KeyboardShortcutsModal />
                <OfflineBanner />
                <InstallPrompt />
                <PWAUpdateNotification />
            </div>
        </div>
    )
}
