#!/usr/bin/env python3
"""Greffe la nouvelle base graphique Williams & Harper sur le paquet PHP OVH (4 langues).

Usage : python3 ovh-site/build_ovh.py <dossier du paquet source extrait> <dossier de sortie> [--zip chemin.zip]

Le contenu (textes, SEO, redirections, PHP, brochures, plans, photos) est conservé ;
seuls l'habillage (CSS/JS), l'en-tête, les héros et le pied de page sont refaits.
"""
import json, re, shutil, sys, pathlib, zipfile, html

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parent
VERSION = "wh-base-2026-10-22g"
LANGS = ["fr", "en", "nl", "ar"]

# Photos ajoutées (vraies vues de Chloé, film du domaine) — copiées depuis le site GitHub Pages.
EXTRA_ASSETS = {
    "chloe-hero.jpg": REPO / "img/photo-03.jpg",
    "chloe-jardin-instants.jpg": REPO / "img/photo-09.jpg",
    "chloe-sejour-double-hauteur.jpg": REPO / "img/photo-06.jpg",
    "chloe-salons.jpg": REPO / "img/photo-07.jpg",
    "domaine-film-720.mp4": REPO / "media/film-720.mp4",
    "domaine-film-poster.jpg": REPO / "media/film-poster.jpg",
    # version verticale pour téléphone (ovh-site/build_film_mobile.py)
    "domaine-film-mobile.mp4": REPO / "media/film-mobile-720.mp4",
    "domaine-film-mobile-poster.jpg": REPO / "media/film-mobile-poster.jpg",
    "bois-nobles-palette.webp": HERE / "assets/bois-nobles-palette.webp",
}
# Écran de téléphone en portrait : film vertical du domaine.
MOBILE_FILM_MQ = "(max-width: 860px) and (orientation: portrait)"
# Photos de l'autre villa (écartées) remplacées dans la galerie Chloé.
PHOTO_SWAPS = {
    "chloe-6-photo.webp": "chloe-jardin-instants.jpg",
    "chloe-interieur-6.jpeg": "chloe-sejour-double-hauteur.jpg",
    "chloe-interieur-7-photo.webp": "chloe-salons.jpg",
}
CAPTION_SWAPS = {
    "Salon · Escalier sculptural": "Séjour · Double hauteur",
    "Living room · Sculptural staircase": "Living room · Double height",
    "Woonkamer · Sculpturale trap": "Woonkamer · Dubbele hoogte",
    "غرفة الجلوس · درج بتصميم نحتي": "غرفة المعيشة · ارتفاع مزدوج",
}
HERO_IMAGES = {
    "index": "/assets/celine-exterieur-1-photo.webp",
    "chloe": "/assets/chloe-hero.jpg",
    "celine": "/assets/celine-exterieur-2-photo-or-centre.webp",
    "margaux": "/assets/margaux-exterieur-2.jpeg",
}
OLD_CSS = ("design-system.css", "header-brand.css", "navigation-finale.css", "language-switcher.css",
           "mobile-typography.css", "visual-notices.css", "brochure-downloads.css", "logo-definitif.css",
           "estate-overview.css", "company.css", "reservation.css", "arabic.css")
KEEP_CSS = ("concierge.css", "construction.css")

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Jost:wght@300;400&display=swap">')


def attr(tag, name):
    m = re.search(r'\b' + name + r'="([^"]*)"', tag)
    return m.group(1) if m else ""


def inner(block, tag):
    """Contenu intérieur du premier élément <tag …>…</tag> (non imbriqué)."""
    m = re.search(r'<' + tag + r'\b[^>]*>(.*)</' + tag + r'>', block, flags=re.S)
    return m.group(1) if m else ""


def links(block):
    return [(attr(m.group(0), "href"), m.group(0), m.group(1)) for m in re.finditer(r'<a\b[^>]*>(.*?)</a>', block, flags=re.S)]


def wrap_children(section_html):
    """Enveloppe le contenu d'une section dans <div class="wrap">."""
    m = re.match(r'(<(section|article|div)\b[^>]*>)(.*)(</\2>)$', section_html, flags=re.S)
    if not m:
        return section_html
    return m.group(1) + '<div class="wrap">' + m.group(3) + '</div>' + m.group(4)


def group_head(block, cls="wh-lead"):
    """Regroupe l'eyebrow + titre de tête dans un div (pour les grilles)."""
    return re.sub(r'^(\s*)(<div class="eyebrow">.*?</div>\s*<h[1-3]\b[^>]*>.*?</h[1-3]>)', r'\1<div class="' + cls + r'">\2</div>', block, count=1, flags=re.S)


