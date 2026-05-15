---
type: brainstorm
date: 2026-05-15
slug: post-approval-flow
status: approved
---

# Brainstorm: Post Approval Flow (Review → Public)

## Problem Statement
Discord không hỗ trợ moderation queue native. Cần bot cho phép:
- Member submit bài đăng → trạng thái pending
- Admin duyệt/từ chối qua UI rõ ràng
- Bài approved tự động xuất hiện ở forum channel `#public` cho mọi member xem
- Member tự edit/delete bài của mình (edit re-review)

## Final Decisions (đã chốt với user)
| Quyết định | Lựa chọn |
|---|---|
| Channel public | Forum channel (giống `mua-bán`) |
| Channel review | Text channel riêng, restrict view = admin role |
| Submit UX | Slash `/post` + Modal (title, content, giá, liên hệ) |
| Authorship hiển thị | Embed `author` = displayName + avatar member |
| Mapping | 1 cặp `#review` ↔ `#public` duy nhất per guild |
| Approval UX | Button `Duyệt`/`Từ chối` dưới embed, reject có modal nhập lý do |
| Persistence | DB đầy đủ (audit + lifecycle) |
| Edit policy | Edit nội dung → quay lại pending, re-review |
| Tags | Skip MVP |

## Architecture

### Flow
```
Member /post
  → Modal {title, content, price, contact}
  → Bot validate → INSERT posts(status=pending)
  → Bot post embed + buttons vào #review
  → DM member "Bài đã gửi duyệt"

Admin click [Duyệt]
  → Check role + status=pending
  → forumChannel.threads.create({name: title, message: {embeds}})
  → UPDATE posts SET status=approved, public_thread_id, approver_*
  → Edit msg #review: bỏ button, append "✅ Duyệt bởi @admin"
  → DM member + link thread

Admin click [Từ chối]
  → Show modal "Lý do"
  → UPDATE posts SET status=rejected, reject_reason, approver_*
  → Edit msg #review: bỏ button, append "❌ Từ chối: <reason>"
  → DM member + lý do

Member /post-edit
  → Autocomplete bài của mình (status in pending/approved)
  → Modal pre-filled → submit
  → Nếu đang approved: archive/lock thread public + status=pending → bot repost vào #review
  → Nếu đang pending: edit msg #review tại chỗ

Member /post-delete <id>
  → Verify ownership
  → Xóa thread public (nếu có) + delete msg #review
  → UPDATE status=deleted (giữ row cho audit)
```

### DB Schema
```sql
CREATE TABLE posts (
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
CREATE INDEX idx_posts_guild_status ON posts(guild_id, status);
CREATE INDEX idx_posts_author ON posts(guild_id, author_id);

-- settings table: thêm columns
ALTER TABLE settings ADD COLUMN review_channel_id TEXT;
ALTER TABLE settings ADD COLUMN public_forum_id TEXT;
ALTER TABLE settings ADD COLUMN post_admin_role_ids TEXT; -- JSON array
```

### Files Plan
| File | Action | Purpose |
|---|---|---|
| `bot/src/commands/post.js` | NEW | `/post` mở modal |
| `bot/src/commands/post-edit.js` | NEW | `/post-edit` autocomplete + modal |
| `bot/src/commands/post-delete.js` | NEW | `/post-delete <id>` |
| `bot/src/commands/post-setup.js` | NEW | Admin set review/public channel + admin roles |
| `bot/src/events/interaction-create.js` | NEW | Tách handler từ index.js, dispatch modal/button/select |
| `bot/src/services/post-service.js` | NEW | createPost, approvePost, rejectPost, editPost, deletePost |
| `bot/src/utils/post-embed.js` | NEW | Build embed thống nhất cho review & public |
| `shared/db.js` | EDIT | CRUD `posts`, migration schema |
| `bot/src/index.js` | EDIT | Move slash command handler → events/interaction-create.js |

### Custom_id Convention
```
post:approve:<postId>
post:reject:<postId>
post:reject-modal:<postId>
post:edit-modal:<postId>
```

## Risks & Mitigation
| Risk | Mitigation |
|---|---|
| Double-click button → duplicate thread | Check `status='pending'` trong transaction trước khi tạo thread |
| Member DM closed → bot crash | `.send().catch(() => {})` + log |
| Modal content >4000 chars | TextInput `maxLength: 4000`, validate trước |
| Member bypass = edit thành spam sau approved | Re-review trên mọi edit nội dung |
| Forum tags required (forum config) | Detect khi setup; nếu forum bắt buộc tag → block setup + cảnh báo admin (MVP skip tags) |
| Settings chưa setup | `/post` reply ephemeral "Admin chưa cấu hình `/post-setup`" |
| Bot mất permission CreatePublicThreads | Try/catch + DM admin error |

## Success Criteria
- Member /post → bài xuất hiện trong #review trong <2s
- Admin click Duyệt → thread xuất hiện trong forum public với đầy đủ embed
- Member nhận DM kết quả (approved/rejected)
- `/post-edit` bài approved → thread cũ biến mất khỏi public, message re-review xuất hiện trong #review
- `/post-delete` → thread xóa hoàn toàn
- DB ghi đủ audit: ai post, ai duyệt, khi nào, lý do reject

## Out of Scope (MVP)
- Forum tags selection
- Edit chỉ field nhỏ không cần re-review
- Anonymous post
- Webhook giả danh member
- Multi-pair review↔public mapping
- Quota/rate-limit member (số bài/ngày) - có thể thêm sau
- Báo cáo/flagging từ member khác

## Unresolved Questions
- Channel `#review` có cần ẩn hoàn toàn khỏi member non-admin không (giả định YES, admin tự set permission Discord)?
- Cần slash command `/post-list` cho admin xem queue pending không? (gợi ý: bỏ qua, message trong #review đã đủ)
- Có cần expire pending sau X ngày không? (đề xuất bỏ MVP)
