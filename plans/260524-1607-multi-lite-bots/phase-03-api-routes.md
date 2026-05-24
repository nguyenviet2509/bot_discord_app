# Phase 03: API Routes

**Status:** pending | **Effort:** 2h | **Priority:** high
**Depends on:** Phase 01, 02

## Context
Expose CRUD + lifecycle qua REST. Protected bằng JWT auth hiện có.

## Files
**Create:**
- `dashboard/src/routes/managed-bots.js` — Express router

**Edit:**
- `dashboard/src/server.js` (verify đúng path) — mount router + middleware multer cho avatar upload

## Endpoints
| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/api/managed-bots` | — | `[{id, display_name, avatar_url, status, presence_status, activity_type, activity_text, application_id, last_error, last_username_change, can_change_username}]` |
| POST | `/api/managed-bots` | `{display_name, token, activity_type?, activity_text?, presence_status?}` | created object (no token) |
| PATCH | `/api/managed-bots/:id` | partial `{display_name?, activity_type?, activity_text?, presence_status?}` | updated object |
| POST | `/api/managed-bots/:id/avatar` | multipart `file` | `{avatar_url}` |
| DELETE | `/api/managed-bots/:id` | — | `204` |
| POST | `/api/managed-bots/:id/start` | — | `{status: 'running'}` |
| POST | `/api/managed-bots/:id/stop` | — | `{status: 'stopped'}` |

## Steps
1. Đọc 1 route hiện có (vd `dashboard/src/routes/levels.js` nếu có) để copy pattern auth + error handling
2. Tạo `managed-bots.js`:
   - Import `db-managed-bots`, `token-crypto`, `bots-lite/index` manager
   - Tất cả route: middleware JWT auth (theo pattern hiện có)
   - **POST create:** validate token bằng `fetch('https://discord.com/api/v10/users/@me', { Authorization: 'Bot <token>' })` → nếu 200 lấy `application_id` từ response → encrypt token → insert row
   - **PATCH:** không cho đổi token (force xoá + tạo mới); nếu đang `running` gọi `manager.applyChanges`
   - **Avatar upload:** multer `memoryStorage`, validate MIME (png/jpg/gif), max 256KB; lưu vào `uploads/managed-bots/<id>.<ext>` (tạo dir nếu chưa có); update `avatar_url = /uploads/managed-bots/<id>.<ext>`; nếu running gọi `applyChanges`
   - **start/stop:** delegate cho manager, return mới `status`
   - **delete:** stop trước nếu running, xoá row + file avatar
3. `can_change_username` flag: `last_username_change == null || (now - last_username_change) > 30*60*1000`
4. Mount router trong `server.js`: `app.use('/api/managed-bots', requireAuth, managedBotsRouter)`
5. Đảm bảo static serve `/uploads/` đã có (nếu chưa, thêm `express.static`)

## Todo
- [ ] Scout `dashboard/src/` structure
- [ ] Implement router với 7 endpoints
- [ ] Multer setup cho avatar
- [ ] Mount + static uploads
- [ ] Test qua curl/Postman từng endpoint
- [ ] Verify JWT block khi chưa login

## Success Criteria
- POST với token invalid → 400 `{error: 'Invalid Discord token'}`
- POST với token valid → 201 + row trong DB, token là ciphertext
- GET trả về list không leak token
- Upload avatar 300KB → 400 (quá size)
- DELETE đang running → tự stop trước
- 401 nếu thiếu JWT

## Risks
- Discord API rate limit khi validate token nhanh → acceptable (user thao tác chậm)
- Path traversal qua filename upload → dùng id làm filename, ignore upload filename
- DoS qua upload lớn → multer limit + reject sớm

## Next
→ Phase 04: dashboard UI gọi các API này
