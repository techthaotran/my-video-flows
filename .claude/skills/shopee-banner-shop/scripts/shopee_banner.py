"""Dựng banner trang trí shop Shopee.  Usage:  python3 -I shopee_banner.py config.json
config = {
  "out_dir": "out",                         # đường dẫn tương đối so với file config
  "quality": 92,
  "theme": {                                # tuỳ chọn, mặc định = tông xanh pastel của mẫu
    "primary": "#2B8CF0",                   # chữ tiêu đề đậm + thẻ
    "card_top": "#4AA8F7", "card_bottom": "#2F8EEF",
    "accent": "#EE2F7F",                    # chữ viết tay (script) + chữ thương hiệu
    "bg_top": "#F4F9FF", "bg_bottom": "#A8D3F8",
    "sparkle": "#2B8CF0"
  },
  "background": "nen.jpg",                  # tuỳ chọn: ảnh nền hoa/ruy băng (cover-fit); không có = nền gradient
  "brand": {"text": "Michi86"},             # hoặc {"logo": "logo.png"} hoặc cả hai {"logo", "text"} (logo trái, chữ phải); "loi-ich" + "ban-chay" ngang
  "jobs": [
    {"template": "loi-ich", "out": "loi-ich.jpg",          # 1200x600 (2:1; "height": 518 / 680 nếu cần)
     "script": "Lợi ích", "title": "KHI MUA HÀNG",
     "items": [{"icon": "truck", "label": ["MIỄN PHÍ", "VẬN CHUYỂN"]},
               {"icon": "return", "label": ["ĐỔI TRẢ", "KHI LỖI"]},
               {"icon": "gift", "label": ["QUÀ TẶNG", "VÔ VÀN"]},
               {"icon": "headset", "label": ["TƯ VẤN", "NHIỆT TÌNH"]}]},
    {"template": "ban-chay", "out": "ban-chay.jpg",        # 1200x600 (2:1; bản cao 2x2: "height": 1362)
     "script": "Top sản phẩm", "title": "BÁN CHẠY",
     "hero": "nguoi-mau.png",               # PNG đã tách nền; ảnh thường thì thêm "hero_cutout": true (cần model u2net)
     "products": ["a.jpg", "b.jpg", {"src": "c.jpg", "box": [200, 150, 1300, 1550], "focus": [0.5, 0.3]}, "d.jpg"],
     "auto_center": true}                     # tự căn tâm người mẫu giữa khung (cần model u2net); "focus" riêng vẫn ưu tiên
  ]
}
Mỗi job ghi đè được mọi khoá cấp ngoài (theme, background, brand, width, height...).
Icon có sẵn: truck, return, gift, headset, shield, chat, star, heart.  "icon" cũng nhận đường dẫn PNG trắng nền trong suốt.
Cần Pillow + numpy (+ onnxruntime, opencv-python-headless khi hero_cutout).  Không ghi đè ảnh nguồn.
"""
import json, math, os, sys, unicodedata
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, '..', 'references', 'fonts')
F_SCRIPT = os.path.join(FONTS, 'GreatVibes-Regular.ttf')
F_BLACK = os.path.join(FONTS, 'BeVietnamPro-Black.ttf')
F_XBOLD = os.path.join(FONTS, 'BeVietnamPro-ExtraBold.ttf')
SS = 2  # vẽ siêu mẫu x2 rồi thu nhỏ LANCZOS cho mép mịn

THEME = {
    'primary': '#2B8CF0', 'card_top': '#4AA8F7', 'card_bottom': '#2F8EEF', 'accent': '#EE2F7F',
    'bg_top': '#F4F9FF', 'bg_bottom': '#A8D3F8', 'sparkle': '#2B8CF0',
}
SIZES = {'loi-ich': (1200, 600), 'ban-chay': (1200, 600)}   # banner Shopee 2:1; bản 518 / bản cao (680 / 1362) qua "height"
MAX_BYTES = 2_000_000                                     # Shopee: tối đa 2.0 MB mỗi hình

CFG_PATH = sys.argv[1] if len(sys.argv) > 1 else None
CFG = json.load(open(CFG_PATH, encoding='utf-8')) if CFG_PATH else {}
BASE = os.path.dirname(os.path.abspath(CFG_PATH)) if CFG_PATH else os.getcwd()


