FROM node:22-slim

WORKDIR /app

RUN npm install -g pnpm@9

# Copy workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY tsconfig.json tsconfig.base.json ./

# Copy all source
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts 2>/dev/null || true

# Install deps
RUN pnpm install --no-frozen-lockfile

# Build frontend then backend
RUN NODE_ENV=production BASE_PATH=/ pnpm --filter estate-agent build
RUN pnpm --filter api-server build

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
