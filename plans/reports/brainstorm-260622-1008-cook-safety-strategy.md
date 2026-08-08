---
type: brainstorm
date: 2026-06-22
slug: cook-safety-strategy
target: plans/260622-0925-dashboard-multi-guild-switcher/
---

# Brainstorm: Cook Safety Strategy

## Context
100+ user active guild A, không afford downtime. Plan đa guild đụng tới 22 routes + bot startup. Cần đảm bảo cook không làm gãy guild A trong khi rollout.

## Constraints (chốt với user)
- Môi trường: Production Railway + local mirror
- Branch: feature branch riêng, merge master sau verify
- Scale: 100+ user active guild A
- DB backup: cần tạo trước cook
- Smoke test: thủ công sau mỗi deploy

## Strategy

### Phase 0 - Safety Prep (TRƯỚC khi cook)
1. **Backup DB**:
   - Railway: trigger volume snapshot (UI) hoặc scp file về local
   - Local: copy `database.sqlite` → `database.sqlite.backup-{date}`
2. **Feature branch**: `git checkout -b feature/multi-guild-switcher`
3. **Rollback hash**: `git rev-parse master > .rollback-hash` (lưu để emergency revert)
4. **Override auto-commit rule**: cook chỉ commit local, **KHÔNG push** cho tới khi verify
5. **Notify users** (optional): thông báo trước Discord guild A là sẽ có maintenance ngắn

### Cook execution (local-first)
- Mọi phase chạy trên local
- Mỗi phase xong → commit (chưa push) → smoke test guild A local
- Smoke test guild A check tối thiểu (BC verify):
  - Dashboard load `localhost:3001` → login OK
  - Switch sang guild A → analytics summary đúng
  - Một vài tab: members, settings, scheduled-messages
  - Bot khởi động local không error

### Pre-merge verify
- Toàn bộ 4 phase OK trên local
- `grep "process.env.GUILD_ID" dashboard/routes/` → 0 (trừ middleware fallback)
- Push feature branch
- Tạo PR `feature/multi-guild-switcher → master`
- Self-review diff

### Production deploy
- Merge off-hours (sau 23h Asia/Saigon hoặc trưa thấp tải)
- Railway tự deploy
- **Trong 5 phút post-deploy: smoke test guild A** (checklist bên dưới)
- Nếu broken: `git revert <merge-commit> && git push` → Railway tự redeploy

### Smoke test checklist guild A (post-deploy)
- [ ] Mở `https://<dashboard-url>` → login OK
- [ ] Tab Tổng quan: summary số liệu hiện
- [ ] Tab Members: leaderboard hiển thị user guild A
- [ ] Tab Settings: XP min/max load đúng config guild A
- [ ] Tab Scheduled Messages: list message đúng
- [ ] Discord guild A: bot online (status green)
- [ ] Discord guild A: gõ `/rank` → response (qua guild-scope parallel, không phải đợi global)
- [ ] Check Railway logs: không có error stack trace

→ 7/8 pass = OK. <7 = rollback ngay.

### Phase 4 trên prod (sau khi đã ổn định guild A)
- Setup Discord guild B + invite bot
- Verify đa guild (chỉ READ data, không ghi)
- Sau 24h: chạy `node scripts/cleanup-guild-scope-commands.js` thủ công

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Middleware 500 mọi route | Low | High | Local test + fail-open |
| FE switcher race | Low | Med | `ensureGuildReady()` đã fix |
| Slash vanish guild A | Low | High | Parallel guild-scope 24h |
| DB corrupt | Very low | Critical | Backup trước cook |
| Bot crash guild B | Low | Low | Bot đa guild ready, test sau |
| Auto-push prod khi đang dev | Med | High | Override rule, manual push |

## Rollback Plan
1. `git revert <merge-commit>` → push → Railway redeploy
2. DB không cần restore (không đổi schema)
3. Bot restart ~30s
4. Tổng thời gian khôi phục: ~3-5 phút

## Success Criteria
- 0 downtime perceptible guild A trong cook + deploy
- Smoke test pass 7/8
- 0 user complain trong 24h sau deploy
- Phase 4 verify guild B sau khi prod ổn

## Next
→ Update plan thêm Phase 0 + override auto-commit rule

## Unresolved
- Railway snapshot có UI dễ trigger không hay phải dùng CLI?
- Có cần notify users Discord guild A trước deploy hay deploy âm thầm?
