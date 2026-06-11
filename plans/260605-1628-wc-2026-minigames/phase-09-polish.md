# Phase 09 — Polish (optional)

**Status:** pending | **Priority:** P2 | **Effort:** S (~4h)
**Depends on:** Phase 04, 05, 08

## Scope

Cải thiện UX sau khi Phase 1+2 đã launch ổn định.

## Tasks

### 1. Admin override result
- Dashboard tab WC: nút "Override" trên hàng trận đã FINISHED
- Modal: chọn result (HOME/DRAW/AWAY/CANCEL) + nhập lý do
- Backend: update `wc_matches_cache` + re-trigger scorer cho match đó
- Lưu audit log (bảng `wc_admin_actions` hoặc reuse log hiện có)

### 2. DM reminder bracket
- Cron 24h trước `bracket_lock_at`: DM tất cả member trong guild (chưa submit bracket) "🏆 Còn 24h để dự đoán bracket WC"
- Cron 1h trước: DM lần 2
- Rate limit DM (Discord limit ~50/giây)

### 3. Leaderboard pagination
- Slash `/wc-leaderboard` thêm option `page` (default 1)
- Mỗi page 10 user
- Hoặc dùng Discord button "Trang sau"

### 4. Daily recap embed (Pick'em)
- Sau khi tất cả trận trong ngày FINISHED → cron post recap vào channel
- Top 5 user ăn nhiều pt nhất hôm nay
- Hot pick: % member chọn đúng

### 5. Streak announcement
- User đạt streak ≥ 5 → bot post công khai congratulate

### 6. Bracket comparison
- `/wc-bracket-view @user`: xem bracket public của user khác (sau lock_at)

## Todo

- [ ] Quyết định task nào ưu tiên (gợi ý: 1 + 2 trước)
- [ ] Implement từng task, mỗi task 1 commit riêng
- [ ] Test edge case override + scorer re-run idempotent

## Success Criteria

- Override không phá điểm đã chấm trước (chỉ adjust delta)
- DM reminder không spam (track đã DM ai)
- Pagination smooth, không lỗi off-by-one

## Out of Scope

- Predictor đoán tỷ số chính xác
- Trivia game (đã loại trong brainstorm)
- Group standings prediction
