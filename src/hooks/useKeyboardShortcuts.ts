import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useShortcutContext } from '../context/ShortcutContext'
import { useGlobalTasks } from '../context/TaskContext'
import { useTimer } from '../context/TimerContext'

export const useKeyboardShortcuts = () => {
    const navigate = useNavigate()
    const {
        setModalOpen,
        setQuickCaptureOpen,
        activeTaskId,
        setActiveTaskId
    } = useShortcutContext()
    const { tasks, completeTask, updateTask } = useGlobalTasks()
    const { stopTimer } = useTimer()

    const gKeyPressed = useRef(false)
    const gTimeout = useRef<number | null>(null)

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Guard: don't trigger shortcuts when focus is inside an input, textarea, or contenteditable
            const target = e.target as HTMLElement
            const isInput =
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable

            if (isInput) {
                // Special case for Cmd+Enter to submit
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    // This is handled by form onSubmit usually, but let's allow it to propagate
                    return
                }
                return
            }



            // Global Shortcuts
            const key = e.key.toLowerCase()

            // N or Cmd+K for Quick Capture
            if (key === 'n' || ((e.metaKey || e.ctrlKey) && key === 'k')) {
                e.preventDefault()
                setQuickCaptureOpen(true)
                return
            }

            // / for Search focus
            if (e.key === '/') {
                e.preventDefault()
                const searchInput = document.getElementById('global-search-input')
                searchInput?.focus()
                return
            }

            // ? for Keyboard Shortcut modal
            if (e.key === '?') {
                e.preventDefault()
                setModalOpen(true)
                return
            }

            // G sequence
            if (key === 'g') {
                gKeyPressed.current = true
                if (gTimeout.current) clearTimeout(gTimeout.current)
                gTimeout.current = setTimeout(() => {
                    gKeyPressed.current = false
                }, 500)
                return
            }

            if (gKeyPressed.current) {
                if (key === 't') {
                    e.preventDefault()
                    navigate('/today')
                } else if (key === 'a') {
                    e.preventDefault()
                    navigate('/tasks')
                } else if (key === 'p') {
                    e.preventDefault()
                    navigate('/projects')
                } else if (key === 'r' || key === 'y') {
                    e.preventDefault()
                    navigate('/analytics')
                }
                gKeyPressed.current = false
                if (gTimeout.current) clearTimeout(gTimeout.current)
                return
            }

            // Stop active timer globally
            if (e.shiftKey && key === 's') {
                e.preventDefault()
                void stopTimer()
                return
            }

            // Contextual Shortcuts (Task Focus)
            if (activeTaskId) {
                if (key === 'e') {
                    e.preventDefault()
                    // TaskDetail is open, focus its first input if possible
                } else if (key === 'x') {
                    e.preventDefault()
                    const task = tasks.find(t => t.id === activeTaskId)
                    if (task) void completeTask(activeTaskId, !task.completed)
                } else if (key === 't') {
                    e.preventDefault()
                    const task = tasks.find(t => t.id === activeTaskId)
                    if (task) void updateTask(activeTaskId, { today: !task.today })
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            if (gTimeout.current) clearTimeout(gTimeout.current)
        }
    }, [navigate, setModalOpen, setQuickCaptureOpen, setActiveTaskId, activeTaskId, tasks, completeTask, updateTask, stopTimer])
}
