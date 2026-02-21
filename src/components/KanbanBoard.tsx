import React, { useMemo } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Task } from '../types'
import { cn } from '../lib/cn'
import { StatusOptions } from './StatusMenu'

interface KanbanBoardProps {
    tasks: Task[]
    onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>
    onTaskClick: (taskId: string) => void
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({ tasks, onUpdateTask, onTaskClick }) => {
    // Group tasks by status
    const columns = useMemo(() => {
        const board: Record<Task['status'], Task[]> = {
            todo: [],
            doing: [],
            waiting: [],
            done: []
        }

        tasks.forEach(t => {
            // Failsafe: if a task doesn't have a status but is completed
            const status = t.status || (t.completed ? 'done' : 'todo')
            if (board[status]) {
                board[status].push(t)
            } else {
                board['todo'].push(t)
            }
        })

        // Sort inside columns
        Object.keys(board).forEach(col => {
            board[col as Task['status']].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        })

        return board
    }, [tasks])

    const handleDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result

        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        const newStatus = destination.droppableId as Task['status']
        const isNowCompleted = newStatus === 'done'

        // Optimistically trigger the update that fires across the system
        void onUpdateTask(draggableId, {
            status: newStatus,
            completed: isNowCompleted
        })
    }

    return (
        <div className="flex-1 w-full h-full overflow-x-auto custom-scrollbar flex p-6 gap-6 min-h-[500px]">
            <DragDropContext onDragEnd={handleDragEnd}>
                {StatusOptions.map(col => (
                    <div key={col.value} className="flex-shrink-0 w-[300px] flex flex-col pt-2 select-none">
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <div className={cn("p-1.5 rounded-md", col.bg)}>
                                <col.icon className={cn("w-4 h-4", col.color)} />
                            </div>
                            <h3 className="font-heavy text-sm tracking-widest uppercase text-text-primary">
                                {col.label}
                            </h3>
                            <span className="ml-auto text-xs font-bold text-text-muted/60 bg-surface-secondary px-2 py-0.5 rounded-full">
                                {columns[col.value].length}
                            </span>
                        </div>

                        <Droppable droppableId={col.value}>
                            {(provided, snapshot) => (
                                <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={cn(
                                        "flex-1 flex flex-col gap-3 rounded-2xl p-2 min-h-[150px] transition-colors border",
                                        snapshot.isDraggingOver ? "bg-accent/5 border-accent/20" : "bg-surface-secondary/30 border-transparent"
                                    )}
                                >
                                    {columns[col.value].map((task, index) => (
                                        <Draggable key={task.id} draggableId={task.id} index={index}>
                                            {(provided, snapshot) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    style={provided.draggableProps.style}
                                                    onClick={() => onTaskClick(task.id)}
                                                    className={cn(
                                                        "bg-surface border border-border/60 hover:border-border rounded-xl p-4 shadow-sm group transition-shadow cursor-grab active:cursor-grabbing",
                                                        snapshot.isDragging && "shadow-2xl border-accent/50 rotate-2 z-50",
                                                        col.value === 'done' && "opacity-60 grayscale-[0.5]"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <h4 className={cn(
                                                            "text-sm font-bold text-text-primary leading-tight",
                                                            col.value === 'done' && "line-through text-text-muted"
                                                        )}>
                                                            {task.title}
                                                        </h4>
                                                    </div>

                                                    {task.project && (
                                                        <span className="text-[10px] uppercase font-bold tracking-widest text-text-muted">
                                                            {task.project.name}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </div>
                ))}
            </DragDropContext>
        </div>
    )
}
