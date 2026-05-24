---
phase: 3
title: "Renderer & Handler"
status: pending
priority: P1
effort: "3h"
dependencies: [2]
---

# Phase 3: Renderer & Handler

## Overview

Build embed + button renderer (với debounce edit), button handler routing `mg:roll:*` → lifecycle.

## Requirements

**Functional:**
- Embed pending: title, host, expires (relative time), live count `X/MAX`, danh sách participants (mention)
- 3 button: Tham gia/Rời khỏi (toggle theo `isParticipant`), Bắt đầu roll, Hủy
- Embed result: winner top 1 (👑 + ping), ranking đầy đủ (🥇🥈🥉 cho top 3)
- Embed cancel: lý do, list participants không score
- Debounce edit 1s (Map<sessionId, Timeout>), bypass khi state change

**Non-functional:**
- File < 200 dòng
- Catch error khi edit message (message bị xóa thủ công)

## Architecture

```
roll-renderer.js
  ├─ buildPendingEmbed({ session, participants, hostTag })
  ├─ buildPendingButtons(sessionId, isParticipant) -- nhãn nút Join/Leave theo state user
  ├─ buildResultEmbed({ session, rankedParticipants })
  ├─ buildCancelEmbed({ session, participants, reason })
  ├─ scheduleEdit(sessionId, editFn) -- debounce 1s coalesce
  ├─ editNow(sessionId, editFn) -- bypass debounce + clear pending timer
  └─ Map<sessionId, Timeout> editTimers

roll-button-handler.js
  ├─ customId format: mg:roll:<action>:<sessionId>
  ├─ action: join | start | cancel
  └─ route → lifecycle.onJoin/onStart/onCancel
```

## Related Code Files

- **Create:**
  - `bot/src/modules/mini-game/services/roll-renderer.js`
  - `bot/src/modules/mini-game/handlers/roll-button-handler.js`
- **Reference:**
  - `bot/src/modules/mini-game/services/rps-renderer.js`
  - `bot/src/modules/mini-game/handlers/rps-button-handler.js`

## Implementation Steps

### 3.1. `roll-renderer.js`

```js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js')

const COLOR = { wait: 0x6366f1, win: 0x22c55e, cancel: 0x4e5058 }
const editTimers = new Map()
const DEBOUNCE_MS = 1000

function buildPendingEmbed({ session, participants, hostTag }) {
  const list = participants.length
    ? participants.map((p, i) => `${i + 1}. <@${p.user_id}>`).join('\n')
    : '_Chưa có ai tham gia_'
  return new EmbedBuilder()
    .setColor(COLOR.wait)
    .setTitle(`🎲 ROLL Session #${session.id}`)
    .setDescription(`Host: <@${session.host_id}>\n⏱ Hết hạn: <t:${session.expires_at}:R>`)
    .addFields(
      { name: `👥 Tham gia (${participants.length}/${session.max_players})`, value: list },
    )
    .setFooter({ text: `Pool điểm: 1-${session.score_max} · Không trùng` })
}

function buildPendingButtons(sessionId, joined) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg:roll:join:${sessionId}`)
      .setLabel(joined ? 'Rời khỏi' : 'Tham gia')
      .setEmoji(joined ? '🚪' : '🎯')
      .setStyle(joined ? ButtonStyle.Secondary : ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`mg:roll:start:${sessionId}`)
      .setLabel('Bắt đầu roll')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`mg:roll:cancel:${sessionId}`)
      .setLabel('Hủy')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
  )
}

function buildResultEmbed({ session, rankedParticipants }) {
  const medals = ['🥇', '🥈', '🥉']
  const list = rankedParticipants.map((p, i) => {
    const prefix = medals[i] ?? `${i + 1}.`
    return `${prefix} <@${p.user_id}> — **${p.score}**`
  }).join('\n')
  const winner = rankedParticipants[0]
  return new EmbedBuilder()
    .setColor(COLOR.win)
    .setTitle(`🏆 ROLL Session #${session.id} — Vinh danh`)
    .setDescription(`👑 Winner: <@${winner.user_id}> • 💯 **${winner.score} điểm**`)
    .addFields({ name: '📊 Bảng xếp hạng', value: list })
    .setFooter({ text: `Đã hoàn tất • ${rankedParticipants.length} người tham gia` })
}

