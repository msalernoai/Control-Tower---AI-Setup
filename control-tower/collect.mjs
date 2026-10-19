// Collector: joins the audit, the registry, the key pool and git into one snapshot.json.
//
//   npm run collect             collect and write snapshot.json
//   npm run collect -- --dry    collect and print a summary, write nothing
//
// Runs on your machine (hourly, via scheduling/) because the credentials live in ~/.claude/infra and
// must stay there. The dashboard only reads snapshot.json, which is gitignored.
//
// Rule that never breaks: no credential value enters the snapshot. A key becomes "...QLUg".

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = homedir()
const INFRA = join(HOME, '.claude', 'infra')
const LOGS = join(INFRA, 'logs')
const dry = process.argv.includes('--dry')
const run = promisify(execFile)
const abs = (p) => p.replace(/^~/, HOME)
const read = (f, fallback) => { try { return JSON.parse(readFileSync(join(INFRA, f), 'utf8').replace(/^﻿/, '')) } catch { return fallback } }
const sh = async (cmd, args, cwd) => { try { return (await run(cmd, args, { cwd, timeout: 20_000, windowsHide: true })).stdout.trim() } catch { return null } }
const tail = (v) => (typeof v === 'string' && v.length > 8 ? `...${v.slice(-4)}` : null)

if (!existsSync(join(INFRA, 'audit.mjs'))) { console.error('~/.claude/infra/audit.mjs not found. Run node setup.mjs at the repo root first.'); process.exit(1) }
const { audit } = await import(pathToFileURL(join(INFRA, 'audit.mjs')).href)
const setup = read('setup.json', {})
const registry = read('registry.json', {})
const keysFile = read('keys.json', { keys: [] })
const { claude, findings } = audit()

// --- projects: audit + git + registry -------------------------------------------
const regByPath = Object.fromEntries(Object.entries(registry.projects ?? {}).filter(([, p]) => p.path).map(([slug, p]) => [abs(p.path).toLowerCase(), { slug, ...p }]))
const projects = await Promise.all(claude.projects.map(async (p) => {
  const path = abs(p.path)
  const reg = regByPath[path.toLowerCase()]
  let git = null
  if (existsSync(join(path, '.git'))) {
    const [status, last, ahead, branch] = await Promise.all([
      sh('git', ['status', '--porcelain'], path),
      sh('git', ['log', '-1', '--format=%cI'], path),
      sh('git', ['rev-list', '--count', '@{u}..HEAD'], path),
      sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'], path),
    ])
    git = { changes: status ? status.split('\n').filter(Boolean).length : 0, last_commit: last || null, unpushed: ahead == null ? null : Number(ahead), branch }
  }
  return {
    ...p, git,
    slug: reg?.slug ?? null,
    vercel: reg?.vercel ?? null,
    supabase: reg?.supabase?.ref ?? null,
    gemini: !!reg?.gemini,
  }
}))
for (const p of projects) {
  if (p.git?.changes > 0 && p.git.last_commit && Date.now() - new Date(p.git.last_commit) > 7 * 86400e3) {
    findings.push({ sev: 'medium', title: `${p.name}: uncommitted changes for over a week`, detail: `${p.git.changes} changed file(s).`, where: p.path })
  }
  if (p.git?.unpushed > 0) findings.push({ sev: 'info', title: `${p.name}: ${p.git.unpushed} commit(s) not pushed`, detail: `Branch ${p.git.branch}.`, where: p.path })
}

