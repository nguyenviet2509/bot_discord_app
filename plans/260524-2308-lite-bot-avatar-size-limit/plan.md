---
title: Nâng giới hạn avatar lite bot lên 1MB + báo lỗi rõ
description: >-
  Multer reject avatar > 256KB không hiện message rõ → user không biết vì sao
  ảnh không load. Nâng lên 1MB, thêm validate client-side, message tiếng Việt rõ
  ràng.
status: completed
priority: P2
branch: master
tags:
  - dashboard
  - managed-bots
  - avatar
  - ux
blockedBy: []
blocks: []
created: '2026-05-24T16:08:17.075Z'
createdBy: 'ck:plan'
source: skill
---

# Nâng giới hạn avatar lite bot lên 1MB + báo lỗi rõ

## Overview

Sửa giới hạn upload avatar cho lite bot: 256KB → 1MB. Khi user upload ảnh vượt 1MB, hiện thông báo tiếng Việt rõ ràng kèm size thực tế thay vì im lặng / message tiếng Anh chung chung.

Trigger: card art 300×445 (Morions Atalanta) ~400-800KB vượt limit 256KB cũ → multer reject → UI không hiện lỗi rõ → user tưởng "không load được".

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Apply avatar size limit fix](./phase-01-apply-avatar-size-limit-fix.md) | Completed |

## Dependencies

Không có cross-plan dependency. Plan độc lập với `260524-1607-multi-lite-bots` (plan tạo ra hệ thống multi lite bot, plan này là tinh chỉnh nhỏ sau khi feature đã chạy).

## Brainstorm Context

Brainstorm gốc: phiên hội thoại trực tiếp trước plan này. Người dùng yêu cầu ban đầu 512MB → AI phản biện về DoS + ceiling Discord → người dùng confirm gõ nhầm, đổi thành **1MB**. Design được approve trước khi vào plan.
