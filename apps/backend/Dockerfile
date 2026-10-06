FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/backend/tsconfig.json ./apps/backend/
COPY tsconfig.base.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/types/tsconfig.json ./packages/types/

RUN npm install --ignore-scripts

COPY apps/backend/src ./apps/backend/src
COPY packages/types/src ./packages/types/src

RUN npx tsc --project apps/backend/tsconfig.json

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/backend/data ./data

ENV NODE_ENV=production
ENV DATABASE_PATH=data/farm.db

EXPOSE 3001
CMD ["node", "dist/server.js"]
