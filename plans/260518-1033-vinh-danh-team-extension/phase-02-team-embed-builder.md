# Phase 2 — Team Embed Builder

**Priority:** P0
**Effort:** S (~25 min)
**Depends on:** —

## API

`shared/build-honor-team-embed.js`

```js
/**
 * Build Team Roster embed.
 * @param {Object} p
 * @param {string} p.title
 * @param {string} p.guildName
 * @param {string} [p.guildIconUrl]
 * @param {string} p.teamName
 * @param {string} p.reason
 * @param {string} p.bannerUrl
 * @param {Array<{id, name?}>} p.members  - 1-10 member
 * @returns {{ content, embeds }}
 */
function buildHonorTeamEmbed(p) { ... }
```

## Layout rules
- N <= 5: 1 field "👥 Thành viên" (inline:false), liệt kê dọc
- N 6-10: 2 field inline (cột 1: ceil(N/2), cột 2: floor(N/2))
- Mỗi member dòng `✨ <@id>` (mention) — Discord tự render avatar nhỏ + tên

## Output sample
```json
{
  "content": "🎉 Vinh danh team **{teamName}** — <@u1> <@u2> ... 🎉",
  "embeds": [{
    "author": { "name": "🏛️ {title}" },
    "title": "🎖️ {teamName}",
    "description": "> *\"{reason}\"*",
    "color": 16766720,
    "fields": [...],
    "image": { "url": "<banner>" },
    "footer": { "text": "✦ {N} thành viên · Vinh danh bởi {guildName} ✦" },
    "timestamp": "..."
  }]
}
```

## Validate input
- `members.length >= 1 && members.length <= 10`
- title, teamName, reason: string non-empty
- bannerUrl: string non-empty
- Escape markdown trong reason (reuse `escapeMd` từ build-honor-embed.js — export thêm hoặc inline lại)

## Todo
- [ ] Tạo file, export `buildHonorTeamEmbed`
- [ ] Logic split 1 cột vs 2 cột
- [ ] Reuse escapeMd

## Success criteria
- 1 member → embed có 1 field
- 5 member → 1 field dọc
- 10 member → 2 field inline (5+5)
- 7 member → 2 field inline (4+3)
- Lý do chứa markdown bị escape
