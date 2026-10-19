// Puts every piece of this repo where Claude Code expects it. Never overwrites a file you already have.
//
//   node setup.mjs --dry-run   show what would be copied
//   node setup.mjs             copy
//
// First run creates ~/.claude/infra/setup.json from setup.example.json and stops, so you can fill in
// your own folders before anything else is copied.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = dirname(fileURLToPath(import.meta.url))
const HOME = homedir()
const CLAUDE = join(HOME, '.claude')
const INFRA = join(CLAUDE, 'infra')
const SETUP = join(INFRA, 'setup.json')
const dry = process.argv.includes('--dry-run')
const abs = (p) => p.replace(/^~/, HOME)

if (!existsSync(SETUP)) {
  if (!dry) { mkdirSync(INFRA, { recursive: true }); cpSync(join(REPO, 'setup.example.json'), SETUP) }
  console.log(`Created ${SETUP}.\nEdit it (your name, your folders), then run node setup.mjs again.`)
  process.exit(0)
}
const setup = JSON.parse(readFileSync(SETUP, 'utf8').replace(/^﻿/, ''))

// [from inside the repo, to on this machine]
const plan = [
  ['infra', INFRA],
  ['infra/registry.example.json', join(INFRA, 'registry.json')],
  ['infra/keys.example.json', join(INFRA, 'keys.json')],
  ['infra/secrets.example.json', join(INFRA, 'secrets.json')],
  ['claude/skills', join(CLAUDE, 'skills')],
  ['claude/CLAUDE.global.md', join(CLAUDE, 'CLAUDE.md')],
  ['second-brain', abs(setup.brain)],
  ['ai-study', abs(setup.study)],
]

const files = (p) => statSync(p).isDirectory() ? readdirSync(p).flatMap((n) => files(join(p, n))) : [p]
let copied = 0, kept = 0
for (const [from, to] of plan) {
  const src = join(REPO, from)
  const isDir = statSync(src).isDirectory()
  for (const f of files(src)) {
    if (f.endsWith('.example.json')) continue   // the examples land under their real names above
    const dest = isDir ? join(to, relative(src, f)) : to
    if (existsSync(dest)) { kept++; continue }
    console.log(`${dry ? 'would copy' : 'copy'}  ${relative(REPO, f)}  ->  ${dest.replace(HOME, '~')}`)
    if (!dry) { mkdirSync(dirname(dest), { recursive: true }); cpSync(f, dest) }
    copied++
  }
}
console.log(`\n${copied} file(s) ${dry ? 'to copy' : 'copied'}, ${kept} already there (left untouched).`)
if (!dry) console.log('Next: node ~/.claude/infra/audit.mjs, then npm run collect inside control-tower/.')
