# AI Study: the study queue

Your queue for anything worth studying: AI, marketing, business, whatever. Videos, posts and articles
come in (YouTube, Instagram, TikTok, blogs). Claude watches or reads each one and gives it a verdict;
the ones worth it also get a guide, so you don't have to watch the video. The second brain never stores
links to study: they all land here.

```
source/data.jsonl    one item per line
source/themes.json   themes, each with an area
source/guides/<id>.md  deep guide (apply/study items only)
source/week.json     the latest "weekly digest"
source/build.py      validates everything and writes index.html
```

## "process" (the user pastes links or a chat export)
1. Extract the URLs and normalize them (drop tracking params like `?igsh=`, `?si=`). Skip any already in
   `source/data.jsonl`.
2. Look at the real content. Video: a video-watching skill if you have one (transcript first, frames
   only where needed); otherwise the transcript or the page. Article: WebFetch. Private or broken link:
   `type: "unavailable"`, `verdict: "drop"`, and say which one failed. **Never invent what a video says.**
3. Append one line to `source/data.jsonl` (id = last + 1, two digits):
   - `url`, `author`, `duration` (m:ss), `title` (clear), `added` (today, `YYYY-MM-DD`);
   - `theme`: an id from `source/themes.json`. New theme only if none fits, always with an `area`;
   - `topic`: short name of the tool or core idea. **Reuse an existing topic's exact text** when it is
     the same thing;
   - `type`: news · repeat · hype · inspiration · list · ad · rumor · you-already-have · unavailable.
     Existing topic and the new item adds nothing = `repeat`;
   - `verdict`: apply · study · drop. Be strict: "repeat" and "hype" are almost always drop;
   - `summary`: 2–4 concrete sentences (tools, numbers, steps);
   - `for_you`: tie it to the user's real projects (read the vault's `Home.md`). No real link? Say so;
   - `next`: the next step in one sentence, with an estimated time;
   - `links`: repos or pages mentioned, `[{ "name", "url" }]`.
4. Verdict apply or study: write `source/guides/<id>.md` (template below).
5. Run `python source/build.py` and check the count it prints.
6. Reply with one line per link: title -> verdict (+ "guide" and/or "repeats <topic>").

## Guide template (`source/guides/<id>.md`)
Plain language, concrete, **nothing invented**: what could not be confirmed is written as unconfirmed.
```markdown
## What it really is
Checked at the source (repo, official docs, product page), not only in what the video says.
## Status
Does it exist? License, price, last release. `Checked on YYYY-MM-DD.`
## Do you already have it?
Compare with what is installed (~/.claude/skills, plugins, MCPs) and with the vault's projects.
## Step by step to try it
In which real project, with commands and estimated time.
## Traps and hype
What the video exaggerates, leaves out, or what breaks terms of service.
## Sources
- [name](url)
```

## "weekly digest"
1. Re-read the queue and the vault's active projects.
2. Write `source/week.json`: `{"date": "YYYY-MM-DD", "note": "1 sentence", "highlights": [{"id": "07", "why": "1 sentence tied to a project"}]}`
   with 3 apply/study highlights. Ask the user what they already watched if you don't know.
3. Run the build and reply with the same 3.

## Afterwards
When the user actually applies something, the learning becomes a note in the vault's `40-Learning/`.
