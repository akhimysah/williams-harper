#!/usr/bin/env python3
"""Film du domaine en version mobile (vertical 720x1280, 30 i/s), refait à partir des photos du site.

Même découpage et même bande-son que media/film-720.mp4 (film d'Oriion Studio, 16:9) :
chaque plan est une photo de img/ recadrée en 9:16 avec un mouvement lent (travelling ou zoom),
le titre et la signature sont redessinés en Cormorant Garamond, le carton final RED STONE est
repris du film d'origine (centre de l'image, sans redimensionnement).

Usage : python3 ovh-site/build_film_mobile.py
Sorties : media/film-mobile-720.mp4 et media/film-mobile-poster.jpg
"""
import io, pathlib, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from fontTools.ttLib import TTFont

REPO = pathlib.Path(__file__).resolve().parent.parent
SRC_FILM = REPO / "media/film-720.mp4"
OUT = REPO / "media/film-mobile-720.mp4"
POSTER = REPO / "media/film-mobile-poster.jpg"
FONTS = REPO / "site-src/film/src/brand/fonts/cormorant-garamond/files"
W, H, FPS = 720, 1280, 30
DUR = 23.833  # durée du film d'origine (et de sa musique)
XF = 0.30     # fondu entre deux plans (s)

# (photo, début, fin, centre x départ, centre x fin, zoom départ, zoom fin, centre y)
# centre en fraction de la largeur de la photo ; zoom 1 = toute la hauteur de la photo.
SHOTS = [
    ("photo-25", 0.00, 1.33, 0.50, 0.47, 1.00, 1.08, 0.50),  # façade au jardin + titre
    ("photo-19", 1.33, 2.23, 0.42, 0.52, 1.10, 1.02, 0.50),  # piscine vue d'en haut
    ("photo-01", 2.23, 4.00, 0.30, 0.55, 1.02, 1.02, 0.50),  # salon, travelling
    ("photo-21", 4.00, 5.77, 0.50, 0.50, 1.18, 1.00, 0.50),  # villa et sculpture dorée
    ("photo-07", 5.77, 7.97, 0.72, 0.45, 1.02, 1.02, 0.50),  # grand salon, travelling
    ("photo-06", 7.97, 9.73, 0.40, 0.40, 1.00, 1.10, 0.50),  # séjour double hauteur
    ("photo-24", 9.73, 13.70, 0.20, 0.62, 1.00, 1.00, 0.50), # crépuscule, long travelling
    ("photo-18", 13.70, 16.77, 0.38, 0.38, 1.12, 1.00, 0.50), # piscine et sculpture
    ("photo-26", 16.77, 20.30, 0.58, 0.40, 1.00, 1.04, 0.50), # la villa de nuit
]
END_CARD = 20.30  # carton RED STONE repris du film d'origine

TITLE = ["Une nouvelle manière", "de vivre Marrakech"]
TITLE_IN, TITLE_OUT = 0.15, 1.25
SIGN = "WILLIAMS & HARPER"
_y = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
VEIL = 0.34 * np.clip(1 - _y / 0.42, 0, 1) ** 1.5


def ttf(weight, tmp):
    out = pathlib.Path(tmp) / f"cg-{weight}.ttf"
    if not out.exists():
        f = TTFont(FONTS / f"cormorant-garamond-latin-{weight}-normal.woff2")
        f.flavor = None
        f.save(out)
    return str(out)


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * (3 - 2 * t)


def spaced(draw, y, text, font, tracking, fill):
    """Texte centré avec espacement des lettres (tracking en px)."""
    widths = [draw.textlength(c, font=font) for c in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = (W - total) / 2
    for c, w in zip(text, widths):
        draw.text((x, y), c, font=font, fill=fill)
        x += w + tracking


def overlay(lines, font, sign_font):
    """Calques RGBA : titre (avec ombre douce) et signature."""
    title = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(title)
    y = 205
    for line in lines:
        w = d.textlength(line, font=font)
        d.text(((W - w) / 2, y), line, font=font, fill=(255, 255, 255, 255))
        y += 66
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shadow.putalpha(title.getchannel("A").filter(ImageFilter.GaussianBlur(14)).point(lambda a: a * 0.55))
    title = Image.alpha_composite(shadow, title)

    sign = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    spaced(ImageDraw.Draw(sign), H - 118, SIGN, sign_font, 5.5, (255, 255, 255, 235))
    return np.asarray(title).astype(np.float32) / 255, np.asarray(sign).astype(np.float32) / 255


def load_photo(name):
    im = Image.open(REPO / f"img/{name}.jpg").convert("RGB")
    # agrandissement préalable x2 (Lanczos) puis légère accentuation : le recadrage 9:16 agrandit la photo
    im = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    return im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=45, threshold=2))


