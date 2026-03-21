# Despliegue completo: Portal Digital IGSS en servidor Debian 12 (IGSS Palín) con Oracle

**Objetivo:** Instalar y dejar funcionando el Portal Digital IGSS en un **ordenador del IGSS Palín** configurado como servidor, usando **Debian 12** y **base de datos Oracle** (sin PostgreSQL).

Este documento es la guía paso a paso, sin omitir ningún punto: requisitos, preparación del equipo, instalación de software, cambios exactos en el código, configuración del backend y frontend, Nginx, PM2, verificación y mantenimiento.

---

## Índice

1. [Resumen del stack y requisitos](#1-resumen-del-stack-y-requisitos)
2. [Información que debes tener antes de empezar](#2-información-que-debes-tener-antes-de-empezar)
3. [Preparación del equipo servidor (Debian 12)](#3-preparación-del-equipo-servidor-debian-12)
4. [Instalación de Node.js](#4-instalación-de-nodejs)
5. [Instalación de Oracle Instant Client](#5-instalación-de-oracle-instant-client)
6. [Subir el proyecto al servidor](#6-subir-el-proyecto-al-servidor)
7. [Cambios obligatorios en el código (Backend → Oracle)](#7-cambios-obligatorios-en-el-código-backend--oracle)
8. [Configuración del Backend en el servidor](#8-configuración-del-backend-en-el-servidor)
9. [Ejecutar el Backend con PM2](#9-ejecutar-el-backend-con-pm2)
10. [Configuración del Frontend](#10-configuración-del-frontend)
11. [Servir el frontend con Nginx](#11-servir-el-frontend-con-nginx)
12. [Firewall y red](#12-firewall-y-red)
13. [Verificación paso a paso](#13-verificación-paso-a-paso)
14. [Migración de datos PostgreSQL → Oracle](#14-migración-de-datos-postgresql--oracle)
15. [Mantenimiento, backups y logs](#15-mantenimiento-backups-y-logs)
16. [Resolución de problemas](#16-resolución-de-problemas)
17. [Checklist final](#17-checklist-final)

---

## 1. Resumen del stack y requisitos

### 1.1 Stack final

| Componente        | Tecnología                    | Puerto / Observación |
|-------------------|-------------------------------|----------------------|
| Sistema operativo | Debian 12 (Bookworm)          | —                    |
| Base de datos     | Oracle Database               | 1521 (o el que indique el DBA) |
| Backend API       | Node.js 20 + Express + TypeORM + oracledb | 3001                 |
| Frontend          | React (build estático)        | Servido por Nginx    |
| Servidor web      | Nginx                         | 80 (y opcionalmente 443) |
| Proceso backend   | PM2                           | Reinicio automático  |

### 1.2 Requisitos del equipo (ordenador IGSS Palín)

- **SO:** Debian 12 (Bookworm) instalado y actualizado.
- **Arquitectura:** x86_64 (64 bits).
- **RAM:** Mínimo 2 GB; recomendado 4 GB si Oracle corre en el mismo equipo.
- **Disco:** Mínimo 20 GB libres (más si la base Oracle está en el mismo servidor).
- **Red:** IP fija asignada por el área de red del IGSS (ej. `192.168.1.100` o la que te den para Palín).
- **Acceso:** Usuario con permisos `sudo` (por SSH o consola física).
- **Oracle:** Puede estar en **otro servidor** (recomendado) o en el mismo equipo; en cualquier caso necesitas usuario/esquema Oracle para la aplicación.

### 1.3 Qué se deja de usar

- PostgreSQL (driver `pg`, puerto 5432).
- Cualquier script o variable de entorno referida a `DB_NAME` tipo base Postgres; en Oracle se usa **usuario/esquema** y **service name** o **SID**.

---

## 2. Información que debes tener antes de empezar

Coordina con el área de bases de datos del IGSS (o quien administre Oracle) y pide lo siguiente por escrito:

| Dato | Ejemplo | Descripción |
|------|---------|-------------|
| **Host / IP del servidor Oracle** | `192.168.10.50` o `oracle.igss.local` | Donde escucha el listener de Oracle. |
| **Puerto** | `1521` | Puerto del listener (por defecto 1521). |
| **Service Name** | `ORCLPDB1.igss.local` o `XEPDB1` | Identificador del servicio (recomendado sobre SID en entornos recientes). |
| **SID** (solo si no usan Service Name) | `ORCL` | Identificador de instancia. |
| **Usuario del esquema** | `PORTAL_DIGITAL` | Usuario que usará la aplicación. |
| **Contraseña** | (valor seguro) | Contraseña de ese usuario. |
| **Permisos** | CREATE SESSION, CREATE TABLE, etc. | El esquema debe poder crear tablas, secuencias, etc., si usas `synchronize: true` en desarrollo; en producción suele crearse el esquema con un script. |

Anota todo en un lugar seguro; lo usarás en el archivo `.env` del backend.

---

## 3. Preparación del equipo servidor (Debian 12)

Ejecutar **en el ordenador que actuará como servidor** (el de Palín), con sesión que tenga `sudo`.

### 3.1 Actualizar el sistema

```bash
sudo apt update
sudo apt upgrade -y
```

### 3.2 Instalar paquetes base necesarios

```bash
sudo apt install -y curl wget git build-essential libaio1 unzip
```

- `libaio1`: requerido por Oracle Instant Client.
- `unzip`: para descomprimir el Instant Client.

### 3.3 Configurar hostname (opcional pero recomendado)

```bash
# Ver nombre actual
hostnamectl

# Asignar un nombre identificable (ej. portaldigital-palin)
sudo hostnamectl set-hostname portaldigital-palin
```

Editar `/etc/hosts` para que la IP del equipo resuelva a ese nombre:

```bash
sudo nano /etc/hosts
```

Añadir o ajustar una línea como (sustituir por la IP real del equipo):

```
192.168.1.100   portaldigital-palin
```

Guardar y salir (Ctrl+O, Enter, Ctrl+X).

### 3.4 Asignar IP fija (si no está ya configurada)

Si el equipo debe tener IP fija en la red del IGSS:

- En entorno con **NetworkManager** (Debian 12 suele llevarlo):

```bash
sudo nmtui
```

Elegir "Edit a connection" → la conexión activa (ej. Ethernet) → IPv4 → Manual → Addresses: añadir la IP que te hayan dado (ej. `192.168.1.100/24`), Gateway y DNS según indique el área de red. Guardar y activar.

- O editar a mano el archivo de la conexión bajo `/etc/NetworkManager/system-connections/` o, en configuración clásica, `/etc/network/interfaces`. Si no estás seguro, pide a soporte de red que dejen el equipo con IP fija.

Comprobar:

```bash
ip addr show
```

Debe verse la IP fija asignada.

---

## 4. Instalación de Node.js

El proyecto requiere Node.js 18 o superior. Se recomienda Node 20 LTS.

### 4.1 Añadir el repositorio NodeSource (Node 20)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
```

### 4.2 Instalar Node.js y npm

```bash
sudo apt install -y nodejs
```

### 4.3 Verificar

```bash
node -v
npm -v
```

Debe mostrarse algo como `v20.x.x` y la versión de npm correspondiente.

---

## 5. Instalación de Oracle Instant Client

El driver **oracledb** en Node.js necesita las bibliotecas de **Oracle Instant Client** en el servidor. Sin esto, `require('oracledb')` fallará.

### 5.1 Descargar Oracle Instant Client (Basic)

- Desde un navegador, ir a:  
  https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html  
- Aceptar la licencia y descargar **Instant Client Basic** para Linux x86-64 (archivo `.zip`), versión 19 o 21 (o la que indique tu versión de Oracle).
- Si el servidor no tiene navegador, descargar el `.zip` en otro equipo y copiarlo al servidor por SCP, USB o red (ej. a `/tmp/` o a `/opt/`).

### 5.2 Descomprimir en el servidor

Suponiendo que el zip está en `/tmp`:

```bash
sudo unzip -o /tmp/instantclient-basic-linux.x64-*.zip -d /opt
```

Esto crea un directorio como `/opt/instantclient_21_13` (el número puede variar). Anota la ruta exacta.

### 5.3 Configurar las bibliotecas para que el sistema las encuentre

Crear un archivo de configuración para el cargador de bibliotecas:

```bash
echo "/opt/instantclient_21_13" | sudo tee /etc/ld.so.conf.d/oracle-instantclient.conf
```

**Importante:** sustituir `instantclient_21_13` por el nombre real del directorio que se creó en `/opt`.

Actualizar la caché del cargador:

```bash
sudo ldconfig
```

### 5.4 Variables de entorno para el usuario que ejecutará Node

Para que tanto la sesión actual como las futuras (y PM2) tengan la ruta de Instant Client:

```bash
echo 'export LD_LIBRARY_PATH=/opt/instantclient_21_13:$LD_LIBRARY_PATH' >> ~/.bashrc
source ~/.bashrc
```

De nuevo, usar el nombre real del directorio si es distinto.

### 5.5 Comprobar que las bibliotecas se cargan

```bash
ls -la /opt/instantclient_21_13/libclntsh.so*
```

Debe existir un enlace o archivo `libclntsh.so`. Si no, revisar la descarga y la versión (Basic incluye lo necesario para oracledb).

---

## 6. Subir el proyecto al servidor

Tienes dos opciones: clonar por Git o copiar la carpeta del proyecto.

### 6.1 Opción A: Clonar con Git

Si el proyecto está en un repositorio Git al que el servidor tiene acceso:

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone <URL_DEL_REPOSITORIO> PortalDigitalIGSS
cd PortalDigitalIGSS
```

Sustituir `<URL_DEL_REPOSITORIO>` por la URL real (HTTPS o SSH).

### 6.2 Opción B: Copiar desde tu PC (Windows) al servidor

Desde **PowerShell** o **CMD** en tu máquina (sustituir usuario e IP por los del servidor Palín):

```powershell
scp -r C:\PROYECTOS-PERSONALES\PortalDigitalIGSS usuario@192.168.1.100:/var/www/
```

O usar **WinSCP** / **FileZilla**: conectar por SFTP al servidor e subir la carpeta `PortalDigitalIGSS` a `/var/www/`.

Recomendación: no subir `node_modules` ni `frontend/build` para ahorrar tiempo; se instalarán y generarán en el servidor.

### 6.3 Comprobar estructura

En el servidor:

```bash
ls -la /var/www/PortalDigitalIGSS
```

Debe verse algo como: `backend`, `frontend`, `docs`, etc.

---

## 7. Cambios obligatorios en el código (Backend → Oracle)

Estos cambios debes hacerlos **antes** de desplegar (pueden hacerse en tu PC y luego subir el código, o directamente en el servidor si editas ahí). Sin ellos, la aplicación seguirá intentando usar PostgreSQL.

### 7.1 Archivo: `backend/src/data-source.ts`

**Objetivo:** Usar Oracle y leer la configuración de variables de entorno.

Reemplazar todo el contenido del `DataSource` para que quede así (ajustando nombres de entidades si en tu proyecto hay alguno distinto):

```typescript
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { User } from './entity/User';
import { UnidadMedica } from './entity/UnidadMedica';
import { Credential } from './entity/Credential';
import { Role } from './entity/Role';
import { Permission } from './entity/Permission';
import { Puesto } from './entity/Puesto';
import { Area } from './entity/Area';
import { Departamento } from './entity/Departamento';
import { Municipio } from './entity/Municipio';
import { SiafSolicitud, SiafItem, SiafSubproducto, SiafAutorizacion, SiafDocumentoAdjunto, SiafBitacora } from './entity/SiafSolicitud';
import { Expediente, ExpedienteDocumento, ExpedienteBitacora, ExpedienteBitacoraDetalle, ExpedienteDocumentoVersion } from './entity/Expediente';
import { ProductoCatalogo } from './entity/ProductoCatalogo';

export const AppDataSource = new DataSource({
  type: 'oracle',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 1521,
  username: process.env.DB_USER || 'PORTAL_DIGITAL',
  password: process.env.DB_PASSWORD || '',
  sid: process.env.DB_SID || undefined,
  serviceName: process.env.DB_SERVICE_NAME || undefined,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
  entities: [
    User,
    UnidadMedica,
    Credential,
    Role,
    Permission,
    Puesto,
    Area,
    Departamento,
    Municipio,
    SiafSolicitud,
    SiafItem,
    SiafSubproducto,
    SiafAutorizacion,
    SiafDocumentoAdjunto,
    SiafBitacora,
    Expediente,
    ExpedienteDocumento,
    ExpedienteBitacora,
    ExpedienteBitacoraDetalle,
    ExpedienteDocumentoVersion,
    ProductoCatalogo
  ],
  migrations: [],
  subscribers: [],
});
```

Regla: en producción usar **solo uno** de `sid` o `serviceName`; el otro dejarlo `undefined`. En `.env` pondrás `DB_SERVICE_NAME=...` o `DB_SID=...` según lo que te haya dado el DBA.

### 7.2 Archivo: `backend/package.json`

**Quitar** la dependencia de PostgreSQL y **añadir** Oracle y dotenv:

- En `dependencies`: eliminar `"pg": "^8.16.3"` y añadir `"oracledb": "^6.0.0"` y `"dotenv": "^16.0.0"`.
- En `devDependencies`: eliminar `"@types/pg": "^8.16.0"`.

Ejemplo de bloque `dependencies` resultante:

```json
"dependencies": {
  "@types/multer": "^2.0.0",
  "@types/pdfkit": "^0.17.4",
  "bcryptjs": "^3.0.3",
  "cors": "^2.8.5",
  "dotenv": "^16.0.0",
  "express": "^5.1.0",
  "jsonwebtoken": "^9.0.3",
  "multer": "^2.0.2",
  "oracledb": "^6.0.0",
  "pdfkit": "^0.17.2",
  "reflect-metadata": "^0.2.2",
  "typeorm": "^0.3.27",
  "xlsx": "^0.18.5"
}
```

### 7.3 Migración `runUserRolesMigration` y arranque (index.ts)

La migración actual usa el cliente `pg` y SQL de PostgreSQL. La opción más simple para Oracle es **no ejecutarla** en el arranque y asegurar que el esquema Oracle ya tenga la tabla `user_roles` y que la tabla `user` no tenga columna `roleId` (eso se hace en el script de creación de esquema en Oracle).

En `backend/src/index.ts`:

- Buscar la línea que hace:
  `runUserRolesMigration().then(() => AppDataSource.initialize())`
- Sustituir por **solo**:
  `AppDataSource.initialize()`

Es decir, quitar la llamada a `runUserRolesMigration()` y la importación de ese módulo si ya no se usa en ningún otro sitio. Así el arranque solo inicializa TypeORM contra Oracle.

Si más adelante necesitas una migración equivalente en Oracle, habría que reescribirla usando TypeORM o `oracledb` y sintaxis Oracle (USER_TAB_COLUMNS, etc.); no es necesario para el primer despliegue si el esquema se crea con un script SQL.

### 7.4 Bloque de “asegurar columnas” y SQL específico de Postgres (index.ts)

En `backend/src/index.ts`, tras `AppDataSource.initialize()`, hay un bloque que ejecuta varios `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` y un `UPDATE ... LIMIT 1`. Oracle **no** soporta `ADD COLUMN IF NOT EXISTS` ni `LIMIT` en subconsultas con esa sintaxis.

Opciones:

- **Recomendado para producción:** Que el DBA incluya todas esas columnas en el script de creación del esquema Oracle. Luego **eliminar o comentar** todo ese bloque (desde el primer `try {` que hace ALTER de bitácora hasta el cierre del último `catch` que toca unidad_origen/municipio_origen y el bloque de asignar siaf_id a correcciones). Así el arranque no ejecuta SQL incompatible con Oracle.
- Si quieres mantener lógica “por si falta una columna”, habría que reescribir cada operación en SQL Oracle (consultar USER_TAB_COLUMNS, usar PL/SQL para ADD COLUMN condicional, y sustituir `LIMIT 1` por `FETCH FIRST 1 ROW ONLY` o ROWNUM). Para no alargar esta guía, se deja como tarea opcional; lo seguro es tener el esquema creado de una vez en Oracle.

### 7.5 Consultas con ILIKE (index.ts)

Oracle no tiene `ILIKE`. Hay que sustituir cada uso de `ILIKE` por una condición que use `UPPER(...) LIKE UPPER(:param)`.

Buscar y reemplazar en `backend/src/index.ts`:

| Buscar (aprox.) | Reemplazar por |
|-----------------|----------------|
| `puesto.nombre ILIKE :puestoNombre` | `UPPER(puesto.nombre) LIKE UPPER(:puestoNombre)` |
| `(puesto.nombre ILIKE :patron)` | `(UPPER(puesto.nombre) LIKE UPPER(:patron))` |
| `solicitud.nombreUnidad ILIKE :municipioPattern` | `UPPER(solicitud.nombreUnidad) LIKE UPPER(:municipioPattern)` |
| `solicitud.nombreUnidad ILIKE :municipioPatternSinAcento` | `UPPER(solicitud.nombreUnidad) LIKE UPPER(:municipioPatternSinAcento)` |
| `solicitud.nombreUnidad ILIKE :deptoPattern` | `UPPER(solicitud.nombreUnidad) LIKE UPPER(:deptoPattern)` |

Aplicar a **todas** las apariciones de `ILIKE` en ese archivo (las líneas que encontraste con grep: director, médicos, filtros por municipio/departamento).

### 7.6 Consultas con placeholders $1, $2 (index.ts)

PostgreSQL usa `$1`, `$2`, ... Oracle con TypeORM/oracledb usa `:1`, `:2`, ... (o parámetros por nombre). Sustituir en **todas** las cadenas SQL que usan `$1`, `$2`, etc.:

- `$1` → `:1`
- `$2` → `:2`
- `$3` → `:3`
- `$4` → `:4`
- `$5` → `:5`

Ubicaciones aproximadas (por contenido):

1. **loadBitacoraBySiafId** – consulta principal bitácora:
   - `WHERE siaf_id = $1` → `WHERE siaf_id = :1`
2. **loadBitacoraBySiafId** – subconsulta EXISTS:
   - `r.siaf_id = $1 ... LIMIT 1` → en Oracle usar `:1` y `FETCH FIRST 1 ROW ONLY` (o equivalente según versión). Ejemplo:
   - `AND EXISTS (SELECT 1 FROM siaf_bitacora r WHERE r.siaf_id = :1 AND r.tipo = 'rechazo' AND r.fecha < b.fecha ORDER BY r.fecha DESC FETCH FIRST 1 ROW ONLY)`
3. **GET /api/siaf/:id** – bitacoraRows:
   - `WHERE siaf_id = $1` → `WHERE siaf_id = :1`
4. **INSERT en bitácora (corrección)** – valores:
   - `VALUES ($1, $2, 'correccion', $3, $4, $5)` → `VALUES (:1, :2, 'correccion', :3, :4, :5)`
5. **SELECT tras el INSERT** (bitácora por siaf_id):
   - `WHERE siaf_id = $1` → `WHERE siaf_id = :1`

TypeORM con Oracle suele aceptar los mismos arrays de parámetros `[siafId]` o `[a, b, c, d, e]` cuando usas `:1`, `:2`, etc. Si en tu versión pide otro formato, ajusta según la documentación de TypeORM para Oracle.

### 7.7 Uso de LIMIT en subconsultas (Oracle)

Donde tengas subconsultas con `ORDER BY ... LIMIT 1`, en Oracle 12c+ se usa:

```sql
ORDER BY ... FETCH FIRST 1 ROW ONLY
```

O, en versiones anteriores:

```sql
WHERE ROWNUM = 1
```

(con una subconsulta exterior si hace falta ordenar antes). Ajusta las dos consultas dentro de `loadBitacoraBySiafId` y cualquier otra que use `LIMIT 1` en raw SQL.

### 7.8 Resumen de archivos tocados

| Archivo | Cambios |
|---------|--------|
| `backend/src/data-source.ts` | type `oracle`, host/port/username/password/sid o serviceName desde `process.env`, synchronize/logging desde env. |
| `backend/package.json` | Quitar `pg` y `@types/pg`; añadir `oracledb` y `dotenv`. |
| `backend/src/index.ts` | Quitar `runUserRolesMigration` del arranque; comentar o eliminar bloque ALTER/UPDATE con IF NOT EXISTS y LIMIT; reemplazar ILIKE por UPPER/LIKE; reemplazar $1,$2 por :1,:2; adaptar LIMIT a FETCH FIRST 1 ROW ONLY (o ROWNUM). |
| `backend/src/migrations/migrate-user-roles.ts` | No se ejecuta; opcionalmente dejar el archivo por referencia o borrarlo si no lo usarás en Oracle. |

---

## 8. Configuración del Backend en el servidor

Todo en el equipo Debian (Palín), dentro de `/var/www/PortalDigitalIGSS`.

### 8.1 Instalar dependencias del backend

```bash
cd /var/www/PortalDigitalIGSS/backend
npm install
```

Si aparece error de `oracledb` (ej. “Cannot find module 'oracledb'” o fallo al cargar bibliotecas), revisar que Oracle Instant Client esté instalado y que `LD_LIBRARY_PATH` incluya su ruta (pasos 5.3–5.5).

### 8.2 Crear archivo .env del backend

```bash
nano /var/www/PortalDigitalIGSS/backend/.env
```

Contenido (sustituir por los valores reales que te dio el DBA):

```env
PORT=3001
NODE_ENV=production

# Oracle
DB_HOST=192.168.10.50
DB_PORT=1521
DB_USER=PORTAL_DIGITAL
DB_PASSWORD=TuPasswordSeguro
DB_SERVICE_NAME=ORCLPDB1.igss.local

# Opcional: solo si usan SID en lugar de Service Name
# DB_SID=ORCL

# En producción normalmente false; true solo para que TypeORM cree tablas automáticamente (desarrollo/pruebas)
DB_SYNCHRONIZE=false
DB_LOGGING=false

# JWT (generar uno seguro, ej. openssl rand -base64 32)
JWT_SECRET=TuJwtSecretMuyLargoYSeguro
```

Guardar (Ctrl+O, Enter, Ctrl+X).

### 8.3 Directorio de subidas (uploads)

El backend guarda archivos en un directorio `uploads` (relativo al backend). Crearlo y dar permisos:

```bash
mkdir -p /var/www/PortalDigitalIGSS/backend/uploads
chown -R $USER:$USER /var/www/PortalDigitalIGSS/backend/uploads
```

### 8.4 Logo para el PDF (assets)

El PDF del SIAF busca el logo en `backend/assets/logo-igss.png`. Si en el frontend tienes el logo:

```bash
cp /var/www/PortalDigitalIGSS/frontend/public/images/logoIgss.png /var/www/PortalDigitalIGSS/backend/assets/logo-igss.png
```

O copiarlo desde donde lo tengas y dejarlo como `backend/assets/logo-igss.png`.

### 8.5 Compilar TypeScript

```bash
cd /var/www/PortalDigitalIGSS/backend
npx tsc
```

Debe generarse la carpeta `dist/` sin errores. Si hay errores de tipos o de sintaxis, corregirlos antes de seguir.

---

## 9. Ejecutar el Backend con PM2

### 9.1 Instalar PM2 globalmente

```bash
sudo npm install -g pm2
```

### 9.2 Iniciar el backend

```bash
cd /var/www/PortalDigitalIGSS/backend
pm2 start dist/index.js --name portaldigital-api --node-args="--max-old-space-size=4096"
```

### 9.3 Comprobar estado y logs

```bash
pm2 status
pm2 logs portaldigital-api
```

En los logs debe aparecer algo como “Base de datos conectada exitosamente”. Si hay error de conexión a Oracle, revisar `.env`, red (ping al host Oracle), puerto y que el usuario/contraseña y service name sean correctos.

### 9.4 Arranque automático al reiniciar el servidor

```bash
pm2 startup
```

Ejecutar el comando que PM2 muestre (suele ser algo como `sudo env PATH=... pm2 startup systemd -u ...`). Luego:

```bash
pm2 save
```

Así, al reiniciar el equipo de Palín, el backend volverá a levantarse.

---

## 10. Configuración del Frontend

### 10.1 Variables de entorno del frontend

La URL de la API debe apuntar al **servidor** (el mismo equipo o la IP que usarán los usuarios para acceder al portal). Crear o editar:

```bash
nano /var/www/PortalDigitalIGSS/frontend/.env
```

Contenido (sustituir por la IP o hostname real del equipo Palín):

```env
PORT=3003
BROWSER=none
GENERATE_SOURCEMAP=false
REACT_APP_API_URL=http://192.168.1.100:3001
NODE_OPTIONS=--max-old-space-size=4096
```

Si más adelante usas Nginx como proxy para la API (misma origen), podrías usar solo `http://192.168.1.100` y en Nginx hacer proxy de `/api` al puerto 3001; entonces aquí pondrías `REACT_APP_API_URL=http://192.168.1.100`.

### 10.2 Instalar dependencias y generar build

```bash
cd /var/www/PortalDigitalIGSS/frontend
npm install
npm run build
```

Debe crearse la carpeta `frontend/build` con los estáticos (HTML, JS, CSS).

---

## 11. Servir el frontend con Nginx

### 11.1 Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 11.2 Crear el sitio del Portal Digital

```bash
sudo nano /etc/nginx/sites-available/portaldigital
```

Contenido (sustituir `192.168.1.100` por la IP o hostname del equipo Palín si es distinto):

```nginx
server {
    listen 80;
    server_name 192.168.1.100;

    root /var/www/PortalDigitalIGSS/frontend/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }
}
```

Guardar y salir.

### 11.3 Activar el sitio y recargar Nginx

```bash
sudo ln -sf /etc/nginx/sites-available/portaldigital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Si `nginx -t` muestra error, corregir la configuración antes de hacer `reload`.

---

## 12. Firewall y red

Si el firewall (ufw) está activo:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
sudo ufw status
sudo ufw enable
```

Así los equipos de la red podrán acceder por HTTP (80) y tú por SSH (22). El puerto 3001 no es necesario abrirlo si todo pasa por Nginx con el proxy `/api/`.

---

## 13. Verificación paso a paso

1. **Oracle:** Desde el servidor, probar conectividad (si tienes `sqlplus` o cliente Oracle instalado) al host/puerto del DBA. Si no, al menos `ping` al host de Oracle.
2. **Backend:** `curl -s http://127.0.0.1:3001/api/` (o una ruta que exista). Debe responder algo del API, no error de conexión.
3. **Frontend:** Desde un navegador en la red, abrir `http://192.168.1.100` (o la IP que configuraste). Debe cargar la aplicación (login).
4. **Login:** Iniciar sesión con un usuario que exista en Oracle (creado por seeders o migrado). Probar crear un SIAF, subir adjunto y revisar que la bitácora y el PDF se generen correctamente.

---

## 14. Migración de datos PostgreSQL → Oracle

Si ya tenías datos en PostgreSQL y quieres llevarlos a Oracle:

1. **Esquema en Oracle:** El DBA crea el esquema (tablas, secuencias, FKs) según el modelo del Portal (puedes basarte en `docs/DIAGRAMA-ENTIDAD-RELACION-PORTAL-DIGITAL-IGSS.md` y en las entidades TypeORM). Incluir todas las columnas que el código espera (incluidas las que hoy se “aseguraban” con ALTER en Postgres).
2. **Exportar desde PostgreSQL:** Por tabla con `COPY ... TO STDOUT WITH CSV` o con herramientas (pg_dump en formato custom, luego restauración selectiva). O exportar a CSV por tabla.
3. **Importar en Oracle:** Con SQL*Loader, scripts de INSERT, o herramientas ETL. Ajustar secuencias después de cargar para que los próximos IDs no choquen.
4. **Validar:** Conteos por tabla, revisión de usuarios, SIAFs y expedientes críticos.

Este trabajo suele coordinarse con el DBA; aquí solo se indica el flujo.

---

## 15. Mantenimiento, backups y logs

- **Logs del backend:** `pm2 logs portaldigital-api`
- **Reiniciar backend:** `cd /var/www/PortalDigitalIGSS/backend && npx tsc && pm2 restart portaldigital-api`
- **Reconstruir frontend:** `cd /var/www/PortalDigitalIGSS/frontend && npm run build`. No hace falta reiniciar Nginx si solo cambias estáticos.
- **Backups:** Hacer copias periódicas de la base Oracle (según procedimiento del IGSS) y del directorio `backend/uploads`.

---

## 16. Resolución de problemas

- **Error “Cannot find module 'oracledb'” o fallo al cargar oracledb:** Comprobar que `npm install oracledb` se ejecutó en `backend` y que Oracle Instant Client está en `/opt/...` y en `LD_LIBRARY_PATH` (y que `ldconfig` se ejecutó). Reiniciar PM2 tras cambios de entorno.
- **Error de conexión a Oracle (ORA-12154, ORA-12541, etc.):** Revisar host, puerto, service name/SID y que el listener de Oracle permita conexiones desde la IP del servidor Palín. Verificar firewall entre Palín y el servidor Oracle.
- **Páginas en blanco o 404 al navegar:** Revisar que `root` de Nginx apunte a `frontend/build` y que `try_files` incluya ` /index.html`.
- **API no responde:** Comprobar que PM2 tiene el proceso activo y que el puerto 3001 está en uso (`ss -tlnp | grep 3001`). Revisar logs de PM2.

---

## 17. Checklist final

- [ ] Debian 12 actualizado; hostname e IP fija configurados.
- [ ] Node.js 20 instalado.
- [ ] Oracle Instant Client instalado; `LD_LIBRARY_PATH` y `ldconfig` configurados.
- [ ] Proyecto en `/var/www/PortalDigitalIGSS`.
- [ ] `data-source.ts` con type `oracle` y variables de entorno.
- [ ] `package.json` sin `pg`, con `oracledb` y `dotenv`.
- [ ] `index.ts`: sin `runUserRolesMigration` en arranque; bloque ALTER/UPDATE Postgres comentado o eliminado; ILIKE → UPPER/LIKE; $1/$2 → :1/:2; LIMIT adaptado a Oracle.
- [ ] `backend/.env` con DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_SERVICE_NAME (o DB_SID) y JWT_SECRET.
- [ ] `backend/uploads` y `backend/assets/logo-igss.png` listos.
- [ ] `npm install` y `npx tsc` en backend sin errores.
- [ ] PM2 iniciado y guardado con `pm2 save` y `pm2 startup` ejecutado.
- [ ] `frontend/.env` con REACT_APP_API_URL apuntando al servidor.
- [ ] `npm run build` en frontend correcto.
- [ ] Nginx con sitio `portaldigital` activo y `nginx -t` correcto.
- [ ] Firewall permite 80 y 22.
- [ ] Prueba de acceso por navegador y login con usuario en Oracle.

Con esto queda documentado todo el despliegue en el ordenador del IGSS Palín con Debian 12 y Oracle, sin omitir pasos. Si un paso concreto falla, usar la sección de resolución de problemas y los logs de PM2 y Nginx para afinar.
