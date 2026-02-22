import { useMemo, useState } from 'react'
import { User, Database, Shield, LogOut, Loader2, Key, Tags, Plus, Pencil, Trash2, Folder } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'
import { cn } from '../lib/cn'
import { ExportImport } from '../components/ExportImport'
import { ConfirmModal } from '../components/ConfirmModal'
import { PageHeader } from '../components/PageHeader'
import { FieldLabel, fieldInputClass, fieldInputClassMd, fieldSelectClass } from '../components/FormField'
import { SectionCard } from '../components/SectionCard'
import { useProjectCategories } from '../hooks/useProjectCategories'
import { useProjects } from '../hooks/useProjects'
import { useProfile } from '../hooks/useProfile'
import React, { useEffect } from 'react'

export default function Settings() {
    const { user } = useAuth()
    const { showToast } = useToast()
    const { categories, createCategory, updateCategory, deleteCategory } = useProjectCategories()
    const { projects } = useProjects()
    const [activeTab, setActiveTab] = useState<'account' | 'data' | 'projects'>('account')
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false)
    const [newCategoryName, setNewCategoryName] = useState('')
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
    const [editingCategoryName, setEditingCategoryName] = useState('')
    const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)

    // Password Change State
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

    // Profile State
    const { profile, loading: profileLoading, updateProfile } = useProfile()
    const [fullName, setFullName] = useState('')
    const [pronouns, setPronouns] = useState('')
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)

    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '')
            setPronouns(profile.pronouns || '')
        }
    }, [profile])

    const handleUpdateProfile = async () => {
        setIsUpdatingProfile(true)
        try {
            await updateProfile({ full_name: fullName, pronouns })
            showToast('Profile updated successfully', 'success')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to update profile', 'error')
        } finally {
            setIsUpdatingProfile(false)
        }
    }

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

    const projectsByCategory = useMemo(() => {
        const counts = new Map<string, number>()
        for (const project of projects) {
            if (!project.category_id) continue
            counts.set(project.category_id, (counts.get(project.category_id) || 0) + 1)
        }
        return counts
    }, [projects])

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault()
        const name = newCategoryName.trim()
        if (!name) return

        try {
            await createCategory(name)
            setNewCategoryName('')
            showToast('Category created', 'success')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to create category', 'error')
        }
    }

    const handleSaveCategoryEdit = async () => {
        if (!editingCategoryId) return
        const name = editingCategoryName.trim()
        if (!name) return

        try {
            await updateCategory(editingCategoryId, name)
            setEditingCategoryId(null)
            setEditingCategoryName('')
            showToast('Category updated', 'success')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to update category', 'error')
        }
    }

    const handleDeleteCategory = async () => {
        if (!deletingCategoryId) return

        try {
            await deleteCategory(deletingCategoryId)
            setDeletingCategoryId(null)
            showToast('Category deleted', 'success')
        } catch (error: unknown) {
            showToast(error instanceof Error ? error.message : 'Failed to delete category', 'error')
        }
    }

    const tabItems: Array<{ key: 'account' | 'data' | 'projects'; label: string; icon: React.ComponentType<{ className?: string }> }> = [
        { key: 'account', label: 'Account', icon: User },
        { key: 'data', label: 'Data', icon: Database },
        { key: 'projects', label: 'Projects', icon: Tags },
    ]

    return (
        <div className="max-w-4xl mx-auto space-y-5 sm:space-y-8 pb-[calc(1rem+env(safe-area-inset-bottom))] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <PageHeader
                title="Settings"
                subtitle="Manage account, data, and project organization."
                compact
                subtitleStyle="body"
                className="border-0 pb-0"
            />

            <div>
                <div className="bg-background/80 backdrop-blur-md rounded-2xl border border-border p-1.5 shadow-[0_10px_30px_-20px_rgba(0,0,0,0.5)]">
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {tabItems.map((tab) => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.key
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={cn(
                                        "shrink-0 inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all min-w-[110px] sm:min-w-0",
                                        isActive
                                            ? "bg-accent text-white shadow-lg shadow-accent/20"
                                            : "bg-surface-secondary/20 text-text-muted hover:text-text-primary"
                                    )}
                                    aria-pressed={isActive}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{tab.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>

            {activeTab === 'account' ? (
                <div className="space-y-4 sm:space-y-6">
                    {/* User Profile */}
                    <SectionCard className="space-y-4 sm:space-y-6">
                        <div className="flex items-center space-x-3 mb-1 sm:mb-2">
                            <User className="w-5 h-5 text-accent" />
                            <h2 className="text-lg sm:text-xl font-bold text-text-primary">Profile</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                            <div className="space-y-2">
                                <FieldLabel>Full Name</FieldLabel>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className={fieldInputClass}
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel>Pronouns</FieldLabel>
                                <select
                                    value={pronouns}
                                    onChange={(e) => setPronouns(e.target.value)}
                                    className={fieldSelectClass}
                                >
                                    <option value="">Select pronouns</option>
                                    <option value="he/him">he/him</option>
                                    <option value="she/her">she/her</option>
                                    <option value="they/them">they/them</option>
                                    <option value="he/they">he/they</option>
                                    <option value="she/they">she/they</option>
                                    <option value="other">other (prefer not to say)</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleUpdateProfile}
                            disabled={isUpdatingProfile || profileLoading}
                            className="w-full md:w-fit px-6 sm:px-8 py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                        >
                            {isUpdatingProfile && <Loader2 className="w-4 h-4 animate-spin" />}
                            <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile'}</span>
                        </button>
                    </SectionCard>

                    {/* Account Info */}
                    <SectionCard className="space-y-4 sm:space-y-6">
                        <div className="flex items-center space-x-3 sm:space-x-4">
                            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
                                <User className="w-6 h-6 text-accent" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Logged in as</p>
                                <p className="text-sm sm:text-lg font-medium text-text-primary break-all">{user?.email}</p>
                            </div>
                        </div>
                    </SectionCard>

                    {/* Change Password */}
                    <SectionCard className="space-y-4 sm:space-y-6">
                        <div className="flex items-center space-x-3 mb-1 sm:mb-2">
                            <Key className="w-5 h-5 text-accent" />
                            <h2 className="text-lg sm:text-xl font-bold text-text-primary">Change Password</h2>
                        </div>

                        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                            <div className="space-y-2">
                                <FieldLabel>New Password</FieldLabel>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={fieldInputClassMd}
                                    placeholder="Enter new password"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <FieldLabel>Confirm New Password</FieldLabel>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={fieldInputClassMd}
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
                    </SectionCard>

                    {/* Danger Zone */}
                    <section className="bg-red-500/5 border border-red-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-8 space-y-4 sm:space-y-6">
                        <div className="flex items-center gap-3 text-red-500">
                            <Shield className="w-5 h-5" />
                            <h2 className="text-lg sm:text-xl font-bold">Danger Zone</h2>
                        </div>
                        <div className="space-y-4">
                            <p className="text-sm text-text-muted">Sensitive actions that affect account sessions.</p>
                            <button
                                onClick={() => setShowSignOutConfirm(true)}
                                className="w-full sm:w-fit inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-bold hover:bg-red-500/20 transition-all"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sign out of all sessions</span>
                            </button>
                        </div>
                    </section>
                </div>
            ) : activeTab === 'data' ? (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-3">
                    <SectionCard className="sm:p-6">
                        <div className="flex items-center gap-3">
                            <Database className="w-5 h-5 text-accent" />
                            <div>
                                <h2 className="text-lg font-bold text-text-primary">Data Tools</h2>
                                <p className="text-xs sm:text-sm text-text-muted">Export backups and import data carefully. Destructive actions are confirmed.</p>
                            </div>
                        </div>
                    </SectionCard>
                    <ExportImport />
                </div>
            ) : (
                <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <SectionCard className="space-y-4 sm:space-y-6">
                        <div className="flex items-center space-x-3">
                            <Tags className="w-5 h-5 text-accent" />
                            <h2 className="text-lg sm:text-xl font-bold text-text-primary">Project Categories</h2>
                        </div>
                        <p className="text-sm text-text-muted">
                            Categories help organize your initiatives. You can assign categories while creating or editing projects.
                        </p>

                        <form onSubmit={handleCreateCategory} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Create a category (e.g. Learning)"
                                className={cn('flex-1', fieldInputClass)}
                            />
                            <button
                                type="submit"
                                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-accent text-white font-bold hover:bg-accent/90 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </form>
                    </SectionCard>

                    <SectionCard className="space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base sm:text-lg font-bold text-text-primary">Current Categories</h3>
                            <span className="text-xs uppercase tracking-widest font-black text-text-muted">
                                {categories.length} total
                            </span>
                        </div>

                        {categories.length === 0 ? (
                            <div className="text-sm text-text-muted border border-border rounded-xl p-4">
                                No categories available.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {categories.map((category) => {
                                    const usageCount = projectsByCategory.get(category.id) || 0
                                    const isEditing = editingCategoryId === category.id
                                    return (
                                        <div
                                            key={category.id}
                                            className="border border-border rounded-2xl p-3 sm:p-4 bg-surface-secondary/25 space-y-3"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        value={editingCategoryName}
                                                        onChange={(e) => setEditingCategoryName(e.target.value)}
                                                        onBlur={handleSaveCategoryEdit}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault()
                                                                handleSaveCategoryEdit()
                                                            }
                                                            if (e.key === 'Escape') {
                                                                setEditingCategoryId(null)
                                                                setEditingCategoryName('')
                                                            }
                                                        }}
                                                        className="w-full bg-surface border border-accent/40 rounded-lg px-3 py-2 text-sm text-text-primary outline-none"
                                                    />
                                                ) : (
                                                    <p className="text-sm sm:text-base font-bold text-text-primary">{category.name}</p>
                                                )}
                                                <p className="text-xs text-text-muted mt-1 inline-flex items-center gap-1.5">
                                                    <Folder className="w-3.5 h-3.5" />
                                                    {usageCount} project{usageCount === 1 ? '' : 's'}
                                                </p>
                                            </div>
                                                {!isEditing && (
                                                    <div className="hidden sm:flex items-center gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCategoryId(category.id)
                                                                setEditingCategoryName(category.name)
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all"
                                                            aria-label={`Edit ${category.name}`}
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingCategoryId(category.id)}
                                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                                                            aria-label={`Delete ${category.name}`}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            {!isEditing && (
                                                <div className="flex sm:hidden items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingCategoryId(category.id)
                                                            setEditingCategoryName(category.name)
                                                        }}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-all"
                                                        aria-label={`Edit ${category.name}`}
                                                    >
                                                        <Pencil className="w-3.5 h-3.5" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingCategoryId(category.id)}
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all"
                                                        aria-label={`Delete ${category.name}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </SectionCard>
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

            <ConfirmModal
                isOpen={Boolean(deletingCategoryId)}
                title="Delete category?"
                description="Projects in this category will keep existing data, but category assignment will be removed."
                onClose={() => setDeletingCategoryId(null)}
                options={[
                    {
                        label: 'Delete category',
                        variant: 'danger',
                        onClick: handleDeleteCategory
                    }
                ]}
            />
        </div>
    )
}