def rel(p):
    p = p if os.path.isabs(p) else os.path.join(BASE, p)
    if not os.path.exists(p):                       # tên file tiếng Việt trên macOS có thể ở dạng NFD
        for form in ('NFD', 'NFC'):
            q = unicodedata.normalize(form, p)
            if os.path.exists(q):
                return q
    return p


def rgb(h, a=255):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (a,)


def nfc(s):
    return unicodedata.normalize('NFC', s)


def font(path, size):
    return ImageFont.truetype(path, max(1, round(size)))


# ---------------- nền ----------------
def gradient(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None] ** 1.3
    a, b = np.array(rgb(top)[:3], float), np.array(rgb(bottom)[:3], float)
    arr = (a * (1 - t) + b * t) * np.ones((1, w, 1))
    return Image.fromarray(arr.astype(np.uint8), 'RGB').convert('RGBA')


def cover(img, w, h, focus=(0.5, 0.5)):
    s = max(w / img.width, h / img.height)
    nw, nh = math.ceil(img.width * s), math.ceil(img.height * s)
    img = img.resize((nw, nh), Image.LANCZOS)
    x = round((nw - w) * focus[0]); y = round((nh - h) * focus[1])
    return img.crop((x, y, x + w, y + h))


def soft_glow(canvas, cx, cy, r, color, alpha):
    m = Image.new('L', canvas.size, 0)
    ImageDraw.Draw(m).ellipse((cx - r, cy - r, cx + r, cy + r), fill=alpha)
    layer = Image.new('RGBA', canvas.size, rgb(color))
    layer.putalpha(m.filter(ImageFilter.GaussianBlur(r * 0.45)))
    canvas.alpha_composite(layer)


def sparkle(d, cx, cy, r, color):
    """Ngôi sao 4 cánh cong (kiểu lấp lánh trong mẫu)."""
    pts = []
    for i in range(96):
        t = i / 96 * 2 * math.pi
        c, si = math.cos(t), math.sin(t)
        pts.append((cx + r * math.copysign(abs(c) ** 2.6, c), cy + r * math.copysign(abs(si) ** 2.6, si)))
    d.polygon(pts, fill=rgb(color))


def make_background(o, w, h):
    th = o['theme']
    if o.get('background'):
        return cover(Image.open(rel(o['background'])).convert('RGB'), w, h).convert('RGBA')
    bg = gradient(w, h, th['bg_top'], th['bg_bottom'])
    for cx, cy, r in ((0, 0, 0.32), (w, 0, 0.30), (0, h, 0.28), (w, h, 0.30)):
        soft_glow(bg, cx, cy, round(w * r), '#FFFFFF', 150)
    return bg


# ---------------- chữ ----------------
def text_size(f, s, tracking=0):
    s = nfc(s)
    if not tracking:
        l, t, r, b = f.getbbox(s)
        return r - l, b - t, l, t
    widths = [f.getlength(c) for c in s]
    l, t, r, b = f.getbbox(s)
    return round(sum(widths) + tracking * (len(s) - 1)), b - t, l, t


