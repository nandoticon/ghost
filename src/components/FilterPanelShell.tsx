import React from 'react'
import { cn } from '../lib/cn'

interface FilterPanelShellProps {
    children: React.ReactNode
    className?: string
}

export function FilterPanelShell({ children, className }: FilterPanelShellProps) {
    return (
        <div className={cn('space-y-3 bg-surface-secondary/25 border border-border/40 rounded-2xl p-3 sm:p-4', className)}>
            {children}
        </div>
    )
}

