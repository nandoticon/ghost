import React, { useState, useRef, useEffect } from 'react'
import { CalendarIcon, X, ChevronLeft, ChevronRight, Clock } from 'lucide-react'
import { cn } from '../lib/cn'
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    setHours,
    setMinutes,
    parseISO,
    isValid
} from 'date-fns'

interface DateTimePickerProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

export const DateTimePicker: React.FC<DateTimePickerProps> = ({
    value,
    onChange,
    placeholder = 'Set Date',
    className
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [currentMonth, setCurrentMonth] = useState(new Date())
    const [selectedDate, setSelectedDate] = useState<Date | null>(value && isValid(parseISO(value)) ? parseISO(value) : null)
    const [tempTime, setTempTime] = useState<{ hours: number, minutes: number }>(() => {
        if (value && isValid(parseISO(value))) {
            const d = parseISO(value)
            return { hours: d.getHours(), minutes: d.getMinutes() }
        }
        return { hours: 8, minutes: 0 } // Default to 8 AM
    })
    const [popoverPlacement, setPopoverPlacement] = useState<'bottom' | 'top'>('bottom')

    const triggerRef = useRef<HTMLDivElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)

    // Sync selectedDate with value prop when value changes externally
    useEffect(() => {
        if (value && isValid(parseISO(value))) {
            const d = parseISO(value)
            setSelectedDate(d)
            setTempTime({ hours: d.getHours(), minutes: d.getMinutes() })
        } else {
            setSelectedDate(null)
            setTempTime({ hours: 8, minutes: 0 })
        }
    }, [value])

    // Handle positioning and outside clicks
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)

            // Check positioning
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect()
                const spaceBelow = window.innerHeight - rect.bottom
                const neededSpace = 450 // Approximate height of picker
                if (spaceBelow < neededSpace && rect.top > neededSpace) {
                    setPopoverPlacement('top')
                } else {
                    setPopoverPlacement('bottom')
                }
            }
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const handleDateClick = (day: Date) => {
        setSelectedDate(day)
    }

    const handleApply = () => {
        if (selectedDate) {
            const result = setMinutes(setHours(selectedDate, tempTime.hours), tempTime.minutes)
            // Use local-preserving format instead of toISOString() to avoid timezone jumps
            onChange(format(result, "yyyy-MM-dd'T'HH:mm:ss"))
        }
        setIsOpen(false)
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
        setSelectedDate(null)
        setIsOpen(false)
    }

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))

    // Calendar logic
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart)
    const endDate = endOfWeek(monthEnd)
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

    const formattedValue = value ? format(parseISO(value), "MMM d, yyyy h:mm a") : ''

    return (
        <div className="relative w-full">
            <div
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative flex items-center w-full bg-surface-secondary/50 border border-border/50 rounded-xl text-sm text-text-primary focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 transition-all group hover:border-border hover:bg-surface-secondary cursor-pointer",
                    className
                )}
            >
                <CalendarIcon className="absolute left-3.5 w-4 h-4 text-text-muted group-hover:text-accent transition-colors" />

                <div className="pl-11 pr-10 py-3 w-full truncate">
                    {value ? (
                        <span className="font-semibold text-text-primary">{formattedValue}</span>
                    ) : (
                        <span className="text-text-muted font-medium">{placeholder}</span>
                    )}
                </div>

                {value && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-3.5 p-1 rounded-lg text-text-muted hover:bg-white/10 hover:text-text-primary transition-colors z-20"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className={cn(
                        "absolute left-0 right-0 md:left-auto md:right-0 md:w-[320px] bg-surface border border-border/80 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden flex flex-col",
                        popoverPlacement === 'top' ? "bottom-14 mb-2 origin-bottom" : "top-14 mt-2 origin-top"
                    )}
                >
                    {/* Calendar Header */}
                    <div className="p-4 border-b border-border/50 flex items-center justify-between bg-surface-secondary/30">
                        <span className="text-sm font-bold text-text-primary uppercase tracking-widest">
                            {format(currentMonth, 'MMMM yyyy')}
                        </span>
                        <div className="flex items-center gap-1">
                            <button onClick={prevMonth} className="p-1.5 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button onClick={nextMonth} className="p-1.5 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Weekdays */}
                    <div className="grid grid-cols-7 gap-px bg-border/20 px-2 py-2">
                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                            <div key={d} className="text-[10px] font-black text-text-muted text-center uppercase py-1">
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Days */}
                    <div className="grid grid-cols-7 gap-1 p-2">
                        {calendarDays.map((day, idx) => {
                            const isCurrentMonth = isSameMonth(day, monthStart)
                            const isSelected = selectedDate && isSameDay(day, selectedDate)
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleDateClick(day)}
                                    className={cn(
                                        "h-9 w-full rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                                        !isCurrentMonth && "text-text-muted/30 hover:text-text-muted",
                                        isCurrentMonth && "text-text-primary hover:bg-surface-secondary",
                                        isSelected && "bg-accent text-white hover:bg-accent ring-4 ring-accent/20",
                                        isToday(day) && !isSelected && "text-accent border border-accent/30"
                                    )}
                                >
                                    {format(day, 'd')}
                                </button>
                            )
                        })}
                    </div>

                    {/* Time Picker */}
                    <div className="p-4 border-t border-border/50 bg-surface-secondary/10 space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-text-muted uppercase tracking-widest">
                            <Clock className="w-3.5 h-3.5" /> Time (Defaults to 8 AM)
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-1.5 bg-surface-secondary border border-border/50 rounded-xl px-3 py-2">
                                <select
                                    className="bg-transparent text-sm font-bold text-text-primary outline-none appearance-none cursor-pointer w-full text-center"
                                    value={tempTime.hours}
                                    onChange={(e) => setTempTime(prev => ({ ...prev, hours: parseInt(e.target.value) }))}
                                >
                                    {Array.from({ length: 24 }).map((_, i) => (
                                        <option key={i} value={i} className="bg-surface text-text-primary">
                                            {i.toString().padStart(2, '0')}
                                        </option>
                                    ))}
                                </select>
                                <span className="text-text-muted font-bold">:</span>
                                <select
                                    className="bg-transparent text-sm font-bold text-text-primary outline-none appearance-none cursor-pointer w-full text-center"
                                    value={tempTime.minutes}
                                    onChange={(e) => setTempTime(prev => ({ ...prev, minutes: parseInt(e.target.value) }))}
                                >
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <option key={i * 5} value={i * 5} className="bg-surface text-text-primary">
                                            {(i * 5).toString().padStart(2, '0')}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-border/50 bg-surface-secondary/30 flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!selectedDate}
                            className="flex-2 px-6 py-2.5 bg-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-accent/20 transition-all active:scale-95"
                        >
                            Apply Selection
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
