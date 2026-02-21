function toStringSafe(value) {
    return typeof value === 'string' ? value : ''
}

function normalizeLines(text) {
    return toStringSafe(text)
        .split('\n')
        .map((line) => line.trim().replace(/^[-*0-9.)\s]+/, '').trim())
        .filter(Boolean)
}

function buildFallbackSuggestions(payload) {
    const title = toStringSafe(payload.title).trim() || 'the task'
    const energy = toStringSafe(payload.energy).toLowerCase()
    const prefix = energy === 'low' ? 'Do a tiny step:' : 'Do this next:'
    return [
        `${prefix} define the outcome for "${title}" in one sentence`,
        `${prefix} list the first 3 concrete actions`,
        `${prefix} do the easiest first action now`,
        `${prefix} complete one 10-minute pass and capture blockers`,
        `${prefix} decide the very next follow-up step`,
    ]
}

function makePrompt(payload) {
    const title = toStringSafe(payload.title).trim()
    const notes = toStringSafe(payload.notes).trim() || 'No additional notes'
    const status = toStringSafe(payload.status).trim() || 'todo'
    const energy = toStringSafe(payload.energy).trim() || 'Any'
    const focus = toStringSafe(payload.focus).trim() || 'Standard'
    const location = toStringSafe(payload.location).trim() || 'Anywhere'
    const today = Boolean(payload.today) ? 'Yes' : 'No'
    const startAt = toStringSafe(payload.startAt).trim()
    const endAt = toStringSafe(payload.endAt).trim()
    const existing = Array.isArray(payload.existingSubtasks) ? payload.existingSubtasks : []
    const comments = Array.isArray(payload.comments) ? payload.comments : []

    const context = [
        `Status: ${status}`,
        `Recommended energy: ${energy}`,
        `Focus mode: ${focus}`,
        `Location context: ${location}`,
        `Marked as today's sprint: ${today}`,
        startAt ? `Start date: ${startAt}` : '',
        endAt ? `Due date: ${endAt}` : '',
        existing.length > 0 ? `Current subtasks (do not duplicate): ${existing.join(', ')}` : '',
        comments.length > 0 ? `Recent context: ${comments.slice(-5).join(' | ')}` : '',
    ].filter(Boolean).join('\n')

    return `You are an ADHD coach that breaks down overwhelming tasks into bite-sized, actionable, and simple steps.

TASK CONTEXT:
${context}

MAIN TASK: "${title}"
NOTES: "${notes}"

Generate 3-5 specific subtasks that can be started immediately.
Rules:
1. Keep each subtask concise and concrete.
2. Avoid broad, vague wording.
3. Do not duplicate existing subtasks.
4. Return plain lines only, no bullets or numbering.`
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const payload = req.body || {}
    const title = toStringSafe(payload.title).trim()
    if (!title) {
        return res.status(400).json({ error: 'Missing title' })
    }

    const fallback = buildFallbackSuggestions(payload)
    const key = process.env.GEMINI_API_KEY
    if (!key) {
        return res.status(200).json({ subtasks: fallback, source: 'fallback' })
    }

    try {
        const prompt = makePrompt(payload)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`Gemini HTTP ${response.status}`)
        }

        const data = await response.json()
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const aiLines = normalizeLines(rawText).slice(0, 5)
        if (aiLines.length === 0) {
            return res.status(200).json({ subtasks: fallback, source: 'fallback' })
        }

        return res.status(200).json({ subtasks: aiLines, source: 'ai' })
    } catch (_error) {
        return res.status(200).json({ subtasks: fallback, source: 'fallback' })
    }
}
