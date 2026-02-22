import React from 'react'
import { X } from 'lucide-react'
import { useShortcutContext } from '../context/ShortcutContext'
import { cn } from '../lib/cn'

interface ShortcutRowProps {
    keys: string[]
    description: string
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({ keys, description }) => (
    <div className="flex items-center justify-between py-2 border-b border-border/30 last:border-0 hover:bg-surface-secondary/50 px-2 rounded-lg transition-colors group">
        <div className="flex items-center space-x-2">
            {keys.map((key, idx) => (
                <React.Fragment key={idx}>
                    <kbd className="min-w-[24px] h-6 flex items-center justify-center px-1.5 bg-surface-secondary border border-border rounded text-[10px] font-mono font-bold text-text-primary shadow-sm group-hover:border-accent/50 transition-colors">
                        {key}
                    </kbd>
                    {idx < keys.length - 1 && <span className="text-[10px] text-text-muted font-bold">then</span>}
                </React.Fragment>
            ))}
        </div>
        <span className="text-xs text-text-muted group-hover:text-text-primary transition-colors">{description}</span>
    </div>
)

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-3">
        <h3 className="text-[10px] uppercase font-bold tracking-widest text-accent/80 px-2">{title}</h3>
        <div className="space-y-1">
            {children}
        </div>
    </div>
)

export const KeyboardShortcutsModal: React.FC = () => {
    const { isModalOpen, setModalOpen } = useShortcutContext()

    if (!isModalOpen) return null

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6">
            <div
                className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-300"
                onClick={() => setModalOpen(false)}
            />

            <div
                className={cn(
                    "relative w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden",
                    "animate-in zoom-in-95 fade-in duration-150"
                )}
            >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary/50">
                    <h2 className="text-sm font-bold uppercase tracking-widest text-text-primary">Keyboard Shortcuts</h2>
                    <button
                        onClick={() => setModalOpen(false)}
                        className="p-1 hover:bg-surface-secondary rounded-lg text-text-muted hover:text-text-primary transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-10">
                        <Section title="Navigation">
                            <ShortcutRow keys={['G', 'T']} description="Go to Today" />
                            <ShortcutRow keys={['G', 'A']} description="Go to Tasks" />
                            <ShortcutRow keys={['G', 'P']} description="Go to Projects" />
                            <ShortcutRow keys={['/']} description="Focus Search" />
                        </Section>

                        <Section title="Tasks">
                            <ShortcutRow keys={['N']} description="Quick Capture" />
                            <ShortcutRow keys={['Cmd', 'K']} description="Quick Capture" />
                            <ShortcutRow keys={['E']} description="Edit focused task" />
                            <ShortcutRow keys={['X']} description="Toggle complete" />
                            <ShortcutRow keys={['T']} description="Toggle today" />
                            <ShortcutRow keys={['Alt', 'V']} description="Toggle task list/kanban view" />
                            <ShortcutRow keys={['Alt', '1..4']} description="Jump task status group" />
                            <ShortcutRow keys={['Alt', 'Shift', '1..4']} description="Collapse/expand task status group" />
                        </Section>
                    </div>

                    <div className="space-y-10">
                        <Section title="General">
                            <ShortcutRow keys={['?']} description="Show shortcuts" />
                            <ShortcutRow keys={['esc']} description="Close modal/drawer" />
                        </Section>

                        <Section title="Views">
                            <ShortcutRow keys={['Cmd', 'Enter']} description="Submit form/comment" />
                            <ShortcutRow keys={['Alt', 'V']} description="Toggle project grid/list view" />
                            <ShortcutRow keys={['Alt', '1..9']} description="Jump project category group (list)" />
                            <ShortcutRow keys={['Alt', 'Shift', '1..9']} description="Collapse/expand project category" />
                        </Section>
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-border bg-surface-secondary/30 flex justify-center">
                    <p className="text-[10px] font-medium text-text-muted uppercase tracking-widest">
                        Ghost · Built for focus
                    </p>
                </div>
            </div>
        </div>
    )
}
