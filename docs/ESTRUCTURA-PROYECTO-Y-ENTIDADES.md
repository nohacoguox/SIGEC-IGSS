# SIGEC-IGSS – Estructura del proyecto, entidades y módulos

Documento para diagrama ER y documentación fiel al proyecto.

---

## 1. Estructura de carpetas principal

```
sigec-igss/                     # Repositorio SIGEC-IGSS (en Windows la carpeta puede llamarse distinto)
├── backend/                    # API REST (Node.js + Express + TypeORM)
│   ├── src/
│   │   ├── entity/             # Entidades TypeORM (modelos de BD)
│   │   ├── services/           # FileStorageService, PdfGeneratorService
│   │   ├── seeders/            # UnidadMedica, Roles, Puestos, Departamentos/Municipios, etc.
│   │   ├── migrations/         # migrate-user-roles
│   │   ├── data-source.ts      # Configuración TypeORM (PostgreSQL)
│   │   └── index.ts            # Express app, rutas y lógica principal
│   ├── assets/
│   ├── uploads/                # Archivos subidos (SIAF, expedientes)
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # SPA React (Material-UI)
│   └── src/
│       ├── pages/              # Login, Dashboards, SIAF, Áreas, Puestos, Roles, etc.
│       ├── components/         # SiafBook, AutorizarSiaf, UserManagement, etc.
│       ├── context/            # SiafContext, ThemeContext, NotificationContext
│       ├── api.ts
│       └── App.tsx
├── database/                   # Datos PostgreSQL (data/, config)
├── docs/                       # Documentación
├── package.json                # Raíz (dependencias mínimas)
├── FASE-2-ENDPOINTS-BACKEND.md
├── FASE-3-INTEGRACION-COMPLETA.md
├── IMPLEMENTACION-ALMACENAMIENTO.md
├── RESUMEN-COMPLETO-IMPLEMENTACION.md
└── TODO.md
```

**Archivos clave**

| Archivo | Descripción |
|--------|-------------|
| `backend/package.json` | Backend: express, typeorm, pg, bcryptjs, jsonwebtoken, multer, xlsx, pdfkit |
| `backend/src/data-source.ts` | Conexión PostgreSQL, lista de entidades, `synchronize: true` |
| `backend/src/index.ts` | Todas las rutas API, middlewares (verifyToken, authorizeRoles), lógica de negocio |
| `backend/src/entity/*.ts` | Modelos/entidades del dominio |
| `frontend/src/App.tsx` | Rutas React y estructura de la SPA |

---

## 2. Entidades del dominio (modelos / tablas)

Las entidades están en `backend/src/entity/`. TypeORM usa PostgreSQL; los nombres de tabla se indican con `@Entity('nombre_tabla')` o, si no se indica, el nombre por defecto (p. ej. clase `User` → tabla `user`).

### 2.1 Usuarios, credenciales y seguridad

| Entidad | Tabla | Atributos principales |
|--------|--------|------------------------|
| **User** | `user` | id, nombres, apellidos, dpi (unique), nit (unique), telefono, correoInstitucional (unique), codigoEmpleado (unique), renglon, unidadMedica (texto), puestoId (FK), departamento_direccion_id (FK), departamento_direccion (texto, nullable) |
| **Credential** | `credential` | id, codigoEmpleado (unique), password (hash), isTempPassword, userId (FK → User) |
| **Role** | `role` | id, name (unique) |
| **Permission** | `permission` | id, name (unique), description |

**Tablas de relación N:M**

- **user_roles**: userId ↔ roleId (User ↔ Role).
- **role_permissions**: roleId ↔ permissionId (Role ↔ Permission).

### 2.2 Organización y catálogos geográficos

| Entidad | Tabla | Atributos principales |
|--------|--------|------------------------|
| **Puesto** | `puesto` | id, nombre (unique), activo |
| **Area** | `areas` | id, nombre (unique), descripcion, activo, createdAt, updatedAt |
| **Departamento** | `departamentos` | id, nombre (unique) |
| **Municipio** | `municipios` | id, nombre, departamento_id (FK → Departamento) |
| **UnidadMedica** | `unidad_medica` | id, nombre (unique), departamento (texto, nullable), municipio_id (FK → Municipio), telefonos |

### 2.3 SIAF (solicitudes de compra)

| Entidad | Tabla | Atributos principales |
|--------|--------|------------------------|
| **SiafSolicitud** | `siaf_solicitudes` | id, correlativo (unique), fecha, usuario_solicitante_id (FK → User), nombreUnidad, direccion, area_id (FK → Area), justificacion, nombreSolicitante, puestoSolicitante, unidadSolicitante, nombreAutoridad, usuario_autoridad_id (FK → User), usuario_encargado_id (FK → User), puestoAutoridad, unidadAutoridad, consistenteItem, estado (pendiente/autorizado/rechazado), aprobadoDireccionDepartamental, pdfPath, pdfHash, pdfSize, created_at, updated_at |
| **SiafItem** | `siaf_items` | id, siaf_id (FK → SiafSolicitud), codigo, descripcion, cantidad, orden |
| **SiafSubproducto** | `siaf_subproductos` | id, siaf_id (FK → SiafSolicitud), codigo, cantidad, orden |
| **SiafAutorizacion** | `siaf_autorizaciones` | id, siaf_id (FK), usuario_autorizador_id (FK → User), accion (autorizado/rechazado), comentario, motivo_rechazo, fecha_autorizacion |
| **SiafBitacora** | `siaf_bitacora` | id, siaf_id (FK), tipo (rechazo/correccion/autorizado), usuario_id (FK → User), comentario, detalle_antes, detalle_despues, fecha |
| **SiafDocumentoAdjunto** | `siaf_documentos_adjuntos` | id, siaf_id (FK), nombreOriginal, rutaArchivo, mimeType, tamanioBytes, hashArchivo, fecha_subida |

