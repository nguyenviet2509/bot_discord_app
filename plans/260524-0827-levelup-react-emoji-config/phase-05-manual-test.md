# Phase 05 — Manual Test

## Scope
Verify end-to-end: dashboard config → DB → bot react đúng.

## Test cases

### 1. Backward compat (default)
- Guild chưa từng config → bot vẫn react như cũ (8% chance, emoji = badge tier mặc định).
- ✅ Pass: user level-up ≥10 nhiều lần, thấy thi thoảng có react với badge mặc định.

### 2. Đổi emoji 1 tier
- Dashboard → Sắt: nhập `🔥` → Lưu.
- DB: `SELECT react_emoji FROM guild_tier_badges WHERE guild_id=? AND tier_min_level=10` → `🔥`.
- Trigger level-up tier Sắt → react `🔥` (chứ không phải `⚫`).

### 3. Slider 0%
- Set chance = 0 → Lưu.
- Trigger level-up → bot KHÔNG react (test ≥20 lần để chắc).

### 4. Slider 100%
- Set chance = 100 → Lưu.
- Trigger level-up → bot react 100% trường hợp.

### 5. Tắt react 1 tier (clear field)
- Dashboard → Đồng: xóa trống → Lưu.
- DB: `react_emoji = NULL`.
- Level-up tier Đồng (level 20-29) với chance=100 → KHÔNG react.
- Level-up tier khác (chance=100) → vẫn react bình thường.

### 6. Custom emoji
- Lấy 1 custom emoji của server: `<:tada:123456789012345678>` (copy từ Discord, gõ `\:tada:`).
- Paste vào tier Vàng → Lưu.
- Level-up tier Vàng → bot react custom emoji.

### 7. Custom emoji không khả dụng
- Nhập emoji ID không tồn tại: `<:fake:111>` → Lưu.
- Level-up → bot KHÔNG crash (try/catch nuốt lỗi), không react.

### 8. Persistence
- Đổi config → reload page → giá trị giữ nguyên.
- Restart bot → behavior dùng config mới (không cache stale).

### 9. Auth
- Logout → gọi `/api/level-react` → 401.
- Reload UI khi token hết hạn → redirect login.

### 10. Mobile UI
- Mở dashboard trên viewport < 768px → grid 10 input collapse 1 cột, slider vẫn full width, button không bị tràn.

## Done when
Tất cả 10 case pass. Nếu fail → fix trực tiếp + rerun.

## Rollback
Nếu có vấn đề lớn: revert commit; cột DB để lại (backward compat — không drop).
