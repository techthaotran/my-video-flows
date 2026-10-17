"""Xoá dấu ngôi sao 4 cánh của Gemini/Flow ở góc dưới bên phải ảnh.
Usage: uv run --with opencv-contrib-python-headless --with numpy python -I xoa_dau_sao.py in.jpg out.jpg [cx cy R]
Mặc định cho ảnh 1493x2000: tâm (W-96, H-100), bán kính cánh 26px. Ảnh khác cỡ: đo lại tâm trên ảnh cắt góc.
Mặt nạ hình sao, inpaint FSR (giữ vân đá, đường nan quạt), lấy màu từ Telea để không lệch màu.
Ghi thêm *_chk.png (gốc | mặt nạ | kết quả) để kiểm tra.
"""
import sys
import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = cv2.imread(src)
H, W = im.shape[:2]
cx, cy, R = (int(v) for v in sys.argv[3:6]) if len(sys.argv) > 5 else (W - 96, H - 100, 26)
r = max(4, R // 4)
m = np.zeros((H, W), np.uint8)
pts = np.array([[cx, cy - R], [cx + r, cy - r], [cx + R, cy], [cx + r, cy + r],
                [cx, cy + R], [cx - r, cy + r], [cx - R, cy], [cx - r, cy - r]], np.int32)
cv2.fillPoly(m, [pts], 255)
m = cv2.dilate(m, np.ones((7, 7), np.uint8))
res = im.copy()
cv2.xphoto.inpaint(im, 255 - m, res, cv2.xphoto.INPAINT_FSR_BEST)
tel = cv2.inpaint(im, m, 9, cv2.INPAINT_TELEA)
L = cv2.cvtColor(res, cv2.COLOR_BGR2LAB)
L[..., 1:] = cv2.cvtColor(tel, cv2.COLOR_BGR2LAB)[..., 1:]
res = cv2.cvtColor(L, cv2.COLOR_LAB2BGR)
cv2.imwrite(out, res, [cv2.IMWRITE_JPEG_QUALITY, 95])
c = lambda a: a[cy - 60:cy + 60, cx - 60:cx + 60]
ov = im.copy()
ov[m > 0] = (0, 0, 255)
cv2.imwrite(out.rsplit('.', 1)[0] + '_chk.png', cv2.resize(np.hstack([c(im), c(ov), c(res)]), None, fx=2, fy=2))
print(out, (cx, cy, R))
