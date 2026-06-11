# Phase 07 — Bracket Form Dashboard + Token Auth + Submit API

**Status:** pending | **Priority:** P0 | **Effort:** M (~1.5 ngày)
**Depends on:** Phase 01, 05
**Deadline:** Trước 2026-06-28 (R16 kickoff)

## Context

Brainstorm: [report](../reports/brainstorm-260605-1628-wc-2026-minigames.md#game-2--bracket-challenge-phase-2--launch-trước-286)

## Flow

1. Member gõ `/wc-bracket` trong Discord (Phase 08)
2. Bot tạo token JWT (TTL 30 phút, scope `{guildId, userId}`) + DM link `https://{dashboard}/wc-bracket?token=XXX`
3. Member mở link → frontend verify token → load existing bracket nếu có
4. Form 5 round: R16 (16 đội) → QF (8) → SF (4) → F (2) → Champion (1)
5. UI: hiển thị 16 cặp R16 theo bốc thăm thật (lấy từ `wc_matches_cache` stage='R16'), member pick winner mỗi cặp
6. Round sau chỉ enable đội đã được pick ở round trước
7. Submit → POST `/api/wc-pickem/bracket` với token + picks_json
8. Server verify token + lock_at (refuse nếu sau bracket_lock_at) → upsertBracket

## Files

**Create:**
- `dashboard/public/wc-bracket.html` — form bracket standalone (có token trong URL)
- `dashboard/public/js/wc-bracket-form.js` — Alpine.js logic form
- `dashboard/routes/wc-bracket.js` — POST submit, GET load existing
- `bot/src/modules/wc-pickem/services/bracket-token.js` — generate/verify JWT token

**Modify:**
- `dashboard/server.js` — mount route `/api/wc-pickem/bracket`

## Token format

JWT signed bằng `JWT_SECRET` env (đã có). Payload:
```json
{ "guildId": "...", "userId": "...", "scope": "wc-bracket", "exp": <now+30m> }
```

## Bracket data structure

```json
{
  "r16": [
    { "matchId": "...", "winner": "homeTeamId" },
    ...
  ],
  "qf": [...],
  "sf": [...],
  "final": { "matchId": "...", "winner": "..." },
  "champion": "teamId"
}
```

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/wc-pickem/bracket/me?token=XXX` | Token | Load bracket hiện tại |
| POST | `/api/wc-pickem/bracket?token=XXX` | Token | Submit/update bracket |
| GET | `/api/wc-pickem/bracket/r16` | Token hoặc JWT admin | Lấy danh sách 16 cặp R16 thật (sau khi vòng bảng xong) |

## Todo

- [ ] `bracket-token.js`: signToken + verifyToken
- [ ] `wc-bracket.html`: standalone HTML (không sidebar), form responsive, theo `dashboard-layout` skill
- [ ] `wc-bracket-form.js`: Alpine state, load R16 fixtures, cascade pick (round n+1 chỉ enable đội đã thắng round n)
- [ ] Validate phía server: picks_json đúng schema, đội pick phải nằm trong R16 thật, lock_at check
- [ ] Edge: chưa có R16 thật (vòng bảng chưa xong) → cho phép submit "draft" nhưng warn UI
- [ ] DM template: "🏆 Click để submit bracket WC: {link}\nHết hạn lúc <t:{lock}:F>"

## Success Criteria

- Token sinh đúng, verify chuẩn
- Form load existing bracket nếu user đã submit
- Submit thành công lưu DB, không submit được sau lock_at
- UI responsive trên mobile (member dùng Discord mobile click DM link)

## Risks

| Risk | Mitigation |
|---|---|
| Token leak qua DM bị forward | TTL 30 phút + scope per-user → kẻ leak vẫn không submit thay được vì payload có userId |
| R16 fixtures chưa có khi member submit sớm | Cho draft, validate lại khi vòng bảng xong |
| User mất link DM | `/wc-bracket` resend token mới |
| XSS qua picks_json | Server validate strict schema (chỉ teamId từ whitelist) |
