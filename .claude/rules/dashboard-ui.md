# Dashboard UI Rules

**BẮT BUỘC** khi implement / chỉnh sửa bất kỳ file nào trong:
- `dashboard/public/**/*.html`
- `dashboard/public/js/**/*.js`
- Thêm tab mới trong `dashboard/public/index.html`

→ **TRƯỚC** khi viết code, load skill: `.claude/skills/dashboard-layout/SKILL.md`

Skill này định nghĩa:
- CSS classes chuẩn (`.card`, `.input-field`, `.btn-primary`, `.btn-refresh`)
- Color palette (indigo/slate)
- Sticky header pattern + content container
- API helper với JWT auth + 401 redirect
- Template HTML standalone + SPA tab + sidebar nav-item
- Checklist + anti-patterns

Không skip kể cả với tác vụ "nhỏ" — sự không nhất quán visual tích lũy nhanh.
