// Runs /brain sync unattended, once a day.
// First asks brain.py whether any Claude memory changed: if nothing did, Claude is not even started
// (zero tokens). If something did, runs Claude headless inside the vault, allowed to edit notes and read
// ~/.claude, and the sync ends by refreshing the Control Tower. Output goes to ~/.claude/infra/logs/brain-sync.log.

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const HOME = homedir()
const INFRA = join(HOME, '.claude', 'infra')
const LOG = join(INFRA, 'logs', 'brain-sync.log')
const setup = JSON.parse(readFileSync(join(INFRA, 'setup.json'), 'utf8').replace(/^﻿/, ''))
const vault = setup.brain.replace(/^~/, HOME)
const python = process.platform === 'win32' ? 'python' : 'python3'
mkdirSync(join(INFRA, 'logs'), { recursive: true })
const log = (s) => appendFileSync(LOG, s.endsWith('\n') ? s : s + '\n')

log(`==== ${new Date().toISOString()}`)
const changed = spawnSync(python, [join(vault, '90-System', 'scripts', 'brain.py'), 'changed'], { encoding: 'utf8' })
if (changed.stdout.trim() === 'nothing changed') { log('No memory changed. Claude not started.'); process.exit(0) }

const r = spawnSync('claude', [
  '-p', '/brain sync',
  '--permission-mode', 'acceptEdits',
  '--add-dir', join(HOME, '.claude'),
  '--allowedTools', 'Read Grep Glob Edit Write Skill Bash(python *) Bash(python3 *) Bash(npm run collect*)',
], { cwd: vault, encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true })
log((r.stdout || '') + (r.stderr || ''))
