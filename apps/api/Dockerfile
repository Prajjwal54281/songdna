FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
EXPOSE 4000
# Runs migrations (idempotent — tracked in schema_migrations) before starting
# the server. docker-compose also runs a dedicated `migrate` service ahead of
# this as a belt-and-suspenders step; platforms without a pre-deploy-job
# concept (e.g. Render's free tier) rely on this self-migration instead.
CMD ["sh", "-c", "node dist/migrate.js && node dist/index.js"]
