# Phase 01 — DB Schema + Helpers

**Status:** pending
**Priority:** high
**Files:** `shared/db-managed-bots.js`

## Mục tiêu

Thêm fields autochat vào `managed_bots` + bảng phụ `managed_bot_messages`. Bổ sung helpers CRUD.

## Schema changes

### `managed_bots` — 4 cột mới

```sql
ALTER TABLE managed_bots ADD COLUMN autochat_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE managed_bots ADD COLUMN autochat_channel_id TEXT;
ALTER TABLE managed_bots ADD COLUMN autochat_min_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE managed_bots ADD COLUMN autochat_max_minutes INTEGER NOT NULL DEFAULT 180;
```

### Bảng mới `managed_bot_messages`

```sql
CREATE TABLE IF NOT EXISTS managed_bot_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bot_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (bot_id) REFERENCES managed_bots(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_managed_bot_messages_bot_id ON managed_bot_messages(bot_id);
```

## Migration

Trong `initManagedBotsSchema()`, thêm migration pattern giống `desired_state`:

```js
const cols = database.prepare("PRAGMA table_info(managed_bots)").all()
if (!cols.some(c => c.name === 'autochat_enabled')) {
  database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_enabled INTEGER NOT NULL DEFAULT 0")
  database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_channel_id TEXT")
  database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_min_minutes INTEGER NOT NULL DEFAULT 60")
  database.exec("ALTER TABLE managed_bots ADD COLUMN autochat_max_minutes INTEGER NOT NULL DEFAULT 180")
}
```

## Helpers cần thêm

```js
// Trong listBots() / getBot() SELECT: thêm autochat_enabled, autochat_channel_id,
//   autochat_min_minutes, autochat_max_minutes

function getAutochatConfig(id)         // → { enabled, channel_id, min_minutes, max_minutes }
function updateAutochatConfig(id, patch) // partial update các field autochat_*
function listMessages(botId)            // → [{id, content, created_at}]
function addMessage(botId, content)     // → insertId
function deleteMessage(messageId, botId) // chỉ xoá nếu thuộc bot đó
function listDesiredAutochatIds()       // → bot ids có autochat_enabled=1 (cho restore)
```

## Validation

- `min_minutes >= 1`, `max_minutes >= min_minutes`, max <= 10080 (1 tuần)
- `content` length 1..2000 (Discord message limit)
- `channel_id` regex `^\d{17,20}$`

Validation đặt ở route layer, helper chỉ assert basic.

## Todo

- [ ] Thêm 4 cột vào SCHEMA_SQL constant
- [ ] Thêm migration block trong initManagedBotsSchema
- [ ] Cập nhật SELECT trong listBots, getBot
- [ ] Viết getAutochatConfig, updateAutochatConfig
- [ ] Tạo bảng managed_bot_messages trong initManagedBotsSchema
- [ ] Viết listMessages, addMessage, deleteMessage
- [ ] Viết listDesiredAutochatIds
- [ ] Export functions mới

## Success criteria

- `node -e "require('./shared/db-managed-bots').initManagedBotsSchema(require('./shared/db').getDb())"` chạy không lỗi trên DB cũ (migration) và DB mới (create fresh)
- Tất cả helpers test manual: create config, list/add/delete message
