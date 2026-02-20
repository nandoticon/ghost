import React, { useRef, useEffect } from 'react'
import { CheckCircle2, Circle, Clock, Loader2 } from 'lucide-react'
import { cn } from '../lib/cn'
import { Task } from '../types'

interface StatusMenuProps {
    isOpen: boolean
    onClose: () => void
    currentStatus: Task['status']
    onSelect: (status: Task['status']) => void
    triggerRef: React.RefObject<HTMLElement | null>
}

export const StatusOptions = [
    { value: 'todo', label: 'To-do', icon: Circle, color: 'text-text-muted', bg: 'bg-surface-secondary' },
    { value: 'doing', label: 'Doing', icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { value: 'waiting', label: 'Waiting', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { value: 'done', label: 'Done', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
] as const

export const StatusMenu: React.FC<StatusMenuProps> = ({
    isOpen,
    onClose,
    currentStatus,
    onSelect,
    triggerRef
}) => {
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                menuRef.current &&
                !menuRef.current.contains(event.target as Node) &&
                triggerRef.current &&
                !triggerRef.current.contains(event.target as Node)
            ) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.addEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose, triggerRef])

    if (!isOpen) return null

    // Position popover relatively to trigger logic not needed if absolute positioning used in parent, but good to have a portal here generally. 
    // We will assume parent container is relative.

    return (
        <div
            ref={menuRef}
            className="absolute left-0 top-full mt-2 w-48 bg-surface border border-border/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-xl z-50 animate-in fade-in zoom-in-95 duration-200 p-1"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-text-muted border-b border-border/50 mb-1">
                Set Status
            </div>
            {StatusOptions.map(opt => {
                const Icon = opt.icon
                const isActive = currentStatus === opt.value
                return (
                    <button
                        key={opt.value}
                        onClick={() => {
                            onSelect(opt.value as Task['status'])
                            onClose()
                        }}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors group",
                            isActive ? "bg-accent/10 text-accent font-medium" : "text-text-primary hover:bg-surface-secondary"
                        )}
                    >
                        <div className={cn("p-1 rounded-md transition-colors", isActive ? opt.bg : "bg-transparent group-hover:bg-surface")}>
                            <Icon className={cn("w-3.5 h-3.5", isActive ? opt.color : "text-text-muted")} />
                        </div>
                        {opt.label}
                    </button>
                )
            })}
        </div>
    )
}
