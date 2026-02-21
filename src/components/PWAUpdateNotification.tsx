import { useRegisterSW } from 'virtual:pwa-register/react'

export function PWAUpdateNotification() {
    const isDev = import.meta.env.DEV
    const {
        needRefresh: [needRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(_r: ServiceWorkerRegistration | undefined) {
            if (isDev) {
                console.log('Ghost PWA: Service Worker registered')
            }
        },
        onRegisterError(error: unknown) {
            if (isDev) {
                console.log('SW registration error', error)
            }
        },
    })

    const handleRefresh = () => {
        updateServiceWorker(true)
        window.location.reload()
    }

    if (!needRefresh) return null

    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[600] animate-in fade-in zoom-in duration-300">
            <div className="bg-surface border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4 bg-accent/5 backdrop-blur-md">
                <span className="text-sm font-medium text-text-primary">Ghost has been updated · Refresh to get the latest</span>
                <button
                    onClick={handleRefresh}
                    className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-bold hover:opacity-90 transition-opacity"
                >
                    Refresh
                </button>
            </div>
        </div>
    )
}
