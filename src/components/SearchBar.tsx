import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Task } from '../types'
import { cn } from '../lib/cn'

function highlightMatch(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text
    const idx = text.toLowerCase().indexOf(query.toLowerCase())
    if (idx === -1) return text
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-accent/20 text-accent rounded px-0.5 not-italic font-semibold">
                {text.slice(idx, idx + query.length)}
            </mark>
            {text.slice(idx + query.length)}
        </>
    )
}

interface SearchBarProps {
    onTaskClick: (taskId: string, shortId?: string | null) => void
}

export function SearchBar({ onTaskClick }: SearchBarProps) {
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<Task[]>([])
    const [loading, setLoading] = useState(false)
    const [isOpen, setIsOpen] = useState(false)
    const [selectedIndex, setSelectedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!query.trim()) {
                setResults([])
                return
            }

            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from('tasks')
                    .select(`
                        *,
                        project:projects(
                            *,
                            category:project_categories(id,name)
                        )
                    `)
                    .ilike('title', `%${query}%`)
                    .limit(5)

                if (error) throw error
                setResults(data || [])
                setIsOpen(true)
                setSelectedIndex(-1)
            } catch (error) {
                console.error('Search error:', error)
            } finally {
                setLoading(false)
            }
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    const selectResult = (task: Task) => {
        onTaskClick(task.id, task.short_id)
        setIsOpen(false)
        setQuery('')
        setSelectedIndex(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || results.length === 0) {
            if (e.key === 'Escape') {
                setQuery('')
                setIsOpen(false)
                    ; (e.target as HTMLInputElement).blur()
            }
            return
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0))
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1))
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && selectedIndex < results.length) {
                    selectResult(results[selectedIndex])
                }
                break
            case 'Escape':
                e.preventDefault()
                setIsOpen(false)
                setQuery('')
                    ; (e.target as HTMLInputElement).blur()
                break
        }
    }

    return (
        <div className="relative px-4 mb-6" ref={containerRef}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                    id="global-search-input"
                    type="text"
                    placeholder="Search tasks..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.trim() && setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    className="w-full bg-surface-secondary border border-border rounded-xl pl-10 pr-10 py-2 text-xs text-text-primary placeholder-text-muted outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/50 transition-all"
                />
                {query && (
                    <button
                        onClick={() => {
                            setQuery('')
                            setResults([])
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                        {loading ? (
                            <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin" />
                        ) : (
                            <X className="w-3.5 h-3.5 text-text-muted hover:text-text-primary transition-colors" />
                        )}
                    </button>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && query.trim() && (
                <div className="absolute left-4 right-4 mt-2 bg-surface border border-border rounded-xl shadow-2xl z-50 py-2 animate-in slide-in-from-top-2 duration-200">
                    {results.length > 0 ? (
                        results.map((task, index) => (
                            <button
                                key={task.id}
                                onClick={() => selectResult(task)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                className={cn(
                                    "w-full text-left px-4 py-2 transition-colors",
                                    index === selectedIndex ? "bg-accent/10" : "hover:bg-surface-secondary"
                                )}
                            >
                                <div className="flex items-center space-x-2">
                                    <div
                                        className="w-1.5 h-1.5 rounded-full shrink-0"
                                        style={{ backgroundColor: task.project?.color || '#7c6aff' }}
                                    />
                                    <span className="text-xs font-medium text-text-primary line-clamp-1">
                                        {highlightMatch(task.title, query)}
                                    </span>
                                </div>
                                {task.project && (
                                    <span className="text-[10px] text-text-muted ml-3.5">{task.project.name}</span>
                                )}
                            </button>
                        ))
                    ) : !loading ? (
                        <div className="px-4 py-2 text-[10px] text-text-muted uppercase tracking-widest font-bold">
                            No results found
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    )
}
