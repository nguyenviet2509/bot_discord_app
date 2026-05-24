# Brainstorm Report: Multi Lite Bots Management

- **Date:** 2026-05-24 16:07 (+07)
- **Branch:** master
- **Status:** Design approved, ready for `/ck:plan`

## 1. Problem Statement

Hiện chỉ có 1 bot (BossBabel). User muốn thêm 5-20 "lite bot" cùng server, mỗi bot tự custom **tên + avatar + custom status text** qua dashboard. Lite bot chưa cần feature nghiệp vụ — chỉ "hiện diện" trong member list để branding. Câu hỏi gốc: tạo project mới hay extend?

## 2. Requirements

### Functional
- Quản lý 5-20 lite bot qua dashboard (CRUD)
- Mỗi lite bot: display name, avatar, custom status text + activity type, presence (online/idle/dnd)
- Toggle bật/tắt thủ công từng bot (lazy start, không auto-start khi process khởi động)
- Đổi tên/avatar/status runtime, không cần restart process
- Token Discord lưu encrypted, không leak ra frontend

### Non-functional
- Không ảnh hưởng code/runtime của BossBabel (isolation cao)
- Tận dụng dashboard auth + DB + deploy hiện có (DRY)
- RAM dưới ngưỡng Railway plan hiện tại với 5-10 bot đồng thời active

### Out of scope v1
- Lite bot không có command / event handler nghiệp vụ
- Không share data nghiệp vụ với BossBabel
- Không có giao tiếp BossBabel ↔ lite bot
- Không auto-create Discord application (vẫn manual ở Developer Portal)

## 3. Approaches Evaluated

| | A. Extend monorepo, cùng process | B. New repo riêng | C. Cùng monorepo, process riêng |
|---|---|---|---|
| Code isolation | ✅ Module riêng | ✅✅ Repo riêng | ✅✅ Process riêng |
| Share dashboard/auth/DB | ✅ Trực tiếp | ❌ Build lại | ✅ |
| Effort | ~10h | ~25h | ~14h |
| Crash isolation | ⚠️ Cùng process | ✅ | ✅ |
| Deploy | 1 container | 2 container | 1 container |
| **Verdict** | **Chọn** | Over-engineered v1 | Refactor target nếu sau gặp OOM |

**Final:** **Approach A** — extend monorepo, lite bot manager chạy cùng process với BossBabel.

## 4. Impact on BossBabel

### Code: KHÔNG đụng
- `bot/src/**` giữ nguyên
- `bot/.env`, slash command registry, các bảng DB hiện có: giữ nguyên
- `dashboard/` chỉ thêm route + tab mới, không sửa cũ

### Runtime
- RAM: +20-40MB / lite bot active
- CPU: ~0 (lite bot idle, không xử lý event nghiệp vụ)
- SQLite: chỉ ghi khi CRUD qua dashboard, không write contention runtime
- Discord limits: 75 bot/guild free OK với 20 bot

### Risk + Mitigation
| Risk | Mitigation |
|------|-----------|
| Lite bot crash kéo BossBabel | Try/catch + `client.on('error')` cô lập từng client |
| Token leak từ DB | AES-256-GCM encrypt, env key, masked về frontend |
| OOM khi 20 bot active | **Đã mitigate bằng lazy start** — user chỉ bật bot cần dùng |
| Rate limit username (2/h) | UI disable nút + countdown sau khi vừa đổi |

## 5. Shared vs Isolated Resources

### Share với BossBabel
- `database.sqlite` (thêm bảng `managed_bots`)
- Dashboard process + JWT auth
- `dashboard-layout` CSS skill
- Node process (`start.js`)
- discord.js dependency (workspace `bot/`)
- `uploads/` folder cho avatar
- Railway/Docker deploy pipeline
- `.env` (thêm `BOT_TOKEN_ENCRYPTION_KEY`)

### Isolated khỏi BossBabel
- Discord token + application ID mỗi bot
- Bot logic / commands / event handlers
- Tables nghiệp vụ (levels, honor, automod, posts...)
- Slash command registry

## 6. Final Design (Approach A)

### Folder structure mới
```
bot_discord_app/
├── bot/                       # BossBabel (giữ nguyên)
├── bots-lite/                 # MỚI
│   ├── index.js               # Manager: start/stop/restart từng bot
│   ├── lite-client.js         # 1 Discord Client tối giản
│   └── token-crypto.js        # AES-256-GCM encrypt/decrypt
├── dashboard/
│   ├── public/
│   │   ├── bots-manager.html  # MỚI: tab quản lý bot
│   │   └── js/bots-manager.js # MỚI: Alpine.js controller
│   └── src/routes/
│       └── managed-bots.js    # MỚI: API routes
├── shared/
│   └── db-managed-bots.js     # MỚI: CRUD + migration
└── start.js                   # Thêm spawn bots-lite manager
```

