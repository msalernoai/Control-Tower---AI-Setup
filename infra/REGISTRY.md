# Registry

The human-readable side of `registry.json`. When they disagree, the JSON wins.

| File | Holds | In git? |
|---|---|---|
| `setup.json` | your name and folders (workspaces, brain, study) | no |
| `registry.json` | accounts, projects and where each one lives | no |
| `keys.json` | the Gemini key pool | no, ever |
| `secrets.json` | every other credential (Supabase PATs, Vercel, GitHub) | no, ever |

These files sit in plain text inside `~/.claude/`, readable by any Claude Code session on this
machine. Same risk profile as a `.env`, with a wider reach. Keep the disk encrypted and never copy a
value out of them.

## Rules for Claude

- Before touching a key, an account or a domain, read this file.
- A credential value never goes into a repo, a doc, a memory, a vault note or a chat message. Write
  where it lives instead ("PAT in `secrets.json`").
- Scripts read the values themselves. Never ask the user to paste a token.

## Gemini key pool, in one picture

> The **Google Cloud project** is the tap: the quota belongs to it.
> The **key** opens the tap. Two keys on the same tap give no extra water.
> The **Google account** is the house: it can hold a couple of taps.

So: one key per GCP project, at most two projects per Google account (stacking more is what gets a
project flagged with `403 PERMISSION_DENIED`). `gcp_project` in `keys.json` is the field that tells
quota buckets apart.

- `node ~/.claude/infra/check-keys.mjs` tests every key once (1 request each).
- `gemini/gemini.js` is the client your apps import: it walks keys and models until one answers.

## Projects

| Project | Where | Supabase | Vercel | Gemini |
|---|---|---|---|---|
| My App | `~/Documents/Work/my-app` | `abcdefghijklmnop` | my-app.vercel.app | yes |
