/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
    getActiveSession,
    startSession,
    stopActiveSession,
    TimeSession,
} from '../lib/timeTracking'

interface TimerContextType {
    activeSession: TimeSession | null
    elapsedSeconds: number
    isSyncing: boolean
    lastError: string | null
    startTimer: (taskId: string, source?: string) => Promise<TimeSession | null>
    stopTimer: () => Promise<TimeSession | null>
    toggleTimer: (taskId: string, source?: string) => Promise<TimeSession | null>
    refreshActiveTimer: () => Promise<void>
}

type PendingTimerAction =
    | { type: 'start'; taskId: string; source: string; createdAt: string }
    | { type: 'stop'; createdAt: string }

const ACTIVE_SESSION_STORAGE_KEY = 'ghost.timer.activeSession'
const QUEUE_STORAGE_KEY = 'ghost.timer.queue'
const TIMER_BROADCAST_CHANNEL = 'ghost-timer'

const TimerContext = createContext<TimerContextType | undefined>(undefined)

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback
}

function isLikelyOfflineError(error: unknown): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
    const message = getErrorMessage(error, '').toLowerCase()
    return message.includes('network') || message.includes('failed to fetch') || message.includes('fetch')
}

export function TimerProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth()
    const [activeSession, setActiveSession] = useState<TimeSession | null>(null)
    const [nowMs, setNowMs] = useState<number>(Date.now())
    const [isSyncing, setIsSyncing] = useState(false)
    const [lastError, setLastError] = useState<string | null>(null)

    const channelRef = useRef<BroadcastChannel | null>(null)
    const isFlushingRef = useRef(false)

    const persistSession = useCallback((session: TimeSession | null) => {
        if (!session) {
            localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
            return
        }
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(session))
    }, [])

    const loadCachedSession = useCallback((): TimeSession | null => {
        const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
        if (!raw) return null

        try {
            return JSON.parse(raw) as TimeSession
        } catch {
            return null
        }
    }, [])

    const loadQueue = useCallback((): PendingTimerAction[] => {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
        if (!raw) return []
        try {
            const parsed = JSON.parse(raw) as PendingTimerAction[]
            return Array.isArray(parsed) ? parsed : []
        } catch {
            return []
        }
    }, [])

    const persistQueue = useCallback((queue: PendingTimerAction[]) => {
        if (queue.length === 0) {
            localStorage.removeItem(QUEUE_STORAGE_KEY)
            return
        }
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
    }, [])

    const enqueueAction = useCallback((action: PendingTimerAction) => {
        const queue = loadQueue()
        const nextQueue = [...queue, action]
        persistQueue(nextQueue)
    }, [loadQueue, persistQueue])

    const broadcastSync = useCallback(() => {
        channelRef.current?.postMessage({ type: 'timer-sync' })
    }, [])

    const refreshActiveTimer = useCallback(async () => {
        if (!user) {
            setActiveSession(null)
            persistSession(null)
            return
        }

        setIsSyncing(true)
        setLastError(null)

        try {
            const session = await getActiveSession(user.id)
            setActiveSession(session)
            persistSession(session)
        } catch (error) {
            const fallback = loadCachedSession()
            setActiveSession(fallback)
            setLastError(getErrorMessage(error, 'Failed to refresh active timer'))
        } finally {
            setIsSyncing(false)
        }
    }, [user, loadCachedSession, persistSession])

    const flushQueue = useCallback(async () => {
        if (!user || isFlushingRef.current) return
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return

        const queue = loadQueue()
        if (queue.length === 0) return

        isFlushingRef.current = true
        setIsSyncing(true)

        try {
            for (const action of queue) {
                if (action.type === 'stop') {
                    await stopActiveSession()
                } else {
                    await startSession(action.taskId, { source: action.source })
                }
            }

            persistQueue([])
            await refreshActiveTimer()
            broadcastSync()
            setLastError(null)
        } catch (error) {
            setLastError(getErrorMessage(error, 'Failed to sync pending timer actions'))
        } finally {
            isFlushingRef.current = false
            setIsSyncing(false)
        }
    }, [user, loadQueue, persistQueue, refreshActiveTimer, broadcastSync])

    const startTimer = useCallback(async (taskId: string, source = 'manual') => {
        if (!user) return null

        const optimistic: TimeSession = {
            id: `temp-${Date.now()}`,
            user_id: user.id,
            task_id: taskId,
            started_at: new Date().toISOString(),
            ended_at: null,
            duration_seconds: null,
            source,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        setActiveSession(optimistic)
        persistSession(optimistic)
        setIsSyncing(true)
        setLastError(null)

        try {
            const session = await startSession(taskId, { source })
            setActiveSession(session)
            persistSession(session)
            broadcastSync()
            return session
        } catch (error) {
            if (isLikelyOfflineError(error)) {
                enqueueAction({ type: 'start', taskId, source, createdAt: new Date().toISOString() })
                setLastError('Timer start queued. It will sync when back online.')
                return optimistic
            }

            setLastError(getErrorMessage(error, 'Failed to start timer'))
            await refreshActiveTimer()
            return null
        } finally {
            setIsSyncing(false)
        }
    }, [user, persistSession, refreshActiveTimer, broadcastSync, enqueueAction])

    const stopTimer = useCallback(async () => {
        if (!user) return null

        const previous = activeSession
        setActiveSession(null)
        persistSession(null)
        setIsSyncing(true)
        setLastError(null)

        try {
            const stopped = await stopActiveSession()
            broadcastSync()
            return stopped
        } catch (error) {
            if (isLikelyOfflineError(error)) {
                enqueueAction({ type: 'stop', createdAt: new Date().toISOString() })
                setLastError('Timer stop queued. It will sync when back online.')
                return null
            }

            setLastError(getErrorMessage(error, 'Failed to stop timer'))
            setActiveSession(previous)
            persistSession(previous)
            return null
        } finally {
            setIsSyncing(false)
        }
    }, [user, activeSession, persistSession, broadcastSync, enqueueAction])

    const toggleTimer = useCallback(async (taskId: string, source = 'manual') => {
        if (!activeSession) {
            return startTimer(taskId, source)
        }

        if (activeSession.task_id === taskId) {
            return stopTimer()
        }

        return startTimer(taskId, source)
    }, [activeSession, startTimer, stopTimer])

    const elapsedSeconds = useMemo(() => {
        if (!activeSession) return 0

        const startedMs = new Date(activeSession.started_at).getTime()
        const endMs = activeSession.ended_at ? new Date(activeSession.ended_at).getTime() : nowMs

        const seconds = Math.floor((endMs - startedMs) / 1000)
        return Math.max(0, seconds)
    }, [activeSession, nowMs])

    useEffect(() => {
        if (!activeSession) return

        const timer = window.setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [activeSession])

    useEffect(() => {
        if (!user) {
            setActiveSession(null)
            persistSession(null)
            persistQueue([])
            return
        }

        const cached = loadCachedSession()
        if (cached && cached.user_id === user.id && !cached.ended_at) {
            setActiveSession(cached)
        }

        void refreshActiveTimer()
        void flushQueue()
    }, [user, loadCachedSession, persistSession, persistQueue, refreshActiveTimer, flushQueue])

    useEffect(() => {
        if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
            return
        }

        const channel = new BroadcastChannel(TIMER_BROADCAST_CHANNEL)
        channelRef.current = channel

        channel.onmessage = (event) => {
            if (event.data?.type === 'timer-sync') {
                void refreshActiveTimer()
            }
        }

        return () => {
            channel.close()
            channelRef.current = null
        }
    }, [refreshActiveTimer])

    useEffect(() => {
        const onOnline = () => {
            void flushQueue()
            void refreshActiveTimer()
        }

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                void refreshActiveTimer()
                void flushQueue()
            }
        }

        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisibility)

        let syncInterval: number | null = null
        const hasPendingQueue = loadQueue().length > 0
        if (activeSession || hasPendingQueue) {
            syncInterval = window.setInterval(() => {
                void refreshActiveTimer()
                void flushQueue()
            }, 30000)
        }

        return () => {
            window.removeEventListener('online', onOnline)
            document.removeEventListener('visibilitychange', onVisibility)
            if (syncInterval) window.clearInterval(syncInterval)
        }
    }, [activeSession, loadQueue, refreshActiveTimer, flushQueue])

    const value = useMemo<TimerContextType>(() => ({
        activeSession,
        elapsedSeconds,
        isSyncing,
        lastError,
        startTimer,
        stopTimer,
        toggleTimer,
        refreshActiveTimer,
    }), [activeSession, elapsedSeconds, isSyncing, lastError, startTimer, stopTimer, toggleTimer, refreshActiveTimer])

    return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer() {
    const context = useContext(TimerContext)
    if (!context) {
        throw new Error('useTimer must be used within a TimerProvider')
    }

    return context
}

