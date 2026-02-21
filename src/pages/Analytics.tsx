import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, CalendarDays, Clock3, Flame, Folder, ListChecks, Timer, TrendingUp } from 'lucide-react'
import { subDays } from 'date-fns'
import { listSessionsByRange, TimeSession } from '../lib/timeTracking'
import { useGlobalTasks } from '../context/TaskContext'
import { DateTimePicker } from '../components/DateTimePicker'

const PRESETS = ['7d', '30d', '90d', 'custom'] as const

type Preset = (typeof PRESETS)[number]
type Granularity = 'weekly' | 'monthly'

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

function formatPercent(value: number): string {
    return `${Math.round(value)}%`
}

function getWeekStart(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const offset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + offset)
    d.setHours(0, 0, 0, 0)
    return d
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
    const [granularity, setGranularity] = useState<Granularity>('weekly')
    const [hideRankings, setHideRankings] = useState(false)
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
    const uniqueActiveDays = useMemo(() => {
        const days = new Set<string>()
        for (const s of closedSessions) {
            const start = new Date(s.started_at)
            const dayKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
            days.add(dayKey)
        }
        return days
    }, [closedSessions])

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

    const groupedBuckets = useMemo<DayBucket[]>(() => {
        const grouped: Record<string, number> = {}

        for (const s of closedSessions) {
            const start = new Date(s.started_at)
            if (granularity === 'weekly') {
                const weekStart = getWeekStart(start)
                const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
                grouped[key] = (grouped[key] ?? 0) + (s.duration_seconds ?? 0)
            } else {
                const key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`
                grouped[key] = (grouped[key] ?? 0) + (s.duration_seconds ?? 0)
            }
        }

        return Object.entries(grouped)
            .map(([key, seconds]) => {
                if (granularity === 'weekly') {
                    const dt = new Date(`${key}T00:00:00`)
                    const label = `Week of ${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                    return { key, label, seconds }
                }

                const [year, month] = key.split('-')
                const dt = new Date(Number(year), Number(month) - 1, 1)
                const label = dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
                return { key, label, seconds }
            })
            .sort((a, b) => a.key.localeCompare(b.key))
    }, [closedSessions, granularity])

    const activeRangeDays = useMemo(() => {
        const from = new Date(range.from)
        const to = new Date(range.to)
        from.setHours(0, 0, 0, 0)
        to.setHours(23, 59, 59, 999)
        const msPerDay = 24 * 60 * 60 * 1000
        return Math.max(1, Math.floor((to.getTime() - from.getTime()) / msPerDay) + 1)
    }, [range.from, range.to])

    const consistencyPercent = useMemo(
        () => (uniqueActiveDays.size / activeRangeDays) * 100,
        [uniqueActiveDays.size, activeRangeDays]
    )

    const bestDay = useMemo(() => {
        if (dailyBuckets.length === 0) return null
        return [...dailyBuckets].sort((a, b) => b.seconds - a.seconds)[0]
    }, [dailyBuckets])

    const currentStreak = useMemo(() => {
        if (dailyBuckets.length === 0) return 0
        const byDay = new Set(dailyBuckets.filter(d => d.seconds > 0).map(d => d.key))
        let streak = 0
        const cursor = new Date()
        cursor.setHours(0, 0, 0, 0)

        while (true) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
            if (!byDay.has(key)) break
            streak += 1
            cursor.setDate(cursor.getDate() - 1)
        }

        return streak
    }, [dailyBuckets])

    const encouragement = useMemo(() => {
        if (totalSessions === 0) {
            return 'Fresh start. One short focus session is a win today.'
        }
        if (currentStreak >= 5) {
            return 'Great rhythm. Keep it light and sustainable.'
        }
        if (currentStreak >= 2) {
            return 'Nice momentum. Small consistent sessions are enough.'
        }
        return 'You showed up. That counts more than intensity.'
    }, [totalSessions, currentStreak])

    const last7Days = useMemo(() => {
        const byDay = new Map(dailyBuckets.map(d => [d.key, d.seconds]))
        return Array.from({ length: 7 }).map((_, idx) => {
            const dt = subDays(new Date(), 6 - idx)
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
            return {
                key,
                label: dt.toLocaleDateString(undefined, { weekday: 'short' }),
                seconds: byDay.get(key) ?? 0,
            }
        })
    }, [dailyBuckets])

    const maxLast7 = Math.max(1, ...last7Days.map(d => d.seconds))

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

    const recentSessions = useMemo(() => {
        return closedSessions
            .slice(0, 8)
            .map((s) => ({
                id: s.id,
                startedAt: new Date(s.started_at),
                seconds: s.duration_seconds ?? 0,
                taskTitle: tasks.find((t) => t.id === s.task_id)?.title ?? 'Deleted task',
            }))
    }, [closedSessions, tasks])

    const maxGrouped = Math.max(1, ...groupedBuckets.map((d) => d.seconds))

    return (
        <div className="w-full max-w-full mx-auto px-3 py-6 md:py-10 space-y-7 animate-in fade-in duration-500">
            <header className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-4xl md:text-5xl xl:text-5xl 2xl:text-6xl font-black tracking-tightest title-gradient">
                        Analytics
                    </h1>
                    <p className="text-sm md:text-base text-text-muted font-medium mt-1">
                        Gentle progress view for your focus habits
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
                    <button
                        onClick={() => setHideRankings((v) => !v)}
                        className={[
                            'px-3 py-2 rounded-xl border text-xs uppercase tracking-widest font-black transition-colors',
                            hideRankings
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                : 'bg-surface border-border text-text-muted hover:text-text-primary',
                        ].join(' ')}
                    >
                        {hideRankings ? 'Show Rankings' : 'Hide Rankings'}
                    </button>
                </div>
            </header>

            <section className="bg-accent/8 border border-accent/25 rounded-2xl p-4">
                <p className="text-sm md:text-base font-semibold text-text-primary">
                    {encouragement}
                </p>
                <p className="text-xs text-text-muted mt-1">
                    Goal: reduce friction, celebrate consistency, ignore perfection.
                </p>
            </section>

            {preset === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-surface-secondary/20 border border-border/40 rounded-2xl p-4">
                    <DateTimePicker
                        value={customFrom}
                        onChange={setCustomFrom}
                        type="date"
                        placeholder="From date"
                        className="bg-surface border-border"
                    />
                    <DateTimePicker
                        value={customTo}
                        onChange={setCustomTo}
                        type="date"
                        placeholder="To date"
                        className="bg-surface border-border"
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
                <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Consistency Rhythm" value={formatPercent(consistencyPercent)} />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {hideRankings ? (
                    <KpiCard
                        icon={<Folder className="w-4 h-4" />}
                        label="Ranking Mode"
                        value="Hidden for calm focus"
                    />
                ) : (
                    <KpiCard
                        icon={<Folder className="w-4 h-4" />}
                        label="Most Focused Project"
                        value={mostFocusedProject ? `${mostFocusedProject[0]} (${formatDuration(mostFocusedProject[1])})` : 'None'}
                    />
                )}
                <KpiCard
                    icon={<CalendarDays className="w-4 h-4" />}
                    label="Best Day"
                    value={bestDay ? `${bestDay.label} (${formatDuration(bestDay.seconds)})` : 'None'}
                />
                <KpiCard
                    icon={<Flame className="w-4 h-4" />}
                    label="Momentum Streak"
                    value={currentStreak === 0 ? 'Fresh start' : `${currentStreak} day${currentStreak === 1 ? '' : 's'}`}
                />
            </section>

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="text-sm uppercase tracking-widest font-black text-text-muted flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Focus Trend
                        </h2>
                        <div className="inline-flex rounded-xl border border-border overflow-hidden">
                            <button
                                onClick={() => setGranularity('weekly')}
                                className={granularity === 'weekly' ? 'px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-accent/15 text-accent' : 'px-3 py-1.5 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
                            >
                                Weekly
                            </button>
                            <button
                                onClick={() => setGranularity('monthly')}
                                className={granularity === 'monthly' ? 'px-3 py-1.5 text-xs font-black uppercase tracking-wider bg-accent/15 text-accent' : 'px-3 py-1.5 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
                            >
                                Monthly
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <p className="text-text-muted">Loading...</p>
                    ) : groupedBuckets.length === 0 ? (
                        <p className="text-text-muted">No sessions here yet. A 10-minute session will start the chart.</p>
                    ) : (
                        <div className="space-y-2">
                            {groupedBuckets.map((bucket) => (
                                <div key={bucket.key} className="flex items-center gap-3">
                                    <span className="w-28 md:w-36 text-xs text-text-muted font-semibold truncate">{bucket.label}</span>
                                    <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
                                            style={{ width: `${Math.max(2, (bucket.seconds / maxGrouped) * 100)}%` }}
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
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Last 7 Days</h2>
                    <div className="grid grid-cols-7 gap-2">
                        {last7Days.map((day) => {
                            const intensity = day.seconds === 0 ? 0 : Math.max(0.12, day.seconds / maxLast7)
                            return (
                                <div key={day.key} className="space-y-1">
                                    <div
                                        className="h-14 rounded-xl border border-border/40"
                                        style={{
                                            backgroundColor: `color-mix(in srgb, var(--color-accent) ${Math.round(intensity * 85)}%, var(--color-surface))`,
                                        }}
                                        title={`${day.label}: ${formatDuration(day.seconds)}`}
                                    />
                                    <p className="text-[10px] text-center uppercase font-black tracking-wider text-text-muted">
                                        {day.label.slice(0, 1)}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {hideRankings ? (
                <section className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5">
                    <p className="text-sm text-text-muted">
                        Rankings are hidden. You can re-enable them anytime from the `Show Rankings` toggle.
                    </p>
                </section>
            ) : (
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                        <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Top Tasks by Focus Time</h2>
                        {loading ? (
                            <p className="text-text-muted">Loading...</p>
                        ) : topTasks.length === 0 ? (
                            <p className="text-text-muted">No task sessions yet in this range.</p>
                        ) : (
                            <div className="space-y-2">
                                {topTasks.map((item) => (
                                    <div key={item.taskId} className="space-y-1 bg-surface/50 border border-border/40 rounded-xl px-3 py-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold text-text-primary truncate">{item.title}</span>
                                            <span className="text-xs font-black uppercase tracking-wider text-accent-warm tabular-nums">
                                                {formatDuration(item.seconds)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent-warm/80 rounded-full"
                                                style={{ width: `${Math.max(4, (item.seconds / Math.max(1, topTasks[0]?.seconds ?? 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                        <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Top Projects by Focus Time</h2>
                        {loading ? (
                            <p className="text-text-muted">Loading...</p>
                        ) : topProjects.length === 0 ? (
                            <p className="text-text-muted">No project sessions yet in this range.</p>
                        ) : (
                            <div className="space-y-2">
                                {topProjects.map((item) => (
                                    <div key={item.projectName} className="space-y-1 bg-surface/50 border border-border/40 rounded-xl px-3 py-2">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="text-sm font-semibold text-text-primary truncate">{item.projectName}</span>
                                            <span className="text-xs font-black uppercase tracking-wider text-accent tabular-nums">
                                                {formatDuration(item.seconds)}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-surface rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent/80 rounded-full"
                                                style={{ width: `${Math.max(4, (item.seconds / Math.max(1, topProjects[0]?.seconds ?? 1)) * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            )}

            <section className="bg-surface-secondary/20 border border-border/40 rounded-2xl p-5 space-y-4">
                <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Recent Sessions</h2>
                {loading ? (
                    <p className="text-text-muted">Loading...</p>
                ) : recentSessions.length === 0 ? (
                    <p className="text-text-muted">No recent sessions in this range.</p>
                ) : (
                    <div className="space-y-2">
                        {recentSessions.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-3 bg-surface/50 border border-border/40 rounded-xl px-3 py-2">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">{item.taskTitle}</p>
                                    <p className="text-xs text-text-muted font-medium">
                                        {item.startedAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                </div>
                                <span className="text-xs font-black uppercase tracking-wider text-text-primary tabular-nums">
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
