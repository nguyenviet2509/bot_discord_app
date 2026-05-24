# Phase 04: Dashboard UI Tab

**Status:** pending | **Effort:** 3h | **Priority:** high
**Depends on:** Phase 03

## Context
Tuân thủ skill `dashboard-layout` (indigo/slate, `.card`, `.btn-primary`, sticky header). Pattern Alpine.js như các tab khác.

## Files
**Create:**
- `dashboard/public/bots-manager.html` — page standalone (nếu pattern hiện tại multi-page) HOẶC fragment trong SPA
- `dashboard/public/js/bots-manager.js` — Alpine controller

**Edit:**
- `dashboard/public/index.html` — thêm nav item "Quản lý Bot"

## UI Layout
```
┌─ Sticky header ─────────────────────────────────┐
│ Quản lý Bot        [+ Thêm bot]   [↻ Làm mới]  │
├──────────────────────────────────────────────────┤
│ ┌─ card ────────────────────────────────────────┐│
│ │ [avatar] Mèo Mun             🟢 Trực tuyến   ││
│ │          Đang chơi Genshin     [Sửa] [Stop]  ││
│ │          Status: ● running                    ││
│ └──────────────────────────────────────────────┘│
│ ┌─ card ────────────────────────────────────────┐│
│ │ [avatar] Hoa Anh Đào         ⚫ Offline       ││
│ │          (chưa set status)     [Sửa] [Start] ││
│ │          Status: ○ stopped                    ││
│ └──────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘

[Modal Add/Edit]
┌─────────────────────────────────────────┐
│ Thêm Bot                            [×] │
├─────────────────────────────────────────┤
│ Tên hiển thị   [_________________]      │
│ Token          [_________________]  ⓘ   │
│ Avatar         [Choose file...]         │
│ Presence       [🟢 Trực tuyến      ▼]  │
│ Activity type  [Đang chơi          ▼]  │
│ Status text    [_________________]      │
│                                         │
│        [Huỷ]    [Lưu]                  │
└─────────────────────────────────────────┘
```

## Steps
1. Load skill `dashboard-layout` → đọc template SPA tab + checklist
2. Scout 1 tab hiện có (vd "Tin nhắn định kỳ") để copy structure Alpine + API helper
3. Tạo `bots-manager.html`:
   - Sticky header với 2 nút action
   - Container card list, mỗi bot 1 card (responsive: mobile stack)
   - Modal add/edit (Alpine x-show)
   - Modal confirm delete
4. Tạo `bots-manager.js` Alpine controller:
   - `bots: []`, `loading`, `editing: null`, `showModal`
   - `async fetchBots()` → GET
   - `async save()` → POST hoặc PATCH (kèm avatar upload riêng nếu có file)
   - `async toggle(bot)` → start/stop
   - `async remove(bot)` → DELETE với confirm
   - Disable nút "Lưu" nếu `display_name` đổi nhưng `can_change_username=false`, tooltip giải thích "Đợi 30 phút sau lần đổi tên trước"
5. Thêm nav item trong `index.html` (verify path file index)
6. Test responsive mobile (theo `dashboard-mobile-responsive` plan đã có)

## Todo
- [ ] Load dashboard-layout skill
- [ ] Scout existing tab pattern
- [ ] Build HTML structure
- [ ] Build Alpine controller
- [ ] Wire avatar upload (FormData)
- [ ] Implement can_change_username UI guard
- [ ] Add nav item
- [ ] Test desktop + mobile

## Success Criteria
- Tab xuất hiện trong sidebar
- Add bot mới → preview tên từ Discord trước save (optional nice-to-have, có thể bỏ qua)
- Card list update realtime sau mỗi action (re-fetch)
- Start/Stop button đổi label + icon đúng
- Edit modal pre-fill data
- Mobile: card stack vertical, button không tràn
- Visual match `dashboard-layout` skill checklist

## Risks
- Avatar preview lag → show placeholder + loading state
- Đổi tên fail rate limit → hiển thị toast lỗi rõ, không reload page
- Token field UX: lúc edit không cho đổi, chỉ hiện masked

## Next
→ Phase 05: wire manager vào `start.js`
