# TikTok Shop - chỉ số và loại chiến dịch

Phần này dựa trên hiểu biết chung về TikTok Shop Ads (Seller Center và TikTok Ads Manager), chưa đối chiếu với file xuất thật của shop.
Khi người dùng gửi file TikTok lần đầu, đọc tên cột thực tế bằng `scripts/doc_bao_cao.py` rồi đối chiếu với bảng dưới; nếu tên khác thì tin file, không tin bảng này, và bổ sung lại file này.

## 1. Khác biệt chính so với Shopee

- TikTok gọi ROAS là **ROI** (GMV / chi phí quảng cáo). Công thức hoà vốn giống Shopee: ROI hoà vốn = giá bán / lãi sau phí.
- Traffic chủ yếu đến từ **nội dung** (video, LIVE), không phải tìm kiếm. Chất lượng video quyết định CTR và giá mỗi đơn nhiều hơn tiêu đề sản phẩm.
- Doanh thu tách theo kênh: video của shop, LIVE, thẻ sản phẩm (product card / trang shop), và **affiliate** (nhà sáng tạo nhận hoa hồng).
- Phí sàn và hoa hồng affiliate khác Shopee; luôn hỏi số thật, không dùng mặc định 15% của Shopee mà không nói rõ.

## 2. Loại chiến dịch thường gặp

- **GMV Max (Product GMV Max)**: hệ thống tự phân phối sản phẩm và video, tối ưu theo ROI mục tiêu. Tương tự Tùy chỉnh ROAS của Shopee: đặt ROI mục tiêu cao hơn hoà vốn.
- **LIVE GMV Max**: tối ưu cho phiên LIVE, chỉ chạy khi đang LIVE.
- **Video Shopping Ads / quảng cáo video** (Ads Manager): chọn video, mục tiêu, đối tượng. Loại này **có** nhắm theo độ tuổi, giới tính, địa lý, sở thích, và lịch theo giờ, khác Shopee.
- Spark Ads: chạy quảng cáo trên video có sẵn (của shop hoặc nhà sáng tạo được cấp quyền).

## 3. Chỉ số cần xem

| Tầng | Chỉ số | Ý nghĩa khi xấu |
|---|---|---|
| Hiển thị | Impressions, CPM | CPM cao: cạnh tranh hoặc nhắm quá hẹp |
| Nội dung | Tỉ lệ xem 2 giây, 6 giây, thời gian xem trung bình | Thấp: 1-3 giây đầu video không giữ người xem, cần đổi hook |
| Nhấp | CTR, CPC | Thấp: video không dẫn tới sản phẩm, thiếu lời kêu gọi, sản phẩm xuất hiện muộn |
| Chuyển đổi | CVR, CPA (chi phí mỗi đơn) | Thấp: giá, trang sản phẩm, đánh giá, hoặc khác biệt giữa video và sản phẩm thật |
| Hiệu quả | GMV, ROI | So với ROI hoà vốn |

Phân tích theo **từng video**: thường vài video mang phần lớn GMV. Khuyên dồn ngân sách vào video thắng và làm thêm biến thể của nó, tắt video có tỉ lệ xem thấp.

## 4. Mốc tham khảo (quy tắc kinh nghiệm, kiểm tra lại với dữ liệu shop)

- Video có tỉ lệ xem 6 giây thấp rõ rệt so với các video khác của chính shop là ứng viên tắt đầu tiên; so trong nội bộ shop đáng tin hơn so với "chuẩn ngành".
- GMV Max cần vài ngày học như Shopee; tránh đổi ROI mục tiêu liên tục.
- Với thời trang, video mặc thử, xoay người, cận chất vải, so size thường hiệu quả hơn ảnh tĩnh ghép.

## 5. Khi phân tích cả hai sàn

- Tính lãi và ROI hoà vốn **riêng cho từng sàn** vì phí khác nhau.
- So sánh chi phí mỗi đơn và lãi mỗi đơn giữa hai sàn để quyết định dồn ngân sách vào đâu.
- Nội dung video làm cho TikTok có thể dùng lại cho Shopee Video (kênh Shopee thường đang bỏ trống).
