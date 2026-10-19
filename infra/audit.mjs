// A health check of everything Claude Code uses: instructions, memories, skills, settings, projects.
//
//   node ~/.claude/infra/audit.mjs    prints findings; exits 1 if any is "high"
//
// The Control Tower imports audit(). Only names, counts, dates and paths leave this file, never the
// content of a memory, a CLAUDE.md, a vault note or a transcript.
//
// Why it exists: renaming or moving a folder silently breaks Claude's memory (it is keyed by path),
// the registry and the vault. This finds it before you notice something is "off".

import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const HOME = homedir()
const CLAUDE = join(HOME, '.claude')
const PROJECTS = join(CLAUDE, 'projects')
const INFRA = join(CLAUDE, 'infra')
const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '.vercel', '__pycache__', '.venv'])

// Real prefixes of common credentials. A generic "password" regex flags too much and trains you to ignore it.
const SECRETS = [
  [/sbp_[0-9a-f]{40}/, 'Supabase PAT'],
  [/gh[pousr]_[A-Za-z0-9]{36}/, 'GitHub token'],
  [/AIza[\w-]{35}/, 'Google API key'],
  [/GOCSPX-[\w-]{20,}/, 'Google client secret'],
  [/sb_secret_[\w-]{20,}/, 'Supabase secret key'],
  [/sk-(ant|proj|or)-[\w-]{20,}/, 'Anthropic/OpenAI/OpenRouter key'],
  [/eyJ[\w-]{20,}\.eyJ[\w-]{20,}\./, 'JWT'],
]

const read = (f) => { try { return readFileSync(f, 'utf8').replace(/^﻿/, '') } catch { return null } }
const json = (f) => { const t = read(f); try { return t && JSON.parse(t) } catch { return null } }
const dirs = (d) => { try { return readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory() && !SKIP.has(e.name)) } catch { return [] } }
const day = (ms) => (ms ? new Date(ms).toISOString().slice(0, 10) : null)
const abs = (p) => p.replace(/^~/, HOME)
const short = (p) => p.replace(/\\/g, '/').replace(HOME.replace(/\\/g, '/'), '~')
// The same conversion Claude Code uses to name ~/.claude/projects/<key>. Case-insensitive, like Windows.
const key = (p) => resolve(p).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()

function mdFiles(d, out = [], depth = 0) {
  for (const e of (() => { try { return readdirSync(d, { withFileTypes: true }) } catch { return [] } })()) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue
    const f = join(d, e.name)
    if (e.isDirectory()) { if (depth < 6) mdFiles(f, out, depth + 1) } else if (e.name.endsWith('.md')) out.push(f)
  }
  return out
}

