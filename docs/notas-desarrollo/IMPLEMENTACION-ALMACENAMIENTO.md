# 📦 Implementación de Sistema de Almacenamiento Híbrido

## ✅ Archivos Creados

### Entidades de Base de Datos:
1. **backend/src/entity/SiafSolicitud.ts**
   - `SiafSolicitud`: Tabla principal de solicitudes SIAF
   - `SiafItem`: Items de cada solicitud
   - `SiafSubproducto`: Subproductos de cada solicitud
   - `SiafAutorizacion`: Historial de autorizaciones/rechazos

2. **backend/src/entity/Expediente.ts**
   - `Expediente`: Tabla de expedientes
   - `ExpedienteDocumento`: Documentos asociados a expedientes

### Servicios:
3. **backend/src/services/FileStorageService.ts**
   - Manejo de almacenamiento de archivos en sistema de archivos
   - Generación de hash SHA-256 para integridad
   - Organización por año/mes
   - Métodos para SIAF y Expedientes

4. **backend/src/services/PdfGeneratorService.ts**
   - Generación de PDFs en el backend
   - Formato profesional con colores IGSS

### Configuración:
5. **backend/src/data-source.ts** (ACTUALIZADO)
   - Agregadas nuevas entidades al DataSource

## 📋 Dependencias a Instalar

### Backend:
```bash
cd backend
npm install pdfkit @types/pdfkit
npm install multer @types/multer
```

## 🗄️ Estructura de Base de Datos

Las tablas se crearán automáticamente al iniciar el servidor (synchronize: true):

```
siaf_solicitudes
├── id (PK)
├── correlativo (UNIQUE)
├── fecha
├── usuario_solicitante_id (FK → users)
├── nombreUnidad
├── direccion
├── area_id (FK → areas)
├── justificacion
├── nombreSolicitante
├── puestoSolicitante
├── unidadSolicitante
├── nombreAutoridad
├── puestoAutoridad
├── unidadAutoridad
├── consistenteItem
├── estado (pendiente/autorizado/rechazado)
├── pdfPath (ruta del PDF)
├── pdfHash (SHA-256)
├── pdfSize (bytes)
├── created_at
└── updated_at

siaf_items
├── id (PK)
├── siaf_id (FK → siaf_solicitudes)
├── codigo
├── descripcion
├── cantidad
└── orden

siaf_subproductos
├── id (PK)
├── siaf_id (FK → siaf_solicitudes)
├── codigo
├── cantidad
└── orden

siaf_autorizaciones
├── id (PK)
├── siaf_id (FK → siaf_solicitudes)
├── usuario_autorizador_id (FK → users)
├── accion (autorizado/rechazado)
├── comentario
└── fecha_autorizacion

expedientes
├── id (PK)
├── numeroExpediente (UNIQUE)
├── usuario_id (FK → users)
├── tipoExpediente
├── titulo
├── descripcion
├── estado
├── fechaApertura
├── fechaCierre
├── created_at
└── updated_at

expediente_documentos
├── id (PK)
├── expediente_id (FK → expedientes)
├── tipoDocumento
├── nombreArchivo
├── rutaArchivo
├── mimeType
├── tamanioBytes
├── hashArchivo (SHA-256)
├── subido_por (FK → users)
├── descripcion
└── fecha_subida
```

## 📁 Estructura de Archivos

```
uploads/
├── siaf/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── SIAF-001-2024.pdf
│   │   │   ├── SIAF-002-2024.pdf
│   │   │   └── ...
│   │   ├── 02/
│   │   └── ...
│   └── 2025/
└── expedientes/
    ├── EXP-001/
    │   ├── documento1-1234567890.pdf
    │   ├── factura-1234567891.pdf
    │   └── ...
    └── EXP-002/
```

## 🚀 Próximos Pasos

### 1. Instalar Dependencias
```bash
cd backend
npm install pdfkit @types/pdfkit multer @types/multer
```

### 2. Crear Endpoints en backend/src/index.ts

Necesitarás agregar:
- `POST /api/siaf` - Crear solicitud SIAF y generar PDF
- `GET /api/siaf` - Listar solicitudes SIAF
- `GET /api/siaf/:id` - Obtener solicitud específica
- `GET /api/siaf/:id/pdf` - Descargar PDF
- `PUT /api/siaf/:id/autorizar` - Autorizar solicitud
- `PUT /api/siaf/:id/rechazar` - Rechazar solicitud

### 3. Actualizar Frontend

Modificar:
- `frontend/src/components/SiafBook.tsx` - Enviar datos al backend
- `frontend/src/components/AutorizarSiaf.tsx` - Consumir endpoints reales
- `frontend/src/context/SiafContext.tsx` - Integrar con backend

## 🔐 Características de Seguridad

✅ **Hash SHA-256**: Verificación de integridad de archivos
✅ **Auditoría completa**: Registro de quién creó/autorizó cada documento
✅ **Control de acceso**: Basado en permisos de usuario
✅ **Trazabilidad**: Historial completo de autorizaciones

## 📊 Ventajas del Sistema

1. **Búsquedas rápidas**: Consultas SQL en milisegundos
2. **Reportes complejos**: Análisis sin procesar PDFs
3. **Escalabilidad**: Fácil migrar a MinIO o S3
4. **Backup eficiente**: BD y archivos por separado
5. **Integridad**: Detección de archivos corruptos
6. **Organización**: Estructura clara por año/mes

## 🎯 Migración Futura a MinIO

Cuando estés listo para producción:

```bash
# Instalar MinIO client
npm install minio @types/minio

# Actualizar FileStorageService para usar MinIO
# Mantener la misma interfaz, cambiar implementación interna
```

## 📝 Notas Importantes

- Las tablas se crean automáticamente al iniciar el servidor
- Los archivos se organizan automáticamente por año/mes
- El hash SHA-256 permite detectar archivos corruptos
- La estructura permite fácil migración a cloud storage

## ✨ Estado Actual

✅ Entidades de BD creadas
✅ Servicios de almacenamiento implementados
✅ Servicio de generación de PDF implementado
⏳ Pendiente: Endpoints del backend
⏳ Pendiente: Integración con frontend
⏳ Pendiente: Instalación de dependencias

¿Deseas que continúe con la implementación de los endpoints del backend?
