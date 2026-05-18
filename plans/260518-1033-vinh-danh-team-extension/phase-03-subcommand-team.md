# Phase 3 — Refactor /vinhdanh → Subcommand + Add Team

**Priority:** P0
**Effort:** M (~1.5h)
**Depends on:** Phase 1, 2

## Refactor `bot/src/commands/vinh-danh.js`

### Slash data — đổi sang subcommand
```js
new SlashCommandBuilder()
  .setName('vinhdanh')
  .setDescription('Vinh danh thành viên xuất sắc')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub => sub
    .setName('ca-nhan')
    .setDescription('Vinh danh Top 3 cá nhân (Champion Spotlight)')
    .addUserOption(...user1, user2, user3, required)
    .addAttachmentOption(...banner, required)
    .addChannelOption(...channel, optional))
  .addSubcommand(sub => sub
    .setName('team')
    .setDescription('Vinh danh team (1-10 thành viên)')
    .addUserOption(o => o.setName('user1').setRequired(true))
    .addUserOption(o => o.setName('user2'))
    // ...user3..user10 optional
    .addAttachmentOption(...banner, required)
    .addChannelOption(...channel, optional))
```

### execute() dispatch theo subcommand
```js
async function execute(interaction) {
  const sub = interaction.options.getSubcommand()
  if (sub === 'ca-nhan') return executeCaNhan(interaction)
  if (sub === 'team') return executeTeam(interaction)
}
```

- `executeCaNhan(interaction)` = body cũ của `execute`
- `executeTeam(interaction)`:
  - Permission check (giống ca-nhan)
  - Lấy user1..user10 (filter null), dedupe, validate ≥ 1 (cho phép 1-10)
  - Validate banner image
  - Lưu pending: `{memberIds: [...], bannerUrl, targetChannelId}`
  - Show modal customId `honor:modal:team:<nonce>` với 3 input: title, teamName, reason

### Modal handler dispatch
- `interaction-create.js` đã route `honor:modal:*` → `vinh-danh.handleModalSubmit`
- Trong `handleModalSubmit`: parse customId thứ 2 (`top3` hoặc `team`) → gọi đúng handler
- Sửa customId hiện tại: `honor:modal:<nonce>` → `honor:modal:top3:<nonce>` (rõ ràng hơn)

```js
async function handleModalSubmit(interaction) {
  const parts = interaction.customId.split(':') // honor:modal:<type>:<nonce>
  const type = parts[2]
  const nonce = parts[3]
  if (type === 'top3') return handleTop3Submit(interaction, nonce)
  if (type === 'team') return handleTeamSubmit(interaction, nonce)
}
```

### Pending cache key
- ca-nhan: `${nonce}:${guildId}:top3`
- team: `${nonce}:${guildId}:team`
- Sửa `honor-service.setPending` không đổi, chỉ thay key string ở caller

### handleTeamSubmit
- Lấy fields: title, teamName, reason
- Fetch tất cả user objects parallel, lấy display name
- Build payload qua `buildHonorTeamEmbed`
- `publishHonorTeam` qua honor-service:
  - `channel.send(payload)`
  - `insertHonorTeamRecord({...member_ids: JSON.stringify(ids)})`
  - `updateHonorTeamMessageId(id, msg.id)`
  - Auto-react 🎉 👏

## Files modify
- `bot/src/commands/vinh-danh.js` — refactor + thêm team
- `bot/src/services/honor-service.js` — thêm `publishHonorTeam`

## Todo
- [ ] Restructure data thành 2 subcommand
- [ ] Tách executeCaNhan, executeTeam
- [ ] Đổi customId modal sang `honor:modal:<type>:<nonce>`
- [ ] Tách handleTop3Submit + handleTeamSubmit
- [ ] publishHonorTeam trong service
- [ ] Test live: /vinhdanh ca-nhan (giữ nguyên hành vi), /vinhdanh team với 1, 5, 10 member

## Success criteria
- `/vinhdanh ca-nhan ...` y hệt như cũ
- `/vinhdanh team user1:@a user2:@b ... banner:[img]` → modal → submit → embed Team Roster
- Modal team 3 inputs (title, teamName, reason)
- DB record xuất hiện trong `honor_team_history`
