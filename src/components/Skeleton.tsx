import { cn } from '../lib/cn'

interface SkeletonProps {
    className?: string
}

export function Skeleton({ className }: SkeletonProps) {
    return (
        <div className={cn("bg-surface-secondary/50 animate-pulse rounded-lg", className)} />
    )
}

export function TaskListSkeleton() {
    return (
        <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-3 px-4 py-3 rounded-xl bg-surface/30 border border-border/20">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="w-3/4 h-4" />
                        <Skeleton className="w-1/2 h-3 opacity-60" />
                    </div>
                    <Skeleton className="w-4 h-4 rounded-full opacity-40" />
                </div>
            ))}
        </div>
    )
}

export function ProjectGridSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="p-6 rounded-[2rem] bg-surface/30 border border-border/20 space-y-4">
                    <div className="flex justify-between items-start">
                        <Skeleton className="w-2/3 h-6" />
                        <Skeleton className="w-8 h-8 rounded-xl" />
                    </div>
                    <Skeleton className="w-full h-12 rounded-xl opacity-60" />
                    <div className="flex space-x-2 pt-2">
                        <Skeleton className="w-16 h-4 rounded-full" />
                        <Skeleton className="w-12 h-4 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    )
}