function buildCancelEmbed({ session, participants, reason }) {
  return new EmbedBuilder()
    .setColor(COLOR.cancel)
    .setTitle(`❌ ROLL Session #${session.id} — Hủy`)
    .setDescription(reason || 'Không rõ lý do')
    .setFooter({ text: `${participants.length} người đã đăng ký` })
}

// Debounce edit message (chống spam khi nhiều người join cùng lúc).
function scheduleEdit(sessionId, editFn) {
  if (editTimers.has(sessionId)) clearTimeout(editTimers.get(sessionId))
  editTimers.set(sessionId, setTimeout(async () => {
    editTimers.delete(sessionId)
    try { await editFn() } catch (err) { console.error('[roll:edit]', err) }
  }, DEBOUNCE_MS))
}

// Bypass debounce, clear pending timer, edit ngay (dùng cho state change).
async function editNow(sessionId, editFn) {
  if (editTimers.has(sessionId)) { clearTimeout(editTimers.get(sessionId)); editTimers.delete(sessionId) }
  try { await editFn() } catch (err) { console.error('[roll:editNow]', err) }
}

module.exports = {
  buildPendingEmbed, buildPendingButtons,
  buildResultEmbed, buildCancelEmbed,
  scheduleEdit, editNow,
}
```

### 3.2. `roll-button-handler.js`

```js
const lifecycle = require('../services/roll-lifecycle')

async function handle(interaction) {
  const id = interaction.customId
  if (!id.startsWith('mg:roll:')) return false
  const parts = id.split(':')
  const action = parts[2]
  const sessionId = parseInt(parts[3], 10)
  if (!sessionId) return interaction.reply({ content: 'Session id không hợp lệ.', ephemeral: true }).then(() => true)

  try {
    if (action === 'join')   { await lifecycle.onJoin(interaction, sessionId);   return true }
    if (action === 'start')  { await lifecycle.onStart(interaction, sessionId);  return true }
    if (action === 'cancel') { await lifecycle.onCancel(interaction, sessionId); return true }
  } catch (err) {
    console.error('[mg:roll:button]', err)
    const msg = { content: '❌ Lỗi xử lý nút bấm.', ephemeral: true }
    if (interaction.replied || interaction.deferred) await interaction.followUp(msg).catch(() => {})
    else await interaction.reply(msg).catch(() => {})
    return true
  }
  return false
}

module.exports = { handle }
```

### 3.3. Tích hợp debounce vào lifecycle

`onJoin` gọi `renderer.scheduleEdit(sessionId, () => editPendingMessage(client, sessionId))`
`onStart` / `onCancel` gọi `renderer.editNow(...)` để edit ngay.

`editPendingMessage` helper: fetch channel + message từ DB → edit với embed mới + button toggle.

### 3.4. Compile check

```bash
node -e "require('./bot/src/modules/mini-game/services/roll-renderer.js')"
node -e "require('./bot/src/modules/mini-game/handlers/roll-button-handler.js')"
```

## Success Criteria

- [ ] Embed pending hiển thị đúng host, expires relative, count + list participants
- [ ] Button toggle nhãn đúng theo state user (`isParticipant`)
- [ ] Debounce: 10 người join trong 100ms → chỉ 1 lần edit message sau 1s
- [ ] State change (start/cancel) edit ngay, không bị block bởi timer pending
- [ ] Embed result list rank đúng (sorted desc) + top 1 ping + huy chương
- [ ] Edit error (message bị xóa) được catch, không crash bot

## Risk Assessment

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Discord ratelimit edit message | Medium | Debounce 1s đã giải quyết |
| Message bị xóa thủ công giữa session | Low | Try/catch khi fetch + edit, log nhẹ |
| Embed quá dài (100 user × 30 char/line ≈ 3000 char) | Low | Discord limit 4096 char/field — vẫn fit. Nếu vượt thì truncate `... và N người khác` |
