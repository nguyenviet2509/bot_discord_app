# Phase 02 — football-data.org Client + Match Cache + Cron Poll

**Status:** pending | **Priority:** P0 | **Effort:** S (~4h)

## Context

Brainstorm: [report](../reports/brainstorm-260605-1628-wc-2026-minigames.md)
API docs: https://www.football-data.org/documentation/api
Free tier: 10 req/min, đủ cho fixture + result polling.

## Files

**Create:**
- `bot/src/modules/wc-pickem/services/football-data-client.js`
- `bot/src/modules/wc-pickem/services/match-poller.js`
- `bot/src/modules/wc-pickem/services/match-sync.js` — fetch full schedule + upsert cache

**Modify:**
- `.env.example` — thêm `FOOTBALL_DATA_API_KEY=`
- `bot/src/index.js` (hoặc nơi cron init) — start poller khi module enabled

## API Endpoints sử dụng

- `GET /v4/competitions/WC/matches` — toàn bộ fixture (gọi 1 lần đầu, refresh 1h/lần)
- `GET /v4/competitions/WC/matches?status=LIVE` — refresh trong giờ trận (5 phút/lần)
- `GET /v4/competitions/WC/matches?status=FINISHED&dateFrom=&dateTo=` — fallback chấm điểm

**Header:** `X-Auth-Token: {FOOTBALL_DATA_API_KEY}`

## Logic

### football-data-client.js
```js
async function fetchMatches({ status, dateFrom, dateTo } = {})
// Wrapper fetch + retry 1 lần khi 429/5xx + log
```

### match-sync.js
```js
async function syncAllFixtures()
// Gọi fetchMatches() → map về schema cache → upsertMatch batch
// Map status: SCHEDULED/TIMED → 'SCHEDULED', IN_PLAY/PAUSED → 'LIVE', FINISHED → 'FINISHED'
// Map result KO: nếu có winner field → HOME/AWAY; nếu chưa kết thúc → null
// Stage: lấy từ match.stage (GROUP_STAGE → 'GROUP', LAST_16 → 'R16', ...)
```

### match-poller.js
```js
// Cron 1: mỗi 1h chạy syncAllFixtures() (đề phòng reschedule)
// Cron 2: mỗi 5 phút, IF có match đang LIVE hoặc kickoff trong ±30 phút → refresh LIVE
// Cron 3: sau khi 1 match chuyển SCHEDULED/LIVE → FINISHED, emit event 'match:finished' để scorer hook vào
```

### Task đăng ký API key
- [ ] User đăng ký tài khoản free tại https://www.football-data.org/client/register
- [ ] Copy API token vào `.env` của bot

## Todo

- [ ] User đăng ký account football-data.org + lấy API key
- [ ] Thêm `FOOTBALL_DATA_API_KEY` vào `.env` (KHÔNG commit) + `.env.example`
- [ ] Code `football-data-client.js` với fetch wrapper + retry
- [ ] Code `match-sync.js` map API → schema cache
- [ ] Code `match-poller.js` với 2-3 cron job (dùng `node-cron` hoặc setInterval đơn giản)
- [ ] Hook poller start vào bot init khi module enabled (read `wc_settings.enabled`)
- [ ] Smoke test: chạy syncAllFixtures() → kiểm tra `wc_matches_cache` có 64 trận

## Success Criteria

- API call thành công, log không lỗi auth
- 64 trận WC 2026 nằm trong cache sau lần sync đầu
- Poller không spam quá 10 req/phút (rate limit free tier)
- Event 'match:finished' emit đúng khi 1 trận chuyển trạng thái

## Risks

| Risk | Mitigation |
|---|---|
| API down | Try-catch + log + retry sau 5 phút |
| Rate limit 429 | Backoff 60s, log warning |
| API trả format mới | Schema validation tối thiểu, log raw_json |
| Bot restart mất cron state | Restart cron khi bot up |

## Out of Scope

- Webhook real-time (football-data free không hỗ trợ)
- Bí kíp chống flake (chấp nhận polling đơn giản)
