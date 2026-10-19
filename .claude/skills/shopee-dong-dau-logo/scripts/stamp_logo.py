"""Stamp the shop logo onto photos.  Usage:  python3 -I stamp_logo.py config.json
config = {
  "logo_file": "../references/logo-tn.png",   # optional, transparent PNG (default = that file)
  "position": "bottom-right",                  # bottom-right | bottom-left | top-right | top-left | center
  "size_pct": 11,                              # logo width as % of image width (center: 40)
  "margin_pct": 3,                             # margin as % of image width
  "opacity": 1.0,                              # 0-1 (center default 0.25)
  "color": "auto",                             # auto | black | white  (auto = pick by background brightness)
  "badge": true,                               # nền trắng bo góc sau logo (mặc định bật; false = logo trần)
  "badge_pad_pct": 16, "badge_radius_pct": 22, # lề trong và bán kính bo góc, % bề ngang logo
  "badge_opacity": 0.95,                       # độ đục của nền trắng
  "out_dir": "out",
  "quality": 92,
  "jobs": [ {"src": "a.jpg", "out": "a_logo.jpg", "position": "top-left"} ]   # per-job overrides allowed
}
Needs Pillow + numpy.  Never overwrites the source file.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
CFG_PATH = sys.argv[1]
CFG = json.load(open(CFG_PATH, encoding='utf-8'))
BASE = os.path.dirname(os.path.abspath(CFG_PATH))


def rel(p):
    return p if os.path.isabs(p) else os.path.join(BASE, p)


def load_logo(path):
    return Image.open(path).convert('RGBA')


def tint(logo, color):
    """Logo is black on transparent; recolour (keeps alpha)."""
    a = logo.getchannel('A')
    rgb = (255, 255, 255) if color == 'white' else (0, 0, 0)
    out = Image.new('RGBA', logo.size, rgb + (0,))
    out.putalpha(a)
    return out


def place(w, h, lw, lh, pos, m):
    return {
        'bottom-right': (w - lw - m, h - lh - m),
        'bottom-left': (m, h - lh - m),
        'top-right': (w - lw - m, m),
        'top-left': (m, m),
        'center': ((w - lw) // 2, (h - lh) // 2),
    }[pos]


def stamp(job):
    o = {**CFG, **job}
    img = Image.open(rel(o['src']))
    img = img.convert('RGB')
    w, h = img.size
    pos = o.get('position', 'bottom-right')
    size_pct = o.get('size_pct', 40 if pos == 'center' else 11)
    opacity = o.get('opacity', 0.25 if pos == 'center' else 1.0)
    m = round(w * o.get('margin_pct', 3) / 100)
    logo = load_logo(rel(o['logo_file']) if o.get('logo_file') else os.path.join(HERE, '..', 'references', 'logo-tn.png'))
    lw = round(w * size_pct / 100)
    lh = round(lw * logo.height / logo.width)
    k = 2                                                     # 2x supersample then LANCZOS down
    lg = logo.resize((lw * k, lh * k), Image.LANCZOS).resize((lw, lh), Image.LANCZOS)
    badge = o.get('badge', True) and pos != 'center'
    pad = round(lw * o.get('badge_pad_pct', 16) / 100) if badge else 0
    bw, bh = lw + 2 * pad, lh + 2 * pad
    bx, by = place(w, h, bw, bh, pos, m)
    x, y = bx + pad, by + pad

    color = o.get('color', 'auto')
    if badge and color == 'auto':
        color = 'black'
    if color == 'auto':
        region = np.asarray(img.crop((x, y, x + lw, y + lh)).convert('L'), float)
        color = 'white' if region.mean() < 120 else 'black'
    lg = tint(lg, color)
    if opacity < 1:
        lg.putalpha(lg.getchannel('A').point(lambda v: round(v * opacity)))

    base = img.convert('RGBA')
    if badge:
        S = 4
        rad = round(bw * o.get('badge_radius_pct', 22) / 100)
        mk = Image.new('L', (bw * S, bh * S), 0)
        ImageDraw.Draw(mk).rounded_rectangle((0, 0, bw * S - 1, bh * S - 1), rad * S, fill=255)
        mk = mk.resize((bw, bh), Image.LANCZOS)
        # bóng đổ rất nhẹ để nền trắng tách khỏi nền sáng
        sh = Image.new('RGBA', base.size, (0, 0, 0, 0))
        sa = Image.new('L', base.size, 0)
        sa.paste(mk.point(lambda v: v * 40 // 255), (bx, by + max(2, bh // 40)))
        sh.putalpha(sa.filter(ImageFilter.GaussianBlur(max(3, bw // 25))))
        base.alpha_composite(sh)
        plate = Image.new('RGBA', (bw, bh), (255, 255, 255, 0))
        plate.putalpha(mk.point(lambda v: round(v * o.get('badge_opacity', 0.95))))
        base.alpha_composite(plate, (bx, by))
    base.alpha_composite(lg, (x, y))
    out_dir = rel(o.get('out_dir', 'out'))
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, o.get('out') or os.path.splitext(os.path.basename(o['src']))[0] + '_logo.jpg')
    if os.path.abspath(dst) == os.path.abspath(rel(o['src'])):
        sys.exit('LỖI: file đích trùng file nguồn: ' + dst)
    ext = os.path.splitext(dst)[1].lower()
    if ext == '.png':
        base.save(dst)
    else:
        base.convert('RGB').save(dst, quality=o.get('quality', 92), subsampling=0)
    print('OK', dst, f'{w}x{h}', pos, color, f'logo {lw}x{lh}', 'badge' if badge else '')


for j in CFG['jobs']:
    stamp(j)
