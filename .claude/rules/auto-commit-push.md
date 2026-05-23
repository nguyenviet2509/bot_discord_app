# Auto Commit & Push After Plan Completion

**BẮT BUỘC** áp dụng cho mọi session sử dụng `/ck:cook` hoặc implement theo plan trong `./plans/`.

## Khi nào tự động commit + push

Sau khi hoàn thành **toàn bộ phase** của 1 plan (status `pending` → `completed`):
- Tất cả file đã edit/write xong
- Compile check / lint không lỗi
- User đã xác nhận implementation OK (hoặc cook chạy ở mode `--auto`)

→ **Tự động** stage + commit + push lên branch hiện tại, KHÔNG hỏi xác nhận.

## Khi nào KHÔNG auto commit

- Implementation chưa xong (đang giữa chừng plan, còn phase pending)
- Có failing test / compile error chưa fix
- User đã yêu cầu rõ "đừng commit"
- Branch là `main`/`master` VÀ project có CI/CD production (kiểm tra `.github/workflows/` có deploy workflow không) → vẫn commit nhưng KHÔNG push, đợi user confirm

## Commit message convention

Dùng conventional commit theo plan slug:
```
<type>: <ngắn gọn mô tả change từ plan>

- Phase XX: ...
- Phase YY: ...

Plan: plans/<plan-dir>/
```

`<type>`: `feat` | `fix` | `refactor` | `style` | `perf` | `test` | `build` (KHÔNG dùng `chore` và `docs` cho file changes thực tế, theo CLAUDE.md user)

## Workflow

1. Stage relevant files (`git add <specific files>`, KHÔNG `git add .`)
2. Commit với message theo convention
3. Push lên remote branch hiện tại
4. Báo cáo URL commit / push result cho user

## Safety rules

- KHÔNG bypass git hooks (`--no-verify`)
- KHÔNG commit file chứa secrets (`.env`, credentials, API keys)
- KHÔNG force push
- Nếu git hook fail → fix root cause + commit mới (không amend)
- Nếu có conflict khi push → pull rebase trước, không force

## Tích hợp với cook skill

Trong bước "Finalize" của `/ck:cook` workflow:
- Trước đây: hỏi user "muốn commit không?"
- Áp dụng rule này: tự động commit + push, chỉ báo cáo kết quả

Nếu user muốn override 1 lần, gõ rõ "đừng push" hoặc "chỉ commit không push".
