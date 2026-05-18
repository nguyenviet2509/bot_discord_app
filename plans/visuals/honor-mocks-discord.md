# 5 Mock Embed JSON — Paste vào discohook.org để xem render chính xác

**Cách dùng:**
1. Mở https://discohook.org/
2. Click **JSON Data Editor** (góc trên phải)
3. Paste từng JSON dưới đây để xem mock render đúng 100% như Discord thật

> Color gold = `16766720` (= `0xFFD700`)
> Image URLs dùng placeholder — khi triển khai thực sẽ thay bằng attachment admin upload + avatar Discord user.

---

## Mock 1 — Classic Vertical

```json
{
  "embeds": [
    {
      "author": {
        "name": "Bellatra Clan • Vinh danh",
        "icon_url": "https://cdn.discordapp.com/embed/avatars/0.png"
      },
      "title": "🏛️ BẢNG VÀNG THÁNG 5/2026",
      "description": "✧ ✦ ✧  **HALL OF FAME**  ✧ ✦ ✧\n\n🥇 **ChampionName**\n┝━ *Đóng góp xuất sắc nhất cộng đồng*\n\n🥈 **RunnerUpName**\n┝━ *Dẫn dắt mini-game cả tháng*\n\n🥉 **ThirdPlaceName**\n┝━ *Hỗ trợ newbie tận tâm*",
      "color": 16766720,
      "thumbnail": {
        "url": "https://i.pravatar.cc/256?img=12"
      },
      "image": {
        "url": "https://picsum.photos/seed/hof1/1200/400"
      },
      "footer": {
        "text": "✦ Vinh danh bởi Bellatra Clan ✦"
      },
      "timestamp": "2026-05-18T03:00:00.000Z"
    }
  ]
}
```

---

## Mock 2 — Fields nhiều dòng + emoji huy chương

```json
{
  "embeds": [
    {
      "title": "🏆 BẢNG VÀNG THÁNG 5/2026",
      "description": "*Vinh danh 3 thành viên đóng góp xuất sắc nhất cho cộng đồng*",
      "color": 16766720,
      "thumbnail": {
        "url": "https://i.pravatar.cc/256?img=12"
      },
      "fields": [
        {
          "name": "🥇 QUÁN QUÂN",
          "value": "**ChampionName**\n> Đóng góp xuất sắc nhất cộng đồng — dẫn dắt bảng XP",
          "inline": false
        },
        {
          "name": "🥈 Á QUÂN",
          "value": "**RunnerUpName**\n> Dẫn dắt mini-game cả tháng",
          "inline": false
        },
        {
          "name": "🥉 HẠNG BA",
          "value": "**ThirdPlaceName**\n> Hỗ trợ newbie tận tâm",
          "inline": false
        }
      ],
      "image": {
        "url": "https://picsum.photos/seed/hof2/1200/400"
      },
      "footer": {
        "text": "Bellatra Clan • Hall of Fame"
      },
      "timestamp": "2026-05-18T03:00:00.000Z"
    }
  ]
}
```

---

## Mock 3 — Inline 3 cột (Trophy Row)

```json
{
  "embeds": [
    {
      "title": "🏛️ BẢNG VÀNG THÁNG 5/2026",
      "description": "🎉 *Chúc mừng top 3 thành viên xuất sắc nhất!*",
      "color": 16766720,
      "fields": [
        {
          "name": "🥈 Á QUÂN",
          "value": "**RunnerUpName**\n*Dẫn dắt mini-game cả tháng*",
          "inline": true
        },
        {
          "name": "🥇 QUÁN QUÂN",
          "value": "**ChampionName**\n*Đóng góp xuất sắc nhất*",
          "inline": true
        },
        {
          "name": "🥉 HẠNG BA",
          "value": "**ThirdPlaceName**\n*Hỗ trợ newbie tận tâm*",
          "inline": true
        }
      ],
      "image": {
        "url": "https://picsum.photos/seed/hof3/1200/400"
      },
      "footer": {
        "text": "Bellatra Clan • 🎉 👏"
      },
      "timestamp": "2026-05-18T03:00:00.000Z"
    }
  ]
}
```