### 2.4 Expedientes

| Entidad | Tabla | Atributos principales |
|--------|--------|------------------------|
| **Expediente** | `expedientes` | id, numeroExpediente (unique), usuario_id (FK → User), tipoExpediente, titulo, descripcion, estado (abierto/en_proceso/cerrado/archivado), fechaApertura, fechaCierre, created_at, updated_at |
| **ExpedienteDocumento** | `expediente_documentos` | id, expediente_id (FK → Expediente), tipoDocumento, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, hashArchivo, subido_por (FK → User), descripcion, fecha_subida |

### 2.5 Catálogo de productos

| Entidad | Tabla | Atributos principales |
|--------|--------|------------------------|
| **ProductoCatalogo** | `producto_catalogo` | id, codigo, descripcion, createdAt |

---

## 3. Relaciones entre entidades (claves foráneas y N:M)

### 3.1 User

- **User** → **Puesto**: ManyToOne, `puestoId` (nullable).
- **User** → **Departamento**: ManyToOne, `departamento_direccion_id` (nullable; “Dirección Departamental”).
- **User** ↔ **Role**: ManyToMany vía tabla `user_roles` (userId, roleId).
- **User** ← **Credential**: OneToOne, `credential.userId` → User (CASCADE delete).

### 3.2 Role y Permission

- **Role** ↔ **Permission**: ManyToMany vía tabla `role_permissions` (roleId, permissionId).

### 3.3 Geografía y organización

- **Departamento** → **Municipio**: OneToMany (un departamento tiene muchos municipios).
- **Municipio** → **Departamento**: ManyToOne, `departamento_id`.
- **UnidadMedica** → **Municipio**: ManyToOne, `municipio_id` (nullable).

### 3.4 SIAF

- **SiafSolicitud** → **User**: ManyToOne `usuario_solicitante_id`; ManyToOne `usuario_autoridad_id`; ManyToOne `usuario_encargado_id`.
- **SiafSolicitud** → **Area**: ManyToOne `area_id` (nullable).
- **SiafItem**, **SiafSubproducto**, **SiafAutorizacion**, **SiafBitacora**, **SiafDocumentoAdjunto** → **SiafSolicitud**: ManyToOne `siaf_id` (CASCADE en items, subproductos, bitácora, adjuntos).

### 3.5 Expedientes

- **Expediente** → **User**: ManyToOne `usuario_id`.
- **ExpedienteDocumento** → **Expediente**: ManyToOne `expediente_id` (CASCADE).
- **ExpedienteDocumento** → **User**: ManyToOne `subido_por`.

### 3.6 Resumen de tablas de unión

- `user_roles`: userId, roleId.
- `role_permissions`: roleId, permissionId.

El resto de relaciones son OneToOne o ManyToOne con FK en una de las tablas.

---

## 4. Módulos o funcionalidades principales

Agrupación por dominio y rutas API / pantallas.

### 4.1 Autenticación y sesión

- **Login**: `POST /api/auth/login` (codigoEmpleado + password).
- **Usuario actual**: `GET /api/auth/me` (datos + roles + permissions desde JWT).
- **Cambio de contraseña**: `POST /api/auth/change-password`.
- **Frontend**: `LoginPage`, `ChangePasswordPage`, `PrivateRoute`, `HomeRedirect`.

### 4.2 Dashboard y estadísticas globales

- **Estadísticas dashboard**: `GET /api/dashboard/stats` (total usuarios, roles, informes).
- **Frontend**: `AdminDashboard`, `CollaboratorDashboard`, `DashboardPage`.

### 4.3 Usuarios

- CRUD: `GET/POST /api/users`, `GET/PUT/DELETE /api/users/:id`.
- **Roles por usuario**: `GET /api/users/:id/roles`, `PUT /api/users/:id/roles`.
- **Restablecer contraseña**: `POST /api/users/:id/reset-password`.
- **Consultas por unidad**: `GET /api/users/director/:unidadMedica`, `GET /api/users/medicos-por-unidad/:unidadMedica`.
- **Frontend**: `UserManagement`, `UserList`, `UserForm`, `UserManagementContainer`.

### 4.4 Roles y permisos

