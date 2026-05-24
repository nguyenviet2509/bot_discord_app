# Phase 01: DB Schema + Token Crypto

**Status:** pending | **Effort:** 1h | **Priority:** high

## Context
- Brainstorm: `plans/reports/brainstorm-260524-1607-multi-lite-bots.md` §6
- Share DB chính (`database.sqlite`), thêm 1 bảng `managed_bots`
- Token cần encrypt at rest (AES-256-GCM)

## Files
**Create:**
- `shared/db-managed-bots.js` — CRUD + migration cho bảng `managed_bots`
- `bots-lite/token-crypto.js` — AES-256-GCM encrypt/decrypt
- `.env.example` (edit) — thêm `BOT_TOKEN_ENCRYPTION_KEY`

## DB Schema
```sql
CREATE TABLE IF NOT EXISTS managed_bots (
  id INTEGER PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  discord_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  application_id TEXT,
  status TEXT NOT NULL DEFAULT 'stopped',
  presence_status TEXT NOT NULL DEFAULT 'online',
  activity_type TEXT NOT NULL DEFAULT 'Playing',
  activity_text TEXT,
  last_error TEXT,
  last_username_change INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

## Steps
1. Đọc `shared/db.js` để hiểu pattern khởi tạo DB hiện có (better-sqlite3 wrapper)
2. Tạo `shared/db-managed-bots.js` export:
   - `ensureTable(db)` — chạy CREATE TABLE IF NOT EXISTS
   - `listBots(db)` → array (KHÔNG bao gồm token, iv)
   - `getBot(db, id)` → object đầy đủ (cho internal use khi cần token)
   - `createBot(db, {display_name, encrypted_token, token_iv, application_id, ...})` → id
   - `updateBot(db, id, patch)` — partial update
   - `deleteBot(db, id)`
   - `updateStatus(db, id, status, last_error?)`
   - `recordUsernameChange(db, id)` — set last_username_change = Date.now()
3. Tạo `bots-lite/token-crypto.js`:
   - `encrypt(plaintext)` → `{ ciphertext: base64, iv: base64 }`
   - `decrypt(ciphertext, iv)` → plaintext
   - Sử dụng `crypto.createCipheriv('aes-256-gcm', key, iv)` với key từ `process.env.BOT_TOKEN_ENCRYPTION_KEY` (32 bytes hex → 32 bytes buffer)
   - Auth tag: append vào ciphertext (last 16 bytes) hoặc trả riêng (chọn append cho gọn)
   - Throw rõ ràng nếu env key thiếu/sai length
4. Thêm `BOT_TOKEN_ENCRYPTION_KEY=` vào `.env.example` với comment "32 bytes hex, generate: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
5. Gọi `ensureTable(db)` từ `shared/db.js` init flow (hoặc lazy ở module load)

## Todo
- [ ] Đọc `shared/db.js` pattern
- [ ] Implement `db-managed-bots.js` (kebab-case, <200 LOC)
- [ ] Implement `token-crypto.js` với GCM + auth tag
- [ ] Update `.env.example`
- [ ] Wire `ensureTable` vào init
- [ ] Smoke test: node REPL → encrypt+decrypt round-trip, insert+select row

## Success Criteria
- `SELECT * FROM managed_bots` chạy được (empty result OK)
- Encrypt/decrypt round-trip giữ nguyên token
- Token trong DB là base64 ciphertext, không phải plain
- `listBots()` không trả về field token/iv

## Risks
- Quên auth tag GCM → decrypt fail silently. Mitigation: test round-trip ngay.
- Env key sai length crash app khi import. Mitigation: validate ở module load, log lỗi rõ.

## Next
→ Phase 02: dùng `db-managed-bots` + `token-crypto` để build lite client manager
