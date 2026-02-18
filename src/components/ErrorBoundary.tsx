import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

interface ErrorBoundaryProps {
    children: ReactNode
    fallback?: ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="flex min-h-[400px] items-center justify-center p-8">
                    <div className="max-w-sm w-full text-center space-y-6 animate-in fade-in duration-500">
                        {/* Icon */}
                        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>

                        {/* Message */}
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-text-primary tracking-tight">
                                Something went wrong
                            </h2>
                            <p className="text-sm text-text-muted leading-relaxed">
                                An unexpected error occurred. Try refreshing the page or click retry below.
                            </p>
                        </div>

                        {/* Error detail (collapsed) */}
                        {this.state.error && (
                            <details className="text-left bg-surface-secondary/50 border border-border rounded-xl p-3">
                                <summary className="text-[10px] uppercase font-bold tracking-widest text-text-muted cursor-pointer select-none">
                                    Error Details
                                </summary>
                                <pre className="mt-2 text-xs text-red-400 font-mono whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                                    {this.state.error.message}
                                </pre>
                            </details>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-center space-x-3">
                            <button
                                onClick={this.handleRetry}
                                className="flex items-center space-x-2 px-6 py-2.5 bg-accent hover:bg-accent/90 text-white rounded-full text-sm font-bold transition-all active:scale-95 shadow-lg shadow-accent/20"
                            >
                                <RotateCcw className="w-4 h-4" />
                                <span>Retry</span>
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-6 py-2.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                            >
                                Reload Page
                            </button>
                        </div>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}