### DB schema
```sql
CREATE TABLE IF NOT EXISTS managed_bots (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,                       -- /uploads/managed-bots/<id>.png
  discord_token TEXT NOT NULL,           -- AES-256-GCM ciphertext (base64)
  token_iv TEXT NOT NULL,
  application_id TEXT,                   -- tự fetch từ token khi save
  status TEXT DEFAULT 'stopped',         -- stopped|running|error
  presence_status TEXT DEFAULT 'online', -- online|idle|dnd|invisible
  activity_type TEXT DEFAULT 'Playing',  -- Playing|Watching|Listening|Competing|Custom
  activity_text TEXT,                    -- max 128 chars
  last_error TEXT,
  last_username_change INTEGER,          -- unix ms, dùng cho rate limit UI
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Lazy start lifecycle
1. Process boot → manager đọc DB, **KHÔNG login bot nào**, chỉ load list vào memory
2. User vào dashboard, bấm "Start" trên 1 bot → API `POST /api/managed-bots/:id/start`
3. Manager tạo `LiteClient` → login → on ready: apply username/avatar (nếu khác) + setPresence → set `status=running`
4. User bấm "Stop" → manager `client.destroy()` → set `status=stopped`
5. User sửa name/avatar/status khi bot running → manager apply ngay qua Discord API (không cần restart bot)
6. Process restart → tất cả bot về `stopped` (không auto-restore)

### API routes
- `GET    /api/managed-bots` — list (masked token)
- `POST   /api/managed-bots` — create (validate token qua `GET /users/@me`)
- `PATCH  /api/managed-bots/:id` — update name/avatar/status/activity
- `DELETE /api/managed-bots/:id` — delete (stop trước)
- `POST   /api/managed-bots/:id/start`
- `POST   /api/managed-bots/:id/stop`
- `POST   /api/managed-bots/:id/avatar` — upload file (multer)

### Dashboard UI
- Tab mới "Quản lý Bot" trong sidebar
- Bảng list: avatar + tên + presence dot + activity preview + status badge + actions
- Form thêm bot: paste token → validate → preview info bot (name từ Discord) → confirm save
- Form edit: name, avatar upload, presence dropdown, activity type dropdown, activity text input
- Toggle Start/Stop là button chính trong mỗi row
- Tuân thủ `dashboard-layout` skill (indigo/slate, `.card`, `.btn-primary`...)

### Security
- AES-256-GCM với key từ `process.env.BOT_TOKEN_ENCRYPTION_KEY` (32 bytes hex)
- Token không bao giờ trả về frontend, chỉ masked `MTI...abcd`
- Avatar upload: validate MIME (png/jpg/gif), max 256KB (Discord limit), resize bằng sharp nếu cần
- API routes protected bằng JWT auth hiện có

## 7. Effort Estimate

| Phase | Effort |
|-------|--------|
| 01. DB migration + db-managed-bots.js + token-crypto.js | 1h |
| 02. Lite client + manager (start/stop/update) | 2.5h |
| 03. API routes (CRUD + start/stop + avatar upload) | 2h |
| 04. Dashboard UI tab + form | 3h |
| 05. Wire start.js, env config | 0.5h |
| 06. Manual test 2-3 bot thật, fix bug | 1.5h |
| **Total** | **~10.5h** |

## 8. Success Criteria
- Tạo 3 bot lite qua dashboard, save thành công
- Start từng bot → xuất hiện 🟢 trong member list với đúng tên/avatar/status
- Edit name/status khi đang running → Discord cập nhật trong vài giây
- Stop bot → mất khỏi member list (offline)
- BossBabel chạy ổn định trong suốt quá trình, không restart, không lỗi
- Token DB là ciphertext (kiểm tra qua `sqlite3 database.sqlite "SELECT discord_token FROM managed_bots"`)

## 9. Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| `ActivityType.Custom` không hiển thị đúng cho bot | Test sớm phase 02, fallback `Playing` nếu fail |
| Đổi username quá nhanh → rate limit | UI cooldown 30 phút sau mỗi lần đổi name; backend reject + báo lỗi rõ |
| Lite bot lộ token nếu log accident | Logger có filter token pattern, code review trước khi commit |
| Restart process mất state running | Acceptable v1 (lazy + manual); v2 có thể thêm `auto_start` flag |

## 10. Next Steps
- Chạy `/ck:plan` để tạo implementation plan theo phases 01-06 ở trên
- Tạo 2 Discord application thật ở Developer Portal trước khi test phase 06

## 11. Unresolved Questions
- Có cần audit log (ai bật/tắt bot lúc nào) không? — **Để v2 nếu cần**
- Bot phụ có cần invite tự động vào guild qua OAuth URL trong dashboard không, hay user tự copy URL invite? — **v1 user tự invite manual**
- Khi bot bị Discord disable token (vd: token reset), UI thông báo thế nào? — Hiển thị `status=error` + `last_error` trong row
