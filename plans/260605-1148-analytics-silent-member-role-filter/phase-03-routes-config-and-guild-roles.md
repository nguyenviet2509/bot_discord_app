# Phase 03 — Routes (Config + Guild Roles)

**Status:** pending
**Priority:** medium
**Effort:** S
**Depends on:** Phase 01, 02

## Goal

Expose REST endpoints để UI đọc/ghi filter config và lấy danh sách role guild.

## Files

**Modify:**
- `dashboard/routes/analytics.js`

## Steps

1. Endpoint GET config:
   ```js
   router.get('/silent-filter-config', (req, res) => {
     res.json(db.getSilentFilterConfig(GUILD_ID()))
   })
   ```

2. Helper fetch guild roles (cache in-memory 60s để giảm rate limit):
   ```js
   let rolesCache = { at: 0, data: null }
   async function fetchGuildRoles() {
     if (Date.now() - rolesCache.at < 60_000 && rolesCache.data) return rolesCache.data
     const r = await fetch(`https://discord.com/api/v10/guilds/${GUILD_ID()}/roles`, {
       headers: { 'Authorization': `Bot ${process.env.BOT_TOKEN}` },
     })
     if (!r.ok) throw new Error(`Discord API ${r.status}`)
     const roles = await r.json()
     rolesCache = { at: Date.now(), data: roles }
     return roles
   }
   ```

3. Endpoint GET guild roles:
   ```js
   router.get('/guild-roles', async (req, res) => {
     try {
       const roles = await fetchGuildRoles()
       res.json(roles.map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
         .sort((a, b) => b.position - a.position))
     } catch (err) {
       res.status(500).json({ error: err.message })
     }
   })
   ```

4. Endpoint PUT config + auto re-scan:
   ```js
   router.put('/silent-filter-config', async (req, res) => {
     try {
       const { include_role_id, exclude_role_id } = req.body || {}
       const normInclude = include_role_id ? String(include_role_id) : null
       const normExclude = exclude_role_id ? String(exclude_role_id) : null

       // Validate role tồn tại (warn only, không fail)
       const warnings = []
       if (normInclude || normExclude) {
         const roles = await fetchGuildRoles().catch(() => null)
         if (roles) {
           const ids = new Set(roles.map(r => r.id))
           if (normInclude && !ids.has(normInclude)) warnings.push(`include role ${normInclude} không tồn tại`)
           if (normExclude && !ids.has(normExclude)) warnings.push(`exclude role ${normExclude} không tồn tại`)
         }
       }

       db.setSilentFilterConfig(GUILD_ID(), { includeRoleId: normInclude, excludeRoleId: normExclude })
       const scan = await scanSilentMembers(GUILD_ID())
       res.json({
         success: true,
         config: db.getSilentFilterConfig(GUILD_ID()),
         scan,
         warnings,
       })
     } catch (err) {
       res.status(500).json({ error: err.message })
     }
   })
   ```

5. Đảm bảo `scanSilentMembers` đã import (line 3 đã có).

## Checklist

- [ ] GET config trả `{ include_role_id, exclude_role_id }`
- [ ] GET guild-roles trả array sort theo position desc
- [ ] PUT config validate, lưu DB, trigger scan, trả combined response
- [ ] Test bằng `curl` 3 endpoint

## Risks

- Discord API rate limit roles endpoint → cache 60s đủ.
- PUT trùng nhau gây race → scope phase 04 disable button client-side.
