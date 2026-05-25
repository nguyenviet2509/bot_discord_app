---
phase: 6
title: "Dashboard"
status: pending
priority: P2
effort: "3h"
dependencies: [5]
---

# Phase 6: Dashboard

## Overview

Thêm tab "Lịch sử ROLL" vào dashboard SPA: list session theo guild + filter thời gian, xem chi tiết, clear > N ngày, nuke all.

## Requirements

**Functional:**
- API endpoints: list (paginated, filter guild/date), detail (full participants), delete by-days, delete all
- Frontend: tab mới trong `dashboard/public/index.html` (SPA Alpine) hoặc standalone page nếu phù hợp pattern hiện tại
- Filter: guild dropdown + date range (from/to)
- Bảng pagination: ID, time, host, count, winner, score, state
- Click row → modal detail (Alpine x-show) hoặc inline expand
- 2 nút clear top-right: "Xóa > N ngày" (input N), "Xóa tất cả" (confirm dialog)

**Non-functional:**
- Tuân thủ `.claude/skills/dashboard-layout/SKILL.md`: indigo/slate palette, sticky header, card, btn-primary/refresh, JWT auth pattern
- API yêu cầu JWT (middleware `auth`)
- Delete nuke yêu cầu confirm token trong body (chống mis-click)

## Architecture

```
dashboard/
├── routes/
│   └── roll-history.js          ← NEW
└── public/
    ├── index.html               ← thêm tab nav-item + Alpine block (hoặc iframe)
    └── js/
        └── roll-history.js      ← NEW (Alpine controller)
```

**Hoặc** standalone page nếu pattern hiện tại là multi-page:
```
dashboard/public/
├── roll-history.html            ← NEW standalone (theo pattern automod.html)
└── js/roll-history.js
```

Quyết định: kiểm tra `dashboard/public/index.html` xem có phải SPA tab hay multi-page. Theo các tab có sẵn (level-react, scheduled-messages...) — match pattern hiện tại.

## Related Code Files

- **Create:**
  - `dashboard/routes/roll-history.js`
  - `dashboard/public/js/roll-history.js`
  - (Optional) `dashboard/public/roll-history.html` nếu standalone
- **Modify:**
  - `dashboard/server.js` — mount route `app.use('/api/roll-history', auth, require('./routes/roll-history'))`
  - `dashboard/public/index.html` — thêm nav-item + Alpine block (theo pattern existing tabs)
- **Reference:**
  - `dashboard/routes/automod.js` (CRUD pattern)
  - `dashboard/routes/scheduled-messages.js` (list/filter pattern)
  - `dashboard/public/js/automod.js` hoặc `honor-config.js` (Alpine pattern)
  - `.claude/skills/dashboard-layout/SKILL.md` (style guide)

## Implementation Steps

### 6.1. API route `dashboard/routes/roll-history.js`

```js
const express = require('express')
const { getDb } = require('../../shared/db')
const router = express.Router()

// GET /api/roll-history?guildId=&from=&to=&page=&pageSize=
router.get('/', (req, res) => {
  const { guildId, from, to, page = 1, pageSize = 20 } = req.query
  const offset = (Math.max(1, +page) - 1) * Math.min(100, +pageSize)
  const limit = Math.min(100, +pageSize)

  const where = ['1=1']
  const params = []
  if (guildId) { where.push('guild_id = ?'); params.push(guildId) }
  if (from)    { where.push('created_at >= ?'); params.push(+from) }
  if (to)      { where.push('created_at <= ?'); params.push(+to) }

  const sql = `
    SELECT id, guild_id, channel_id, host_id, max_players, state,
           winner_id, winner_score, cancel_reason, created_at, finished_at,
           (SELECT COUNT(*) FROM roll_participant WHERE session_id = rs.id) AS participant_count
    FROM roll_session rs
    WHERE ${where.join(' AND ')}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `
  const rows = getDb().prepare(sql).all(...params, limit, offset)
  const totalRow = getDb().prepare(`SELECT COUNT(*) AS c FROM roll_session WHERE ${where.join(' AND ')}`).get(...params)
  res.json({ data: rows, total: totalRow.c, page: +page, pageSize: limit })
})

// GET /api/roll-history/:id
router.get('/:id', (req, res) => {
  const session = getDb().prepare('SELECT * FROM roll_session WHERE id = ?').get(+req.params.id)
  if (!session) return res.status(404).json({ error: 'Not found' })
  const participants = getDb().prepare(`
    SELECT user_id, score, joined_at FROM roll_participant
    WHERE session_id = ? ORDER BY score DESC NULLS LAST, joined_at ASC
  `).all(+req.params.id)
  res.json({ session, participants })
})

// DELETE /api/roll-history?olderThanDays=N&guildId=
router.delete('/', (req, res) => {
  const days = +req.query.olderThanDays
  const { guildId } = req.query
  if (!days || days < 1) return res.status(400).json({ error: 'olderThanDays phải >= 1' })
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400

  const where = ['created_at < ?']
  const params = [cutoff]
  if (guildId) { where.push('guild_id = ?'); params.push(guildId) }
  // ON DELETE CASCADE tự xóa participants
  const info = getDb().prepare(`DELETE FROM roll_session WHERE ${where.join(' AND ')}`).run(...params)
  res.json({ deleted: info.changes })
})

// DELETE /api/roll-history/all  (body: { confirm: 'NUKE', guildId? })
router.delete('/all', (req, res) => {
  if (req.body?.confirm !== 'NUKE') {
    return res.status(400).json({ error: 'Cần confirm=NUKE trong body' })
  }
  const { guildId } = req.body
  const sql = guildId
    ? 'DELETE FROM roll_session WHERE guild_id = ?'
    : 'DELETE FROM roll_session'
  const info = guildId
    ? getDb().prepare(sql).run(guildId)
    : getDb().prepare(sql).run()
  res.json({ deleted: info.changes })
})

module.exports = router
```

