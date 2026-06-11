# Phase 01 — DB Schema + Helpers

**Status:** pending | **Priority:** P0 | **Effort:** XS (~2h)

## Context

Brainstorm: [report](../reports/brainstorm-260605-1628-wc-2026-minigames.md)
Existing schema: [shared/db.js](../../shared/db.js), [shared/db-mini-game.js](../../shared/db-mini-game.js)

## Overview

Tạo 6 bảng SQLite mới cho WC pickem + helper module. Reuse SQLite connection từ `shared/db.js` qua `getDb()`.

## Files

**Create:**
- `shared/db-wc-pickem.js` — schema SQL + helpers

**Modify:**
- `shared/db.js` — require `db-wc-pickem.js` trong init flow (xem cách `db-mini-game.js` được hook)

## Schema

```sql
CREATE TABLE IF NOT EXISTS wc_predictions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  pick TEXT NOT NULL,            -- 'HOME' | 'DRAW' | 'AWAY'
  picked_at INTEGER NOT NULL,
  scored INTEGER DEFAULT 0,
  points_awarded INTEGER DEFAULT 0,
  UNIQUE(guild_id, user_id, match_id)
);
CREATE INDEX idx_wc_pred_match ON wc_predictions(match_id, scored);
CREATE INDEX idx_wc_pred_user ON wc_predictions(guild_id, user_id);

CREATE TABLE IF NOT EXISTS wc_brackets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  picks_json TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  last_scored_at INTEGER,
  points_total INTEGER DEFAULT 0,
  UNIQUE(guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS wc_scores (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  pickem_points INTEGER DEFAULT 0,
  bracket_points INTEGER DEFAULT 0,
  streak_current INTEGER DEFAULT 0,
  streak_best INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY(guild_id, user_id)
);
CREATE INDEX idx_wc_scores_pickem ON wc_scores(guild_id, pickem_points DESC);
CREATE INDEX idx_wc_scores_bracket ON wc_scores(guild_id, bracket_points DESC);

CREATE TABLE IF NOT EXISTS wc_matches_cache (
  match_id TEXT PRIMARY KEY,
  stage TEXT,                    -- 'GROUP' | 'R16' | 'QF' | 'SF' | 'F' | '3RD'
  home_team TEXT,
  away_team TEXT,
  kickoff_at INTEGER,
  status TEXT,                   -- 'SCHEDULED' | 'LIVE' | 'FINISHED'
  result TEXT,                   -- 'HOME' | 'DRAW' | 'AWAY' | NULL (KO = chung cuộc sau pen)
  score_home INTEGER,
  score_away INTEGER,
  raw_json TEXT,
  updated_at INTEGER
);
CREATE INDEX idx_wc_match_status ON wc_matches_cache(status, kickoff_at);

CREATE TABLE IF NOT EXISTS wc_prizes_config (
  guild_id TEXT NOT NULL,
  game TEXT NOT NULL,            -- 'pickem' | 'bracket'
  rank_tier TEXT NOT NULL,       -- 'top1' | 'top3' | 'top10'
  title TEXT,
  description_md TEXT,
  image_url TEXT,
  updated_at INTEGER DEFAULT (unixepoch()),
  PRIMARY KEY(guild_id, game, rank_tier)
);

CREATE TABLE IF NOT EXISTS wc_settings (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  enabled INTEGER DEFAULT 0,
  bracket_lock_at INTEGER,
  updated_at INTEGER DEFAULT (unixepoch())
);
```

## Helpers (export từ `db-wc-pickem.js`)

**Predictions:**
- `upsertPrediction(guildId, userId, matchId, pick)` — override silent nếu đã tồn tại
- `getPrediction(guildId, userId, matchId)`
- `listUnscoredPredictionsForMatch(matchId)`
- `markPredictionScored(predictionId, points)`

**Brackets:**
- `upsertBracket(guildId, userId, picksJson)`
- `getBracket(guildId, userId)`
- `listAllBrackets(guildId)`

**Scores:**
- `addPickemPoints(guildId, userId, delta)` — atomic
- `addBracketPoints(guildId, userId, delta)`
- `updateStreak(guildId, userId, current, best)`
- `getLeaderboard(guildId, game, limit=10)` — game: 'pickem' | 'bracket' | 'total'

**Match cache:**
- `upsertMatch(matchObj)` — bulk safe
- `getMatch(matchId)`
- `listMatchesByStatus(status)`
- `listMatchesInRange(fromTs, toTs)`

**Prizes:**
- `setPrize(guildId, game, rankTier, {title, descriptionMd, imageUrl})`
- `getPrizes(guildId, game)`

**Settings:**
- `getSettings(guildId)`
- `setSettings(guildId, {channelId, enabled, bracketLockAt})`

## Todo

- [ ] Tạo `shared/db-wc-pickem.js` với SCHEMA_SQL + `init(db)` function
- [ ] Hook init vào `shared/db.js` (theo pattern `db-mini-game.js`)
- [ ] Implement 4 nhóm helper (predictions, brackets, scores, match cache)
- [ ] Implement helpers prizes + settings
- [ ] Smoke test: chạy bot → kiểm tra `.tables` trong SQLite

## Success Criteria

- 6 bảng tạo thành công khi bot start
- Helpers có sẵn `module.exports`, gọi không lỗi
- Không break existing schema

## Risks

- Tên column trùng với bảng cũ → prefix `wc_` đã giảm thiểu
- Migration race với nhiều worker → CREATE IF NOT EXISTS an toàn
