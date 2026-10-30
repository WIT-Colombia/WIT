# Frontend publishing contract

This repository contains four independent Vite/React applications:

| Application | Workspace | Build command | Output | Production API contract |
| --- | --- | --- | --- | --- |
| Landing | `@wit/landing` | `npm run build --workspace=@wit/landing` | `frontend/apps/landing/dist` | Public pages; no private API session |
| Usuario | `@wit/usuario` | `npm run build --workspace=@wit/usuario` | `frontend/apps/usuario/dist` | Same-origin `/api/v1` |
| Business | `@wit/negocios` | `npm run build --workspace=@wit/negocios` | `frontend/apps/negocios/dist` | Same-origin `/api/v1` |
| Admin | `@wit/admin` | `npm run build --workspace=@wit/admin` | `frontend/apps/admin/dist` | Same-origin `/api/v1`; AdminSession cookie only |

Run from `frontend/`:

```sh
npm ci
npm run typecheck
npm run build
```

The Vite proxy variables (`VITE_*_BACKEND_URL`) are development-only. Production builds must route `/api/v1` to the HTTPS API origin through the hosting provider or a same-origin reverse proxy; do not embed credentials or access tokens in Vite variables.

## Cloudflare Pages evaluation

Each app can be a separate Pages project with build command `npm run build --workspace=@wit/<workspace>`, root directory `frontend`, and its corresponding `dist` output. Pages provides HTTPS and SPA fallback when no top-level `404.html` is present. Custom domains still require DNS authorization at the domain provider, but do not require an ACM certificate in `us-east-1`.

The API remains on AWS. CORS/trusted origins must explicitly include the final HTTPS origins. Google OAuth redirect URIs remain on `api.xamuko.com`; WebAuthn RP ID/origin must match the final Admin hostname.

This file is documentation only. It does not deploy, modify DNS, or change runtime configuration.
