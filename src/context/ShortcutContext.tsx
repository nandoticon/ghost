import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

interface ShortcutContextType {
    isModalOpen: boolean
    setModalOpen: (open: boolean) => void
    isQuickCaptureOpen: boolean
    setQuickCaptureOpen: (open: boolean) => void
    activeTaskId: string | null
    setActiveTaskId: (id: string | null, shortId?: string | null) => void
}

const ShortcutContext = createContext<ShortcutContextType | undefined>(undefined)

export const ShortcutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isModalOpen, setModalOpen] = useState(false)
    const [isQuickCaptureOpenState, setQuickCaptureOpenState] = useState(false)
    const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null)
    const [searchParams, setSearchParams] = useSearchParams()

    // Keep URL params and in-memory overlay state in sync (supports browser back/forward).
    useEffect(() => {
        const taskParam = searchParams.get('task')
        const quickCaptureParam = searchParams.get('quick') === '1'

        setActiveTaskIdState((prev) => (prev === taskParam ? prev : taskParam))
        setQuickCaptureOpenState((prev) => (prev === quickCaptureParam ? prev : quickCaptureParam))
    }, [searchParams])

    const setQuickCaptureOpen = (open: boolean) => {
        if (open === isQuickCaptureOpenState && (searchParams.get('quick') === '1') === open) {
            return
        }
        setQuickCaptureOpenState(open)
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            if (open) {
                next.set('quick', '1')
            } else {
                next.delete('quick')
            }
            return next
        }, { replace: !open })
    }

    const setTaskSearchParam = (identifier: string | null) => {
        const currentIdentifier = searchParams.get('task')

        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            if (identifier) {
                next.set('task', identifier)
            } else {
                next.delete('task')
            }
            return next
        }, {
            replace: Boolean(identifier && currentIdentifier),
        })
    }

    // Sync activeTaskId -> URL
    const setActiveTaskId = (id: string | null, shortId?: string | null) => {
        if (id === activeTaskId && (shortId || id) === searchParams.get('task')) {
            return
        }
        setActiveTaskIdState(id)
        const identifier = shortId || id
        if (identifier === searchParams.get('task')) {
            return
        }
        setTaskSearchParam(identifier)
    }

    return (
        <ShortcutContext.Provider
            value={{
                isModalOpen,
                setModalOpen,
                isQuickCaptureOpen: isQuickCaptureOpenState,
                setQuickCaptureOpen,
                activeTaskId,
                setActiveTaskId
            }}
        >
            {children}
        </ShortcutContext.Provider>
    )
}

export const useShortcutContext = () => {
    const context = useContext(ShortcutContext)
    if (!context) {
        throw new Error('useShortcutContext must be used within a ShortcutProvider')
    }
    return context
}
