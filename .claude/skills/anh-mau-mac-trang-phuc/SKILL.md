---
name: anh-mau-mac-trang-phuc
description: Tạo bộ ảnh người mẫu mặc trang phục theo 4 góc máy cốt lõi để khóa nhận diện 3D toàn diện (cận mặt, chính diện toàn thân, 3/4, sau lưng) trên nền trắng studio, giữ đúng khuôn mặt và trang phục, mỗi góc một file đặt tên theo góc, kèm README.md mô tả, lưu ở output_videos/refernce/<model>. Dùng khi người dùng gửi ảnh người mẫu (và tuỳ chọn ảnh áo, quần, phụ kiện) và nói "tạo ảnh mẫu mặc đồ", "mặc thử trang phục", "tạo các góc nhìn", "bảng góc máy", "ảnh tham chiếu cho Omni", hoặc cần ảnh [Model] trước khi làm video bằng skill tao-video.
---

# Ảnh người mẫu mặc trang phục, khóa nhận diện 3D toàn diện

Kết quả cuối: thư mục `output_videos/refernce/<model-slug>/` có một ảnh cho mỗi góc (tên file là tên góc) và `README.md` mô tả từng góc.
Bộ ảnh này dùng làm ảnh `[Model]` cho Omni Flash trên Google Flow, hoặc cho skill `tao-video`.

## 1. Thu đầu vào

Thiếu thì hỏi một lần, gộp các câu hỏi:

- Ảnh người mẫu (bắt buộc), rõ mặt, càng lớn càng tốt.
- Trang phục: hoặc người mẫu đã mặc sẵn trong ảnh, hoặc ảnh riêng của áo, quần, váy, giày, túi.
  Ghi lại màu, hoa văn, chất liệu, chi tiết (cổ, nút, dây buộc, tà).
  Không bịa chất liệu; không rõ thì tả theo hình thấy được.
- `model-slug`: ngắn, không dấu, gạch nối (ví dụ `model1`, `ba-ba-hoa-xuong`).
  Đã có thư mục cùng tên thì hỏi ghi đè hay tạo slug mới.
- Danh sách góc: mặc định 4 góc máy cốt lõi ở mục 2 để khóa nhận diện 3D toàn diện.

Chỉ dùng ảnh người mẫu của shop hoặc ảnh đã gen.
Ảnh người thật có thể nhận diện (người nổi tiếng, người lạ) thì từ chối và giải thích, Flow cũng sẽ chặn.

## 2. Bảng góc máy (Khóa nhận diện 3D toàn diện)

| File | Góc | Tỉ lệ | Từ khoá prompt |
|---|---|---|---|
| `can_mat.jpg` | Cận mặt (chân dung cận) | 3:4 | close-up portrait, head and shoulders, 85mm |
| `chinh_dien_toan_than.jpg` | Chính diện toàn thân, ngang tầm mắt | 9:16 | full body front view, eye level, standing straight facing camera |
| `goc_3_4.jpg` | Góc 3/4, khoảng 45 độ | 9:16 | full body three-quarter view, body turned 45 degrees |
| `goc_sau_lung.jpg` | Sau lưng (quay lưng 180 độ) | 9:16 | full body back view, facing away from camera |

## 3. Tạo ảnh

Quy tắc rút ra từ các lần làm trước (vi phạm là mặt bị lệch):

- **Mỗi góc tạo một ảnh riêng.**
  Không gen cả bảng nhiều ô trong một ảnh: mỗi mặt chỉ còn vài chục pixel, AI vẽ ra mặt chung chung, không giống người mẫu.
- Mỗi lần gen đều gửi kèm **ảnh gốc người mẫu** làm tham chiếu (và ảnh trang phục nếu có), không lấy ảnh vừa gen làm tham chiếu cho góc sau, để lỗi không cộng dồn.
- Nền trắng trơn studio, không đồ vật, không bóng đổ gắt, để tách nền và để Omni chỉ học nhân vật.
- Trang phục, kiểu tóc, phụ kiện giống hệt nhau ở mọi góc.

Mẫu prompt (thay phần trong ngoặc vuông; prompt tiếng Anh cho ổn định):

```
[Từ khoá góc ở bảng mục 2] of the exact same woman in the reference photo.
Keep 100% facial identity: same face shape, eyes, eyebrows, nose, lips, skin tone, same hairstyle [tả kiểu tóc, kẹp, nơ].
Wearing exactly [tả trang phục: áo, váy/quần, màu, hoa văn, chi tiết], [giày], [túi/phụ kiện], same as reference.
[Tư thế phù hợp góc, ví dụ: holding the bag with both hands in front].
Plain solid pure white seamless studio background, isolated subject, no props, soft even studio lighting.
Photorealistic, natural skin texture, sharp focus, 8k.
```

Cách gen theo công cụ đang có:

- Agent có công cụ tạo ảnh (ví dụ `generate_image` của Antigravity): gen từng góc với ảnh gốc trong `ImagePaths`, đúng tỉ lệ ở bảng, rồi chép file vào thư mục kết quả với đúng tên.
- Agent không tạo được ảnh (Claude Code): xuất 4 prompt, mỗi prompt một khối code có tiêu đề là tên file, để người dùng chạy trên Gemini hoặc node Generate Image (Nano Banana 2) của extension, rồi lưu ảnh đúng tên vào thư mục kết quả.

## 4. Soát từng ảnh

Xem từng ảnh ngay sau khi gen, so với ảnh gốc:

- Mặt: hình mặt, mắt, mũi, môi giống người mẫu; không "đẹp hoá" thành mặt khác.
- Trang phục: đúng màu, hoa văn, chi tiết; giày, túi không đổi kiểu giữa các góc.
- Góc đúng như tên file (ảnh "sau lưng" quay lưng 180 độ hoàn toàn không thấy mặt).
- Tay đủ năm ngón, không thừa chân tay, nền trắng sạch.

Ảnh lệch thì gen lại riêng góc đó, nói rõ hơn phần sai trong prompt.
Không giao ảnh lệch mặt; nếu gen lại vẫn lệch, báo người dùng góc nào chưa đạt.

## 5. Ghi README.md

Tạo `output_videos/refernce/<model-slug>/README.md`:

- Một đoạn mô tả người mẫu và trang phục.
- Bảng: tên file (link), tên góc, mô tả vị trí máy và tư thế.
- Đặc điểm kỹ thuật: nền, ánh sáng, tỉ lệ khung hình.

Mỗi câu một dòng, không dùng dấu gạch dài.

## 6. Dùng cho Omni trên extension

Báo người dùng (AI không mở được trang extension):

- Node Asset, label `Model`, nạp bộ 4 ảnh khóa nhận diện 3D toàn diện (`can_mat`, `chinh_dien_toan_than`, `goc_3_4`, `goc_sau_lung`).
- Tổng ảnh tham chiếu (Model + Outfit + Background + cảnh trước) tối đa `OMNI_MAX_REFS` = 7 khi tạo từ ảnh, và 5 kể cả video khi dùng Video reference.
- Generate Video chọn `Omni Flash`, prompt gọi nhân vật bằng `[Model]`.
- Ảnh local được upload lên Flow một lần, sau đó node giữ `flowMediaId`, không upload lại.

## Không làm

- Không commit ảnh trong `output_videos/`.
- Không gen ảnh từ ảnh người thật không phải người mẫu của shop.
- Không bấm Generate hay tiêu credit Flow khi người dùng chưa đồng ý.
