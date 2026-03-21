# Guía detallada: base de datos desde cero (paso a paso)

**Proyecto:** **SIGEC-IGSS**. La carpeta en tu PC puede seguir llamándose `PortalDigitalIGSS` o `SIGEC-IGSS`; las rutas de ejemplo usan `...\SIGEC-IGSS\backend` — adapta a tu ruta real.

Esta guía es para alguien que **no está seguro de qué hacer**. Al final tendrás PostgreSQL con la **misma estructura de tablas** que el proyecto (vacía o casi vacía).

---

## Qué vas a lograr (en palabras simples)

1. **Instalar** PostgreSQL en tu PC (si no lo tienes).
2. **Crear** una base de datos llamada `igss` y un “cajón” interno llamado esquema `sigec_igss` (ahí vivirán las tablas).
3. **Crear** un usuario de base de datos `portal_app` con contraseña (solo tú la conoces).
4. **Configurar** el archivo `backend/.env` para que el backend se conecte a esa base.
5. **Arrancar el backend una vez**: el programa **crea todas las tablas automáticamente** (no copias datos de nadie).
6. *(Opcional)* **Cargar roles y catálogos** con comandos del proyecto, si quieres usar el sistema con login y formularios.

**Importante:** El código del proyecto **no trae un volcado SQL gigante** de tablas. Las tablas se generan desde el código TypeORM cuando conectas con `DB_SYNCHRONIZE=true`. Eso es lo normal en este repo.

---

## Paso 0: Comprobar si ya tienes PostgreSQL

- En Windows: busca **“pgAdmin”** o **“SQL Shell (psql)”** en el menú Inicio.
- O abre **PowerShell** y prueba:

```powershell
psql --version
```

- Si dice que no reconoce el comando, **instala PostgreSQL** desde la web oficial: https://www.postgresql.org/download/windows/  
  Durante la instalación anota la **contraseña del usuario `postgres`** (superusuario).

---

## Paso 1: Abrir una consola como administrador de PostgreSQL

Tienes dos formas habituales:

### Opción A – SQL Shell (psql)

1. Abre **“SQL Shell (psql)”** desde el menú Inicio.
2. Te pregunta servidor → Enter (localhost).
3. Puerto → Enter (5432).
4. Base de datos → Enter o escribe `postgres`.
5. Usuario → escribe `postgres` (o el que uses como admin).
6. Contraseña → la que pusiste al instalar.

### Opción B – PowerShell / CMD

```powershell
psql -U postgres -h localhost
```

(Te pedirá la contraseña de `postgres`.)

Cuando veas el prompt `postgres=#` o `postgres=>`, sigues al paso 2.

---

## Paso 2: Crear la base `igss`, el esquema `sigec_igss` y el usuario `portal_app`

**Antes de pegar:** cambia `TU_CONTRASEÑA_SEGURA` por una contraseña larga (guárdala, la usarás en el `.env`).

Copia y pega **todo este bloque** en `psql`:

```sql
-- Crear base de datos igss (si no existe)
SELECT 'CREATE DATABASE igss'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'igss')\gexec

-- Conectar a esa base
\c igss

-- Esquema donde vive la app (nombre técnico sin guiones)
CREATE SCHEMA IF NOT EXISTS sigec_igss;
COMMENT ON SCHEMA sigec_igss IS 'SIGEC-IGSS: Sistema Integral de Gestión de Expedientes de Compras del IGSS';

-- Usuario de la aplicación (cámbiala antes de ejecutar)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'portal_app') THEN
    CREATE ROLE portal_app LOGIN PASSWORD 'TU_CONTRASEÑA_SEGURA';
  END IF;
END
$$;

ALTER SCHEMA sigec_igss OWNER TO portal_app;
GRANT USAGE, CREATE ON SCHEMA sigec_igss TO portal_app;
ALTER ROLE portal_app IN DATABASE igss SET search_path TO sigec_igss, public;
```

Si el rol `portal_app` ya existía y solo quieres cambiar contraseña:

```sql
ALTER ROLE portal_app WITH PASSWORD 'TU_NUEVA_CONTRASEÑA';
```

Para salir de `psql`: `\q`

---

## Paso 3: Probar que `portal_app` entra a `igss`

En PowerShell (ajusta si tu `psql` no está en el PATH):

```powershell
psql -h localhost -U portal_app -d igss -c "SHOW search_path;"
```

Debe mostrar algo como `sigec_igss, public`. Si pide contraseña, usa la del paso 2.

---

## Paso 4: Crear el archivo `backend/.env`

1. Ve a la carpeta del proyecto:  
   `SIGEC-IGSS\backend` (o la carpeta donde tengas el clon)
2. Si **no** existe `.env`, copia el ejemplo:
   - Copia el archivo **`backend/.env.example`**
   - Pégalo y renómbralo a **`.env`** (sin “.example”).
