function toStringSafe(value) {
    return typeof value === 'string' ? value : ''
}

const MAX_BODY_BYTES = 16 * 1024
const MAX_FIELD_LENGTH = 2000
const REQUEST_TIMEOUT_MS = 12000
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 20
const ipRateLimit = new Map()

function getClientIp(req) {
    const forwarded = toStringSafe(req.headers['x-forwarded-for']).split(',')[0].trim()
    const realIp = toStringSafe(req.headers['x-real-ip']).trim()
    return forwarded || realIp || 'unknown'
}

function checkRateLimit(key) {
    const now = Date.now()
    const bucket = ipRateLimit.get(key)
    if (!bucket || now - bucket.windowStart > RATE_LIMIT_WINDOW_MS) {
        ipRateLimit.set(key, { count: 1, windowStart: now })
        return { allowed: true, retryAfter: 0 }
    }

    if (bucket.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.max(1, Math.ceil((RATE_LIMIT_WINDOW_MS - (now - bucket.windowStart)) / 1000))
        return { allowed: false, retryAfter }
    }

    bucket.count += 1
    ipRateLimit.set(key, bucket)
    return { allowed: true, retryAfter: 0 }
}

function normalizeLines(text) {
    return toStringSafe(text)
        .split('\n')
        .map((line) => line.trim().replace(/^[-*0-9.)\s]+/, '').trim())
        .filter(Boolean)
}

function sanitizeList(value, maxItems = 20) {
    if (!Array.isArray(value)) return []
    return value
        .map((item) => toStringSafe(item).trim().slice(0, MAX_FIELD_LENGTH))
        .filter(Boolean)
        .slice(0, maxItems)
}

function sanitizePayload(payload) {
    return {
        title: toStringSafe(payload.title).trim().slice(0, 300),
        notes: toStringSafe(payload.notes).trim().slice(0, MAX_FIELD_LENGTH),
        status: toStringSafe(payload.status).trim().slice(0, 40),
        energy: toStringSafe(payload.energy).trim().slice(0, 40),
        focus: toStringSafe(payload.focus).trim().slice(0, 40),
        location: toStringSafe(payload.location).trim().slice(0, 40),
        today: Boolean(payload.today),
        startAt: toStringSafe(payload.startAt).trim().slice(0, 80),
        endAt: toStringSafe(payload.endAt).trim().slice(0, 80),
        existingSubtasks: sanitizeList(payload.existingSubtasks, 30),
        comments: sanitizeList(payload.comments, 20),
    }
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
    res.setHeader('Cache-Control', 'no-store')

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const contentLength = Number(req.headers['content-length'] || 0)
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return res.status(413).json({ error: 'Payload too large' })
    }

    const rateLimit = checkRateLimit(getClientIp(req))
    if (!rateLimit.allowed) {
        res.setHeader('Retry-After', String(rateLimit.retryAfter))
        return res.status(429).json({ error: 'Too many requests' })
    }

    const payload = sanitizePayload(req.body || {})
    const title = payload.title
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
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            }
        ).finally(() => {
            clearTimeout(timeout)
        })

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
