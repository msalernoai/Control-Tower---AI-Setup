# Second brain: vault rules

Plain markdown, opened in Obsidian. Entry point: [[Home]]. About the owner: [[Profile]].

## Where things go
| Folder | What |
|---|---|
| `00-Inbox/` | raw capture not processed yet (idea, loose fact) |
| `10-Me/` | who I am, how I work, tools, goals |
| `20-Work/` | one note per client or work project |
| `30-Personal/` | personal life and side projects |
| `40-Learning/` | what I learned by applying it (the study queue lives in AI Study) |
| `50-Conversations/` | summaries of imported AI chats, by source |
| `90-System/` | templates, scripts, `_raw/` (raw exports, outside the graph) |

## Note format
- File name is the title and is unique in the vault (`Acme Plumbing.md`, not `notes.md`), so a
  wikilink is never ambiguous.
- Frontmatter: `type` (person | area | project | client | learning | conversation | capture),
  `area`, `status`, `tags`, `folder` (path on disk, if any), `updated` (YYYY-MM-DD).
- Project status: `active | paused | done`. Learning status: `to-study | studying | learned`.
- Short body: **What it is · Current state · Decisions · Links**. Technical detail stays in the repo or
  the project's memory; the note points there.
- Every new file links at least one existing note. A note without links is a lost note.
- Dates are always absolute (2026-09-30), never "yesterday".

## Never
- Paste a credential value (token, password, service key). Write where it lives instead.
- Push this vault to GitHub or any public cloud.

## Maintenance
Skill `/brain` (`note`, `sync`, `import`, `review`). The last sync is in `90-System/last-sync.txt`.
