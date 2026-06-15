# Phase 04 — Dashboard Guild Tab (Per-Guild Config)

## Context

- Pattern: tham khảo tab `voice-log` config (đã có thông báo join/leave) — tương tự về UI/UX.
- Auth: guild admin permission đã có sẵn trong dashboard.

## Overview

- Priority: P0
- Status: pending
- Mỗi guild config nhận thông báo: enable, channel, N phút, role ping, timezone.

## Files

### Create
- `dashboard/src/routes/worldcup-guild.js` — Express routes per-guild.

### Modify
- `dashboard/public/index.html` — thêm tab "Thông báo Worldcup" trong SPA (theo pattern các tab khác).
- `dashboard/public/js/<existing-spa-bundle>.js` — Alpine component `worldcupConfig`.

## API endpoints

```
GET   /api/guilds/:guildId/worldcup-config        → get config
PATCH /api/guilds/:guildId/worldcup-config        → upsert {enabled, channelId, notifyBeforeMinutes, rolePingId, timezone}
GET   /api/guilds/:guildId/worldcup-preview       → preview embed (lấy match upcoming gần nhất)
```

Tất cả qua existing guild admin middleware.

## UI layout (tab SPA)

```
┌─ Thông báo Worldcup ─────────────────────────────┐
│ [Toggle] Bật thông báo                            │
│                                                   │
│ Kênh thông báo: [#world-cup ▾]                    │
│ Gửi trước trận:   [30] phút (5–1440)              │
│ Role ping (tùy chọn): [@worldcup-fans ▾]          │
│ Múi giờ:          [Asia/Saigon ▾]                 │
│                                                   │
│ [Preview embed]                                   │
│ ┌──────────────────────────────────────────────┐ │
│ │ 🏆 Trận đấu Worldcup sắp diễn ra              │ │
│ │ Brazil vs Argentina                           │ │
│ │ ⏰ 22:00 (Asia/Saigon) — còn ~30 phút         │ │
│ │ 📋 Vòng bảng A                                │ │
│ └──────────────────────────────────────────────┘ │
│                                                   │
│         [Lưu cấu hình]   [Test gửi ngay]          │
└───────────────────────────────────────────────────┘
```

`Test gửi ngay` = endpoint trigger gửi 1 lần embed preview lên channel đã chọn (không động log).

## Steps

1. Đọc `dashboard-layout/SKILL.md`.
2. Tạo routes `worldcup-guild.js`:
   - GET/PATCH config qua `guild-config-store`.
   - Validate: `notifyBeforeMinutes` 5–1440, channelId belongs to guild, rolePingId optional.
   - `/preview` endpoint render embed JSON từ match upcoming gần nhất (dùng renderer Phase 05 nếu có, không thì stub).
   - `/test-send` endpoint gửi 1 embed test (gọi Discord.js client từ shared).
3. Add tab vào SPA `index.html` + Alpine component:
   - Load config khi mount.
   - Save → PATCH.
   - Preview re-fetch sau khi save.
4. Manual test: bật, chọn channel, save, click test → tin xuất hiện ở Discord.

## Todo

- [ ] Routes GET/PATCH config
- [ ] Route /preview
- [ ] Route /test-send
- [ ] HTML tab section
- [ ] Alpine component worldcupConfig
- [ ] Validate inputs server-side
- [ ] Manual E2E test

## Success criteria

- Guild admin bật → config row vào DB.
- Click "Test gửi" → embed gửi tới channel đã chọn.
- Preview hiển thị đúng giờ local theo timezone đã chọn.

## Risks

- `Test gửi` cần access Discord client từ dashboard process. Nếu dashboard chạy chung process bot → import client trực tiếp. Nếu tách process → cần IPC/queue. **Verify hiện trạng**: project hiện `start.js` chạy bot + dashboard cùng process hay tách? Phase 04 cần xác nhận trước implement.

## Next

Phase 05 — scheduler + renderer (renderer dùng chung cho preview/test/auto).
