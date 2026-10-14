"""Shopee 1:1 cover builder.  Usage:  python3 -I shopee_thumb.py config.json
config = {
  "outdir": "/home/claude/out",
  "model": "/home/claude/models/u2net_human_seg.onnx",
  "title": "ÁO BÀ BA THUN LẺ", "subtitle": "THOÁNG MÁT • CO GIÃN",
  "tags": [["CO GIÃN","4 CHIỀU"],["SIZE","45 - 75KG"],["ĐI CHƠI","ĐI LỄ"]],
  "size_label": "S-XL",
  "footer": ["HÀNG CÓ SẴN","ĐỔI TRẢ 7 NGÀY"],
  "jobs": [{"src": "a.jpg", "out": "bia-a.jpg",
            "face": [cx, cy],              # face centre, source px
            "crop": [left, top],           # model crop origin, source px
            "crop_w": 1267, "crop_h": 2000,# optional, aspect must be 760:1200
            "logo": [x0, y0, x1, y1],      # optional: owner's own logo to remove
            "recolor": {"ref": "ref.jpg", "ref_box": [x0,y0,x1,y1], "shirt_box": [x0,y0,x1,y1]}  # optional
           }]
}
"""
import json, math, sys
import numpy as np, cv2, onnxruntime as ort
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FB = '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
FK = '/usr/share/fonts/opentype/inter/InterDisplay-Black.otf'
BEIGE, DARK, RED, NAVY, WHITE = (246, 236, 220), (122, 20, 22), (186, 42, 22), (40, 62, 100), (255, 255, 255)
PW = 760

CFG = json.load(open(sys.argv[1]))
sess = ort.InferenceSession(CFG.get('model', '/home/claude/models/u2net_human_seg.onnx'))


# ---------------- photo fixes ----------------
def remove_logo(img, box):
    x0, y0, x1, y1 = box
    m = np.zeros(img.shape[:2], np.uint8); m[y0:y1, x0:x1] = 255
    return cv2.inpaint(img, m, 12, cv2.INPAINT_TELEA)


