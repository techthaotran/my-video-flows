"""Shopee 1:1 / 3:4 cover builder.  Usage:  python3 -I shopee_thumb.py config.json
Layout: the photo fills the whole canvas; one navy card (brand, headline, yellow size panel) sits ON the photo background
on the right, never over the person and never inside the zones Shopee covers with its own labels (see ZONE_*).
config = {
  "outdir": "/home/claude/out",
  "model": "/home/claude/models/u2net_human_seg.onnx",
  "logo_file": "../references/logo-thao-ngoc.png",   # optional, default = that file (transparent PNG; only its round mark is used)
  "brand": "THẢO NGỌC",                               # shop name drawn next to the mark, top of the navy card ("" = mark only)
  "headline": ["FORM", "DỄ MẶC"],                  # 1-2 short lines (1-2 words each), big white condensed caps on navy
  "highlight": "DỄ MẶC",                             # optional: words of the headline drawn in yellow (the selling point)
  "material": "SIZE 40 - 85 KG",                    # one small line in a pale panel at the bottom of the card ("" to hide; a list is joined)
  "swatches": ["#F2A7B8", [200, 120, 210],          # optional: second white card under the first, same width: label + one plain
               {"img": "a.jpg", "center": [x, y], "size": 60}],   # overlapping circle per variant: "#hex" | [r, g, b] | median of a fabric patch
  "swatch_label": "MÀU CÓ SẴN",                      # text above the circles (default shown)
  "jobs": [{"src": "a.jpg", "out": "bia-a.jpg",
            "subject": "person",           # "person" (u2net human seg, default) | "product" (flat-lay, no model: subject = pixels unlike the border background)
            "face": [cx, cy],              # face centre, source px (omit for "product")
            "crop": [left, top],           # square crop origin in source px (default: right-aligned, top 0)
            "crop_w": 1450, "crop_h": 1450,# square crop size (photo fills the whole 1200x1200 canvas)
            "outputs": [                   # optional: several sizes from one photo (default = one 1:1 using out/crop above)
              {"ratio": "1:1", "out": "a-1x1.jpg", "crop": [l, t], "crop_w": 1100},
              {"ratio": "3:4", "out": "a-3x4.jpg", "crop": [l, t], "crop_w": 1100}],   # 3:4 -> 1200x1600, crop height = crop_w*4/3
            "extend_right": 500, "fill_box": [x0, y0, x1, y1],   # optional (product): widen the photo to the right with surface texture copied from an empty box
            "logo": [x0, y0, x1, y1],      # optional: owner's own logo to remove from the photo
            "recolor": {"ref": "ref.jpg", "ref_box": [x0,y0,x1,y1], "shirt_box": [x0,y0,x1,y1]}  # optional
           }]
}
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))

FONTS_COND = ['/System/Library/Fonts/Avenir Next Condensed.ttc|2',           # Avenir Next Condensed Demi Bold (Bold/Heavy thiếu glyph tiếng Việt)
              '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',
              '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf']
FONTS_SMALL = ['/System/Library/Fonts/HelveticaNeue.ttc|4',              # Helvetica Neue Condensed Bold: small lines; open, heavy
               '/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf',   # strokes keep the stacked marks of Ẵ / Ẫ apart on the phone tile
               '/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf']
FONTS_BOLD = ['/System/Library/Fonts/Avenir Next.ttc|0',                      # Avenir Next Bold (macOS; Heavy thiếu glyph tiếng Việt)
              '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf',
              '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
FS = next((f for f in FONTS_SMALL if os.path.exists(f.split('|')[0])), FONTS_SMALL[0])
FC = next((f for f in FONTS_COND if os.path.exists(f.split('|')[0])), FONTS_COND[0])
FB = next((f for f in FONTS_BOLD if os.path.exists(f.split('|')[0])), FONTS_BOLD[0])
# Brand colours of the card, by role (same on every cover so the shop is recognisable in search results)
THEME = dict(card=(255, 255, 255), text=(8, 38, 102), accent=(255, 184, 34),       # white card, navy headline, amber #FFB822 highlight
             brand=(17, 17, 17), logo=(17, 17, 17), rule=(214, 218, 226),          # black logo mark + shop name, light grey divider
             panel=(236, 241, 248), panel_text=(8, 38, 102),                       # pale size panel, navy text: quieter than the highlight
             accent_bg=None,   # optional marker colour drawn behind the highlight (e.g. yellow behind navy text)
             accent_stroke=None)   # optional outline colour for the highlight (light accent on a light card needs one)
PW = 1200   # photo spans the full canvas width
# Zones Shopee covers with its own labels on the 1200-wide canvas (they scale with the width, so 3:4 keeps the same px):
# 01 = "Yêu thích" badge (top left), 03 = voucher / discount (top right), 02 = Freeship / Hoàn xu frame (bottom left).
ZONE_TOP_LEFT = (0, 94, 356, 218)
ZONE_TOP_RIGHT_H = 290      # zone 03: x >= 875, y < 290
ZONE_BOTTOM_H = 183         # zone 02: x < 746, the last 183 rows
RIGHT, GAP = 1176, 24       # card right edge; GAP = clearance from zone 03 and the person
CARD_MAX_W, CARD_MIN_W = 470, 300
HEAD_MIN = 84               # headline px on the 1200 canvas; smaller is unreadable on the ~188px phone tile
LINE_PITCH = 1.22           # headline line spacing (x font size); airy enough that the two lines read apart on the phone tile
SWATCH_D, SWATCH_STEP, SWATCH_RING = 64, 0.66, 5   # variant circles: diameter, centre step (x diameter) so they overlap, white ring
SMALL_PX, SMALL_MIN = 64, 56  # size line / "MÀU CÓ SẴN" px (FONTS_SMALL): caps ~45px = ~7px on the 188px tile, the legible floor;
                              # also capped at 60% of the headline so it never outshines the highlight; wraps to 2 lines before shrinking
PANEL_GAP = 26              # headline -> size panel; room for the dot under Ặ / Ạ / Ọ
BRAND_H = 64                # brand row (round mark + shop name) height on the 1200 canvas

CFG = json.load(open(sys.argv[1])) if len(sys.argv) > 1 and __name__ == '__main__' else {}
_sess = None


def session():
    global _sess
    if _sess is None:
        import onnxruntime as ort
        _sess = ort.InferenceSession(CFG.get('model', '/home/claude/models/u2net_human_seg.onnx'))
    return _sess


# ---------------- photo fixes ----------------
def remove_logo(img, box, mode='inpaint'):
    """mode 'inpaint': smooth fill (small logos / flat background).
    mode 'mirror': copy the strip just above the box, flipped, with a feathered edge - keeps texture (bricks, grass, foliage)."""
    import cv2
    x0, y0, x1, y1 = box
    if mode == 'mirror' and y0 - (y1 - y0) >= 0:
        h = y1 - y0
        patch = np.ascontiguousarray(img[y0 - h:y0, x0:x1][::-1])
        # Poisson blend: colours/lighting adapt to the surroundings, so no visible patch edge
        m = np.full(patch.shape[:2], 255, np.uint8)
        return cv2.seamlessClone(patch, np.ascontiguousarray(img), m, ((x0 + x1) // 2, (y0 + y1) // 2), cv2.NORMAL_CLONE)
    m = np.zeros(img.shape[:2], np.uint8); m[y0:y1, x0:x1] = 255
    return cv2.inpaint(img, m, 12, cv2.INPAINT_TELEA)


def person_mask(img):
    import cv2
    sess = session()
    H, W = img.shape[:2]
    x = cv2.resize(img.astype(np.float32) / 255, (320, 320), interpolation=cv2.INTER_AREA)
    x = (x / x.max() - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    p = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    p = (p - p.min()) / (p.max() - p.min())
    p = np.clip((cv2.resize(p, (W, H)) - 0.3) / 0.4, 0, 1)
    return cv2.GaussianBlur(cv2.dilate(p, np.ones((7, 7), np.uint8)), (0, 0), 4)


def product_mask(img, thr=24):
    """Flat-lay product on a plain surface: subject = pixels whose LAB colour is far from the border background."""
    import cv2
    lab = cv2.cvtColor(cv2.GaussianBlur(img, (0, 0), 3), cv2.COLOR_RGB2LAB).astype(np.float32)
    H, W = img.shape[:2]
    b = max(8, W // 40)
    border = np.concatenate([lab[:b].reshape(-1, 3), lab[-b:].reshape(-1, 3), lab[:, :b].reshape(-1, 3), lab[:, -b:].reshape(-1, 3)])
    m = (np.linalg.norm(lab - np.median(border, 0), axis=2) > thr).astype(np.uint8)
    k = max(3, W // 150)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((4 * k, 4 * k), np.uint8))
    n, lab_cc, st, _ = cv2.connectedComponentsWithStats(m)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] > 0.003 * H * W:
            keep[lab_cc == i] = 1
    p = keep.astype(np.float32)
    return cv2.GaussianBlur(cv2.dilate(p, np.ones((2 * k + 1, 2 * k + 1), np.uint8)), (0, 0), 4)


def extend_right(img, n, box, feather=140):
    """Widen a flat-lay photo by n px on the right with surface texture tiled (mirrored) from an empty box.
    The seam is feathered on the surface only; subject pixels at the edge (flower stems...) stay sharp, so they read as trimmed."""
    H, W = img.shape[:2]
    pm = product_mask(img)
    x0, y0, x1, y1 = box
    t = img[y0:y1, x0:x1]
    t = np.concatenate([t, t[:, ::-1]], 1)
    t = np.concatenate([t, t[::-1]], 0)
    tile = np.tile(t, (H // t.shape[0] + 1, (n + feather) // t.shape[1] + 1, 1))[:H, :n + feather].astype(np.float32)
    # match the tile tone, row by row, to the surface just inside the right edge (ignoring subject pixels)
    import cv2
    band, w = img[:, W - 150:].astype(np.float32), (pm[:, W - 150:] < 0.1).astype(np.float32)[..., None]
    sm = lambda v: cv2.GaussianBlur(v.reshape(H, 1, 3), (0, 0), 60).reshape(H, 3)
    edge = sm((band * w).sum(1)) / np.maximum(sm(np.repeat(w.sum(1), 3, 1)), 1e-3)
    tile += (edge - sm(tile.mean(1)))[:, None, :]
    out = np.concatenate([img.astype(np.float32), tile[:, feather:]], 1)
    keep = np.clip(pm[:, W - feather:W] * 1.5, 0, 1)
    a = np.linspace(0, 1, feather)[None, :] * (1 - keep)
    out[:, W - feather:W] = img[:, W - feather:W] * (1 - a[..., None]) + tile[:, :feather] * a[..., None]
    return np.clip(out, 0, 255).astype(np.uint8)


def lab_median(img, box, mask=None):
    import cv2
    x0, y0, x1, y1 = box
    a = img[y0:y1, x0:x1]
    hsv = cv2.cvtColor(a, cv2.COLOR_RGB2HSV).reshape(-1, 3).astype(int)
    lab = cv2.cvtColor(a, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float32)
    sel = (hsv[:, 1] > 120) & (hsv[:, 2] > 80)
    if mask is not None:
        sel &= mask[y0:y1, x0:x1].reshape(-1) > 0.5
    return np.median(lab[sel], 0), np.median(hsv[sel, 0])


def recolor_shirt(img, person, rc):
    """Shift the shirt's dominant base colour to the reference product's colour, keep print + shading."""
    import cv2
    ref = np.array(Image.open(rc['ref']).convert('RGB'))
    tgt, _ = lab_median(ref, rc['ref_box'])
    cur, hue = lab_median(img, rc['shirt_box'], person)
    zone = np.zeros(img.shape[:2], np.float32)
    x0, y0, x1, y1 = rc['shirt_box']; zone[y0:y1, x0:x1] = 1
    zone = cv2.GaussianBlur(zone, (0, 0), 8)
    hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV).astype(np.float32)
    dh = np.abs(hsv[..., 0] - hue); dh = np.minimum(dh, 180 - dh)
    w = np.clip((1 - dh / 10) * 1.6, 0, 1) * np.clip((hsv[..., 1] - 110) / 45, 0, 1) \
        * np.clip((hsv[..., 2] - 40) / 40, 0, 1) * person * zone
    w = cv2.GaussianBlur(w, (0, 0), 0.8)
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0]
    if tgt[0] > cur[0]:   # brighten without clipping, keep folds
        L2 = 255 - (255 - L) * (255 - tgt[0]) / max(255 - cur[0], 1)
    else:
        L2 = L * tgt[0] / max(cur[0], 1)
    lab2 = np.stack([L2, lab[..., 1] + (tgt[1] - cur[1]), lab[..., 2] + (tgt[2] - cur[2])], -1)
    rec = cv2.cvtColor(np.clip(lab2, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    return np.clip(img * (1 - w[..., None]) + rec * w[..., None], 0, 255).astype(np.uint8)


def soften_background(img, person, K=0.55):
    import cv2
    # the person mask is dilated; use an eroded copy here so the bright ring of background hugging the body
    # gets softened too (otherwise it shows as a light halo around sleeves and hair)
    person = cv2.GaussianBlur(cv2.erode(person, np.ones((15, 15), np.uint8)), (0, 0), 3)
    bg = 1 - person
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0] / 255
    hi = np.clip((cv2.GaussianBlur(L, (0, 0), 10) - 0.5) / 0.5, 0, 1) ** 1.2
    lab2 = lab.copy()
    lab2[..., 0] = np.clip(L * (1 - K * 0.5 * hi) * (1 - 0.04 * K) * 255, 0, 255)
    lab2[..., 1] = 128 + (lab[..., 1] - 128) * (1 - 0.2 * K * hi)
    lab2[..., 2] = 128 + (lab[..., 2] - 128) * (1 - 0.25 * K * hi)
    out = cv2.cvtColor(lab2.astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    res = img.astype(np.float32) * (1 - bg[..., None]) + out * bg[..., None]
    clar = np.clip(res + (res - cv2.GaussianBlur(res, (0, 0), 14)) * 0.15, 0, 255)
    return res * (1 - person[..., None]) + clar * person[..., None]


def enhance_face(img, center):
    import cv2
    H, W = img.shape[:2]
    m = np.zeros((H, W), np.float32)
    cv2.ellipse(m, tuple(int(v) for v in center), (110, 135), 0, 0, 360, 1, -1)
    m = cv2.GaussianBlur(m, (0, 0), 20); m /= m.max()
    lab = cv2.cvtColor(np.clip(img, 0, 255).astype(np.uint8), cv2.COLOR_RGB2LAB).astype(np.float32)
    L = lab[..., 0]
    base = cv2.bilateralFilter(L, 9, 20, 7)
    detail = L - base
    w = np.clip((cv2.GaussianBlur(np.abs(detail), (0, 0), 1.5) - 2.5) / 6.0, 0, 1)  # edges only, skin stays smooth
    L2 = base + detail * (0.7 + 0.8 * w)
    L2 = L2 + (L2 - cv2.GaussianBlur(L2, (0, 0), 1.2)) * 0.6 * w
    n = np.clip(L2 / 255, 0, 1) ** 0.94
    lab[..., 0] = np.clip((0.5 + (n - 0.5) * 1.04) * 255, 0, 255)
    out = cv2.cvtColor(lab.astype(np.uint8), cv2.COLOR_LAB2RGB).astype(np.float32)
    return img * (1 - m[..., None]) + out * m[..., None]



# ---------------- layout ----------------
def open_font(spec, size):
    path, _, idx = spec.partition('|')
    return ImageFont.truetype(path, size, index=int(idx or 0))


def fit_font(spec, text, max_w, start):
    s = start
    while s > 10:
        f = open_font(spec, s)
        if f.getlength(text) <= max_w:
            return f
        s -= 2
    return open_font(spec, s)


def logo_mark():
    """Round mark of the shop logo, tinted white: the logo's top block of ink, cut at the first wide blank band
    (the small "THẢO NGỌC / FASHION" text under it is unreadable on a phone, the name is redrawn big instead)."""
    lg = Image.open(CFG.get('logo_file') or os.path.join(HERE, '..', 'references', 'logo-thao-ngoc.png')).convert('RGBA')
    a = np.array(lg)[..., 3]
    rows = np.where((a > 40).any(1))[0]
    gaps = np.where(np.diff(rows) > lg.height * 0.04)[0]
    y1 = rows[gaps[0]] + 1 if len(gaps) else rows[-1] + 1
    cols = np.where((a[:y1] > 40).any(0))[0]
    mark = lg.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(y1)))
    out = Image.new('RGBA', mark.size, THEME['logo'] + (0,))
    out.putalpha(mark.split()[3])
    return out


def swatch_color(s):
    """'#hex' | [r, g, b] | {"color": [r, g, b]} | {"img", "center", "size"}: median of a plain fabric patch."""
    if isinstance(s, str):
        return tuple(int(s.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    if isinstance(s, (list, tuple)):
        return tuple(s)
    if 'color' in s:
        return tuple(s['color'])
    (sx, sy), n = s['center'], s.get('size', 60)
    a = np.asarray(Image.open(s['img']).convert('RGB').crop((sx - n // 2, sy - n // 2, sx + n // 2, sy + n // 2)), np.float32)
    return tuple(int(v) for v in np.median(a.reshape(-1, 3), 0))


def draw_swatches(cv, colors, mx, y0, k, max_w):
    """Row of overlapping colour circles centred on x = mx, top at y0 (canvas px); later circles sit on top.
    Circles overlap more when the row would be wider than max_w. Returns the row box."""
    d, ring = SWATCH_D, SWATCH_RING
    step = round(d * SWATCH_STEP)
    if len(colors) > 1:
        step = min(step, (max_w - d - 2 * ring) // (len(colors) - 1))
    w = d + (len(colors) - 1) * step + 2 * ring
    x0 = round(mx - w / 2)
    box = (x0, y0, x0 + w, y0 + d + 2 * ring)
    sh = Image.new('L', cv.size, 0); sd = ImageDraw.Draw(sh)
    for i in range(len(colors)):
        cx = x0 + ring + i * step
        sd.ellipse([cx * k, (y0 + 6) * k, (cx + d + 2 * ring) * k, (y0 + 6 + d + 2 * ring) * k], fill=90)
    cv.paste(Image.new('RGB', cv.size, (20, 20, 20)), (0, 0), sh.filter(ImageFilter.GaussianBlur(6 * k)))
    d2 = ImageDraw.Draw(cv)
    for i, col in enumerate(colors):
        cx = x0 + i * step
        d2.ellipse([cx * k, y0 * k, (cx + d + 2 * ring) * k, (y0 + d + 2 * ring) * k], fill=(255, 255, 255))
        d2.ellipse([(cx + ring) * k, (y0 + ring) * k, (cx + ring + d) * k, (y0 + ring + d) * k], fill=col)
    return box


def small_lines(text, max_w, start, one_line=False):
    """Small-text font + 1-2 lines for a small line of text: keep it at `start` px; if one line is too wide, split at the
    space that gives the most even pair ("SIZE" / "40 - 85 KG"), never next to a dash; shrink (not below SMALL_MIN) only
    when no split fits. one_line: shrink first (short labels stay on one line, the same on every cover), split last."""
    w = text.split()
    splits = [[text]] + [[' '.join(w[:i]), ' '.join(w[i:])] for i in range(1, len(w)) if '-' not in (w[i - 1], w[i])]
    s = start
    while True:
        f = open_font(FS, s)
        best = min(splits, key=lambda ls: (max(f.getlength(t) for t in ls) > max_w, len(ls), max(f.getlength(t) for t in ls)))
        if one_line and f.getlength(text) <= max_w:
            return f, [text]
        if (not one_line and max(f.getlength(t) for t in best) <= max_w) or s <= SMALL_MIN:
            return f, best
        s -= 2


def draw_small(d, lines, f, mx, y, col, k):
    """Small lines centred on x = mx from y down. No faux-bold stroke: it fills the gap between stacked marks (Ẵ) on the phone."""
    fk = open_font(FS, f.size * k)
    for i, t in enumerate(lines):
        d.text((mx * k, (y + (i + 0.5) * f.size * 1.12) * k), t, font=fk, fill=col, anchor='mm')


def zones(ch):
    return [('01', ZONE_TOP_LEFT), ('03', (875, 0, 1200, ZONE_TOP_RIGHT_H)), ('02', (0, ch - ZONE_BOTTOM_H, 746, ch))]


def person_canvas(pm, ch=1200):
    """Person mask (cropped like the photo) -> float array on the 1200 x ch canvas."""
    m = np.zeros((ch, 1200), np.float32)
    if pm is not None:
        m[:, :PW] = np.array(Image.fromarray((np.clip(pm, 0, 1) * 255).astype(np.uint8)).resize((PW, ch), Image.BILINEAR)) / 255
    return m


def card_x0(m, y0, y1):
    """Left edge of the right-aligned card on rows y0..y1: as wide as CARD_MAX_W, but GAP px clear of the person."""
    cols = np.where((m[max(y0, 0):y1] > 0.15).any(0))[0]
    x0 = max(RIGHT - CARD_MAX_W, int(cols.max()) + GAP) if len(cols) else RIGHT - CARD_MAX_W
    if RIGHT - x0 < CARD_MIN_W:
        raise SystemExit(f'Người mẫu quá rộng, thẻ không đủ chỗ (còn {RIGHT - x0}px < {CARD_MIN_W}px). '
                         'Thu nhỏ vùng crop hoặc dời crop để người mẫu lùi sang trái, chừa cột phải trống.')
    return x0


def compose(photo, pm=None, ch=1200):
    """ch = canvas height: 1200 for 1:1, 1600 for 3:4 (width is always 1200).
    Card on the right, just below zone 03: brand row (logo mark + shop name), headline, size panel.
    Optional second card of the same width under it: "MÀU CÓ SẴN" + overlapping colour circles."""
    k = 2; W = 1200 * k; HH = ch * k
    cv = photo.resize((W, HH), Image.LANCZOS).convert('RGB').filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=2))
    M = person_canvas(pm, ch)
    head = CFG.get('headline', [])[:2]
    hl = CFG.get('highlight', '')
    mat = CFG.get('material', '')
    mat = ' '.join(mat) if isinstance(mat, list) else mat
    brand = CFG.get('brand', 'THẢO NGỌC')
    mark = logo_mark()
    mw = round(BRAND_H * mark.width / mark.height)
    sw = [swatch_color(s) for s in CFG.get('swatches', [])]
    sw_label = CFG.get('swatch_label', 'MÀU CÓ SẴN')

    # ---- geometry: x0 depends on the person over the card rows, the rows depend on the font -> two passes ----
    top = ZONE_TOP_RIGHT_H + GAP
    h, h2, x0 = 560, (220 if sw else 0), RIGHT - CARD_MAX_W
    for _ in range(2):
        x0 = card_x0(M, top, top + h + (GAP + h2 if sw else 0))
        inner = RIGHT - x0 - 56
        fb = fit_font(FB, brand, inner - mw - 16, 44) if brand else None
        fh = min((fit_font(FC, t, inner, 170) for t in head), key=lambda f: f.size) if head else None
        pitch = round(fh.size * LINE_PITCH) if head else 0
        fm, mlines = small_lines(mat, inner - 16, min(SMALL_PX, round(fh.size * 0.6)) if head else SMALL_PX) if mat else (None, [])
        panel_h = round(fm.size * (1.12 * len(mlines) + 0.5)) if mat else 0
        h = 22 + BRAND_H + 32 + len(head) * pitch + (PANEL_GAP + panel_h if mat else 0) + 28
        fl, llines = small_lines(sw_label, inner + 16, fm.size if mat else SMALL_PX, one_line=True) if sw and sw_label else (None, [])
        h2 = 22 + (round(fl.size * 1.12 * len(llines)) + 12 if fl else 0) + SWATCH_D + 2 * SWATCH_RING + 24 if sw else 0
    if head and fh.size < HEAD_MIN:
        raise SystemExit(f'Tiêu đề chỉ còn {fh.size}px (< {HEAD_MIN}px), không đọc được trên điện thoại. '
                         'Rút ngắn mỗi dòng (1-2 từ) hoặc đổi crop cho thẻ rộng hơn.')
    c = (x0, top, RIGHT, top + h)
    c2 = (x0, c[3] + GAP, RIGHT, c[3] + GAP + h2) if sw else None

    sh = Image.new('L', (W, HH), 0)
    for b in (c, c2):
        if b:
            ImageDraw.Draw(sh).rounded_rectangle([b[0] * k, (b[1] + 8) * k, b[2] * k, (b[3] + 8) * k], radius=30 * k, fill=110)
    cv.paste(Image.new('RGB', (W, HH), (20, 20, 20)), (0, 0), sh.filter(ImageFilter.GaussianBlur(12 * k)))
    d = ImageDraw.Draw(cv)
    S = lambda *v: [x * k for x in v]

    # ---- brand row, accent divider, headline (accent highlight), material panel, centred on the card axis ----
    d.rounded_rectangle(S(*c), radius=30 * k, fill=THEME['card'])
    mx = (c[0] + c[2]) / 2; y = c[1] + 22
    rw = mw + (16 + fb.getlength(brand) if brand else 0)
    lg = mark.resize((mw * k, BRAND_H * k), Image.LANCZOS)
    cv.paste(lg, (round((mx - rw / 2) * k), round(y * k)), lg)
    if brand:
        d.text(((mx - rw / 2 + mw + 16) * k, (y + BRAND_H / 2) * k), brand, font=open_font(FB, fb.size * k), fill=THEME['brand'], anchor='lm')
    y += BRAND_H + 14
    d.line([(c[0] + 40) * k, y * k, (c[2] - 40) * k, y * k], fill=THEME['rule'], width=2 * k)
    y += 18
    if head:
        fk = open_font(FC, fh.size * k)
        for t in head:
            i = t.find(hl) if hl else -1
            if i < 0:
                d.text((mx * k, (y + pitch / 2) * k), t, font=fk, fill=THEME['text'], anchor='mm')
            else:   # text / accent / text segments, centred as one line
                x = mx * k - fk.getlength(t) / 2
                for seg, col in ((t[:i], THEME['text']), (hl, THEME['accent']), (t[i + len(hl):], THEME['text'])):
                    if seg and seg == hl and THEME.get('accent_bg'):
                        bx0, by0, bx1, by1 = d.textbbox((x, (y + pitch / 2) * k), seg, font=fk, anchor='lm')
                        d.rounded_rectangle([max(bx0 - 16 * k, (c[0] + 20) * k), by0 - 8 * k, min(bx1 + 16 * k, (c[2] - 20) * k), by1 + 8 * k],
                                            radius=22 * k, fill=THEME['accent_bg'])   # never wider than the size panel below
                    if seg:
                        stroke = THEME.get('accent_stroke') if seg == hl else None
                        d.text((x, (y + pitch / 2) * k), seg, font=fk, fill=col, anchor='lm',
                               stroke_width=round(fh.size * 0.045) * k if stroke else 0, stroke_fill=stroke)
                        x += fk.getlength(seg)
            y += pitch
    if mat:
        y += PANEL_GAP
        p = (c[0] + 16, y, c[2] - 16, y + panel_h)
        d.rounded_rectangle(S(*p), radius=22 * k, fill=THEME['panel'])
        draw_small(d, mlines, fm, mx, y + fm.size * 0.25, THEME['panel_text'], k)

    # ---- card 2: label + colour circles, same width as card 1 ----
    if c2:
        d.rounded_rectangle(S(*c2), radius=30 * k, fill=THEME['card'])
        y = c2[1] + 22
        if fl:
            draw_small(d, llines, fl, mx, y, THEME['text'], k)
            y += round(fl.size * 1.12 * len(llines)) + 12
        draw_swatches(cv, sw, mx, y, k, c2[2] - c2[0] - 40)

    for name, b in (('thẻ trên', c), ('thẻ màu', c2)):
        if not b:
            continue
        hit = int((M[b[1]:b[3], b[0]:b[2]] > 0.15).sum())
        if hit:
            raise SystemExit(f'LỖI: {name} đè lên người mẫu ({hit}px). Không giao ảnh này.')
        for zn, (a0, b0, a1, b1) in zones(ch):
            if b[0] < a1 and a0 < b[2] and b[1] < b1 and b0 < b[3]:
                raise SystemExit(f'LỖI: {name} nằm trong vùng nhãn Shopee {zn}. Không giao ảnh này.')
    return cv.resize((1200, ch), Image.LANCZOS)


if __name__ == '__main__':
    out = CFG.get('outdir', '.')
    for job in CFG['jobs']:
        img = np.array(Image.open(job['src']).convert('RGB'))
        if job.get('extend_right'):
            img = extend_right(img, job['extend_right'], job['fill_box'])
        if job.get('logo'):
            img = remove_logo(img, job['logo'], job.get('logo_fill', 'inpaint'))
        p = product_mask(img, job.get('mask_thr', 24)) if job.get('subject') == 'product' else person_mask(img)
        if job.get('recolor'):
            img = recolor_shirt(img, p, job['recolor'])
        res = soften_background(img, p, job.get('soften', 0.55))
        if job.get('face'):
            res = enhance_face(res, job['face'])
        H, W = img.shape[:2]
        pil = Image.fromarray(np.clip(res, 0, 255).astype(np.uint8))
        # outputs: default one 1:1; add {"ratio": "3:4", "out": ..., "crop": [l, t], "crop_w": n} for more
        outs = job.get('outputs') or [{'ratio': '1:1', 'out': job['out'], 'crop': job.get('crop'),
                                       'crop_w': job.get('crop_w', job.get('crop_h'))}]
        for o in outs:
            num, den = (1, 1) if o.get('ratio', '1:1') == '1:1' else (3, 4)
            cw = min(o.get('crop_w') or min(W, H * num // den), W, H * num // den)
            chh = cw * den // num
            l, t = o.get('crop') or [W - cw, 0]
            l = max(0, min(l, W - cw)); t = max(0, min(t, H - chh))
            photo = pil.crop((l, t, l + cw, t + chh))
            img_out = compose(photo, p[t:t + chh, l:l + cw], 1200 * den // num)
            img_out.save(f"{out}/{o['out']}", quality=92, subsampling=0, optimize=True)
            print(o['out'], img_out.size)
