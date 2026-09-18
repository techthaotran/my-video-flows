# Định dạng bằng chứng kiểm chứng

AI Verify phải gom từng lần kiểm chứng vào một thư mục test case. Người đọc phải hiểu được kết quả từ
`case.md` và có thể tự chạy lại bằng tay mà không cần đọc lịch sử chat của agent.

## Ngôn ngữ bắt buộc

- `case.md`, `summary.md`, nội dung mô tả trong `case.json`/`summary.json`, chú thích evidence và báo
  cáo blocker phải viết bằng **tiếng Việt rõ ràng, câu ngắn và dễ hiểu**.
- Giữ nguyên tên file, JSON key, status, method, command, URL, HTTP field, code identifier và raw tool
  output bằng tiếng Anh khi dịch chúng có thể làm sai dữ liệu.
- Thuật ngữ kỹ thuật lần đầu xuất hiện nên kèm giải thích tiếng Việt ngắn. Không dùng câu chung chung
  như “hoạt động đúng”; phải ghi cụ thể đã làm gì, quan sát gì và vì sao kết luận PASS/NG/BLOCKED.

## Directory layout

```text
<repo-root>/test-features/<feature-slug>/<run-id>/test-cases/
├── summary.md
├── summary.json                    # only with --debug
├── PASS-01-<case-slug>/
│   ├── case.md
│   ├── case.json                 # only with --debug
│   └── evidence/
│       ├── step-01.txt | step-01.json
│       ├── step-01.png              # mandatory for browser/UI assertion
│       ├── network.json             # only with --debug
│       └── console.txt              # only with --debug
├── NG-02-<case-slug>/               # assertion or expected behavior failed
└── BLOCKED-03-<case-slug>/          # could not execute; not the same as a failed assertion
```

Use stable two-digit ordering. One folder contains one independently understandable test case; do
not mix unrelated contracts. Multiple evidence files for that case stay inside its folder.

Before execution, the single verifier writes `<run-dir>/verify-plan.md` mapping each case to its auth
gate, dependencies, mutable resources, isolation/cleanup, evidence folder, and sequential order. It
also records the mandatory screenshot permission check. No coordinator/worker subagents are used.

For GUI cases, `verify-plan.md` records the browser-session source
(`PLAYWRIGHT_NAMED_SESSION | FORM_LOGIN_SESSION`) and the dedicated `tab_id` used sequentially for
that case. Each GUI step and screenshot records that tab ID.

## Status and folder naming

- Test-case status is measured against the requirement/invariant, not against the reviewer's bug
  hypothesis. Therefore evidence that **confirms a bug** normally makes the behavior test `NG`, while
  the matching reviewer contract result is `CONFIRMED`.
- `PASS` → `PASS-<case-number>-<slug>/`
- `NG` → `NG-<case-number>-<slug>/`; use for a completed test whose assertion/expected behavior failed
- `BLOCKED`, `BLOCKED_AUTH`, `BLOCKED_PORT_CONFLICT`, or `BLOCKED_SCREENSHOT_PERMISSION` →
  `BLOCKED-<case-number>-<slug>/`; use only when the test could not execute
- `BLOCKED_TOOLING` hoặc `BLOCKED_OUT_OF_SCOPE` → `BLOCKED-<case-number>-<slug>/`; ghi rõ tool/action,
  target, lý do, rủi ro và câu hỏi đang chờ human
- `WEAK_ORACLE` or `TEST_GAP` → `BLOCKED-<case-number>-<slug>/` with the exact limitation in `case.md`

`<case-number>` is the stable two-digit order (`01`, `02`, ...) assigned in `verify-plan.md`.

Rename the folder immediately after final status is known. `summary.md` and, when debug mode is
enabled, `summary.json` must use the final folder name.

Any `BLOCKED-*` folder pauses the entire verify run. The verifier writes a partial summary with
workflow status `WAITING_HUMAN` and notifies the human. Resume only after explicit guidance and diff
fingerprint revalidation. `NG-*` does not trigger this global pause.

Missing or denied screenshot permission is `BLOCKED_SCREENSHOT_PERMISSION`. Ask the user to grant
permission again and do not run any test case until a real screenshot succeeds. This blocker cannot
be skipped or waived.

After a successful human-guided resume, keep the same folder/case number and add `Block resolution`
to `case.md` and `case.json`: original blocker, redacted guidance, action, validation evidence,
resume timestamp, and durable-learning classification. Final summary links the resolution and says
which skill/README rule was updated, or why it was non-generalizable.

## `case.md` — từ tổng quan đến chi tiết

