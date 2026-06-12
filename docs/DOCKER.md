# Docker & docker-compose

Roadmap **1.10** (issue #24). Containerizes all three services so the stack can
run identically on any host. The current production VPS still uses PM2 + nginx
(see [DEPLOYMENT.md](DEPLOYMENT.md)); this is the migration path, not yet the
live setup.

## Services

| Service | Image base | Port | Notes |
|---------|-----------|------|-------|
| `backend` | `node:20-alpine` (multi-stage, prod deps only) | 3000 | NestJS API; healthcheck hits `/api/health`; runs as non-root |
| `frontend` | build on `node:20-alpine` → serve on `nginx:alpine` | 80 | Static Vite build; `VITE_API_URL` baked at **build time** |
| `automation` | `mcr.microsoft.com/playwright:v1.44.0-jammy` | 3001 | Playwright + Chrome; Xvfb for visible-window login; internal-only |

## Files
- `docker-compose.yml` — local/dev (builds images locally).
- `docker-compose.override.yml` — auto-merged in dev; exposes automation `3001` on the host for debugging.
- `docker-compose.prod.yml` — production; pulls pre-built images from GHCR.
- `<service>/Dockerfile` + `<service>/.dockerignore`.

## Local development

```bash
# from repo root — create the per-service .env files first (see .env.example)
VITE_API_URL=http://localhost:3000/api docker compose up --build
```

- Frontend → http://localhost:5173  · Backend → http://localhost:3000/api/health
- The automation worker is only reachable inside the Docker network (and on
  `localhost:3001` via the dev override).

### Why `VITE_API_URL` is a build arg, not a runtime env
Vite **inlines** `VITE_*` variables into the static bundle at build time. A
runtime `env_file` cannot change an already-built bundle, so the frontend takes
`VITE_API_URL` as a Docker **build arg** (wired through compose `build.args`).
Set it to your real API origin when building the production image.

## Production (`docker-compose.prod.yml`)

Pulls images from GHCR instead of building on the host. Requires:

```bash
export GHCR_OWNER=<your-github-org-or-user>
# host env files (NOT committed):
#   /opt/anzeigenboost/.env.backend
#   /opt/anzeigenboost/.env.automation
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

- `frontend` (nginx) terminates TLS on 80/443 and serves the ACME challenge from
  the shared `certbot-www` volume; the `certbot` service renews every 12h.
- `backend` is internal-only (`expose: 3000`); nginx proxies `/api` to it.
- Build/push the images in CI (GH Actions) → `ghcr.io/$GHCR_OWNER/anzeigenboost-{backend,frontend,automation}:latest`.

## Security
- `.dockerignore` in each service excludes `node_modules`, `.env*`, `dist`, and
  **all service-account JSON** — secrets are never copied into an image layer.
- The backend runs as the non-root `node` user.
- Provide Firebase credentials at runtime via env (`GOOGLE_APPLICATION_CREDENTIALS`
  pointing at a mounted file, or the JSON in an env var) — never bake them in.

## Status / next steps
- ✅ Dockerfiles + compose for all three services, healthchecks, prod parametrized.
- ⏳ CI workflow to build & push images to GHCR (not yet wired — current CI deploys via SSH/PM2).
- ⏳ Cut the VPS over from PM2 to `docker-compose.prod.yml` (do this together with the domain/HTTPS work, roadmap 1.2).
