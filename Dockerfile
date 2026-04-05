FROM node:20-slim

RUN npm install -g pnpm@latest

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json ./

COPY lib/api-zod/ ./lib/api-zod/
COPY lib/db/ ./lib/db/

COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/api-server/tsconfig.json ./artifacts/api-server/
COPY artifacts/api-server/build.mjs ./artifacts/api-server/
COPY artifacts/api-server/src/ ./artifacts/api-server/src/

RUN pnpm install --no-frozen-lockfile

RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
