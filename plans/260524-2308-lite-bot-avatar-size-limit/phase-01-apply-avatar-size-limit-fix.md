---
phase: 1
title: Apply avatar size limit fix
status: completed
priority: P2
effort: 20m
dependencies: []
---

# Phase 1: Nâng giới hạn avatar lite bot lên 1MB + báo lỗi rõ

## Overview

Nâng giới hạn multer cho upload avatar lite bot từ 256KB lên 1MB. Thêm message lỗi tiếng Việt rõ ràng phía server. Thêm validate client-side trước khi gọi API để tránh round-trip vô ích và hiện size thực tế cho user.

## Requirements

**Functional:**
- Ảnh ≤ 1MB: upload thành công như cũ (no regression)
- Ảnh > 1MB:
  - Client phát hiện trước khi gửi → hiện toast đỏ tiếng Việt + size thực tế
  - Nếu bypass client (gọi API trực tiếp): server trả 400 + message tiếng Việt rõ
- UI label trong modal lite bot phản ánh đúng "1MB" thay vì số cũ (nếu có)

**Non-functional:**
- KHÔNG thêm dep mới (`sharp`, image-processing lib)
- KHÔNG đụng tới logic `discord.js setAvatar()` ở `bots-lite/lite-client.js`
- KHÔNG đụng tới DB schema, encryption layer, route khác
- Giữ pattern hằng số dùng chung giữa server và client (`MAX_AVATAR_SIZE = 1MB`)

## Architecture

**Flow hiện tại:**
```
[user chọn file] → FormData → POST /api/managed-bots/:id/avatar
  → multer (limit 256KB) → reject nếu > 256KB → error handler trả {error: "File too large"}
  → frontend api() → up.error có giá trị → flash "Avatar lỗi: File too large"
```

**Flow sau fix:**
```
[user chọn file]
  → [NEW] client-side size check:
      file.size > 1MB → flash "Ảnh {X}MB vượt giới hạn 1MB..." → STOP
  → FormData → POST /api/managed-bots/:id/avatar
  → multer (limit 1MB) → nếu > 1MB → [NEW] error handler nhận code LIMIT_FILE_SIZE
      → trả {error: "Ảnh vượt giới hạn 1MB. Vui lòng nén hoặc resize ảnh trước khi tải lên."}
  → frontend hiện toast với message tiếng Việt
```

## Related Code Files

**Modify:**
- `dashboard/routes/managed-bots.js` — đổi `fileSize` limit + sửa error handler nhận `LIMIT_FILE_SIZE`
- `dashboard/public/js/app.js` — thêm size check trước `FormData` trong hàm save của managedBotsSection
- `dashboard/public/index.html` — đồng bộ label "max XKB" thành "max 1MB" trong form modal lite bot (nếu có hardcode)

**Create:** không có

**Delete:** không có

## Implementation Steps

### Bước 1 — Server: nâng limit + error handler tiếng Việt
File: `dashboard/routes/managed-bots.js`

1. Thêm hằng số `MAX_AVATAR_SIZE` ở đầu file (sau `const router = ...`):
   ```js
   const MAX_AVATAR_SIZE = 1 * 1024 * 1024 // 1MB
   ```
2. Sửa `limits.fileSize` trong multer config (dòng ~27):
   ```js
   limits: { fileSize: MAX_AVATAR_SIZE },
   ```
3. Sửa multer error handler (dòng ~180) để bắt riêng `LIMIT_FILE_SIZE`:
   ```js
   router.use((err, req, res, next) => {
     if (err?.code === 'LIMIT_FILE_SIZE') {
       return res.status(400).json({
         error: 'Ảnh vượt giới hạn 1MB. Vui lòng nén hoặc resize ảnh trước khi tải lên.'
       })
     }
     if (err) return res.status(400).json({ error: err.message })
     next()
   })
   ```

### Bước 2 — Client: validate trước khi upload
File: `dashboard/public/js/app.js`, trong hàm `save()` của `managedBotsSection` (khu vực dòng ~1846).

Trước block `if (this.avatarFile && bot?.id) { ... }`, hoặc ngay đầu block đó, thêm:
```js
if (this.avatarFile && bot?.id) {
  if (this.avatarFile.size > 1024 * 1024) {
    const mb = (this.avatarFile.size / 1024 / 1024).toFixed(2)
    this.flash(`Ảnh ${mb}MB vượt giới hạn 1MB. Vui lòng nén hoặc resize ảnh trước khi tải lên.`, false)
    return
  }
  const fd = new FormData()
  // ... phần cũ giữ nguyên
}
```

