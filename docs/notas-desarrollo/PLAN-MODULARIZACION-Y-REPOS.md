# Plan: modularizar y (opcional) separar repos

Orden recomendado: **primero módulos dentro del backend**, luego esquema seguro, luego decidir el split FE/BE.

| Fase | Qué | Estado |
|------|-----|--------|
| 1 | Modularizar backend | **Hecha** (`index.ts` bootstrap; 10 módulos en `src/modules/`) |
| 1.5 | Esquema sin `synchronize` por defecto + migraciones TypeORM | **Hecha (puente)** — ver `MIGRACIONES-TYPEORM.md` |
| 2 | Contrato API (rutas, permisos, pantallas) | **Hecha (v1 informal)** — ver `CONTRATO-API-V1.md` |
| 2.5 | Modularizar frontend por `features/` | **Hecha (núcleo)** — Expedientes, SiafBook, revisión DD, gestión SIAF y analítica |
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

## Fase 2 — Contrato entre front y back ✅

Documentación operativa: [`CONTRATO-API-V1.md`](./CONTRATO-API-V1.md).

### Pantallas / permisos (`appScreens`)

- **Fuente de verdad:** `backend/src/config/appScreens.ts`
- **API:** `GET /api/app-screens/catalog` (cualquier autenticado) y `GET /api/app-screens` (gestión de roles, con `permissionId`)
- **Frontend:** `AppScreensProvider` carga el catálogo tras login; el listado local es solo `FALLBACK_*`

### Congelado en v1

- Prefijos `/api/...` por módulo (tabla en el contrato)
- `REACT_APP_API_URL` sin `/api`; CORS abierto en prototipo
- Versión informal: **v1 estable**

Detalle histórico de payloads SIAF: [`FASE-2-ENDPOINTS-BACKEND.md`](./FASE-2-ENDPOINTS-BACKEND.md).
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
- Modulariza el frontend por dominio (`features/`) sin cambiar comportamiento
- Trata cada carpeta como deployable aparte (ya lo son)
- Si más adelante la institución pide dos remotes, el split es una copia limpia / `git filter-repo`, no un rediseño

Beneficio: un PR puede tocar FE+BE; un clone despliega todo; docs y scripts siguen juntos.

---

## Fase 2.5 — Modularizar el frontend

Misma regla que el backend: **extraer sin cambiar comportamiento**. Rutas/`App.tsx` siguen importando desde `pages/` o `components/` vía re-export.

| Feature | Carpeta | Estado |
|---------|---------|--------|
| Expedientes (lista, detalle, docs, bitácora) | `frontend/src/features/expedientes/` | **Hecha** (`pages/ExpedientesPage.tsx` re-export) |
| SIAF libro / crear-corregir | `frontend/src/features/siaf/book/` | **Hecha (primer corte)** — types/utils + diálogos + bitácora; `components/SiafBook.tsx` re-export |
| Revisión DD (SIAF / expedientes) | `features/siaf/revisar/`, `features/expedientes/revisar/` | **Hecha (primer corte)** — types/utils + tablas/diálogos; re-exports en `components/` |
| Gestión / analítica | `features/siaf/management/`, `features/analitica/` | **Hecha** — SiafManagement + AnaliticaDaf/Expedientes + shared; EstadisticasSiaf en `legacy/` |

**Expedientes — estructura:**

- `types.ts`, `constants.tsx`, `utils.ts`
- `ExpedientesPage.tsx` (orquestador)
- `components/`: Crear/Editar, detalle drawer, agregar/reemplazar/eliminar doc, bitácora, versiones, ver marca, viewer

**SIAF book — estructura:**

- `types.ts`, `utils.ts` (unidad médica, validación, ortografía)
- `SiafBook.tsx` (orquestador / formulario)
- `components/`: bitácora, ortografía, preview PDF, marcas, viewer de adjuntos
- Siguiente refinamiento opcional: secciones del formulario (ítems, subproductos, solicitante, etc.)

**Revisión DD — estructura:**

- `features/siaf/revisar/`: types, constants (motivos), utils, orquestador + tablas pendientes/historial + diálogos (motivos, marca, bitácora, adjuntos, viewer)
- `features/expedientes/revisar/`: types, constants, utils, orquestador + lista + diálogo rechazar/marcar + bitácora local
- Re-exports: `components/RevisarDireccionDepartamental.tsx`, `components/RevisarExpedientesDD.tsx`

**Gestión SIAF — estructura:**

- `features/siaf/management/`: types, utils, constants (estado), orquestador + diálogos (finalizar, enviar revisión, PDF, adjuntos, bitácora, marcas, viewer)
- Re-export: `pages/SiafManagement.tsx`

**Analítica — estructura:**

- `features/analitica/shared/`: `AnalyticsFilterPanel`, charts helpers, `KpiCard`
- `features/analitica/siaf/AnaliticaDaf.tsx` + types
- `features/analitica/expedientes/AnaliticaExpedientes.tsx` + types
- `features/analitica/legacy/EstadisticasSiaf.tsx` (huérfano, conservado)
- Re-exports en `components/`

Refinamientos opcionales: secciones del formulario SiafBook; pantallas auth/dashboard si crecen.

---

## Siguiente paso práctico

1. **Local OK** si el log muestra `synchronize=OFF` y `Migraciones: sin pendientes` (o aplicadas). Guía: [`CONTRATO-API-V1.md`](./CONTRATO-API-V1.md).
2. En servidor Debian: `DB_SYNCHRONIZE=false`; al desplegar, reiniciar API para correr migraciones; smoke del checklist.
3. Cambios nuevos de esquema: entity + `npm run migration:generate` (ver `MIGRACIONES-TYPEORM.md`).
4. Fase 3 (split de repos) **solo si la institución lo pide**. Opcional FE: secciones de SiafBook / auth-dashboards si crecen.
