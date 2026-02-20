import React, { useEffect, useState } from 'react'
import { X, CheckCircle2, Clock, Zap, Target, Layers, Home, MapPin } from 'lucide-react'
import { Task } from '../types'
import { cn } from '../lib/cn'

interface FocusModeProps {
    task: Task
    onClose: () => void
    onComplete: (id: string, completed: boolean) => void
}

export const FocusMode: React.FC<FocusModeProps> = ({ task, onClose, onComplete }) => {
    const [currentTime, setCurrentTime] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000)
        // Prevent scrolling on the body when focus mode is active
        document.body.style.overflow = 'hidden'

        return () => {
            clearInterval(timer)
            document.body.style.overflow = 'unset'
        }
    }, [])

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center animate-in fade-in duration-500 overflow-hidden">
            {/* Ambient Animated Background */}
            <div className="absolute inset-0 bg-black/90" />
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vw] h-[100vh] bg-accent/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute top-0 right-0 w-[40vw] h-[40vh] bg-accent-warm/5 blur-[100px] rounded-full" />
            </div>

            {/* Header / Controls */}
            <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
                <div className="flex flex-col">
                    <span className="text-xl 2xl:text-2xl font-black text-white/90 tabular-nums">
                        {formatTime(currentTime)}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-text-muted">
                        Ambient Focus
                    </span>
                </div>
                <button
                    onClick={onClose}
                    className="p-3 rounded-full bg-white/5 border border-white/10 text-text-muted hover:text-white hover:bg-white/10 transition-all hover:scale-110 active:scale-95 group"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Main Content */}
            <div className="relative z-10 w-full max-w-4xl px-8 flex flex-col items-center text-center space-y-12 translate-y-[-5%]">
                <div className="space-y-4">
                    {task.project && (
                        <div className="flex items-center justify-center space-x-2">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: task.project.color || 'var(--color-accent)' }}
                            />
                            <span className="text-sm md:text-base uppercase tracking-[0.2em] font-heavy text-white/40">
                                {task.project.name}
                            </span>
                        </div>
                    )}
                    <h1 className="text-5xl md:text-7xl 2xl:text-8xl font-black tracking-tightest leading-tight text-white drop-shadow-2xl">
                        {task.title}
                    </h1>
                    {task.notes && (
                        <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto font-medium leading-relaxed">
                            {task.notes}
                        </p>
                    )}
                </div>

                {/* Context Badges */}
                <div className="flex flex-wrap justify-center gap-4">
                    {task.energy && (
                        <ContextBadge
                            icon={task.energy === 'high' ? <Zap className="w-4 h-4" /> : <Zap className="w-4 h-4 opacity-50" />}
                            label={`${task.energy} energy`}
                            color="text-accent-warm"
                        />
                    )}
                    {task.focus && (
                        <ContextBadge
                            icon={task.focus === 'immersion' ? <Target className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                            label={`${task.focus} focus`}
                            color="text-blue-400"
                        />
                    )}
                    {task.location && (
                        <ContextBadge
                            icon={task.location === 'home' ? <Home className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                            label={task.location}
                            color="text-green-400"
                        />
                    )}
                    {task.estimated_effort && (
                        <ContextBadge
                            icon={<Clock className="w-4 h-4" />}
                            label={`${task.estimated_effort}m estimated`}
                            color="text-white/60"
                        />
                    )}
                </div>

                {/* Action Button */}
                <div className="pt-12">
                    <button
                        onClick={() => {
                            onComplete(task.id, true)
                            onClose()
                        }}
                        className="group relative flex items-center space-x-4 px-10 py-5 bg-accent hover:bg-accent/90 text-white rounded-full text-xl md:text-2xl font-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(var(--color-accent-rgb),0.3)]"
                    >
                        <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" />
                        <span>Mark as Complete</span>
                        <div className="absolute inset-0 rounded-full bg-white/20 scale-0 group-hover:scale-105 transition-transform duration-500 opacity-0 group-active:opacity-100" />
                    </button>
                    <p className="mt-6 text-white/30 text-sm font-bold uppercase tracking-widest animate-pulse">
                        Settle in · Focus · Finish
                    </p>
                </div>
            </div>

            {/* Bottom Meta */}
            <div className="absolute bottom-12 text-white/10 flex flex-col items-center">
                <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/20 mb-4" />
                <span className="text-[10px] uppercase tracking-[0.4em] font-black">
                    Ghost Deep Work Engine
                </span>
            </div>
        </div>
    )
}

const ContextBadge: React.FC<{ icon: React.ReactNode, label: string, color: string }> = ({ icon, label, color }) => (
    <div className={cn(
        "flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md",
        color
    )}>
        {icon}
        <span className="text-sm font-black uppercase tracking-widest">{label}</span>
    </div>
)