Lưu ý: nếu logic save có set `this.saving = true` ở trên thì cần reset `this.saving = false` trong nhánh sớm này (hoặc dựa vào `finally` block đã có). Đọc lại 5 dòng quanh đó để confirm.

### Bước 3 — Sync UI label
File: `dashboard/public/index.html`

Tìm phần form modal của tab `managed-bots` (khu vực `x-show="tab === 'managed-bots'"`, dòng ~2125). Nếu label upload avatar có ghi "max 256KB" hoặc số cũ → đổi thành "max 1MB". Nếu không có hardcode size thì skip bước này.

### Bước 4 — Verify thủ công
1. `npm run dev` hoặc start dashboard server
2. Vào tab "Quản lý bot phụ" → mở modal sửa 1 lite bot
3. Upload ảnh `Morions Atalanta` (300×445 card art) → thành công, avatar đổi ngay
4. Upload ảnh ≥ 1.5MB → toast đỏ tiếng Việt hiện ngay, không có request POST `/avatar` nào trong Network tab
5. Dùng cURL/Postman gửi file > 1MB trực tiếp → response 400 + body `{error: "Ảnh vượt giới hạn 1MB..."}`

## Success Criteria

- [ ] `dashboard/routes/managed-bots.js`: hằng số `MAX_AVATAR_SIZE = 1MB` được dùng cho multer limit
- [ ] Multer error handler nhận diện `LIMIT_FILE_SIZE` và trả message tiếng Việt cụ thể
- [ ] `dashboard/public/js/app.js`: client-side size check chặn upload > 1MB trước khi gọi API, flash toast hiện size thực tế (đơn vị MB, 2 chữ số thập phân)
- [ ] Label UI trong form lite bot (nếu có hardcode size) sync với "1MB"
- [ ] Manual test 5 step ở bước 4 đều pass
- [ ] Không có regression: upload ảnh < 1MB vẫn chạy, Discord avatar thay đổi thực tế
- [ ] Không có file `sharp` hoặc image-processing lib mới trong `package.json`

## Risk Assessment

| Rủi ro | Mức | Mitigation |
|---|---|---|
| Ảnh > 1MB nhưng < 10MB (Discord ceiling) bị chặn dù về kỹ thuật Discord vẫn nhận | Thấp | User chấp nhận trade-off: 1MB đủ cho 99% avatar use case; nếu sau này thực sự cần lớn hơn thì raise thêm |
| Client check bypass được nếu user disable JS | Thấp | Server check vẫn còn (multer + error handler), không có lỗ hổng |
| Message tiếng Việt có dấu encode lỗi nếu response không UTF-8 | Rất thấp | Express mặc định Content-Type JSON UTF-8; đã có precedent trong các route khác trả tiếng Việt |
| `this.saving = true` không reset đúng khi early-return ở client check | Thấp | Đọc lại code save() để confirm có `finally` block reset hoặc thêm reset thủ công |
| Race condition: user chọn file > 1MB rồi đổi nhỏ trước khi submit | Không | `this.avatarFile.size` đọc snapshot mỗi lần submit, không cache |

## Security Considerations

- Không mở rộng attack surface: 1MB vẫn an toàn trước DoS (gấp 4 lần limit cũ nhưng vẫn nhỏ so với 8MB/10MB recommend từ industry)
- Không bypass authentication/authorization: route avatar vẫn nằm sau middleware auth chung của dashboard
- Multer disk storage vẫn lưu vào `uploads/managed-bots/` với UUID filename → không có path traversal risk
- File type whitelist (JPEG/PNG/GIF/WEBP) không đổi → không mở thêm format nguy hiểm

## Out of Scope

- Tự động resize/compress ảnh phía server (sharp) — KISS, để user tự xử lý
- Crop avatar về vuông trước khi gửi Discord — Discord tự crop tròn khi hiển thị
- Rate limit upload — YAGNI, dashboard đã có middleware auth giới hạn user nội bộ
- Preview ảnh trong modal trước khi upload — UX bonus, plan riêng nếu cần
- Đổi limit cho các upload khác trong dashboard (image của reward, post...) — không liên quan task này
