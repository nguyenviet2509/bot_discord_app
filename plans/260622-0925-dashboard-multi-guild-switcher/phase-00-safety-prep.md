---
phase: 0
name: Safety Prep - Backup + Branch + Override Auto-Push
status: pending
priority: critical
effort: XS
---

# Phase 0: Safety Prep

## Overview
Tạo backup, feature branch, lưu rollback hash, override auto-commit-push rule TRƯỚC khi cook các phase còn lại. Mục tiêu: 0 downtime guild A.

## Why
- 100+ user active guild A — không afford downtime
- Plan đụng 22 routes + bot startup → có rủi ro bug
- Cần local verify trước, prod deploy sau

## Files

### Create
- `database.sqlite.backup-{YYYY-MM-DD}` — copy DB backup local
- `.rollback-hash` — lưu commit hash master để revert nhanh (gitignore)

## Implementation

### Step 1: Backup DB
```bash
# Local: copy file
cp database.sqlite database.sqlite.backup-$(date +%Y-%m-%d)

# Railway (nếu DB ở volume): trigger snapshot qua UI hoặc:
# railway run "cp /app/database.sqlite /app/database.sqlite.backup"
# Hoặc scp về local:
# scp railway:/app/database.sqlite ./database.sqlite.prod-backup
```

### Step 2: Feature branch
```bash
git checkout master
git pull
git checkout -b feature/multi-guild-switcher
git rev-parse master > .rollback-hash
echo ".rollback-hash" >> .gitignore  # nếu chưa có
```

### Step 3: Override auto-commit-push behavior CHỈ CHO PLAN NÀY
- Plan này KHÔNG được auto-push lên remote sau mỗi phase
- Workflow: cook Phase 1 → commit local → manual smoke test → cook Phase 2 → ...
- Chỉ push lên remote sau khi cook xong 1-3 trên local + verify
- Phase 4 chạy sau khi merge feature → master + deploy prod

**Khi cook, anh phải explicitly:**
- Sau mỗi phase: KHÔNG `git push`. Chỉ commit local.
- Sau Phase 3: anh manually `git push origin feature/multi-guild-switcher` + tạo PR
- Phase 4 chạy sau khi prod ổn định

### Step 4: Notify (optional)
- Post message Discord guild A: "Dashboard maintenance ~5 phút, hôm nay <giờ>"
- Skip nếu deploy off-hours

## Todo
- [ ] Copy `database.sqlite` → backup file (local + prod)
- [ ] `git checkout -b feature/multi-guild-switcher`
- [ ] Lưu rollback hash vào `.rollback-hash` (gitignore)
- [ ] Confirm với cook agent: KHÔNG auto-push cho plan này
- [ ] (Optional) Notify guild A users

## Success Criteria
- DB backup tồn tại + verify mở được (`sqlite3 backup.sqlite "SELECT COUNT(*) FROM users"`)
- Trên branch `feature/multi-guild-switcher`
- `.rollback-hash` chứa commit master
- Cook agent biết override rule

## Risks
- Quên override → cook auto-push lỗi giữa chừng → prod gãy
- Backup không complete → khi restore bị lỗi
