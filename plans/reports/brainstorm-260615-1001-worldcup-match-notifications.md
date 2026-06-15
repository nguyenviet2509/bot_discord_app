# Brainstorm — Worldcup Match Notifications (MVP)

**Date:** 2026-06-15 10:01
**Branch:** master
**Status:** Design approved, ready for /ck:plan

## 1. Problem statement

Cần thêm module **Worldcup management** cho bot Discord. Feature đầu tiên: tự động gửi tin nhắn thông báo trận đấu sắp diễn ra vào kênh đã cấu hình, trước kick-off N phút (configurable per-guild).

## 2. Requirements (chốt sau Q&A)

### Functional
- Bot owner (xác định bằng **role do user set**) quản lý lịch trận đấu qua dashboard (CRUD).
- Lịch trận đấu **global** (1 bộ dữ liệu dùng chung cho mọi guild).
- Mỗi guild tự cấu hình: enable, 1 channel, N phút trước trận, optional role ping, timezone.
- Scheduler tự động gửi embed thông báo khi trận sắp diễn ra.
- Nếu admin sửa kick-off (postpone) → notification chưa gửi tự động re-schedule (realtime query).
- Idempotent: không gửi trùng dù bot restart hay cron double-tick.

### Non-functional
- KISS: tái dùng pattern modular hiện có, SQLite, cron tick 60s.
- DRY: tái dùng dashboard tab pattern, embed builder pattern (như voice-log).
- Không phụ thuộc API ngoài (nhập tay).

### Out of scope (MVP)
- Lưu kết quả tỉ số sau trận.
- Filter theo đội yêu thích.
- Nhiều kênh / nhiều rule per-guild.
- Import từ API ngoài.

## 3. Approaches evaluated

| # | Approach | Pros | Cons | Verdict |
|---|----------|------|------|---------|
| A | **Module riêng `worldcup/` + cron 60s + 4 bảng SQLite** | KISS, idempotent, tái dùng pattern modular | Cần code scheduler riêng | ✅ Chọn |
| B | Tái dùng `daily-cron.js` mở rộng | Ít file mới | Coupling, daily-cron đang cho task khác | ❌ |
| C | Discord scheduled events native | Discord render sẵn UI | Không custom được embed, không ping role tuỳ ý, không có filter N phút | ❌ |

## 4. Final solution

### 4.1 Module structure
```
bot/src/modules/worldcup/
├── manifest.js                          # key: 'worldcup', defaultEnabled: false
├── register.js                          # init scheduler khi bot ready
├── db/
│   ├── migrate.js                       # tạo 4 bảng + seed teams
│   └── seed-teams.js                    # 32 đội (name + code)
├── services/
│   ├── match-store.js                   # CRUD matches
│   ├── team-store.js                    # query teams
│   ├── guild-config-store.js            # per-guild config
│   ├── notification-log-store.js        # idempotency
│   ├── notification-scheduler.js        # cron tick 60s
│   └── notification-renderer.js         # build embed
└── commands/                            # (none MVP, có thể thêm /worldcup-status sau)
```

### 4.2 Database schema

```sql
-- Global teams (seed 1 lần, 32 đội)
CREATE TABLE worldcup_teams (
  id INTEGER PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,          -- VN, BR, AR, FR…
  name TEXT NOT NULL,                 -- "Việt Nam"
  created_at INTEGER NOT NULL
);

-- Global matches (owner CRUD)
CREATE TABLE worldcup_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team1_id INTEGER NOT NULL REFERENCES worldcup_teams(id),
  team2_id INTEGER NOT NULL REFERENCES worldcup_teams(id),
  kick_off_at INTEGER NOT NULL,       -- UTC unix ms
  round TEXT NOT NULL,                -- 'group' | 'r16' | 'qf' | 'sf' | 'final' | '3rd'
  group_name TEXT,                    -- 'A'..'H' khi round='group'
  status TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | finished | cancelled
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_matches_kickoff ON worldcup_matches(kick_off_at, status);

-- Per-guild config
CREATE TABLE worldcup_guild_config (
  guild_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  channel_id TEXT,
  notify_before_minutes INTEGER NOT NULL DEFAULT 30,
  role_ping_id TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Saigon',
  updated_at INTEGER NOT NULL
);

-- Idempotency log
CREATE TABLE worldcup_notification_log (
  match_id INTEGER NOT NULL,
  guild_id TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  PRIMARY KEY (match_id, guild_id)
);
```

