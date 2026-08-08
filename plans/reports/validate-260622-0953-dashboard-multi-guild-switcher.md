---
type: validate
date: 2026-06-22
target: plans/260622-0925-dashboard-multi-guild-switcher/
---

# Validation: Dashboard Multi-Guild Switcher

## Decisions

| # | Question | Decision |
|---|----------|----------|
| V1 | Slash command rollout | **Parallel 24h**: register global + giữ guild-scope guild A → sau 24h cleanup guild-scope |
| V2 | Test guild B | **Setup guild mới** trước Phase 4 (thêm step) |
| V3 | env GUILD_ID role | **Giữ làm fallback BE** (primary guild default) |
| V4 | Pre-warm fail | **Fail-open + log warning** (đã trong plan) |
| V5 | Managed bots | **Mount middleware** (đã trong plan) |

## Plan Updates Required

### Phase 1 — Slash command rollout strategy
Thay vì 1 lần chuyển global, làm theo bước:

**Step 4a (deploy):**
```js
// Register cả global VÀ guild-scope (parallel)
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandsData })
if (process.env.GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID),
    { body: commandsData }
  ).catch(e => console.warn('[Commands] guild-scope register fail:', e.message))
}
```
→ User guild A vẫn thấy slash command (qua guild-scope cache) trong khi global propagate.

**Step 4b (cleanup, sau ~24h, manual):**
- Đợi global đã propagate đủ (test với client mới)
- Run script xóa guild-scope: `rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [] })`
- Có thể tạo `scripts/cleanup-guild-scope-commands.js` để run thủ công

→ Document trong [phase-01](../260622-0925-dashboard-multi-guild-switcher/phase-01-backend-guild-context.md).

### Phase 4 — Setup test guild
Thêm step **0** ở đầu Phase 4:
- Tạo Discord server test (or dùng dev server có sẵn)
- Invite bot bằng OAuth link
- Lưu `guildId` mới để dùng trong test
- Generate seed data

## Confidence
- ✅ Brainstorm: 4 quyết định gốc
- ✅ Red-team: 9 findings (5 critical/high + 4 medium accepted)
- ✅ Validate: 5 edge case decisions
- → Plan đầy đủ context, sẵn sàng cook

## Unresolved
- Lite bot per-guild logic: chưa audit chi tiết, chỉ apply middleware. Nếu lite bot có shared state cross-guild → có thể bug edge case (defer follow-up)
- Discord global command exact propagation thời gian: tài liệu nói "tối đa 1h", thực tế có thể nhanh hơn
