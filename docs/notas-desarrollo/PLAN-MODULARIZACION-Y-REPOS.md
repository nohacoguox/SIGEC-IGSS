# Plan: modularizar y (opcional) separar repos

Orden recomendado: **primero módulos dentro del backend**, luego esquema seguro, luego decidir el split FE/BE.

| Fase | Qué | Estado |
|------|-----|--------|
| 1 | Modularizar backend | **Hecha** (`index.ts` bootstrap; 10 módulos en `src/modules/`) |
| 1.5 | Esquema sin `synchronize` por defecto + migraciones TypeORM | **Hecha (puente)** — ver `MIGRACIONES-TYPEORM.md` |
| 2 | Contrato API (rutas, permisos, pantallas) | **En curso** — catálogo canónico en backend + `/app-screens/catalog` |
| 3 | Split de repos **solo si aporta** | Pendiente |

---

## Recomendación directa

Hoy conviene **mantener un solo repositorio** (frontend + backend juntos). Separar en dos repos tiene sentido si hay requisito institucional, permisos distintos o pipelines independientes.

Si el motivo es solo “ordenar”, **modularizar dentro del repo actual** da más valor con menos fricción.

Contexto actual:

- Una persona lleva FE y BE
- El despliegue documentado asume **un solo clone** (`/var/www/sigec-igss`)
- Si se parte, hay que versionar y coordinar **2+** piezas

---

## Separar repos: cuándo sí / cuándo no

### Tiene sentido si…

- Equipos o accesos distintos a código FE vs BE
- CI/CD y releases independientes (API vs SPA)
- Política de la institución: un repo por servicio
- Quieres publicar solo el backend (o solo el front) a un remoto privado

### Pesa en contra si…

- Una sola persona lleva ambos lados (tu caso actual)
- Docs, scripts, BAT y guía Debian asumen un solo clone
- `appScreens` / permisos ya se duplican; dos repos aumentan el desalineamiento
- Los cambios de feature suelen tocar FE + BE a la vez

---

## Fase 1 — Modularizar el backend ✅

Extraído **sin cambiar comportamiento**. `index.ts` queda como bootstrap (arranque + montaje de routers).

| Módulo | Carpeta |
|--------|---------|
| auth | `modules/auth/` |
| rbac | `modules/rbac/` |
| catalogos (puestos, UM, etc.) | `modules/catalogos/` |
| correlativos | `modules/correlativos/` |
| usuarios | `modules/usuarios/` |
| expedientes | `modules/expedientes/` |
| siaf | `modules/siaf/` |
| catalogoProductos | `modules/catalogoProductos/` |
| estadisticas | `modules/estadisticas/` |
| ortografia | `modules/ortografia/` |

Helpers compartidos: `middleware/auth`, `middleware/upload`, `services/catalogoOrigen`, `services/departamentoDireccion`, `services/ensureSchema`.

---

## Fase 1.5 — Esquema de base de datos ✅ (puente)

**Problema:** `synchronize` estaba **activo por defecto**. En una BD con datos eso puede alterar tablas sin control.

**Aplicado:**

1. `synchronize` solo si `DB_SYNCHRONIZE=true` (opt-in).
2. Migraciones TypeORM en `backend/src/db/migrations/` (primera: `HistoricalSchemaPatches`).
3. Al arrancar: `runMigrations()` y luego `ensureSchema` (correlativos + backfills de datos).
4. Guía: `docs/notas-desarrollo/MIGRACIONES-TYPEORM.md`.

**Uso:**

| Escenario | `DB_SYNCHRONIZE` |
|-----------|------------------|
| BD existente / producción / tu local actual | `false` (o omitido → false) |
| BD vacía, primer arranque | `true` una vez → luego `false` |

**Pendiente opcional:** generar `CreateInitialTables` para omitir el synchronize en servidores nuevos; migrar `ensureCorrelativoTables` a migraciones versionadas.

---

## Fase 2 — Contrato entre front y back

### Pantallas / permisos (`appScreens`) — avance

- **Fuente de verdad:** `backend/src/config/appScreens.ts`
- **API:** `GET /api/app-screens/catalog` (cualquier autenticado) y `GET /api/app-screens` (gestión de roles, con `permissionId`)
- **Frontend:** `AppScreensProvider` carga el catálogo tras login; el listado local es solo `FALLBACK_*`

### Antes de partir repos

- Congelar rutas `/api/...` y permisos
- Documentar `REACT_APP_API_URL` y CORS
- Decidir versión de API (aunque sea informal: “v1 estable”)

---

## Fase 3 — Si decides separar

| Repo | Contenido | Notas |
|------|-----------|-------|
| `sigec-igss-backend` | `backend/` + `database/migrations` + seeders + `.env.example` | PM2 apunta aquí |
| `sigec-igss-frontend` | `frontend/` + `.env.example` | build → Nginx root |
| `sigec-igss-docs` (opcional) | `docs/`, scripts de grado, guías Debian | O dejar docs en backend |

### Despliegue Debian después del split

En el servidor pasarías de un solo `/var/www/sigec-igss` a dos clones (p. ej. `/var/www/sigec-api` y `/var/www/sigec-web`), o un directorio padre con dos remotes. Hay que reescribir la guía de despliegue y los BAT/PS1 de Windows.

---

## Alternativa intermedia (recomendada ahora)

**Un repo, dos apps independientes** — lo que ya tienes:

- Mantén `frontend/` y `backend/` en el mismo Git
- Modulariza el backend ✅
- Trata cada carpeta como deployable aparte (ya lo son)
- Si más adelante la institución pide dos remotes, el split es una copia limpia / `git filter-repo`, no un rediseño

Beneficio: un PR puede tocar FE+BE; un clone despliega todo; docs y scripts siguen juntos.

---

## Siguiente paso práctico

1. Confirmar en el log: `Migraciones aplicadas` o `sin pendientes`, y `synchronize=OFF`.
2. En servidor Debian: `DB_SYNCHRONIZE=false`; al desplegar, reiniciar API para correr migraciones.
3. Cambios nuevos de esquema: entity + `npm run migration:generate` (ver `MIGRACIONES-TYPEORM.md`).
4. Fase 2 cuando toque: unificar `appScreens` / contrato API.
