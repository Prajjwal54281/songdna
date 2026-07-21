FROM node:20-slim AS build
WORKDIR /app
# NEXT_PUBLIC_* vars are baked into the JS bundle at build time, not read at
# runtime. Must be passed as a build arg, not just a runtime env var. Render
# passes Docker-runtime services' configured env vars through as build args
# automatically; other platforms may need --build-arg explicitly.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
