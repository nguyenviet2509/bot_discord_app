---
slug: lite-bot-health-and-restart-all
created: 2026-05-27
status: completed
mode: fast
blockedBy: []
blocks: []
---

# Lite Bot Health Detection + Restart All

## Context
- Brainstorm: [plans/reports/brainstorm-260527-0811-lite-bot-health-and-restart-all.md](../reports/brainstorm-260527-0811-lite-bot-health-and-restart-all.md)
- Parent feature: [plans/260524-1607-multi-lite-bots/](../260524-1607-multi-lite-bots/)

## Problem
Lite bot thi thoảng offline trên Discord nhưng dashboard vẫn hiện "Đang chạy". Root cause: `LiteClient.ready` không reset khi gateway disconnect; listener chỉ có `error`/`shardError`; dashboard đọc DB status (chỉ update khi user thao tác).

## Solution (A+B+D)
- **A** Listeners `shardDisconnect`/`shardResume`/`shardReady`/`invalidated` trong `LiteClient`.
- **B** `isRunning()` check thêm `client.ws.status === Status.Ready` realtime.
- **C** `GET /managed-bots` override field `status` bằng `manager.isRunning(id)` realtime.
- **D** `POST /managed-bots/restart-all` + nút "Khởi động lại tất cả" trong header tab Quản lý Bot.

## Phases

| # | Phase | Status | Files |
|---|---|---|---|
| 01 | [Backend: health detection + restart-all](phase-01-backend-health-and-restart-all.md) | completed | bots-lite/lite-client.js, dashboard/routes/managed-bots.js |
| 02 | [Frontend: nút khởi động lại tất cả](phase-02-frontend-restart-all-button.md) | completed | dashboard/public/js/app.js, dashboard/public/index.html |

## Dependencies
- discord.js đã có `Status` export + `shardDisconnect`/`shardResume`/`shardReady`/`invalidated` events (v14+).
- Không cần migration DB.

## Success Criteria
- Disconnect Discord gateway → dashboard hiện stopped/error trong <5s sau khi user bấm "Làm mới".
- Reconnect resume → realtime check trả về running.
- Nút "Khởi động lại tất cả" stop+start mọi bot có `desired_state='running'`, delay 500ms/bot, toast báo N/M.
- Không thrashing khi spam nút (FE disable lúc loading).

## Out of Scope
- Watchdog auto-restart (sẽ cân nhắc sau nếu vẫn cần).
- FE polling auto-refresh.
