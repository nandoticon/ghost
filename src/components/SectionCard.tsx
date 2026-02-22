import React from 'react'
import { cn } from '../lib/cn'

interface SectionCardProps {
    children: React.ReactNode
    className?: string
    tone?: 'surface' | 'muted'
    compact?: boolean
}

export function SectionCard({ children, className, tone = 'surface', compact = false }: SectionCardProps) {
    return (
        <section
            className={cn(
                tone === 'surface'
                    ? 'bg-surface border border-border rounded-2xl sm:rounded-3xl'
                    : 'bg-surface-secondary/20 border border-border/40 rounded-2xl',
                compact ? 'p-3 sm:p-4' : 'p-4 sm:p-8',
                className
            )}
        >
            {children}
        </section>
    )
}

