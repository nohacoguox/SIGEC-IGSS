# Arquitectura SIGEC-IGSS

Sistema Integral de Gestión de Expedientes de Compras — IGSS (Consultorio Palín / DAF Escuintla).

## Vista de capas

```mermaid
flowchart TB
  subgraph Cliente["Cliente (navegador)"]
    UI["Frontend React 18 + TypeScript\nMUI · React Router · Axios\nPuerto dev: 3003"]
  end

  subgraph API["Capa de aplicación"]
    BE["Backend Node.js + Express 5\nTypeScript · JWT / bcrypt\nPuerto: 3001"]
    MOD["Módulos REST\nauth · rbac · siaf · expedientes\ncorrelativos · catálogos · estadisticas"]
  end

  subgraph Datos["Persistencia"]
    ORM["TypeORM"]
    PG[("PostgreSQL\nesquema sigec_igss")]
    FS["Archivos\nuploads/siaf · expedientes · adjuntos\nPDF + hash SHA-256"]
  end

  subgraph Prod["Despliegue documentado (red IGSS)"]
    NGX["Nginx :80"]
    PM2["PM2 (proceso API)"]
    SRV["Debian 12 · IP interna\nej. 10.4.201.74"]
  end

  UI -->|"HTTPS/HTTP JSON\nAuthorization: Bearer JWT"| BE
  BE --> MOD
  MOD --> ORM
  ORM --> PG
  MOD --> FS

  NGX -->|"/ estático build React\n/api → proxy 3001"| UI
  NGX --> PM2
  PM2 --> BE
  SRV --- NGX
  SRV --- PG
```

## Flujo de negocio (resumen)

```mermaid
flowchart LR
  A[Usuario unidad\ncrea SIAF] --> B[Envío a revisión DAF]
  B --> C{Analista DAF}
  C -->|Aprueba| D[SIAF finalizado]
  C -->|Rechaza| E[Bitácora + corrección]
  E --> B
  D --> F[Expediente digital\ndocumentos / versiones]
  F --> G[Revisión DAF expediente]
  G --> H[Cerrado / aprobado]
```

## Tecnologías por capa

| Capa | Tecnología |
|------|------------|
| Presentación | React 18, TypeScript, Material UI 5, Axios, Recharts |
| API | Node.js, Express 5, TypeScript, JWT, Multer, PDFKit |
| ORM / BD | TypeORM, PostgreSQL (`sigec_igss`) |
| Archivos | Sistema de archivos local (`backend/uploads`) |
| Local (demo) | Windows · `INICIAR-SIGEC.bat` · :3003 / :3001 / :5432 |
| Producción | Debian 12 · Nginx · PM2 · red privada IGSS |

## Nota para la demostración

Esta grabación corre en **entorno local**. El servidor institucional está en **red privada del IGSS**; desde fuera no hay acceso público. El código y la arquitectura son los mismos; cambia el host de despliegue.
