# Deployment Guide — Railway

Hướng dẫn deploy Discord bot + Dashboard lên [Railway](https://railway.app).

## Vì sao Railway (không phải Vercel)?
- Discord bot cần WebSocket **chạy 24/7** → Vercel serverless không hỗ trợ.
- SQLite cần **persistent disk** → Vercel filesystem read-only/ephemeral.
- Railway hỗ trợ long-running process + Volume.

## Kiến trúc
- **1 service** chạy cả bot + dashboard (qua `concurrently`).
- **1 volume** mount `/data` chứa `database.sqlite` + `uploads/`.

## Bước 1 — Push code lên GitHub
```bash
git add .
git commit -m "feat: railway deployment config"
git push
```

## Bước 2 — Tạo Railway project
1. Vào https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Chọn repo `bot_discord_app`.
3. Railway sẽ dùng **Dockerfile** trong repo (đã cấu hình sẵn) để build và chạy `npm start`.

> Nếu Railway tự ép builder **Railpack** (mặc định mới) và fail: vào **Settings → Build → Builder** → chọn **Dockerfile**.

## Bước 3 — Add Volume
1. Trong service → tab **Settings** → **Volumes** → **+ New Volume**.
2. Mount path: `/data`.
3. Save → service tự redeploy.

## Bước 4 — Set Environment Variables
Trong service → tab **Variables**, add:

| Variable | Value |
|---|---|
| `BOT_TOKEN` | Token bot Discord |
| `CLIENT_ID` | Application ID |
| `GUILD_ID` | Server ID |
| `LEVELUP_CHANNEL_ID` | Channel level-up ID |
| `ROLE_DONG` / `ROLE_BAC` / `ROLE_VANG` | Role IDs |
| `DASHBOARD_SECRET` | Chuỗi random ≥32 ký tự |
| `DASHBOARD_USERNAME` | admin |
| `DASHBOARD_PASSWORD` | Mật khẩu mạnh |
| `DATA_DIR` | `/data` |
| `BASE_URL` | URL public Railway cấp (set sau bước 5) |

> `PORT` Railway tự inject, không cần set.

## Bước 5 — Generate public domain
Service → **Settings** → **Networking** → **Generate Domain**.
Copy URL (vd: `https://your-app.up.railway.app`) và set vào `BASE_URL`.

## Bước 6 — Đăng ký slash commands (lần đầu)
Mở Railway Shell (tab **Deployments** → menu service → **Open Shell**):
```bash
npm run deploy:commands
```
Lệnh này chạy `bot/src/deploy-commands.js` để register slash commands lên Discord.

## Bước 7 — Verify
- Vào public URL → dashboard hiện trang login.
- Trong Discord server → gõ `/` xem slash commands có hiện.
- Bot online status trong member list.

## Troubleshooting
- **Bot offline**: check `BOT_TOKEN`, check log Railway xem có lỗi `TOKEN_INVALID`.
- **Dashboard 502**: check log — thường do thiếu env var (DASHBOARD_SECRET < 16 chars).
- **DB mất sau redeploy**: chưa mount volume `/data` hoặc `DATA_DIR` chưa set.
- **Slash commands không hiện**: chưa chạy `npm run deploy:commands`.
- **Upload ảnh lỗi**: check volume mount, check `DATA_DIR` env.
- **Build fail với `railpack process exited with an error`**: Railway dùng Railpack mặc định, nó không hiểu npm workspaces. Fix: vào **Settings → Build → Builder** chọn **Dockerfile** → Redeploy.

## Cost
Railway free tier $5 credit/tháng. App này (1 service nhỏ) chạy ~$3-5/tháng. Nếu muốn miễn phí hẳn → tham khảo Render free tier (sleep sau 15 phút idle, không phù hợp bot).