def group_figures(block):
    """Regroupe les <figure> consécutifs dans <div class="wh-figures">."""
    return re.sub(r'((?:<figure\b.*?</figure>\s*){2,})', r'<div class="wh-figures">\1</div>', block, count=1, flags=re.S)


def build_header(old_header, lang, home_href, contact):
    nav_m = re.search(r'<nav\b(?![^>]*language-switcher)[^>]*>(.*?)</nav>', old_header, flags=re.S)
    nav_tag = re.search(r'<nav\b(?![^>]*language-switcher)[^>]*>', old_header).group(0)
    nav_links = links(nav_m.group(1))
    cta = re.search(r'<a class="button reservation-cta"[^>]*>(.*?)</a>', old_header, flags=re.S)
    cta_href, cta_label = attr(cta.group(0), "href"), cta.group(1)
    lang_nav = re.search(r'<nav\b[^>]*language-switcher[^>]*>(.*?)</nav>', old_header, flags=re.S)
    lang_aria = attr(re.search(r'<nav\b[^>]*language-switcher[^>]*>', old_header).group(0), "aria-label")
    lang_links = re.sub(r'<img\b[^>]*>', '', lang_nav.group(1))
    menu = re.search(r'<summary>(.*?)</summary>', old_header)
    menu_label = re.sub(r'\s*\+\s*$', '', menu.group(1)) if menu else "Menu"
    nav_html = "".join(f'<a href="{h}"{" aria-current=\"page\"" if "aria-current" in tag else ""}>{label}</a>' for h, tag, label in nav_links)
    header = (f'<header class="wh-header" id="top"><div class="wrap">'
              f'<a class="wh-brand" href="{home_href}" aria-label="Williams &amp; Harper">'
              f'<img class="wh-logo wh-logo--dark" src="/assets/logo-definitif-signature-fonce.svg?v={VERSION}" alt="Williams &amp; Harper — Private Estates" width="593" height="106">'
              f'<img class="wh-logo wh-logo--light" src="/assets/logo-definitif-signature-clair.svg?v={VERSION}" alt="" width="593" height="106"></a>'
              f'<nav class="wh-nav" aria-label="{attr(nav_tag, "aria-label")}">{nav_html}<a class="wh-cta" href="{cta_href}">{cta_label}</a></nav>'
              f'<div class="wh-tools"><nav class="wh-lang" aria-label="{lang_aria}" dir="ltr">{lang_links}</nav>'
              f'<a class="wh-cta" href="{cta_href}">{cta_label}</a>'
              f'<button class="wh-burger" type="button" aria-label="{menu_label}" aria-expanded="false"><span></span><span></span><span></span></button>'
              f'</div></div></header>')
    return header, nav_links, (cta_href, cta_label), lang_links, lang_aria


def build_footer(old_footer, nav_links, cta, lang_links, lang_aria, contact):
    p = re.search(r'<p>(.*?)</p>', old_footer, flags=re.S)
    legal = p.group(1) if p else ""
    first_line = re.split(r'<br\s*/?>', legal)[0].strip()
    nav_html = "".join(f'<a href="{h}">{label}</a>' for h, tag, label in nav_links)
    contact_label = nav_links[-1][2] if nav_links else "Contact"
    contact_html = ""
    if contact.get("phone"):
        contact_html += f'<a class="contact-phone" href="{contact["phone_href"]}">{contact["phone"]}</a>'
    contact_html += '<nav>'
    if contact.get("wa"):
        contact_html += f'<a href="{contact["wa_href"]}" rel="noopener" target="_blank">{contact["wa"]}</a>'
    contact_html += f'<a href="{cta[0]}">{cta[1]}</a></nav>'
    return (f'<footer class="wh-footer"><div class="wrap">'
            f'<div class="wh-footer__brand"><img src="/assets/logo-definitif-duo-clair.svg?v={VERSION}" alt="Williams &amp; Harper — Private Estates" width="220" height="150" loading="lazy"><p>{first_line}</p></div>'
            f'<div><nav>{nav_html}</nav></div>'
            f'<div><h4>{contact_label}</h4>{contact_html}<nav class="wh-lang" aria-label="{lang_aria}" dir="ltr">{lang_links}</nav></div>'
            f'<div class="wh-footer__legal">{legal}</div>'
            f'</div></footer>')


