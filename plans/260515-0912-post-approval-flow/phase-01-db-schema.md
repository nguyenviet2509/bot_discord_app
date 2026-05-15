# Phase 01 — DB Schema + Settings Extension

**Priority:** Critical (blocks all subsequent phases)
**Status:** pending

## Overview
Mở rộng `shared/db.js`: thêm bảng `posts`, thêm cột `review_channel_id`, `public_forum_id`, `post_admin_role_ids` vào `settings`. Thêm CRUD helpers.

## Related Files
- **Edit:** `shared/db.js`

## DDL
```sql
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_tag TEXT,
  author_avatar TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  price TEXT,
  contact TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','deleted')),
  review_message_id TEXT,
  public_thread_id TEXT,
  approver_id TEXT,
  approver_tag TEXT,
  reject_reason TEXT,
  created_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_guild_status ON posts(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(guild_id, author_id);

-- Migration cho settings (dùng try/catch ALTER vì SQLite không IF NOT EXISTS cho column)
ALTER TABLE settings ADD COLUMN post_entry_channel_id TEXT;  -- text channel nơi member /post
ALTER TABLE settings ADD COLUMN review_channel_id TEXT;       -- text channel admin duyệt
ALTER TABLE settings ADD COLUMN public_forum_id TEXT;         -- forum channel public
ALTER TABLE settings ADD COLUMN post_admin_role_ids TEXT;     -- JSON array role admin
```

## Helpers (export từ shared/db.js)
```js
// Posts CRUD
createPost({ guild_id, author_id, author_tag, author_avatar, title, content, price, contact }) → id
getPost(id) → row|null
getPostsByAuthor(guild_id, author_id, statuses[]) → row[]
updatePostStatus(id, { status, approver_id, approver_tag, reject_reason, public_thread_id, review_message_id })
updatePostContent(id, { title, content, price, contact })
setPostReviewMessage(id, message_id)
setPostStatusPending(id) // dùng khi re-review

// Settings extension
updatePostSettings(guild_id, { post_entry_channel_id, review_channel_id, public_forum_id, post_admin_role_ids })
```

## Implementation Steps
1. Đọc `shared/db.js` hiện tại, hiểu pattern (prepared statements + sync API)
2. Thêm DDL `posts` trong `initDb()`
3. Thêm migration ALTER TABLE settings — wrap try/catch để skip nếu column đã tồn tại
4. Implement helpers theo pattern hiện có (prepared statements)
5. Test: `require('./shared/db').initDb()` không throw, columns tồn tại

## Todo
- [ ] Thêm DDL `posts` table
- [ ] Migration `settings` 3 columns mới (try/catch)
- [ ] CRUD helpers cho `posts` (8 functions)
- [ ] `updatePostSettings()` helper
- [ ] Test init không crash trên DB cũ
- [ ] Test init không crash trên DB mới

## Success Criteria
- `node -e "require('./shared/db').initDb()"` chạy clean trên DB cũ (đã có settings)
- Tất cả helpers exported, có signature đúng
- Indexes được tạo

## Risks
- ALTER TABLE fail nếu column đã có → bắt buộc try/catch
- File db.js có thể vượt 200 LOC sau khi thêm → consider tách `shared/db-posts.js` nếu cần
