# Brainstorm — Tier Emoji Nickname Flair

**Date:** 2026-05-15
**Branch:** master
**Status:** Design approved, awaiting plan

---

## 1. Problem Statement

Hiện tại, hệ thống level đã có 10 tier (Sắt → Thách Đấu), mỗi tier có badge emoji riêng (🔴🟠🟣🔵🟢🩵🟡⚪🟤⚫). Bot chỉ react emoji với 8% xác suất trên tin nhắn — không tạo cảm giác "hạng" thường trực khi member chat.

**Yêu cầu:** Khi member đạt tier (level ≥ 10), hiển thị emoji badge **ngay cạnh tên** mỗi lần chat. Ví dụ: `Tohma 🩵` (Bạch Kim, lv50).

---

## 2. Constraints & Reality Check

- Discord **không** cho bot can thiệp render username khi user gửi message → chỉ có thể đổi **server nickname**.
- Cần permission `MANAGE_NICKNAMES`.
- **Không** đổi được nick của: server owner, user có role cao hơn bot.
- Giới hạn nickname: **32 ký tự** (bao gồm emoji).
- Mỗi `setNickname` ghi vào audit log + tốn API quota.

---

## 3. Approaches Evaluated

| | A. Sửa nickname (CHỌN) | B. Webhook impersonation | C. Tăng auto-react |
|---|---|---|---|
| Emoji cạnh tên thực sự | ✅ | ✅ (giả) | ❌ |
| Phá UX (reply/edit/mention) | ❌ | ✅ tệ | ❌ |
| Dev effort | Trung bình | Cao | Thấp |
| User control | Opt-out qua /flair | Khó | N/A |

→ **Chọn A**: là cách duy nhất đúng ngữ nghĩa "tên kèm emoji" mà không phá UX.

---

## 4. Final Design

### 4.1 Quyết định đã chốt
- **Cách:** Auto sửa server nickname.
- **Emoji set:** 1 emoji = badge của tier hiện tại (lấy từ `LEVEL_TIERS[].badge`).
- **Ngưỡng:** Từ level 10 (Sắt) trở lên. Level < 10 không có flair.
- **Trigger:** Chỉ khi member **lên tier mới** (không phải mỗi lần lên level).
- **Base name:** Giữ nickname hiện tại của member, append emoji. Nếu chưa có nick → dùng `globalName || username`.
- **Edge case:** Skip im lặng + `console.warn` cho owner / role cao hơn bot / nick > 32 ký tự sau khi append.
- **Opt-out:** Slash command `/flair off|on` cho từng user, lưu cờ `flair_enabled` trong DB.

### 4.2 Logic chính (pseudo)

```
on level-up (newLevel > oldLevel):
  oldTier = getTierForLevel(oldLevel)
  newTier = getTierForLevel(newLevel)
  if oldTier.minLevel === newTier.minLevel: return   # cùng tier, không update
  if newLevel < 10: return                            # chưa có tier
  applyFlair(member, newTier.badge)

applyFlair(member, badge):
  if !user.flair_enabled: return
  if !member.manageable: warn & return                # owner / role cao hơn bot
  baseName = stripTierBadges(member.nickname || member.user.globalName || member.user.username)
  newNick = `${baseName} ${badge}`
  if newNick.length > 32:
    baseName = baseName.slice(0, 32 - badge.length - 1)
    newNick = `${baseName} ${badge}`
  if newNick === member.nickname: return              # idempotent
  member.setNickname(newNick, 'Tier flair update')

stripTierBadges(name):
  # Xoá mọi badge cũ ở cuối tên (regex từ LEVEL_TIERS[].badge)
  return name.replace(/[\s]*[🔴🟠🟣🔵🟢🩵🟡⚪🟤⚫]+\s*$/u, '').trim()
```

### 4.3 Database changes

Bảng `users` (shared/db): thêm cột
```sql
ALTER TABLE users ADD COLUMN flair_enabled INTEGER DEFAULT 1;
```
Mặc định bật. Migration idempotent (check column exist trước khi ALTER).

### 4.4 Files cần đụng

| File | Thay đổi |
|---|---|
| `bot/src/services/level-service.js` | Export `getTierForLevel`, thêm helper `applyTierFlair(member, oldLevel, newLevel)`; gọi trong `handleLevelUp` |
| `shared/db.js` | Migration cột `flair_enabled`; helper `setFlairEnabled(userId, guildId, enabled)` + `getUser` đã trả về field này |
| `bot/src/commands/flair.js` (mới) | Slash command `/flair on|off` cho user |
| `bot/src/services/tier-flair-service.js` (mới, tách module) | `stripTierBadges`, `buildFlairNickname`, `applyTierFlair` — keep level-service nhỏ |
| `bot/src/commands/index.js` hoặc loader | Đăng ký command mới |

→ Modularization: logic flair tách thành `tier-flair-service.js` riêng (không nhồi vào level-service vốn đã dài).

### 4.5 Edge cases coverage

- **Server owner**: `member.manageable === false` → skip + log.
- **Bot role thấp hơn user**: cùng cơ chế `manageable` → skip + log.
- **Nick > 32 ký tự sau khi append**: truncate base name.
- **User tự đổi nick xoá emoji**: không auto-restore (vì chỉ trigger on tier-up). Acceptable — user tự xoá là user chọn.
- **User tự thêm emoji tier khác vào nick**: `stripTierBadges` xoá hết badge biết → set lại đúng tier.
- **Member bị giảm level (admin reset)**: ngoài scope; có thể thêm sau qua admin command.
- **Skin tone variant của emoji**: badges hiện tại đều là geometric, không có variant → safe.

---

## 5. Implementation Considerations

- **Bot permission audit**: kiểm tra bot có `MANAGE_NICKNAMES` trên guild khi khởi động → log warning nếu thiếu.
- **Rate limit**: Discord cho phép ~10 nick updates / 10 phút / guild. Vì chỉ trigger on tier-up (sự kiện hiếm), không lo rate-limit.
- **Test plan**: tạo test member, set level qua admin command, verify nickname change qua từng tier ngưỡng (10, 20, ..., 100).

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Member khó chịu khi bot đổi nick họ tự đặt | Command `/flair off` + chỉ append, không ghi đè |
| Audit log spam | Chỉ update on tier-up (≤ 10 lần / user trong toàn bộ thời gian) |
| Emoji không render trên client cũ | Chấp nhận; tier badge dùng standard Unicode emoji |
| Bot thiếu permission silent fail | Log warn + thêm health check khi bot start |

---

## 7. Success Criteria

- Member lv 10 chat → nick hiện `Tên ⚫`.
- Lên lv 20 → nick auto đổi thành `Tên 🟤` (badge cũ bị strip).
- `/flair off` → nick bị xoá emoji ngay, không auto-set lại khi level-up sau đó.
- Server owner level-up → không có lỗi crash, chỉ log warn.

---

## 8. Next Steps

1. Tạo `/ck:plan` với scope báo cáo này.
2. Phase 1: DB migration + `tier-flair-service.js`.
3. Phase 2: Tích hợp vào `handleLevelUp`.
4. Phase 3: Slash command `/flair`.
5. Phase 4: Test thủ công + admin sync command (optional).

---

## 9. Unresolved Questions

- Có muốn admin command `/sync-flair` để backfill nick cho **toàn bộ member có level ≥ 10** đang tồn tại không? (chưa quyết — có thể bỏ vào phase optional)
- Có muốn hiển thị flair status trong embed `/profile` hoặc `/rank` không?