def transform_head(head, lang, page):
    head = re.sub(r'<style\b[^>]*>.*?</style>', '', head, flags=re.S)
    head = re.sub(r'<link\b[^>]*href="[^"]*(?:' + "|".join(re.escape(c) for c in OLD_CSS) + r')[^"]*"[^>]*>', '', head)
    for c in KEEP_CSS:
        head = re.sub(r'(<link\b[^>]*href=")[^"]*' + re.escape(c) + r'\?v=[^"]*(")', r'\1/assets/' + c + '?v=' + VERSION + r'\2', head)
    head = re.sub(r'\n{2,}', '\n', head)
    add = FONTS + f'<link rel="stylesheet" href="/assets/wh-base.css?v={VERSION}"><script defer src="/assets/wh-base.js?v={VERSION}"></script>'
    if page in HERO_IMAGES:
        add += f'<link rel="preload" as="image" href="{HERO_IMAGES[page]}?v={VERSION}" fetchpriority="high">'
    return head.replace('</head>', add + '</head>')


SMALL_NOTES = "fine|estate-map-caption|plan-zoom-hint|comfort-note|residents-note|brochure-note|purchase-note|wh-film-note|wh-visual-notice"
_PAIR = re.compile(r'<p class="(' + SMALL_NOTES + r')">(.*?)</p>\s*<p class="wh-visual-notice">(.*?)</p>', re.S)


def merge_small_notes(body):
    """Une petite note suivie de la mention « visuels non contractuels » : les deux sur la même ligne,
    en un seul paragraphe (« note · mention ») ; deux mentions identiques qui se suivent n'en font qu'une."""
    def repl(m):
        cls, a, b = m.group(1), m.group(2).strip(), m.group(3).strip()
        if a == b:
            return f'<p class="wh-visual-notice">{a}</p>'
        cls = cls if cls == "wh-visual-notice" else cls + " wh-visual-notice"
        return f'<p class="{cls}">{a} · {b}</p>'
    prev = None
    while prev != body:
        prev, body = body, _PAIR.sub(repl, body)
    return body


WOOD_BOARD = {
    "fr": ("Bois nobles, élégance naturelle · Agrandir la planche", "Bois nobles, élégance naturelle : chêne naturel mat, chêne fumé, noyer brun, teck naturel · Williams &amp; Harper"),
    "en": ("Fine woods, natural elegance · Enlarge the board", "Fine woods, natural elegance: matt natural oak, smoked oak, brown walnut, natural teak · Williams &amp; Harper"),
    "nl": ("Edele houtsoorten, natuurlijke elegantie · Vergroot het overzicht", "Edele houtsoorten, natuurlijke elegantie: mat naturel eiken, gerookt eiken, bruin notenhout, naturel teak · Williams &amp; Harper"),
    "ar": ("أخشاب نبيلة، أناقة طبيعية · تكبير اللوحة", "أخشاب نبيلة، أناقة طبيعية: بلوط طبيعي مطفي، بلوط مدخّن، جوز بني، ساج طبيعي · Williams &amp; Harper"),
}


def insert_wood_board(main, lang):
    """Page Matières : la planche « Bois nobles » prend place entre la palette des matières et « Bois massif & nuances »."""
    m = re.search(r'<figure id="collection-bois">.*?src="([^"]*?)collection-bois\.webp"', main, flags=re.S)
    if not m or 'id="bois-nobles"' in main:
        return main
    prefix = m.group(1)
    cap, alt = WOOD_BOARD[lang]
    fig = (f'<figure id="bois-nobles"><a aria-label="{cap}" href="{prefix}bois-nobles-palette.webp?v={VERSION}" rel="noopener" target="_blank">'
           f'<img alt="{alt}" loading="lazy" src="{prefix}bois-nobles-palette.webp?v={VERSION}" width="1600" height="800" decoding="async"></a>'
           f'<figcaption>{cap}</figcaption></figure>')
    return main.replace('<figure id="collection-bois">', fig + '<figure id="collection-bois">', 1)