// --- Gemini pool: a real ping at most once every 20h (free quota is small) -------
mkdirSync(LOGS, { recursive: true })
const PING = join(LOGS, 'ping-keys.json')
const active = (keysFile.keys ?? []).filter((k) => k.status === 'active' && k.value && k.value !== 'PASTE_KEY_HERE')
let ping = existsSync(PING) ? JSON.parse(readFileSync(PING, 'utf8')) : { at: null, keys: {} }
const model = registry.gemini?.models_fast?.[0]
if (!dry && model && active.length && (!ping.at || Date.now() - new Date(ping.at) > 20 * 3600e3)) {
  const keys = {}
  await Promise.all(active.map(async (k) => {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'x-goog-api-key': k.value, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ok' }] }], generationConfig: { maxOutputTokens: 1 } }),
        signal: AbortSignal.timeout(15_000),
      })
      keys[k.id] = r.ok ? 'live' : r.status === 429 ? 'no-quota' : r.status === 401 || r.status === 403 ? 'dead' : 'unknown'
    } catch { keys[k.id] = 'unknown' }
  }))
  ping = { at: new Date().toISOString(), keys }
  writeFileSync(PING, JSON.stringify(ping, null, 2))
}
const keys = (keysFile.keys ?? []).map((k) => ({ id: k.id, gmail: k.gmail, gcp_project: k.gcp_project, status: k.status, tail: tail(k.value), ping: ping.keys?.[k.id] ?? null }))
const liveKeys = keys.filter((k) => k.ping === 'live').length
const min = registry.gemini?.min_live_keys
if (ping.at && min && liveKeys < min) findings.push({ sev: 'high', title: `Gemini pool below minimum (${liveKeys}/${min})`, detail: 'Run node ~/.claude/infra/check-keys.mjs to see which keys died.', where: 'keys.json' })

// --- snapshot -------------------------------------------------------------------------
const { projects: _, ...claudeRest } = claude
const snapshot = { version: 1, owner: setup.owner ?? null, generated_at: new Date().toISOString(), projects, gemini: { model, min_live_keys: min ?? null, ping_at: ping.at, keys }, claude: claudeRest, findings }

// Last barrier: if anything that looks like a credential slipped in, write nothing.
const text = JSON.stringify(snapshot)
const leak = [/sbp_[0-9a-f]{40}/, /gh[pousr]_[A-Za-z0-9]{36}/, /AIza[\w-]{35}/, /GOCSPX-[\w-]{20,}/, /sk-(ant|proj|or)-[\w-]{20,}/, /eyJ[\w-]{20,}\.eyJ/].find((re) => re.test(text))
if (leak) { console.error(`collect: credential found in the snapshot (${leak}). Nothing written.`); process.exit(1) }

const summary = `${projects.length} projects, ${keys.length} keys, ${findings.length} findings (${findings.filter((f) => f.sev === 'high').length} high)`
if (dry) {
  console.log(`collect --dry: ${summary}\n`)
  for (const f of findings) console.log(`[${f.sev}] ${f.title}`)
  process.exit(0)
}
writeFileSync(join(HERE, 'snapshot.json'), JSON.stringify(snapshot, null, 2))

// --- two-way link with the second brain ------------------------------------------------
// The brain should know what is broken. Rewrites one note, only when the findings change
// (rewriting every hour would just be noise in Obsidian).
const VAULT = setup.brain && abs(setup.brain)
if (VAULT && existsSync(VAULT)) {
  const NOTE = join(VAULT, '90-System', 'Infra status.md')
  const group = (sev, title) => {
    const l = findings.filter((f) => f.sev === sev)
    return l.length ? `## ${title}\n${l.map((f) => `- **${f.title}** (${f.where}): ${f.detail}`).join('\n')}\n` : ''
  }
  const body = [group('high', 'Broken or about to break'), group('medium', 'Needs attention'), group('info', 'Good to know')].filter(Boolean).join('\n') || 'No findings.\n'
  const before = existsSync(NOTE) ? readFileSync(NOTE, 'utf8') : ''
  if (!before.includes(body)) {
    mkdirSync(dirname(NOTE), { recursive: true })
    writeFileSync(NOTE, `---\ntype: area\nstatus: active\ntags: [infra, generated]\nupdated: ${new Date().toLocaleDateString('sv')}\n---\n` +
      `# Infra status\n\nWritten by the Control Tower collector when findings change. Do not edit by hand. Back to [[Home]].\n\n${body}`)
  }
}

appendFileSync(join(LOGS, 'collector.log'), `${new Date().toISOString()} ok ${summary}\n`)
console.log(`collect: ${summary}`)
