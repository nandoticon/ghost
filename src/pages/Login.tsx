import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/cn'
import { ArrowLeft } from 'lucide-react'

type LoginView = 'login' | 'forgot'

export default function Login() {
    const [view, setView] = useState<LoginView>('login')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [resetSent, setResetSent] = useState(false)

    const { user, loading } = useAuth()

    if (!loading && user) {
        return <Navigate to="/today" replace />
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSubmitting(true)

        try {
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (signInError) throw signInError
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('An unknown error occurred')
            }
        } finally {
            setSubmitting(false)
        }
    }

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setSubmitting(true)

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin,
            })
            if (resetError) throw resetError
            setResetSent(true)
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message)
            } else {
                setError('An unknown error occurred')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold tracking-tighter text-text-primary">Ghost</h1>
                    <p className="mt-2 text-text-muted">Personal Task Management</p>
                </div>

                {view === 'login' ? (
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded border border-border bg-surface px-4 py-2 text-base md:text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                                Password
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded border border-border bg-surface px-4 py-2 text-base md:text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                                required
                            />
                            <div className="flex justify-end pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setView('forgot'); setError(null) }}
                                    className="text-xs text-text-muted hover:text-accent transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className={cn(
                                "w-full rounded bg-accent py-2.5 text-sm font-bold text-white transition-all active:scale-95",
                                submitting ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/90"
                            )}
                        >
                            {submitting ? "Signing in..." : "Sign in"}
                        </button>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <button
                            onClick={() => { setView('login'); setError(null); setResetSent(false) }}
                            className="flex items-center space-x-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>Back to sign in</span>
                        </button>

                        {resetSent ? (
                            <div className="rounded border border-accent/20 bg-accent/10 p-4 text-sm text-accent">
                                <p className="font-semibold">Check your email</p>
                                <p className="mt-1 text-accent/80">We sent a password reset link to <strong>{email}</strong>.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleForgotPassword} className="space-y-4">
                                <div>
                                    <h2 className="text-lg font-bold text-text-primary">Reset your password</h2>
                                    <p className="text-sm text-text-muted mt-1">Enter your email and we'll send you a reset link.</p>
                                </div>

                                {error && (
                                    <div className="rounded border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full rounded border border-border bg-surface px-4 py-2 text-base md:text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className={cn(
                                        "w-full rounded bg-accent py-2.5 text-sm font-bold text-white transition-all active:scale-95",
                                        submitting ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/90"
                                    )}
                                >
                                    {submitting ? "Sending..." : "Send reset link"}
                                </button>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
