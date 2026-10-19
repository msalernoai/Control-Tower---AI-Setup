// One Gemini caller for every project. Runs in Node 18+ and in Deno (Supabase Edge Functions).
//
// Why the rotation lives here and not in each app:
//   - free-tier quota is ~20 requests/day/model per key, so a single key quietly stops on a busy day;
//   - Google retires models and rolls new ones out per project, so a model can 404 for one key only.
// For the caller both failures look the same ("no answer"), so the walk over keys and models is
// done once, here.
//
// Env:
//   GEMINI_API_KEYS="k1,k2,k3"   the pool (put them in your host's secrets, never in code)
//   GEMINI_MODELS="a,b"          optional, tried before the defaults
//
// Use:
//   import { generate } from './gemini.js'
//   const text = await generate('Summarize this lead in one sentence: ...')

const env = (k) => {
  try { if (typeof Deno !== 'undefined') return Deno.env.get(k) ?? '' } catch { /* no permission */ }
  return (typeof process !== 'undefined' ? process.env?.[k] : '') ?? ''
}
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)

const KEYS = list(env('GEMINI_API_KEYS') || env('GEMINI_API_KEY'))
// Ordered by latency: most calls ask for a sentence or two, and a "thinking" model
// takes a minute to say OK.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.6-flash', 'gemini-flash-latest']
const MODELS = [...new Set([...list(env('GEMINI_MODELS')), ...DEFAULT_MODELS])]

// Each process starts at a different key so several apps sharing the pool don't all hit k1 first.
let start = Math.floor(Math.random() * Math.max(KEYS.length, 1))

export async function generate(prompt, { system, maxTokens = 1024, timeoutMs = 30_000 } = {}) {
  if (!KEYS.length) throw new Error('GEMINI_API_KEYS is empty')
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: { maxOutputTokens: maxTokens },
  })
  const errors = []
  for (const model of MODELS) {
    for (let i = 0; i < KEYS.length; i++) {
      const idx = (start + i) % KEYS.length
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', headers: { 'x-goog-api-key': KEYS[idx], 'Content-Type': 'application/json' }, body,
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (res.ok) {
          start = idx   // stay on a key that works
          const data = await res.json()
          return data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        }
        errors.push(`${model} #${idx + 1}: ${res.status}`)
        if (res.status === 404) break   // model missing for this key family: next model
      } catch (e) {
        errors.push(`${model} #${idx + 1}: ${e?.name ?? 'error'}`)
      }
    }
  }
  throw new Error(`Gemini: every key and model failed (${errors.slice(-5).join('; ')})`)
}
