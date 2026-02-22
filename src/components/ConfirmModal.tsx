import { AlertTriangle, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '../lib/cn'
import { useModalA11y } from '../hooks/useModalA11y'

interface ConfirmOption {
    label: string
    description?: string
    variant: 'danger' | 'default'
    onClick: () => void
    disabled?: boolean
}

interface ConfirmModalProps {
    title: string
    description: string
    options: ConfirmOption[]
    children?: ReactNode
    /** Called when the user cancels (X button or Cancel button) */
    onCancel?: () => void
    /** Alias for onCancel — either one works */
    onClose?: () => void
    /** When false/undefined the modal is always shown; pass true/false to control visibility */
    isOpen?: boolean
}

export function ConfirmModal({ title, description, options, children, onCancel, onClose, isOpen }: ConfirmModalProps) {
    const externalClose = useMemo(() => (onCancel ?? onClose ?? (() => undefined)), [onCancel, onClose])
    const isControlled = typeof isOpen === 'boolean'
    const shouldBeOpen = isOpen !== false
    const [isRendered, setIsRendered] = useState(shouldBeOpen)
    const [isClosing, setIsClosing] = useState(false)
    const closeTimerRef = useRef<number | null>(null)
    const closingRef = useRef(false)
    const prevOpenRef = useRef(shouldBeOpen)

    const handleClose = useCallback(() => {
        if (closingRef.current) return
        closingRef.current = true
        setIsClosing(true)
        closeTimerRef.current = window.setTimeout(() => {
            closeTimerRef.current = null
            setIsClosing(false)
            if (!isControlled) setIsRendered(false)
            externalClose()
        }, 140)
    }, [externalClose, isControlled])

    useEffect(() => {
        const wasOpen = prevOpenRef.current
        prevOpenRef.current = shouldBeOpen

        if (shouldBeOpen && !wasOpen) {
            if (closeTimerRef.current) {
                window.clearTimeout(closeTimerRef.current)
                closeTimerRef.current = null
            }
            closingRef.current = false
            setIsClosing(false)
            setIsRendered(true)
        } else if (!shouldBeOpen && wasOpen) {
            if (isControlled && isRendered && !isClosing) {
                handleClose()
            }
        }
    }, [shouldBeOpen, isControlled, isRendered, isClosing, handleClose])

    useEffect(() => () => {
        if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
    }, [])

    const isVisible = shouldBeOpen || isClosing || isRendered
    const { modalRef } = useModalA11y<HTMLDivElement>({
        isOpen: isVisible,
        onClose: handleClose,
        lockBodyScroll: false,
        trapFocus: true,
    })

    if (!isVisible) return null

    return (
        <div
            className={cn(
                "fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm",
                isClosing ? "animate-out fade-out duration-150" : "animate-in fade-in duration-150"
            )}
            onClick={handleClose}
        >
            <div
                ref={modalRef}
                className={cn(
                    "relative w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl",
                    isClosing ? "animate-out zoom-out-95 duration-150" : "animate-in zoom-in-95 duration-180"
                )}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                tabIndex={-1}
            >
                <div className="flex items-start justify-between p-6 pb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-red-500/10 rounded-xl shrink-0">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h2 id="confirm-modal-title" className="text-base font-bold text-text-primary">{title}</h2>
                            <p className="text-sm text-text-muted mt-0.5">{description}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="touch-target p-1.5 hover:bg-surface-secondary rounded-lg transition-colors text-text-muted hover:text-text-primary shrink-0 ml-2"
                        aria-label="Close confirmation"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="px-6 pb-6 space-y-2">
                    {children ? (
                        <div className="pb-1">
                            {children}
                        </div>
                    ) : null}
                    {options.map((opt, i) => (
                        <button
                            key={i}
                            onClick={opt.onClick}
                            disabled={opt.disabled}
                            className={cn(
                                "w-full flex flex-col items-start px-4 py-3 rounded-xl border transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed",
                                opt.variant === 'danger'
                                    ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500"
                                    : "border-border bg-surface-secondary hover:bg-surface-secondary/80 text-text-primary"
                            )}
                        >
                            <span className="text-sm font-semibold">{opt.label}</span>
                            {opt.description && (
                                <span className="text-sm text-text-muted mt-0.5">{opt.description}</span>
                            )}
                        </button>
                    ))}
                    <button
                        onClick={handleClose}
                        className="w-full px-4 py-2.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-xl transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    )
}
