# Contrato API v1 (estable informal)

Documento de referencia entre frontend y backend. No es OpenAPI formal: congela lo que ya usa el prototipo para no desalinearse al desplegar o (más adelante) partir repos.

**Versión:** `v1` (informal) — rutas bajo `/api/...`, JWT en header `Authorization: Bearer <token>`.

---

## Entorno

| Pieza | Variable | Notas |
|-------|----------|--------|
| API | `PORT` (default `3001`) | Base: `http://host:PORT/api` |
| Front | `REACT_APP_API_URL` | URL **sin** `/api` al final; el cliente añade `/api`. Local: `http://localhost:3001`. Producción: URL pública del host/Nginx. |
| BD | `DB_*`, `DB_SCHEMA` | Ver `backend/.env.example` |
| Esquema | `DB_SYNCHRONIZE` | **Producción / BD con datos: `false` (u omitido).** Solo `true` en BD vacía una vez. |

CORS hoy: `app.use(cors())` (cualquier origen). Aceptable en red interna / prototipo; si se expone a Internet, restringir `origin` al dominio del front.

Detalle de migraciones: [`MIGRACIONES-TYPEORM.md`](./MIGRACIONES-TYPEORM.md).

---

## Montaje de routers (fuente: `backend/src/index.ts`)

| Prefijo | Módulo |
|---------|--------|
| `/api/auth` | auth |
| `/api` | rbac (roles, permisos, `app-screens`) |
| `/api/correlativos` | correlativos |
| `/api/dashboard/stats` | stats admin (inline) |
| `/api/expedientes` | expedientes |
| `/api/users` | usuarios |
| `/api` | catalogos (puestos, UM, áreas, depto/municipio…) |
| `/api/catalogo-productos` | catálogo MINFIN/SIBOFA |
| `/api/siaf` | SIAF |
| `/api/estadisticas` | analítica |
| `/api/ortografia` | LanguageTool proxy |

Inventario histórico detallado de SIAF (payloads): [`FASE-2-ENDPOINTS-BACKEND.md`](./FASE-2-ENDPOINTS-BACKEND.md). Ante duda, manda el código en `backend/src/modules/*/routes.ts`.

---

## Pantallas / permisos

| Concepto | Dónde |
|----------|--------|
| Fuente de verdad | `backend/src/config/appScreens.ts` (`APP_SCREENS`, `PERMISSION_ALIASES`) |
| Catálogo FE | `GET /api/app-screens/catalog` — cualquier autenticado → `{ screens, aliases }` |
| Gestión roles | `GET /api/app-screens` — requiere permiso de gestionar roles (+ `permissionId`) |
| Front | `AppScreensProvider`; listado local = `FALLBACK_*` solo si falla la API |
| Seed | `npm run seed-roles` (backend) tras agregar pantallas |

Cada pantalla ≈ un permiso. Los roles agrupan permisos.

---

## Rutas SPA relevantes (`frontend/src/App.tsx`)

| Ruta | Pantalla |
|------|----------|
| `/login`, `/change-password` | Auth |
| `/admin-dashboard` | Admin |
| `/colaborador-dashboard` | Colaborador (bandejas, analítica por permiso) |
| `/siaf-book`, `/siaf-book/crear`, `/siaf-book/corregir/:id` | Listado / crear / corregir SIAF |
| `/expedientes` | Expedientes de compras |
| `/actualizar-codigos-productos` | Catálogo Excel |

---

## Checklist de estabilización

### Local (ya verificado en desarrollo típico)

- [x] `DB_SYNCHRONIZE=false` en `backend/.env`
- [x] Al arrancar: log `synchronize=OFF` y `Migraciones: sin pendientes` (o lista de aplicadas)
- [ ] Smoke manual (abajo) tras un pull grande

### Servidor Debian / despliegue

1. En `.env` del API: `DB_SYNCHRONIZE=false`.
2. Desplegar código, `npm ci` / build, reiniciar PM2 (o equivalente) para correr migraciones al arranque.
3. Confirmar en log: `Migraciones aplicadas` o `sin pendientes`, y `synchronize=OFF`.
4. Front: `REACT_APP_API_URL` = URL pública **sin** `/api`; rebuild de CRA.
5. Smoke en el entorno real.

### Smoke test (5–10 min)

Con un usuario colaborador (crear SIAF / expediente) y uno con bandeja DAF si aplica:

1. Login → carga menú (catálogo de pantallas).
2. Crear o abrir SIAF → guardar / vista previa.
3. Listado SIAF → bitácora o PDF si hay datos.
4. Expedientes → abrir detalle → documento (si hay).
5. Bandeja DAF (SIAF y/o expedientes) si el rol lo tiene.
6. Una pestaña de analítica (SIAF o expedientes).
7. Logout / login admin → gestionar usuarios o roles (opcional).

Si algo falla: anotar ruta FE + endpoint (`Network`) + mensaje del API.

---

## Qué no hacer sin actualizar este contrato

- Renombrar permisos / keys de `appScreens` sin migrar roles y FALLBACK del front.
- Quitar o mover prefijos `/api/...` usados por el CRA.
- Reactivar `DB_SYNCHRONIZE=true` en BD con datos de producción.