export function audit() {
  const setup = json(join(INFRA, 'setup.json')) ?? { workspaces: [] }
  const VAULT = setup.brain ? abs(setup.brain) : null
  const own = new Set(setup.own_skills ?? [])
  const findings = []
  const add = (sev, title, detail, where) => findings.push({ sev, title, detail, where })

  // --- sessions and memory, per path key -----------------------------------
  const byKey = new Map()
  const skillUse = new Map()
  for (const e of dirs(PROJECTS)) {
    const dir = join(PROJECTS, e.name)
    let memories = 0
    try { memories = readdirSync(join(dir, 'memory')).filter((f) => f.endsWith('.md') && f !== 'MEMORY.md').length } catch {}
    const sessions = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    let last = 0
    for (const f of sessions) {
      const mtime = statSync(join(dir, f)).mtimeMs
      last = Math.max(last, mtime)
      for (const m of (read(join(dir, f)) ?? '').matchAll(/"name":"Skill","input":\{"skill":"([^"]+)"/g)) {
        const u = skillUse.get(m[1]) ?? { uses: 0, last: 0 }
        u.uses++; u.last = Math.max(u.last, mtime); skillUse.set(m[1], u)
      }
    }
    byKey.set(e.name.toLowerCase(), { dir: e.name, memories, sessions: sessions.length, last })
  }

  // --- projects inside each workspace ---------------------------------------
  const projects = []
  const visit = (d, area, depth) => {
    for (const e of dirs(d)) {
      const p = join(d, e.name)
      const k = byKey.get(key(p))
      const isProject = ['.git', 'package.json', 'CLAUDE.md'].some((m) => existsSync(join(p, m))) || k?.memories > 0
      if (isProject) {
        const cfg = read(join(p, '.git', 'config'))
        projects.push({
          area, name: e.name, path: short(p),
          claude_md: existsSync(join(p, 'CLAUDE.md')),
          code: existsSync(join(p, 'package.json')) || existsSync(join(p, '.git')),
          memories: k?.memories ?? 0, sessions: k?.sessions ?? 0, last_session: day(k?.last),
          remote: cfg?.match(/url = .*github\.com[/:](.+?)(\.git)?\s*$/m)?.[1] ?? null,
        })
      } else if (depth < 2) visit(p, area, depth + 1)
    }
  }
  for (const w of setup.workspaces ?? []) {
    if (!existsSync(abs(w.path))) add('medium', 'Workspace folder not found', `${w.name}: ${w.path}. Fix it in setup.json.`, 'setup.json')
    else visit(abs(w.path), w.name, 0)
  }

  // --- instructions ----------------------------------------------------------
  const instr = (f, level) => {
    const t = read(f)
    return t == null ? null : { level, path: short(f), lines: t.split('\n').length, updated: day(statSync(f).mtimeMs) }
  }
  const instructions = [
    instr(join(CLAUDE, 'CLAUDE.md'), 'global'),
    instr(join(HOME, 'CLAUDE.md'), 'home'),
    ...(setup.workspaces ?? []).map((w) => instr(join(abs(w.path), 'CLAUDE.md'), 'area')),
    VAULT && instr(join(VAULT, 'CLAUDE.md'), 'area'),
    ...projects.filter((p) => p.claude_md).map((p) => instr(join(abs(p.path), 'CLAUDE.md'), 'project')),
  ].filter(Boolean)
  if (instructions.some((i) => i.level === 'home')) {
    add('medium', 'Loose CLAUDE.md in your home folder', 'It loads in every session of every project. Move what matters to ~/.claude/CLAUDE.md or to an area CLAUDE.md.', '~')
  }
  if (!instructions.some((i) => i.level === 'global')) add('info', 'No global CLAUDE.md', 'Copy claude/CLAUDE.global.md from the repo to ~/.claude/CLAUDE.md.', '~/.claude')

  // --- skills -----------------------------------------------------------------
  const skills = dirs(join(CLAUDE, 'skills')).map((e) => {
    const u = skillUse.get(e.name)
    return { name: e.name, own: own.has(e.name), link: lstatSync(join(CLAUDE, 'skills', e.name)).isSymbolicLink(), uses: u?.uses ?? 0, last_use: day(u?.last) }
  }).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name))
  const unused = skills.filter((s) => !s.uses)
  if (unused.length) {
    add('info', `${unused.length} installed skill(s) never used`, `${unused.map((s) => s.name).join(', ')}. Every installed skill costs context in every session.`, '~/.claude/skills')
  }

  // --- orphan memory: the path moved, Claude no longer loads it --------------
  const live = new Set([key(HOME)])
  const walk = (d, depth) => { live.add(key(d)); if (depth < 6) for (const e of dirs(d)) walk(join(d, e.name), depth + 1) }
  for (const w of setup.workspaces ?? []) if (existsSync(abs(w.path))) walk(abs(w.path), 0)
  for (const p of [VAULT, setup.study && abs(setup.study), setup.control_tower && abs(setup.control_tower)]) if (p && existsSync(p)) walk(p, 2)
  walk(CLAUDE, 5)
  const orphans = [...byKey.entries()].filter(([k, v]) => v.memories > 0 && !live.has(k))
  if (orphans.length) {
    add('high', `${orphans.length} orphan memory folder(s)`,
      `${orphans.map(([, v]) => `${v.dir} (${v.memories})`).join('; ')}. A folder moved and Claude stopped loading these. ` +
      'Copy memory/ to the key of the new path, then delete the old one. (Or the folder sits outside your workspaces in setup.json.)', '~/.claude/projects')
  }

  // --- registry paths -------------------------------------------------------------
  const reg = json(join(INFRA, 'registry.json')) ?? {}
  const dead = Object.entries(reg.projects ?? {}).filter(([k, p]) => !k.startsWith('_') && p.path && !existsSync(abs(p.path)))
  if (dead.length) add('medium', `${dead.length} dead path(s) in registry.json`, dead.map(([k, p]) => `${k} -> ${p.path}`).join('; '), 'registry.json')

  // --- vault notes pointing at folders that no longer exist ----------------------
  if (VAULT && existsSync(VAULT)) {
    const broken = mdFiles(VAULT).filter((f) => {
      const p = (read(f) ?? '').match(/^folder:\s*(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '')
      return p && /^[A-Za-z]:|^~|^\//.test(p) && !existsSync(abs(p))
    })
    if (broken.length) add('medium', `${broken.length} vault note(s) with a missing folder:`, broken.map((f) => short(f)).join(', '), 'second brain')
  }

  // --- credentials where they should not be --------------------------------------
  const suspects = [
    join(CLAUDE, 'settings.json'), join(CLAUDE, 'settings.local.json'),
    ...instructions.map((i) => abs(i.path)),
    ...[...byKey.values()].flatMap((v) => mdFiles(join(PROJECTS, v.dir, 'memory'))),
  ]
  const leaked = suspects.map((f) => { const t = read(f); const hit = t && SECRETS.find(([re]) => re.test(t)); return hit && `${short(f)} (${hit[1]})` }).filter(Boolean)
  if (leaked.length) {
    add('high', `Credential in ${leaked.length} Claude file(s)`,
      `${leaked.join('; ')}. Move the value to ~/.claude/infra/secrets.json and revoke it: old copies stay in transcripts.`, '~/.claude')
  }

  const noClaudeMd = projects.filter((p) => p.code && !p.claude_md)
  if (noClaudeMd.length) {
    add('info', `${noClaudeMd.length} code project(s) without their own CLAUDE.md`,
      `${noClaudeMd.map((p) => p.name).join(', ')}. Stack, accounts and decisions then live only in memory, which is invisible and tied to the path.`, 'workspaces')
  }

  const s = json(join(CLAUDE, 'settings.json')) ?? {}
  const claude = {
    generated_at: new Date().toISOString(),
    instructions, projects, skills,
    config: { model: s.model ?? null, permissions: s.permissions?.allow?.length ?? 0, hooks: Object.keys(s.hooks ?? {}) },
    usage: {
      sessions: [...byKey.values()].reduce((n, v) => n + v.sessions, 0),
      memories: [...byKey.values()].reduce((n, v) => n + v.memories, 0),
    },
  }
  return { claude, findings }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { claude, findings } = audit()
  console.log(`audit: ${claude.projects.length} projects, ${claude.instructions.length} CLAUDE.md, ${claude.usage.memories} memories, ` +
    `${claude.skills.length} skills, ${claude.usage.sessions} sessions\n`)
  const order = { high: 0, medium: 1, info: 2 }
  for (const f of findings.sort((a, b) => order[a.sev] - order[b.sev])) console.log(`[${f.sev}] ${f.title}  (${f.where})\n       ${f.detail}\n`)
  if (!findings.length) console.log('no findings.')
  process.exit(findings.some((f) => f.sev === 'high') ? 1 : 0)
}
