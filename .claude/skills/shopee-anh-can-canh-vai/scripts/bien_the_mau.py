"""Ghép hàng vòng tròn biến thể màu lên góc trên bên phải ảnh cận cảnh áo.
Usage: uv run --with pillow python -I bien_the_mau.py config.json
config = {
  "src": "can-canh-tim.jpg",            # ảnh Flow, góc trên bên phải để trống
  "out": "can-canh-tim-3x4.jpg",
  "swatches": [                          # mỗi màu một vòng tròn trơn, thứ tự trái -> phải
    {"color": [200, 150, 220]},                                           # màu cho sẵn, hoặc
    {"img": "../ao-ba-ba-fix/ảnh bìa 3x4.jpg", "center": [450, 680], "size": 60}  # lấy trung vị màu vùng vải trơn
  ],
  "diameter": 0.11,                      # đường kính mỗi vòng / bề ngang ảnh
  "gap": 0.014, "margin": 0.035,         # khoảng cách giữa các vòng, lề trên và lề phải (tỉ lệ bề ngang)
  "patches": [{"box": [x0, y0, x1, y1], "from": [dx, dy], "ellipse": false}]   # tuỳ chọn: xoá nhãn cổ, dấu ngôi sao
}
Vòng tròn chỉ là màu trơn, không hoạ tiết, viền trắng mảnh, bóng đổ nhẹ. Không chữ trên ảnh.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SS = 4


def disc(size):
    m = Image.new('L', (size * SS, size * SS), 0)
    ImageDraw.Draw(m).ellipse((0, 0, size * SS - 1, size * SS - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def swatch_color(s, path):
    if 'color' in s:
        return tuple(s['color'])
    src = Image.open(path(s['img'])).convert('RGB')
    (sx, sy), ss = s['center'], s['size']
    a = np.asarray(src.crop((sx - ss // 2, sy - ss // 2, sx + ss // 2, sy + ss // 2)), np.float32).reshape(-1, 3)
    return tuple(int(v) for v in np.median(a, 0))


def patch(im, box, dx, dy, ellipse=False):
    p = im.crop((box[0] + dx, box[1] + dy, box[2] + dx, box[3] + dy))
    m = Image.new('L', p.size, 0)
    shape = (3, 3, p.width - 4, p.height - 4)
    (ImageDraw.Draw(m).ellipse if ellipse else ImageDraw.Draw(m).rectangle)(shape, fill=255)
    im.paste(p, tuple(box[:2]), m.filter(ImageFilter.GaussianBlur(2 if not ellipse else 5)))


def main(cfg_path):
    cfg = json.load(open(cfg_path))
    here = os.path.dirname(os.path.abspath(cfg_path))
    path = lambda p: p if os.path.isabs(p) else os.path.join(here, p)
    im = Image.open(path(cfg['src'])).convert('RGB')
    W, H = im.size
    for p in cfg.get('patches', []):
        patch(im, p['box'], *p['from'], p.get('ellipse', False))

    sw = cfg['swatches']
    d = round(W * cfg.get('diameter', 0.11))
    gap = round(W * cfg.get('gap', 0.014))
    margin = round(W * cfg.get('margin', 0.035))
    bw = max(3, round(d * 0.045))          # viền trắng
    pad = bw
    total = len(sw) * (d + 2 * pad) + (len(sw) - 1) * gap
    x = W - margin - total
    y = margin

    shadow = Image.new('L', im.size, 0)
    sd = ImageDraw.Draw(shadow)
    for i in range(len(sw)):
        cx = x + i * (d + 2 * pad + gap) + pad + d // 2
        cy = y + pad + d // 2
        r = d // 2 + bw
        sd.ellipse((cx - r, cy - r + d * 0.04, cx + r, cy + r + d * 0.07), fill=80)
    shadow = shadow.filter(ImageFilter.GaussianBlur(d * 0.08))
    im = Image.composite(Image.new('RGB', im.size, (70, 60, 55)), im, shadow)

    for i, s in enumerate(sw):
        color = swatch_color(s, path)
        print('mau', i + 1, color)
        tile = Image.new('RGB', (d, d), color)
        ox = x + i * (d + 2 * pad + gap) + pad
        oy = y + pad
        im.paste(Image.new('RGB', (d + 2 * bw,) * 2, 'white'), (ox - bw, oy - bw), disc(d + 2 * bw))
        im.paste(tile, (ox, oy), disc(d))

    h = round(W * 4 / 3)
    if h < H:
        im = im.crop((0, (H - h) // 2, W, (H - h) // 2 + h))
    im.save(path(cfg['out']), quality=95)
    print(cfg['out'], im.size)


if __name__ == '__main__':
    main(sys.argv[1])