def person_mask(img):
    H, W = img.shape[:2]
    x = cv2.resize(img.astype(np.float32) / 255, (320, 320), interpolation=cv2.INTER_AREA)
    x = (x / x.max() - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    p = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    p = (p - p.min()) / (p.max() - p.min())
    p = np.clip((cv2.resize(p, (W, H)) - 0.3) / 0.4, 0, 1)
    return cv2.GaussianBlur(cv2.dilate(p, np.ones((7, 7), np.uint8)), (0, 0), 4)


def lab_median(img, box, mask=None):
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


# ---------------- icons ----------------
S, SZ = 4, 150
WA = WHITE + (255,)


def P(x, y):
    return ((SZ / 2 + x) * S, (SZ / 2 + y) * S)


def canvas():
    c = Image.new('RGBA', (SZ * S, SZ * S), (0, 0, 0, 0))
    return c, ImageDraw.Draw(c)


def arrow(d, x0, y0, x1, y1, w=7, head=13, hw=11):
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L
    bx, by = x1 - ux * head, y1 - uy * head
    d.line([P(x0, y0), P(bx + ux * 2, by + uy * 2)], fill=WA, width=w * S)
    d.polygon([P(x1, y1), P(bx - uy * hw, by + ux * hw), P(bx + uy * hw, by - ux * hw)], fill=WA)


def spark(d, x, y, r):
    k = 0.28
    d.polygon([P(x, y - r), P(x + r * k, y - r * k), P(x + r, y), P(x + r * k, y + r * k),
               P(x, y + r), P(x - r * k, y + r * k), P(x - r, y), P(x - r * k, y - r * k)], fill=WA)


def icon_stretch():   # fabric square pulled 4 ways
    c, d = canvas(); R = RED + (255,); q = 19
    d.rounded_rectangle([P(-q, -q), P(q, q)], radius=4 * S, fill=WA)
    for yy in (-9, 0, 9):
        pts = [P(-q + 5 + t, yy + (2.5 if (t // 5) % 2 else -2.5)) for t in range(0, 2 * q - 9, 5)]
        d.line(pts, fill=R, width=int(2.5 * S), joint='curve')
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        arrow(d, dx * (q + 5), dy * (q + 5), dx * 50, dy * 50)
    return c


def icon_size():      # T-shirt with size range
    c, d = canvas(); R = RED + (255,)
    shirt = [(-14, -36), (-44, -22), (-50, -2), (-34, 4), (-30, -6), (-30, 40), (30, 40),
             (30, -6), (34, 4), (50, -2), (44, -22), (14, -36)]
    d.polygon([P(*p) for p in shirt], fill=WA)
    d.chord([P(-14, -50), P(14, -22)], 0, 180, fill=R)
    lab = CFG.get('size_label', 'S-XL')
    d.text(P(0, 12), lab, font=ImageFont.truetype(FK, (17 if len(lab) <= 4 else 13) * S), fill=R, anchor='mm')
    return c


def icon_outing():    # lady handbag + sparkles
    c, d = canvas(); R = RED + (255,)
    d.arc([P(-17, -46), P(17, -6)], 180, 360, fill=WA, width=6 * S)
    d.line([P(-17, -26), P(-17, -14)], fill=WA, width=6 * S)
    d.line([P(17, -26), P(17, -14)], fill=WA, width=6 * S)
    d.polygon([P(-26, -16), P(26, -16), P(40, 32), P(-40, 32)], fill=WA)
    d.ellipse([P(-40, 24), P(-30, 36)], fill=WA); d.ellipse([P(30, 24), P(40, 36)], fill=WA)
    d.rectangle([P(-35, 28), P(35, 36)], fill=WA)
    d.polygon([P(-26, -16), P(26, -16), P(0, 8)], fill=R)
    d.polygon([P(-21, -13), P(21, -13), P(0, 3)], fill=WA)
    d.ellipse([P(-5, 2), P(5, 12)], fill=R)
    spark(d, 40, -36, 12); spark(d, -40, -30, 7)
    return c


def icon_truck():     # delivery truck = in stock
    c, d = canvas(); R = RED + (255,)
    d.rounded_rectangle([P(-50, -30), P(14, 20)], radius=5 * S, fill=WA)
    d.polygon([P(18, -14), P(36, -14), P(50, 4), P(50, 20), P(18, 20)], fill=WA)
    d.polygon([P(24, -8), P(34, -8), P(43, 4), P(24, 4)], fill=R)
    for wx in (-30, 32):
        d.ellipse([P(wx - 13, 14), P(wx + 13, 40)], fill=WA)
        d.ellipse([P(wx - 5, 22), P(wx + 5, 32)], fill=R)
    return c


def icon_return():    # circular arrows with 7 = 7-day returns
    c, d = canvas(); r = 40
    d.arc([P(-r, -r), P(r, r)], 200, 340, fill=WA, width=10 * S)
    d.arc([P(-r, -r), P(r, r)], 20, 160, fill=WA, width=10 * S)
    for ang in (340, 160):
        a = math.radians(ang); x, y = r * math.cos(a), r * math.sin(a)
        tx, ty, nx, ny = -math.sin(a), math.cos(a), math.cos(a), math.sin(a)
        d.polygon([P(x + tx * 16, y + ty * 16), P(x + nx * 13, y + ny * 13), P(x - nx * 13, y - ny * 13)], fill=WA)
    d.text(P(0, 1), '7', font=ImageFont.truetype(FK, 40 * S), fill=WA, anchor='mm')
    return c


# ---------------- layout ----------------
def fit_font(path, text, max_w, start):
    s = start
    while s > 10:
        f = ImageFont.truetype(path, s)
        if f.getlength(text) <= max_w:
            return f
        s -= 2
    return ImageFont.truetype(path, s)


def compose(photo):
    k = 2; W = 1200 * k
    cv = Image.new('RGB', (W, W), BEIGE)
    cv.paste(photo.resize((PW * k, 1200 * k), Image.LANCZOS), (0, 0))
    edge = np.array(cv.crop(((PW - 60) * k, 0, PW * k, W))).astype(np.float32)
    a = np.linspace(0, 1, 60 * k)[None, :, None] ** 1.5
    cv.paste(Image.fromarray((edge * (1 - a) + np.array(BEIGE, np.float32) * a).astype(np.uint8)), ((PW - 60) * k, 0))
    d = ImageDraw.Draw(cv)

    # header — text centred in its box (checked by measuring margins)
    hx0, hy0, hx1, hy1 = 500, 28, 1176, 236
    d.rounded_rectangle([hx0 * k, hy0 * k, hx1 * k, hy1 * k], radius=30 * k, fill=WHITE)
    t = CFG.get('title', 'ÁO BÀ BA THUN LẺ')
    d.text(((hx0 + hx1) / 2 * k, 90 * k), t, font=fit_font(FK, t, (hx1 - hx0 - 50) * k, 68 * k), fill=DARK, anchor='mm')
    px0, px1, py0, py1 = hx0 + 24, hx1 - 24, 140, 214
    d.rounded_rectangle([px0 * k, py0 * k, px1 * k, py1 * k], radius=22 * k, fill=NAVY)
    t2 = CFG.get('subtitle', 'THOÁNG MÁT • CO GIÃN')
    d.text(((px0 + px1) / 2 * k, (py0 + py1) / 2 * k), t2, font=fit_font(FB, t2, (px1 - px0 - 50) * k, 44 * k),
           fill=WHITE, anchor='mm')

    # 3 capsules: white, dark-red outline + bottom lip, red badge with white icon
    tags = CFG.get('tags', [['CO GIÃN', '4 CHIỀU'], ['SIZE', '45 - 75KG'], ['ĐI CHƠI', 'ĐI LỄ']])
    cx0, cx1, hh = 600, 1184, 168
    for i, (lines, icon) in enumerate(zip(tags, (icon_stretch, icon_size, icon_outing))):
        cy = 380 + i * 212; y0, y1 = cy - hh // 2, cy + hh // 2
        d.rounded_rectangle([cx0 * k, (y0 + 7) * k, cx1 * k, (y1 + 7) * k], radius=hh // 2 * k, fill=DARK)
        d.rounded_rectangle([cx0 * k, y0 * k, cx1 * k, y1 * k], radius=hh // 2 * k, fill=WHITE, outline=DARK, width=5 * k)
        ccx, r = cx0 + hh // 2, 70
        d.ellipse([(ccx - r) * k, (cy - r) * k, (ccx + r) * k, (cy + r) * k], fill=RED)
        ic = icon().resize((SZ * k, SZ * k), Image.LANCZOS)
        cv.paste(ic, ((ccx - SZ // 2) * k, (cy - SZ // 2) * k), ic)
        tx = (ccx + r + cx1) / 2 + 4
        ft = fit_font(FK, max(lines, key=len), (cx1 - ccx - r - 40) * k, 54 * k)
        if len(lines) == 1:
            d.text((tx * k, cy * k), lines[0], font=ft, fill=DARK, anchor='mm')
        else:
            d.text((tx * k, (cy - 32) * k), lines[0], font=ft, fill=DARK, anchor='mm')
            d.text((tx * k, (cy + 32) * k), lines[1], font=ft, fill=DARK, anchor='mm')

    # footer bottom-RIGHT only (bottom-left stays empty for Shopee labels); badges match capsules
    fx0, fy0 = 560, 1036
    d.rounded_rectangle([fx0 * k, fy0 * k, 1260 * k, 1260 * k], radius=44 * k, fill=DARK)
    foot = CFG.get('footer', ['HÀNG CÓ SẴN', 'ĐỔI TRẢ 7 NGÀY'])
    ff = fit_font(FK, max(foot, key=len), 470 * k, 50 * k)
    for j, (txt, icon) in enumerate(zip(foot, (icon_truck, icon_return))):
        yy = 1080 + j * 74
        rr, ri, isz = 34, 30, 76
        d.ellipse([(fx0 + 62 - rr) * k, (yy - rr) * k, (fx0 + 62 + rr) * k, (yy + rr) * k], fill=WHITE)
        d.ellipse([(fx0 + 62 - ri) * k, (yy - ri) * k, (fx0 + 62 + ri) * k, (yy + ri) * k], fill=RED)
        ic = icon().resize((isz * k, isz * k), Image.LANCZOS)
        cv.paste(ic, ((fx0 + 62 - isz // 2) * k, (yy - isz // 2) * k), ic)
        d.text(((fx0 + 108) * k, yy * k), txt, font=ff, fill=WHITE, anchor='lm')
    return cv.resize((1200, 1200), Image.LANCZOS)


if __name__ == '__main__':
    out = CFG.get('outdir', '.')
    for job in CFG['jobs']:
        img = np.array(Image.open(job['src']).convert('RGB'))
        if job.get('logo'):
            img = remove_logo(img, job['logo'])
        p = person_mask(img)
        if job.get('recolor'):
            img = recolor_shirt(img, p, job['recolor'])
        res = enhance_face(soften_background(img, p, job.get('soften', 0.55)), job['face'])
        cw, ch = job.get('crop_w', 1267), job.get('crop_h', 2000)
        H, W = img.shape[:2]
        if cw > W or ch > H:   # small source: largest 760:1200 window that fits
            ch = min(H, int(W * 1200 / 760)); cw = int(ch * 760 / 1200)
        l, t = job['crop']
        l = max(0, min(l, W - cw)); t = max(0, min(t, H - ch))
        photo = Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).crop((l, t, l + cw, t + ch))
        img_out = compose(photo).filter(ImageFilter.UnsharpMask(radius=1.0, percent=40, threshold=2))
        img_out.save(f"{out}/{job['out']}", quality=92, subsampling=0, optimize=True)
        print(job['out'])
