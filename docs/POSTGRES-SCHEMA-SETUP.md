# PostgreSQL: base de datos profesional (IGSS + esquema SIGEC-IGSS)

Guía para preparar **Debian 12 + PostgreSQL** con:

| Concepto | Nombre en documentación / negocio | Identificador en PostgreSQL |
|----------|-----------------------------------|-----------------------------|
| Base de datos | **IGSS** | `igss` |
| Esquema | **SIGEC-IGSS** — *Sistema Integral de Gestión de Expedientes de Compras del IGSS* | `sigec_igss` |
| Usuario de aplicación | (rol dedicado) | `portal_app` |

### Por qué `igss` y `sigec_igss` (no `IGSS` ni `SIGEC-IGSS`)

En PostgreSQL, los identificadores **sin comillas** se guardan en **minúsculas** (`IGSS` → `igss`).  
Los **guiones** (`SIGEC-IGSS`) obligan a usar **comillas dobles** en todo el SQL (`"SIGEC-IGSS"`), lo que complica herramientas, ORM y scripts. Por eso el **nombre técnico** del esquema es `sigec_igss`; el nombre **SIGEC-IGSS** queda en documentación y comentarios.

---

## 1. Requisitos

- PostgreSQL instalado y en marcha (`sudo systemctl status postgresql`).
- Acceso como superusuario de base de datos (usuario sistema `postgres` con `sudo -u postgres psql`).

---

## 2. Definir contraseñas (no las commitees)

- Contraseña larga para `portal_app` (guárdala en `backend/.env` en el servidor).

```bash
openssl rand -base64 24
```

---

## 3. Script SQL (ejecutar una sola vez)

```bash
sudo -u postgres psql
```

Ejecuta **en orden** (ajusta la contraseña **antes** de pegar):

```sql
-- 1) Crear base IGSS (identificador: igss)
SELECT 'CREATE DATABASE igss'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'igss')\gexec

-- 2) Conectar a la base
\c igss

-- 3) Esquema SIGEC-IGSS (identificador técnico: sigec_igss)
CREATE SCHEMA IF NOT EXISTS sigec_igss;
COMMENT ON SCHEMA sigec_igss IS 'SIGEC-IGSS: Sistema Integral de Gestión de Expedientes de Compras del IGSS';

-- 4) Usuario de aplicación (LOGIN, no superusuario)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_app') THEN
    CREATE ROLE portal_app LOGIN PASSWORD 'bdigss1998';
  END IF;
END
$$;

-- 5) Dueño del esquema: la aplicación
ALTER SCHEMA sigec_igss OWNER TO portal_app;

-- 6) Permisos sobre el esquema (crear tablas, etc.)
GRANT USAGE, CREATE ON SCHEMA sigec_igss TO portal_app;

-- 7) search_path por defecto al conectar a esta base
ALTER ROLE portal_app IN DATABASE igss SET search_path TO sigec_igss, public;

\dn+ sigec_igss
\du portal_app
```

**Importante:** sustituye `'CAMBIA_ESTA_CONTRASEÑA'` por la contraseña real antes de ejecutar.

Si el rol `portal_app` ya existía:

```sql
ALTER ROLE portal_app WITH PASSWORD 'TU_NUEVA_CONTRASEÑA';
```

---

## 4. `pg_hba.conf`

Si `psql -h 127.0.0.1 -U portal_app` pide contraseña y entra, no toques nada.

---

## 5. Probar conexión

```bash
psql -h 127.0.0.1 -U portal_app -d igss -W -c "SHOW search_path;"
```

Debe mostrar algo como `sigec_igss, public`.

---

## 6. Backend (este repo)

1. Copia `backend/.env.example` → `backend/.env` y rellena valores reales.
2. Variables clave: `DB_USER=portal_app`, `DB_PASSWORD=...`, `DB_NAME=igss`, `DB_SCHEMA=sigec_igss`.
3. Arranca el backend: TypeORM creará tablas en el esquema `sigec_igss` si `DB_SYNCHRONIZE=true` (solo desarrollo / primer despliegue).

En **producción** usa migraciones y `DB_SYNCHRONIZE=false`.

---

## 7. Alinear con producción

- Mismo nombre de **base**, **esquema** y **usuario** entre entornos, o documenta las diferencias en `.env`.
- Respaldo del esquema:

```bash
pg_dump -h 127.0.0.1 -U portal_app -d igss -n sigec_igss -Fc -f sigec_igss_backup.dump
```

---

## 8. Resumen

| Elemento | Identificador PostgreSQL |
|----------|--------------------------|
| Base (IGSS) | `igss` |
| Esquema (SIGEC-IGSS) | `sigec_igss` |
| Usuario app | `portal_app` |
| Superusuario | Solo para admin (`postgres`), no para la app |

### Si ya tenías base `portaldigitaligss` y esquema `portal`

Renombrar o migrar datos es un paso aparte; lo más limpio en un entorno nuevo es crear `igss` + `sigec_igss` y volver a generar esquema con migraciones / `synchronize` según política del equipo.
