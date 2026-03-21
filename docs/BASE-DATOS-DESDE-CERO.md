# Base de datos desde cero (SIGEC-IGSS)

> **¿Necesitas explicación paso a paso muy detallada?** Lee primero: **[GUIA-DETALLADA-BD-DESDE-CERO.md](./GUIA-DETALLADA-BD-DESDE-CERO.md)**.

Objetivo: **misma lógica del proyecto** (tablas, relaciones, tipos) definida en las **entidades TypeORM** del backend, **sin datos** (o solo lo mínimo que elijas cargar después).

---

## Qué define el esquema hoy

| Origen | Qué hace |
|--------|----------|
| `backend/src/data-source.ts` | Lista todas las entidades y el esquema PostgreSQL (`DB_SCHEMA`, por defecto `sigec_igss`). |
| `backend/src/entity/*.ts` | Columnas, PK/FK, relaciones (`@ManyToOne`, `@ManyToMany`, `@OneToOne`, etc.). |
| `DB_SYNCHRONIZE=true` | En el **primer arranque**, TypeORM **crea o ajusta** tablas para que coincidan con las entidades. |
| `backend/src/index.ts` (tras conectar) | Varios `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` para columnas añadidas con el tiempo (idempotentes; en BD vacía no rompen). |
| `backend/src/migrations/migrate-user-roles.ts` | Solo para bases **antiguas** con `user.roleId`. En BD nueva se **omite** hasta que existan `user` y `role` (luego TypeORM ya crea `user_roles` vía `@JoinTable`). |

**No hace falta** un volcado de datos de producción para tener la estructura: basta PostgreSQL vacío + variables correctas + arrancar el backend (con `synchronize` en desarrollo).

---

## Plan paso a paso (qué iremos haciendo)

### 1. PostgreSQL: crear base y esquema

Seguir **`docs/POSTGRES-SCHEMA-SETUP.md`**:

- Base: `igss`
- Esquema: `sigec_igss`
- Usuario app: `portal_app` (contraseña fuerte, solo en `.env`)

### 2. Backend: variables de entorno

1. Copiar `backend/.env.example` → `backend/.env`
2. Ajustar al menos: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SCHEMA`, `JWT_SECRET`
3. Para **crear tablas desde cero en desarrollo**: dejar `DB_SYNCHRONIZE=true` (como en el example)

### 3. Primera ejecución del backend

```bash
cd backend
npm install   # si aún no
npm run dev   # o el script que uses para arrancar
```

Al conectar, TypeORM generará todas las tablas en `sigec_igss` **vacías**.

### 4. (Opcional) Datos mínimos para poder usar el sistema

Si quieres BD “vacía” de negocio pero **poder entrar al login**, necesitas al menos:

- **Roles y permisos** (p. ej. script `SeedRolesFromPermissions` si lo usáis en el equipo)
- **Un usuario + credencial** (p. ej. `AssignAdminRole` / flujo que documentéis)

Si de verdad no quieres nada, la app puede arrancar pero **no habrá conexión útil** hasta crear usuario/roles.

### 5. Producción / servidor

- `DB_SYNCHRONIZE=false`
- Ideal: **migraciones TypeORM** generadas a partir de entidades (hoy `migrations: []` en `data-source.ts`; es mejora futura)
- Mismo contrato: base `igss`, esquema `sigec_igss`, usuario dedicado

Ver también: `docs/MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md` si aplica a vuestro despliegue.

---

## Git: ¿subir back y front?

| Sí subir al repo | No subir |
|------------------|----------|
| Código **backend** y **frontend** | `.env`, secretos, contraseñas |
| `backend/.env.example` (plantilla sin secretos) | Dumps de PostgreSQL con datos sensibles |
| Documentación (`docs/`) | Credenciales en issues/commits |

La **base de datos no vive en Git**: solo el **código que define el esquema** (entidades + migraciones cuando las tengáis). Cualquier compañero clona el repo, crea `igss` + `sigec_igss`, pone su `.env` y arranca.

---

## Resumen

1. Crear `igss` + `sigec_igss` + `portal_app` (SQL del doc de PostgreSQL).  
2. Configurar `backend/.env`.  
3. Arrancar backend con `DB_SYNCHRONIZE=true` → **tablas y relaciones alineadas al código, sin datos**.  
4. Opcional: seeders mínimos para login.  
5. Git: código sí; `.env` y datos no.

Si más adelante queréis **dejar de depender de `synchronize`**, el siguiente paso sería generar la primera migración TypeORM y documentar `npm run typeorm migration:run`.
