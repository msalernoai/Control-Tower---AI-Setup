---
name: brain
description: Keeps the user's second brain (an Obsidian vault of plain markdown). Use when they say /brain, "save this to my brain" (an idea, decision or fact), "update my second brain", "import my chats", or ask for a vault review. Modes - note <text>, sync, import <zip|json>, review. A video/post/article link to study does NOT go here: it goes to the AI Study folder.
---

# /brain

Vault path: `brain` in `~/.claude/infra/setup.json`. **Read the vault's `CLAUDE.md` before writing any
note**: format, folders and what never goes in.
Helper: `python <vault>/90-System/scripts/brain.py <cmd>` (on Windows use `python`, not `python3`).

Every new or edited note: full frontmatter, `updated:` set to today, and at least one `[[link]]` to an
existing note. Before creating, grep the vault: if the topic already has a note, **update** it instead
of duplicating. At the end of any mode, run `brain.py links` and fix what broke.

## note <text>

Loose idea, reminder or fact: `00-Inbox/YYYY-MM-DD <summary>.md` with the text and obvious links. If the
destination is clear (e.g. a fact about a client), write straight into the right note.

A video/post/article to study does not enter the vault. The study queue is AI Study (`study` in
setup.json). Say so in one line. Only when the user **applies** something does it become a note in
`40-Learning/` with "how this applies to me".

## sync

Brings the vault up to date with what changed in projects since the last sync.
1. `brain.py changed` lists Claude memory files (`~/.claude/projects/*/memory/`) changed since then.
2. For each file: read it, find the project's note (the memory folder name encodes the path, e.g.
   `c--Users-alex-Documents-Work-client-dashboard` -> [[Client Dashboard]]) and update **Decisions** and
   the why in a few lines. **Technical state (deploy, database, commit, URL) does not belong in the
   vault**: the Control Tower keeps it. Project without a note -> create one from
   `90-System/templates/Project.md` and link it from its area note or [[Home]].
   - A preference or general rule of the user -> [[How I work]].
3. **Filter credentials**: memories sometimes hold a token or password. Never copy it. Write "see REGISTRY".
4. `brain.py changed --touch` to record the new sync point.
5. Refresh the Control Tower: `npm run collect` in the folder `control_tower` from setup.json. It rewrites
   `90-System/Infra status.md` when findings change. Read that note.
6. Report in 3–5 lines what changed, plus one line if Infra status has anything under "Broken".

If the user just worked on a project in this session, include what was decided in the conversation,
even if it is not in memory yet.

## import <file.zip | conversations.json>

Claude.ai export (Settings -> Privacy -> Export data), ChatGPT export (Settings -> Data controls ->
Export) or Gemini (Google Takeout, My Activity). The format is detected.
1. `brain.py split <file>` writes one raw `.md` per new conversation to `90-System/_raw/chats/<source>/`.
   Conversations already split are skipped.
2. Go through raw files not yet in `_raw/chats/<source>/done/`, in batches of ~15:
   - **Drop** trivial ones (tests, one-line questions). Just move them to `done/`.
   - **Relevant** -> one line (date · conversation · what stayed) in a **topic note** in
     `50-Conversations/<Source>/` (e.g. `Claude - Clients`, `Claude - Career`). Own note only for a
     conversation that changes a decision or a goal.
   - Triage from the first question + last answer; read in full only what touches goals, business or decisions.
   - Mask credentials in the raw files and tell the user to revoke them.
   - Learning worth keeping -> `40-Learning/`. New fact about the user -> [[Profile]] or [[How I work]].
   - Move the processed file to `done/`.
3. More than 100 conversations: do the 100 most recent, report progress, ask before continuing.

## review

`brain.py review` -> show a short list:
- Inbox items (suggest a destination for each and offer to move them);
- study: if the AI Study folder has `source/week.json`, show its highlights; otherwise suggest 1–3
  `apply`/`study` items from `source/data.jsonl`, preferring what connects to active projects;
- `active` notes untouched for 60+ days (ask whether they are paused).
