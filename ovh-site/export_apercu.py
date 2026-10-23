#!/usr/bin/env python3
"""Aperçu statique du paquet OVH, publiable sur GitHub Pages dans un sous-dossier.

Usage : python3 ovh-site/export_apercu.py [dossier du paquet généré] [dossier de sortie]
Par défaut : ovh-site/dist/Williams_Harper_OVH_Nouvelle_Base → ovh-apercu/

Les 40 gabarits PHP deviennent des pages HTML aux adresses du site (…/villa-chloe-marrakech.html),
les liens absolus (/assets/…, /demande-reservation-villa) deviennent relatifs, et seuls les fichiers
réellement référencés sont copiés. Les formulaires et le conseiller (PHP) ne fonctionnent pas dans l'aperçu ;
les brochures PDF sont incluses.
"""
import json, pathlib, re, shutil, sys, urllib.parse

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
SRC = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "dist/Williams_Harper_OVH_Nouvelle_Base"
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else REPO / "ovh-apercu"
# chemin public de l'aperçu (pour les url() dans les variables CSS, que Chrome résout par rapport à la feuille de style)
BASEPATH = sys.argv[3] if len(sys.argv) > 3 else "/williams-harper/ovh-apercu/"

paths = json.loads((SRC / "app/url-paths.json").read_text())
# adresse du site -> fichier de l'aperçu
page_file = {}
for lang, pages in paths.items():
    for page, url in pages.items():
        rel = urllib.parse.unquote(url).lstrip("/")
        rel = rel + "index.html" if (rel == "" or rel.endswith("/")) else rel + ".html"
        page_file[urllib.parse.unquote(url).rstrip("/") or "/"] = rel
        page_file[url.rstrip("/") or "/"] = rel

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)

ATTR = re.compile(r'\b(href|src|poster|action)="/([^"]*)"')
needed = set()

def rewrite(html, depth):
    prefix = "../" * depth
    def repl(m):
        attr, rest = m.group(1), m.group(2)
        path, sep, tail = re.split(r'(?=[#?])', "/" + rest, maxsplit=1) + ["", ""] if False else ("/" + rest, "", "")
        # séparer ancre / paramètres
        mm = re.match(r'([^#?]*)(.*)', "/" + rest)
        path, tail = mm.group(1), mm.group(2)
        key = urllib.parse.unquote(path).rstrip("/") or "/"
        if key in page_file:
            return f'{attr}="{prefix}{page_file[key]}{tail}"'
        return f'{attr}="{prefix}{path.lstrip("/")}{tail}"'
    html = ATTR.sub(repl, html)
    # adresses de pages écrites dans les scripts (cartes des villas de l'accueil, etc.) : "/villa-chloe-marrakech"
    for key in sorted(page_file, key=len, reverse=True):
        if key == "/":
            continue
        for q in ('"', "'"):
            html = html.replace(f'{q}{key}{q}', f'{q}{prefix}{page_file[key]}{q}')
            html = html.replace(f'{q}{key}/{q}', f'{q}{prefix}{page_file[key]}{q}')
    # ressources écrites dans les scripts ou des attributs data-* : "/assets/…"
    for q in ('"', "'"):
        html = html.replace(f'{q}/assets/', f'{q}{prefix}assets/')
    # url() dans des variables CSS inline (photos des cartes de villas) : adresse absolue, sinon Chrome la résout depuis assets/
    html = re.sub(r"url\((['\"]?)(?:\.\./)*assets/", lambda m: f"url({m.group(1)}{BASEPATH}assets/", html)
    # même chose quand l'adresse vient d'un tableau JS : url('${["assets/…", …][i]}')
    html = re.sub(r"(url\('\$\{\[)(.*?)(\])", lambda m: m.group(1) + re.sub(r'"(?:\.\./)*assets/', '"' + BASEPATH + 'assets/', m.group(2)) + m.group(3), html)
    return html

n = 0
for lang, pages in paths.items():
    for page, url in pages.items():
        src = SRC / "app/templates" / lang / f"{page}.html"
        if not src.exists():
            continue
        rel = page_file[urllib.parse.unquote(url).rstrip("/") or "/"]
        depth = rel.count("/")
        html = rewrite(src.read_text(), depth)
        html = html.replace('<a href="#villas"', '<a href="#collection"') if page == "index" else html
        # titre d'onglet : en production il est injecté par le PHP (<!--WH_SEO_HEAD-->)
        h = re.search(r'<h1[^>]*>(.*?)</h1>', html, flags=re.S)
        titre = re.sub(r'<[^>]+>', ' ', h.group(1)).strip() if h else page
        titre = re.sub(r'\s+', ' ', titre)
        html = html.replace('<!--WH_SEO_HEAD-->', f'<title>{titre} · Williams &amp; Harper</title><meta name="robots" content="noindex">', 1)
        out = OUT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(html)
        n += 1
        for a in re.findall(r'assets/([A-Za-z0-9_\-\./%]+)', html):
            needed.add(urllib.parse.unquote(a))

# fichiers référencés par le CSS / JS
for extra in ("wh-base.css", "concierge.css", "concierge.js", "concierge-knowledge.js", "reservation.js", "site-navigation.js", "seo-routes.js", "construction.css"):
    f = SRC / "www/assets" / extra
    if f.exists():
        needed.add(extra)
        for a in re.findall(r'assets/([A-Za-z0-9_\-\./%]+)', f.read_text(errors="ignore")):
            needed.add(urllib.parse.unquote(a))
        for a in re.findall(r'url\((["\']?)(?!data:|http)([^)"\']+)', f.read_text(errors="ignore")):
            needed.add(pathlib.Path(a[1]).name)

# brochures PDF (4 × ~32 Mo) et plans
broch = SRC / "www/brochures"
if broch.exists():
    shutil.copytree(broch, OUT / "brochures")
# plans PDF (légers) référencés par les pages
plans = SRC / "www/plans"
if plans.exists():
    shutil.copytree(plans, OUT / "plans")
(OUT / "assets").mkdir()
copied = skipped = 0
for name in sorted(needed):
    f = SRC / "www/assets" / name
    if f.exists() and f.is_file():
        (OUT / "assets" / name).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(f, OUT / "assets" / name); copied += 1
    else:
        skipped += 1
# le bouton du conseiller (JS) charge son écusson à la racine : chemin recalculé depuis l'adresse de la page
cj = OUT / "assets/concierge.js"
if cj.exists():
    js = cj.read_text()
    js = js.replace("'/assets/logo-definitif-ecusson-fonce.svg'", "(location.pathname.replace(/\\/(en|nl|ar)\\/[^/]*$|\\/[^/]*$/, '/') + 'assets/logo-definitif-ecusson-fonce.svg')")
    cj.write_text(js)
(OUT / ".nojekyll").write_text("")
size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()) // 1_000_000
print(f"{n} pages, {copied} fichiers copiés ({skipped} référencés introuvables), {size} Mo dans {OUT}")
