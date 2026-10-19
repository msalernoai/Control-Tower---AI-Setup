---
name: reflect
description: Looks at the user's recent Claude Code sessions, finds work they keep repeating and proposes the smallest useful improvement (a CLAUDE.md line, a memory, a new or extended skill, a script, a hook, or nothing). Use when they say /reflect, "what do I keep repeating?", "learn from my sessions", "what should become a skill?", "improve my workflow" or ask to review their own setup. Not for implementing, debugging or reviewing code.
metadata:
  source: "adapted from akitaonrails/my-skills/reflect"
---

# Reflect

Learn from repeated work. Look at recent sessions, existing instructions and skills, and recommend the
**smallest** change that fixes a real friction. "Create nothing" is a good result when evidence is weak.

Use: `/reflect` (everything, last 14 days) or `/reflect <focus>`.

## Rules

- Evidence before proposals: a strong pattern shows up at least twice, has a stable input, a clear output
  and a stopping point.
- Check whether it already exists before proposing something new. Extending beats a near-duplicate.
- **Propose and wait.** Do not touch CLAUDE.md, skills, memory, settings or hooks without approval.
- No "for later" skills, specialist agents or generic rules that make Claude more anxious, expensive or pushy.
- The script replaces anything that looks like a token with `[SECRET]`. If a value slips through, never
  copy it into a report, skill, memory or vault.

## 1. Inventory

- Instructions: `~/.claude/CLAUDE.md`, the area ones (workspaces in `~/.claude/infra/setup.json`) and project ones.
- Memories: `~/.claude/projects/*/memory/*.md`.
- Skills: `~/.claude/skills/*/SKILL.md` and plugin skills listed in the session.
- Infra and scripts: `~/.claude/infra/`.
- How the user works: `<vault>/10-Me/How I work.md`.
- Hooks and permissions: `~/.claude/settings.json`.

## 2. Read the sessions

```bash
python ~/.claude/skills/reflect/scripts/sessions.py --days 14 --max 200 > <scratchpad>/sessions.md
```

Flags: `--days N`, `--max <chars per request>`, `--project <part of the folder name>`. The output is
large (~6 KB per day): save it and read in parts. Open a full `.jsonl` only when you need to see what
Claude actually did.

## 3. Look for signals

- The same request or sequence across sessions or projects.
- A rule explained again ("I told you", "again", "always", "never", the same correction).
- The same context-gathering at the start of every session.
- A skill that should have fired and did not, or one never used.
- A manual step a script would remove.
- A repeated mistake because an instruction, tool or limit is missing.

## 4. Score each candidate

Frequency, cost (time, tokens, attention), risk of doing it differently each time, stability of input
and output, current coverage. Only recommend with high confidence.

## 5. Pick the smallest form that works

1. **Nothing** (weak, isolated, sensitive or already covered).
2. **One line** in the right CLAUDE.md or a memory.
3. **Extend** an existing skill.
4. **New skill** (a procedure that repeats the same way).
5. **Script** in `~/.claude/infra` or the project.
6. **Hook or permission** in settings (automatic behavior).

## 6. Report

```
Findings
- <pattern>: evidence (sessions/dates), frequency, recommended form.

Recommend
- <where>: what changes in one line, and why it is the smallest form.

Skipped
- <candidate>: why.

Not enough evidence
- <candidate>: what would make it actionable.

Apply?
```

If nothing passes: "No strong repeated pattern. I would not change anything now."
