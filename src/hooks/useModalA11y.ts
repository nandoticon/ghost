import { RefObject, useEffect, useRef } from 'react'

interface UseModalA11yOptions {
    isOpen: boolean
    onClose?: () => void
    initialFocusRef?: RefObject<HTMLElement | null>
    lockBodyScroll?: boolean
    trapFocus?: boolean
    closeOnEscape?: boolean
    restoreFocus?: boolean
}

const BODY_LOCK_COUNT_ATTR = 'data-ghost-modal-lock-count'
const BODY_PREV_OVERFLOW_ATTR = 'data-ghost-modal-prev-overflow'

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',')

function lockBodyScroll() {
    const raw = document.body.getAttribute(BODY_LOCK_COUNT_ATTR)
    const count = raw ? Number(raw) : 0

    if (count === 0) {
        document.body.setAttribute(BODY_PREV_OVERFLOW_ATTR, document.body.style.overflow || '')
        document.body.style.overflow = 'hidden'
    }

    document.body.setAttribute(BODY_LOCK_COUNT_ATTR, String(count + 1))
}

function unlockBodyScroll() {
    const raw = document.body.getAttribute(BODY_LOCK_COUNT_ATTR)
    const count = raw ? Number(raw) : 0
    const nextCount = Math.max(0, count - 1)

    if (nextCount === 0) {
        const previousOverflow = document.body.getAttribute(BODY_PREV_OVERFLOW_ATTR) ?? ''
        document.body.style.overflow = previousOverflow
        document.body.removeAttribute(BODY_PREV_OVERFLOW_ATTR)
        document.body.removeAttribute(BODY_LOCK_COUNT_ATTR)
        return
    }

    document.body.setAttribute(BODY_LOCK_COUNT_ATTR, String(nextCount))
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) => {
        const hidden = el.getAttribute('aria-hidden') === 'true'
        return !hidden && !el.hasAttribute('disabled')
    })
}

export function useModalA11y<T extends HTMLElement = HTMLElement>({
    isOpen,
    onClose,
    initialFocusRef,
    lockBodyScroll: shouldLockBody = true,
    trapFocus = true,
    closeOnEscape = true,
    restoreFocus = true,
}: UseModalA11yOptions) {
    const modalRef = useRef<T | null>(null)
    const previousFocusedRef = useRef<HTMLElement | null>(null)

    useEffect(() => {
        if (!isOpen) return

        previousFocusedRef.current = document.activeElement as HTMLElement | null
        if (shouldLockBody) {
            lockBodyScroll()
        }

        const focusInitialElement = () => {
            if (initialFocusRef?.current) {
                initialFocusRef.current.focus()
                return
            }

            const container = modalRef.current as HTMLElement | null
            if (!container) return

            const focusable = getFocusableElements(container)
            if (focusable.length > 0) {
                focusable[0].focus()
                return
            }

            container.focus()
        }

        const raf = window.requestAnimationFrame(focusInitialElement)

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && closeOnEscape) {
                event.preventDefault()
                onClose?.()
                return
            }

            if (event.key !== 'Tab' || !trapFocus) return

            const container = modalRef.current as HTMLElement | null
            if (!container) return

            const focusable = getFocusableElements(container)
            if (focusable.length === 0) {
                event.preventDefault()
                container.focus()
                return
            }

            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            const active = document.activeElement as HTMLElement | null

            if (event.shiftKey) {
                if (active === first || !container.contains(active)) {
                    event.preventDefault()
                    last.focus()
                }
                return
            }

            if (active === last || !container.contains(active)) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            window.cancelAnimationFrame(raf)
            document.removeEventListener('keydown', handleKeyDown)

            if (shouldLockBody) {
                unlockBodyScroll()
            }

            if (restoreFocus && previousFocusedRef.current) {
                previousFocusedRef.current.focus()
            }
        }
    }, [
        closeOnEscape,
        initialFocusRef,
        isOpen,
        onClose,
        restoreFocus,
        shouldLockBody,
        trapFocus,
    ])

    return { modalRef }
}
