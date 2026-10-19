"""Summarizes recent Claude Code sessions for the reflect skill.

Usage: python sessions.py [--days 14] [--max 300] [--project <part of the folder name>]

Reads ~/.claude/projects/*/*.jsonl and prints, per session: project, date, the user's requests
(truncated) and the skills and commands used. At the end, skill and tool counts.
Anything that looks like a credential is replaced with [SECRET].
"""
import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

SECRET = re.compile(
    r"(sbp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}"
    r"|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|[A-Za-z0-9_-]{40,})"
)
COMMAND = re.compile(r"<command-name>(/?[^<]+)</command-name>")


def user_text(content):
    if isinstance(content, str):
        return [content]
    return [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--max", type=int, default=300, help="characters per request")
    ap.add_argument("--project", default="")
    a = ap.parse_args()

    root = Path.home() / ".claude" / "projects"
    since = time.time() - a.days * 86400
    files = sorted(
        (f for f in root.glob("*/*.jsonl") if f.stat().st_mtime >= since and a.project.lower() in f.parent.name.lower()),
        key=lambda f: f.stat().st_mtime,
    )
    skills_total, tools_total = Counter(), Counter()

    for f in files:
        requests, skills = [], Counter()
        start = None
        for line in f.open(encoding="utf-8", errors="replace"):
            try:
                d = json.loads(line)
            except json.JSONDecodeError:
                continue
            if d.get("isSidechain"):
                continue
            msg = d.get("message") or {}
            if d.get("type") == "user":
                start = start or d.get("timestamp", "")[:10]
                for t in user_text(msg.get("content", "")):
                    cmd = COMMAND.search(t)
                    if cmd:
                        skills[cmd.group(1).strip()] += 1
                        continue
                    if not t.strip() or t.lstrip().startswith("<"):
                        continue
                    t = SECRET.sub("[SECRET]", " ".join(t.split()))
                    requests.append(t[: a.max] + ("..." if len(t) > a.max else ""))
            elif d.get("type") == "assistant" and isinstance(msg.get("content"), list):
                for b in msg["content"]:
                    if b.get("type") == "tool_use":
                        tools_total[b.get("name", "?")] += 1
                        if b.get("name") == "Skill":
                            skills[(b.get("input") or {}).get("skill", "?")] += 1
        if not requests and not skills:
            continue
        skills_total.update(skills)
        print(f"\n## {f.parent.name} · {start} · {f.stem[:8]}")
        if skills:
            print("skills and commands: " + ", ".join(f"{k} ({v})" for k, v in skills.most_common()))
        for r in requests:
            print(f"- {r}")

    print(f"\n# Total: {len(files)} sessions in the last {a.days} days")
    print("skills and commands: " + (", ".join(f"{k} ({v})" for k, v in skills_total.most_common()) or "none"))
    print("tools: " + ", ".join(f"{k} ({v})" for k, v in tools_total.most_common(15)))


if __name__ == "__main__":
    main()
