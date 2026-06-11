# Phase 08 — Bracket Scorer + `/wc-bracket` Command

**Status:** pending | **Priority:** P0 | **Effort:** S (~4h)
**Depends on:** Phase 07

## Files

**Create:**
- `bot/src/modules/wc-pickem/commands/wc-bracket.js`
- `bot/src/modules/wc-pickem/services/bracket-scorer.js`

## /wc-bracket command

- No options
- Logic:
  1. Check `wc_settings.enabled` cho guild
  2. Check current time < bracket_lock_at (nếu set)
  3. Generate token (Phase 07 helper)
  4. DM user link `{dashboardUrl}/wc-bracket.html?token={token}`
  5. Reply ephemeral: "📬 Đã gửi link bracket vào DM. Token hết hạn sau 30 phút."
  6. Nếu DM fail (user disable) → reply ephemeral chứa link (chấp nhận lộ token vì user ephemeral)

## Bracket scoring

Hook event 'match:finished' (từ Phase 02):
1. Lấy match.stage:
   - stage='R16' → 1pt cho mỗi bracket pick đúng winner
   - stage='QF' → 2pt
   - stage='SF' → 4pt
   - stage='FINAL' → 8pt + nếu pick đúng champion → +16pt
2. Loop `listAllBrackets(guildId)`:
   - Parse picks_json, tìm pick tương ứng matchId hoặc team đi tiếp
   - Đúng → `addBracketPoints` + update `last_scored_at`, `points_total`
3. Idempotent: track đã chấm trận nào trong bracket meta để không double-count

## Idempotent tracking

Thêm cột `scored_matches_json` vào `wc_brackets` (list matchId đã chấm) hoặc bảng phụ `wc_bracket_scored(bracket_id, match_id)`. Recommend bảng phụ cho dễ query.

```sql
CREATE TABLE IF NOT EXISTS wc_bracket_scored (
  bracket_id INTEGER,
  match_id TEXT,
  points INTEGER,
  scored_at INTEGER,
  PRIMARY KEY(bracket_id, match_id)
);
```

(Migration thêm vào Phase 01 hoặc làm trong Phase 08 — quyết định: thêm vào Phase 01 SCHEMA_SQL khi update.)

## Todo

- [ ] Update `db-wc-pickem.js`: thêm bảng `wc_bracket_scored` + helper `markBracketMatchScored`, `wasBracketMatchScored`
- [ ] `wc-bracket.js` command: generate token + DM logic + fallback ephemeral
- [ ] `bracket-scorer.js`: hook 'match:finished', loop brackets, idempotent chấm
- [ ] Special case Final: champion bonus +16 chỉ khi match là FINAL VÀ winner team = bracket.champion
- [ ] Test: tạo bracket test, simulate match finish, verify points

## Success Criteria

- Command DM link thành công
- Token hết hạn 30 phút → submit fail đúng
- Bracket scorer idempotent (chạy 2 lần không double point)
- Champion bonus chỉ tính sau Final

## Risks

| Risk | Mitigation |
|---|---|
| Double scoring nếu event 'match:finished' emit lại | Bảng `wc_bracket_scored` PK chống |
| DM bị disable | Fallback ephemeral reply |
| 3rd place playoff không tính | Document: bỏ qua 3rd place, chỉ chấm R16/QF/SF/F |