def transform_body(body, lang, page, home_href):
    # Petites mentions en Arial (style en ligne) alignées sur les autres mentions de la charte
    body = body.replace('<p style="font:11px/1.7 Arial,sans-serif;color:#697168">', '<p class="fine">')
    body = merge_small_notes(body)
    old_header = re.search(r'<header\b.*?</header>', body, flags=re.S).group(0)
    old_footer = re.search(r'<footer\b.*?</footer>', body, flags=re.S).group(0)
    main_m = re.search(r'(<main\b[^>]*>)(.*)(</main>)', body, flags=re.S)
    main_open, main, main_close = main_m.groups()
    photo_hero = page in HERO_IMAGES or page == "domaine"

    # --- héros ---
    if page == "index":
        hero = re.search(r'<section class="hero" id="villas">(.*?)</section>', main, flags=re.S)
        content = hero.group(1)
        nav_tmp = links(re.search(r'<nav\b(?![^>]*language-switcher)[^>]*>(.*?)</nav>', old_header, flags=re.S).group(1))
        cta = re.search(r'<a class="button reservation-cta"[^>]*>(.*?)</a>', old_header, flags=re.S)
        domaine = nav_tmp[1] if len(nav_tmp) > 1 else nav_tmp[0]
        new = (f'<section class="wh-hero wh-hero--home" id="villas"><div class="wh-hero__media"><img src="{HERO_IMAGES["index"]}?v={VERSION}" alt="" fetchpriority="high" width="1672" height="941"></div>'
               f'<div class="wrap"><div class="wh-hero__copy">{content}<div class="wh-hero__actions"><a class="btn btn--light" href="{attr(cta.group(0), "href")}">{cta.group(1)}</a>'
               f'<a class="text-link" href="{domaine[0]}">{domaine[2]}</a></div></div></div>'
               f'<a class="wh-scrollcue" href="#collection">{nav_tmp[0][2]}</a></section>')
        main = main.replace(hero.group(0), new)
        main = main.replace('<section aria-label="', '<section id="collection" aria-label="', 1) if 'class="collection"' in main and 'id="collection"' not in main else main
        main = re.sub(r'<section([^>]*)class="collection"', r'<section id="collection"\1class="collection"', main, count=1) if 'id="collection"' not in main else main
    elif page in ("chloe", "celine", "margaux"):
        hero = re.search(r'<section class="gallery-intro">(.*?)</section>', main, flags=re.S)
        content = re.sub(r'<p>(?!<)', '<p class="hero-lead">', hero.group(1), count=1)
        h1 = re.sub(r'<[^>]+>', '', inner(content, "h1"))
        new = (f'<section class="wh-hero wh-hero--villa"><div class="wh-hero__media"><img src="{HERO_IMAGES[page]}?v={VERSION}" alt="{html.escape(h1)}" fetchpriority="high"></div>'
               f'<div class="wrap"><div class="wh-hero__copy">{content}</div></div></section>')
        main = main.replace(hero.group(0), new)
    elif page == "domaine":
        hero = re.search(r'<section class="domain" id="domaine">(.*?)</section>', main, flags=re.S)
        content = hero.group(1).replace('class="button"', 'class="btn btn--light"')
        new = (f'<section class="wh-hero wh-hero--domaine" id="domaine"><div class="wh-hero__media">'
               f'<video autoplay muted loop playsinline preload="metadata" poster="/assets/domaine-film-poster.jpg?v={VERSION}" data-poster-mobile="/assets/domaine-film-mobile-poster.jpg?v={VERSION}" aria-hidden="true">'
               f'<source src="/assets/domaine-film-mobile.mp4?v={VERSION}" type="video/mp4" media="{MOBILE_FILM_MQ}">'
               f'<source src="/assets/domaine-film-720.mp4?v={VERSION}" type="video/mp4"></video></div>'
               f'<div class="wrap"><div class="wh-hero__copy">{content}</div></div></section>')
        main = main.replace(hero.group(0), new)
    elif page == "art":
        main = main.replace('<section class="art-opening">', '<section class="art-opening wh-hero--text">', 1)
    elif page == "matieres-finitions":
        main = main.replace('<div class="materials-intro">', '<div class="materials-intro wh-hero--text">', 1)
        main = insert_wood_board(main, lang)
    elif page == "reservation":
        main = main.replace('<div class="reservation-intro">', '<div class="reservation-intro wh-hero--text">', 1)
    elif page == "faq":
        main = main.replace('<section class="villa-faq" id="faq">', '<section class="villa-faq wh-hero--text" id="faq">', 1)

    # --- enveloppes .wrap sur les blocs de premier niveau de <main> ---
    out, pos, depth_tags = [], 0, ("section", "article", "div")
    pattern = re.compile(r'<(section|article|div)\b[^>]*>')
    i = 0
    while True:
        m = pattern.search(main, i)
        if not m:
            out.append(main[i:]); break
        out.append(main[i:m.start()])
        tag = m.group(1)
        # trouver la fermeture correspondante (gestion de l'imbrication)
        depth, j = 0, m.start()
        scan = re.compile(r'<(/?)' + tag + r'\b[^>]*>')
        for mm in scan.finditer(main, m.start()):
            depth += -1 if mm.group(1) else 1
            if depth == 0:
                j = mm.end(); break
        block = main[m.start():j]
        if 'class="wh-hero' in block.split('>')[0] or 'wh-hero__' in block.split('>')[0]:
            out.append(block)
        else:
            cls = attr(block.split('>')[0], "class")
            if 'brochure-downloads' in cls:
                block = re.sub(r'(<section[^>]*>)(.*)(</section>)$', lambda k: k.group(1) + group_head(k.group(2)) + k.group(3), block, flags=re.S)
            if 'collection-boards' in cls or 'daily-hub' in cls:
                block = group_figures(block)
            block = re.sub(r'(<section\b[^>]*class="daily-hub"[^>]*>)(.*?)(</section>)', lambda k: k.group(1) + group_figures(k.group(2)) + k.group(3), block, flags=re.S)
            block = re.sub(r'(<section\b[^>]*class="collection-boards"[^>]*>)(.*?)(</section>)', lambda k: k.group(1) + group_figures(k.group(2)) + k.group(3), block, flags=re.S)
            out.append(wrap_children(block))
        i = j
    main = "".join(out)

    # --- accueil : la carte Localisation passe avant « La vie au domaine » ---
    if page == "index":
        def swap(m):
            cards = re.findall(r'<a href="[^"]*" class="home-domain-card">.*?</a>', m.group(2), flags=re.S)
            if len(cards) == 3:
                return m.group(1) + cards[0] + cards[2] + cards[1] + m.group(3)
            return m.group(0)
        main = re.sub(r'(<div class="home-domain-grid">)(.*?)(</div>)', swap, main, count=1, flags=re.S)

    # --- carte de localisation : recadrage sur la carte seule (sans bandeau ni panneau de brochure) ---
    if page == "index":
        main = re.sub(r'(<a href="[^"]*" class="home-domain-card">)(<img [^>]*domaine-localisation[^>]*>)', r'\1<span class="wh-map-crop">\2</span>', main)

    # --- photos de l'autre villa remplacées (galerie Chloé) ---
    if page == "chloe":
        for old, new in PHOTO_SWAPS.items():
            main = re.sub(r'(src="(?:\.\./)?assets/)' + re.escape(old) + r'(\?v=[^"]*)?"', lambda k: k.group(1) + new + f'?v={VERSION}"', main)
        for old, new in CAPTION_SWAPS.items():
            main = main.replace(old, new)

    # url() dans une variable CSS inline : chemin absolu (sinon résolu depuis la feuille de style)
    main = re.sub(r"--villa-photo:url\('(?:\.\./)?assets/", "--villa-photo:url('/assets/", main)
    body = body.replace("url('assets/", "url('/assets/").replace("url('../assets/", "url('/assets/")
    main = re.sub(r'(\["|", ")(?:\.\./)?assets/(chloe-2-photo\.webp|celine-exterieur-1-photo\.webp|margaux-exterieur-1\.jpeg)', r'\1/assets/\2', main)

    header, nav_links, cta, lang_links, lang_aria = build_header(old_header, lang, home_href, {})
    footer = build_footer(old_footer, nav_links, cta, lang_links, lang_aria, CONTACT.get(lang, {}))
    body = body.replace(old_header, header).replace(old_footer, footer)
    body = body.replace(main_m.group(0), main_open + main + main_close)
    # url() dans une variable CSS inline : chemin absolu (sinon résolu depuis la feuille de style)
    body = body.replace("url('assets/", "url('/assets/").replace("url('../assets/", "url('/assets/")
    body = re.sub(r'(\["|", ")(?:\.\./)?assets/(chloe-2-photo\.webp|celine-exterieur-1-photo\.webp|margaux-exterieur-1\.jpeg)', r'\1/assets/\2', body)
    body = re.sub(r'concierge\.js\?v=[^"]*', 'concierge.js?v=' + VERSION, body)
    if photo_hero:
        body = re.sub(r'<body(?: class="([^"]*)")?>', lambda k: f'<body class="{(k.group(1) + " ") if k.group(1) else ""}wh-photo-hero">', body, count=1)
    return body


