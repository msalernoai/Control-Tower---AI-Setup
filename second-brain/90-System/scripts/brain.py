"""Deterministic helpers for the /brain skill. Standard library only.

  python brain.py split <export.zip|conversations.json|MyActivity.html>  AI chat export -> one raw .md per chat
  python brain.py changed [--touch]   Claude memory files changed since 90-System/last-sync.txt
  python brain.py links               broken [[wikilinks]] in the vault
  python brain.py review              inbox, to-study, active notes untouched for 60+ days
  python brain.py --selftest
"""
import html as htmllib
import json
import re
import sys
import zipfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

VAULT = Path(__file__).resolve().parents[2]
RAW = VAULT / "90-System" / "_raw" / "chats"
LAST_SYNC = VAULT / "90-System" / "last-sync.txt"
CLAUDE_DIR = Path.home() / ".claude"


# ---------- split ----------
def load_export(path):
    path = Path(path)
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as z:
            names = z.namelist()
            act = next((n for n in names if n.lower().endswith(("myactivity.html", "minhaatividade.html"))), None)
            if act:
                return parse_gemini_activity(z.read(act).decode("utf-8"))
            return json.loads(z.read(next(n for n in names if n.endswith("conversations.json"))).decode("utf-8"))
    if path.suffix == ".html":
        return parse_gemini_activity(path.read_text(encoding="utf-8"))
    return json.loads(path.read_text(encoding="utf-8"))


def _html_text(s):
    s = re.sub(r"<(br|/p|/li|/h\d|/tr)[^>]*>", "\n", s)
    s = re.sub(r"<li[^>]*>", "- ", s)
    return re.sub(r"\n{3,}", "\n\n", htmllib.unescape(re.sub(r"<[^>]+>", "", s))).strip()


MONTHS = {"jan": 1, "feb": 2, "fev": 2, "mar": 3, "apr": 4, "abr": 4, "may": 5, "mai": 5, "jun": 6, "jul": 7,
          "aug": 8, "ago": 8, "sep": 9, "set": 9, "oct": 10, "out": 10, "nov": 11, "dec": 12, "dez": 12}


def parse_gemini_activity(page):
    """Google Takeout 'My Activity > Gemini Apps': one cell per prompt, newest first.
    Cells are grouped into conversations by their gemini.google.com/app/<id> link."""
    convs = {}
    for cell in page.split('class="outer-cell')[1:]:
        m = re.search(r'mdl-typography--body-1">(.*?)</div>', cell, re.S)
        if not m or not m.group(1).startswith("Prompted"):
            continue
        body = m.group(1)[len("Prompted"):]
        d = (re.search(r"<br>(\w{3})\.? (\d{1,2}), (\d{4}),? [\d:]+[^<]*<br>", body)          # Oct 1, 2026
             or re.search(r"<br>(\d{1,2}) de (\w{3})\.? de (\d{4}), [\d:]+[^<]*<br>", body))   # 1 de out. de 2026
        if not d:
            continue
        a, b, year = d.groups()
        mon, dd = (a, b) if a.isalpha() else (b, a)
        date = f"{year}-{MONTHS.get(mon.lower(), 1):02d}-{int(dd):02d}"
        prompt, answer = body[: d.start()], body[d.end():]
        cid = re.search(r"gemini\.google\.com/app/([0-9a-f]+)", cell)
        cid = cid.group(1) if cid else f"solo{len(convs)}"
        c = convs.setdefault(cid, {"source": "gemini", "id": cid, "title": None, "date": date, "msgs": []})
        c["msgs"] = [("Me", _html_text(prompt)), ("Gemini", _html_text(answer))] + c["msgs"]
        c["date"] = date
    for c in convs.values():
        c["title"] = (c["msgs"][0][1].splitlines()[0] if c["msgs"] else "")[:60] or "untitled"
    return list(convs.values())


def _iso(ts):
    if isinstance(ts, (int, float)):
        return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")
    return (ts or "")[:10]


def parse_claude(c):
    msgs = []
    for m in c.get("chat_messages", []):
        text = m.get("text") or "\n".join(p.get("text", "") for p in m.get("content", []) if p.get("type") == "text")
        if text.strip():
            msgs.append(("Me" if m.get("sender") == "human" else "Claude", text.strip()))
    return {"source": "claude", "id": c["uuid"], "title": c.get("name") or "untitled", "date": _iso(c.get("created_at")), "msgs": msgs}


def parse_chatgpt(c):
    mapping, node, chain = c.get("mapping", {}), c.get("current_node"), []
    while node:  # walk the branch the user ended on, leaf -> root
        n = mapping.get(node, {})
        m = n.get("message")
        if m and m.get("author", {}).get("role") in ("user", "assistant"):
            text = "\n".join(p for p in (m.get("content") or {}).get("parts", []) if isinstance(p, str)).strip()
            if text:
                chain.append(("Me" if m["author"]["role"] == "user" else "ChatGPT", text))
        node = n.get("parent")
    return {"source": "chatgpt", "id": c.get("conversation_id") or c.get("id"), "title": c.get("title") or "untitled",
            "date": _iso(c.get("create_time")), "msgs": chain[::-1]}


def parse(c):
    if "msgs" in c:
        return c
    return parse_chatgpt(c) if "mapping" in c else parse_claude(c)


def filename(conv):
    slug = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "", conv["title"]).strip()[:60] or "untitled"
    return f'{conv["date"]} {slug} [{conv["id"][:8]}].md'


