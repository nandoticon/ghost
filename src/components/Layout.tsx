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

    // Derive user initials for avatar
    const initials = user?.email
        ? user.email.slice(0, 2).toUpperCase()
        : '?'

    return (
        <div className="flex h-[100dvh] bg-background overflow-hidden text-text-primary">
            {/* Sidebar — Hidden on mobile */}
            <aside className="hidden tablet:flex w-[260px] xl:w-[290px] 4k:w-[360px] flex-col border-r border-border bg-surface shrink-0 relative overflow-hidden">
                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-accent via-accent/60 to-transparent" />

                {/* Brand */}
                <div className="px-6 pt-8 pb-6 xl:px-7">
                    <h1 className="text-2xl xl:text-3xl font-black tracking-tightest text-text-primary select-none">
                        Ghost
                    </h1>
                </div>

                {/* Search */}
                <div className="px-3 xl:px-4 mb-3">
                    <SearchBar onTaskClick={(id) => setActiveTaskId(id)} />
                </div>

                {/* Nav */}
                <nav className="flex-1 px-3 xl:px-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={() =>
                                cn(
                                    "flex items-center space-x-3 px-3 py-2.5 xl:py-3 rounded-xl transition-all text-sm xl:text-base font-semibold",
                                    location.pathname.startsWith(item.to)
                                        ? "bg-accent/10 text-accent"
                                        : "text-text-muted hover:text-text-primary hover:bg-surface-secondary"
                                )
                            }
                        >
                            <item.icon className="w-4 h-4 xl:w-[18px] xl:h-[18px] shrink-0" />
                            <span>{item.label}</span>
                            {location.pathname.startsWith(item.to) && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent" />
                            )}
                        </NavLink>
                    ))}

                    {/* Divider */}
                    <div className="pt-3 pb-1">
                        <div className="h-px bg-border/50 mx-2" />
                    </div>

                    {/* New Task */}
                    <button
                        onClick={() => setQuickCaptureOpen(true)}
                        className="flex items-center justify-between w-full px-3 py-2.5 xl:py-3 rounded-xl text-sm xl:text-base font-semibold text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all group"
                    >
                        <span className="flex items-center space-x-3">
                            <Plus className="w-4 h-4 xl:w-[18px] xl:h-[18px] shrink-0" />
                            <span>New Task</span>
                        </span>
                        <kbd className="text-[10px] xl:text-xs bg-surface-secondary px-1.5 py-0.5 rounded border border-border font-sans opacity-40 group-hover:opacity-80 transition-opacity">N</kbd>
                    </button>
                </nav>

                {/* Bottom user section */}
                {user && (
                    <div className="p-4 xl:p-5 border-t border-border">
                        {/* User identity */}
                        <div className="flex items-center space-x-3 px-1 mb-3">
                            <div className="w-8 h-8 xl:w-9 xl:h-9 rounded-full bg-accent/15 border border-accent/20 flex items-center justify-center shrink-0">
                                <span className="text-[11px] xl:text-xs font-black text-accent">{initials}</span>
                            </div>
                            <div className="min-w-0">
                                <p className="text-[9px] xl:text-[10px] uppercase font-black tracking-widest text-text-muted">Account</p>
                                <p className="text-xs xl:text-sm font-semibold truncate text-text-primary">{user.email}</p>
                            </div>
                        </div>

                        {/* Sign out */}
                        <button
                            onClick={handleSignOut}
                            className="flex w-full items-center space-x-2.5 px-3 py-2 text-sm xl:text-base text-text-muted hover:text-red-400 rounded-xl hover:bg-red-400/5 transition-all"
                        >
                            <LogOut className="w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0" />
                            <span className="text-sm font-semibold">Sign Out</span>
                        </button>

                        {/* Footer tools */}
                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/40 px-1">
                            <ThemeSwitcher />
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => navigate('/settings')}
                                    className="p-2 xl:p-2.5 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95 group relative"
                                    title="Settings"
                                >
                                    <SettingsIcon className="w-4 h-4 xl:w-[18px] xl:h-[18px]" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-border rounded text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                        Settings
                                    </span>
                                </button>
                                <button
                                    onClick={() => setModalOpen(true)}
                                    className="p-2 xl:p-2.5 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95 group relative"
                                    title="Keyboard shortcuts (?)"
                                >
                                    <HelpCircle className="w-4 h-4 xl:w-[18px] xl:h-[18px]" />
                                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface border border-border rounded text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                                        Shortcuts (?)
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </aside>

            {/* Main content area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative">
                {/* Mobile Top Bar */}
                <header className="tablet:hidden flex items-center justify-between px-5 h-14 bg-surface/70 backdrop-blur-md border-b border-border sticky top-0 z-40">
                    <h1 className="text-xl font-black tracking-tightest text-text-primary">Ghost</h1>
                    <button
                        onClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
                        className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted transition-colors"
                    >
                        <SearchIcon className="w-5 h-5" />
                    </button>
                    {isMobileSearchOpen && (
                        <div className="absolute top-14 left-0 right-0 bg-surface border-b border-border p-4 animate-in slide-in-from-top duration-200 z-50">
                            <SearchBar onTaskClick={(id) => {
                                setActiveTaskId(id)
                                setIsMobileSearchOpen(false)
                            }} />
                        </div>
                    )}
                </header>

                {/* Page Content — fluid width */}
                <main className="flex-1 overflow-y-auto p-4 tablet:p-8 xl:p-12 pb-24 tablet:pb-10">
                    <div
                        key={location.pathname}
                        className="w-full max-w-[clamp(540px,80%,1320px)] 4k:max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-200"
                    >
                        <Outlet />
                    </div>
                </main>

                {/* Bottom Nav — Mobile only */}
                <nav className="tablet:hidden flex items-center bg-surface/95 backdrop-blur border-t border-border fixed bottom-0 left-0 right-0 z-50">
                    {/* Left nav items */}
                    {navItems.slice(0, 1).map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex-1 flex flex-col items-center py-3 space-y-1 transition-colors",
                                    isActive ? "text-accent" : "text-text-muted"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className={cn("w-5 h-5", isActive && "fill-accent/20")} />
                                    <span className="text-[10px] font-bold">{item.to === '/today' ? 'Today' : item.label}</span>
                                    {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />}
                                </>
                            )}
                        </NavLink>
                    ))}

                    {/* Center FAB */}
                    <div className="flex-none px-4">
                        <button
                            onClick={() => setQuickCaptureOpen(true)}
                            className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Right nav items */}
                    {navItems.slice(1).map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    "flex-1 flex flex-col items-center py-3 space-y-1 transition-colors relative",
                                    isActive ? "text-accent" : "text-text-muted"
                                )
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon className={cn("w-5 h-5")} />
                                    <span className="text-[10px] font-bold">{item.label}</span>
                                    {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-accent" />}
                                </>
                            )}
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
