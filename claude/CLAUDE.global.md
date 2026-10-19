# Where context lives
<!-- Template for ~/.claude/CLAUDE.md. Loads in EVERY session, so keep it short: only what is true everywhere. -->

- Each area has its own CLAUDE.md that applies to its subfolders (see `workspaces` in
  `~/.claude/infra/setup.json`). Rules for one area go there, not here.
- Moved or renamed a folder? Claude's memory (`~/.claude/projects/<path>/memory`), the registry and the
  `folder:` field in vault notes all depend on the path. Run `node ~/.claude/infra/audit.mjs`.

# Infra (accounts and credentials)
- Before touching an API key, a database account or a deploy domain, read `~/.claude/infra/REGISTRY.md`.
- Credential values live in `~/.claude/infra/keys.json` (Gemini pool) and `secrets.json` (everything
  else). Never copy a value into a repo, a doc, a memory, a vault note or a message, and never ask me to
  paste a token: scripts read it from there.
- Control Tower: `npm run collect` in the control-tower folder refreshes the dashboard now.

# Second brain
The vault path is `brain` in `~/.claude/infra/setup.json`.
- When starting a new project, planning, or answering a strategy question: read the vault's `Home.md`
  and `10-Me/How I work.md`, and grep the vault for the topic before proposing. Cite the note you used.
- "Save this" (an idea, a decision, a fact): skill `brain`.
- A link to a video, post or article to study goes to the AI Study folder (`study` in setup.json), not
  to the vault.
- Who keeps what: **vault** = decisions and the why · **Control Tower** = technical state, generated ·
  **Claude memory** = how to work in each project · **AI Study** = the study queue.

# Code
- Read the whole flow before writing. Then pick the simplest thing that works: what the project already
  has, then the standard library or a native feature, and only then new code.
- No abstraction, dependency or "for later" that nobody asked for. Fix bugs at the cause.
