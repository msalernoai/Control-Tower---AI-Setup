"""Validates the study queue and writes ../index.html (open it in the browser).

  python source/build.py

Seen/unseen checkmarks live in the browser's localStorage, per machine.
"""
import html
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent / "index.html"
VERDICTS = ("apply", "study", "drop")
REQUIRED = ("id", "url", "title", "added", "theme", "topic", "type", "verdict", "summary")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    themes = {t["id"]: t for t in json.loads((SRC / "themes.json").read_text(encoding="utf-8"))}
    items, errors = [], []
    for n, line in enumerate((SRC / "data.jsonl").read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        it = json.loads(line)
        errors += [f"line {n}: missing {k}" for k in REQUIRED if k not in it]
        if it.get("verdict") not in VERDICTS:
            errors.append(f"line {n}: verdict must be one of {VERDICTS}")
        if it.get("theme") not in themes:
            errors.append(f"line {n}: unknown theme {it.get('theme')!r}")
        guide = SRC / "guides" / f"{it.get('id')}.md"
        it["guide"] = guide.read_text(encoding="utf-8") if guide.exists() else ""
        it["area"] = themes.get(it.get("theme"), {}).get("area", "")
        items.append(it)
    if errors:
        print("\n".join(errors))
        sys.exit(1)

    week = SRC / "week.json"
    data = {"items": items, "themes": themes, "week": json.loads(week.read_text(encoding="utf-8")) if week.exists() else None}
    OUT.write_text(PAGE.replace("__DATA__", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")), encoding="utf-8")
    missing = [i["id"] for i in items if i["verdict"] in ("apply", "study") and not i["guide"]]
    counts = {v: sum(i["verdict"] == v for i in items) for v in VERDICTS}
    print(f"{len(items)} items ({counts}) -> {OUT.name}" + (f"\nguides missing: {', '.join(missing)}" if missing else ""))


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>AI Study</title>
<style>
:root{--bg:#f7f6f2;--card:#fff;--ink:#1d1c1a;--mute:#6d6b65;--line:#e4e2db;--apply:#2f855a;--study:#2b6cb0;--drop:#9a9892}
@media (prefers-color-scheme:dark){:root{--bg:#151514;--card:#1f1e1c;--ink:#edece7;--mute:#9b9993;--line:#32312e;--apply:#5fbf8a;--study:#6ca6e8;--drop:#77756f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,sans-serif}
.w{max-width:900px;margin:auto;padding:20px 16px}h1{margin:0 0 4px;font-size:22px}.m{color:var(--mute);font-size:13px}
.bar{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0}.bar button{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;padding:4px 12px;font:inherit;font-size:13px;cursor:pointer}
.bar button.on{background:var(--ink);color:var(--bg)}
.c{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:10px 0}
.c.seen{opacity:.55}.v{font-size:12px;font-weight:600;text-transform:uppercase}.apply{color:var(--apply)}.study{color:var(--study)}.drop{color:var(--drop)}
.c h3{margin:4px 0;font-size:16px}.c a{color:inherit}details{margin-top:6px}pre{white-space:pre-wrap;font:inherit;font-size:14px}
label{font-size:13px;color:var(--mute);cursor:pointer}
</style></head><body><div class="w"><h1>AI Study</h1><div class="m" id="sub"></div><div id="week"></div>
<div class="bar" id="bar"></div><div id="list"></div></div>
<script>
const D=__DATA__;const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let seen={};try{seen=JSON.parse(localStorage.getItem('seen')||'{}')}catch{}
let f='apply+study';const F={'apply+study':'Worth it','apply':'Apply','study':'Study','drop':'Dropped','all':'All'};
function save(){try{localStorage.setItem('seen',JSON.stringify(seen))}catch{}}
function render(){
 document.getElementById('sub').textContent=D.items.length+' items';
 document.getElementById('week').innerHTML=D.week?'<div class="c"><b>This week</b> <span class="m">'+esc(D.week.date)+'</span><p>'+esc(D.week.note)+'</p>'+D.week.highlights.map(h=>'<div>#'+esc(h.id)+' · '+esc(h.why)+'</div>').join('')+'</div>':'';
 document.getElementById('bar').innerHTML=Object.entries(F).map(([k,v])=>'<button class="'+(k===f?'on':'')+'" onclick="f=\\''+k+'\\';render()">'+v+'</button>').join('');
 const show=D.items.filter(i=>f==='all'||f.split('+').includes(i.verdict)).reverse();
 document.getElementById('list').innerHTML=show.map(i=>'<div class="c '+(seen[i.id]?'seen':'')+'"><span class="v '+i.verdict+'">'+i.verdict+'</span> <span class="m">#'+i.id+' · '+esc(i.area)+' · '+esc(i.topic)+' · '+esc(i.type)+' · '+esc(i.added)+'</span>'+
  '<h3><a href="'+esc(i.url)+'" target="_blank" rel="noopener">'+esc(i.title)+'</a></h3><div>'+esc(i.summary)+'</div>'+
  (i.for_you?'<div class="m">For you: '+esc(i.for_you)+'</div>':'')+(i.next?'<div class="m">Next: '+esc(i.next)+'</div>':'')+
  (i.guide?'<details><summary>Guide</summary><pre>'+esc(i.guide)+'</pre></details>':'')+
  '<label><input type="checkbox" '+(seen[i.id]?'checked':'')+' onchange="seen[\\''+i.id+'\\']=this.checked;save();render()"> seen</label></div>').join('')||'<p class="m">Nothing here.</p>';
}
render();
</script></body></html>"""

if __name__ == "__main__":
    main()