CONTACT = {}


def collect_contacts(src):
    for lang in LANGS:
        t = (src / "app/templates" / lang / "reservation.html").read_text()
        phone = re.search(r'<a class="contact-phone" href="([^"]*)">(.*?)</a>', t)
        wa = re.search(r'<a class="button contact-whatsapp" href="([^"]*)"[^>]*>(.*?)</a>', t)
        CONTACT[lang] = {"phone_href": phone.group(1), "phone": phone.group(2), "wa_href": wa.group(1), "wa": wa.group(2)} if phone and wa else {}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    src, out = pathlib.Path(args[0]), pathlib.Path(args[1])
    zip_path = pathlib.Path(sys.argv[sys.argv.index("--zip") + 1]) if "--zip" in sys.argv else None
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(src / "app", out / "app")
    shutil.copytree(src / "www", out / "www", ignore=shutil.ignore_patterns(".*.pdf.*"))
    for name, path in EXTRA_ASSETS.items():
        shutil.copy2(path, out / "www/assets" / name)
    # Écusson vert (fond ivoire) pour le bouton du conseiller
    cj = out / "www/assets/concierge.js"
    cj.write_text(cj.read_text().replace("el('img','wh-seal',''),{src:'/assets/logo-definitif-ecusson-clair.svg'", "el('img','wh-seal',''),{src:'/assets/logo-definitif-ecusson-fonce.svg'"))
    shutil.copy2(HERE / "assets/wh-base.css", out / "www/assets/wh-base.css")
    shutil.copy2(HERE / "assets/wh-base.js", out / "www/assets/wh-base.js")
    for c in OLD_CSS:
        p = out / "www/assets" / c
        if p.exists():
            p.unlink()
    collect_contacts(src)
    paths = json.loads((src / "app/url-paths.json").read_text())
    n = 0
    for lang in LANGS:
        for page in paths[lang]:
            f = src / "app/templates" / lang / f"{page}.html"
            s = f.read_text()
            head, body = s[:s.find("<body")], s[s.find("<body"):]
            head = transform_head(head, lang, page)
            body = transform_body(body, lang, page, paths[lang]["index"])
            (out / "app/templates" / lang).mkdir(parents=True, exist_ok=True)
            (out / "app/templates" / lang / f"{page}.html").write_text(head + body)
            n += 1
    (out / "NOUVELLE_BASE_GRAPHIQUE.txt").write_text(NOTE)
    print(f"{n} gabarits générés dans {out}")
    if zip_path:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(out.rglob("*")):
                if p.is_file():
                    z.write(p, out.name + "/" + str(p.relative_to(out)))
        print(f"archive : {zip_path} ({zip_path.stat().st_size // 1_000_000} Mo)")


