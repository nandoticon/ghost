import { useState, useRef } from 'react'
import { Download, Upload, FileJson, FileText, Loader2, AlertCircle, CheckCircle2, History } from 'lucide-react'
import { format, differenceInDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useToast } from './Toast'
import { cn } from '../lib/cn'

type JsonValue = string | number | boolean | null | undefined
type JsonRecord = Record<string, JsonValue>

interface GhostExportData {
    exported_at: string
    version: number
    project_categories: JsonRecord[]
    projects: JsonRecord[]
    tasks: JsonRecord[]
    subtasks: JsonRecord[]
    comments: JsonRecord[]
}

export function ExportImport() {
    const { showToast } = useToast()
    const [isExporting, setIsExporting] = useState(false)
    const [isImporting, setIsImporting] = useState(false)
    const [importPreview, setImportPreview] = useState<GhostExportData | null>(null)
    const [importProgress, setImportProgress] = useState('')
    const [lastExport, setLastExport] = useState<string | null>(localStorage.getItem('ghost-last-export'))
    const fileInputRef = useRef<HTMLInputElement>(null)

    const backupOverdue = lastExport ? differenceInDays(new Date(), new Date(lastExport)) > 30 : true

    // --- EXPORT LOGIC ---
    const handleExportJSON = async () => {
        setIsExporting(true)
        try {
            // Fetch all data
            const [
                { data: projectCategories },
                { data: projects },
                { data: tasks },
                { data: subtasks },
                { data: comments }
            ] = await Promise.all([
                supabase.from('project_categories').select('*'),
                supabase.from('projects').select('*'),
                supabase.from('tasks').select('*'),
                supabase.from('subtasks').select('*'),
                supabase.from('comments').select('*')
            ])

            const exportData = {
                exported_at: new Date().toISOString(),
                version: 1,
                project_categories: projectCategories || [],
                projects: projects || [],
                tasks: tasks || [],
                subtasks: subtasks || [],
                comments: comments || []
            }

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `ghost-export-${format(new Date(), 'yyyy-MM-dd')}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            const now = new Date().toISOString()
            localStorage.setItem('ghost-last-export', now)
            setLastExport(now)
            showToast('JSON export complete', 'success')
        } catch (error: unknown) {
            showToast('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
        } finally {
            setIsExporting(false)
        }
    }

    const handleExportCSV = async () => {
        setIsExporting(true)
        try {
            const { data: projects } = await supabase.from('projects').select('id, name')
            const { data: tasks } = await supabase.from('tasks').select('*')

            if (!tasks) throw new Error('No tasks found')

            const projectMap = new Map(projects?.map(p => [p.id, p.name]) || [])

            const columns = [
                'id', 'title', 'notes', 'completed', 'today',
                'project_name', 'start_at', 'end_at',
                'location', 'energy', 'focus', 'recurrence', 'created_at'
            ]

            const csvContent = [
                columns.join(','),
                ...tasks.map(t => {
                    const row = [
                        t.id,
                        `"${(t.title || '').replace(/"/g, '""')}"`,
                        `"${(t.notes || '').replace(/"/g, '""')}"`,
                        t.completed,
                        t.today,
                        `"${(projectMap.get(t.project_id) || '').replace(/"/g, '""')}"`,
                        t.start_at || '',
                        t.end_at || '',
                        t.location || '',
                        t.energy || '',
                        t.focus || '',
                        t.recurrence || '',
                        t.created_at
                    ]
                    return row.join(',')
                })
            ].join('\n')

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `ghost-tasks-${format(new Date(), 'yyyy-MM-dd')}.csv`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)

            showToast('CSV export complete', 'success')
        } catch (error: unknown) {
            showToast('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'), 'error')
        } finally {
            setIsExporting(false)
        }
    }

    // --- IMPORT LOGIC ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string)
                if (json.version !== 1 || !json.tasks) {
                    showToast('Invalid export file format', 'error')
                    return
                }
                setImportPreview(json)
            } catch (err) {
                showToast('Failed to parse JSON', 'error')
            }
        }
        reader.readAsText(file)
    }

    const performImport = async () => {
        if (!importPreview) return
        setIsImporting(true)
        setImportProgress('Starting import...')

        try {
            const projectMap = new Map<string, string>() // old_id -> new_id
            const categoryMap = new Map<string, string>() // old_id -> new_id
            const taskMap = new Map<string, string>() // old_id -> new_id

            // 1. Import Categories
            if (importPreview.project_categories?.length > 0) {
                setImportProgress(`Importing ${importPreview.project_categories.length} project categories...`)
                for (const c of importPreview.project_categories) {
                    const oldId = c.id as string
                    const { id: _id, created_at: _ca, updated_at: _ua, ...categoryData } = c
                    const { data, error } = await supabase.from('project_categories').insert(categoryData).select('id').single()
                    if (error) throw error
                    categoryMap.set(oldId, data.id)
                }
            }

            // 2. Import Projects
            if (importPreview.projects?.length > 0) {
                setImportProgress(`Importing ${importPreview.projects.length} projects...`)
                for (const p of importPreview.projects) {
                    const oldId = p.id as string
                    const { id: _id, created_at: _ca, updated_at: _ua, ...projectData } = p
                    if (projectData.category_id && categoryMap.has(projectData.category_id as string)) {
                        projectData.category_id = categoryMap.get(projectData.category_id as string)
                    }
                    const { data, error } = await supabase.from('projects').insert(projectData).select('id').single()
                    if (error) throw error
                    projectMap.set(oldId, data.id)
                }
            }

            // 3. Import Tasks
            if (importPreview.tasks?.length > 0) {
                setImportProgress(`Importing ${importPreview.tasks.length} tasks...`)
                for (const t of importPreview.tasks) {
                    const oldId = t.id as string
                    const { id: _id, created_at: _ca, updated_at: _ua, ...taskData } = t
                    // Remap project_id
                    if (taskData.project_id && projectMap.has(taskData.project_id as string)) {
                        taskData.project_id = projectMap.get(taskData.project_id as string)
                    }
                    const { data, error } = await supabase.from('tasks').insert(taskData).select('id').single()
                    if (error) throw error
                    taskMap.set(oldId, data.id)
                }
            }

            // 4. Import Subtasks
            if (importPreview.subtasks?.length > 0) {
                setImportProgress(`Importing ${importPreview.subtasks.length} subtasks...`)
                const subtasksToInsert = importPreview.subtasks.map((s: JsonRecord) => {
                    const { id: _id, created_at: _ca, updated_at: _ua, ...subtaskData } = s
                    if (subtaskData.task_id && taskMap.has(subtaskData.task_id as string)) {
                        subtaskData.task_id = taskMap.get(subtaskData.task_id as string)
                    }
                    return subtaskData
                })
                const { error } = await supabase.from('subtasks').insert(subtasksToInsert)
                if (error) throw error
            }

            // 5. Import Comments
            if (importPreview.comments?.length > 0) {
                setImportProgress(`Importing ${importPreview.comments.length} comments...`)
                const commentsToInsert = importPreview.comments.map((c: JsonRecord) => {
                    const { id: _id, created_at: _ca, ...commentData } = c
                    if (commentData.task_id && taskMap.has(commentData.task_id as string)) {
                        commentData.task_id = taskMap.get(commentData.task_id as string)
                    }
                    return commentData
                })
                const { error } = await supabase.from('comments').insert(commentsToInsert)
                if (error) throw error
            }

            setImportProgress('Done!')
            showToast(`Import complete · ${importPreview.projects?.length || 0} projects and ${importPreview.tasks?.length || 0} tasks added`, 'success')
            setImportPreview(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            showToast('Import failed: ' + message, 'error')
            setImportProgress('Error: ' + message)
        } finally {
            setIsImporting(false)
        }
    }

    return (
        <div className="space-y-6">
            {/* Backup Status */}
            <section className={cn(
                "p-6 rounded-3xl border transition-all",
                backupOverdue
                    ? "bg-amber-500/5 border-amber-500/20"
                    : "bg-surface border-border"
            )}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center border",
                            backupOverdue ? "bg-amber-500/10 border-amber-500/20" : "bg-surface-secondary border-border"
                        )}>
                            <History className={cn("w-5 h-5", backupOverdue ? "text-amber-500" : "text-text-muted")} />
                        </div>
                        <div>
                            <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Last Backup</p>
                            <p className="text-sm font-medium text-white">
                                {lastExport ? format(new Date(lastExport), 'MMM d, yyyy · HH:mm') : 'Never'}
                            </p>
                        </div>
                    </div>
                    {backupOverdue && (
                        <div className="flex items-center space-x-2 text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Consider backing up</span>
                        </div>
                    )}
                </div>
            </section>

            {/* Export Actions */}
            <section className="bg-surface border border-border rounded-3xl p-8 space-y-6">
                <div className="flex items-center space-x-3 text-accent">
                    <Download className="w-5 h-5" />
                    <h2 className="text-xl font-bold text-white">Export Data</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={handleExportJSON}
                        disabled={isExporting}
                        className="flex flex-col items-start p-6 bg-surface-secondary/50 border border-border rounded-2xl hover:border-accent/50 hover:bg-accent/5 transition-all group"
                    >
                        <FileJson className="w-8 h-8 text-accent mb-4 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-white mb-1">JSON Export</h3>
                        <p className="text-xs text-text-muted">Full backup including categories, projects, tasks, comments, and subtasks.</p>
                        {isExporting && <Loader2 className="w-4 h-4 animate-spin mt-4 text-accent" />}
                    </button>

                    <button
                        onClick={handleExportCSV}
                        disabled={isExporting}
                        className="flex flex-col items-start p-6 bg-surface-secondary/50 border border-border rounded-2xl hover:border-white/50 hover:bg-white/5 transition-all group"
                    >
                        <FileText className="w-8 h-8 text-text-muted group-hover:text-white mb-4 group-hover:scale-110 transition-transform" />
                        <h3 className="font-bold text-white mb-1">CSV Export</h3>
                        <p className="text-xs text-text-muted">Tasks only. Ideal for spreadsheets and external analysis.</p>
                        {isExporting && <Loader2 className="w-4 h-4 animate-spin mt-4 text-white" />}
                    </button>
                </div>
            </section>

            {/* Import Action */}
            <section className="bg-surface border border-border rounded-3xl p-8 space-y-6">
                <div className="flex items-center space-x-3 text-white">
                    <Upload className="w-5 h-5" />
                    <h2 className="text-xl font-bold">Import Data</h2>
                </div>

                {!importPreview ? (
                    <div className="relative">
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleFileSelect}
                            ref={fileInputRef}
                            className="hidden"
                            id="import-upload"
                        />
                        <label
                            htmlFor="import-upload"
                            className="flex flex-col items-center justify-center p-12 bg-surface-secondary/30 border-2 border-dashed border-border rounded-3xl hover:border-accent transition-all cursor-pointer group"
                        >
                            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload className="w-8 h-8 text-accent" />
                            </div>
                            <span className="font-bold text-white">Click to upload JSON</span>
                            <span className="text-xs text-text-muted mt-2">Only .json files exported from Ghost are supported.</span>
                        </label>
                    </div>
                ) : (
                    <div className="space-y-6 bg-surface-secondary/50 border border-border rounded-2xl p-6 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-white">Import Preview</h3>
                            <button
                                onClick={() => setImportPreview(null)}
                                className="text-xs text-text-muted hover:text-white underline"
                                disabled={isImporting}
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-surface rounded-xl border border-border">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Categories</p>
                                <p className="text-xl font-bold text-white">{importPreview.project_categories?.length || 0}</p>
                            </div>
                            <div className="p-4 bg-surface rounded-xl border border-border">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Projects</p>
                                <p className="text-xl font-bold text-white">{importPreview.projects?.length || 0}</p>
                            </div>
                            <div className="p-4 bg-surface rounded-xl border border-border">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Tasks</p>
                                <p className="text-xl font-bold text-white">{importPreview.tasks?.length || 0}</p>
                            </div>
                            <div className="p-4 bg-surface rounded-xl border border-border">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-text-muted">Comments</p>
                                <p className="text-xl font-bold text-white">{importPreview.comments?.length || 0}</p>
                            </div>
                        </div>

                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-200/80 leading-relaxed">
                                Import will <strong className="text-amber-500">ADD</strong> these items alongside your existing data.
                                Duplicates will not be replaced. New IDs will be generated for all imported records.
                            </p>
                        </div>

                        {importProgress && (
                            <div className="flex items-center space-x-3 text-accent bg-accent/10 p-3 rounded-lg border border-accent/20">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-wider">{importProgress}</span>
                            </div>
                        )}

                        <button
                            onClick={performImport}
                            disabled={isImporting}
                            className="w-full py-4 bg-accent text-white rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center space-x-2 shadow-lg shadow-accent/20"
                        >
                            {!isImporting && <CheckCircle2 className="w-5 h-5" />}
                            <span>{isImporting ? 'Importing...' : 'Confirm & Import Data'}</span>
                        </button>
                    </div>
                )}
            </section>
        </div>
    )
}
