import { useState, useMemo, useEffect, useCallback } from 'react'
import { X, Zap, ZapOff, Home, MapPin, Sparkles, RefreshCw, Play, Target, Layers } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { Task } from '../types'
import { cn } from '../lib/cn'
import { useShortcutContext } from '../context/ShortcutContext'

interface SuggestTaskModalProps {
    isOpen: boolean
    onClose: () => void
}

export const SuggestTaskModal = ({ isOpen, onClose }: SuggestTaskModalProps) => {
    const { tasks } = useTasks({ status: 'todo' }) // Get all todo tasks
    const { setActiveTaskId } = useShortcutContext()

    const [step, setStep] = useState<'questions' | 'suggestion'>('questions')
    const [energy, setEnergy] = useState<'high' | 'low' | null>(null)
    const [location, setLocation] = useState<'home' | 'outside' | null>(null)
    const [focus, setFocus] = useState<'immersion' | 'process' | null>(null)
    const [suggestedTasks, setSuggestedTasks] = useState<Task[]>([])
    const [previousSuggestions, setPreviousSuggestions] = useState<string[]>([])

    const matchingTasks = useMemo(() => {
        return tasks.filter(t => {
            if (energy && t.energy !== energy) return false
            if (location && t.location !== location) return false
            if (focus && t.focus !== focus) return false
            return true
        })
    }, [tasks, energy, location, focus])

    const handleReset = useCallback(() => {
        setStep('questions')
        setEnergy(null)
        setLocation(null)
        setFocus(null)
        setSuggestedTasks([])
        setPreviousSuggestions([])
    }, [])

    useEffect(() => {
        if (!isOpen && step === 'suggestion' && suggestedTasks.length === 0) {
            handleReset()
        }
    }, [isOpen, step, suggestedTasks.length, handleReset])

    const handleSuggest = () => {
        if (matchingTasks.length === 0) {
            setSuggestedTasks([])
            setStep('suggestion')
            return
        }

        let pool = matchingTasks.filter(t => !previousSuggestions.includes(t.id))

        if (pool.length === 0) {
            pool = matchingTasks
            setPreviousSuggestions([])
        }

        const shuffled = [...pool].sort(() => 0.5 - Math.random())
        const chosen = shuffled.slice(0, 3)

        setSuggestedTasks(chosen)
        setPreviousSuggestions(prev => [...prev, ...chosen.map(t => t.id)])
        setStep('suggestion')
    }

    const openTask = (task: Task) => {
        setActiveTaskId(task.id, task.short_id)
        onClose()
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in" onClick={onClose} />

            <div className="relative bg-surface border border-border/50 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-purple-500 to-accent-warm" />

                <div className="p-6 md:p-8 space-y-8">
                    <header className="flex items-start justify-between">
                        <div>
                            <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-accent-warm" />
                                Magic Suggestion
                            </h2>
                            <p className="text-sm text-text-muted mt-1">Let's find the perfect task for right now.</p>
                        </div>
                        <button onClick={onClose} className="touch-target flex items-center justify-center p-2 -mr-2 text-text-muted hover:text-white transition-colors rounded-xl hover:bg-surface-secondary/60">
                            <X className="w-5 h-5" />
                        </button>
                    </header>

                    {step === 'questions' ? (
                        <div className="space-y-6 animate-in slide-in-from-right-4">
                            {/* Energy Selection */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase font-bold tracking-widest text-text-muted">How's your energy?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setEnergy(energy === 'high' ? null : 'high')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            energy === 'high' ? "border-accent-warm bg-accent-warm/10 text-accent-warm" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <Zap className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">High Energy</span>
                                    </button>
                                    <button
                                        onClick={() => setEnergy(energy === 'low' ? null : 'low')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            energy === 'low' ? "border-blue-400 bg-blue-400/10 text-blue-400" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <ZapOff className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">Low Energy</span>
                                    </button>
                                </div>
                            </div>

                            {/* Location Selection */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase font-bold tracking-widest text-text-muted">Where are you?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setLocation(location === 'home' ? null : 'home')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            location === 'home' ? "border-accent bg-accent/10 text-accent" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <Home className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">At Home</span>
                                    </button>
                                    <button
                                        onClick={() => setLocation(location === 'outside' ? null : 'outside')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            location === 'outside' ? "border-purple-400 bg-purple-400/10 text-purple-400" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <MapPin className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">Outside</span>
                                    </button>
                                </div>
                            </div>

                            {/* Focus Selection */}
                            <div className="space-y-3">
                                <label className="text-xs uppercase font-bold tracking-widest text-text-muted">What kind of focus?</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setFocus(focus === 'immersion' ? null : 'immersion')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            focus === 'immersion' ? "border-orange-400 bg-orange-400/10 text-orange-400" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <Target className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">Immersion</span>
                                    </button>
                                    <button
                                        onClick={() => setFocus(focus === 'process' ? null : 'process')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all",
                                            focus === 'process' ? "border-green-400 bg-green-400/10 text-green-400" : "border-border/50 hover:border-border text-text-muted hover:text-white"
                                        )}
                                    >
                                        <Layers className="w-8 h-8 mb-2" />
                                        <span className="font-bold text-sm">Process</span>
                                    </button>
                                </div>
                            </div>

                            <button
                                onClick={handleSuggest}
                                className="w-full py-4 px-6 bg-accent hover:bg-accent/90 text-white rounded-2xl font-black text-lg shadow-lg shadow-accent/20 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <Sparkles className="w-5 h-5" />
                                Show Me What To Do
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-left-4">
                            {suggestedTasks.length > 0 ? (
                                <div className="space-y-6">
                                    <div className="text-center space-y-1">
                                        <p className="text-xs uppercase font-bold tracking-widest text-text-muted">Your Missions</p>
                                        <h3 className="text-xl font-black text-white">Pick one to start</h3>
                                    </div>

                                    <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                                        {suggestedTasks.map(task => (
                                            <div key={task.id} className="p-4 bg-surface-secondary/50 rounded-2xl border border-border/50 text-left space-y-3 hover:bg-surface-secondary transition-colors group">
                                                <div>
                                                    <h4 className="text-[17px] font-black tracking-tight text-white leading-tight mb-1">{task.title}</h4>
                                                    {task.project && (
                                                        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-accent bg-accent/10 px-2 py-0.5 rounded-full">
                                                            {task.project.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => openTask(task)}
                                                    className="w-full py-2.5 px-4 bg-accent hover:bg-accent/90 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-accent/20"
                                                >
                                                    <Play className="w-4 h-4 fill-current" />
                                                    Let's Do It
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <button
                                            onClick={handleSuggest}
                                            className="py-3 px-4 bg-surface-secondary hover:bg-surface-secondary/80 text-white rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Reroll
                                        </button>
                                        <button
                                            onClick={handleReset}
                                            className="py-3 px-4 border border-border/50 hover:bg-surface-secondary/50 text-text-muted hover:text-white rounded-2xl font-bold text-sm transition-all active:scale-95"
                                        >
                                            Change Filters
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center space-y-4">
                                    <div className="w-16 h-16 mx-auto bg-surface-secondary rounded-full flex items-center justify-center">
                                        <Sparkles className="w-8 h-8 text-text-muted" />
                                    </div>
                                    <h3 className="text-xl font-bold text-white">No perfect matches</h3>
                                    <p className="text-text-muted">We couldn't find any active tasks matching those exact conditions.</p>
                                    <button
                                        onClick={handleReset}
                                        className="mt-4 px-6 py-2 bg-surface-secondary hover:bg-surface-secondary/80 text-white rounded-xl font-bold transition-all active:scale-95"
                                    >
                                        Try Different Filters
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
