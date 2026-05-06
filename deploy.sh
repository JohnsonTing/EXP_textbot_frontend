#!/bin/bash
set -e

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building frontend + backend..."
NODE_ENV=production BASE_PATH=/ pnpm --filter estate-agent build
pnpm --filter api-server build

echo "==> Restarting app with PM2..."
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "==> Done. App running on port 4000."
