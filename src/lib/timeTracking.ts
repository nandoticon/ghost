import { supabase } from './supabase'

export interface TimeSession {
    id: string
    user_id: string
    task_id: string
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    source: string
    created_at: string
    updated_at: string
}

export interface DateRange {
    from: string
    to: string
}

export interface TimeAnalytics {
    totalSeconds: number
    totalSessions: number
    averageSessionSeconds: number
    byTask: Record<string, number>
}

export async function getActiveSession(userId: string): Promise<TimeSession | null> {
    const { data, error } = await supabase
        .from('task_time_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('ended_at', null)
        .maybeSingle()

    if (error) {
        throw error
    }

    return data
}

export async function startSession(taskId: string, opts?: { source?: string }): Promise<TimeSession> {
    await stopActiveSession()

    const source = opts?.source ?? 'manual'

    const { data, error } = await supabase
        .from('task_time_sessions')
        .insert([{ task_id: taskId, source }])
        .select('*')
        .single()

    if (error) {
        throw error
    }

    return data
}

export async function stopActiveSession(opts?: { stoppedAt?: string }): Promise<TimeSession | null> {
    const stoppedAt = opts?.stoppedAt

    const { data, error } = await supabase
        .rpc('stop_active_task_timer', stoppedAt ? { p_stopped_at: stoppedAt } : {})

    if (error) {
        throw error
    }

    if (!Array.isArray(data) || data.length === 0) {
        return null
    }

    return data[0] as TimeSession
}

export async function stopSession(sessionId: string, opts?: { stoppedAt?: string }): Promise<TimeSession> {
    const stoppedAtIso = opts?.stoppedAt ?? new Date().toISOString()

    const stoppedAt = new Date(stoppedAtIso)
    const minEndedAt = new Date(stoppedAt.getTime() - 1000)

    const { data: existing, error: existingError } = await supabase
        .from('task_time_sessions')
        .select('started_at, ended_at')
        .eq('id', sessionId)
        .single()

    if (existingError) {
        throw existingError
    }

    if (existing.ended_at) {
        const { data, error } = await supabase
            .from('task_time_sessions')
            .select('*')
            .eq('id', sessionId)
            .single()

        if (error) throw error
        return data as TimeSession
    }

    const startedAt = new Date(existing.started_at)
    const endedAt = stoppedAt > startedAt ? stoppedAt : new Date(startedAt.getTime() + 1000)
    const effectiveEndedAt = endedAt > minEndedAt ? endedAt : new Date(minEndedAt.getTime() + 1000)

    const durationSeconds = Math.max(
        1,
        Math.floor((effectiveEndedAt.getTime() - startedAt.getTime()) / 1000)
    )

    const { data, error } = await supabase
        .from('task_time_sessions')
        .update({
            ended_at: effectiveEndedAt.toISOString(),
            duration_seconds: durationSeconds,
        })
        .eq('id', sessionId)
        .is('ended_at', null)
        .select('*')
        .single()

    if (error) {
        throw error
    }

    return data as TimeSession
}

export async function listSessionsByRange(range: DateRange): Promise<TimeSession[]> {
    const { data, error } = await supabase
        .from('task_time_sessions')
        .select('*')
        .gte('started_at', range.from)
        .lte('started_at', range.to)
        .order('started_at', { ascending: false })

    if (error) {
        throw error
    }

    return data ?? []
}

export async function getAnalytics(range: DateRange): Promise<TimeAnalytics> {
    const sessions = await listSessionsByRange(range)
    const closed = sessions.filter((s) => s.ended_at && s.duration_seconds)

    const totalSeconds = closed.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0)
    const totalSessions = closed.length
    const averageSessionSeconds = totalSessions > 0 ? Math.floor(totalSeconds / totalSessions) : 0

    const byTask = closed.reduce<Record<string, number>>((acc, s) => {
        const key = s.task_id
        acc[key] = (acc[key] ?? 0) + (s.duration_seconds ?? 0)
        return acc
    }, {})

    return {
        totalSeconds,
        totalSessions,
        averageSessionSeconds,
        byTask,
    }
}
