FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/api ./api
COPY --from=build /app/js ./js
COPY --from=build /app/lib ./lib
COPY --from=build /app/scripts/public-server.mjs ./scripts/public-server.mjs
USER node
CMD ["node", "scripts/public-server.mjs"]