```markdown
# <ID> — <Tên test case bằng tiếng Việt>

# Tổng quan
- Trạng thái: PASS | NG | BLOCKED | BLOCKED_AUTH | BLOCKED_SCREENSHOT_PERMISSION |
  BLOCKED_TOOLING | BLOCKED_OUT_OF_SCOPE | WEAK_ORACLE | TEST_GAP
- Finding/contract cần kiểm chứng: REV-...
- Nguồn tạo test case: SPEC | PLAN | WORKFLOW | BUSINESS_OLD | BUSINESS_NEW | USER_BEHAVIOR |
  SYSTEM_IMPACT | PERFORMANCE | SECURITY | ERROR_HANDLING | RULE_FORMAT | REFACTOR
- Trích dẫn requirement/invariant: đường dẫn file + mục/dòng hoặc định danh wiki
- Hành vi cũ: ... (nếu áp dụng)
- Hành vi mới mong đợi: ... (nếu áp dụng)
- Chức năng liên quan có thể bị ảnh hưởng: ...
- Phương pháp: package-test | api | swagger-playwright | cli | static-trace | playwright-cli
- Phạm vi được chứng minh: API_ONLY | GUI_ONLY | END_TO_END | STATIC
- Nhóm rủi ro/coverage: ...
- Kết quả mong đợi: ...
- Kết quả thực tế: ...
- Kết luận: một câu tiếng Việt nêu rõ vì sao PASS, NG hoặc BLOCKED

## Điều kiện trước khi chạy
- Môi trường, service, trạng thái đăng nhập và quyền screenshot; không ghi secret
- Với runtime: `REUSED | STARTED | BLOCKED_PORT_CONFLICT`, kết quả health/identity và thời điểm sẵn sàng
- Với GUI: nguồn session (`PLAYWRIGHT_NAMED_SESSION | FORM_LOGIN_SESSION`), session ID không nhạy
  cảm và `tab_id`

## Dữ liệu kiểm thử
- Ghi dữ liệu đầu vào cụ thể hoặc cách tạo lại dữ liệu đó
- Dữ liệu nhạy cảm phải được che; thay bằng chỉ dẫn lấy từ nguồn hợp lệ, không ghi giá trị thật
- Ghi trạng thái dữ liệu cần có trước khi chạy và cách nhận biết đã chuẩn bị đúng

## Cách tái hiện thủ công
1. Ghi từ điểm bắt đầu: thư mục làm việc, URL hoặc màn hình cần mở.
2. Ghi chính xác command hoặc thao tác click/nhập/chọn theo đúng thứ tự.
3. Ghi dữ liệu test an toàn cần dùng và cách tạo/tìm dữ liệu đó.
4. Ghi kết quả cần quan sát sau mỗi bước: UI, status code, response, DB/state, log hoặc side effect.
5. Ghi đường dẫn evidence tương ứng để người chạy lại đối chiếu.

Không viết “chạy lại như trên”, “test bình thường” hoặc phụ thuộc vào context trong chat. Một người
mới phải có thể làm theo mục này từ đầu.

## Các bước và assertion
| Bước | Thao tác cụ thể | Mong đợi | Thực tế | Kết quả | Bằng chứng |
| --- | --- | --- | --- | --- | --- |

## Trạng thái và side effect
- Ghi quan sát liên quan ở UI, API, DB, queue, network hoặc console

## Danh sách bằng chứng gốc
- Link tương đối tới từng file trong `evidence/` và một câu tiếng Việt giải thích file chứng minh gì

## Giới hạn và dọn dẹp
- Blocker, số lần thử, weak oracle/test gap, phần chưa chứng minh được và thao tác dọn dữ liệu

## Cách xử lý blocker
- Chỉ có sau khi resume: blocker ban đầu, hướng dẫn của user đã che dữ liệu nhạy cảm, hành động đã
  làm, bằng chứng blocker đã được gỡ, thời gian tiếp tục và nơi lưu bài học dùng lại
```

Khi có `--debug`, `case.json` phải chứa cùng thông tin theo cấu trúc machine-readable `overview` (gồm
`source_categories`, `requirement_citations`, `old_behavior`, `new_behavior`, `affected_features`), `preconditions`,
`test_data`, `manual_reproduction`, `steps`, `state_and_side_effects`, `evidence_index`,
`limitations_and_cleanup`, và `block_resolution`. JSON key giữ tiếng Anh ổn định; mọi giá trị mô tả
do agent viết phải bằng tiếng Việt. Không ghi credential, cookie, token, secret hoặc PII chưa che.

## Screenshots and text evidence

- Browser/UI case: take a screenshot after every meaningful assertion, including the failed state
  for an NG case. Never capture credential fields. Reference each PNG from the matching step.
- Swagger API case: use `swagger-playwright`, set `Coverage scope: API_ONLY`, and save the Swagger result
  screenshot plus redacted request/response or network evidence. Never use its PASS as GUI evidence.
- API/CLI/package/static case: store exact redacted request/response, command output, logs, or traced
  citations as `.txt`/`.json`. Set `Screenshot: N/A (non-visual verification)`; do not fabricate an
  image that adds no evidence.
- Giữ raw tool output khi an toàn, nhưng phải thêm phần Mong đợi/Thực tế bằng tiếng Việt trong
  `case.md`; không bắt người đọc tự diễn giải log.
- Evidence phải đủ để hiểu và tái hiện kết quả bằng tay. Nếu không thể tái hiện, ghi rõ precondition
  còn thiếu và dùng `BLOCKED`/`TEST_GAP`, không được viết hướng dẫn giả định.

## Run summary

`summary.md` phải viết bằng tiếng Việt và bắt đầu bằng trạng thái workflow
(`RUNNING | WAITING_HUMAN | COMPLETE`), số lượng PASS/NG/BLOCKED, sau đó là bảng gồm: ID, tên test
case, nguồn/requirement, phạm vi, kết quả mong đợi, kết quả thực tế một câu, trạng thái và link `case.md`.
Thêm ma trận coverage theo các source category và trạng thái `COVERED | NOT_APPLICABLE |
CONTEXT_GAP | TEST_GAP`. Khi bị chặn,
liệt kê case đã xong, case hiện tại, case đang chờ và câu hỏi cụ thể dành cho user.

Khi có `--debug`, `summary.json` chứa cùng số liệu và đường dẫn tương đối cuối cùng. JSON key có thể giữ tiếng Anh,
nhưng title, expected, actual, conclusion, blocker và guidance question phải bằng tiếng Việt. Mọi NG
phải nhìn thấy ngay từ summary mà không cần mở từng thư mục.
