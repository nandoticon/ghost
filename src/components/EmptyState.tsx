import { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
    icon: LucideIcon
    title: string
    description: string
}

export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700 relative overflow-hidden">
            {/* Gradient mesh background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-accent-warm/5 rounded-full blur-2xl" />
            </div>

            <div className="relative mb-8">
                {/* Decorative background shape */}
                <div className="absolute inset-0 bg-accent/20 blur-[60px] rounded-full scale-150" />

                {/* Floating icon container */}
                <div className="relative w-24 h-24 bg-surface rounded-[2.5rem] border border-border/50 flex items-center justify-center shadow-2xl animate-float">
                    <Icon className="w-10 h-10 text-accent opacity-80" strokeWidth={1.5} />

                    {/* Small accent dots */}
                    <div className="absolute top-0 right-0 w-3 h-3 bg-accent-warm rounded-full border-4 border-surface -mr-1 -mt-1 animate-pulse" />
                    <div className="absolute bottom-4 -left-2 w-2 h-2 bg-accent/60 rounded-full animate-float" style={{ animationDelay: '0.5s' }} />
                </div>
            </div>

            <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tight">{title}</h3>
            <p className="text-text-muted text-sm max-w-[280px] mx-auto leading-relaxed">
                {description}
            </p>
        </div>
    )
}