- **Roles**: `GET/POST /api/roles`, `PUT/DELETE /api/roles/:id`.
- **Permisos**: `GET /api/permissions`.
- **Frontend**: `RoleManagementPage`.
- Permisos usados en backend: `super administrador`, `gestionar-usuarios`, `gestionar-roles`, `gestionar-puestos`, `gestionar-areas`, `crear-siaf`, `autorizar-siaf`, `revisar-siaf-direccion-departamental`, `actualizar-codigos-productos`, `ver-estadisticas`, etc.

### 4.5 Puestos

- **API**: `GET /api/puestos`, `GET /api/puestos/all`, `POST/PUT/DELETE /api/puestos/:id`.
- **Frontend**: `PuestoManagementPage`.

### 4.6 Departamentos y municipios

- **API**: `GET /api/departamentos`, `GET /api/municipios`.
- Usados en formularios (usuarios, unidades médicas, etc.).

### 4.7 Unidades médicas

- **API**: `GET /api/unidades-medicas`, `PUT /api/unidades-medicas/:id`.
- **Frontend**: `UnidadMedicaManagementPage`.

### 4.8 Áreas

- **API**: `GET/POST /api/areas`, `PUT/DELETE /api/areas/:id`.
- **Frontend**: `AreaManagementPage`.
- Las áreas se usan en solicitudes SIAF (área solicitante).

### 4.9 Catálogo de productos

- **API**: `GET /api/catalogo-productos/codigo/:codigo`, `POST /api/catalogo-productos/importar` (Excel), `GET /api/catalogo-productos/stats`.
- **Frontend**: `ActualizarCodigosProductosPage`.
- **Entidad**: `ProductoCatalogo`.

### 4.10 SIAF (Solicitudes de compra – módulo central)

- **Listado**: `GET /api/siaf` (filtros por unidad, estado, etc.).
- **Crear**: `POST /api/siaf` (genera PDF y guarda en almacenamiento).
- **Detalle**: `GET /api/siaf/:id`.
- **Actualizar**: `PUT /api/siaf/:id`.
- **Autorizar / Rechazar**: `PUT /api/siaf/:id/autorizar`, `PUT /api/siaf/:id/rechazar`.
- **Dirección Departamental (DAF)**:
  - `GET /api/siaf/para-direccion-departamental` (pendientes de revisión DD).
  - `GET /api/siaf/historial-direccion-departamental`.
  - `POST /api/siaf/:id/aprobar-direccion-departamental`, `POST /api/siaf/:id/rechazar-direccion-departamental`.
- **Rechazadas**: `GET /api/siaf/rechazadas`.
- **Adjuntos**: `GET /api/siaf/adjuntos/:idAdjunto/descargar`, `DELETE /api/siaf/adjuntos/:idAdjunto`, `POST /api/siaf/:id/adjuntos`.
- **Bitácora**: `GET /api/siaf/:id/bitacora`, `POST /api/siaf/:id/bitacora`.
- **Frontend**: `SiafManagement`, `SiafBook` (crear/editar), `AutorizarSiaf`, `RevisarDireccionDepartamental`, `SiafPdfDocument`, `EstadisticasSiaf`, `SiafContext`.

### 4.11 Estadísticas SIAF

- **API**: `GET /api/estadisticas/siaf-tiempos`, `GET /api/estadisticas/motivos-rechazo`.
- **Frontend**: `EstadisticasSiaf`.

### 4.12 Expedientes

- **Entidades**: `Expediente`, `ExpedienteDocumento` (y servicio de almacenamiento para expedientes en `FileStorageService`).
- **Estado en backend**: no hay rutas CRUD de expedientes en `index.ts`; el modelo existe y está pensado para uso posterior (p. ej. cuando SIAF está aprobado por Dirección Departamental “para continuar con expediente”).

### 4.13 Bitácora SIAF

- Registros en tabla `siaf_bitacora`: tipo (rechazo, correccion, autorizado, aprobado_dd), usuario, comentario, detalle_antes/detalle_despues, fecha.
- Expuesta vía `GET/POST /api/siaf/:id/bitacora`.

---

## 5. Resumen para diagrama ER y documentación

- **Entidades**: User, Credential, Role, Permission, Puesto, Area, Departamento, Municipio, UnidadMedica, SiafSolicitud, SiafItem, SiafSubproducto, SiafAutorizacion, SiafBitacora, SiafDocumentoAdjunto, Expediente, ExpedienteDocumento, ProductoCatalogo.
- **Tablas de unión**: `user_roles`, `role_permissions`.
- **Relaciones clave**: User ↔ Role (N:M); Role ↔ Permission (N:M); User → Puesto, Departamento; Credential → User; SIAF → User (solicitante, autoridad, encargado), Area; Expediente → User; ExpedienteDocumento → Expediente, User; Departamento → Municipio; UnidadMedica → Municipio.
- **Módulos/funcionalidades**: Auth, Dashboard, Usuarios, Roles y permisos, Puestos, Departamentos/Municipios, Unidades médicas, Áreas, Catálogo de productos, SIAF (flujo completo + Dirección Departamental + bitácora + adjuntos), Estadísticas SIAF, Expedientes (modelo y almacenamiento listos, sin API CRUD aún).

Con esta lista de entidades, atributos y relaciones se puede armar el diagrama ER y la documentación de **SIGEC-IGSS** de forma fiel al código actual.
