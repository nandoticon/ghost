import React, { createContext, useContext, useState, useCallback } from 'react'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '../lib/cn'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
    undoAction?: () => void
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, undoAction?: () => void, duration?: number) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])


    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const showToast = useCallback((message: string, type: ToastType = 'info', undoAction?: () => void, duration = 3000) => {
        const id = Math.random().toString(36).substring(2, 9)
        setToasts(prev => [...prev, { id, message, type, undoAction }].slice(-3)) // Limit to 3 toasts

        setTimeout(() => {
            removeToast(id)
        }, duration)
    }, [removeToast])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center space-y-3 pointer-events-none max-h-screen overflow-visible">
                {toasts.map((toast, index) => (
                    <div
                        key={toast.id}
                        className={cn(
                            "flex items-center space-x-3 px-6 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl pointer-events-auto max-w-[90vw] md:max-w-md transition-all duration-300 transform-gpu",
                            "animate-in slide-in-from-bottom-4 fade-in",
                            toast.type === 'success' && "bg-accent/10 border-accent/20 text-accent",
                            toast.type === 'error' && "bg-red-500/10 border-red-500/20 text-red-500",
                            toast.type === 'info' && "bg-surface-secondary/90 border-border text-text-primary",
                            // Subtle scale down for older toasts (stack effect)
                            index < toasts.length - 1 && "scale-95 opacity-80"
                        )}
                        style={{
                            zIndex: 100 + index
                        }}
                    >
                        {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                        {toast.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0" />}
                        {toast.type === 'info' && <Info className="w-5 h-5 shrink-0" />}

                        <span className="text-sm font-medium truncate">{toast.message}</span>

                        {toast.undoAction && (
                            <button
                                onClick={() => {
                                    toast.undoAction?.()
                                    removeToast(toast.id)
                                }}
                                className="ml-2 px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                            >
                                Undo
                            </button>
                        )}

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const context = useContext(ToastContext)
    if (!context) throw new Error('useToast must be used within ToastProvider')
    return context
}
