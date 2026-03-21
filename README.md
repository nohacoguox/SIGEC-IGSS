# SIGEC-IGSS

Sistema de gestión (frontend React + backend Node/Express/TypeORM + PostgreSQL).

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/GUIA-DESPLIEGUE-SIGEC-IGSS-WINDOWS-A-DEBIAN12.md](docs/GUIA-DESPLIEGUE-SIGEC-IGSS-WINDOWS-A-DEBIAN12.md) | **Despliegue completo** desde Windows (desarrollo) a Debian 12 (servidor): Git, Node, PM2, Nginx, PostgreSQL, variables de entorno |
| [docs/DESPLIEGUE-WINDOWS-A-DEBIAN12.md](docs/DESPLIEGUE-WINDOWS-A-DEBIAN12.md) | Índice corto que enlaza a la guía anterior |
| [docs/BASE-DATOS-DESDE-CERO.md](docs/BASE-DATOS-DESDE-CERO.md) | Crear base y esquema desde cero |
| [docs/MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md](docs/MIGRACION-DATOS-Y-DESPLIEGUE-SERVIDOR.md) | Migración de datos con `pg_dump` / restauración |

## Desarrollo local (resumen)

```bash
# Backend
cd backend
cp .env.example .env   # si existe; configurar DB_* y JWT_SECRET
npm install
npm run dev

# Frontend (otra terminal)
cd frontend
# Opcional: copiar .env.example → .env y definir REACT_APP_API_URL
npm install
npm start
```

En **producción**, `REACT_APP_API_URL` debe ser la URL **que el navegador del usuario** usa para llegar al servidor (p. ej. `http://IP` o `https://dominio`), **no** `http://127.0.0.1:3001` desde otra máquina. Ver sección 10 de la guía de despliegue.

## Nombre del repositorio en el servidor

Recomendado: clonar o copiar el código en **`/var/www/sigec-igss`** en Debian.
