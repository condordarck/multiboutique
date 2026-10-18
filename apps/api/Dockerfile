# Image de l'API. Contexte de build : la racine du dépôt (paquets du monorepo).
#   docker build -f apps/api/Dockerfile -t multiboutique-api .

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Les workspaces doivent exister pour que npm ci accepte le lockfile.
COPY apps ./apps
COPY packages ./packages
# Seulement l'API et les paquets qu'elle importe, pas les fronts ni le monolithe.
RUN npm ci -w @multiboutique/api -w @multiboutique/metier -w @multiboutique/shared \
      --fetch-retries=5 --fetch-retry-mintimeout=2000 --fetch-retry-maxtimeout=60000

# Bundle seul : le typecheck est fait par le CI (npm run typecheck).
FROM deps AS build
RUN cd apps/api && node build.mjs

# Image finale : le bundle seul, sans node_modules ni sources.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 api && adduser --system --uid 1001 --ingroup api api
COPY --from=build --chown=api:api /app/apps/api/dist ./dist
USER api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "--enable-source-maps", "dist/server.mjs"]
