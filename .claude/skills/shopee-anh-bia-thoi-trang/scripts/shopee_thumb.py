"""Shopee 1:1 cover builder.  Usage:  python3 -I shopee_thumb.py config.json
Layout: the photo fills the whole square; two white cards sit ON the photo background (top right, bottom right), never over the person.
config = {
  "outdir": "/home/claude/out",
  "model": "/home/claude/models/u2net_human_seg.onnx",
  "logo_file": "../references/logo-thao-ngoc.png",   # optional, default = that file (transparent PNG)
  "brand_tag": "",                                    # optional small line under the logo (default: none)
  "headline": ["FORM SUÔNG", "DỄ MẶC"],               # 1-2 lines, big navy caps
  "subline": "95% Cotton mềm mát",                    # small line under the headline
  "material": ["95% COTTON", "Mềm mát"],              # bottom-right card: bold caps + small line ([] to hide)
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
FONTS_BOLD = ['/System/Library/Fonts/Avenir Next.ttc|0',                      # Avenir Next Bold (macOS; Heavy thiếu glyph tiếng Việt)
              '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf',
              '/System/Library/Fonts/Supplemental/Arial Bold.ttf']
FONTS_REG = ['/System/Library/Fonts/Avenir Next.ttc|5',                      # Avenir Next Medium (macOS)
             '/usr/share/fonts/opentype/inter/InterDisplay-Medium.otf',
             '/System/Library/Fonts/Supplemental/Arial.ttf']
FB = next((f for f in FONTS_BOLD if os.path.exists(f.split('|')[0])), FONTS_BOLD[0])
FR = next((f for f in FONTS_REG if os.path.exists(f.split('|')[0])), FONTS_REG[0])
BEIGE, NAVY, GREY, LINE, WHITE = (246, 236, 220), (8, 38, 102), (96, 104, 118), (214, 218, 226), (255, 255, 255)
PW = 1200   # photo spans the full canvas width
CARD2_SCALE = 0.70   # card 2 (material) scale, same idea
LOGO_H = 250          # logo height at scale 1.0 (bigger logo, redrawn from the 800px master)
CARD2_H = 160         # card 2 height at scale 1.0 (roomier line spacing)
CARD1_SCALE = 0.70   # card 1 = 70% of the first design (536px wide); big enough to read on mobile

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


def load_logo():
    p = CFG.get('logo_file') or os.path.join(HERE, '..', 'references', 'logo-thao-ngoc.png')
    return Image.open(p).convert('RGBA')


def card(d, box, k, radius=26):
    """White rounded card (the soft shadow is composited beforehand in compose)."""
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0 * k, y0 * k, x1 * k, y1 * k], radius=radius * k, fill=WHITE)


def person_canvas(pm, ch=1200):
    """Person mask (cropped like the photo) -> float array on the 1200 x ch canvas."""
    m = np.zeros((ch, 1200), np.float32)
    if pm is not None:
        m[:, :PW] = np.array(Image.fromarray((np.clip(pm, 0, 1) * 255).astype(np.uint8)).resize((PW, ch), Image.BILINEAR)) / 255
    return m


def free_x0(m, y0, y1, default, min_w, right=1176, gap=28):
    """Left edge for a card spanning rows y0..y1 so it keeps `gap` px clear of the person (never overlaps)."""
    cols = np.where((m[y0:y1] > 0.15).any(0))[0]
    x0 = max(default, int(cols.max()) + gap) if len(cols) else default
    if right - x0 < min_w:
        raise SystemExit(f'Người mẫu quá rộng, thẻ không đủ chỗ (còn {right - x0}px < {min_w}px). '
                         'Mở rộng vùng crop (tăng crop_w/crop_h) hoặc dời crop sang trái để người mẫu lùi ra khỏi cột phải.')
    return x0


def free_spans(m, y0, y1, left=28, right=1176, gap=28):
    """Free width on the left of / on the right of the person within rows y0..y1 (gap px kept clear)."""
    cols = np.where((m[y0:y1] > 0.15).any(0))[0]
    if not len(cols):
        return right - left, right - left
    return int(cols.min()) - gap - left, right - int(cols.max()) - gap


def compose(photo, pm=None, ch=1200):
    """ch = canvas height: 1200 for 1:1, 1600 for 3:4 (width is always 1200)."""
    k = 2; W = 1200 * k; HH = ch * k
    cv = photo.resize((W, HH), Image.LANCZOS).convert('RGB').filter(ImageFilter.UnsharpMask(radius=2, percent=40, threshold=2))

    # soft shadow under both cards
    M = person_canvas(pm, ch); cx1 = 1176; cy1 = ch - 24
    head = CFG.get('headline', ['FORM SUÔNG', 'DỄ MẶC'])
    brand = CFG.get('brand_tag', '')
    sub = CFG.get('subline', '')
    mat = CFG.get('material', [])
    logo = load_logo()

    def layout1(sc):
        """Card-1 geometry at scale sc (1.0 = 536px wide): y offsets from the card top, everything in canvas px."""
        w = round(536 * sc); inner = (w - 48 * sc) * k
        fh = fit_font(FB, max(head, key=len), inner, round(88 * sc) * k)
        fs = fit_font(FR, sub, inner, round(46 * sc) * k) if sub else None
        lh = round(LOGO_H * sc)
        y_logo = round(24 * sc)
        y_brand = y_logo + lh + 8 * sc
        y_line = y_brand + (50 * sc if brand else 0) + 20 * sc
        y_head = y_line + 28 * sc
        pitch = fh.size / k * 1.2                      # roomy line spacing
        y_sub = y_head + len(head) * pitch + 18 * sc
        h = y_sub + (fs.size / k * 1.2 if sub else 0) + 30 * sc
        return dict(w=w, h=round(h), fh=fh, fs=fs, inner=inner, lh=lh, y_logo=y_logo, y_brand=y_brand,
                    y_line=y_line, y_head=y_head, pitch=pitch, y_sub=y_sub)

    sc = CARD1_SCALE
    w1, h1 = (lay := layout1(sc))['w'], lay['h']
    al, ar = free_spans(M, 28, 28 + h1)
    side = CFG.get('card1_side', 'right')              # same side as card 2 (right); 'left' or 'auto' only on request
    if side == 'auto':
        side = 'right' if ar >= w1 or ar >= al else 'left'
    avail = ar if side == 'right' else al
    if avail < 200:
        raise SystemExit(f'Người mẫu quá rộng, thẻ trên không đủ chỗ (còn {avail}px < 200px). '
                         'Mở rộng vùng crop hoặc dời crop để chừa chỗ trống cạnh người mẫu.')
    sc = min(sc, avail / 536)
    lay = layout1(sc); w1, h1 = lay['w'], lay['h']
    c1 = (cx1 - w1, 28, cx1, 28 + h1) if side == 'right' else (28, 28, 28 + w1, 28 + h1)
    c2 = None
    if mat:
        s2 = CARD2_SCALE
        w2, h2 = round(416 * s2), round(CARD2_H * s2)
        x2 = free_x0(M, cy1 - h2, cy1, cx1 - w2, 160)   # card 2 slides right / shrinks, never overlaps the person
        s2 = min(s2, (cx1 - x2) / 416)
        w2, h2 = round(416 * s2), round(CARD2_H * s2)
        c2 = (cx1 - w2, cy1 - h2, cx1, cy1)
    sh = Image.new('L', (W, HH), 0); sd = ImageDraw.Draw(sh)
    for b in (c1, c2):
        if b:
            sd.rounded_rectangle([b[0] * k, (b[1] + 6) * k, b[2] * k, (b[3] + 6) * k], radius=26 * k, fill=70)
    sh = sh.filter(ImageFilter.GaussianBlur(10 * k))
    cv.paste(Image.new('RGB', (W, HH), (60, 50, 40)), (0, 0), sh)
    d = ImageDraw.Draw(cv)

    # ---- card 1: logo, (optional brand tag), divider, headline, subline - all centred on the card axis ----
    card(d, c1, k, radius=round(26 * max(sc, 0.6)))
    mx = (c1[0] + c1[2]) / 2; top = c1[1]
    lh = lay['lh']; lw = round(lh * logo.width / logo.height)
    lg = logo.resize((lw * k, lh * k), Image.LANCZOS)          # downscaled from the 800px master, 2x supersampled
    cv.paste(lg, (round((mx - lw / 2) * k), round((top + lay['y_logo']) * k)), lg)
    if brand:
        d.text((mx * k, (top + lay['y_brand'] + 25 * sc) * k), brand, font=fit_font(FR, brand, lay['inner'], round(30 * sc) * k), fill=GREY, anchor='mm')
    yl = top + lay['y_line']
    d.line([(c1[0] + 24 * sc) * k, yl * k, (c1[2] - 24 * sc) * k, yl * k], fill=LINE, width=2 * k)
    for i, t in enumerate(head):
        d.text((mx * k, (top + lay['y_head'] + (i + 0.5) * lay['pitch']) * k), t, font=lay['fh'], fill=NAVY, anchor='mm')
    if sub:
        d.text((mx * k, (top + lay['y_sub'] + lay['fs'].size / k * 0.6) * k), sub, font=lay['fs'], fill=NAVY, anchor='mm')

    # ---- card 2: material, bottom-right (bottom-left stays empty for Shopee labels) ----
    if mat:
        card(d, c2, k, radius=round(24 * max(s2, 0.6)))
        m2 = (c2[0] + c2[2]) / 2; cy = (c2[1] + c2[3]) / 2; iw = (c2[2] - c2[0] - 28 * s2) * k
        d.text((m2 * k, (cy - 29 * s2) * k), mat[0], font=fit_font(FB, mat[0], iw, round(52 * s2) * k), fill=NAVY, anchor='mm')
        if len(mat) > 1:
            d.text((m2 * k, (cy + 36 * s2) * k), mat[1], font=fit_font(FR, mat[1], iw, round(38 * s2) * k), fill=NAVY, anchor='mm')
    for name, b in (('thẻ 1', c1), ('thẻ 2', c2)):
        if b:
            hit = int((M[b[1]:b[3], b[0]:b[2]] > 0.15).sum())
            if hit:
                raise SystemExit(f'LỖI: {name} đè lên người mẫu ({hit}px). Không giao ảnh này.')
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
