---
name: final-report-template
description: Template báo cáo tổng hợp sau khi AI Reviewer và AI Verify hoàn tất pipeline hai agent.
---

# Final report — bắt buộc viết bằng tiếng Việt

Sau khi đối chiếu finding của `reviewer` với kết quả độc lập từ `verifier`, trình bày theo cấu trúc:

## 1. Tóm tắt phạm vi

- **Domain đã review**: liệt kê GUI/API/shared-infra có thay đổi và số file; chỉ một AI Reviewer
  review toàn bộ phạm vi
- **Cơ chế verify**: package checks / focused tests / API-CLI / static trace / playwright-cli
- **Domain bị skip**: docs/lockfile/generated — liệt kê ngắn gọn, không review sâu
- **Kích thước scope**: code files, changed lines, modules; nêu `SCOPE_TOO_LARGE` hoặc override risk
- **Context completeness**: requirement, architecture, invariant, contracts, dependencies, versions,
  production constraints — CONFIRMED/MISSING/N/A và citation
- **Coverage/blind spots**: behavior/surface nào đã review, bị block, hoặc chưa đủ context

## 2. Finding theo mức độ nghiêm trọng

- Mỗi finding dùng đúng format trong
  [finding-format.md](../../code-review/assets/finding-format.md)
- Thứ tự: CRITICAL → HIGH → MEDIUM. Không liệt kê LOW trừ khi user yêu cầu rõ.
- Gộp các finding trùng root cause/execution path/impact thành 1 mục, không lặp lại
- **Với mỗi finding CONFIRMED**: ghi rõ lệnh verifier nào xác nhận nó (vd. "xác nhận bởi `pnpm
  --filter api typecheck` — FAIL tại dòng X"). Finding không có verifier hỗ trợ thì giữ ở mức
  PLAUSIBLE, không tự nâng lên CONFIRMED chỉ vì lý luận nghe hợp lý.
- **Với mọi finding CRITICAL/HIGH**: bắt buộc thêm dòng nhắc
  `⚠️ Cần human review trước khi merge — AI review không phải merge gate duy nhất.`
- Không dùng `APPROVED`, `SAFE TO MERGE`, `LOOKS GOOD`; không có finding không đồng nghĩa không có bug.

## 3. Kết quả AI Verify

- Liệt kê output của `verifier` (lệnh đã chạy, PASS/FAIL/BLOCKED, script không tồn tại)
- Với authenticated API verification, chỉ ghi trạng thái login/current-user check và session reuse;
  không ghi account, request body, cookie hoặc token. Nêu `BLOCKED_AUTH` nếu session không tạo được.
- Nếu verifier FAIL nhưng không finding nào của reviewer khớp với lỗi đó: vẫn nêu ra như 1 mục riêng
  (verifier bắt được lỗi mà reviewer bỏ sót — đây chính là lý do có bước verify độc lập)
- Luôn nêu `Playwright CLI gate: PASSED | BLOCKED_TOOLING | BLOCKED_SCREENSHOT_PERMISSION`, quyết
  định browser contract `USED | NOT_NEEDED | BLOCKED_AUTH | BLOCKED_OUT_OF_SCOPE` và lý do.
- Nếu dùng Swagger + Playwright CLI khi GUI chưa tích hợp, ghi method `swagger-playwright` và
  `Coverage scope: API_ONLY`. Nêu rõ API PASS không xác nhận GUI hoặc end-to-end integration; link
  test case GUI riêng nếu GUI cũng thuộc scope.
- Link `test-cases/summary.md` và `summary.json`; nêu tổng PASS / NG / BLOCKED.
- Link `verify-plan.md`; xác nhận toàn bộ test case được chạy tuần tự bởi đúng một verifier agent và
  không tạo coordinator/worker subagent khác.
- Với GUI, nêu named Playwright CLI session, fallback login và mapping
  case → tab ID theo thứ tự chạy. Xác nhận không thao tác tab hoặc browser data ngoài verify.
- Với mỗi runtime service, ghi readiness `REUSED` / `STARTED` / `BLOCKED_PORT_CONFLICT`, endpoint
  được resolve từ `CLAUDE.md`, health/identity result và evidence path. Xác nhận không start duplicate.
- Mỗi verification phải nằm trong một test-case folder có `case.md` (tổng quan → chi tiết),
  `case.json`, và `evidence/`. Không chấp nhận evidence rời rạc ngoài case folder.
- Liệt kê từng test case bằng **final folder name**, status, Expected/Actual một dòng, link `case.md`,
  và raw evidence quan trọng. Mọi folder bắt buộc có prefix: `PASS-` cho pass, `NG-` cho executed
  failure, `BLOCKED-` cho case không chạy được; không đánh đồng blocker với behavior fail.
- **Chỉ nếu Chrome được dùng**: nêu rõ
  - Service và endpoint đã resolve từ bảng mapping trong root `CLAUDE.md`
  - Service: `REUSED` / `STARTED` / `BLOCKED_PORT_CONFLICT`; nếu conflict thì không kill process,
    không đổi port và không start instance khác
  - Browser session: `PLAYWRIGHT_NAMED_SESSION` / `FORM_LOGIN_SESSION` / `NOT_REQUIRED`
  - Auth: `NAMED_SESSION_REUSED` / `FORM_LOGIN_SUCCESS` / `NOT_REQUIRED` / `BLOCKED_AUTH`
  - Nếu dùng login fallback: xác nhận đã mở public `/login`, fill account từ `SecLogin/index.tsx`,
    click Login và xác nhận authenticated session; không đưa credential/form dump vào report
  - Nếu có bất kỳ `BLOCKED*`, `WEAK_ORACLE` hoặc `TEST_GAP`: workflow phải là `WAITING_HUMAN`, không
    chạy tiếp case khác; nêu blocked case/path, evidence, completed/paused/pending và câu hỏi cụ thể
    để human hướng dẫn resume
  - Screenshot permission là bắt buộc. Nếu thiếu hoặc bị từ chối, ghi
    `BLOCKED_SCREENSHOT_PERMISSION`, hỏi user cấp lại quyền và không tiếp tục bước/test case khác
    cho đến khi chụp ảnh thành công
  - Screenshot sau mỗi assertion có ý nghĩa, kể cả trạng thái fail; link ảnh theo từng step trong
    `case.md`. Không chụp credential.
- Với API/CLI/static case: link request/response/log/command output đã redacted và ghi rõ
  `Screenshot: N/A (non-visual verification)`; không tạo ảnh giả chỉ để đủ format.
- Nêu coverage positive/negative/boundary/adversarial/regression/concurrency-retry/partial-failure
  cho HIGH/CRITICAL contract.
- Nêu `WEAK_ORACLE` khi test mirror implementation và `TEST_GAP` khi thiếu independent oracle; test
  pass ở hai trạng thái này không được nâng finding thành CONFIRMED.

## 4. Ghi chú bị chặn / ngoài phạm vi

- Liệt kê precondition thiếu, fixture/service/credential cần có, và phần bị chặn bởi safety boundary.
- Liệt kê `CONTEXT_GAP`, production assumptions chưa biết, và unverified library/framework claims.
- Khi verify bị block, kết thúc report bằng một human handoff question; không tự chọn workaround,
  không tự skip blocker và không chạy test case tiếp theo.
- Sau khi resume thành công, nêu blocker đã clear bằng evidence nào, case nào tiếp tục, và durable
  learning đã cập nhật ở `SKILL.md`/`.claude/README.md` hoặc lý do `NON_GENERALIZABLE`.

## 5. Human decision queue

- Chỉ đưa vào: CRITICAL/HIGH, MEDIUM còn tranh luận, context gap ảnh hưởng correctness, và
  high-risk verification bị block. Mỗi mục phải có owner/decision cần human xác nhận.
- Nhắc developer/code owner phải hiểu execution path trước khi merge; AI không thay senior/code owner.

## 6. Review-quality metrics

- Link `metrics.json`; tóm tắt finding count, suppressed noise, PASS/NG/BLOCKED và coverage.
- Precision/recall/escaped defects để `N/A` nếu chưa có human disposition/ground truth; không suy diễn.

## 7. Kết luận

- Nếu không còn finding nào sau khi lọc theo bar: viết đúng câu
  `Không tìm thấy vấn đề actionable với độ tin cậy cao.` — nhưng vẫn nêu verifier đã chạy gì, không
  ngụ ý "không tìm thấy" đồng nghĩa "an toàn tuyệt đối".
- Nếu còn finding: nêu số lượng theo từng severity, không dùng các câu khẳng định an toàn tuyệt đối
  ("code an toàn", "mọi thứ đều đúng", "Code đúng")

Toàn bộ báo cáo phải viết bằng **tiếng Việt**; tên file/hàm/biến giữ nguyên tiếng Anh.
