import { useState, useEffect } from 'react'
import { Share, X } from 'lucide-react'

export function InstallPrompt() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        // Detect iOS Safari
        const isIos = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase())
        // Detect if already in standalone mode
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
        // Check if previously dismissed
        const isDismissed = localStorage.getItem('ghost-install-dismissed') === 'true'

        if (isIos && !isStandalone && !isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true)
            }, 30000) // Show after 30 seconds

            return () => clearTimeout(timer)
        }
    }, [])

    const handleDismiss = () => {
        setIsVisible(false)
        localStorage.setItem('ghost-install-dismissed', 'true')
    }

    if (!isVisible) return null

    return (
        <div className="fixed bottom-6 left-4 right-4 z-[500] animate-in slide-in-from-bottom duration-500">
            <div className="bg-surface border border-border rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-w-sm mx-auto">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#0e0e0e] rounded-xl flex items-center justify-center border border-border">
                            <span className="text-accent font-bold text-xl">G</span>
                        </div>
                        <h3 className="font-bold text-text-primary">Install Ghost on your iPhone</h3>
                    </div>
                    <button
                        onClick={() => setIsVisible(false)} // Just hide for this session
                        className="p-1 hover:bg-surface-secondary rounded-lg text-text-muted transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <p className="text-sm text-text-muted flex items-center flex-wrap gap-1">
                        Tap <Share className="w-4 h-4 inline text-accent" /> then
                        <span className="font-bold text-text-primary">'Add to Home Screen'</span>
                    </p>
                </div>

                <button
                    onClick={handleDismiss}
                    className="w-full py-2.5 bg-accent text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
                >
                    Got it
                </button>
            </div>
        </div>
    )
}
