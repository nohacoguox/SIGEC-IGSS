# Guía detallada: llevar SIGEC-IGSS de Windows (PC física) a Debian 12

**Nombre del producto:** **SIGEC-IGSS** (*Sistema Integral de Gestión de Expedientes de Compras del IGSS*).  
**En PostgreSQL:** base `igss`, esquema `sigec_igss`, usuario `portal_app`.

Esta guía asume:

- Desarrollaste el proyecto en **Windows** (la carpeta en disco puede seguir llamándose `PortalDigitalIGSS` o ya la renombraste; da igual mientras el **código** sea el mismo).
- En el **servidor Debian 12** ya tienes **PostgreSQL** creado (`igss`, `sigec_igss`, `portal_app`).
- Quieres dejar el **backend (API)** y el **frontend (React)** corriendo en Debian, usando esa base de datos.
- **Red institucional (IGSS):** el acceso será por **IP** o **nombre DNS interno** (no hace falta comprar dominio público ni certificado Let’s Encrypt si solo usáis HTTP dentro de la red). Los usuarios abrirán el sistema desde sus PCs con algo como `http://10.x.x.x` o `http://sigec.interno.igss` si IT os da un nombre.
- **DHCP:** la URL del frontend se **congela en el build** (`REACT_APP_API_URL`). Si la IP del servidor **cambia**, hay que **volver a compilar** el frontend con la IP nueva. Por eso en producción se recomienda **IP fija** o **reserva DHCP por MAC** del servidor (pedirlo a redes/IT).

**Carpeta recomendada en el servidor Linux:** `/var/www/sigec-igss` (minúsculas y guion; evita espacios y mayúsculas en rutas).

**Usuario Linux recomendado:** un solo usuario para despliegue (por ejemplo `noe` o `deploy`) que sea **dueño** de `/var/www/sigec-igss`, ejecute `git pull`, `npm install`, `npm run build` y **PM2**. Evita correr la aplicación como `root` salvo tareas puntuales (`sudo` para Nginx, firewall, `apt`).

### Servidor documentado: Palín / `servidor-igss` (IP fija)

| Dato | Valor |
|------|--------|
| Equipo | `servidor-igss` (Debian 12) |
| **IP fija en red institucional** | **`10.4.201.74`** |
| URL que usarán los usuarios (HTTP, Nginx puerto 80) | **`http://10.4.201.74`** |
| Contenido de **`frontend/.env`** (una línea) | `REACT_APP_API_URL=http://10.4.201.74` |

Después de que redes/IT deje la IP fija o reservada por MAC, comprueba en el servidor: `hostname -I` debe seguir mostrando **`10.4.201.74`**. Si en el futuro cambiara la IP, habría que actualizar `frontend/.env` y volver a ejecutar `npm run build`.

#### Checklist: qué haremos en orden (este despliegue)

1. **Código** en `/var/www/sigec-igss` (clone o copia) y dependencias: `npm install` en `backend/` y `frontend/`.  
2. **`backend/.env`**: PostgreSQL, `JWT_SECRET` (openssl), `DB_SYNCHRONIZE=true` solo la primera vez.  
3. **Backend**: `npx tsc`, arranque de prueba, tablas OK → `DB_SYNCHRONIZE=false` → **PM2** (`sigec-igss-api`).  
4. **`frontend/.env`** con `REACT_APP_API_URL=http://10.4.201.74` → **`npm run build`** (genera `frontend/build/`).  
5. **Nginx**: sitio con `root` en `frontend/build` y `proxy_pass` de `/api/` a `127.0.0.1:3001`; recargar Nginx.  
6. **Firewall (UFW)**: permitir SSH y HTTP (80).  
7. **Prueba** desde **otra PC** del IGSS: abrir **`http://10.4.201.74`** (no `localhost` en el cliente).

---

## Tabla de contenidos