### 4.3 Scheduler algorithm

```
every 60s:
  guildConfigs = SELECT * FROM worldcup_guild_config WHERE enabled=1 AND channel_id NOT NULL
  if guildConfigs empty: return

  maxLead = MAX(notify_before_minutes)
  candidates = SELECT * FROM worldcup_matches
               WHERE status='scheduled'
                 AND kick_off_at BETWEEN now AND now + (maxLead + 2)*60_000

  for each guildConfig:
    N = guildConfig.notify_before_minutes
    for each match in candidates:
      diffMin = (match.kick_off_at - now) / 60_000
      if diffMin in [N-1, N+1]:
        if NOT EXISTS notification_log(match.id, guildConfig.guild_id):
          sendEmbed(guildConfig, match)
          INSERT notification_log(match.id, guildConfig.guild_id, now)
```

**Idempotent + postpone safe:** nếu admin đổi `kick_off_at`, query realtime tự pick up; nếu đã gửi thì log block; nếu chưa gửi và lùi giờ → chờ tick sau.

### 4.4 Embed format

```
🏆 Trận đấu Worldcup sắp diễn ra
**Brazil**  vs  **Argentina**
⏰ 22:00 (Asia/Saigon) — còn ~30 phút
📋 Vòng bảng A
```
- Content: ping role nếu `role_ping_id` set.
- Embed color: theo round (group=blue, knockout=red, final=gold).
- Timezone convert dùng `Intl.DateTimeFormat`.

### 4.5 Dashboard

**Tab 1 — "Quản lý Worldcup" (owner-only)**
- Gating: kiểm tra user có role được set trong `worldcup_owner_role_id` (config global, lưu trong bảng `app_settings` hoặc env).
- UI:
  - Bảng matches (filter theo round, sort theo kick-off).
  - Form thêm/sửa: dropdown team1/team2 (load từ `worldcup_teams`), datetime picker (input local → convert UTC), round select, group.
  - Bulk delete, single delete.
  - (Optional sau) Import JSON.

**Tab 2 — "Thông báo Worldcup" (per-guild admin)**
- Toggle enable, channel select, N phút input (5-1440), role ping select, timezone select.
- Preview embed với match sắp tới gần nhất.

### 4.6 Permission "owner"
- Thêm cấu hình global `worldcup_admin_role_id` (1 role ID).
- Dashboard backend check: user có role này trong **guild gốc bot** (ví dụ guild quản trị) → cho phép truy cập tab quản lý.
- User confirm: "theo role tôi set" → cần UI nhỏ để set role này lần đầu (super admin endpoint hoặc env var).

## 5. Implementation phases

| Phase | Mô tả | Est |
|-------|-------|-----|
| P1 | DB migrations + seed 32 teams (name + code) | S |
| P2 | Module skeleton + match-store + team-store + admin role config | S |
| P3 | Dashboard owner tab — CRUD matches UI + API | M |
| P4 | Dashboard guild tab — per-guild config UI + API | S |
| P5 | Scheduler + notification-renderer + idempotency + register hook | M |
| P6 | Smoke test E2E (tạo match cách now 31p, verify gửi đúng phút thứ 30) | S |

## 6. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Bot restart trùng phút cần gửi → miss | Tick đầu tiên sau ready: catch-up query window `[now-2m, now+2m]` |
| Timezone/DST sai | Lưu UTC, convert ở render bằng `Intl` |
| Cron drift > 60s gây miss | Cửa sổ `[N-1, N+1]` phút buffer |
| Owner gating bypass | Verify role server-side mỗi request, không tin client |
| Admin xoá match đã có log → bug | ON DELETE: xoá luôn notification_log liên quan (CASCADE hoặc trigger) |

## 7. Success criteria

- Tạo trận đấu cách `now + 30m`, guild config N=30, channel set → đúng phút thứ 30 trước trận có tin gửi.
- Sau restart bot ở phút thứ 29 → không gửi trùng.
- Đổi kick-off lùi 1h → notification cũ không gửi, đợi gần giờ mới gửi.
- Disable guild config → không gửi.

## 8. Open questions (resolved)

- ✅ Owner gating = role do user set (cần UI/env setup lần đầu).
- ✅ MVP chỉ thông báo trước trận, không lưu tỉ số.
- ✅ Postpone tự động re-schedule (query realtime).

## 9. Next step

Chạy `/ck:plan` để decompose thành phase files chi tiết trong `plans/260615-1001-worldcup-match-notifications/`.
