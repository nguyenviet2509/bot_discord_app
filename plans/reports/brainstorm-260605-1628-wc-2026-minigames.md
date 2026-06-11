# Brainstorm: Mini Game World Cup 2026 cho Discord Bot

**Date:** 2026-06-05
**Status:** Design approved, ready for /ck:plan
**Timeline:** WC 2026 kickoff 2026-06-11 → final 2026-07-19

## Problem Statement

Tận dụng mùa WC 2026 để tăng engagement Discord. Member tham gia dự đoán suốt giải, leaderboard cuối giải nhận thưởng (admin trao tay theo config dashboard).

## Constraints

- Kickoff cách hôm nay ~6 ngày → Pick'em phải launch trước 2026-06-11
- Vòng KO bắt đầu 2026-06-28 → Bracket phải launch trước ngày này
- Reward = text + image setup ở dashboard, không động coin economy
- API: football-data.org free tier (10 req/min)
- Reuse module mini-game pattern hiện tại

## Approaches Evaluated

| Idea | Verdict | Reason |
|---|---|---|
| Sweepstake bốc đội | Loại | Engagement thấp, 1 lần xong |
| **Bracket Challenge** | **Chọn** | Hook member suốt giải, 1 lần submit dễ quản lý |
| **Daily Pick'em 1X2** | **Chọn** | Engagement hằng ngày, dễ build |
| Score Predictor | Loại Phase 1 | Tương tự Pick'em, để sau nếu cần |
| Live Quick-Poll | Loại | Cần polling API liên tục, phức tạp |
| Trivia WC | Loại | Content soạn tay tốn thời gian, YAGNI |
| Goal Scorer Bingo | Loại | Cần player stats API premium |
| Survivor Pool | Loại | Trùng concept Bracket, ít hấp dẫn hơn |

## Final Design

### Game 1: Daily Pick'em 1X2 (Phase 1 — launch 11/6)

- Cron sáng mỗi ngày: bot post embed các trận trong ngày vào channel chỉ định
- Mỗi trận = 1 embed + 3 button: "Đội A thắng" / "Hòa" / "Đội B thắng"
- Member bấm trước kick-off → lock pick (lưu vào `wc_predictions`)
- Trận xong → cron auto chấm: đúng = +3pt
- Streak bonus: đúng 3 trận liên tiếp = +5pt
- Lock cứng tại giờ kick-off; sau giờ bấm = báo lỗi

### Game 2: Bracket Challenge (Phase 2 — launch trước 28/6)

- Submit 1 lần trước vòng R16 kickoff
- Form trên dashboard: pick 16→8→4→2→1 (chỉ enable khi đủ thông tin vòng bảng)
- Slash `/wc-bracket` → DM link dashboard có token auth riêng
- Scoring: R16=1, QF=2, SF=4, F=8, Champion=16 → max ~75pt
- Auto chấm sau mỗi trận KO kết thúc

### Điểm & Leaderboard

- Bảng `wc_scores` riêng, không trộn coin/level
- Leaderboard 3 view: Pick'em / Bracket / Tổng
- Cuối giải archive sang `wc_scores_2026`, table clean cho mùa sau

### Reward

- Dashboard tab "WC 2026" → form setup giải thưởng:
  - Top 1/3/10 cho Pick'em
  - Top 1/3/10 cho Bracket
  - Rich text + upload ảnh (host trong dashboard public)
- Slash `/wc-prizes` → bot render embed hiển thị giải thưởng + ảnh
- Bot KHÔNG tự trao thưởng (admin liên hệ winner offline)

## Architecture

```
bot/src/modules/wc-pickem/        # module mới, generic cho EURO/AFF sau
├── manifest.js                    # tên "Dự đoán World Cup", defaultEnabled: false
├── register.js                    # button handlers + cron tasks
├── commands/
│   ├── wc-bracket.js              # /wc-bracket → DM link dashboard
│   ├── wc-leaderboard.js          # /wc-leaderboard [game]
│   └── wc-prizes.js               # /wc-prizes → render config dashboard
├── handlers/
│   └── pickem-button-handler.js   # xử lý bấm 1X2
├── services/
│   ├── football-data-client.js    # wrapper football-data.org, cache fixture
│   ├── match-poller.js            # cron poll result mỗi 5 phút khi có live
│   ├── pickem-scheduler.js        # cron post embed trận sáng
│   ├── pickem-scorer.js           # chấm điểm + streak
│   ├── bracket-scorer.js          # chấm bracket sau KO
│   └── leaderboard.js             # query top N

shared/
└── db-wc-pickem.js                # DB helpers

dashboard/
├── public/wc-2026.html            # tab WC: prizes config + leaderboard view
├── public/wc-bracket.html         # form submit bracket (token-auth từ Discord)
└── routes/wc-pickem.js            # API: prizes CRUD, bracket submit, leaderboard
```

