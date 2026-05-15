---
name: Tier Emoji Nickname Flair
slug: tier-emoji-nickname-flair
status: completed
created: 2026-05-15
branch: master
mode: fast
blockedBy: []
blocks: []
---

# Tier Emoji Nickname Flair — Plan Overview

Tự động append emoji badge tier vào server nickname khi member lên tier mới (level 10/20/.../100). Member có thể opt-out qua `/flair off`.

**Source:** [brainstorm-260515-2026-tier-emoji-nickname-flair.md](../reports/brainstorm-260515-2026-tier-emoji-nickname-flair.md)

## Phases

| # | Phase | Status | File |
|---|---|---|---|
| 1 | DB migration + tier-flair-service (custom badge support) | ✅ done | [phase-01-db-and-service.md](phase-01-db-and-service.md) |
| 2 | Tích hợp vào handleLevelUp | ✅ done | [phase-02-integrate-level-up.md](phase-02-integrate-level-up.md) |
| 3 | Slash command `/flair on\|off` (user) | ✅ done | [phase-03-flair-command.md](phase-03-flair-command.md) |
| 4 | Slash command `/flair-config` (admin custom badge) | ✅ done | [phase-04-flair-config-command.md](phase-04-flair-config-command.md) |
| 5 | Manual test + permission audit | ✅ done | [phase-05-test-and-audit.md](phase-05-test-and-audit.md) |

## Custom Badge Model

- Default badges từ `LEVEL_TIERS` trong `level-service.js` (fallback).
- Bảng mới `guild_tier_badges(guild_id, tier_min_level, badge)` lưu override per-guild per-tier.
- Helper `getTierBadge(guildId, tier)` → trả `override || tier.badge`.
- Chỉ chấp nhận **Unicode emoji** (validate bằng regex `\p{Extended_Pictographic}`).
- Strip emoji cũ trên nick: regex generic bắt mọi trailing emoji (không phụ thuộc badge cụ thể).

## Key Dependencies

- discord.js (sẵn có) — `member.setNickname`, `member.manageable`, slash commands.
- better-sqlite3 (sẵn có) — DB migration idempotent.
- Permission `MANAGE_NICKNAMES` cho bot ở từng guild.

## Success Criteria

- Lv 10 → nick `Tên ⚫`. Lv 20 → tự đổi `Tên 🟤`. Lv 100 → `Tên 🔴`.
- `/flair off` → strip emoji, không auto-set lại.
- Server owner / user role cao hơn bot: skip silently + log warn.
- Không crash, không spam audit log (chỉ update khi đổi tier).
