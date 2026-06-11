# Phase 04 — Daily Pick'em Flow (Scheduler + Button + Scorer)

**Status:** pending | **Priority:** P0 | **Effort:** M (~1 ngày)
**Depends on:** Phase 01, 02, 03

## Context

Brainstorm: [report](../reports/brainstorm-260605-1628-wc-2026-minigames.md#game-1--daily-pickem-1x2-phase-1--launch-116)

## Files

**Create:**
- `bot/src/modules/wc-pickem/services/pickem-scheduler.js`
- `bot/src/modules/wc-pickem/services/pickem-renderer.js`
- `bot/src/modules/wc-pickem/services/pickem-scorer.js`
- `bot/src/modules/wc-pickem/handlers/pickem-button-handler.js`

## Flows

### A. Daily auto-post (cron 6:00 sáng VN)
1. Cron `0 6 * * *` chạy
2. Cho mỗi guild có `wc_settings.enabled=1` + `channel_id` set:
   - Query `wc_matches_cache` lấy trận kickoff trong 24h tới (chưa post)
   - Render embed cho mỗi trận → send vào channel
   - Lưu `message_id` vào cache (cột mới `posted_message_id` nullable — hoặc bảng riêng `wc_pickem_posts`)

### B. Member bấm button
1. customId format: `wcpk:{matchId}:{pick}` (pick = HOME|DRAW|AWAY)
2. Handler:
   - Check match status: nếu LIVE/FINISHED → reply ephemeral "Đã khoá pick"
   - Check kickoff: `Date.now() >= kickoff_at` → khoá
   - Upsert prediction (override silent nếu đã pick)
   - Reply ephemeral "✅ Đã chọn: {team/draw}. Có thể sửa tới kickoff."

### C. Auto chấm (event 'match:finished' từ Phase 02)
1. Lấy result từ `wc_matches_cache`
2. Loop `listUnscoredPredictionsForMatch(matchId)`:
   - Đúng pick = +3pt
   - Update `addPickemPoints` + `markPredictionScored`
   - Update streak: nếu đúng, current++; sai, current=0; nếu current % 3 == 0 → bonus +5pt
3. Optional: post recap embed vào channel (top winners của trận)

## Embed format (Pick'em)

```
⚽ {HOME_TEAM} vs {AWAY_TEAM}
🕒 Kick-off: <t:{kickoff}:F> (<t:{kickoff}:R>)
🏆 Vòng: {stage}

Dự đoán kết quả (3pt nếu đúng, streak 3 = +5pt):

[ {home} thắng ] [ Hoà ] [ {away} thắng ]
```

## Todo

- [ ] `pickem-renderer.js`: build embed + 3 buttons
- [ ] `pickem-scheduler.js`: cron daily 6:00 VN (`Asia/Saigon`) → loop guild enabled → post
- [ ] `pickem-button-handler.js`: parse customId, validate kickoff, upsert prediction
- [ ] `pickem-scorer.js`: hook event 'match:finished' → chấm + update streak
- [ ] Bảng phụ `wc_pickem_posts(match_id, guild_id, message_id)` nếu cần track message đã post (xem có cần update embed sau khi lock không)
- [ ] Edge case: trận bị huỷ → mark FINISHED không có result → bỏ qua chấm, gửi DM "trận bị huỷ"
- [ ] Test manual: tự bấm button, check DB update, đợi match finished trigger chấm

## Success Criteria

- Đúng giờ post embed vào channel admin chọn
- Member bấm pick → save DB, sửa được trước kickoff
- Sau trận → điểm cộng đúng, streak update đúng
- Lock cứng sau kickoff (reply ephemeral báo)

## Risks

| Risk | Mitigation |
|---|---|
| Cron không chạy do bot restart | Restart cron khi `client.ready` |
| Channel ID sai/bot không có quyền | Try-catch send + DM admin nếu fail |
| Match cancel | Check status FINISHED nhưng result=null → skip scoring |
| Race condition khi chấm | Transaction trong helper `markPredictionScored` |
