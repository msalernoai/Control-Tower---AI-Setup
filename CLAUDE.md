# Installing this kit for someone (instructions for Claude)

The person who sent you this repo most likely does not use the terminal. They want you to install
it on their machine and shape it around their work. You run every command; they answer questions.
Talk to them in their language, in plain words, with no jargon and no commands shown unless they ask.

## 1. Get the repo
If you are not inside it yet, clone it to `~/Documents/Control Tower & AI Setup` and work from there.
Check that Node 18+, Python 3 and Git exist. If one is missing, tell them in one line what to install
and wait for them to confirm.

## 2. Interview (short, one round if possible)
Before you ask, look around: list `~/Documents` (and `~/Desktop`, OneDrive) to suggest folders
instead of asking for paths. Then ask:
- Their name and what they do (role, clients or areas of work).
- Which folders hold their work, and how to group them (e.g. "Clients", "Internal", "Personal").
  These become `workspaces`.
- Where the second brain and the study queue should live (suggest `~/Documents/SecondBrain` and
  `~/Documents/AI Study`). Do they use Obsidian? (Optional: the vault is plain markdown.)
- Do they use Gemini API keys, Supabase, Vercel? If not, skip all of that.
- Should it update by itself (hourly dashboard, nightly brain sync)?

## 3. Install
1. `node setup.mjs` once (it creates `~/.claude/infra/setup.json`), write their answers into that file,
   then `node setup.mjs` again. It never overwrites existing files: if they already have a
   `~/.claude/CLAUDE.md` or skills with the same names, merge by hand and show them what changed.
2. Fill the second brain from the interview: `10-Me/Profile.md`, `10-Me/How I work.md`, one note per
   area in `20-Work/` linked from `Home.md`.
3. Adapt `~/.claude/CLAUDE.md`: keep the structure, cut what does not apply (e.g. the infra section if
   they have no keys), add their area rules. Create an area `CLAUDE.md` at the root of each workspace
   from `claude/CLAUDE.area.md`.
4. AI Study: replace the two example items (keep the file empty if they have nothing yet) and set
   themes in `source/themes.json` that match their work.
5. Keys or accounts: never ask them to paste a key in the chat. Open `~/.claude/infra/keys.json` or
   `secrets.json` for them to fill themselves, then run `check-keys.mjs`.
6. Run `node ~/.claude/infra/audit.mjs`, then `npm run collect` and `npm start` in `control-tower/`,
   and give them the link http://localhost:4321.
7. If they want it automatic: Windows, run `scheduling/windows/register-tasks.ps1`; Mac/Linux, add the
   lines from `scheduling/crontab.example` to their crontab.

## 4. Wrap up
Tell them in 5 lines or less: where each piece lives, how to open the dashboard, and the three things to
say from now on: "save this to my brain", "process these links" (in the AI Study folder), "/reflect".
