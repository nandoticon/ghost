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
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    value,
    onChange,
    placeholder = 'Set Date',
    className,
    type = 'datetime-local'
}) => {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        onChange('')
    }

    const formattedValue = value ? format(new Date(value), type === 'date' ? "MMM d, yyyy" : "MMM d, yyyy h:mm a") : ''

    return (
        <div
            className={cn(
                "relative flex items-center w-full bg-surface-secondary border border-border rounded-lg text-sm text-text-primary focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all group hover:border-border/80",
                className
            )}
        >
            <CalendarIcon className="absolute left-3 w-4 h-4 text-text-muted group-hover:text-accent transition-colors pointer-events-none" />

            {/* The invisible native input */}
            <input
                ref={inputRef}
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                onClick={(e) => {
                    if (typeof HTMLInputElement !== 'undefined' && 'showPicker' in HTMLInputElement.prototype) {
                        try {
                            e.preventDefault();
                            e.currentTarget.showPicker();
                        } catch (_err) {
                            // ignore
                        }
                    }
                }}
            />

            {/* Visual overlay */}
            <div className="pl-10 pr-10 py-2.5 w-full truncate pointer-events-none">
                {value ? (
                    <span className="font-medium text-text-primary">{formattedValue}</span>
                ) : (
                    <span className="text-text-muted">{placeholder}</span>
                )}
            </div>

            {/* Clear Button */}
            {value && (
                <button
                    type="button"
                    onClick={handleClear}
                    className="absolute right-3 p-1 rounded-md text-text-muted hover:bg-black/5 dark:hover:bg-white/10 hover:text-text-primary transition-colors z-20 cursor-pointer"
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    )
}
