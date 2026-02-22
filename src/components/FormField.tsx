import React from 'react'
import { cn } from '../lib/cn'

export function FieldLabel({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <label className={cn('text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1', className)}>
            {children}
        </label>
    )
}

export const fieldBaseClass =
    'w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-text-primary focus:border-accent/50 outline-none transition-all'

export const fieldInputClass = `${fieldBaseClass} text-base sm:text-sm`
export const fieldInputClassMd = `${fieldBaseClass} text-base md:text-sm`
export const fieldSelectClass = `${fieldBaseClass} text-base sm:text-sm cursor-pointer`
export const fieldTextareaClass = `${fieldBaseClass} resize-none`

