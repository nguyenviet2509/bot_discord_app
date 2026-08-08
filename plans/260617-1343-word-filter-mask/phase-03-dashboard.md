# Phase 3 — Dashboard API + UI tab "Ẩn từ"

**Status:** pending
**Effort:** 1 ngày
**Priority:** P1

## Overview

Thêm tab **"Ẩn từ"** trong dashboard sidebar. UI: toggle enable + chip-input danh sách từ + nút Lưu. API CRUD đơn giản. Tuân theo skill `dashboard-layout` (CSS classes `.card`, `.input-field`, `.btn-primary`, sticky header, indigo/slate palette).

## API

`dashboard/routes/word-filter.js`:

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/word-filter/:guildId` | — | `{ enabled, words }` |
| PUT | `/api/word-filter/:guildId` | `{ enabled, words }` | `{ ok: true }` |

Validation server-side:
- `enabled` boolean
- `words` array, mỗi item string, trim, length 1..100, dedupe case-insensitive
- Limit tối đa 200 từ/guild (chống abuse)

Sau khi PUT thành công → gọi `regexCache.invalidate(guildId)` qua IPC/file signal hoặc đơn giản: lưu `updated_at` vào DB, bot poll mỗi N giây (xem cách auto-mod làm).

**Check cách auto-mod invalidate cache:** đọc `dashboard/routes/automod.js` + `bot/src/modules/auto-mod/bad-word-cache.js` → reuse mechanism tương tự (signature-based cache trong bad-word-cache đã tự invalidate khi `words` array thay đổi nhờ JSON.stringify signature → **không cần IPC phức tạp**, regex tự rebuild khi config mới được đọc lần tiếp theo).

→ **KISS:** không cần invalidate signal. Bot đọc `getConfig(guildId)` mỗi message → so signature → tự rebuild khi cần.

## Wire route

`dashboard/server.js` — thêm:
```js
app.use('/api/word-filter', require('./routes/word-filter'))
```

Auth: dùng middleware `requireAuth` + check guild ownership giống các route khác (xem `routes/automod.js` làm mẫu).

## UI

**Option A — Standalone page** `dashboard/public/word-filter.html` + `dashboard/public/js/word-filter.js`.
**Option B — Tab trong `index.html` SPA**.

→ Chọn **Option A** (standalone page) — pattern hiện tại của `automod.html`, `honor-config.html`, `events.html`. Sidebar nav-item link trực tiếp.

### word-filter.html

Layout theo template `dashboard-layout` skill:
- Sticky header với title "Ẩn từ nhạy cảm" + guild selector
- 1 card duy nhất:
  - Toggle switch: "Bật module"
  - Chip-input "Danh sách từ cấm": gõ + Enter để thêm chip, click x để xoá
  - Hint nhỏ: "Match exact word, case-insensitive. Tin chứa từ này sẽ bị ẩn thành ***."
  - Nút "Lưu" (`btn-primary`)
- Status indicator (saved / saving / error)

Reuse style chip-input từ `automod.html` (đã có `.chip` class).

### word-filter.js

API helper với JWT (theo pattern `automod.js`):
- Load config khi page mount + khi đổi guild
- Save: PUT API, hiển thị toast/inline message
- 401 → redirect `/login.html`

### Sidebar nav-item

`dashboard/public/index.html` (hoặc shared sidebar): thêm:
```html
<a href="/word-filter.html" class="nav-item">
  <svg>...</svg> Ẩn từ
</a>
```

Vị trí: ngay dưới "Auto-Mod" (logical grouping — cùng nhóm moderation).

## Related files

**Create:**
- `dashboard/routes/word-filter.js`
- `dashboard/public/word-filter.html`
- `dashboard/public/js/word-filter.js`

**Modify:**
- `dashboard/server.js` — wire route
- `dashboard/public/index.html` (hoặc file sidebar chung) — thêm nav-item

## Todo

- [ ] `routes/word-filter.js` với GET + PUT, validation đầy đủ
- [ ] Wire vào `server.js`
- [ ] `word-filter.html` theo dashboard-layout skill (copy structure từ `automod.html` rút gọn)
- [ ] `js/word-filter.js` với load/save + JWT auth helper
- [ ] Sidebar nav-item
- [ ] Test E2E: bật module → thêm từ "test" → submit → check DB → bot pickup từ mới
- [ ] Test 401 redirect khi token expire
- [ ] Mobile responsive check (chip wrap, button đủ to)

## Success criteria

- Admin login → vào tab "Ẩn từ" → bật toggle + thêm 3 từ → Lưu → reload page thấy state đúng
- Bot pickup config mới trong < 5 giây (vì regex-cache signature-based tự rebuild)
- Không thể save > 200 từ
- Trim + dedupe hoạt động ("  ABC  " + "abc" → 1 entry "ABC")

## Risks

- **Concurrent edit từ 2 admin:** last-write-wins (chấp nhận cho MVP).
- **XSS từ words trong UI:** render qua `textContent`, không `innerHTML`.
- **CSRF:** middleware auth hiện tại đã handle (kiểm tra `requireAuth` pattern).

## Next

→ Phase 4: test thực tế + tinh chỉnh.
