import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock3, Pause, Grip } from 'lucide-react'
import { useTimer } from '../context/TimerContext'
import { useTaskById } from '../hooks/useTaskById'
import { cn } from '../lib/cn'
import { useShortcutContext } from '../context/ShortcutContext'

type CornerAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const STORAGE_KEY = 'ghost.timer.floating-pill.anchor'

const CORNER_STYLE: Record<CornerAnchor, string> = {
    'top-left': 'top-[calc(0.75rem+env(safe-area-inset-top))] left-[calc(0.75rem+env(safe-area-inset-left))]',
    'top-right': 'top-[calc(0.75rem+env(safe-area-inset-top))] right-[calc(0.75rem+env(safe-area-inset-right))]',
    'bottom-left': 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] tablet:bottom-4 left-[calc(0.75rem+env(safe-area-inset-left))]',
    'bottom-right': 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))] tablet:bottom-4 right-[calc(0.75rem+env(safe-area-inset-right))]',
}

function formatElapsed(seconds: number) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function FloatingTimerPill() {
    const { activeSession, elapsedSeconds, stopTimer, isSyncing } = useTimer()
    const taskId = activeSession?.task_id ?? null
    const { task } = useTaskById(taskId)
    const { setActiveTaskId } = useShortcutContext()

    const [anchor, setAnchor] = useState<CornerAnchor>(() => {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw === 'top-left' || raw === 'top-right' || raw === 'bottom-left' || raw === 'bottom-right') {
            return raw
        }
        return 'bottom-right'
    })
    const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
    const [isDragging, setIsDragging] = useState(false)

    const pillRef = useRef<HTMLDivElement | null>(null)
    const pointerIdRef = useRef<number | null>(null)
    const pointerOffsetRef = useRef({ x: 0, y: 0 })
    const dragMovedRef = useRef(false)
    const suppressClickUntilRef = useRef(0)

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, anchor)
    }, [anchor])

    useEffect(() => {
        if (!activeSession) {
            setDragPosition(null)
            setIsDragging(false)
            pointerIdRef.current = null
        }
    }, [activeSession])

    const title = useMemo(() => {
        if (!taskId) return 'Focus timer'
        return task?.title?.trim() || 'Focus timer'
    }, [taskId, task?.title])

    if (!activeSession) return null

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('[data-pill-stop]')) return
        if ((e.target as HTMLElement).closest('[data-pill-open]')) return

        const rect = pillRef.current?.getBoundingClientRect()
        if (!rect) return

        pointerIdRef.current = e.pointerId
        pointerOffsetRef.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        }
        dragMovedRef.current = false
        setIsDragging(true)
        setDragPosition({ x: rect.left, y: rect.top })
        pillRef.current?.setPointerCapture(e.pointerId)
    }

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging || pointerIdRef.current !== e.pointerId) return
        const next = {
            x: e.clientX - pointerOffsetRef.current.x,
            y: e.clientY - pointerOffsetRef.current.y,
        }
        if (dragPosition && (Math.abs(next.x - dragPosition.x) > 2 || Math.abs(next.y - dragPosition.y) > 2)) {
            dragMovedRef.current = true
        }
        setDragPosition(next)
    }

    const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
        if (pointerIdRef.current !== e.pointerId) return

        const rect = pillRef.current?.getBoundingClientRect()
        const centerX = rect ? rect.left + rect.width / 2 : e.clientX
        const centerY = rect ? rect.top + rect.height / 2 : e.clientY
        const nextAnchor: CornerAnchor =
            centerY < window.innerHeight / 2
                ? (centerX < window.innerWidth / 2 ? 'top-left' : 'top-right')
                : (centerX < window.innerWidth / 2 ? 'bottom-left' : 'bottom-right')

        setAnchor(nextAnchor)
        setIsDragging(false)
        setDragPosition(null)

        if (dragMovedRef.current) {
            suppressClickUntilRef.current = Date.now() + 250
        }

        if (pillRef.current?.hasPointerCapture(e.pointerId)) {
            pillRef.current.releasePointerCapture(e.pointerId)
        }
        pointerIdRef.current = null
    }

    return (
        <div
            ref={pillRef}
            className={cn(
                'fixed z-[110] select-none touch-none',
                isDragging
                    ? 'cursor-grabbing'
                    : CORNER_STYLE[anchor],
                !isDragging && 'animate-in fade-in zoom-in-95 duration-150'
            )}
            style={isDragging && dragPosition ? { left: dragPosition.x, top: dragPosition.y } : undefined}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={(e) => {
                if (pointerIdRef.current !== e.pointerId) return
                setIsDragging(false)
                setDragPosition(null)
                pointerIdRef.current = null
            }}
        >
            <div className="flex max-w-[calc(100vw-1.5rem-env(safe-area-inset-left)-env(safe-area-inset-right))] items-center gap-2 rounded-2xl border border-emerald-300/25 bg-surface/95 px-2.5 py-2 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="touch-target flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/25 bg-emerald-400/10 text-emerald-300">
                        <Clock3 className="h-4 w-4" />
                    </div>
                    <button
                        type="button"
                        data-pill-open
                        onClick={() => {
                            if (Date.now() < suppressClickUntilRef.current) return
                            if (taskId) setActiveTaskId(taskId, task?.short_id)
                        }}
                        className="min-w-0 text-left"
                        aria-label={taskId ? 'Open running task' : 'Running timer'}
                        title={title}
                    >
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-300/90">
                            <Grip className="h-3.5 w-3.5 text-text-muted" />
                            <span>Timer</span>
                        </div>
                        <div className="max-w-[14rem] truncate text-xs text-text-muted">{title}</div>
                        <div className="font-mono text-sm font-black tabular-nums text-text-primary">{formatElapsed(elapsedSeconds)}</div>
                    </button>
                </div>

                <button
                    type="button"
                    data-pill-stop
                    onClick={() => void stopTimer()}
                    disabled={isSyncing}
                    className={cn(
                        'touch-target inline-flex items-center justify-center rounded-xl border px-2.5 py-2 text-sm font-black uppercase tracking-wider transition-all',
                        'border-emerald-300/25 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20',
                        isSyncing && 'opacity-60 cursor-not-allowed'
                    )}
                    aria-label="Stop timer"
                    title="Stop timer"
                >
                    <Pause className="h-4 w-4" />
                </button>
            </div>
        </div>
    )
}

