# Shopee - file xuất, loại chiến dịch, bẫy đã gặp

## 1. Các file xuất thường gặp

### Thống kê shop (`<shop>.shopee-shop-stats.<từ>-<đến>.xlsx`)
Lấy ở Kênh Người Bán > Phân tích bán hàng.
12 sheet, chia theo 3 loại đơn: **Đơn hàng đã đặt**, **Đơn đã xác nhận**, **Đơn Đã Thanh Toán**.
Với mỗi loại đơn có 4 sheet:
- Tổng quan: doanh số, số đơn, doanh số/đơn, lượt nhấp, lượt truy cập, tỉ lệ chuyển đổi, đơn hủy, hoàn trả, người mua mới / hiện tại / tiềm năng, tỉ lệ quay lại. Có dòng tổng và dòng theo ngày (hoặc theo giờ nếu xuất 1 ngày).
- Nguồn truy cập: thẻ sản phẩm (Đề xuất, Tìm kiếm, Cửa hàng, Giỏ hàng, Chat, Đơn mua của tôi, Khuyến mãi, Khác), Live, Video, Tiếp thị liên kết, và **Dịch vụ Hiển thị Shopee** (chi phí ads, ROAS theo loại chiến dịch).
- Theo nguồn lưu lượng, chia theo ngày.
- Theo sản phẩm: hiển thị, nhấp, CTR, đơn, doanh số từng mã sản phẩm.

Định dạng số: dấu chấm phân cách hàng nghìn (`1.584.000`), dấu phẩy thập phân (`2,20%`).
"Tỷ lệ chuyển đổi đơn hàng" ở tổng quan = đơn / lượt truy cập; ở bảng sản phẩm và nguồn = đơn / lượt nhấp.
"Người mua tiềm năng" là tệp có thể remarketing (gửi voucher, chat).

### Báo cáo Dịch vụ Hiển thị (`Dữ liệu Dịch vụ Hiển thị Shopee-<từ>-<đến>.csv`)
8 dòng đầu là thông tin shop, **"Thời gian tạo báo cáo"** và "Khoảng thời gian", rồi mới tới tiêu đề cột.
Mỗi dòng một chiến dịch: tên, trạng thái, loại, mã sản phẩm, phương thức đấu thầu, ngày bắt đầu/kết thúc, lượt xem, click, CTR, chuyển đổi, chi phí mỗi chuyển đổi, doanh số, chi phí, ROAS, ACOS.
Định dạng số kiểu Mỹ (`16274.02`, `3.61%`), khác file xlsx.
Bản "Cấp độ Từ khóa - Vị trí" thêm cột từ khoá. Nếu mọi dòng là "Quảng cáo Tự Động" và từ khoá trống thì chiến dịch đang tự động, file không cho thêm thông tin.
Bản "Tất cả chiến dịch nhóm" có dòng chiến dịch rồi các dòng sản phẩm con bên dưới; chỉ chứa chiến dịch nhóm, không có chiến dịch đơn và chiến dịch cấp shop.

## 2. Tên trên báo cáo khác tên trên giao diện

| Tên trong báo cáo shop / CSV | Tên trên giao diện quản lý ads |
|---|---|
| Quảng cáo GMV tối đa **tự động đấu thầu** cho sản phẩm; "Tối Đa Doanh Thu ROAS Tối Ưu Bởi Hệ Thống" | Dịch vụ Hiển thị Sản phẩm (Tối đa Doanh thu - **Tối ưu ROAS bởi Hệ thống**) |
| Quảng cáo GMV tối đa **ROAS tùy chỉnh** cho sản phẩm | Dịch vụ Hiển thị Sản phẩm (Tối đa Doanh thu - **Tùy chỉnh ROAS**) |
| Product Ads (GMV Max-Shop); "GMV Max Auto Bidding (Shop)" | Chiến dịch Tự Động Chọn Sản phẩm (cấp độ Shop); có thể hiện là Product Ads (Chiến Dịch Nhóm) |
| (chưa thấy trong báo cáo) | Giá thầu Tự động - Tiêu chuẩn; Giá thầu Thủ Công |
| Dịch vụ Hiển thị Sản phẩm, có Giai đoạn 1 / Giai đoạn 2 | Dịch Vụ Hiển Thị Sản Phẩm Mới (tạo từ mục "Quảng Bá Sản Phẩm Mới") |