def split(src, out=None):
    out = out or RAW
    written = 0
    for c in load_export(src):
        conv = parse(c)
        if not conv["msgs"] or any(out.rglob(f"*[[]{conv['id'][:8]}[]].md")):
            continue
        d = out / conv["source"]
        d.mkdir(parents=True, exist_ok=True)
        body = "\n\n".join(f"**{who}:** {text}" for who, text in conv["msgs"])
        (d / filename(conv)).write_text(
            f'---\nsource: {conv["source"]}\nid: {conv["id"]}\ndate: {conv["date"]}\nmessages: {len(conv["msgs"])}\n---\n'
            f'# {conv["title"]}\n\n{body}\n', encoding="utf-8")
        written += 1
    return written


# ---------- changed ----------
def changed(touch=False):
    since = datetime.fromisoformat(LAST_SYNC.read_text().strip()) if LAST_SYNC.exists() else datetime.min
    files = (CLAUDE_DIR / "projects").glob("*/memory/*.md")
    out = sorted(str(f) for f in files if datetime.fromtimestamp(f.stat().st_mtime) > since)
    if touch:
        LAST_SYNC.write_text(datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
    return out


# ---------- links / review ----------
def notes():
    return [p for p in VAULT.rglob("*.md") if not {"_raw", ".obsidian", "templates"} & set(p.parts)]


def broken_links():
    names = {p.stem for p in notes()}
    return [f"{p.relative_to(VAULT)} -> [[{t}]]" for p in notes()
            for t in re.findall(r"\[\[([^\]|#]+)", p.read_text(encoding="utf-8")) if t.strip() not in names]


def frontmatter(text):
    m = re.match(r"---\n(.*?)\n---", text, re.S)
    return dict(re.findall(r"^(\w+):[ \t]*(.*)$", m.group(1), re.M)) if m else {}


def review(today=None):
    today = today or datetime.now().date()
    inbox, study, stale = [], [], []
    for p in notes():
        rel = str(p.relative_to(VAULT))
        fm = frontmatter(p.read_text(encoding="utf-8"))
        if rel.startswith("00-Inbox"):
            inbox.append(rel)
        if fm.get("status") == "to-study":
            study.append(rel)
        try:
            if fm.get("status") == "active" and today - datetime.strptime(fm.get("updated", ""), "%Y-%m-%d").date() > timedelta(days=60):
                stale.append(rel)
        except ValueError:
            pass
    return {"inbox": inbox, "to-study": study, "stale-60d": stale}


# ---------- selftest ----------
def selftest():
    import tempfile
    claude = [{"uuid": "aaaaaaaa-1", "name": "Plan: dashboard", "created_at": "2026-09-01T10:00:00Z",
               "chat_messages": [{"sender": "human", "text": "hi"}, {"sender": "assistant", "text": "", "content": [{"type": "text", "text": "hello"}]}]}]
    gpt = [{"title": "Trip", "create_time": 1767225600.0, "conversation_id": "bbbbbbbb-2", "current_node": "c",
            "mapping": {"r": {"message": None, "parent": None},
                        "a": {"message": {"author": {"role": "user"}, "content": {"parts": ["itinerary?"]}}, "parent": "r"},
                        "x": {"message": {"author": {"role": "assistant"}, "content": {"parts": ["abandoned branch"]}}, "parent": "a"},
                        "c": {"message": {"author": {"role": "assistant"}, "content": {"parts": ["Lisbon and Porto", {"img": 1}]}}, "parent": "a"}}}]
    a, b = parse(claude[0]), parse(gpt[0])
    assert a["msgs"] == [("Me", "hi"), ("Claude", "hello")], a
    assert b["msgs"] == [("Me", "itinerary?"), ("ChatGPT", "Lisbon and Porto")] and b["date"] == "2026-01-01", b
    assert filename(a) == "2026-09-01 Plan dashboard [aaaaaaaa].md", filename(a)
    with tempfile.TemporaryDirectory() as t:
        f = Path(t) / "conversations.json"
        f.write_text(json.dumps(claude + gpt), encoding="utf-8")
        assert split(f, Path(t) / "raw") == 2
        assert split(f, Path(t) / "raw") == 0, "re-split must skip chats already on disk"
    cell = ('<div class="outer-cell x"><div class="content-cell mdl-typography--body-1">Prompted {p}<br>{d}, 10:00:00 AM EST<br><p>{a}</p></div>'
            '<a href="https://gemini.google.com/app/{c}">x</a></div>')
    g = parse_gemini_activity(cell.format(p="and the hotel?", d="Oct 2, 2026", a="Alfama", c="abc")
                              + cell.format(p="Lisbon plan", d="Oct 1, 2026", a="<li>Belem</li>", c="abc"))
    assert len(g) == 1 and g[0]["date"] == "2026-10-01" and g[0]["title"] == "Lisbon plan", g
    assert frontmatter("---\nstatus: to-study\n---\n# x")["status"] == "to-study"
    print("selftest ok")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "--help"
    if cmd == "--selftest":
        selftest()
    elif cmd == "split":
        print(f"{split(sys.argv[2])} new conversation(s) in {RAW}")
    elif cmd == "changed":
        print("\n".join(changed("--touch" in sys.argv)) or "nothing changed")
    elif cmd == "links":
        print("\n".join(broken_links()) or "all links ok")
    elif cmd == "review":
        print(json.dumps(review(), ensure_ascii=False, indent=2))
    else:
        print(__doc__)
