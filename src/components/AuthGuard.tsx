import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface AuthGuardProps {
    children: ReactNode
}

export default function AuthGuard({ children }: AuthGuardProps) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center space-y-6 animate-in fade-in duration-700">
                    {/* Logo */}
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-lg shadow-accent/40" />
                        <h1 className="text-2xl font-bold tracking-tighter text-text-primary">Ghost</h1>
                    </div>
                    {/* Loading bar */}
                    <div className="w-32 h-0.5 bg-surface-secondary rounded-full overflow-hidden">
                        <div className="h-full w-1/2 bg-accent rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
                    </div>
                </div>
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}
