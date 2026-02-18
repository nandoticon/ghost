import { useState } from 'react'
import { User, Database, Shield, LogOut, Loader2, Key } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { cn } from '../lib/cn'
import { ExportImport } from '../components/ExportImport'
import { ConfirmModal } from '../components/ConfirmModal'

export default function Settings() {
    const { user } = useAuth()
    const { showToast } = useToast()
    const [activeTab, setActiveTab] = useState<'account' | 'data'>('account')
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)

    // Password Change State
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            showToast('New passwords do not match', 'error')
            return
        }
        if (newPassword.length < 6) {
            showToast('Password must be at least 6 characters', 'error')
            return
        }

        setIsUpdatingPassword(true)
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword })
            if (error) throw error
            showToast('Password updated successfully', 'success')
            setNewPassword('')
            setConfirmPassword('')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to update password', 'error')
        } finally {
            setIsUpdatingPassword(false)
        }
    }

    const handleSignOutAll = async () => {
        try {
            const { error } = await supabase.auth.signOut({ scope: 'global' })
            if (error) throw error
            showToast('Signed out of all sessions', 'success')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to sign out', 'error')
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-text-primary">Settings</h1>
                <p className="text-text-muted">Manage your account and data.</p>
            </header>

            <div className="flex bg-surface-secondary/30 p-1 rounded-2xl w-fit border border-border">
                <button
                    onClick={() => setActiveTab('account')}
                    className={cn(
                        "flex items-center space-x-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                        activeTab === 'account' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                    )}
                >
                    <User className="w-4 h-4" />
                    <span>Account</span>
                </button>
                <button
                    onClick={() => setActiveTab('data')}
                    className={cn(
                        "flex items-center space-x-2 px-6 py-2 rounded-xl text-sm font-bold transition-all",
                        activeTab === 'data' ? "bg-accent text-white shadow-lg shadow-accent/20" : "text-text-muted hover:text-text-primary"
                    )}
                >
                    <Database className="w-4 h-4" />
                    <span>Data</span>
                </button>
            </div>

            {activeTab === 'account' ? (
                <div className="space-y-6">
                    {/* User Info */}
                    <section className="bg-surface border border-border rounded-3xl p-8 space-y-6">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
                                <User className="w-6 h-6 text-accent" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Logged in as</p>
                                <p className="text-lg font-medium text-text-primary">{user?.email}</p>
                            </div>
                        </div>
                    </section>

                    {/* Change Password */}
                    <section className="bg-surface border border-border rounded-3xl p-8 space-y-6">
                        <div className="flex items-center space-x-3 mb-2">
                            <Key className="w-5 h-5 text-accent" />
                            <h2 className="text-xl font-bold text-text-primary">Change Password</h2>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent/50 outline-none transition-all"
                                    placeholder="Enter new password"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase font-bold tracking-widest text-text-muted ml-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary focus:border-accent/50 outline-none transition-all"
                                    placeholder="Confirm new password"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isUpdatingPassword}
                                className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center space-x-2"
                            >
                                {isUpdatingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{isUpdatingPassword ? 'Updating...' : 'Update Password'}</span>
                            </button>
                        </form>
                    </section>

                    {/* Danger Zone */}
                    <section className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 space-y-6">
                        <div className="flex items-center space-x-3 text-red-500">
                            <Shield className="w-5 h-5" />
                            <h2 className="text-xl font-bold">Danger Zone</h2>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-text-muted">Manage your security and sessions.</p>
                            <button
                                onClick={() => setShowSignOutConfirm(true)}
                                className="flex items-center space-x-2 px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sign out of all sessions</span>
                            </button>
                        </div>
                    </section>
                </div>
            ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <ExportImport />
                </div>
            )}

            <ConfirmModal
                isOpen={showSignOutConfirm}
                title="Sign out of all sessions?"
                description="You will be logged out on all devices. You'll need to sign in again everywhere."
                onClose={() => setShowSignOutConfirm(false)}
                options={[
                    {
                        label: 'Sign out everywhere',
                        variant: 'danger',
                        onClick: () => {
                            setShowSignOutConfirm(false)
                            handleSignOutAll()
                        }
                    }
                ]}
            />
        </div>
    )
}
