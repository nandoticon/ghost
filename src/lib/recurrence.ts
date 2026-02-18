import { addDays, addWeeks, addMonths, addYears, isWeekend, startOfDay, isBefore, parseISO, differenceInMilliseconds } from 'date-fns'
import { Task } from '../types'

export const getNextOccurrence = (task: Task, fromDate: Date): Date | null => {
    let nextDate: Date | null = null;
    const currentFromDate = fromDate;

    switch (task.recurrence) {
        case 'daily':
            nextDate = addDays(currentFromDate, 1);
            break;
        case 'weekdays':
            nextDate = addDays(currentFromDate, 1);
            while (isWeekend(nextDate)) {
                nextDate = addDays(nextDate, 1);
            }
            break;
        case 'weekly':
            nextDate = addWeeks(currentFromDate, 1);
            break;
        case 'monthly':
            nextDate = addMonths(currentFromDate, 1);
            break;
        case 'yearly':
            nextDate = addYears(currentFromDate, 1);
            break;
        default:
            return null;
    }

    if (task.recurrence_end_at) {
        const endDate = startOfDay(parseISO(task.recurrence_end_at));
        // If nextDate is after the end date, stop recurring
        if (isBefore(endDate, startOfDay(nextDate))) {
            return null;
        }
    }

    return nextDate;
}

export const generateNextTask = (completedTask: Task): Partial<Task> | null => {
    if (!completedTask.recurrence) return null;

    const fromDate = completedTask.end_at ? new Date(completedTask.end_at) : new Date();
    const nextOccurrence = getNextOccurrence(completedTask, fromDate);

    if (!nextOccurrence) return null;

    // Calculate shifting in milliseconds to maintain time of day
    const shift = differenceInMilliseconds(nextOccurrence, fromDate);

    const updates: Partial<Task> = {
        title: completedTask.title,
        notes: completedTask.notes,
        project_id: completedTask.project_id,
        location: completedTask.location,
        energy: completedTask.energy,
        focus: completedTask.focus,
        recurrence: completedTask.recurrence,
        recurrence_end_at: completedTask.recurrence_end_at,
        parent_task_id: completedTask.id,
        completed: false,
        today: false,
    };

    if (completedTask.start_at) {
        updates.start_at = new Date(new Date(completedTask.start_at).getTime() + shift).toISOString();
    }

    if (completedTask.end_at) {
        updates.end_at = new Date(new Date(completedTask.end_at).getTime() + shift).toISOString();
    } else {
        // Fallback if no end_at was set, use the next occurrence date
        updates.end_at = nextOccurrence.toISOString();
    }

    return updates;
}
