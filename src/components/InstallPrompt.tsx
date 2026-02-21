import { useState, useEffect } from 'react'
import { Share, X, MoreVertical } from 'lucide-react'

export function InstallPrompt() {
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other')
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase()
        const isIos = /iphone|ipad|ipod/.test(ua)
        const isAndroid = /android/.test(ua)
        const isMobile = isIos || isAndroid || /blackberry|mini|windows\sce|palm/i.test(ua)

        // Detect if already in standalone mode
        const iosNavigator = window.navigator as Navigator & { standalone?: boolean }
        const isStandalone = Boolean(iosNavigator.standalone) || window.matchMedia('(display-mode: standalone)').matches
        // Check if previously dismissed
        const isDismissed = localStorage.getItem('ghost-install-dismissed') === 'true'

        if (isIos) setPlatform('ios')
        else if (isAndroid) setPlatform('android')

        if (isMobile && !isStandalone && !isDismissed) {
            const timer = setTimeout(() => {
                setIsVisible(true)
            }, 15000) // Show after 15 seconds

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
            <div className="bg-surface border border-border rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 flex flex-col gap-6 max-w-sm mx-auto overflow-hidden relative">
                {/* Subtle gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent pointer-events-none" />

                <div className="flex items-start justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center border border-border/50 shadow-xl">
                            <span className="text-accent font-black text-2xl">G</span>
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="font-bold text-lg text-text-primary tracking-tight">Install Ghost</h3>
                            <p className="text-xs font-medium text-text-muted uppercase tracking-widest opacity-60">On your Phone</p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-2 hover:bg-surface-secondary rounded-xl text-text-muted hover:text-text-primary transition-all active:scale-95"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative z-10 bg-surface-secondary rounded-2xl p-5 border border-border shadow-inner">
                    <p className="text-base text-text-primary leading-relaxed text-center font-medium">
                        {platform === 'ios' ? (
                            <>
                                Tap the <Share className="w-5 h-5 inline-block mx-1 text-accent -translate-y-1" /> icon in your browser menu, then select
                                <span className="block mt-1 font-black text-accent uppercase tracking-tight">"Add to Home Screen"</span>
                            </>
                        ) : (
                            <>
                                Tap the menu <MoreVertical className="w-5 h-5 inline-block mx-1 text-accent" /> icon, then select
                                <span className="block mt-1 font-black text-accent uppercase tracking-tight">"Install app"</span>
                                <span className="text-xs text-text-muted lowercase font-normal italic">or</span>
                                <span className="block font-black text-accent uppercase tracking-tight">"Add to Home Screen"</span>
                            </>
                        )}
                    </p>
                </div>

                <button
                    onClick={handleDismiss}
                    className="relative z-10 w-full py-4 bg-accent text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
                >
                    Got it
                </button>
            </div>
        </div>
    )
}
