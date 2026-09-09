# Plan: modularizar y (opcional) separar repos

Orden recomendado: **primero módulos dentro del backend**, luego decidir el split FE/BE. Separar repos no arregla por sí solo la deuda de `backend/src/index.ts`.

| Fase | Qué |
|------|-----|
| 1 | Modularizar backend |
| 2 | Contrato API (rutas, permisos, pantallas) |
| 3 | Split de repos **solo si aporta** |

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

## Fase 1 — Modularizar el backend (hacer primero)

Extraer **sin cambiar comportamiento**. `index.ts` queda como bootstrap (arranque).

| Orden | Módulo | Qué sacar de `index.ts` |
|------:|--------|-------------------------|
| 1 | auth / users | login, JWT, `verifyToken`, usuarios, password recovery |
| 2 | catalogos | áreas, puestos, unidades, departamentos/municipios, roles |
| 3 | siaf | solicitudes, autorización, DAF, PDF, adjuntos, bitácora |
| 4 | expedientes | CRUD, documentos, versiones, revisiones |
| 5 | analytics + correlativos | dashboards, configs de correlativo, catálogo productos |

### Estructura objetivo (dentro de `backend/`)

```
backend/src/
  app.ts                 # crea Express, middlewares
  index.ts               # arranque + DataSource
  middleware/            # auth, errores
  modules/<dominio>/
    routes.ts
    service.ts
  entity/                # se mantiene (o se mueve por módulo después)
```

---

## Fase 2 — Contrato entre front y back

### Antes de partir repos

- Congelar rutas `/api/...` y permisos
- Documentar `REACT_APP_API_URL` y CORS
- Decidir versión de API (aunque sea informal: “v1 estable”)

### `appScreens`

Una sola fuente de verdad:

- se genera desde el backend (endpoint de pantallas), **o**
- un JSON/paquete compartido

No dejar dos copias manuales en repos distintos.

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
- Modulariza el backend
- Trata cada carpeta como deployable aparte (ya lo son)
- Si más adelante la institución pide dos remotes, el split es una copia limpia / `git filter-repo`, no un rediseño

Beneficio: un PR puede tocar FE+BE; un clone despliega todo; docs y scripts siguen juntos.

---

## Siguiente paso práctico

Empezar por extraer **auth + middleware** de `index.ts` a:

- `src/middleware/`
- `src/modules/auth/`

Sin tocar el frontend ni el remoto. Cuando eso esté estable, reevaluar el split.