> **Lưu ý Mock 3:** Discord field inline tự xếp 3 cột ngang chỉ KHI tổng width đủ. Trên mobile sẽ tự rớt thành 1 cột dọc.

---

## Mock 4 — Champion Spotlight (#1 nổi bật bằng author + thumbnail to)

```json
{
  "content": "🎉 Chúc mừng <@111111111111111111> <@222222222222222222> <@333333333333333333> 🎉",
  "embeds": [
    {
      "author": {
        "name": "🥇 QUÁN QUÂN THÁNG 5 — ChampionName",
        "icon_url": "https://i.pravatar.cc/64?img=12"
      },
      "title": "🏛️ BẢNG VÀNG THÁNG 5/2026",
      "description": "> *\"Đóng góp xuất sắc nhất cộng đồng — dẫn dắt bảng XP toàn server\"*",
      "color": 16766720,
      "thumbnail": {
        "url": "https://i.pravatar.cc/256?img=12"
      },
      "fields": [
        {
          "name": "🥈 Á QUÂN",
          "value": "**RunnerUpName**\nDẫn dắt mini-game cả tháng",
          "inline": true
        },
        {
          "name": "🥉 HẠNG BA",
          "value": "**ThirdPlaceName**\nHỗ trợ newbie tận tâm",
          "inline": true
        }
      ],
      "image": {
        "url": "https://picsum.photos/seed/hof4/1200/400"
      },
      "footer": {
        "text": "✦ Vinh danh bởi Bellatra Clan ✦"
      },
      "timestamp": "2026-05-18T03:00:00.000Z"
    }
  ]
}
```

---

## Mock 5 — Royal (sang trọng nhất, full decoration)

```json
{
  "embeds": [
    {
      "author": {
        "name": "✦ ✧ ✦   HALL OF FAME   ✦ ✧ ✦"
      },
      "title": "🏛️ BẢNG VÀNG THÁNG 5/2026",
      "description": "```\n─────────────  ◆  ─────────────\n```\n\n❦  🥇 **QUÁN QUÂN**\n**ChampionName**\n*\"Đóng góp xuất sắc nhất cộng đồng\"*\n\n❦  🥈 **Á QUÂN**\n**RunnerUpName**\n*\"Dẫn dắt mini-game cả tháng\"*\n\n❦  🥉 **HẠNG BA**\n**ThirdPlaceName**\n*\"Hỗ trợ newbie tận tâm\"*\n\n```\n─────────────  ◆  ─────────────\n```",
      "color": 16766720,
      "thumbnail": {
        "url": "https://i.pravatar.cc/256?img=12"
      },
      "image": {
        "url": "https://picsum.photos/seed/hof5/1200/400"
      },
      "footer": {
        "text": "✦ Vinh danh bởi Bellatra Clan ✦ • Trao tặng ngày 18/05/2026"
      },
      "timestamp": "2026-05-18T03:00:00.000Z"
    }
  ]
}
```

---

## Đặc điểm thực tế trên Discord (cần biết khi review)

| Element | Vị trí cố định trên Discord |
|---|---|
| `author` | Trên cùng (icon nhỏ + text) |
| `title` | Dưới author |
| `description` | Dưới title — hỗ trợ markdown đầy đủ |
| `thumbnail` | Góc phải trên (80×80 vuông) |
| `fields` | Giữa, inline=true ghép tối đa 3 cột |
| `image` | Gần cuối, full width banner |
| `footer` | Cuối + timestamp |

**Không thể làm trên Discord embed:**
- Background gradient, padding tuỳ ý
- Border từng field
- Banner ở vị trí khác cuối
- Quote box (`>`) chỉ là markdown text, không có khung