def shot_frame(im, cx, cy, zoom):
    ch = im.height / zoom
    cw = ch * W / H
    cw = min(cw, im.width)
    ch = cw * H / W
    x0 = min(max(cx * im.width - cw / 2, 0), im.width - cw)
    y0 = min(max(cy * im.height - ch / 2, 0), im.height - ch)
    s = cw / W
    return im.transform((W, H), Image.AFFINE, (s, 0, x0, 0, s, y0), resample=Image.BICUBIC)


def end_card_frames():
    """Carton final : centre 720x720 du film d'origine posé au milieu d'un fond noir."""
    n = int(round((DUR - END_CARD) * FPS)) + 2
    cmd = ["ffmpeg", "-v", "error", "-ss", f"{END_CARD}", "-i", str(SRC_FILM), "-frames:v", str(n),
           "-vf", "crop=720:720:280:0", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, 720, 720, 3).astype(np.float32)
    frames = np.clip((frames - 10) * (255 / 245), 0, 255)  # noir franc, pas de bord visible
    full = np.zeros((len(frames), H, W, 3), np.float32)
    full[:, 280:1000] = frames
    return full


def main():
    with tempfile.TemporaryDirectory() as tmp:
        title_rgba, sign_rgba = overlay(TITLE, ImageFont.truetype(ttf(400, tmp), 58),
                                        ImageFont.truetype(ttf(500, tmp), 21))
        photos = {s[0]: load_photo(s[0]) for s in SHOTS}
        end = end_card_frames()
        audio = pathlib.Path(tmp) / "audio.m4a"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(SRC_FILM), "-vn", "-c", "copy", str(audio)], check=True)

        total = int(round(DUR * FPS))
        enc = subprocess.Popen(
            ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
             "-i", "-", "-i", str(audio), "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "slow",
             "-crf", "21", "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
             "-colorspace", "bt709", "-c:a", "copy", "-shortest", "-movflags", "+faststart", str(OUT)],
            stdin=subprocess.PIPE)

        def render_shot(i, t):
            name, a, b, x0, x1, z0, z1, cy = SHOTS[i]
            # le mouvement continue pendant le fondu (marge XF de part et d'autre)
            p = (t - a + XF / 2) / (b - a + XF)
            k = ease(p) * 0.85 + p * 0.15
            img = shot_frame(photos[name], x0 + (x1 - x0) * k, cy, z0 + (z1 - z0) * k)
            return np.asarray(img).astype(np.float32)

        poster = None
        for f in range(total):
            t = f / FPS
            if t >= END_CARD + XF / 2:
                frame = end[min(int(round((t - END_CARD) * FPS)), len(end) - 1)]
            else:
                i = max(j for j, s in enumerate(SHOTS) if s[1] <= t or j == 0)
                frame = render_shot(i, t)
                nxt = SHOTS[i][2]
                if t > nxt - XF / 2:  # fondu vers le plan suivant (ou le carton)
                    w = ease((t - (nxt - XF / 2)) / XF)
                    other = render_shot(i + 1, t) if i + 1 < len(SHOTS) else end[0]
                    frame = frame * (1 - w) + other * w
                elif i > 0 and t < SHOTS[i][1] + XF / 2:
                    w = ease((t - (SHOTS[i][1] - XF / 2)) / XF)
                    frame = render_shot(i - 1, t) * (1 - w) + frame * w
                # signature sur les photos, titre sur le premier plan
                fade_sign = 1 - ease((t - (END_CARD - XF / 2)) / XF)
                frame = frame * (1 - sign_rgba[..., 3:] * fade_sign) + sign_rgba[..., :3] * 255 * sign_rgba[..., 3:] * fade_sign
                ta = ease((t - TITLE_IN) / 0.45) * (1 - ease((t - TITLE_OUT) / 0.3))
                if ta > 0:
                    frame = frame * (1 - VEIL * ta)  # voile sombre en haut pour lire le titre
                    a = title_rgba[..., 3:] * ta
                    frame = frame * (1 - a) + title_rgba[..., :3] * 255 * a
                if f == int(0.9 * FPS):
                    poster = frame
            enc.stdin.write(np.clip(frame + 0.5, 0, 255).astype(np.uint8).tobytes())
            if f % 60 == 0:
                print(f"  {t:5.1f} s", file=sys.stderr)
        enc.stdin.close()
        if enc.wait():
            sys.exit("ffmpeg a échoué")
        Image.fromarray(np.clip(poster + 0.5, 0, 255).astype(np.uint8)).save(POSTER, quality=86, optimize=True)
    print(f"{OUT.relative_to(REPO)} ({OUT.stat().st_size / 1e6:.1f} Mo), {POSTER.relative_to(REPO)}")


if __name__ == "__main__":
    main()