Khi khuyên tắt hoặc giữ, luôn đưa tên theo giao diện và cách xác nhận (lọc loại chiến dịch, chọn đúng khoảng ngày, so chi phí với số trên báo cáo).
Mapping này suy ra từ tên và đối chiếu chi phí, không phải tài liệu chính thức; nếu số không khớp thì nói rõ và hỏi thêm ảnh.

## 3. Các loại chiến dịch và đặc điểm

- **Tối ưu ROAS bởi Hệ thống**: không đặt ROAS mục tiêu, hệ thống tự quyết. Thực tế đã gặp ROAS 1,53 cả tuần, lỗ nặng. Tránh dùng cho sản phẩm đã bán lâu.
- **Tùy chỉnh ROAS**: tự nhập ROAS mục tiêu. Giao diện gợi ý vài mức (ví dụ 5,4 / 8,1 / 9,8) kèm "độ cạnh tranh hiển thị"; mức càng cao càng ít hiển thị. Shopee ghi "ước tính đạt 80-120% mục tiêu sau 7 ngày máy học".
- **Chiến Dịch Nhóm**: nhiều sản phẩm (tối thiểu 2, tối đa 30) chung ngân sách và ROAS; hợp với sản phẩm có biên lợi nhuận tương tự.
- **Chiến Dịch Đơn**: một sản phẩm, ROAS riêng.
- **Chiến dịch Tự Động Chọn Sản phẩm (cấp độ Shop)**: hệ thống tự chọn sản phẩm; dễ trùng sản phẩm với chiến dịch khác.
- **Quảng Bá Sản Phẩm Mới**: chỉ cho sản phẩm tạo trong 30 ngày, được "lưu lượng độc quyền". Có 2 giai đoạn cố định:
  - Giai đoạn 1 "Đột phá doanh số": Tối ưu ROAS bởi Hệ thống, khoảng ROAS cố định (đã gặp 4,00 - 7,20), **không chỉnh được**.
  - Giai đoạn 2 "Tăng tốc bán hàng": Tùy chỉnh ROAS, **chỉnh được** bằng biểu tượng bút chì (mặc định đã gặp 4,0), có nút Đẩy nhanh (mặc định bật).
  - Chỉ đáng dùng khi ROAS hoà vốn của sản phẩm thấp hơn mức dưới của giai đoạn 1.
- **Giá thầu Thủ Công**: loại duy nhất cho chọn từ khoá, vị trí, giá thầu. Dùng để thử từ khoá khi chiến dịch ROAS đã ổn định.
- **Hỗ trợ Kinh phí Hiệu suất**: nếu ROAS thực tế thấp hơn mục tiêu, Shopee bù chênh lệch bằng **ưu đãi quảng cáo**, không phải tiền mặt. Giảm rủi ro nhưng không bảo vệ lợi nhuận.
- **Đẩy nhanh**: tiêu nhanh hơn, kéo ROAS xuống. Mặc định nên tắt.

## 4. Giới hạn đã gặp

- Ngân sách ngày tối thiểu của chiến dịch nhóm: **100.000đ**. Ngân sách là trần, shop nhỏ thường không tiêu hết; nhưng nhiều chiến dịch cộng lại có thể vượt doanh số ngày.
- "Giá trị ước tính của mã giảm giá" cạnh ô ngân sách **không phải ngân sách**, dễ bị nhầm.
- Không có nhắm theo độ tuổi, giới tính, địa lý; chỉ có lịch theo ngày (chưa thấy lịch theo giờ). Nhắm đối tượng gián tiếp qua ảnh bìa, tiêu đề, từ khoá, voucher.
- Đổi ROAS hoặc sản phẩm trong 7 ngày đầu làm máy học lại.

## 5. Mốc tham khảo cho ngành thời trang (quy tắc kinh nghiệm, không phải số chính thức)

- CTR: dưới 1,5% là yếu, 2-4% là khá.
- Tỉ lệ chuyển đổi (đơn / truy cập): 1-3% là bình thường; trên 2% là tốt.
- Cần khoảng 30-100 lượt truy cập mới kỳ vọng 1 đơn; ngày 0 đơn với vài lượt truy cập không nói lên gì.
- Phí sàn tổng (cố định, thanh toán, freeship Xtra, voucher Xtra) thường quanh 12-18% giá bán; luôn xin số thật.
