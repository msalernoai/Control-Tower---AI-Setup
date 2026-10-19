// Tests the Gemini key pool for real and tells you whether it still holds up.
//
//   node ~/.claude/infra/check-keys.mjs          1 request per key
//   node ~/.claude/infra/check-keys.mjs --deep   every key x every model
//
// Exits 1 when live keys drop below gemini.min_live_keys in registry.json.
// Cost: free-tier quota is ~20 requests/day/model/key, so --deep several times a day eats a real slice.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
// Notepad and PowerShell save UTF-8 with a BOM, and JSON.parse dies on it.
const read = (f) => JSON.parse(readFileSync(join(HERE, f), 'utf8').replace(/^﻿/, ''))
const registry = read('registry.json')
const keys = (read('keys.json').keys ?? []).filter((k) => k.status !== 'retired' && k.value && k.value !== 'PASTE_KEY_HERE')
if (!keys.length) { console.error('keys.json has no keys yet. Fill the "keys" array first.'); process.exit(1) }

const chain = [...new Set([...registry.gemini.models_fast, ...registry.gemini.models_chat])]
const models = process.argv.includes('--deep') ? chain : [chain[0]]
const BODY = JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 1 } })

async function probe(key, model, retry = true) {
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: BODY,
      signal: AbortSignal.timeout(45_000),
    })
    if (res.ok) return 'ok'
    // 503 is the model being busy, not the key being bad: one retry before judging the key.
    if (res.status === 503 && retry) { await new Promise((r) => setTimeout(r, 2500)); return probe(key, model, false) }
    const body = await res.text()
    if (res.status === 429) return 'quota'
    if (res.status === 404) return 'no-model'
    if (res.status === 401 || res.status === 403 || /API_KEY_INVALID/.test(body)) return 'dead'
    return String(res.status)
  } catch { return 'network' }
}

const warnings = []
const byProject = new Map()
for (const k of keys) {
  const p = (k.gcp_project || '').toLowerCase()
  if (!p) warnings.push(`${k.id} has no gcp_project: no way to tell whether it adds quota`)
  else if (byProject.has(p)) warnings.push(`${k.id} and ${byProject.get(p)} share GCP project ${k.gcp_project}: same quota, the pool did not grow`)
  byProject.set(p, k.id)
}

console.log(`\nTesting ${keys.length} key(s) against ${models.join(', ')}\n`)
const rows = []
for (const k of keys) {
  const results = []
  for (const m of models) results.push(await probe(k.value, m))
  rows.push({ k, results })
  console.log(k.id.padEnd(6), (k.gmail || '?').padEnd(30), results.join('  '))
}

const live = rows.filter((r) => r.results.includes('ok'))
const dead = rows.filter((r) => r.results.every((x) => x === 'dead'))
const min = registry.gemini.min_live_keys
console.log(`\n${live.length}/${keys.length} live (minimum ${min})`)
if (dead.length) console.log(`  dead, remove from the pool: ${dead.map((r) => r.k.id).join(', ')} (usually the Generative Language API is not enabled on that GCP project)`)
for (const w of warnings) console.log(`  warning: ${w}`)
if (live.length < min) { console.log('\nBELOW MINIMUM. Create a new GCP project, generate a key, add it to keys.json.'); process.exit(1) }
