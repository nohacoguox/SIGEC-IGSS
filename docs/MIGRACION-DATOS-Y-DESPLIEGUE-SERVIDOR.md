# Migrar datos al servidor IGSS y desplegar SIGEC-IGSS (PostgreSQL)

> **Código en Windows y PostgreSQL ya listo en Debian 12 (sin migrar datos):** guía detallada **[GUIA-DESPLIEGUE-SIGEC-IGSS-WINDOWS-A-DEBIAN12.md](./GUIA-DESPLIEGUE-SIGEC-IGSS-WINDOWS-A-DEBIAN12.md)** (resumen en [DESPLIEGUE-WINDOWS-A-DEBIAN12.md](./DESPLIEGUE-WINDOWS-A-DEBIAN12.md)).

**Nombre del producto:** SIGEC-IGSS (en documentación).  
**En PostgreSQL:** base `igss`, esquema `sigec_igss`, usuario `portal_app` (sin guiones en identificadores).

> **Importante:** Nadie puede conectarse por SSH a tu servidor en tu lugar. Ejecuta tú los comandos; si algo falla, copia el mensaje de error (sin contraseñas) y pídele ayuda a quien te apoye con el código.

---

## 1. Qué tienes que decidir primero (origen de los datos)

| Situación | Qué hacer (resumen) |
|-----------|---------------------|
| **A)** Tu desarrollo local **ya** usa `DB_NAME=igss` y `DB_SCHEMA=sigec_igss` y las tablas están en ese esquema | Volcar solo ese esquema y restaurar en el servidor (sección 3). |
| **B)** Tu desarrollo local aún usa otra base (ej. `portaldigitaligss`) y tablas en `public` | Primero exportar y mover tablas al esquema `sigec_igss` en local **o** en el servidor tras restaurar (sección 4). |
| **C)** Servidor vacío, sin datos que migrar | Subir código, configurar `.env`, arrancar backend con `DB_SYNCHRONIZE=true` **solo la primera vez** (o usar migraciones) y ejecutar seeders (sección 5). |

---

## 2. Archivos y variables en el servidor

1. Copia el proyecto al servidor (Git, SCP, USB), **sin** subir `node_modules` si quieres ir más rápido.
2. En el servidor, en `backend/`:

```bash
cp .env.example .env
nano .env
```

Valores típicos (ajusta host si PostgreSQL no es local):

```env
PORT=3001
NODE_ENV=production

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=igss
DB_USER=portal_app
DB_PASSWORD=LA_MISMA_QUE_DEFINISTE_EN_POSTGRES
DB_SCHEMA=sigec_igss

# Primera vez con esquema vacío: true; luego false en producción
DB_SYNCHRONIZE=true
DB_LOGGING=false

JWT_SECRET=genera_uno_largo_con_openssl_rand_base64_32
```

3. Comprueba conexión desde el servidor (como en tu captura):

```bash
psql -h 127.0.0.1 -U portal_app -d igss -W -c "SHOW search_path;"
```

Debe mostrar `sigec_igss, public`.

---

## 3. Migración cuando local ya es `igss` + `sigec_igss`

**En tu PC (donde está la base con datos):**

```bash
pg_dump -h localhost -U portal_app -d igss -n sigec_igss -Fc -f sigec_igss_backup.dump
```

(Pide la contraseña de `portal_app` o usa el usuario que tenga permiso de volcado.)

**Copia el archivo al servidor** (ejemplo):

```bash
scp sigec_igss_backup.dump usuario@IP_SERVIDOR:/tmp/
```

**En el servidor:**

```bash
pg_restore -h 127.0.0.1 -U portal_app -d igss --no-owner --schema=sigec_igss -c /tmp/sigec_igss_backup.dump
```

- `-c` limpia objetos existentes antes de restaurar (útil si repites la prueba).  
- Si hay conflictos de permisos, puede hacer falta restaurar como `postgres` y luego `ALTER ... OWNER TO portal_app`.

Después: `DB_SYNCHRONIZE=false` en producción si el esquema ya está completo.

---

## 4. Si tu base local es otra (ej. `portaldigitaligss` en `public`)

Opciones (elige una con tu DBA):

### 4.1 Restaurar en temporal y mover esquema

1. Volcar la base antigua:

```bash
pg_dump -h localhost -U postgres -d portaldigitaligss -Fc -f vieja.dump
```

2. En el servidor, restaurar en una base temporal **o** en `igss` con cuidado de no pisar `sigec_igss` si ya tiene objetos.

3. Para cada tabla en `public` que deba vivir en `sigec_igss`:

```sql
ALTER TABLE public.nombre_tabla SET SCHEMA sigec_igss;
```

Puedes generar la lista de `ALTER` consultando `pg_tables` donde `schemaname = 'public'`.

### 4.2 Alinear primero en local

Crear `igss` + `sigec_igss` en local (ver `POSTGRES-SCHEMA-SETUP.md`), poner en `.env` `DB_NAME=igss`, `DB_SCHEMA=sigec_igss`, arrancar el backend una vez con `synchronize` o migrar datos con scripts, y luego usar la sección 3.

---

## 5. Servidor sin datos (solo estructura)

1. Asegúrate de que existen `igss`, esquema `sigec_igss` y usuario `portal_app` (`POSTGRES-SCHEMA-SETUP.md`).
2. `.env` con `DB_SYNCHRONIZE=true` **solo** para el primer arranque que crea tablas en `sigec_igss`.
3. En el servidor:

```bash
cd /ruta/al/proyecto/backend
npm install
npx tsc
node dist/index.js
```

4. Comprueba logs: “Base de datos conectada exitosamente”.
5. Ejecuta seeders si los usas (`npm run seed`, `seed-roles`, etc. según tu `package.json`).
6. Pon `DB_SYNCHRONIZE=false` y vuelve a compilar / reiniciar el proceso (PM2).

---

## 6. Subir código y proceso en marcha (resumen)

```bash
cd backend && npm install && npx tsc
# PM2 (ejemplo)
pm2 start dist/index.js --name sigec-api
pm2 save && pm2 startup
```

Frontend:

```bash
cd ../frontend
# .env con REACT_APP_API_URL=http://IP_O_NOMBRE_DEL_SERVIDOR:3001
npm install && npm run build
```

Nginx sirviendo `frontend/build` y opcionalmente proxy `/api` → `http://127.0.0.1:3001` (como en tu guía de despliegue).

---

## 7. Pruebas rápidas

1. `curl http://127.0.0.1:3001/api/...` (alguna ruta que exista).
2. Navegador: `http://IP_SERVIDOR` → pantalla de login.
3. Login con un usuario que exista en la tabla `user` del esquema `sigec_igss`.
4. Crear un SIAF de prueba, adjunto y PDF.

---

## 8. Resumen de nombres

| Documentación / negocio | PostgreSQL |
|-------------------------|------------|
| SIGEC-IGSS | esquema `sigec_igss` |
| IGSS (base) | base `igss` |
| Usuario aplicación | `portal_app` |

El repositorio ya usa `DB_SCHEMA` y `schema` en TypeORM para crear y usar tablas en `sigec_igss`.