1. [Qué vas a copiar y qué no](#1-qué-vas-a-copiar-y-qué-no)  
2. [Renombrar la carpeta en Windows (opcional)](#2-renombrar-la-carpeta-en-windows-opcional)  
3. [Preparar Git y subir el código (recomendado)](#3-preparar-git-y-subir-el-código-recomendado)  
4. [Preparar el servidor Debian](#4-preparar-el-servidor-debian)  
5. [Traer el proyecto al servidor](#5-traer-el-proyecto-al-servidor)  
6. [Verificar PostgreSQL en Debian](#6-verificar-postgresql-en-debian)  
7. [Configurar el backend (`backend/.env`)](#7-configurar-el-backend-backendenv)  
8. [Primera ejecución del backend y creación de tablas](#8-primera-ejecución-del-backend-y-creación-de-tablas)  
9. [Dejar el API en segundo plano (PM2)](#9-dejar-el-api-en-segundo-plano-pm2)  
10. [Compilar el frontend](#10-compilar-el-frontend)  
11. [Nginx: servir la web y proxy del API](#11-nginx-servir-la-web-y-proxy-del-api)  
12. [Firewall (UFW) y red institucional](#12-firewall-ufw-y-red-institucional)  
13. [Probar desde el navegador](#13-probar-desde-el-navegador)  
14. [Actualizar el sistema después (git pull)](#14-actualizar-el-sistema-después-git-pull)  
15. [Problemas frecuentes](#15-problemas-frecuentes)

---

## 1. Qué vas a copiar y qué no

| Sí necesitas en Debian | No hace falta copiar (se regenera en el servidor) |
|------------------------|---------------------------------------------------|
| Carpetas `backend/` y `frontend/` con **código fuente** (`.ts`, `.tsx`, `package.json`, etc.) | `node_modules/` (en backend y frontend) |
| Carpeta `docs/` (opcional, documentación) | `backend/.env` (lo creas **en el servidor** con secretos nuevos) |
| `backend/.env.example` como plantilla | `frontend/.env` del PC (no subir a Git; recrear en servidor) |
| Archivos estáticos del frontend (`public/`, imágenes) | Carpeta `frontend/build/` (la generas en Debian con `npm run build`) |

**La estructura de tablas** no se “exporta” desde Windows en un archivo mágico: la genera el **backend con TypeORM** la primera vez que conecta, si el esquema está vacío y usas `DB_SYNCHRONIZE=true` (solo esa primera vez; luego `false`).

Si además quieres **los mismos datos** que en tu PC (usuarios, expedientes, etc.), eso es otro paso: `pg_dump` / `pg_restore` (ver `MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md`).

---

## 2. Renombrar la carpeta en Windows (opcional)

Solo por orden visual en tu PC:

1. Cierra VS Code / Cursor y cualquier terminal dentro del proyecto.  
2. En el Explorador de archivos, renombra la carpeta, por ejemplo:  
   `C:\PROYECTOS-PERSONALES\PortalDigitalIGSS` → `C:\PROYECTOS-PERSONALES\SIGEC-IGSS`  
3. Vuelve a abrir el proyecto desde la nueva ruta.

**No es obligatorio** para desplegar: el nombre de la carpeta en Windows no afecta a Debian.

---

## 3. Preparar Git y subir el código (recomendado)

### 3.1 En Windows

1. Abre **PowerShell** en la carpeta del proyecto.  
2. Comprueba si ya hay repositorio Git:

```powershell
git status
```

3. Si no hay repo:

```powershell
git init
git add .
git commit -m "SIGEC-IGSS: código para despliegue Debian"
```

4. Crea un repositorio vacío en **GitHub / GitLab / etc.** (sin subir README si ya tienes uno local).  
5. Conecta y sube (sustituye la URL):

```powershell
git remote add origin https://github.com/TU_USUARIO/sigec-igss.git
git branch -M main
git push -u origin main
```

### 3.2 Qué no debe estar en Git

Asegúrate de que `.gitignore` incluya al menos:

- `node_modules/`
- `backend/.env`
- `frontend/.env`
- `*.log`

Si alguna vez subiste un `.env` con contraseñas, cámbialas en PostgreSQL y en el servidor.

---

## 4. Preparar el servidor Debian

Conéctate por **SSH** desde Windows (PowerShell):

```powershell
ssh tu_usuario@IP_DEL_SERVIDOR
```

### 4.1 Actualizar paquetes

```bash
sudo apt update && sudo apt upgrade -y
```

### 4.2 Instalar Node.js (LTS)

Opción simple con el Node del repositorio Debian (versión puede ser antigua):

```bash
sudo apt install -y nodejs npm
node -v
npm -v
```

Si necesitas **Node 20 LTS**, usa [NodeSource](https://github.com/nodesource/distributions) o `nvm`; para muchos proyectos React 18, Node 18+ basta.

### 4.3 Instalar Git (si vas a clonar)

```bash
sudo apt install -y git
```

### 4.4 Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 4.5 Instalar PM2 (gestor de procesos para Node)

```bash
sudo npm install -g pm2
```

### 4.6 Instalar cliente PostgreSQL (para probar `psql` desde el servidor)

```bash
sudo apt install -y postgresql-client
```

### 4.7 Usuario Linux, `sudo` y propiedad de `/var/www/sigec-igss`

- Crea o usa un usuario con permiso `sudo` para administración (Nginx, firewall, paquetes).
- **Despliegue de la app** (git, npm, PM2): idealmente **sin** ser `root`. Si todo el proyecto quedó en manos de un usuario (p. ej. `noe`), mantén **coherencia**:
  - `chown -R noe:noe /var/www/sigec-igss` (ajusta el nombre si usas otro usuario).
  - PM2 debe ejecutarse **como ese mismo usuario** (`pm2 startup` mostrará un comando; usa `-u noe` y `--hp /home/noe` si aplica).
- Si mezclaste `root` y otro usuario y ves archivos con dueño distinto, alinea con `chown` antes de seguir.

---

## 5. Traer el proyecto al servidor

### Opción A — `git clone` (recomendada)

```bash
sudo mkdir -p /var/www
sudo chown -R $USER:$USER /var/www
cd /var/www
git clone https://github.com/TU_USUARIO/sigec-igss.git sigec-igss
cd sigec-igss
ls -la
```

Debes ver carpetas `backend` y `frontend`.

### Opción B — Subir ZIP / WinSCP

1. En Windows, comprime la carpeta del proyecto **excluyendo** `node_modules` (y opcionalmente `frontend/build`).  
2. Sube el `.zip` al servidor con **WinSCP** o **scp**:

```powershell
scp C:\ruta\sigec-igss.zip tu_usuario@IP:/var/www/
```

3. En Debian:

```bash
cd /var/www
unzip sigec-igss.zip -d sigec-igss
# si el zip creó una subcarpeta, entra y mueve archivos hasta que quede /var/www/sigec-igss/backend y .../frontend
```

---

## 6. Verificar PostgreSQL en Debian

### 6.1 Comando directo (contraseña interactiva o variable de entorno)

Con el mismo usuario y base que usará el backend (`portal_app`, base `igss`):

```bash
psql -h 127.0.0.1 -p 5432 -U portal_app -d igss -c "SHOW search_path;"
```

Si te pide contraseña, puedes exportarla solo para esa sesión (sustituye la clave real):

```bash
export PGPASSWORD='TU_CONTRASEÑA_DE_PORTAL_APP'
psql -h 127.0.0.1 -p 5432 -U portal_app -d igss -c "SHOW search_path;"
unset PGPASSWORD
```

### 6.2 Usar los mismos valores que `backend/.env` (sin tipear host/puerto a mano)

Si ya tienes el `.env` del backend:

```bash
cd /var/www/sigec-igss/backend
set -a
. .env
set +a
export PGPASSWORD="$DB_PASSWORD"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SHOW search_path;"
unset PGPASSWORD
```

### 6.3 Qué debe salir

- Debe mostrar algo como `sigec_igss, public`.  
- Si falla la contraseña o el host, corrige antes de seguir (`pg_hba.conf`, contraseña del rol, etc.).  
- Si PostgreSQL está en **otra máquina**, usa su IP en `DB_HOST` en el `.env` (y abre el puerto 5432 solo si es necesario y con restricción).

Documentación del esquema: `POSTGRES-SCHEMA-SETUP.md`.

---

## 7. Configurar el backend (`backend/.env`)

```bash
cd /var/www/sigec-igss/backend
cp .env.example .env
nano .env
```

Rellena **línea a línea** (valores de ejemplo; ajusta a tu servidor):

```env
PORT=3001
NODE_ENV=production

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=igss
DB_USER=portal_app
DB_PASSWORD=TU_CONTRASEÑA_REAL_DE_PORTAL_APP
DB_SCHEMA=sigec_igss

# Primera vez con tablas vacías: true. Después de verificar que todo arranca: false
DB_SYNCHRONIZE=true
DB_LOGGING=false

JWT_SECRET=PON_AQUI_UN_VALOR_LARGO_Y_ALEATORIO
```

Guardar: en `nano`, `Ctrl+O`, Enter, `Ctrl+X`.

### 7.1 `JWT_SECRET` (qué es y cómo generarlo)

- **Qué es:** clave que usa el backend para **firmar y verificar** los tokens JWT. **No** es la contraseña de los usuarios.
- **Reglas:** cadena larga, aleatoria, **no** compartirla ni subirla a Git. Si la cambiás después, los usuarios con sesión abierta deben **volver a iniciar sesión**.
- **Generar un valor seguro en el servidor** (ejemplo):

```bash
openssl rand -base64 64
```

Copia la salida y pégala como única línea en `JWT_SECRET=...` en `backend/.env`.

---

## 8. Primera ejecución del backend y creación de tablas

Ejecuta estos pasos como el **mismo usuario** que será dueño del proyecto (no hace falta `root`).

```bash
cd /var/www/sigec-igss/backend
npm install
npx tsc
node dist/index.js
```

### 8.1 Si `npx tsc` devuelve `Permission denied`

Algunas copias de `node_modules` dejan `node_modules/.bin/tsc` **sin permiso de ejecución** (`-rw-r--r--`). Comprobación:

```bash
ls -l node_modules/.bin/tsc
```

Si no tiene `x`, corrige:

```bash
chmod +x node_modules/.bin/tsc
chmod +x node_modules/.bin/*
```

**Alternativa** que no depende del binario ejecutable:

```bash
node ./node_modules/typescript/bin/tsc
```

### 8.2 `npm install` y vulnerabilidades

Si `npm install` muestra “X vulnerabilities”, es un **informe de auditoría** de dependencias. No siempre bloquea el arranque. Para detalle:

```bash
npm audit
```

Puedes intentar `npm audit fix` cuando tengas tiempo de probar; si pide cambios mayores, revisa con el equipo antes de subir versiones en producción.

### 8.3 Qué observar al arrancar `node dist/index.js`

- Mensaje de conexión a la base de datos correcta.  
- Si el esquema estaba vacío, TypeORM creará tablas en `sigec_igss`.  
- Errores de conexión → revisa `.env` y `psql`.

Comprobar tablas:

```bash
psql -h 127.0.0.1 -U portal_app -d igss -c "\dt sigec_igss.*"
```

Cuando todo esté bien:

1. Detén el proceso (`Ctrl+C`).  
2. Edita `.env` → **`DB_SYNCHRONIZE=false`**.  
3. Vuelve a ejecutar `node dist/index.js` o pasa al paso PM2.

### 8.4 (Opcional) Seeders de roles y catálogos

Desde `backend`:

```bash
npm run seed-roles
npm run seed-departamentos-municipios
```

`seed-roles` crea permisos y roles de negocio; si no existía el rol **super administrador**, el script de arranque del siguiente apartado lo crea con todos los permisos.

### 8.5 Primer usuario cuando la BD no tiene registros (`seed-bootstrap-admin`)

El login exige un **usuario** y una **credencial** (contraseña con hash bcrypt) en PostgreSQL. El proyecto incluye un script **idempotente** que solo actúa si **no hay ningún usuario** (tabla `user` vacía).

**Orden recomendado:**

1. Tablas creadas y `seed-roles` ejecutado (apartado 8.4).  
2. En `backend/.env` puedes definir (opcional) credenciales de **solo entorno de prueba**:

```env
# Opcional — valores por defecto si omites estas líneas
BOOTSTRAP_ADMIN_CODE=admin
BOOTSTRAP_ADMIN_PASSWORD=CambiarEstaClave123!
BOOTSTRAP_NOMBRES=Administrador
BOOTSTRAP_APELLIDOS=SIGEC
BOOTSTRAP_DPI=0000000000001
BOOTSTRAP_NIT=000000-0
BOOTSTRAP_TELEFONO=00000000
BOOTSTRAP_CORREO=sigec.bootstrap@local
```

3. Ejecutar en el servidor (o en tu PC local con la misma BD vacía):

```bash
cd /var/www/sigec-igss/backend
npm run seed-bootstrap-admin
```

4. En el navegador, **Iniciar sesión** con **código de empleado** = `BOOTSTRAP_ADMIN_CODE` (por defecto `admin`) y la contraseña indicada. La credencial queda como **temporal**; conviene cambiarla tras entrar.

**Comportamiento:**

- Si **ya existe al menos un usuario**, el script **no crea nada** (evita duplicar admins).  
- Para forzar otro intento en casos excepcionales existe `FORCE_BOOTSTRAP_ADMIN=1` (puede fallar por unicidad de DPI/NIT/código; solo uso consciente).

**Seguridad:** en producción cambia la contraseña al instante y no dejes valores por defecto en `.env` versionado. Lo ideal es **no subir** `BOOTSTRAP_*` a Git.

### 8.6 Login

Con el usuario creado (8.5 o restauración de datos), el acceso es por **código de empleado** + **contraseña** en la pantalla de login.

**Nota:** `FileStorageService` usa **`/var/www/sigec-igss/backend/uploads`** (ruta relativa al código: `path.join(__dirname, '../../uploads')` respecto a `dist/services/` o `src/services/`). Si el repositorio ya trae la carpeta `uploads/`, **no hace falta** volver a crearla; solo asegúrate de que el usuario que ejecuta Node pueda **escribir** ahí (ver sección 9).

---

## 9. Dejar el API en segundo plano (PM2)

```bash
cd /var/www/sigec-igss/backend
npx tsc
pm2 start dist/index.js --name sigec-igss-api
pm2 save
pm2 startup
# Ejecuta la línea completa que muestre `pm2 startup` (suele llevar sudo)
```

**Importante:** `pm2 startup` debe generarse para el **usuario que corre la app** (no mezclar PM2 de `root` con archivos de `noe`). Si ya ejecutaste PM2 como `root` por error, revisa `pm2 list` y la documentación de PM2 para unificar usuario.

Comandos útiles:

```bash
pm2 status
pm2 logs sigec-igss-api
pm2 restart sigec-igss-api
```

### 9.1 Carpeta `uploads` (subidas y adjuntos)

El código guarda archivos bajo **`/var/www/sigec-igss/backend/uploads`** (ver `backend/src/services/FileStorageService.ts`).

- Si **no existe** la carpeta:

```bash
mkdir -p /var/www/sigec-igss/backend/uploads
chmod u+rwX /var/www/sigec-igss/backend/uploads
```

- Si **ya existe** en el repositorio (por ejemplo con subcarpetas `expedientes/`, `siaf/`), **no hace falta** volver a crearla con `mkdir -p`; solo verifica permisos para el usuario que ejecuta Node:

```bash
chown -R noe:noe /var/www/sigec-igss/backend/uploads
# sustituye noe por tu usuario de despliegue
```

Prueba de escritura (como el usuario de la app):

```bash
sudo -u noe touch /var/www/sigec-igss/backend/uploads/.test && sudo -u noe rm /var/www/sigec-igss/backend/uploads/.test
```

---

## 10. Compilar el frontend

El frontend arma la URL base del API en `frontend/src/api.ts`: toma `REACT_APP_API_URL`, le quita una barra final si la hay y añade `/api`. En este despliegue, con `REACT_APP_API_URL=http://10.4.201.74`, las peticiones van a `http://10.4.201.74/api/...`.

### 10.1 Variable `REACT_APP_API_URL` (muy importante)

Esa variable se **incrusta en el JavaScript en el momento del `npm run build`**. El **navegador de cada usuario** (PC o celular en la red IGSS) es quien hará las peticiones a esa URL.

**No** uses:

- `http://127.0.0.1` ni `http://localhost` como `REACT_APP_API_URL` para uso en red: desde otra máquina, `127.0.0.1` es **el propio PC del usuario**, no el servidor.

**Con Nginx en el puerto 80 haciendo proxy de `/api` al backend (recomendado en esta guía):** los usuarios abren la app con **`http://IP_DEL_SERVIDOR`** (sin puerto si es el 80). Entonces el build debe usar **exactamente esa misma base** (sin `/api` al final; el código ya añade `/api`).

Ejemplos válidos:

```env
# Este servidor (Palín, IP fija)
REACT_APP_API_URL=http://10.4.201.74

# Otro entorno (ejemplo genérico)
REACT_APP_API_URL=http://10.20.30.40

# Si en el futuro IT da un nombre DNS interno
REACT_APP_API_URL=http://sigec.interno.red-igss
```

```env
# Solo si tienes HTTPS con certificado (dominio o CA interna)
REACT_APP_API_URL=https://sigec.tudominio.com
```

### 10.2 Red institucional sin dominio público (Palín / IGSS)

Objetivo: que **cualquier PC de la red que pueda alcanzar la IP del servidor** abra el sistema con `http://IP`.

1. **Averigua la IP del servidor** (en el servidor):

```bash
hostname -I
```

2. **Estabilidad de la IP (DHCP):** si el servidor recibe IP por DHCP y **cambia al renovarse**, el frontend compilado seguirá apuntando a la IP vieja hasta que **vuelvas a poner** `REACT_APP_API_URL` con la IP nueva y ejecutes **`npm run build`**. Para evitar eso:
   - Pide a **redes/IT** una **reserva DHCP por MAC** o una **IP fija** para ese equipo.
3. **Orden recomendado (primer despliegue):** crea `frontend/.env` con la **IP o nombre que usarán todos** (sección 10.4), ejecuta **`npm run build`** (10.5) para generar `frontend/build/`, luego configura **Nginx** (sección 11) y recarga. Después comprueba desde el servidor: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/` debería devolver `200`. Nginx necesita que exista la carpeta `root` (`frontend/build`).
4. **Ruteo entre sedes/VLAN:** si algunos usuarios no alcanzan la IP, es un tema de **firewall o routing** en la red institucional; debe coordinarse con IT.

### 10.3 Si no usas Nginx y expones el puerto 3001 (no recomendado)

```env
REACT_APP_API_URL=http://IP_DEL_SERVIDOR:3001
```

El backend ya usa `cors()` amplio; aun así, exponer solo el API sin Nginx es peor práctica para producción.

### 10.4 Crear `frontend/.env` en el servidor

```bash
cd /var/www/sigec-igss/frontend
nano .env
```

Una sola línea (debe coincidir con la URL que pongan en el navegador; **este despliegue:**):

```env
REACT_APP_API_URL=http://10.4.201.74
```

### 10.5 Build

```bash
cd /var/www/sigec-igss/frontend
npm install
npm run build
```

Debe generarse la carpeta `frontend/build/`.

**Si cambias la IP del servidor o el nombre DNS:** edita `frontend/.env` y vuelve a ejecutar **`npm run build`**, luego `sudo systemctl reload nginx`.

---

## 11. Nginx: servir la web y proxy del API

### 11.1 Qué problema resuelve (idea simple)

Tienes **dos cosas distintas** en el mismo servidor:

| Qué es | Dónde vive | Puerto típico |
|--------|------------|----------------|
| **La aplicación web (React)** ya compilada | Archivos en `frontend/build/` (HTML, JS, CSS) | No tiene puerto propio; alguien tiene que “servirlos” |
| **El API (Node/Express)** | Proceso con PM2 escuchando en **3001** | `127.0.0.1:3001` |

Sin Nginx, tendrías que decirle a los usuarios cosas como: “abrid la web en un sitio y el API en otro puerto”, y el navegador trataría orígenes distintos (más lío con CORS y enlaces).

**Nginx** es un **servidor web** que escucha en el **puerto 80** (el de `http://` sin número) y hace **dos trabajos**:

1. **Servir archivos estáticos** del React: cuando alguien entra a `http://10.4.201.74/`, Nginx devuelve lo que hay en `frontend/build/` (por ejemplo `index.html` y los `.js` del build).
2. **Hacer de intermediario (proxy)** hacia el API: cuando el navegador pide `http://10.4.201.74/api/...`, Nginx **reenvía** esa petición por dentro a `http://127.0.0.1:3001/api/...`, donde está tu backend. El usuario **solo ve** el puerto 80; el 3001 queda solo en el servidor.

Flujo resumido:

```text
PC del usuario  --http:80-->  Nginx  --archivos-->  frontend/build  (pantalla React)
                    |
                    +--------proxy /api/---------->  127.0.0.1:3001  (API Node + PM2)
```

Por eso el `REACT_APP_API_URL` del build es `http://10.4.201.74`: el navegador pide la página y las llamadas `/api` **al mismo host y puerto**; Nginx reparte.

### 11.2 Qué significa cada parte del bloque `server { }`

- **`listen 80`** — Escuchar peticiones HTTP en el puerto **80** (todas las interfaces de red del servidor).
- **`server_name _`** (o `10.4.201.74`) — Nombre o IP con el que identifica este sitio. `_` es un comodín útil cuando solo hay un sitio o entras por IP.
- **`root .../frontend/build`** — Carpeta donde están los archivos **ya compilados** del React (`npm run build`). Ahí está `index.html`.
- **`location /` + `try_files ... /index.html`** — Para una SPA (React Router): cualquier ruta que no sea un archivo real se responde con `index.html`, para que no salga error al recargar una ruta interna.
- **`location /api/` + `proxy_pass http://127.0.0.1:3001/api/`** — Todo lo que empiece por `/api/` se **reenvía** al backend. La barra final en `proxy_pass` hace que la ruta cuadre con Express.

Las líneas `proxy_set_header` pasan al Node la IP real del cliente y el esquema (`http`), útil para logs y si más adelante pones HTTPS delante.

### 11.3 Requisitos previos antes de activar Nginx

- El **build** del frontend ya existe: `frontend/build/` (sección 10).
- El **API** está corriendo con PM2 en **3001** (sección 9). Puedes comprobar: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/...` o `pm2 status`.

### 11.4 Crear y activar la configuración

Crea el sitio:

```bash
sudo nano /etc/nginx/sites-available/sigec-igss
```

Ejemplo mínimo (HTTP en puerto 80). Para **solo IP** o acceso por IP, puedes usar `server_name _` (comodín) o poner la IP explícita:

```nginx
server {
    listen 80 default_server;
    server_name _;

    root /var/www/sigec-igss/frontend/build;
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
    }
}
```

Si tienes **varios sitios** en el mismo Nginx y no quieres `default_server`, quita esa palabra y usa un `server_name` concreto (IP o nombre interno).
En **este despliegue** puedes usar `server_name 10.4.201.74;` en lugar de `server_name _;` si quieres que el bloque coincida explícitamente con esa IP.

**Conflicto con el sitio por defecto de Debian:** si ya existe `/etc/nginx/sites-enabled/default`, deshabilítalo para que no compita por el puerto 80:

```bash
sudo rm /etc/nginx/sites-enabled/default
```

Activar sitio y recargar:

```bash
sudo ln -sf /etc/nginx/sites-available/sigec-igss /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Si `nginx -t` dice que la sintaxis está bien, el sitio queda activo. Prueba en el propio servidor: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1/` (debería ser `200` si hay `index.html`).

### 11.5 HTTPS (opcional)

Con dominio público puedes usar **Certbot** (`certbot --nginx`) para Let's Encrypt. En intranet con CA interna o sin HTTPS, muchos equipos usan solo HTTP dentro de la red institucional.

---

## 12. Firewall (UFW) y red institucional

### 12.1 UFW en el servidor Debian

Si usas UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# o: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

No abras el puerto **5432** hacia internet salvo que sea imprescindible y esté muy restringido; PostgreSQL suele quedar solo en `127.0.0.1` o en red interna acotada.

### 12.2 Más allá del servidor (red IGSS)

- Si un usuario **no alcanza** `http://10.4.201.74` desde su oficina pero otro sí, el bloqueo puede estar en **firewall perimetral, VLAN o reglas entre sedes**. Eso se resuelve con **IT/redes**, no solo con Debian.
- El **puerto 3001** no debe ser necesario en los clientes si usas Nginx en el **80**; no hace falta publicar 3001 fuera del servidor.

---

## 13. Probar desde el navegador

1. Desde **otra PC de la red** (no desde el servidor): abre **`http://10.4.201.74`** (misma base que `REACT_APP_API_URL`, sin puerto si usas Nginx en el 80).  
2. Debe cargar la pantalla de **SIGEC-IGSS** (login).  
3. Prueba login solo si ya existe usuario en la base.  
4. Si no carga: comprueba ping/ruta a **10.4.201.74**, que el firewall del servidor permita el puerto 80, y que no estés usando `localhost` en el cliente (debe ser la IP del servidor).

Prueba rápida del API (desde el servidor):

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/auth/login -X POST -H "Content-Type: application/json" -d "{}"
```

(Un 400 por cuerpo vacío indica que el servidor responde.)

---

## 14. Actualizar el sistema después (`git pull`)

En Debian (como el usuario dueño del proyecto, no hace falta `root` salvo `nginx`):

```bash
cd /var/www/sigec-igss
git pull
cd backend && npm install && npx tsc && pm2 restart sigec-igss-api
cd ../frontend && npm install && npm run build
sudo systemctl reload nginx
```

Si **cambió** la IP del servidor o el nombre interno y afecta al API, edita `frontend/.env` antes de `npm run build`.

---

## 15. Problemas frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| `sh: 1: tsc: Permission denied` al ejecutar `npx tsc` | `chmod +x node_modules/.bin/tsc` o `chmod +x node_modules/.bin/*`; alternativa: `node ./node_modules/typescript/bin/tsc`. |
| `502 Bad Gateway` en Nginx | `pm2 status`, `pm2 logs sigec-igss-api`, que el API escuche en `127.0.0.1:3001` y que `proxy_pass` apunte a `/api/`. |
| Login falla siempre | Usuario/credencial en BD, `JWT_SECRET` definido; con Nginx+proxy mismo origen, CORS suele no ser el problema. |
| El frontend llama a la IP equivocada o a `localhost` | `REACT_APP_API_URL` debe ser la URL que el **navegador del usuario** usa; recompilar con `npm run build` tras cambiar `.env`. |
| Funciona en el servidor pero no desde otras PCs | Firewall (UFW), sitio `default` de Nginx compitiendo, o routing/firewall entre VLANs (IT). |
| Página en blanco al recargar rutas | `try_files ... /index.html` en Nginx (SPA). |
| Subidas o adjuntos fallan | Permisos en `/var/www/sigec-igss/backend/uploads` para el usuario que corre PM2. |
| API no crea tablas | `DB_SYNCHRONIZE=true` solo la primera vez; usuario `portal_app` con permisos en `sigec_igss`. |
| Error de conexión a PostgreSQL | `DB_HOST`, contraseña, `pg_hba.conf` para `127.0.0.1`. |
| `npm audit` reporta vulnerabilidades | Informe de dependencias; valorar `npm audit fix` en ventana de pruebas. |

---

## Resumen de una página

1. Subir código a Git → `git clone` en `/var/www/sigec-igss`; un usuario Linux dueño del árbol (p. ej. `noe`), PM2 con ese mismo usuario.  
2. PostgreSQL listo (`igss`, `sigec_igss`, `portal_app`).  
3. `backend/.env` (incl. `JWT_SECRET` con `openssl rand -base64 64`) → `npm install` → `npx tsc` → arrancar una vez con `DB_SYNCHRONIZE=true` → tablas OK → `DB_SYNCHRONIZE=false` → PM2.  
4. `frontend/.env` con `REACT_APP_API_URL=http://10.4.201.74` → `npm run build`.  
5. Nginx: `root` → `frontend/build`, `location /api/` → `127.0.0.1:3001`; deshabilitar `default` si compite; firewall 80 (y 443 si aplica).  
6. Usuarios abren **`http://10.4.201.74`**. Si la IP cambiara, actualizar `frontend/.env` y volver a `npm run build`.  

Documentos relacionados: `POSTGRES-SCHEMA-SETUP.md`, `MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md`, `BASE-DATOS-DESDE-CERO.md`.
