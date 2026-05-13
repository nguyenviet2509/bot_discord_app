# Deploy Discord Bot + Dashboard lên Railway

**Status:** In Progress
**Date:** 2026-05-13

## Mục tiêu
Deploy app (Discord bot + Express dashboard + SQLite + uploads) lên Railway, thay thế Vercel (Vercel không hỗ trợ long-running process + persistent disk).

## Kiến trúc
- **1 Railway service** chạy từ repo (Nixpacks builder).
- **1 process** dùng `concurrently` chạy song song:
  - `bot` (Discord.js client, kết nối WebSocket liên tục)
  - `dashboard` (Express, listen `process.env.PORT`)
- **1 Volume** mount `/data`: chứa `database.sqlite` (WAL) + `uploads/`.
- Env `DATA_DIR=/data` để code biết đường ghi.

## Changes
1. `package.json` (root): thêm `concurrently`, script `start`.
2. `shared/db.js`: DB path đọc từ `DATA_DIR`.
3. `dashboard/server.js`: `PORT` từ env, uploads dir từ `DATA_DIR`, CORS theo `BASE_URL`.
4. `dashboard/routes/rewards.js`: `UPLOADS_DIR` từ `DATA_DIR`.
5. `railway.json`: build NIXPACKS, start `npm start`, restart on failure.
6. `.dockerignore`: tránh upload local DB/uploads.
7. `.env.example`: thêm `DATA_DIR`, hướng dẫn Railway.
8. `docs/deployment-guide.md`: hướng dẫn step-by-step deploy.

## Deploy steps cho user
1. Push code lên GitHub.
2. Railway → New Project → Deploy from GitHub.
3. Add Volume mount `/data`.
4. Set env vars (BOT_TOKEN, CLIENT_ID, GUILD_ID, …, `DATA_DIR=/data`).
5. Sau lần deploy đầu, mở Railway shell: `npm run deploy:commands` (đăng ký slash commands).
6. `BASE_URL` set sang public URL Railway cấp.

## Risks
- `better-sqlite3` native module: Nixpacks tự build OK (có prebuilds).
- Volume per-service: phải gộp bot+dashboard 1 service. Nếu sau này tách → migrate Postgres.
- Nếu bot crash, `concurrently -k` kill cả dashboard → Railway restart.
