---
type: brainstorm
date: 260525-1106
slug: roll-history-user-names
status: agreed
---

# Roll History — Hien Thi Ten User Thay Vi ID

## 1. Problem
- Dashboard Lich su ROLL hiển thị `user_id` raw (18 chữ số snowflake) o cot Host, Winner, bang xep hang trong modal detail → kho doc, kho nho ai voi ai.
- Code: `roll_session_store.listHistory` va `getHistoryDetail` chi SELECT `host_id`/`winner_id`/`user_id`, khong join voi user info nao.
- Bot da co table `users` (cache username/global_name/nickname tu level XP system), nhung khong phai user nao tham gia ROLL cung co trong do.

## 2. Approach Chosen (A + frontend id-shortening)
LEFT JOIN `users` table tai query backend → fallback id rut gon o frontend neu khong co.

### 2.1 Ten hien thi
Uu tien: `nickname` → `global_name` → `username` → id rut gon.
SQL: `COALESCE(u.nickname, u.global_name, u.username) AS display_name`.

### 2.2 ID rut gon (fallback frontend)
- Format: 4 ky tu dau + `…` + 4 ky tu cuoi. Vd `123456789012345678` → `1234…5678`.
- Helper JS dat trong `dashboard/public/js/roll-history.js`.

## 3. Files Changed

### Backend
- **`bot/src/modules/mini-game/services/roll-session-store.js`**:
  - `listHistory`: them LEFT JOIN voi `users` 2 lan (host, winner), tra ve `host_name`, `winner_name`.
  - `getHistoryDetail`: them LEFT JOIN cho session.host_id/winner_id va participant.user_id. Tra ve `{ session, participants }` voi mau participant `{ user_id, name, score, joined_at }`.

  Query example (list):
  ```sql
  SELECT rs.id, rs.guild_id, rs.channel_id, rs.host_id, rs.max_players, rs.state,
         rs.winner_id, rs.winner_score, rs.cancel_reason, rs.created_at, rs.finished_at,
         (SELECT COUNT(*) FROM roll_participant WHERE session_id = rs.id) AS participant_count,
         COALESCE(uh.nickname, uh.global_name, uh.username) AS host_name,
         COALESCE(uw.nickname, uw.global_name, uw.username) AS winner_name
  FROM roll_session rs
  LEFT JOIN users uh ON uh.id = rs.host_id AND uh.guild_id = rs.guild_id
  LEFT JOIN users uw ON uw.id = rs.winner_id AND uw.guild_id = rs.guild_id
  WHERE ...
  ```

  Query example (detail participants):
  ```sql
  SELECT rp.user_id, rp.score, rp.joined_at,
         COALESCE(u.nickname, u.global_name, u.username) AS name
  FROM roll_participant rp
  LEFT JOIN users u ON u.id = rp.user_id AND u.guild_id = ?
  WHERE rp.session_id = ?
  ORDER BY (rp.score IS NULL), rp.score DESC, rp.joined_at ASC
  ```

### Frontend
- **`dashboard/public/js/roll-history.js`**:
  - Them helper `formatUserDisplay(name, id)` → tra `name || shortenId(id)`.
  - Helper `shortenId(id)` → 4 dau + `…` + 4 cuoi (neu len > 8, neu khong tra nguyen).
  - Render cot Host, Winner trong bang list dung helper.
  - Render Host, Winner, item bang xep hang trong modal detail dung helper.
  - Optional: tooltip hover hien full id (title attr) cho de copy/check.

## 4. Risks
- **Performance JOIN**: `users` table co the lon, nhung co index PK trren `(id, guild_id)` (dum kiem o schema) → JOIN cost = O(log n) per row. Voi pageSize 20-100, khong dang lo.
- **Stale name**: neu user doi nickname/global_name sau khi roll → hien ten moi (vi join live). User chap nhan tradeoff nay theo brainstorm (chon fallback id rut gon, khong snapshot).
- **User chua co trong users**: hien id rut gon. Khong gay loi.

## 5. Out of Scope (Defer)
- Snapshot name luc join ROLL (Approach B) — chi can neu sau nay user complain ten lich su sai khi nguoi choi doi nick/global_name.
- Discord API fetch runtime + cache vao users table — phuc tap, defer den khi du lieu cho thay nhieu id missing trong users.
- Avatar trong bang xep hang — out of scope, brainstorm chi yeu cau ten.

## 6. Success Criteria
- Bang list: cot Host va Winner hien ten (nickname/global/username) cho > 90% session.
- Modal detail: Host, Winner, va tat ca participant trong bang xep hang hien ten.
- User khong co trong users → hien id format `1234…5678`, khong phai 18 chu so.
- Khong co regression: pagination, filter from/to, sort van hoat dong.

## 7. Open Questions
- Khong.
