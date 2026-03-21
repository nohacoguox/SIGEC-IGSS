# Guía detallada: llevar SIGEC-IGSS de Windows (PC física) a Debian 12

**Nombre del producto:** **SIGEC-IGSS** (*Sistema Integral de Gestión de Expedientes de Compras del IGSS*).  
**En PostgreSQL:** base `igss`, esquema `sigec_igss`, usuario `portal_app`.

Esta guía asume:

- Desarrollaste el proyecto en **Windows** (la carpeta en disco puede seguir llamándose `PortalDigitalIGSS` o ya la renombraste; da igual mientras el **código** sea el mismo).
- En el **servidor Debian 12** ya tienes **PostgreSQL** creado (`igss`, `sigec_igss`, `portal_app`).
- Quieres dejar el **backend (API)** y el **frontend (React)** corriendo en Debian, usando esa base de datos.

**Carpeta recomendada en el servidor Linux:** `/var/www/sigec-igss` (minúsculas y guion; evita espacios y mayúsculas en rutas).

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
12. [Firewall (UFW)](#12-firewall-ufw)  
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

Prueba con el mismo usuario que usará la app:

```bash
psql -h 127.0.0.1 -U portal_app -d igss -c "SHOW search_path;"
```

- Debe mostrar algo como `sigec_igss, public`.  
- Si falla la contraseña o el host, corrige antes de seguir (`pg_hba.conf`, contraseña del rol, etc.).  
- Si PostgreSQL está en **otra máquina**, usa su IP en `DB_HOST` en el `.env` (y abre puerto 5432 solo si es necesario).

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

JWT_SECRET=genera_una_cadena_larga_unica_no_la_compartas
```

Guardar: en `nano`, `Ctrl+O`, Enter, `Ctrl+X`.

**Importante:** `JWT_SECRET` debe ser **distinto** y **secreto** en producción; si lo cambias después, los tokens antiguos dejan de valer.

---

## 8. Primera ejecución del backend y creación de tablas

```bash
cd /var/www/sigec-igss/backend
npm install
npx tsc
node dist/index.js
```

Qué observar:

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

*(Opcional)* Seeders de roles / catálogos, desde `backend`:

```bash
npm run seed-roles
npm run seed-departamentos-municipios
```

Para **login** necesitas al menos usuario + credencial en BD; si no hay, crea el primero según el procedimiento de tu equipo.

---

## 9. Dejar el API en segundo plano (PM2)

```bash
cd /var/www/sigec-igss/backend
npx tsc
pm2 start dist/index.js --name sigec-igss-api
pm2 save
pm2 startup
# Ejecuta la línea que te muestre `pm2 startup` (con sudo)
```

Comandos útiles:

```bash
pm2 status
pm2 logs sigec-igss-api
pm2 restart sigec-igss-api
```

**Carpeta de subidas:** si el código guarda archivos en disco, crea y da permisos, por ejemplo:

```bash
mkdir -p /var/www/sigec-igss/backend/uploads
chmod u+rwX /var/www/sigec-igss/backend/uploads
```

(Revisa en el código la ruta exacta que use `FileStorageService`.)

---

## 10. Compilar el frontend

El frontend llama al API usando `REACT_APP_API_URL` (ver `frontend/src/api.ts`).

### 10.1 Variable `REACT_APP_API_URL` (muy importante)

Esa variable se **incrusta en el JavaScript en el momento del `npm run build`**. El **navegador del usuario** (en su PC o celular) es quien hará las peticiones a esa URL. **No** uses `http://127.0.0.1:3001` salvo que solo pruebes en el mismo servidor con un navegador local; desde otra máquina `127.0.0.1` sería el PC del usuario, no el servidor.

**Con Nginx haciendo proxy de `/api` al backend (recomendado):** la página se sirve, por ejemplo, en `http://192.168.1.50` o `https://sigec.tudominio.com`. Entonces el build debe usar **esa misma base** (sin `/api` al final; el código añade `/api` solo).

Ejemplos válidos:

```env
# Misma máquina en la red local (sin HTTPS)
REACT_APP_API_URL=http://192.168.1.50

# Con dominio y HTTPS
REACT_APP_API_URL=https://sigec.tudominio.com
```

Crea el archivo en el servidor:

```bash
cd /var/www/sigec-igss/frontend
nano .env
```

Pega una línea como las de arriba (ajusta IP o dominio **al que realmente entran los usuarios**).

Si **no** usas Nginx y abres el puerto 3001 al mundo (no recomendado):

```env
REACT_APP_API_URL=http://IP_PUBLICA:3001
```

*(Puede exigir ajustar CORS en el backend.)*

### 10.2 Build

```bash
cd /var/www/sigec-igss/frontend
npm install
npm run build
```

Debe generarse la carpeta `frontend/build/`.

---

## 11. Nginx: servir la web y proxy del API

Crea un sitio (ajusta `server_name`):

```bash
sudo nano /etc/nginx/sites-available/sigec-igss
```

Ejemplo mínimo (HTTP en puerto 80; sustituye `TU_IP_O_DOMINIO`):

```nginx
server {
    listen 80;
    server_name TU_IP_O_DOMINIO;

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

Activar sitio y recargar:

```bash
sudo ln -sf /etc/nginx/sites-available/sigec-igss /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**HTTPS:** cuando tengas dominio público, puedes usar **Certbot** (`certbot --nginx`) para Let's Encrypt.

---

## 12. Firewall (UFW)

Si usas UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# o: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

No abras el puerto **5432** a internet salvo que sea imprescindible y esté muy restringido.

---

## 13. Probar desde el navegador

1. Desde otra PC: `http://IP_DEL_SERVIDOR` o tu dominio.  
2. Debe cargar la pantalla de **SIGEC-IGSS** (login).  
3. Prueba login solo si ya existe usuario en la base.

Prueba rápida del API (desde el servidor):

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/auth/login -X POST -H "Content-Type: application/json" -d "{}"
```

(Un 400 por cuerpo vacío indica que el servidor responde.)

---

## 14. Actualizar el sistema después (`git pull`)

En Debian:

```bash
cd /var/www/sigec-igss
git pull
cd backend && npm install && npx tsc && pm2 restart sigec-igss-api
cd ../frontend && npm install && npm run build
sudo systemctl reload nginx
```

---

## 15. Problemas frecuentes

| Síntoma | Qué revisar |
|---------|-------------|
| `502 Bad Gateway` en Nginx | `pm2 status`, `pm2 logs sigec-igss-api`, que el API escuche en `3001`. |
| Login falla siempre | Usuario/credencial en BD, `JWT_SECRET` estable, CORS si llamas al API desde otro origen. |
| Página en blanco al recargar rutas | `try_files ... /index.html` en Nginx (SPA). |
| API no crea tablas | `DB_SYNCHRONIZE=true` solo la primera vez; usuario `portal_app` con permisos en `sigec_igss`. |
| Error de conexión a PostgreSQL | `DB_HOST`, contraseña, `pg_hba.conf` para `127.0.0.1`. |

---

## Resumen de una página

1. Subir código a Git → `git clone` en `/var/www/sigec-igss`.  
2. PostgreSQL listo (`igss`, `sigec_igss`, `portal_app`).  
3. `backend/.env` correcto → `npm install` → `npx tsc` → arrancar una vez con `synchronize` → luego `false` → PM2.  
4. `frontend/.env` con URL del API → `npm run build`.  
5. Nginx sirve `build` y proxifica `/api` → firewall 80/443.  

Documentos relacionados: `POSTGRES-SCHEMA-SETUP.md`, `MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md`, `BASE-DATOS-DESDE-CERO.md`.