def draw_text(d, xy, s, f, fill, tracking=0, stroke=0, stroke_fill=None):
    """xy = góc trên trái của bbox mực."""
    s = nfc(s)
    _, _, l, t = text_size(f, s, tracking)
    x, y = xy[0] - l, xy[1] - t
    if not tracking:
        d.text((x, y), s, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        return
    for c in s:
        d.text((x, y), c, font=f, fill=fill, stroke_width=stroke, stroke_fill=stroke_fill)
        x += f.getlength(c) + tracking


def fit_font(path, s, max_w, size, tracking_em=0.0, min_size=10):
    while size > min_size:
        f = font(path, size)
        if text_size(f, s, round(size * tracking_em))[0] <= max_w:
            return f, round(size * tracking_em)
        size *= 0.96
    return font(path, min_size), round(min_size * tracking_em)


def shadow_layer(size, shape_fn, blur, offset, alpha):
    m = Image.new('L', size, 0)
    shape_fn(ImageDraw.Draw(m))
    m = m.filter(ImageFilter.GaussianBlur(blur))
    sh = Image.new('RGBA', size, (20, 70, 140, 0))
    sh.putalpha(m.point(lambda v: v * alpha // 255))
    out = Image.new('RGBA', size, (0, 0, 0, 0))
    out.alpha_composite(sh, offset)
    return out


# ---------------- icon (vẽ trong ô 200x200, nét trắng) ----------------
def icon_layer(name, px, bg_color):
    if os.path.splitext(str(name))[1].lower() in ('.png', '.webp'):
        im = Image.open(rel(name)).convert('RGBA')
        im.thumbnail((px, px), Image.LANCZOS)
        out = Image.new('RGBA', (px, px), (0, 0, 0, 0))
        out.alpha_composite(im, ((px - im.width) // 2, (px - im.height) // 2))
        return out
    k = 4
    U = px * k / 200.0
    im = Image.new('RGBA', (px * k, px * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    W = (255, 255, 255, 255)
    B = bg_color

    def P(x, y):
        return (x * U, y * U)

    def R(x0, y0, x1, y1):
        return (x0 * U, y0 * U, x1 * U, y1 * U)

    lw = round(9 * U)
    if name == 'truck':
        for y, x0, x1 in ((62, 6, 34), (88, 0, 30), (114, 10, 34)):
            d.rounded_rectangle(R(x0, y - 5, x1, y + 5), radius=5 * U, fill=W)
        d.rounded_rectangle(R(42, 40, 140, 140), radius=12 * U, fill=W)
        d.polygon([P(146, 70), P(172, 70), P(196, 104), P(196, 140), P(146, 140)], fill=W)
        d.rounded_rectangle(R(146, 64, 176, 76), radius=6 * U, fill=W)
        d.polygon([P(156, 80), P(170, 80), P(186, 104), P(156, 104)], fill=B)
        for cx in (72, 168):
            d.ellipse(R(cx - 22, 128, cx + 22, 172), fill=B)
            d.ellipse(R(cx - 16, 134, cx + 16, 166), fill=W)
            d.ellipse(R(cx - 6, 144, cx + 6, 156), fill=B)
        f = font(F_BLACK, 34 * U)
        tw, th_, l, t = text_size(f, 'FREE')
        d.text((91 * U - tw / 2 - l, 82 * U - th_ / 2 - t), 'FREE', font=f, fill=B)
    elif name == 'return':
        d.arc(R(14, 14, 186, 186), 200, 330, fill=W, width=lw)
        d.arc(R(14, 14, 186, 186), 20, 150, fill=W, width=lw)
        for ang, rot in ((330, 1), (150, 1)):
            a = math.radians(ang); cx, cy = 100 + 86 * math.cos(a), 100 + 86 * math.sin(a)
            tx, ty = -math.sin(a) * rot, math.cos(a) * rot
            d.polygon([P(cx + tx * 16, cy + ty * 16), P(cx - tx * 4 + math.cos(a) * 14, cy - ty * 4 + math.sin(a) * 14),
                       P(cx - tx * 4 - math.cos(a) * 14, cy - ty * 4 - math.sin(a) * 14)], fill=W)
        # hộp quà isometric
        top = [P(100, 46), P(140, 64), P(100, 82), P(60, 64)]
        d.polygon(top, outline=W, width=lw)
        d.line([P(60, 64), P(60, 112), P(100, 130), P(140, 112), P(140, 64)], fill=W, width=lw, joint='curve')
        d.line([P(100, 82), P(100, 130)], fill=W, width=lw)
        d.line([P(80, 55), P(120, 73), P(120, 92)], fill=W, width=round(6 * U))
        # bàn tay đỡ
        d.line([P(40, 150), P(70, 140), P(104, 146), P(122, 140)], fill=W, width=lw, joint='curve')
        d.line([P(70, 140), P(94, 160), P(130, 160), P(162, 136)], fill=W, width=lw, joint='curve')
    elif name == 'gift':
        d.rounded_rectangle(R(18, 64, 182, 104), radius=6 * U, fill=W)
        d.rounded_rectangle(R(30, 110, 170, 190), radius=6 * U, fill=W)
        d.rectangle(R(92, 60, 108, 192), fill=B)
        d.ellipse(R(52, 18, 100, 62), outline=W, width=lw)
        d.ellipse(R(100, 18, 148, 62), outline=W, width=lw)
        d.rectangle(R(40, 44, 160, 60), fill=(0, 0, 0, 0))
        d.line([P(56, 60), P(96, 60)], fill=W, width=lw)
        d.line([P(104, 60), P(144, 60)], fill=W, width=lw)
    elif name == 'headset':
        d.ellipse(R(64, 24, 136, 104), outline=W, width=lw)
        d.arc(R(48, 10, 152, 110), 180, 360, fill=W, width=lw)
        d.rounded_rectangle(R(40, 54, 60, 88), radius=8 * U, fill=W)
        d.rounded_rectangle(R(140, 54, 160, 88), radius=8 * U, fill=W)
        d.arc(R(60, 40, 152, 118), 30, 120, fill=W, width=round(6 * U))
        d.ellipse(R(70, 104, 90, 118), fill=W)
        d.arc(R(22, 116, 178, 260), 180, 360, fill=W, width=lw)
        d.line([P(22, 188), P(178, 188)], fill=W, width=lw)
        d.line([P(78, 124), P(100, 150), P(122, 124)], fill=W, width=lw, joint='curve')
        d.line([P(100, 150), P(100, 186)], fill=W, width=round(6 * U))
    elif name == 'shield':
        pts = [P(100, 14), P(172, 40), P(166, 112), P(100, 186), P(34, 112), P(28, 40)]
        d.polygon(pts, outline=W, width=lw)
        d.line([P(66, 100), P(92, 126), P(138, 74)], fill=W, width=round(14 * U), joint='curve')
    elif name == 'chat':
        d.rounded_rectangle(R(14, 24, 186, 146), radius=34 * U, outline=W, width=lw)
        d.polygon([P(52, 140), P(46, 184), P(92, 144)], fill=W)
        for cx in (62, 100, 138):
            d.ellipse(R(cx - 11, 74, cx + 11, 96), fill=W)
    elif name == 'star':
        pts = []
        for i in range(10):
            a = -math.pi / 2 + i * math.pi / 5
            r = 90 if i % 2 == 0 else 38
            pts.append(P(100 + r * math.cos(a), 104 + r * math.sin(a)))
        d.polygon(pts, fill=W)
    elif name == 'heart':
        d.ellipse(R(20, 30, 104, 114), fill=W)
        d.ellipse(R(96, 30, 180, 114), fill=W)
        d.polygon([P(24, 90), P(176, 90), P(100, 178)], fill=W)
    else:
        raise SystemExit(f'LỖI: không có icon "{name}". Có: truck, return, gift, headset, shield, chat, star, heart')
    return im.resize((px, px), Image.LANCZOS)


# ---------------- khối dùng chung ----------------
def draw_script_and_title(canvas, o, w, y_script, script_size, title_size, layout):
    """layout 'center' (loi-ich: script + brand trên 1 hàng, tiêu đề dưới căn giữa)
    hoặc 'stagger' (ban-chay: script lệch trái, tiêu đề lệch phải bên dưới)."""
    th = o['theme']
    d = ImageDraw.Draw(canvas)
    fs = font(F_SCRIPT, script_size)
    sw, sh, _, _ = text_size(fs, o['script'])
    stroke = round(script_size * 0.03)
    if layout == 'center':
        b = o.get('brand') or {}
        brand = brand_block(o, round(script_size * (1.12 if b.get('logo') and not b.get('text') else 0.8)))
        gap = round(script_size * 0.22)
        total = sw + (gap + brand.width if brand else 0)
        x0 = (w - total) // 2
        draw_text(d, (x0, y_script), o['script'], fs, rgb(th['accent']), stroke=stroke, stroke_fill=(255, 255, 255, 255))
        if brand:
            by = y_script + (sh - brand.height) // 2
            canvas.alpha_composite(shadow_layer(canvas.size, lambda m: m.rounded_rectangle(
                (x0 + sw + gap, by, x0 + sw + gap + brand.width, by + brand.height), radius=brand.height // 5, fill=255),
                12 * SS, (0, 6 * SS), 70))
            canvas.alpha_composite(brand, (x0 + sw + gap, by))
        ft, tr = fit_font(F_BLACK, o['title'], w - 120 * SS, title_size, 0.06)
        tw, tth, _, _ = text_size(ft, o['title'], tr)
        ty = y_script + sh + round(script_size * 0.14)
        draw_text(d, ((w - tw) // 2, ty), o['title'], ft, rgb(th['primary']), tr)
        return ty + tth
    if layout == 'inline':
        # script + tiêu đề trên cùng một đường cơ sở, căn giữa trong [x_left, w]
        x_left = o['_inline_left']
        avail = w - x_left - 70 * SS                      # chừa lề phải cho sao và mép banner
        k = 1.0
        while True:                                        # thu nhỏ cả hàng chữ cho vừa
            fs = font(F_SCRIPT, script_size * k)
            ft = font(F_BLACK, title_size * k); tr = round(title_size * k * 0.04)
            sw = text_size(fs, o['script'])[0]
            tw = text_size(ft, o['title'], tr)[0]
            gap = round(script_size * k * 0.18)
            b = o.get('brand') or {}
            brand = brand_block(o, round(title_size * k * (1.25 if b.get('logo') and not b.get('text') else 0.9)))
            total = sw + gap + tw + (gap + brand.width if brand else 0)
            if total <= avail or k < 0.5:
                break
            k *= 0.96
        x0 = x_left + (w - x_left - total) // 2
        base = y_script + round(fs.getbbox(nfc(o['script']), anchor='ls')[1] * -1)
        d.text((x0, base), nfc(o['script']), font=fs, fill=rgb(th['accent']), anchor='ls',
               stroke_width=stroke, stroke_fill=(255, 255, 255, 255))
        x = x0 + sw + gap
        for c in nfc(o['title']):
            d.text((x, base), c, font=ft, fill=rgb(th['primary']), anchor='ls')
            x += ft.getlength(c) + tr
        if brand:                                          # logo shop cuối hàng, căn giữa theo chiều cao chữ in hoa
            cap_top = base + ft.getbbox('H', anchor='ls')[1]
            bx, by = round(x - tr + gap), round((cap_top + base) / 2 - brand.height / 2)
            canvas.alpha_composite(shadow_layer(canvas.size, lambda m: m.rounded_rectangle(
                (bx, by, bx + brand.width, by + brand.height), radius=brand.height // 5, fill=255), 12 * SS, (0, 6 * SS), 70))
            canvas.alpha_composite(brand, (bx, by))
            return max(by + brand.height, base + ft.getbbox(nfc(o['title']), anchor='ls')[3])
        return base + max(fs.getbbox(nfc(o['script']), anchor='ls')[3], ft.getbbox(nfc(o['title']), anchor='ls')[3])
    # stagger
    x0 = round(w * 0.14)
    draw_text(d, (x0, y_script), o['script'], fs, rgb(th['accent']), stroke=stroke, stroke_fill=(255, 255, 255, 255))
    ft, tr = fit_font(F_BLACK, o['title'], round(w * 0.56), title_size, 0.04)
    tw, tth, _, _ = text_size(ft, o['title'], tr)
    tx = min(w - 170 * SS - tw, round(w * 0.32))
    ty = y_script + sh - round(script_size * 0.02)
    draw_text(d, (tx, ty), o['title'], ft, rgb(th['primary']), tr)
    return ty + tth


def brand_block(o, h):
    b = o.get('brand')
    if not b:
        return None
    th = o['theme']
    parts = []
    if b.get('logo'):                                      # logo (và chữ, nếu có) xếp ngang trong khung trắng
        lg = Image.open(rel(b['logo'])).convert('RGBA')
        lg = lg.crop(lg.getchannel('A').getbbox())
        lh = round(h * 0.84)
        parts.append(lg.resize((round(lg.width * lh / lg.height), lh), Image.LANCZOS))
    if b.get('text'):
        f, _ = fit_font(F_BLACK, b['text'], 10 ** 6, h * 0.42)
        tw, tth, _, _ = text_size(f, b['text'])
        t = Image.new('RGBA', (tw + 4, tth + 4), (0, 0, 0, 0))
        draw_text(ImageDraw.Draw(t), (2, 2), b['text'], f, rgb(th['accent']))
        parts.append(t)
    gap = round(h * 0.14)
    inner = Image.new('RGBA', (sum(p.width for p in parts) + gap * (len(parts) - 1), max(p.height for p in parts)), (0, 0, 0, 0))
    x = 0
    for p in parts:
        inner.alpha_composite(p, (x, (inner.height - p.height) // 2)); x += p.width + gap
    bw = inner.width + 2 * round(h * (0.16 if b.get('logo') and not b.get('text') else 0.24))
    box = Image.new('RGBA', (bw, h), (0, 0, 0, 0))
    bd = ImageDraw.Draw(box)
    bd.rounded_rectangle((0, 0, bw - 1, h - 1), radius=h // 5, fill=(255, 255, 255, 245),
                         outline=rgb(th['card_top']), width=max(2, h // 60))
    box.alpha_composite(inner, ((bw - inner.width) // 2, (h - inner.height) // 2))
    return box


def sparkles(canvas, o, pts):
    d = ImageDraw.Draw(canvas)
    for fx, fy, r in pts:
        sparkle(d, fx * canvas.width, fy * canvas.height, r * SS, o['theme']['sparkle'])


# ---------------- mẫu 1: lợi ích ----------------
def render_loi_ich(o, w, h):
    canvas = make_background(o, w, h)
    th = o['theme']
    H0 = h / SS
    if H0 >= 650:
        L = dict(ys=56, script=104, title=138, ch=236, bottom=75, icon=104, itop=24, lab=25, lh=31, lbot=26)
    elif H0 >= 570:   # 2:1 (1200x600)
        L = dict(ys=34, script=96, title=124, ch=236, bottom=44, icon=100, itop=24, lab=24, lh=30, lbot=26)
    else:             # 1200x518
        L = dict(ys=22, script=84, title=104, ch=212, bottom=30, icon=88, itop=20, lab=22, lh=27, lbot=22)
    L = {k: v * SS for k, v in L.items()}
    title_bottom = draw_script_and_title(canvas, o, w, L['ys'], L['script'], L['title'], 'center')
    items = o['items']
    n = len(items)
    if not 2 <= n <= 5:
        raise SystemExit('LỖI: "items" cần 2-5 mục')
    mx, gap = 62 * SS, 25 * SS
    cw = (w - 2 * mx - gap * (n - 1)) // n
    ch = L['ch']
    cy = h - L['bottom'] - ch
    sparkles(canvas, o, [(0.035, 0.24, 13), (0.91, 0.24, 17), (0.04, 0.94, 8),
                         (0.44, (title_bottom + cy) / 2 / h, 15)])
    flab = font(F_XBOLD, L['lab'])
    for i, it in enumerate(items):
        x = mx + i * (cw + gap)
        box = (x, cy, x + cw, cy + ch)
        rad = 22 * SS
        canvas.alpha_composite(shadow_layer(canvas.size, lambda m: m.rounded_rectangle(box, radius=rad, fill=255),
                                            14 * SS, (0, 8 * SS), 80))
        card = gradient(cw, ch, th['card_top'], th['card_bottom'])
        mask = Image.new('L', (cw, ch), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, cw - 1, ch - 1), radius=rad, fill=255)
        canvas.paste(card, (x, cy), mask)
        ImageDraw.Draw(canvas).rounded_rectangle(box, radius=rad, outline=(255, 255, 255, 110), width=2 * SS)
        isz = round(min(cw * 0.56, L['icon']))
        ic = icon_layer(it['icon'], isz, rgb(th['card_top']))
        canvas.alpha_composite(ic, (x + (cw - isz) // 2, cy + L['itop']))
        lines = it['label'] if isinstance(it['label'], list) else [it['label']]
        d = ImageDraw.Draw(canvas)
        lh = L['lh']
        cap = flab.getbbox('H')[3] - flab.getbbox('H')[1]
        base0 = cy + ch - L['lbot'] - lh * (len(lines) - 1)   # đường cơ sở dòng cuối cách đáy thẻ 26px
        if base0 - cap < cy + L['itop'] + isz + 10 * SS:
            raise SystemExit('LỖI: nhãn quá nhiều dòng, đè lên icon - rút gọn "label" (tối đa 2 dòng)')
        for j, line in enumerate(lines):
            f, _ = fit_font(F_XBOLD, nfc(line.upper()), cw - 28 * SS, flab.size)
            d.text((x + cw // 2, base0 + j * lh), nfc(line.upper()), font=f, fill=(255, 255, 255, 255), anchor='ms')
    return canvas


# ---------------- mẫu 2: bán chạy ----------------
def person_cutout(img, model):
    import cv2
    import onnxruntime as ort
    sess = ort.InferenceSession(model)
    a = np.asarray(img.convert('RGB'))
    H, W = a.shape[:2]
    x = cv2.resize(a.astype(np.float32) / 255, (320, 320), interpolation=cv2.INTER_AREA)
    x = (x / x.max() - [0.485, 0.456, 0.406]) / [0.229, 0.224, 0.225]
    p = sess.run(None, {sess.get_inputs()[0].name: x.transpose(2, 0, 1)[None].astype(np.float32)})[0][0, 0]
    p = (p - p.min()) / (p.max() - p.min())
    p = np.clip((cv2.resize(p, (W, H), interpolation=cv2.INTER_CUBIC) - 0.45) / 0.25, 0, 1)
    p = cv2.erode(p, np.ones((3, 3), np.uint8))           # bỏ viền sáng của nền cũ quanh người
    p = cv2.GaussianBlur(p, (0, 0), 1.2)
    out = img.convert('RGBA')
    out.putalpha(Image.fromarray((p * 255).astype(np.uint8)))
    return out


def person_focus_x(img, frame_ratio, o):
    """focus x cho cover() để tâm người mẫu (theo mask u2net) nằm giữa khung."""
    a = np.asarray(person_cutout(img, o.get('model', os.path.expanduser('~/models/u2net_human_seg.onnx'))).getchannel('A'), float)
    top = a[: max(1, int(a.shape[0] * 0.6))]                # nửa trên (đầu + áo), bỏ chân/váy xoè
    cols = top.sum(0)
    if cols.sum() < 1:
        return 0.5
    cx = float((cols * np.arange(len(cols))).sum() / cols.sum())
    crop_w = img.height * frame_ratio if img.width / img.height > frame_ratio else img.width
    free = img.width - crop_w
    return 0.5 if free <= 0 else min(1.0, max(0.0, (cx - crop_w / 2) / free))


def render_ban_chay(o, w, h):
    canvas = make_background(o, w, h)
    prods = o['products']
    if len(prods) != 4:
        raise SystemExit('LỖI: mẫu "ban-chay" cần đúng 4 ảnh trong "products"')
    wide = h < w * 0.6
    if wide:
        # banner ngang (1200x518): người mẫu cột trái, chữ 1 hàng phía trên, 4 ảnh xếp 1 hàng
        gx0, gap = 330 * SS, 18 * SS
        o['_inline_left'] = gx0
        sparkles(canvas, o, [(0.02, 0.10, 11), (0.985, 0.05, 9), (0.985, 0.95, 8)])
        k = h / SS / 518                                   # 518 -> 1.0, 600 (2:1) -> 1.16
        title_bottom = draw_script_and_title(canvas, o, w, round(20 * k) * SS, round(92 * min(k, 1.1)) * SS,
                                             round(88 * min(k, 1.1)) * SS, 'inline')
        gy0 = title_bottom + round(26 * k) * SS
        pw = (w - gx0 - 30 * SS - 3 * gap) // 4
        ph = h - gy0 - round(34 * k) * SS
        frames = [(gx0 + i * (pw + gap), gy0) for i in range(4)]
        hero_left_w = gx0 + round(pw * 0.08)
    else:
        sparkles(canvas, o, [(0.035, 0.12, 14), (0.91, 0.12, 16), (0.63, 0.10, 5), (0.37, 0.92, 14)])
        title_bottom = draw_script_and_title(canvas, o, w, 52 * SS, 150 * SS, 128 * SS, 'stagger')
        gx0, gap = 492 * SS, 24 * SS
        gy0 = max(title_bottom + 60 * SS, 370 * SS)
        pw = (w - gx0 - 34 * SS - gap) // 2
        ph = (h - gy0 - 92 * SS - gap) // 2
        frames = [(gx0 + (i % 2) * (pw + gap), gy0 + (i // 2) * (ph + gap)) for i in range(4)]
        hero_left_w = gx0 + round(pw * 0.08)
    rad = 14 * SS
    for p, (x, y) in zip(prods, frames):
        p = p if isinstance(p, dict) else {'src': p}
        box = (x, y, x + pw, y + ph)
        canvas.alpha_composite(shadow_layer(canvas.size, lambda m: m.rounded_rectangle(box, radius=rad, fill=255),
                                            12 * SS, (0, 6 * SS), 90))
        src_img = Image.open(rel(p['src'])).convert('RGB')
        if p.get('box'):                                   # cắt trước vùng [l, t, r, b] (px ảnh nguồn), ví dụ lấy nửa người trên
            src_img = src_img.crop(tuple(p['box']))
        focus = list(p.get('focus', (0.5, 0.3)))
        if p.get('auto_center', o.get('auto_center')) and 'focus' not in p:
            focus[0] = person_focus_x(src_img, pw / ph, o)
        ph_img = cover(src_img, pw, ph, tuple(focus))
        mask = Image.new('L', (pw, ph), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, pw - 1, ph - 1), radius=rad, fill=255)
        canvas.paste(ph_img, (x, y), mask)
        ImageDraw.Draw(canvas).rounded_rectangle(box, radius=rad, outline=(255, 255, 255, 255), width=3 * SS)
    if o.get('hero'):
        hero = Image.open(rel(o['hero']))
        if o.get('hero_cutout'):
            hero = person_cutout(hero, o.get('model', os.path.expanduser('~/models/u2net_human_seg.onnx')))
        hero = hero.convert('RGBA')
        bb = hero.getchannel('A').point(lambda v: 255 if v > 16 else 0).getbbox()
        if not bb or hero.getchannel('A').getextrema()[0] == 255:
            raise SystemExit('LỖI: ảnh "hero" chưa tách nền (không có vùng trong suốt). Dùng PNG đã tách nền hoặc "hero_cutout": true')
        hero = hero.crop(bb)
        target_h = round(h * o.get('hero_height', 0.95 if wide else 0.74))
        max_w = round(hero_left_w * (1.0 if wide else 1.02))
        s = min(target_h / hero.height, max_w / hero.width)
        hero = hero.resize((round(hero.width * s), round(hero.height * s)), Image.LANCZOS)
        hx = max(0, (hero_left_w - hero.width) // 2)
        hy = h - hero.height
        pad = 40 * SS                                      # chừa lề để bóng mờ không bị cắt thành vệt thẳng
        a = Image.new('L', (hero.width + 2 * pad, hero.height + 2 * pad), 0)
        a.paste(hero.getchannel('A'), (pad, pad))
        a = a.filter(ImageFilter.GaussianBlur(10 * SS))
        sh = Image.new('RGBA', a.size, (20, 70, 140, 0)); sh.putalpha(a.point(lambda v: v * 60 // 255))
        canvas.alpha_composite(sh, (hx + 8 * SS - pad, hy + 4 * SS - pad))
        canvas.alpha_composite(hero, (hx, hy))
    return canvas


def render(job):
    o = {**CFG, **job}
    o['theme'] = {**THEME, **CFG.get('theme', {}), **job.get('theme', {})}
    tpl = o.get('template')
    if tpl not in SIZES:
        raise SystemExit(f'LỖI: template phải là {list(SIZES)}')
    W = o.get('width', SIZES[tpl][0]); H = o.get('height', SIZES[tpl][1])
    w, h = W * SS, H * SS
    canvas = (render_loi_ich if tpl == 'loi-ich' else render_ban_chay)(o, w, h)
    out = canvas.convert('RGB').resize((W, H), Image.LANCZOS)
    od = rel(o.get('out_dir', 'out'))
    os.makedirs(od, exist_ok=True)
    path = os.path.join(od, o.get('out', f'banner-{tpl}.jpg'))
    for src in [o.get('hero'), o.get('background')] + [p if isinstance(p, str) else p.get('src') for p in o.get('products', [])]:
        if src and os.path.abspath(rel(src)) == os.path.abspath(path):
            raise SystemExit('LỖI: file xuất trùng ảnh nguồn')
    if path.lower().endswith('.png'):
        out.save(path)
        if os.path.getsize(path) > MAX_BYTES:
            raise SystemExit(f'LỖI: {path} > 2MB - xuất JPG thay vì PNG')
    else:
        q = o.get('quality', 92)
        out.save(path, quality=q, subsampling=0)
        while os.path.getsize(path) > MAX_BYTES and q > 70:  # giữ dưới giới hạn 2MB của Shopee
            q -= 4
            out.save(path, quality=q, subsampling=0)
    print('OK', path, f'{W}x{H}', f'{os.path.getsize(path) // 1024}KB')


if __name__ == '__main__':
    for j in CFG['jobs']:
        render(j)
