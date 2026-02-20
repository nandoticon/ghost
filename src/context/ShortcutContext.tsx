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
    const [isQuickCaptureOpen, setQuickCaptureOpen] = useState(false)
    const [activeTaskId, setActiveTaskIdState] = useState<string | null>(null)
    const [searchParams, setSearchParams] = useSearchParams()

    // On mount: read ?task= from URL and open the panel
    useEffect(() => {
        const taskParam = searchParams.get('task')
        if (taskParam) {
            setActiveTaskIdState(taskParam)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync activeTaskId → URL
    const setActiveTaskId = (id: string | null, shortId?: string | null) => {
        setActiveTaskIdState(id)
        setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            const identifier = shortId || id
            if (identifier) {
                next.set('task', identifier)
            } else {
                next.delete('task')
            }
            return next
        }, { replace: true })
    }

    return (
        <ShortcutContext.Provider
            value={{
                isModalOpen,
                setModalOpen,
                isQuickCaptureOpen,
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
