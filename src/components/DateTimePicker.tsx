import React, { useRef } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { cn } from '../lib/cn'
import { format } from 'date-fns'

interface DateTimePickerProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
    type?: 'date' | 'datetime-local'
    ariaLabel?: string
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    value,
    onChange,
    placeholder = 'Set Date',
    className,
    type = 'datetime-local',
    ariaLabel
}) => {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        onChange('')
    }

    const openPicker = () => {
        const input = inputRef.current
        if (!input) return

        if (typeof HTMLInputElement !== 'undefined' && 'showPicker' in HTMLInputElement.prototype) {
            try {
                input.showPicker()
                return
            } catch (_err) {
                // fall through
            }
        }

        input.focus()
        input.click()
    }

    const parsedDate = (() => {
        if (!value) return null
        if (type === 'date') {
            const [y, m, d] = value.split('-').map(Number)
            if (!y || !m || !d) return null
            return new Date(y, m - 1, d, 12, 0, 0)
        }
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? null : date
    })()

    const formattedValue = parsedDate ? format(parsedDate, type === 'date' ? "MMM d, yyyy" : "MMM d, yyyy h:mm a") : ''

    return (
        <div
            className={cn(
                "relative flex items-center w-full min-h-[46px] bg-surface-secondary/80 border border-border rounded-xl text-base md:text-sm text-text-primary focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all group hover:border-border/80",
                className
            )}
            role="button"
            tabIndex={0}
            aria-label={ariaLabel ?? placeholder}
            onClick={openPicker}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    openPicker()
                }
            }}
        >
            <CalendarIcon className="absolute left-3.5 w-4 h-4 text-text-muted group-hover:text-accent transition-colors pointer-events-none" />

            {/* Invisible native input keeps browser date/time pickers and accessibility */}
            <input
                ref={inputRef}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="native-picker-input absolute inset-0 w-full h-full opacity-0 pointer-events-none"
                aria-hidden="true"
                tabIndex={-1}
            />

            {/* Visual overlay */}
            <div className="pl-11 pr-10 py-2.5 w-full truncate pointer-events-none">
                {value ? (
                    <span className="font-semibold text-text-primary">{formattedValue}</span>
                ) : (
                    <span className="text-text-muted/90">{placeholder}</span>
                )}
            </div>

            {/* Clear Button */}
            {value && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="touch-target absolute right-2.5 rounded-md text-text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-text-primary transition-colors z-20 cursor-pointer inline-flex items-center justify-center"
                    aria-label="Clear date value"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    )
}