### Database (SQLite, append to current schema)

```sql
CREATE TABLE wc_predictions (
  id INTEGER PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,           -- football-data fixture id
  pick TEXT NOT NULL,                -- 'HOME' | 'DRAW' | 'AWAY'
  picked_at INTEGER NOT NULL,
  scored INTEGER DEFAULT 0,
  points_awarded INTEGER DEFAULT 0,
  UNIQUE(guild_id, user_id, match_id)
);

CREATE TABLE wc_brackets (
  id INTEGER PRIMARY KEY,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  picks_json TEXT NOT NULL,          -- {r16: [...], qf: [...], sf: [...], f: [...], champ: ""}
  submitted_at INTEGER NOT NULL,
  last_scored_at INTEGER,
  points_total INTEGER DEFAULT 0,
  UNIQUE(guild_id, user_id)
);

CREATE TABLE wc_scores (
  guild_id TEXT,
  user_id TEXT,
  pickem_points INTEGER DEFAULT 0,
  bracket_points INTEGER DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  PRIMARY KEY(guild_id, user_id)
);

CREATE TABLE wc_matches_cache (
  match_id TEXT PRIMARY KEY,
  stage TEXT,                        -- 'GROUP' | 'R16' | 'QF' | 'SF' | 'F'
  home_team TEXT,
  away_team TEXT,
  kickoff_at INTEGER,
  status TEXT,                       -- 'SCHEDULED' | 'LIVE' | 'FINISHED'
  result TEXT,                       -- 'HOME' | 'DRAW' | 'AWAY' | NULL
  score_home INTEGER,
  score_away INTEGER,
  raw_json TEXT,
  updated_at INTEGER
);

CREATE TABLE wc_prizes_config (
  guild_id TEXT,
  game TEXT,                         -- 'pickem' | 'bracket'
  rank_tier TEXT,                    -- 'top1' | 'top3' | 'top10'
  title TEXT,
  description_md TEXT,
  image_url TEXT,
  PRIMARY KEY(guild_id, game, rank_tier)
);

CREATE TABLE wc_settings (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,                   -- channel post Pick'em + announcement
  enabled INTEGER DEFAULT 0,
  bracket_lock_at INTEGER            -- timestamp lock bracket (default = R16 kickoff)
);
```

### football-data.org integration

- Endpoint: `GET /v4/competitions/WC/matches`
- Free tier: 10 req/min → đủ
- Strategy:
  - Lần đầu: fetch full schedule → cache `wc_matches_cache` toàn bộ
  - Cron mỗi 1h: refresh fixture (đề phòng reschedule)
  - Cron mỗi 5 phút trong khung giờ trận: refresh status + score
  - Cron sau trận FINISHED: trigger scorer
- API key env: `FOOTBALL_DATA_API_KEY`

## Build Order

| Phase | Scope | Deadline | Effort |
|---|---|---|---|
| 1 | Module skeleton + DB + football-data client + Pick'em flow + dashboard prizes config + leaderboard view | 2026-06-10 | 3-4 ngày |
| 2 | Bracket form dashboard + token auth từ Discord + bracket scorer | 2026-06-27 | 5-7 ngày |
| 3 (optional) | Polish: streak notify, daily recap embed, leaderboard pagination | tuỳ thời gian | 1-2 ngày |

## Risks & Mitigation

| Risk | Mitigation |
|---|---|
| API down / sai data | Dashboard có nút "Override result" cho admin |
| Time tight cho Phase 1 | Cắt scope: ban đầu chỉ embed thủ công admin trigger, cron sau |
| Member submit bracket muộn | DM reminder 24h + 1h trước deadline |
| Schedule WC thay đổi | Cron refresh fixture mỗi 1h |
| Spam bấm pick | Lock unique (user, match), update silent thay vì insert |
| Token bracket form bị leak | Token có TTL 30 phút, scope per-user |

## Success Metrics

- ≥ 30% member active có ít nhất 1 pick trong vòng bảng
- ≥ 10 bracket submitted trước deadline
- Daily Pick'em post đúng giờ 95%+ ngày
- 0 sai sót chấm điểm sau khi API trả kết quả

## Final Decisions (chốt 2026-06-05)

- **API key**: chưa có → Phase 1 thêm task đăng ký tại football-data.org (free, chỉ cần email). Env: `FOOTBALL_DATA_API_KEY`
- **Edit pick**: cho phép sửa tới kick-off. Bấm lại button = override silent pick cũ
- **KO result**: tính theo chung cuộc sau penalty (đội đi tiếp = "thắng")
- **Channel**: 1 channel duy nhất / guild, chọn ở dashboard
- **Multi-guild leaderboard**: KHÔNG, per-guild only
