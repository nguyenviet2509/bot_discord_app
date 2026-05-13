FROM node:20-bookworm-slim

# Build deps cho better-sqlite3 (native module)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy manifest trước để cache layer install
COPY package.json package-lock.json* ./
COPY bot/package.json bot/
COPY dashboard/package.json dashboard/

RUN npm install --workspaces --include-workspace-root --omit=dev

# Copy phần còn lại
COPY . .

# Volume mount point cho Railway
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3001

CMD ["npm", "start"]
