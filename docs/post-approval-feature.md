# Tính năng Post Approval Flow

Bot quản lý duyệt bài đăng: member gửi bài → admin duyệt → bot tự đăng vào forum public.

## Setup ban đầu (Admin)

### 1. Tạo trên Discord
- **Text channel** `#đăng-bài-mua-bán` — nơi member gõ `/post`
- **Text channel** `#review` — queue duyệt (ẩn với `@everyone`, chỉ admin + bot xem)
- **Forum channel** `#mua-bán` — bài đã duyệt hiển thị thành thread (tắt quyền "Create Posts" cho `@everyone`)
- **Role** `@Admin` (hoặc tên tùy ý) — gán cho user được duyệt bài

### 2. Phân quyền bot
Bot cần các quyền sau ở tất cả 3 channel:
- `View Channel`, `Send Messages`, `Embed Links`, `Read Message History`
- Forum channel: thêm `Create Public Threads`, `Send Messages in Threads`, `Manage Threads`

### 3. Chạy `/post-setup`
```
/post-setup channels  entry:#đăng-bài-mua-bán  review:#review  public:#mua-bán
/post-setup admin-role  role:@Admin  action:add
/post-setup show       # kiểm tra lại
```

## Member Commands

| Command | Mô tả |
|---|---|
| `/post` | Mở modal đăng bài (chỉ chạy được trong entry channel) |
| `/post-edit post_id:#42` | Sửa bài (autocomplete chỉ hiện bài của mình). Edit → re-review |
| `/post-delete post_id:#42` | Xóa bài (cần confirm) |

## Admin Workflow
1. Bài mới hiện trong `#review` kèm 2 button `✅ Duyệt` / `❌ Từ chối`
2. Click **Duyệt** → bot tự tạo thread trong forum public, DM member kèm link
3. Click **Từ chối** → modal nhập lý do → bot DM member kèm lý do

## Audit
Toàn bộ lifecycle (pending → approved/rejected/deleted, ai duyệt, khi nào, lý do) lưu trong bảng `posts` của DB.

## Files (developer reference)
- `bot/src/commands/post.js` `post-edit.js` `post-delete.js` `post-setup.js`
- `bot/src/events/interaction-create.js` — dispatcher central
- `bot/src/services/post-service.js` — business logic
- `bot/src/utils/post-embed.js` — embed + buttons builder
- `shared/db-posts.js` — posts CRUD
- `shared/db.js` — schema + post settings update
