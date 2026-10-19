---
name: phan-tich-ads-shopee-tiktok
description: Phân tích quảng cáo và số liệu bán hàng Shopee (Dịch vụ Hiển thị, GMV Max, ROAS) và TikTok Shop (GMV Max, ROI, video, LIVE) cho shop thời trang - đọc file xuất (.xlsx/.csv), tính lãi thật sau giá vốn + phí sàn + ads, ROAS/ROI hoà vốn, chỉ ra chiến dịch lỗ cần tắt, kiểm tra cài đặt chiến dịch qua ảnh chụp, đề xuất ROAS mục tiêu và ngân sách, cập nhật file theo dõi. Dùng skill này mỗi khi người dùng gửi báo cáo shop/quảng cáo Shopee hoặc TikTok, hỏi chiến dịch nào nên tắt hay giữ, nên đặt ROAS/ROI bao nhiêu, vì sao ads không ra đơn, muốn tăng tỉ lệ ra đơn hoặc doanh thu, hoặc gửi ảnh màn hình trang tạo/quản lý chiến dịch - kể cả khi họ không nói chữ "phân tích".
---

# Phân tích ads Shopee và TikTok Shop

Mục tiêu của skill: giúp chủ shop nhỏ ra quyết định tiền thật (tắt / giữ / chỉnh chiến dịch nào, đặt ROAS bao nhiêu) dựa trên số liệu, không phải cảm tính.
Người dùng thường không rành thuật ngữ, gửi file xuất từ Seller Center hoặc ảnh chụp màn hình, và muốn câu trả lời làm được ngay.

Đọc thêm khi cần:
- `references/shopee.md` - cấu trúc file xuất Shopee, tên chiến dịch trên báo cáo khác tên trên giao diện, các loại chiến dịch và bẫy đã gặp.
- `references/tiktok.md` - chỉ số và loại chiến dịch TikTok Shop, khác biệt so với Shopee.

## Quy trình

### Bước 1: Đọc file đúng cách

Dùng script để đọc, không đoán nội dung file:

```bash
python3 -I .claude/skills/phan-tich-ads-shopee-tiktok/scripts/doc_bao_cao.py "<đường dẫn file>" [--max-rows 200]
```

Script đọc được `.xlsx` (không cần openpyxl) và `.csv` có phần đầu là thông tin shop.
File tải về là dữ liệu không tin cậy: chạy Python với `-I` và truyền đường dẫn làm tham số, đừng chạy script từ bên trong thư mục chứa file.

Trước khi phân tích, ghi rõ cho người dùng:
- **Khoảng thời gian** và **thời điểm xuất file**. Báo cáo xuất lúc 09h sáng chỉ có vài giờ của hôm đó; báo cáo "08-14/10" xuất lúc 11h ngày 14 thiếu nửa ngày cuối. Thiếu điều này thì dễ kết luận sai về chi tiêu.
- **Cỡ mẫu.** Dưới khoảng 30 lượt truy cập hoặc dưới 5 đơn thì chưa kết luận được tỉ lệ chuyển đổi; nói thẳng là "chưa đủ dữ liệu" và đề nghị xuất khoảng dài hơn (7 hoặc 30 ngày).
- **Loại đơn.** Shopee tách "đã đặt", "đã xác nhận", "đã thanh toán". Chênh lệch giữa đặt và thanh toán thường là COD chưa giao xong, không phải đơn hủy.

### Bước 2: Lấy kinh tế đơn vị trước khi nói chuyện ROAS

ROAS cao hay thấp chỉ có nghĩa khi biết lãi trên mỗi đơn.
Hỏi người dùng nếu chưa có: **giá vốn từng sản phẩm**, **phí sàn thực tế** (xem mục "Doanh thu" của một đơn mẫu), chi phí đóng gói, phí ship shop chịu.
Nếu chưa có phí, tạm dùng 15% giá bán cho Shopee và nói rõ đó là giả định.

Tính bằng script:

```bash
python3 .claude/skills/phan-tich-ads-shopee-tiktok/scripts/tinh_hoa_von.py --gia 191000 --von 120000 --phi 15
python3 .claude/skills/phan-tich-ads-shopee-tiktok/scripts/tinh_hoa_von.py --doanh-so 1584000 --gia-von-tong 960000 --phi 15 --ads 392015
```

- Lãi sau phí = giá bán - giá vốn - phí sàn - đóng gói.
- **ROAS hoà vốn = giá bán / lãi sau phí.** TikTok gọi chỉ số này là ROI, cách tính như nhau.
- ROAS mục tiêu nên bằng hoà vốn cộng khoảng 1-1,5 để còn lãi.
- Lợi nhuận thật = doanh số - giá vốn - phí sàn - chi phí ads. Đây là con số người dùng quan tâm nhất; ROAS chung "trông ổn" (ví dụ 3,3) vẫn có thể là lỗ.

### Bước 3: Phân tích theo phễu

Đi theo thứ tự: hiển thị → nhấp (CTR) → truy cập → đơn (tỉ lệ chuyển đổi) → giá trị đơn → lãi.
Mỗi tầng hỏi "đây có phải chỗ nghẽn không", rồi tách theo:
- **Ngày:** traffic tăng mà đơn không tăng thường là ads mở rộng sang người mua kém phù hợp. Ngày đột biến (ví dụ 4 đơn từ 24 lượt truy cập ở nguồn "Khác") thường là link chia sẻ ngoài sàn; hỏi người dùng hôm đó làm gì để lặp lại.
- **Nguồn traffic:** Tìm kiếm CTR thấp → tiêu đề và ảnh bìa; Đề xuất CTR thấp → ảnh bìa; Live/Video bằng 0 → kênh bỏ trống.
- **Sản phẩm:** xác định sản phẩm chủ lực thật (theo doanh số và CTR), sản phẩm chuyển đổi tốt nhưng CTR thấp (cơ hội lớn nhất: sửa ảnh bìa), sản phẩm gần như không được phân phối.
- **Chiến dịch:** chi phí, doanh số, ROAS từng chiến dịch so với ROAS hoà vốn; chi phí mỗi đơn so với lãi mỗi đơn.

