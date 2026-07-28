# AGENTS.md

## Cursor Cloud specific instructions

SIGEC-IGSS is a single 3-tier app: React SPA (`frontend/`) → Express/TypeORM REST API (`backend/`) → PostgreSQL. Standard run/build commands live in `frontend/package.json`, `backend/package.json`, and `README.md`; this section only covers non-obvious, environment-specific caveats.

### Services & ports

| Service | Dir | Port | Start command | Required |
|---------|-----|------|---------------|----------|
| PostgreSQL 16 | (system) | 5432 | `sudo pg_ctlcluster 16 main start` | Yes |
| Backend API | `backend/` | 3001 | `npm run dev` | Yes |
| Frontend (CRA dev) | `frontend/` | 3003 | `npm start` | Yes (for UI) |

The update script only refreshes npm deps + fixes bin perms; it does NOT start Postgres or the servers. Start them yourself each session.

### PostgreSQL

- PostgreSQL is installed at the system level and its data dir (`/var/lib/postgresql/16/main`, includes the `igss` database) persists in the VM snapshot. It is NOT running on boot — start it with `sudo pg_ctlcluster 16 main start`.
- The repo also contains a committed `database/data/` PG14 dump directory. It is NOT used by this setup; ignore it. We run a fresh system Postgres 16 cluster instead.
- Connection (matches `backend/.env`): db `igss`, schema `sigec_igss`, user `portal_app`, password `bdigss1998`, host `localhost:5432`.
- If the `igss` database is missing (e.g. brand-new cluster), recreate it, then let the backend build tables via TypeORM `synchronize`, then seed:
  ```bash
  sudo -u postgres psql -c "CREATE DATABASE igss"
  sudo -u postgres psql -c "CREATE ROLE portal_app LOGIN PASSWORD 'bdigss1998'"
  sudo -u postgres psql -d igss -c "CREATE SCHEMA IF NOT EXISTS sigec_igss; ALTER SCHEMA sigec_igss OWNER TO portal_app; GRANT USAGE, CREATE ON SCHEMA sigec_igss TO portal_app; ALTER ROLE portal_app IN DATABASE igss SET search_path TO sigec_igss, public;"
  cd backend && npm run dev   # first boot creates all tables (DB_SYNCHRONIZE=true)
  npm run seed-roles          # roles + permissions (required before bootstrap admin)
  npm run seed-bootstrap-admin # creates first admin user (code: admin)
  ```

### Backend `.env` (required, git-untracked, not created by update script)

`backend/.env` is required and persists in the snapshot. If missing, copy `backend/.env.example` → `backend/.env` and set `DB_PASSWORD=bdigss1998`, `DB_SYNCHRONIZE=true`, and any `JWT_SECRET`. Without it, TypeORM falls back to `postgres`/`admin98` defaults that do NOT match this cluster.

### Admin login

- Seeded credentials: employee code `admin`, temporary password `admin123`.
- On first login the app forces a password change (`/change-password`). During setup the password was changed to `Admin1234!`, so the persisted DB now logs in with `admin` / `Admin1234!`. On a freshly re-seeded DB it is `admin` / `admin123` (temp).

### Gotchas

- `backend/node_modules` and the root `node_modules` are committed to git, and their `.bin/*` shim files are checked in WITHOUT the execute bit — so `npm run dev` fails with `nodemon: Permission denied`. `npm install` does NOT fix this; the update script runs `chmod -R +x backend/node_modules/.bin`. Fixing perms shows up as mode changes in `git status` (`core.fileMode=true`); do NOT commit those node_modules changes.
- `frontend/node_modules` is NOT committed — `npm install` there produces correct perms.
- `frontend/.env` is committed and sets `PORT=3003` and `REACT_APP_API_URL=http://localhost:3001`.
- ESLint runs inline during `npm start` / `npm run build` (CRA); there is no standalone `lint` script. It reports warnings only.
- Tests: `backend` `npm test` is a placeholder that exits 1 (no tests). `frontend` `npm test` currently fails on the default CRA `App.test.tsx` because it imports `axios` v1 (ESM) which Jest can't transform — pre-existing, unrelated to setup.
- `start-stable.js` (`npm run dev:stable` / `npm run dev` in frontend) is Windows-only (`netstat`/`taskkill`). On Linux use `npm run dev` for backend and `npm start` for frontend.
