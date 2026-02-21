import { supabase } from './supabase'

export interface TimeSession {
    id: string
    user_id: string
    task_id: string
    started_at: string
    ended_at: string | null
    duration_seconds: number | null
    source?: string | null
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

interface SessionRangeInput {
    startedAt: string
    endedAt: string
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const taskIdResolutionCache = new Map<string, string>()

function isMissingSourceColumnError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false
    const candidate = error as { code?: string; message?: string }
    const message = (candidate.message || '').toLowerCase()
    return candidate.code === 'PGRST204' && message.includes("'source' column")
}

function normalizeSession(session: TimeSession): TimeSession {
    return {
        ...session,
        source: session.source ?? 'manual',
    }
}

function normalizeSessions(sessions: TimeSession[] | null | undefined): TimeSession[] {
    if (!sessions) return []
    return sessions.map(normalizeSession)
}

function buildDurationSeconds(range: SessionRangeInput): number {
    const startedAt = new Date(range.startedAt)
    const endedAt = new Date(range.endedAt)

    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(endedAt.getTime())) {
        throw new Error('Invalid start/end time')
    }
    if (endedAt <= startedAt) {
        throw new Error('End time must be after start time')
    }

    return Math.max(1, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000))
}

function isUuid(value: string): boolean {
    return uuidRegex.test(value)
}

async function getCurrentUserId(): Promise<string> {
    const { data, error } = await supabase.auth.getUser()
    if (error) {
        throw error
    }

    const userId = data.user?.id
    if (!userId) {
        throw new Error('You must be signed in to track time')
    }

    return userId
}

async function resolveTaskId(taskIdentifier: string): Promise<string> {
    if (isUuid(taskIdentifier)) {
        return taskIdentifier
    }

    const cached = taskIdResolutionCache.get(taskIdentifier)
    if (cached) {
        return cached
    }

    const { data, error } = await supabase
        .from('tasks')
        .select('id')
        .eq('short_id', taskIdentifier)
        .maybeSingle()

    if (error) {
        throw error
    }

    if (!data?.id) {
        throw new Error(`Task "${taskIdentifier}" was not found`)
    }

    taskIdResolutionCache.set(taskIdentifier, data.id)
    return data.id
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

    return data ? normalizeSession(data) : null
}

export async function startSession(taskId: string, opts?: { source?: string }): Promise<TimeSession> {
    await stopActiveSession()

    const userId = await getCurrentUserId()
    const resolvedTaskId = await resolveTaskId(taskId)
    const source = opts?.source ?? 'manual'

    let { data, error } = await supabase
        .from('task_time_sessions')
        .insert([{ user_id: userId, task_id: resolvedTaskId, source }])
        .select('*')
        .single()

    if (error && isMissingSourceColumnError(error)) {
        const fallback = await supabase
            .from('task_time_sessions')
            .insert([{ user_id: userId, task_id: resolvedTaskId }])
            .select('*')
            .single()

        data = fallback.data
        error = fallback.error
    }

    if (error) {
        throw error
    }

    return normalizeSession(data)
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

    return normalizeSession(data[0] as TimeSession)
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
        return normalizeSession(data as TimeSession)
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

    return normalizeSession(data as TimeSession)
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

    return normalizeSessions(data ?? [])
}

export async function listTaskSessions(taskId: string, opts?: { limit?: number }): Promise<TimeSession[]> {
    const limit = opts?.limit ?? 50
    const resolvedTaskId = await resolveTaskId(taskId)

    const { data, error } = await supabase
        .from('task_time_sessions')
        .select('*')
        .eq('task_id', resolvedTaskId)
        .order('started_at', { ascending: false })
        .limit(limit)

    if (error) {
        throw error
    }

    return normalizeSessions(data ?? [])
}

export async function createManualSession(input: {
    taskId: string
    startedAt: string
    endedAt: string
    source?: string
}): Promise<TimeSession> {
    const userId = await getCurrentUserId()
    const resolvedTaskId = await resolveTaskId(input.taskId)
    const durationSeconds = buildDurationSeconds({
        startedAt: input.startedAt,
        endedAt: input.endedAt,
    })

    const source = input.source ?? 'manual'

    let { data, error } = await supabase
        .from('task_time_sessions')
        .insert([{
            user_id: userId,
            task_id: resolvedTaskId,
            started_at: input.startedAt,
            ended_at: input.endedAt,
            duration_seconds: durationSeconds,
            source,
        }])
        .select('*')
        .single()

    if (error && isMissingSourceColumnError(error)) {
        const fallback = await supabase
            .from('task_time_sessions')
            .insert([{
                user_id: userId,
                task_id: resolvedTaskId,
                started_at: input.startedAt,
                ended_at: input.endedAt,
                duration_seconds: durationSeconds,
            }])
            .select('*')
            .single()

        data = fallback.data
        error = fallback.error
    }

    if (error) {
        throw error
    }

    return normalizeSession(data as TimeSession)
}

export async function updateSessionRange(
    sessionId: string,
    range: SessionRangeInput
): Promise<TimeSession> {
    const durationSeconds = buildDurationSeconds(range)

    const { data, error } = await supabase
        .from('task_time_sessions')
        .update({
            started_at: range.startedAt,
            ended_at: range.endedAt,
            duration_seconds: durationSeconds,
        })
        .eq('id', sessionId)
        .select('*')
        .single()

    if (error) {
        throw error
    }

    return normalizeSession(data as TimeSession)
}

export async function deleteSession(sessionId: string): Promise<void> {
    const { error } = await supabase
        .from('task_time_sessions')
        .delete()
        .eq('id', sessionId)

    if (error) {
        throw error
    }
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
