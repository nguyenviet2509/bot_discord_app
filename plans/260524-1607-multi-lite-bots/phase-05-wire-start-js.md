# Phase 05: Wire start.js + Env

**Status:** pending | **Effort:** 0.5h | **Priority:** medium
**Depends on:** Phase 01-04

## Context
Khi process boot, manager chỉ load list + ensureTable, KHÔNG auto-login bot (lazy). Graceful shutdown khi SIGTERM/SIGINT.

## Files
**Edit:**
- `start.js` — import + init manager, register shutdown handler
- `.env.example` — verify `BOT_TOKEN_ENCRYPTION_KEY` đã có từ phase 01

## Steps
1. Đọc `start.js` hiện tại để hiểu bot + dashboard được spawn thế nào
2. Sau khi DB init (hoặc trong dashboard server boot — chọn nơi sớm nhất chắc chắn DB ready):
   - Import `bots-lite/index.js`
   - Gọi `ensureTable(db)` (idempotent từ phase 01)
   - Set DB instance vào manager nếu manager singleton cần (hoặc inject vào từng API call)
3. Register shutdown handler:
   ```js
   process.on('SIGINT',  async () => { await manager.stopAll(); process.exit(0); });
   process.on('SIGTERM', async () => { await manager.stopAll(); process.exit(0); });
   ```
4. Verify env validate: nếu `BOT_TOKEN_ENCRYPTION_KEY` thiếu, log warning rõ ràng + cho phép boot dashboard nhưng API managed-bots reject với 500

## Todo
- [ ] Đọc start.js
- [ ] Wire manager init
- [ ] Add SIGINT/SIGTERM handler
- [ ] Verify env key validation
- [ ] Restart full process, check không lỗi

## Success Criteria
- `npm start` boot OK với 0 bot trong DB
- `npm start` với 1 bot row stopped → process up, bot vẫn offline (lazy)
- Ctrl+C → mọi lite bot running stop sạch, không zombie process

## Risks
- Shutdown timeout nếu nhiều bot stop chậm → set timeout 5s, force exit sau đó
- Env key reload không hỗ trợ → user phải restart process khi đổi key (acceptable)

## Next
→ Phase 06: test thực tế với bot Discord thật
