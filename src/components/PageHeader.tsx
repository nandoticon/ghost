import React from 'react'
import { cn } from '../lib/cn'

interface PageHeaderProps {
    title: string
    subtitle?: string
    actions?: React.ReactNode
    compact?: boolean
    subtitleStyle?: 'caps' | 'body'
    className?: string
}

export function PageHeader({ title, subtitle, actions, compact = false, subtitleStyle = 'caps', className }: PageHeaderProps) {
    return (
        <header
            className={cn(
                compact
                    ? 'flex items-center justify-between gap-3 sm:gap-4 flex-wrap'
                    : 'flex items-end justify-between gap-4 md:gap-6 flex-wrap border-b border-border/40 pb-5 md:pb-8',
                className
            )}
        >
            <div className="space-y-2">
                <h1 className={cn(
                    compact
                        ? 'text-3xl sm:text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl'
                        : 'text-3xl sm:text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl',
                    'font-black tracking-tightest title-gradient'
                )}>
                    {title}
                </h1>
                {subtitle && (
                    <p className={cn(
                        subtitleStyle === 'caps'
                            ? cn(compact ? 'text-xs sm:text-sm' : 'text-[11px] sm:text-sm 2xl:text-base', 'font-heavy uppercase tracking-widest')
                            : cn(compact ? 'text-xs sm:text-sm md:text-base' : 'text-sm md:text-base', 'font-medium tracking-normal'),
                        'text-text-muted'
                    )}>
                        {subtitle}
                    </p>
                )}
            </div>
            {actions ? <div className="flex items-center gap-2 sm:gap-4">{actions}</div> : null}
        </header>
    )
}
