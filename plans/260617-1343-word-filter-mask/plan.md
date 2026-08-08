---
name: Word Filter — ẩn từ nhạy cảm trong tin member
slug: word-filter-mask
status: pending
created: 2026-06-17
branch: master
mode: auto
blockedBy: []
blocks: []
---

# Word Filter — Plan Overview

Module mới `word-filter` phát hiện từ trong blacklist (exact match `\b...\b`, case-insensitive) trong tin của member → **xoá tin gốc** + **repost qua webhook** (giả danh tên + avatar user) với từ bị mask thành `***` cố định 3 sao. Độc lập với rule `bad-word` của Auto-Mod (vẫn xoá+phạt như cũ).

**Pattern reference:**
- Module loader: `bot/src/modules/_loader.js`
- Module mẫu: `bot/src/modules/auto-mod/` (manifest + register + messageHandlers)
- Regex cache: `bot/src/modules/auto-mod/bad-word-cache.js` (sẽ tái sử dụng pattern)
- Dashboard tab pattern: `dashboard/public/automod.html` + `dashboard/public/js/automod.js`

## Phases

| # | Phase | Status | Effort |
|---|---|---|---|
| 1 | [DB schema + helpers](phase-01-db-schema.md) | pending | 0.5 ngày |
| 2 | [Module skeleton + handler (mask + webhook)](phase-02-module-handler.md) | pending | 1.5 ngày |
| 3 | [Dashboard API + UI tab "Ẩn từ"](phase-03-dashboard.md) | pending | 1 ngày |
| 4 | [Test thực tế + tinh chỉnh](phase-04-test-tuning.md) | pending | 0.5 ngày |

**Tổng:** ~3.5 ngày

## Key dependencies

- Module loader đã hỗ trợ `messageHandlers` array (xác nhận trong `_loader.js`)
- `shared/db.js` — thêm migration cho 1 bảng mới qua `shared/db-word-filter.js`
- Bot perm: `Manage Webhooks` + `Manage Messages` (đã có ở phần lớn server)
- discord.js v14 `WebhookClient` + `channel.createWebhook` / `channel.fetchWebhooks`

## Success criteria

- Admin add từ "abc" qua dashboard → user gửi "abc xyz" → tin gốc bị xoá, webhook repost "*** xyz" với avatar + displayName của user
- Latency delete+repost < 500ms p95
- Không loop khi bot tự repost (skip `message.webhookId` + `author.bot`)
- Module off → 0 overhead (early-return)
- Thiếu perm `Manage Webhooks` → log warn 1 lần/guild/giờ, fallback chỉ xoá tin

## Risks

| Risk | Mitigation |
|---|---|
| Loop khi webhook repost trigger lại handler | Skip nếu `message.webhookId` hoặc `author.bot` |
| Race với auto-mod bad-word (cả 2 module bật cùng từ) | `message.delete()` catch `Unknown Message` (code 10008) im lặng |
| Webhook rate limit (30/min/channel) | In-memory token bucket per channel, drop + log warn nếu vượt |
| Tin có @everyone/@role/@user | `allowedMentions: { parse: [] }` khi webhook send → không re-ping |
| Mất reply UI khi repost | MVP: prepend `↪ @<displayName>:` nếu tin gốc có `message.reference` |
| Attachment / embed | MVP: bỏ qua attachment (chỉ repost text); embed Discord tự gen từ link |
| Thread/forum channel | Hỗ trợ qua `webhook.send({ threadId })` |
| Tin DM | Skip (không có guild) |
| Tin edit sau gửi | MVP bỏ qua (không listen `messageUpdate`) |
| Unicode/zero-width bypass | Chấp nhận limitation, ghi rõ trong docs |

## Unresolved questions

1. Có cần audit log (DB table) ghi lại ai bị filter, từ nào, channel nào không? **Đề xuất:** MVP **không** (silent), v2 có thể thêm bảng `word_filter_logs`.
2. DM cho user thông báo tin bị ẩn? **Đề xuất:** MVP **không**.
3. Có cần whitelist channel/role riêng cho word-filter không? User đã chọn **không cần** → bỏ qua, áp dụng toàn server.