3. Abre **`.env`** con el Bloc de notas o VS Code y revisa **al menos** estas líneas:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=igss
DB_USER=portal_app
DB_PASSWORD=TU_CONTRASEÑA_SEGURA
DB_SCHEMA=sigec_igss

DB_SYNCHRONIZE=true
DB_LOGGING=false

JWT_SECRET=pon_aqui_un_texto_largo_y_aleatorio
PORT=3001
```

- **`DB_PASSWORD`**: la misma que pusiste en el SQL para `portal_app`.
- **`JWT_SECRET`**: cualquier cadena larga y difícil de adivinar (en desarrollo basta; en producción mejor generar con `openssl rand -base64 32`).
- **`DB_SYNCHRONIZE=true`**: necesario la **primera vez** para que TypeORM **cree las tablas** desde el código. Más adelante, en producción, suele ponerse `false` y usarse migraciones.

**Nunca subas `.env` a Git** (contiene secretos). Sí se sube `.env.example` sin contraseñas reales.

---

## Paso 5: Instalar dependencias del backend

Abre **PowerShell** en la carpeta del backend:

```powershell
cd c:\PROYECTOS-PERSONALES\SIGEC-IGSS\backend
npm install
```

Espera a que termine sin errores graves.

---

## Paso 6: Arrancar el backend (aquí se crean las tablas)

```powershell
npm run dev
```

Qué debería pasar:

1. El programa se conecta a PostgreSQL.
2. TypeORM ve `DB_SYNCHRONIZE=true` y **crea/ajusta tablas** en el esquema `sigec_igss` según las entidades en `backend/src/entity/`.
3. En consola suele aparecer algo como que la base está conectada.
4. Si hay error de conexión, revisa: PostgreSQL encendido, `DB_PASSWORD`, `DB_NAME`, firewall, etc.

**Comprobar en PostgreSQL que hay tablas:**

```powershell
psql -h localhost -U portal_app -d igss -c "\dt sigec_igss.*"
```

Deberías ver muchas tablas (`user`, `role`, `expedientes`, etc.). **Los datos pueden estar en cero filas** — eso es normal.

Para detener el servidor del backend: en la ventana donde corre `npm run dev`, pulsa **Ctrl+C**.

---

## Paso 7 (opcional): Datos mínimos para que el sistema “tenga sentido”

Solo **estructura** (pasos 1–6) ya está bien si tu objetivo es “BD nueva sin datos”.

Si además quieres **entrar al login** y usar pantallas:

- Las tablas de **usuario y credencial** estarán vacías → **nadie puede iniciar sesión** hasta que exista al menos un usuario.
- El proyecto incluye **seeders** (scripts que insertan datos de configuración):

| Comando (desde `backend`) | Para qué sirve (resumen) |
|---------------------------|---------------------------|
| `npm run seed-roles` | Crea muchos **permisos** y **roles** de negocio. |
| `npm run seed-departamentos-municipios` | Carga **departamentos y municipios** de Guatemala (si lo usáis en formularios). |
| `npm run seed` | Carga **unidades médicas** (datos grandes). |
| `npm run assign-admin-role` | Asigna rol “super administrador” a un usuario que **ya exista** con código `admin` — si no hay usuario, fallará. |

**Orden habitual si vas a usar la app:**

1. Tablas creadas (paso 6).
2. `npm run seed-roles`
3. `npm run seed-departamentos-municipios` *(si lo necesitáis)*
4. Crear el **primer usuario administrador**: hoy el flujo normal en muchos equipos es **crearlo por API** o **importar un usuario mínimo**; si aún no tenéis usuario, consultad con quien armó el proyecto o usad herramientas SQL/pgAdmin para insertar `user` + `credential` + enlace a rol (requiere hash bcrypt de la contraseña).

Si solo querías **BD vacía para desarrollo o pruebas de esquema**, **no necesitas** el paso 7.

---

## Errores frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| `password authentication failed` | `DB_USER`, `DB_PASSWORD` en `.env` y la contraseña del rol en PostgreSQL. |
| `database "igss" does not exist` | Ejecuta de nuevo el bloque SQL del paso 2 (crear base). |
| `schema sigec_igss does not exist` | Crea el esquema con `CREATE SCHEMA sigec_igss;` y permisos a `portal_app`. |
| `relation ... does not exist` al arrancar | Asegúrate de haber arrancado el backend al menos una vez con `DB_SYNCHRONIZE=true`. |
| Puerto 5432 en uso | Otro programa usa PostgreSQL o hay dos instalaciones; revisa el puerto en `.env`. |

---

## Resumen en una frase

**Creas `igss` + `sigec_igss` + `portal_app` en PostgreSQL → configuras `backend/.env` → `npm install` → `npm run dev` → las tablas se crean solas; los datos van vacíos salvo que ejecutes seeders o insertes usuarios.**

Para la versión corta del mismo tema, ver también: `docs/BASE-DATOS-DESDE-CERO.md`.
