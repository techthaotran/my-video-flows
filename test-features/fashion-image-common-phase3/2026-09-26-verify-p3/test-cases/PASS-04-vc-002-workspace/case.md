# VC-002 — exportWorkspace / kind workspace

# Tổng quan
- Trạng thái: PASS
- Finding/contract cần kiểm chứng: VC-002
- Nguồn tạo test case: PLAN | BUSINESS_NEW
- Trích dẫn requirement/invariant: common plan Phase 3 — `exportWorkspace` + import `kind: 'workspace'` tạo workspace mới
- Hành vi cũ: chỉ export theo workflow list
- Hành vi mới mong đợi: manifest.kind=`workspace`; import tạo workspace mới (không ghi đè target)
- Phương pháp: package-test
- Phạm vi được chứng minh: STATIC
- Kết quả mong đợi: test `exportWorkspace → import tạo workspace mới` pass
- Kết quả thực tế: 1 passed
- Kết luận: Workspace export/import đạt; PASS.
- Screenshot: N/A (non-visual verification)

## Điều kiện trước khi chạy
- Screenshot gate GRANTED

## Dữ liệu kiểm thử
- Workspace «Trước Gương 3» + 1 workflow trống trong fake-idb

## Cách tái hiện thủ công
1. `cd /Users/ggj/MyWork/my-video-flows`
2. `pnpm exec vitest run --config vitest.config.ts tests/unit/transfer-hash.test.ts -t 'exportWorkspace'`
3. Quan sát 1 passed
4. Evidence: `evidence/step-01-vitest.txt`
5. Dọn: không cần

## Các bước và assertion
| Bước | Thao tác | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |
| 1 | vitest -t exportWorkspace | pass | 1 passed | PASS | step-01-vitest.txt |

## Trạng thái và side effect
- fake-idb; workspace mới được tạo trong test rồi wipe by beforeEach next run

## Danh sách bằng chứng gốc
- `evidence/step-01-vitest.txt`
- `evidence/step-02-coverage.txt`

## Giới hạn và dọn dẹp
- Không chứng minh SidePanel UI nút Export workspace (GUI Phase)