NOTE = """WILLIAMS & HARPER — NOUVELLE BASE GRAPHIQUE DU SITE OVH — 22 OCTOBRE 2026

Ce paquet reprend intégralement le contenu du paquet « Logo définitif 4 langues » (textes, SEO, URL,
redirections, PHP, brochures, plans, photos) et remplace son habillage :

- Charte ivoire / encre / champagne, vert forêt réservé au pied de page, aux boutons et à l'appel final.
- Typographie Cormorant Garamond (titres) et Jost (textes), Noto Naskh / Noto Sans pour l'arabe.
- En-tête fin et fixe, transparent sur les photos puis ivoire au défilement ; menu mobile ; langues FR EN NL AR.
- Héros plein écran : accueil (villa), pages villas (photo de chaque modèle), domaine (film du domaine).
- Galeries en grille, plans sur fond blanc, FAQ en accordéon, pied de page vert avec contact et langues.
- Un seul fichier de style (assets/wh-base.css) et un script léger (assets/wh-base.js). Les anciens
  fichiers CSS ne sont plus utilisés ; le conseiller (concierge) et le film de construction sont conservés.

Photos : trois visuels de la galerie Chloé qui montraient une autre villa (escalier hélicoïdal, jardin)
ont été remplacés par de vraies vues de Chloé (chloe-sejour-double-hauteur.jpg, chloe-salons.jpg,
chloe-jardin-instants.jpg). Les surfaces et prix du paquet source n'ont pas été modifiés.

INSTALLATION : identique au paquet précédent (app/ hors racine publique, www/ racine publique,
fusionner .htaccess, conserver app/config.php et les réglages SMTP). Purger le cache OVH.
"""

if __name__ == "__main__":
    main()
