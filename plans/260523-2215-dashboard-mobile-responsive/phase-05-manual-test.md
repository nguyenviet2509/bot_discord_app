# Phase 05 — Manual Test Responsive

## Overview
- Priority: HIGH
- Effort: 15 phút
- Depends on: Phase 01-04

## Test Setup
- Chrome DevTools → Toggle device toolbar (Ctrl+Shift+M)
- Test ở 4 viewport:
  - **375x667** (iPhone SE portrait)
  - **667x375** (landscape — verify sidebar overflow-y-auto)
  - **768px** (iPad — md breakpoint)
  - **1280px** (desktop)
- Refresh browser sau mỗi đổi file (static, không cần restart server)
- Optional: test trên iOS Safari thật (100vh/dvh quirk + sticky bug)

## Checklist

### Index.html — Sidebar drawer
- [ ] 375px: sidebar ẩn, hamburger top-left hiện
- [ ] 375px: click hamburger → drawer slide vào từ trái, backdrop overlay
- [ ] 375px: click backdrop → drawer đóng
- [ ] 375px: click nav-item → tab chuyển + drawer đóng
- [ ] 375px: nhấn phím ESC → drawer đóng
- [ ] 375px: drawer mở → body không scroll được (scroll lock)
- [ ] 667x375 landscape: drawer nội dung scroll-y được (16 nav-item vượt height)
- [ ] 768px: sidebar luôn hiện, hamburger ẩn
- [ ] 1280px: layout y nguyên
- [ ] Search dropdown (scheduled tab line 674) không bị backdrop đè khi drawer mở

### Index.html — 16 tabs content
- [ ] Servers: card grid 1-col mobile, 3-col desktop
- [ ] Rewards: reward-card grid responsive, sticky header buttons không tràn
- [ ] Members: table cuộn ngang được
- [ ] Auto-Mod, Moderation, Analytics, Commands, Links: header + content OK
- [ ] Scheduled, LevelUp, Welcome: form grids 1-col mobile
- [ ] Honor, Events: iframe scale fit
- [ ] Settings: form fields 1-col mobile

### Standalone pages (mở trực tiếp)
- [ ] automod.html ở 375px: tab buttons không tràn, logs table cuộn
- [ ] events.html ở 375px: card list OK
- [ ] honor-config.html ở 375px: embed preview không tràn ngang
- [ ] levelup-preview.html ở 375px: preview cards stack
- [ ] login.html ở 375px: form center, button width đủ

### Standalone pages qua iframe (từ index.html)
- [ ] automod tab: drawer ngoài hoạt động, content inside iframe responsive
- [ ] events tab: cùng kết quả
- [ ] honor tab: cùng kết quả

### Regression check
- [ ] 1280px: tất cả pages giống trước khi sửa (visual diff)
- [ ] Click các button save/refresh vẫn hoạt động
- [ ] Toast notifications vẫn hiện đúng vị trí

## Bug log template
```
## [Bug] [Tab/Page] [Viewport]
**Repro:** ...
**Expected:** ...
**Actual:** ...
**Fix:** ...
```

## Success Criteria
Tất cả checklist pass. Bot/dashboard runtime hoạt động bình thường. Không có console error.

## Notes
- Không có automated test cho dashboard UI → manual chỉ là cách duy nhất
- Test trên thiết bị thật nếu có (iOS Safari + Android Chrome) cho confidence cao hơn
