import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { BarChart3, CalendarDays, Clock3, Flame, Folder, ListChecks, Timer, TrendingUp } from 'lucide-react'
import { subDays } from 'date-fns'
import { listSessionsByRange, TimeSession } from '../lib/timeTracking'
import { useGlobalTasks } from '../context/TaskContext'
import { DateTimePicker } from '../components/DateTimePicker'
import { PageHeader } from '../components/PageHeader'
import { SectionCard } from '../components/SectionCard'

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
    const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks])

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
    const completedTasksInRange = useMemo(() => {
        const fromMs = new Date(range.from).getTime()
        const toMs = new Date(range.to).getTime()
        return tasks.filter((t) => {
            if (!t.completed || !t.completed_at) return false
            const completedMs = new Date(t.completed_at).getTime()
            return completedMs >= fromMs && completedMs <= toMs
        })
    }, [tasks, range.from, range.to])
    const totalCompletedTasks = completedTasksInRange.length
    const recurringCompletions = useMemo(
        () => completedTasksInRange.filter((t) => !!t.parent_task_id).length,
        [completedTasksInRange]
    )
    const completionDailyBuckets = useMemo(() => {
        const byDay: Record<string, number> = {}

        for (const task of completedTasksInRange) {
            if (!task.completed_at) continue
            const completed = new Date(task.completed_at)
            const dayKey = `${completed.getFullYear()}-${String(completed.getMonth() + 1).padStart(2, '0')}-${String(completed.getDate()).padStart(2, '0')}`
            byDay[dayKey] = (byDay[dayKey] ?? 0) + 1
        }

        return Object.entries(byDay)
            .map(([key, count]) => {
                const dt = new Date(`${key}T00:00:00`)
                const label = dt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                })
                return { key, label, count }
            })
            .sort((a, b) => a.key.localeCompare(b.key))
    }, [completedTasksInRange])
    const completionStreak = useMemo(() => {
        if (completionDailyBuckets.length === 0) return 0
        const byDay = new Set(completionDailyBuckets.filter(d => d.count > 0).map(d => d.key))
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
    }, [completionDailyBuckets])
    const completionLast7Days = useMemo(() => {
        const byDay = new Map(completionDailyBuckets.map(d => [d.key, d.count]))
        return Array.from({ length: 7 }).map((_, idx) => {
            const dt = subDays(new Date(), 6 - idx)
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
            return {
                key,
                label: dt.toLocaleDateString(undefined, { weekday: 'short' }),
                count: byDay.get(key) ?? 0,
            }
        })
    }, [completionDailyBuckets])
    const maxCompletionLast7 = Math.max(1, ...completionLast7Days.map(d => d.count))
    const completionGroupedBuckets = useMemo(() => {
        const grouped: Record<string, number> = {}

        for (const task of completedTasksInRange) {
            if (!task.completed_at) continue
            const completed = new Date(task.completed_at)
            if (granularity === 'weekly') {
                const weekStart = getWeekStart(completed)
                const key = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
                grouped[key] = (grouped[key] ?? 0) + 1
            } else {
                const key = `${completed.getFullYear()}-${String(completed.getMonth() + 1).padStart(2, '0')}`
                grouped[key] = (grouped[key] ?? 0) + 1
            }
        }

        return Object.entries(grouped)
            .map(([key, count]) => {
                if (granularity === 'weekly') {
                    const dt = new Date(`${key}T00:00:00`)
                    return {
                        key,
                        label: `Week of ${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
                        count,
                    }
                }
                const [year, month] = key.split('-')
                const dt = new Date(Number(year), Number(month) - 1, 1)
                return {
                    key,
                    label: dt.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
                    count,
                }
            })
            .sort((a, b) => a.key.localeCompare(b.key))
    }, [completedTasksInRange, granularity])
    const maxCompletionGrouped = Math.max(1, ...completionGroupedBuckets.map((d) => d.count))
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
            const task = taskById.get(taskId)
            const key = task?.project?.name ?? 'No Project'
            acc[key] = (acc[key] ?? 0) + seconds
        }

        return acc
    }, [secondsByTask, taskById])

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
                title: taskById.get(taskId)?.title ?? 'Deleted task',
            }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 8)
    }, [secondsByTask, taskById])

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
                taskTitle: taskById.get(s.task_id)?.title ?? 'Deleted task',
            }))
    }, [closedSessions, taskById])

    const maxGrouped = Math.max(1, ...groupedBuckets.map((d) => d.seconds))

    return (
        <div className="w-full max-w-full mx-auto px-2.5 sm:px-3 py-4 sm:py-6 md:py-10 space-y-5 sm:space-y-7 animate-in fade-in duration-500">
            <header className="space-y-3">
                <PageHeader
                    title="Analytics"
                    subtitle="Gentle progress view for your focus habits"
                    compact
                    subtitleStyle="body"
                    className="border-0 pb-0"
                />
                <SectionCard tone="muted" compact className="p-2.5 sm:p-3 space-y-2">
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                        {PRESETS.map((option) => (
                            <button
                                key={option}
                                onClick={() => setPreset(option)}
                                className={[
                                    'px-3 py-2 rounded-xl border text-[11px] sm:text-xs uppercase tracking-widest font-black transition-colors whitespace-nowrap shrink-0',
                                    preset === option
                                        ? 'bg-accent/15 border-accent/40 text-accent'
                                        : 'bg-surface border-border text-text-muted hover:text-text-primary',
                                ].join(' ')}
                            >
                                {option === 'custom' ? 'Custom' : option.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={() => setHideRankings((v) => !v)}
                        className={[
                            'w-full sm:w-auto px-3 py-2 rounded-xl border text-[11px] sm:text-xs uppercase tracking-widest font-black transition-colors',
                            hideRankings
                                ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                                : 'bg-surface border-border text-text-muted hover:text-text-primary',
                        ].join(' ')}
                    >
                        {hideRankings ? 'Show Rankings' : 'Hide Rankings'}
                    </button>
                </SectionCard>
            </header>

            <section className="bg-accent/8 border border-accent/25 rounded-2xl p-3 sm:p-4">
                <p className="text-sm md:text-base font-semibold text-text-primary leading-snug">
                    {encouragement}
                </p>
                <p className="text-xs text-text-muted mt-1">
                    Goal: reduce friction, celebrate consistency, ignore perfection.
                </p>
            </section>

            {preset === 'custom' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-3 bg-surface-secondary/20 border border-border/40 rounded-2xl p-3 sm:p-4">
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
                        className="px-4 py-2.5 rounded-xl bg-accent text-white font-bold uppercase tracking-wider text-xs"
                    >
                        Apply Range
                    </button>
                </div>
            )}

            <section className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-4">
                <KpiCard icon={<Timer className="w-4 h-4" />} label="Total Focused Time" value={formatDuration(totalFocusedSeconds)} />
                <KpiCard icon={<ListChecks className="w-4 h-4" />} label="Total Sessions" value={String(totalSessions)} />
                <KpiCard icon={<Clock3 className="w-4 h-4" />} label="Average Session" value={formatDuration(averageSessionSeconds)} />
                <KpiCard icon={<TrendingUp className="w-4 h-4" />} label="Consistency Rhythm" value={formatPercent(consistencyPercent)} />
            </section>

            <section className="grid grid-cols-2 gap-2.5 sm:gap-4">
                <KpiCard icon={<ListChecks className="w-4 h-4" />} label="Tasks Completed" value={String(totalCompletedTasks)} />
                <KpiCard icon={<CalendarDays className="w-4 h-4" />} label="Recurring Completions" value={String(recurringCompletions)} />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                <KpiCard
                    icon={<Flame className="w-4 h-4" />}
                    label="Completion Streak"
                    value={completionStreak === 0 ? 'Fresh start' : `${completionStreak} day${completionStreak === 1 ? '' : 's'}`}
                />
                <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Completion Trend (Last 7 Days)</h2>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                        {completionLast7Days.map((day) => {
                            const intensity = day.count === 0 ? 0 : Math.max(0.12, day.count / maxCompletionLast7)
                            return (
                                <div key={day.key} className="space-y-1">
                                    <div
                                        className="h-12 sm:h-14 rounded-lg sm:rounded-xl border border-border/40"
                                        style={{
                                            backgroundColor: `color-mix(in srgb, var(--color-accent-warm) ${Math.round(intensity * 85)}%, var(--color-surface))`,
                                        }}
                                        title={`${day.label}: ${day.count} completed`}
                                    />
                                    <p className="text-[10px] text-center uppercase font-black tracking-wider text-text-muted">
                                        {day.label.slice(0, 1)}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                </SectionCard>
            </section>

            <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">
                        Completed Tasks Trend
                    </h2>
                    <div className="inline-flex rounded-xl border border-border overflow-hidden w-full sm:w-auto">
                        <button
                            onClick={() => setGranularity('weekly')}
                            className={granularity === 'weekly' ? 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider bg-accent-warm/15 text-accent-warm' : 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setGranularity('monthly')}
                            className={granularity === 'monthly' ? 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider bg-accent-warm/15 text-accent-warm' : 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
                        >
                            Monthly
                        </button>
                    </div>
                </div>
                {completionGroupedBuckets.length === 0 ? (
                    <p className="text-text-muted">No completed tasks yet in this range.</p>
                ) : (
                    <div className="space-y-2">
                        {completionGroupedBuckets.map((bucket) => (
                            <div key={bucket.key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center gap-2 sm:gap-3">
                                <span className="text-xs text-text-muted font-semibold truncate sm:w-44">{bucket.label}</span>
                                <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-gradient-to-r from-accent-warm to-orange-300"
                                        style={{ width: `${Math.max(2, (bucket.count / maxCompletionGrouped) * 100)}%` }}
                                    />
                                </div>
                                <span className="w-12 sm:w-16 text-right text-xs text-text-primary font-bold tabular-nums">
                                    {bucket.count}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </SectionCard>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
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

            <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h2 className="text-sm uppercase tracking-widest font-black text-text-muted flex items-center gap-2">
                            <BarChart3 className="w-4 h-4" />
                            Focus Trend
                        </h2>
                        <div className="inline-flex rounded-xl border border-border overflow-hidden w-full sm:w-auto">
                            <button
                                onClick={() => setGranularity('weekly')}
                                className={granularity === 'weekly' ? 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider bg-accent/15 text-accent' : 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
                            >
                                Weekly
                            </button>
                            <button
                                onClick={() => setGranularity('monthly')}
                                className={granularity === 'monthly' ? 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider bg-accent/15 text-accent' : 'flex-1 sm:flex-none px-3 py-2 text-xs font-black uppercase tracking-wider text-text-muted bg-surface hover:text-text-primary'}
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
                                <div key={bucket.key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center gap-2 sm:gap-3">
                                    <span className="text-xs text-text-muted font-semibold truncate sm:w-36">{bucket.label}</span>
                                    <div className="flex-1 h-2.5 bg-surface rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-warm"
                                            style={{ width: `${Math.max(2, (bucket.seconds / maxGrouped) * 100)}%` }}
                                        />
                                    </div>
                                    <span className="w-16 sm:w-20 text-right text-xs text-text-primary font-bold tabular-nums">
                                        {formatDuration(bucket.seconds)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </SectionCard>

                <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
                    <h2 className="text-sm uppercase tracking-widest font-black text-text-muted">Last 7 Days</h2>
                    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                        {last7Days.map((day) => {
                            const intensity = day.seconds === 0 ? 0 : Math.max(0.12, day.seconds / maxLast7)
                            return (
                                <div key={day.key} className="space-y-1">
                                    <div
                                        className="h-12 sm:h-14 rounded-lg sm:rounded-xl border border-border/40"
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
                </SectionCard>
            </section>

            {hideRankings ? (
                <SectionCard tone="muted" compact className="p-5">
                    <p className="text-sm text-text-muted">
                        Rankings are hidden. You can re-enable them anytime from the `Show Rankings` toggle.
                    </p>
                </SectionCard>
            ) : (
                <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
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
                    </SectionCard>

                    <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
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
                    </SectionCard>
                </section>
            )}

            <SectionCard tone="muted" compact className="sm:p-5 space-y-3 sm:space-y-4">
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
            </SectionCard>
        </div>
    )
}

function KpiCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <SectionCard tone="muted" compact className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="text-[10px] sm:text-xs uppercase tracking-widest font-black text-text-muted flex items-center gap-1.5 sm:gap-2 min-w-0">
                {icon}
                <span className="truncate">{label}</span>
            </div>
            <p className="text-base sm:text-lg md:text-xl font-black text-text-primary leading-tight break-words">{value}</p>
        </SectionCard>
    )
}
