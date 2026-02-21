import { useState } from 'react'
import { cn } from '../lib/cn'

type SyncState = 'syncing' | 'synced' | 'error'

const COPY: Record<SyncState, string> = {
    syncing: 'Syncing',
    synced: 'Synced',
    error: 'Not synced',
}

const DOT_STYLES: Record<SyncState, string> = {
    syncing: 'bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.6)] animate-pulse',
    synced: 'bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.45)]',
    error: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
}

interface SyncStatusDotProps {
    state?: SyncState
    className?: string
    sizeClassName?: string
}

export function SyncStatusDot({ state = 'synced', className, sizeClassName = 'w-2.5 h-2.5' }: SyncStatusDotProps) {
    const [open, setOpen] = useState(false)
    const label = COPY[state]

    return (
        <button
            type="button"
            className={cn('relative inline-flex items-center justify-center p-1 rounded-full', className)}
            onClick={(e) => {
                e.stopPropagation()
                setOpen(v => !v)
            }}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onBlur={() => setOpen(false)}
            title={label}
            aria-label={label}
        >
            <span className={cn('rounded-full', sizeClassName, DOT_STYLES[state])} />
            {open && (
                <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-wider font-black text-white bg-black/90 border border-white/10 rounded-md px-2 py-1 z-50">
                    {label}
                </span>
            )}
        </button>
    )
}
