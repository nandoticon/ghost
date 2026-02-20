import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, Clock3, Folder, ListChecks, Timer } from 'lucide-react'
import { subDays } from 'date-fns'
import { listSessionsByRange, TimeSession } from '../lib/timeTracking'
import { useGlobalTasks } from '../context/TaskContext'

const PRESETS = ['7d', '30d', '90d', 'custom'] as const

type Preset = (typeof PRESETS)[number]

interface DayBucket {
    key: string
    label: string
    seconds: number
}

function startOfDayIso(date: Date): string {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
}

function endOfDayIso(date: Date): string {
    const d = new Date(date)
    d.setHours(23, 59, 59, 999)
    return d.toISOString()
}

function formatDuration(seconds: number): string {
    const totalMins = Math.floor(seconds / 60)
    const h = Math.floor(totalMins / 60)
    const m = totalMins % 60

    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
}

function getRangeFromPreset(preset: Preset, customFrom: string, customTo: string): { from: string; to: string } {
    const now = new Date()

    if (preset === 'custom') {
        const fallbackFrom = startOfDayIso(subDays(now, 6))
        const fallbackTo = endOfDayIso(now)
        return {
            from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : fallbackFrom,
            to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : fallbackTo,
        }
    }

    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
    return {
        from: startOfDayIso(subDays(now, days)),
        to: endOfDayIso(now),
    }
}

