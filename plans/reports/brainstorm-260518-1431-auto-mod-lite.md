---
type: brainstorm
date: 2026-05-18
slug: auto-mod-lite
status: approved
---

# Brainstorm Report — Auto-Mod Lite

## Bối cảnh

Dự án `bot_discord_app` (monorepo: bot Discord + dashboard web) đã có: leveling, moderation thủ công (ban/kick/mute), posts (scheduled), mini-game, honor/vinh danh, welcome/goodbye, dashboard analytics. Mục tiêu giai đoạn tới: tăng engagement + moderation mạnh + community, server <500 member, ưu tiên feature 1-2 tuần, không tích hợp dịch vụ ngoài.

## Vấn đề

- Server nhỏ vẫn gặp spam, invite link rác, mention bừa → admin xử lý thủ công tốn thời gian.
- Chưa có cơ chế tự động phát hiện và xử lý vi phạm theo bậc.
- Cần phòng bệnh trước khi server scale lên.

## Phương án đã xem xét

| Phương án | Pros | Cons | Quyết định |
|---|---|---|---|
| Daily Quest System | ROI engagement cao, tận dụng leveling | Không giải quyết moderation | Lưu sau |
| Ticket System | Vừa community vừa support | Phức tạp UX, ít phù hợp <500 | Lưu sau |
| **Auto-Mod Lite** | Phòng bệnh sớm, tiết kiệm admin, tận dụng moderation infra | Cần tinh chỉnh threshold | **Chọn** |
| AI Moderation | Phát hiện toxic tốt | Vi phạm ràng buộc "không tích hợp ngoài" | Loại |

## Giải pháp chốt: Auto-Mod Lite

### Rules (Phase 1 — MVP)

| Rule | Trigger mặc định | Action mặc định |
|---|---|---|
| Anti-spam (flood) | 5 tin / 5 giây | Delete + warn |
| Anti-invite | regex `discord.gg/`, `discord.com/invite/` | Delete + warn |
| Bad-word filter | Blacklist regex (admin tự thêm) | Delete + warn |
| Anti-mass-mention | >5 mention/1 tin | Delete + warn |
| Anti-repeat | 3 lần cùng nội dung | Delete + warn |

### Action ladder
```
Vi phạm 1  → Xóa + warn DM
Vi phạm 2  → Mute 5 phút
Vi phạm 3  → Mute 1 giờ
Vi phạm 4+ → Kick
Warn reset sau 24h
```
Cấu hình được qua dashboard.

### Kiến trúc

```
bot/src/modules/auto-mod/
├── index.js              # Đăng ký vào message-create
├── rules-engine.js       # Pipeline rules, early-exit khi whitelist
├── action-engine.js      # Ladder + gọi mute/kick có sẵn
├── state.js              # Map TTL cho flood/repeat
└── rules/
    ├── anti-spam.js
    ├── anti-invite.js
    ├── bad-word.js
    ├── anti-mass-mention.js
    └── anti-repeat.js

shared/db-automod.js      # CRUD config/warns/logs

dashboard/
├── routes/automod.js
└── public/automod.html
```

Rule interface (DRY):
```js
{ name, check(message, config, stateStore) → { violated, reason } }
```

### Data model (SQLite)
```sql
automod_config(guild_id, rule_name, enabled, params_json) PRIMARY KEY(guild_id, rule_name)
automod_whitelist(guild_id, type, id)      -- type: 'channel'|'role'
automod_warns(id, guild_id, user_id, rule, created_at)
automod_logs(id, guild_id, user_id, rule, action, message_excerpt, created_at)
```

### Dashboard UI
- `automod.html`: toggle rule, slider threshold, multi-select whitelist channel/role, drag-drop ladder.
- Logs viewer: filter user/rule/action, phân trang.

## Phase implementation (~1.5 tuần)

| Phase | Việc | Effort |
|---|---|---|
| 1 | DB schema + `db-automod.js` | 1 ngày |
| 2 | Rules engine + state store + 5 rules | 3 ngày |
| 3 | Action engine + logging + hook vào `message-create` | 1 ngày |
| 4 | Dashboard config API + UI | 2 ngày |
| 5 | Dashboard logs viewer | 1 ngày |
| 6 | Test thực tế + tinh chỉnh | 1-2 ngày |

## Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| False positive | Whitelist role admin/mod, log đầy đủ để review |
| Regex bad-word chậm | Compile cache khi load, dùng `\b` boundary |
| State mất khi restart | Chấp nhận, flood ngắn hạn |
| Lách bằng zero-width char | Phase 2: normalize unicode |
| DM warn fail | Fallback ephemeral reply |

## Success metrics
- Spam bị chặn ≥ 90%
- False positive < 2% (review log tuần đầu)
- Admin tiết kiệm ≥ 50% thời gian xử lý spam
- Latency check < 50ms / message

## Next steps
1. Tạo plan chi tiết qua `/ck:plan` từ report này.
2. Migration DB cho 4 bảng mới.
3. Build từng phase theo thứ tự.

## Unresolved questions
1. Appeal flow cho user kháng nghị warn? — Đề xuất phase 2.
2. Bad-word list mặc định tiếng Việt hay để trống ban đầu? — Đề xuất để trống, admin tự thêm.
3. Anti-raid (nhiều account mới join cùng lúc) có nằm trong scope? — Đề xuất phase 2.
4. Có tích hợp với `honor` system (vi phạm trừ điểm vinh danh) không?