### 6.2. Mount route trong `dashboard/server.js`

```js
app.use('/api/roll-history', auth, require('./routes/roll-history'))
```

### 6.3. Frontend — kiểm tra pattern hiện tại

```bash
grep -l "x-data" dashboard/public/index.html
ls dashboard/public/*.html
```
- Nếu `index.html` chứa nhiều Alpine block → SPA tab → thêm nav-item + block mới
- Nếu standalone page (như `automod.html`) → tạo `roll-history.html`

Khả năng cao là hybrid (theo `dashboard-layout` skill mô tả). Đọc thêm phần Layout pattern trong SKILL.md → áp dụng.

### 6.4. Alpine controller `js/roll-history.js`

```js
window.rollHistory = function () {
  return {
    items: [], total: 0, page: 1, pageSize: 20,
    filters: { guildId: '', from: '', to: '' },
    selected: null, // session detail
    showDetail: false,
    clearDays: 30,
    showNukeConfirm: false,

    async load() {
      const qs = new URLSearchParams({
        page: this.page, pageSize: this.pageSize,
        ...(this.filters.guildId && { guildId: this.filters.guildId }),
        ...(this.filters.from && { from: new Date(this.filters.from).getTime() / 1000 }),
        ...(this.filters.to && { to: new Date(this.filters.to).getTime() / 1000 }),
      })
      const r = await fetch(`/api/roll-history?${qs}`, {
        headers: { Authorization: `Bearer ${localStorage.token}` },
      })
      if (r.status === 401) return location.href = '/login.html'
      const j = await r.json()
      this.items = j.data; this.total = j.total
    },

    async openDetail(id) {
      const r = await fetch(`/api/roll-history/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.token}` },
      })
      this.selected = await r.json()
      this.showDetail = true
    },

    async clearOld() {
      if (!confirm(`Xóa session cũ hơn ${this.clearDays} ngày?`)) return
      await fetch(`/api/roll-history?olderThanDays=${this.clearDays}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.token}` },
      })
      await this.load()
    },

    async nuke() {
      await fetch('/api/roll-history/all', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ confirm: 'NUKE' }),
      })
      this.showNukeConfirm = false
      await this.load()
    },

    init() { this.load() },
  }
}
```

### 6.5. HTML structure (theo dashboard-layout SKILL)

- Sticky header: title "Lịch sử ROLL" + subtitle "Quản lý session ROLL đã chạy", action buttons (Làm mới, Clear cũ N ngày, Xóa tất cả)
- Filter card: guild dropdown + date range from/to + Áp dụng button
- Bảng: rounded-2xl card, header indigo nhạt, row hover slate-50, click → openDetail
- Modal detail: x-show="showDetail", overlay bg-slate-900/50, card center với full participants + score
- Confirm nuke: x-show="showNukeConfirm", input text yêu cầu gõ "NUKE" để enable button

Tham khảo style cụ thể `dashboard/public/index.html` block tab `vinh-danh` hoặc `auto-mod`.

## Success Criteria

- [ ] GET `/api/roll-history` paginated, filter guild/date hoạt động
- [ ] GET `/api/roll-history/:id` trả full participants
- [ ] DELETE `?olderThanDays=N` xóa đúng cutoff, FK cascade xóa participants
- [ ] DELETE `/all` yêu cầu confirm=NUKE, từ chối 400 nếu thiếu
- [ ] Tab xuất hiện trong dashboard, JWT auth + 401 redirect login
- [ ] Style đồng nhất với tab khác (indigo/slate, btn-primary, card rounded-2xl)
- [ ] Modal detail show ranking với score và mention user (qua user_id)

<!-- Updated: Validation Session 1 - Step 0 mandatory pre-check + audit log dùng console/file -->

