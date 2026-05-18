# Auto-Mod Lite — Hướng dẫn quản trị

Module tự động phát hiện và xử phạt vi phạm chat: spam, link mời, từ cấm, mass-mention, lặp tin.

## Bật module

1. Mở Dashboard → tab **Auto-Mod**.
2. Tab **Quy tắc**: bật từng rule cần dùng. Mỗi rule có thể tinh chỉnh tham số riêng.
3. Module mặc định **tắt** — cần admin bật qua bảng `guild_modules` (`module_key='auto-mod'`).
4. Bot không cần restart — đổi config có hiệu lực ngay tin nhắn kế tiếp.

## 5 quy tắc

| Rule | Mô tả | Tham số mặc định |
|---|---|---|
| **anti-spam** | Phát hiện flood: gửi quá nhiều tin trong cửa sổ thời gian | 5 tin / 5 giây |
| **anti-invite** | Phát hiện link mời server Discord (`discord.gg/...`) | — |
| **bad-word** | Chặn từ ngữ trong blacklist (admin tự thêm) | Trống |
| **anti-mass-mention** | Tin có quá nhiều mention (user + role) | > 5 mention |
| **anti-repeat** | Gửi cùng nội dung liên tiếp | ≥ 3 lần |

### Khuyến nghị threshold
- Server nhỏ (<500 active): giữ default
- Server lớn: nâng anti-spam lên 8 tin/5s để giảm false positive

## Whitelist

Tab **Whitelist**: thêm channel hoặc role được **miễn check** hoàn toàn.
- Khuyên đặt role **Moderator / Admin** vào whitelist
- Channel `#bot-spam`, `#test` nên whitelist

## Ladder phạt

Tab **Ladder phạt**: cấu hình bậc xử phạt theo số lần vi phạm.

Mặc định:

| Lần | Action |
|---|---|
| 1 | Cảnh báo + Xoá tin |
| 2 | Mute 5 phút |
| 3 | Mute 1 giờ |
| 4+ | Kick |

**Reset warn** sau 24 giờ (cấu hình được). Sau đó count quay về 0.

Action khả dụng: `warn`, `mute-5m`, `mute-1h`, `mute-1d`, `kick`.

## Logs & Stats

Tab **Logs**: xem lịch sử xử phạt, filter theo user/rule/action.
- Click nút **Reset warn** để xoá warn count của 1 user (cho phép lại từ đầu)

Tab **Thống kê**: tổng vi phạm theo rule + top 10 user vi phạm trong 7 ngày.

## Quyền bot cần có
- `Manage Messages` — để xoá tin vi phạm
- `Moderate Members` — để timeout (mute)
- `Kick Members` — để kick ở bậc cuối

Nếu thiếu quyền: tin vẫn bị xoá, nhưng mute/kick sẽ fail (log warning ở console).

## Troubleshoot

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| Tin không bị xoá | Module chưa enable per-guild | Bật trong `guild_modules` |
| Rule bật nhưng không catch | Channel/role trong whitelist | Kiểm tra tab Whitelist |
| DM warn không nhận được | User tắt DM từ server | Bot fallback gửi ephemeral 10s |
| Bot không mute/kick được | Thiếu role permission | Cấp quyền hoặc đưa role bot lên cao |
| False positive nhiều | Threshold quá gắt | Tăng `maxMessages` hoặc `maxMentions` |

## Giới hạn (MVP)
- State flood/repeat lưu in-memory → mất khi bot restart
- Bad-word không normalize unicode (user có thể lách bằng zero-width char)
- Chưa có anti-raid (nhiều account join cùng lúc)
- Chưa có appeal flow

Roadmap mở rộng: xem `plans/260518-1431-auto-mod-lite/phase-06-test-tuning.md`.
