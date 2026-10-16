FROM node:20-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile
COPY server server
COPY docs/knowledge /app/docs/knowledge
ENV KNOWLEDGE_DIRECTORY=/app/docs/knowledge
RUN pnpm --filter server build
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node", "server/dist/src/server.js"]