## Step 0 — Pre-check authz pattern (Validation S1, BẮT BUỘC)

**Trước khi viết code Phase 6**, đọc 2 file để xác định pattern scope guild trong dashboard:

```bash
grep -n 'guildId\|guild_id\|allowedGuilds\|req.user' dashboard/routes/automod.js
grep -n 'guildId\|guild_id\|allowedGuilds\|req.user' dashboard/routes/scheduled-messages.js
```

Có 3 khả năng:
1. **Đã có pattern per-guild** (ví dụ `req.user.guilds`, middleware `requireGuildAccess`) → copy y hệt cho `roll-history.js`.
2. **Chỉ có JWT auth, chưa scope guild** → escalate user xác nhận: single-admin model OK? (theo Validation S1 option 3, hiện tại có thể single-admin). Nếu confirm single-admin → bỏ requirement per-guild ACL, chỉ giữ authenticated + audit log.
3. **Hybrid** (vài route scope, vài route không) → follow route gần nhất tương đương về sensitivity (automod scope khá tương tự delete data).

Document kết quả vào `plans/reports/scout-260525-0817-dashboard-authz-pattern.md` trước khi tiếp tục.

## Red Team Fixes (2026-05-25)

### F1 [CRITICAL] Per-guild authorization, không chỉ authentication
JWT-auth chỉ verify identity, KHÔNG verify user có quyền với `guildId` cụ thể. Hiện trạng plan → bất kỳ dashboard user nào cũng đọc/xóa được history của mọi guild.

**Bắt buộc:**
1. Check pattern hiện tại trong `dashboard/routes/automod.js` hoặc `scheduled-messages.js` xem họ scope guild thế nào (chắc chắn có vì các route đó cũng đụng per-guild data). Copy y hệt.
2. Nếu chưa có pattern → JWT phải có claim `allowedGuildIds: string[]` hoặc `isSuperAdmin: boolean`. Middleware route check:
   ```js
   function requireGuildAccess(req, res, next) {
     const guildId = req.query.guildId || req.body?.guildId
     if (!guildId) return res.status(400).json({ error: 'guildId required' })
     if (req.user.isSuperAdmin) return next()
     if (!req.user.allowedGuildIds?.includes(guildId)) return res.status(403).json({ error: 'No access to this guild' })
     next()
   }
   ```
3. **MỌI** endpoint GET/DELETE phải require `guildId` (bỏ optional). List query luôn `WHERE guild_id = ?`.

### F2 [CRITICAL] Nuke endpoint fixes
Hiện tại: `confirm: 'NUKE'` là string cố định trong source — KHÔNG phải authz. Empty/missing `guildId` → wipe TOÀN BỘ guild. Mis-click thảm hoạ.

**Fix:**
1. Order routes: `router.delete('/all', ...)` định nghĩa **trước** route khác (tránh shadowing).
2. **Bắt buộc** `guildId` cho cả nuke + clear-old-days (đã yêu cầu ở F1).
3. Reject body có `guildId === ''` (empty string) → 400.
4. Audit log (Validation S1 — **console + file**, không tạo bảng mới):
   ```js
   console.log(JSON.stringify({
     tag: '[roll-history:audit]',
     ts: new Date().toISOString(),
     actor: req.user?.id || req.user?.username || 'unknown',
     action: 'nuke' | 'clear-old-days',
     guildId,
     deletedCount: info.changes,
     ip: req.ip,
   }))
   ```
   Console log đã được ingest vào file log dashboard (xem `dashboard/logs/` nếu có). Không cần bảng audit mới.
5. ~~Dynamic token~~ **Validation S1 chốt:** giữ hardcoded `'NUKE'` (mis-click guard đủ với single-admin context). Audit log BẮT BUỘC theo step 4 ở trên.
6. Frontend `nuke()` phải truyền `guildId`:
   ```js
   body: JSON.stringify({ confirm: 'NUKE', guildId: this.filters.guildId })
   ```

### Input validation & error wrapping
- `guildId` regex `^\d{17,20}$` (Discord snowflake) — reject khác format.
- `+page` / `+pageSize` / `+from` / `+to` validate finite, dùng default nếu NaN.
- `+req.params.id` validate `Number.isInteger && > 0`.
- Đổi `ORDER BY score DESC NULLS LAST` thành `ORDER BY (score IS NULL), score DESC, joined_at ASC` (portable).
- Wrap mỗi handler `try/catch → res.status(500).json({error:'Internal'})` để không leak stack trace.

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Delete cascade chậm với 10K+ session | Low | Index `idx_roll_part_session`, batch DELETE tự nhiên |
| User ngộ nhấn Nuke | Medium | Confirm dialog 2 step (button + nhập NUKE) |
| Filter date timezone lệch | Low | Frontend convert sang unix ts (giây), server so sánh int |
| `guildId` query không sanitize | Low | Prepared statement đã chống SQL injection |
