# Control Tower & AI Setup

A starter kit for running Claude Code like a system instead of a chat window. It gives you four pieces
that feed each other, plus a local dashboard that tells you when something breaks.

Everything personal (keys, notes, memories, the dashboard's data) stays on your machine. This repo
holds only the structure, the scripts and example data.

## The four pieces

| Piece | What it is | Who writes it | Lives in |
|---|---|---|---|
| **Claude instructions** | `CLAUDE.md` files in layers: global → area → project | you | `~/.claude/CLAUDE.md`, each workspace, each repo |
| **Claude memory** | small facts Claude saves per project ("deploy is manual") | Claude | `~/.claude/projects/<path>/memory/` |
| **Second brain** | an Obsidian vault: who you are, how you work, decisions and the why | you + the `brain` skill | any folder you choose |
| **AI Study** | a queue of videos/posts/articles, each with a verdict and a guide | Claude, from links you paste | any folder you choose |

And one more that watches the others:

| **Control Tower** | local dashboard: projects, git state, CLAUDE.md layers, skills, memories, Gemini key pool, and a list of findings ("orphan memory", "credential in a Claude file", "uncommitted for a week") | a collector script, every hour | `control-tower/` |

### How they connect

```
 you paste a link ──► AI Study ──(you apply it)──► Second brain: 40-Learning
                                                        ▲
 you work in a project ──► Claude memory ──(/brain sync, nightly)──┘
                                │
 ~/.claude/infra (keys, registry) ──► Control Tower ◄── audit.mjs (instructions, skills, memory)
                                          │
                                          └──► writes "Infra status" note into the second brain
```

Each place has one job, so nothing is written twice:
**vault** = decisions and the why · **Control Tower** = technical state, generated ·
**Claude memory** = how to work in each project · **AI Study** = what to learn next.

## Easiest way: let Claude install it

Open Claude Code and send:

> Install and set up this for me, adapted to how I work: https://github.com/msalernoai/Control-Tower---AI-Setup

Claude follows [CLAUDE.md](CLAUDE.md): asks a few questions about your work, installs everything,
fills your second brain and opens the dashboard. You never touch the terminal.

## Manual quick start (15 minutes)

Needs: [Claude Code](https://docs.claude.com/en/docs/claude-code), Node 18+, Python 3, Git.
[Obsidian](https://obsidian.md) is optional (the vault is plain markdown).

```bash
git clone https://github.com/msalernoai/Control-Tower---AI-Setup.git
cd Control-Tower---AI-Setup

node setup.mjs              # 1st run: creates ~/.claude/infra/setup.json and stops
# edit ~/.claude/infra/setup.json: your name and your folders
node setup.mjs --dry-run    # see what will be copied
node setup.mjs              # copy (never overwrites a file you already have)

node ~/.claude/infra/audit.mjs   # first health check
cd control-tower && npm run collect && npm start   # http://localhost:4321
```

Before the first `collect`, the dashboard shows example data so you can see what it does.

Optional, after it works:
- **Gemini key pool:** fill `~/.claude/infra/keys.json`, run `node ~/.claude/infra/check-keys.mjs`.
- **Run it on a schedule:** Windows `powershell -ExecutionPolicy Bypass -File scheduling\windows\register-tasks.ps1`;
  macOS/Linux see `scheduling/crontab.example`.

## Make it yours

Everything you adapt is in one of these places:

| To change | Edit |
|---|---|
| Your name, which folders count as workspaces, where the vault and study queue live | `~/.claude/infra/setup.json` |
| Rules Claude follows everywhere | `~/.claude/CLAUDE.md` (from `claude/CLAUDE.global.md`) |
| Rules for one area (e.g. all client work) | a `CLAUDE.md` at the root of that folder (template: `claude/CLAUDE.area.md`) |
| Stack, accounts and decisions of one project | the project's own `CLAUDE.md` (template: `claude/CLAUDE.project.md`) |
| Your accounts and projects (no secrets) | `~/.claude/infra/registry.json` + `REGISTRY.md` |
| Vault folders and note format | the vault's `CLAUDE.md` |
| Study verdicts, themes, guide format | the AI Study folder's `CLAUDE.md` and `source/themes.json` |
| What the dashboard flags | `infra/audit.mjs` (one `add(...)` per finding) |

Rule of thumb for where a rule goes: true everywhere → global. True for one area → area. True for one
repo → project `CLAUDE.md`. A preference Claude picked up mid-session → it saves a memory on its own.

## Skills included

Copied to `~/.claude/skills/`. Each is one `SKILL.md`; read it and edit freely.

- **`brain`**: `/brain note <text>`, `/brain sync` (memory → vault decisions), `/brain import <export>`
  (Claude.ai, ChatGPT or Gemini chat history → vault), `/brain review`.
- **`reflect`**: reads your last 14 days of sessions, finds what you keep repeating and proposes the
  smallest fix (a CLAUDE.md line, a skill, a script, or nothing). Adapted from
  [akitaonrails/my-skills](https://github.com/akitaonrails/my-skills).
- **`humanizer`**: removes the "written by AI" feel from text and reviews copy without inventing facts.
  Core ideas from [blader/humanizer](https://github.com/blader/humanizer) (MIT).

## What stays private (and how)

- `keys.json`, `secrets.json`, `registry.json` and `setup.json` live in `~/.claude/infra/`, outside any
  repo. Scripts read them; you never paste a token into a chat, a repo or a note.
- The collector writes only names, counts, dates and paths. A key becomes `...a1B2`. If anything that
  looks like a credential reaches the snapshot, it writes nothing and exits.
- `audit.mjs` flags any credential that leaked into a `CLAUDE.md`, a memory or `settings.json`.
- The dashboard listens on `127.0.0.1` only, and `snapshot.json` is gitignored.
- The vault and the study queue are local folders. Do not push the vault: it is your private notes.

Caveat: files in `~/.claude/` are readable by any Claude Code session on your machine. Same risk as a
`.env`. Keep your disk encrypted.

## Repo map

```
setup.mjs / setup.example.json   install + your config template
claude/        CLAUDE.md templates, a memory example, 3 skills
infra/         goes to ~/.claude/infra: registry, key pool, audit, check-keys, gemini.js client
second-brain/  vault template (folders, Home, Profile, How I work, note templates, brain.py)
ai-study/      study queue template (rules, example items, build.py -> index.html)
control-tower/ collector + zero-dependency dashboard
scheduling/    Windows Task Scheduler + cron
```

## License

MIT.