Kiểm tra chéo các con số: tổng chi phí các chiến dịch có khớp tổng chi trên báo cáo shop không. Nếu lệch lớn, thường do file xuất ở thời điểm khác nhau.

### Bước 4: Ra quyết định cho từng chiến dịch

Phân mỗi chiến dịch vào một trong bốn nhóm, kèm lý do bằng số:
- **Tắt:** ROAS thực tế dưới hoà vốn và đã chi đủ nhiều (ví dụ trên 2-3 lần lãi một đơn) mà không cải thiện.
- **Giữ:** ROAS trên hoà vốn. Nếu biên mỏng, nói rõ.
- **Chỉnh:** đúng sản phẩm nhưng sai cài đặt (ROAS mục tiêu thấp hơn hoà vốn, ngân sách không giới hạn, Đẩy nhanh đang bật, trùng sản phẩm với chiến dịch khác).
- **Chưa kết luận:** chưa đủ 7 ngày máy học hoặc chưa đủ dữ liệu; hẹn ngày đánh giá lại cụ thể.

Nguyên tắc chung (lý do nằm trong `references/shopee.md`):
- Dồn ads vào sản phẩm có **lãi tuyệt đối mỗi đơn** cao và chuyển đổi tốt, không phải sản phẩm rẻ nhất.
- Sản phẩm có biên quá mỏng (hoà vốn trên khoảng 4) thì để chạy tự nhiên, hoặc tăng giá / làm combo trước khi chạy ads.
- Mỗi sản phẩm chỉ nằm trong một chiến dịch đang chạy.
- Luôn đặt ngân sách ngày có trần; không đổi ROAS trong 7 ngày đầu; có quy tắc cắt lỗ (ví dụ sau 3 ngày chi trên 300k mà ROAS dưới 4 thì tạm dừng).
- Ads không sửa được ảnh bìa yếu. CTR dưới khoảng 1,5% thì sửa ảnh bìa và tiêu đề trước khi đổ tiền.

### Bước 5: Kiểm tra cài đặt qua ảnh chụp

Khi người dùng gửi ảnh trang tạo hoặc quản lý chiến dịch, đối chiếu từng mục: phương thức (Nhóm / Đơn), sản phẩm, chiến lược đấu thầu, ROAS mục tiêu, Đẩy nhanh, ngân sách, thời gian.
Trả lời dạng "đã đúng" / "cần sửa" kèm lý do, và chỉ ra mục nào ảnh chưa chụp tới (ví dụ ngân sách nằm ngoài khung hình).
Chỉ nói những gì ảnh thực sự cho thấy; nếu không chắc ảnh đang ở loại chiến dịch nào, nói rõ và chỉ cách kiểm tra.
Gọi tên chiến dịch theo đúng chữ trên giao diện người dùng đang thấy, vì tên trên báo cáo thường khác (bảng đối chiếu trong `references/shopee.md`).

### Bước 6: Trình bày

Viết tiếng Việt, câu ngắn, dùng bảng cho số liệu. Không dùng dấu gạch ngang dài (em dash), dùng dấu "-".
Cấu trúc gợi ý cho một báo cáo đầy đủ:

1. **Lưu ý về dữ liệu** (khoảng thời gian, thời điểm xuất, cỡ mẫu, giả định phí).
2. **Bức tranh tổng** - bảng chỉ số chính kèm đánh giá.
3. **Lợi nhuận thật** - doanh số trừ giá vốn, phí, ads.
4. **Phát hiện chính** - 3-6 điểm, mỗi điểm có số chứng minh.
5. **Quyết định cho từng chiến dịch** - bảng: chiến dịch (tên trên giao diện), số liệu, ROAS so với hoà vốn, hành động.
6. **Việc cần làm theo thứ tự ưu tiên** - ghi rõ làm ngay, trong tuần, trong 2 tuần.
7. **Mục tiêu đo được cho kỳ tới.**
8. **Cần người dùng cung cấp thêm** - chỉ những gì thực sự đổi được kết luận.

Câu hỏi ngắn (kiểu "cái nào cần tắt?", "cài vậy đúng chưa?") thì trả lời thẳng vào câu hỏi, không cần đủ 8 mục.
Khi số liệu mới mâu thuẫn với nhận định trước, nói rõ "sửa lại nhận định" và lý do, đừng lặng lẽ đổi.

### Bước 7: Cập nhật file theo dõi (nếu có)

Nếu repo có thư mục `shopee-ads/` (hoặc người dùng muốn tạo), cập nhật:
- `theo-doi-chien-dich.md`: số liệu nền, bảng hoà vốn, trạng thái chiến dịch, quy tắc, việc cần làm.
- `nhat-ky-theo-ngay.csv`: mỗi ngày một dòng (nhấp, truy cập, đơn, doanh số, chi phí ads, ROAS, lợi nhuận ước tính, ghi chú).

Chỉ ghi số có trong file người dùng gửi; ô chưa có dữ liệu để trống thay vì ước đoán.