export default function Analytics() {
    const { tasks } = useGlobalTasks()

    const [preset, setPreset] = useState<Preset>('7d')
    const [customFrom, setCustomFrom] = useState('')
    const [customTo, setCustomTo] = useState('')
    const [loading, setLoading] = useState(true)
    const [sessions, setSessions] = useState<TimeSession[]>([])

    const range = useMemo(() => getRangeFromPreset(preset, customFrom, customTo), [preset, customFrom, customTo])

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const data = await listSessionsByRange(range)
            setSessions(data)
        } finally {
            setLoading(false)
        }
    }, [range])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const closedSessions = useMemo(
        () => sessions.filter((s) => s.ended_at && s.duration_seconds),
        [sessions]
    )

    const totalFocusedSeconds = useMemo(
        () => closedSessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0),
        [closedSessions]
    )

    const totalSessions = closedSessions.length
    const averageSessionSeconds = totalSessions > 0 ? Math.floor(totalFocusedSeconds / totalSessions) : 0

    const secondsByTask = useMemo(() => {
        const acc: Record<string, number> = {}
        for (const s of closedSessions) {
            acc[s.task_id] = (acc[s.task_id] ?? 0) + (s.duration_seconds ?? 0)
        }
        return acc
    }, [closedSessions])

    const secondsByProject = useMemo(() => {
        const acc: Record<string, number> = {}

        for (const [taskId, seconds] of Object.entries(secondsByTask)) {
            const task = tasks.find((t) => t.id === taskId)
            const key = task?.project?.name ?? 'No Project'
            acc[key] = (acc[key] ?? 0) + seconds
        }

        return acc
    }, [secondsByTask, tasks])

    const mostFocusedProject = useMemo(() => {
        const entries = Object.entries(secondsByProject)
        if (entries.length === 0) return null
        return entries.sort((a, b) => b[1] - a[1])[0]
    }, [secondsByProject])

    const dailyBuckets = useMemo<DayBucket[]>(() => {
        const byDay: Record<string, number> = {}

        for (const s of closedSessions) {
            const start = new Date(s.started_at)
            const dayKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
            byDay[dayKey] = (byDay[dayKey] ?? 0) + (s.duration_seconds ?? 0)
        }

        return Object.entries(byDay)
            .map(([key, seconds]) => {
                const dt = new Date(`${key}T00:00:00`)
                const label = dt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                })
                return { key, label, seconds }
            })
            .sort((a, b) => a.key.localeCompare(b.key))
    }, [closedSessions])

    const topTasks = useMemo(() => {
        return Object.entries(secondsByTask)
            .map(([taskId, seconds]) => ({
                taskId,
                seconds,
                title: tasks.find((t) => t.id === taskId)?.title ?? 'Deleted task',
            }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 8)
    }, [secondsByTask, tasks])

    const topProjects = useMemo(() => {
        return Object.entries(secondsByProject)
            .map(([projectName, seconds]) => ({ projectName, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 8)
    }, [secondsByProject])

    const maxDaily = Math.max(1, ...dailyBuckets.map((d) => d.seconds))

    return (
        <div className="w-full max-w-full mx-auto px-4 py-8 md:py-12 space-y-8 animate-in fade-in duration-500">
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">
                        Analytics
                    </h1>
                    <p className="text-sm md:text-base text-text-muted font-medium mt-1">
                        Time report from tracked focus sessions
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {PRESETS.map((option) => (
                        <button
                            key={option}
                            onClick={() => setPreset(option)}
                            className={[
                                'px-3 py-2 rounded-xl border text-xs uppercase tracking-widest font-black transition-colors',
                                preset === option
                                    ? 'bg-accent/15 border-accent/40 text-accent'
                                    : 'bg-surface border-border text-text-muted hover:text-text-primary',
                            ].join(' ')}
                        >
                            {option === 'custom' ? 'Custom' : option.toUpperCase()}
                        </button>
                    ))}
                </div>
            </header>

            {preset === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-secondary/20 border border-border/40 rounded-2xl p-4">
                    <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-border bg-surface text-text-primary"
                    />
                    <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="px-3 py-2 rounded-xl border border-border bg-surface text-text-primary"
                    />
                    <button
                        onClick={() => void refresh()}
                        className="px-4 py-2 rounded-xl bg-accent text-white font-bold uppercase tracking-wider text-xs"
                    >
                        Apply Range
                    </button>
                </div>
            )}

            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <KpiCard icon={<Timer className="w-4 h-4" />} label="Total Focused Time" value={formatDuration(totalFocusedSeconds)} />
                <KpiCard icon={<ListChecks className="w-4 h-4" />} label="Total Sessions" value={String(totalSessions)} />
                <KpiCard icon={<Clock3 className="w-4 h-4" />} label="Average Session" value={formatDuration(averageSessionSeconds)} />
                <KpiCard
                    icon={<Folder className="w-4 h-4" />}
                    label="Most Focused Project"
                    value={mostFocusedProject ? `${mostFocusedProject[0]} (${formatDuration(mostFocusedProject[1])})` : 'None'}
                />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Daily Focus Trend
                    </h2>
                    {loading ? (
                        <p className="text-text-muted">Loading...</p>
                    ) : dailyBuckets.length === 0 ? (
                        <p className="text-text-muted">No tracked sessions in this range.</p>
                    ) : (
                        <div className="space-y-2">
                            {dailyBuckets.map((bucket) => (
                                <div key={bucket.key} className="flex items-center gap-3">
                                    <span className="w-16 text-xs text-text-muted font-semibold">{bucket.label}</span>
                                    <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
                                            style={{ width: `${Math.max(2, (bucket.seconds / maxDaily) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="w-20 text-right text-xs text-text-primary font-bold tabular-nums">
                                        {formatDuration(bucket.seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Top Tasks by Focus Time</h2>
                    {loading ? (
                        <p className="text-text-muted">Loading...</p>
                    ) : topTasks.length === 0 ? (
                        <p className="text-text-muted">No tracked task sessions in this range.</p>
                    ) : (
                        <div className="space-y-2">
                            {topTasks.map((item) => (
                                <div key={item.taskId} className="flex items-center justify-between gap-3 bg-surface/50 border border-border/40 rounded-xl px-3 py-2">
                                    <span className="text-sm font-semibold text-text-primary truncate">{item.title}</span>
                                    <span className="text-xs font-black uppercase tracking-wider text-accent-warm tabular-nums">
                                        {formatDuration(item.seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <section className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Top Projects by Focus Time</h2>
                {loading ? (
                    <p className="text-text-muted">Loading...</p>
                ) : topProjects.length === 0 ? (
                    <p className="text-text-muted">No tracked project sessions in this range.</p>
                ) : (
                    <div className="space-y-2">
                        {topProjects.map((item) => (
                            <div key={item.projectName} className="flex items-center justify-between gap-3 bg-surface/50 border border-border/40 rounded-xl px-3 py-2">
                                <span className="text-sm font-semibold text-text-primary truncate">{item.projectName}</span>
                                <span className="text-xs font-black uppercase tracking-wider text-accent tabular-nums">
                                    {formatDuration(item.seconds)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-4 space-y-2">
            <div className="text-xs uppercase tracking-widest font-black text-text-muted flex items-center gap-2">
                {icon}
                <span>{label}</span>
            </div>
            <p className="text-lg md:text-xl font-black text-text-primary">{value}</p>
        </div>
    )
}
