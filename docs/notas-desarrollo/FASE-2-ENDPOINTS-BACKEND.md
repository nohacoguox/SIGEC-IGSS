# 📡 FASE 2: Endpoints del Backend - COMPLETADA

## ✅ Endpoints SIAF Implementados

### 1. **POST /api/siaf** - Crear Solicitud SIAF
**Descripción:** Crea una nueva solicitud SIAF y genera el PDF automáticamente.

**Autenticación:** Requerida (verifyToken)

**Body:**
```json
{
  "fecha": "2024-02-01",
  "correlativo": "SIAF-001-2024",
  "nombreUnidad": "Oficinas Centrales",
  "direccion": "7a Avenida 22-72 Zona 1",
  "areaId": 1,
  "justificacion": "Compra de equipo de oficina...",
  "nombreSolicitante": "Juan Pérez",
  "puestoSolicitante": "Jefe de Compras",
  "unidadSolicitante": "Oficinas Centrales",
  "nombreAutoridad": "María López",
  "puestoAutoridad": "Director General",
  "unidadAutoridad": "Oficinas Centrales",
  "consistenteItem": "Equipo de oficina",
  "items": [
    {
      "codigo": "001",
      "descripcion": "Computadora Dell",
      "cantidad": 5
    }
  ],
  "subproductos": [
    {
      "codigo": "SUB-001",
      "cantidad": 10
    }
  ]
}
```

**Respuesta Exitosa:**
```json
{
  "message": "Solicitud SIAF creada exitosamente",
  "siaf": { ... },
  "pdfGenerated": true
}
```

**Funcionalidad:**
- ✅ Valida usuario autenticado
- ✅ Valida área (opcional)
- ✅ Crea solicitud en BD
- ✅ Guarda items y subproductos
- ✅ Genera PDF automáticamente
- ✅ Calcula hash SHA-256
- ✅ Almacena PDF en /uploads/siaf/YYYY/MM/

---

### 2. **GET /api/siaf** - Listar Solicitudes
**Descripción:** Obtiene todas las solicitudes SIAF ordenadas por fecha de creación.

**Autenticación:** Requerida (verifyToken)

**Respuesta:**
```json
[
  {
    "id": 1,
    "correlativo": "SIAF-001-2024",
    "fecha": "2024-02-01",
    "estado": "pendiente",
    "nombreUnidad": "Oficinas Centrales",
    ...
  }
]
```

---

### 3. **GET /api/siaf/:id** - Obtener Solicitud por ID
**Descripción:** Obtiene los detalles completos de una solicitud específica.

**Autenticación:** Requerida (verifyToken)

**Parámetros:** 
- `id` - ID de la solicitud

**Respuesta:**
```json
{
  "id": 1,
  "correlativo": "SIAF-001-2024",
  "fecha": "2024-02-01",
  "estado": "pendiente",
  "items": [...],
  "subproductos": [...],
  "autorizaciones": [...]
}
```

---

### 4. **GET /api/siaf/:id/pdf** - Descargar PDF
**Descripción:** Descarga el PDF de una solicitud SIAF con verificación de integridad.

**Autenticación:** Requerida (verifyToken)

**Parámetros:**
- `id` - ID de la solicitud

**Funcionalidad:**
- ✅ Verifica integridad del archivo (SHA-256)
- ✅ Detecta archivos corruptos
- ✅ Descarga con nombre del correlativo
- ✅ Content-Type: application/pdf

**Headers de Respuesta:**
```
Content-Type: application/pdf
Content-Disposition: attachment; filename="SIAF-001-2024.pdf"
```

---

### 5. **PUT /api/siaf/:id/autorizar** - Autorizar Solicitud
**Descripción:** Autoriza una solicitud SIAF pendiente.

**Autenticación:** Requerida (verifyToken)

**Parámetros:**
- `id` - ID de la solicitud

**Body:**
```json
{
  "comentario": "Aprobado según presupuesto disponible"
}
```

**Respuesta:**
```json
{
  "message": "Solicitud SIAF autorizada exitosamente",
  "siaf": { ... },
  "autorizacion": {
    "id": 1,
    "accion": "autorizado",
    "comentario": "Aprobado según presupuesto disponible",
    "usuarioAutorizador": { ... },
    "fechaAutorizacion": "2024-02-01T10:30:00Z"
  }
}
```

**Validaciones:**
- ✅ Solo solicitudes en estado "pendiente"
- ✅ Registra usuario autorizador
- ✅ Guarda fecha y hora de autorización
- ✅ Permite comentario opcional

---

### 6. **PUT /api/siaf/:id/rechazar** - Rechazar Solicitud
**Descripción:** Rechaza una solicitud SIAF pendiente.

**Autenticación:** Requerida (verifyToken)

**Parámetros:**
- `id` - ID de la solicitud

**Body:**
```json
{
  "comentario": "Presupuesto insuficiente para este período"
}
```

**Respuesta:**
```json
{
  "message": "Solicitud SIAF rechazada",
  "siaf": { ... },
  "autorizacion": {
    "id": 2,
    "accion": "rechazado",
    "comentario": "Presupuesto insuficiente para este período",
    "usuarioAutorizador": { ... },
    "fechaAutorizacion": "2024-02-01T10:35:00Z"
  }
}
```

---

## 🔧 Correcciones Realizadas

### 1. **Entidad SiafSolicitud**
**Problema:** La propiedad `area` no era opcional pero `areaId` sí.

**Solución:**
```typescript
@ManyToOne(() => Area, { eager: true, nullable: true })
@JoinColumn({ name: 'area_id' })
area?: Area;

@Column({ name: 'area_id', nullable: true })
areaId?: number;
```

### 2. **Creación de Entidades**
**Problema:** Errores de TypeScript al usar `repository.create()`.

**Solución:** Usar `new Entity()` y asignar propiedades manualmente:
```typescript
const siaf = new SiafSolicitud();
siaf.fecha = new Date(fecha);
siaf.correlativo = correlativo;
// ...
```

---

## 📊 Flujo Completo de una Solicitud SIAF

```
1. Usuario crea solicitud (POST /api/siaf)
   ↓
2. Backend valida datos y usuario
   ↓
3. Se guarda en base de datos
   ↓
4. Se genera PDF automáticamente
   ↓
5. Se calcula hash SHA-256
   ↓
6. Se almacena PDF en /uploads/siaf/2024/02/
   ↓
7. Se actualiza registro con ruta y hash
   ↓
8. Solicitud queda en estado "pendiente"
   ↓
9. Autorizador revisa (GET /api/siaf/:id)
   ↓
10. Autorizador decide:
    - Autorizar (PUT /api/siaf/:id/autorizar)
    - Rechazar (PUT /api/siaf/:id/rechazar)
   ↓
11. Se registra la acción en siaf_autorizaciones
   ↓
12. Estado cambia a "autorizado" o "rechazado"
```

---

## 🗄️ Tablas Utilizadas

### siaf_solicitudes
- Almacena metadata de la solicitud
- Referencia al PDF (pdfPath, pdfHash, pdfSize)
- Estado (pendiente/autorizado/rechazado)

### siaf_items
- Items de la solicitud
- Relación CASCADE con siaf_solicitudes

### siaf_subproductos
- Subproductos de la solicitud
- Relación CASCADE con siaf_solicitudes

### siaf_autorizaciones
- Historial de autorizaciones/rechazos
- Auditoría completa (quién, cuándo, por qué)

---

## 🔐 Seguridad Implementada

✅ **Autenticación:** Todos los endpoints requieren token JWT
✅ **Validación:** Validación de usuario y área
✅ **Integridad:** Hash SHA-256 para cada PDF
✅ **Auditoría:** Registro completo de autorizaciones
✅ **Prevención:** No se puede autorizar/rechazar dos veces
✅ **Trazabilidad:** Timestamps automáticos

---

## 📁 Estructura de Archivos Generados

```
uploads/
└── siaf/
    └── 2024/
        ├── 01/
        │   ├── SIAF-001-2024.pdf
        │   └── SIAF-002-2024.pdf
        ├── 02/
        │   ├── SIAF-003-2024.pdf
        │   └── SIAF-004-2024.pdf
        └── 03/
            └── SIAF-005-2024.pdf
```

---

## 🧪 Pruebas Recomendadas

### 1. Crear Solicitud
```bash
curl -X POST http://localhost:3001/api/siaf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fecha": "2024-02-01",
    "correlativo": "SIAF-TEST-001",
    "nombreUnidad": "Test",
    "justificacion": "Prueba",
    "items": [{"codigo": "001", "descripcion": "Test", "cantidad": 1}]
  }'
```

### 2. Listar Solicitudes
```bash
curl -X GET http://localhost:3001/api/siaf \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Autorizar Solicitud
```bash
curl -X PUT http://localhost:3001/api/siaf/1/autorizar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comentario": "Aprobado"}'
```

---

## ✨ Próximos Pasos (Fase 3)

1. **Integrar Frontend con Backend:**
   - Modificar SiafBook.tsx para enviar datos al backend
   - Actualizar AutorizarSiaf.tsx para consumir endpoints reales
   - Actualizar SiafContext.tsx

2. **Testing Completo:**
   - Probar creación de solicitudes
   - Probar autorización/rechazo
   - Verificar generación de PDFs
   - Validar integridad de archivos

3. **Mejoras Opcionales:**
   - Paginación en listado
   - Filtros por estado/fecha
   - Búsqueda por correlativo
   - Notificaciones por email

---

## 📝 Archivos Modificados en Esta Fase

1. **backend/src/index.ts**
   - Agregados 6 endpoints de SIAF
   - Imports de servicios y entidades

2. **backend/src/entity/SiafSolicitud.ts**
   - Propiedad `area` marcada como opcional
   - Propiedad `areaId` marcada como opcional

---

**Fecha de Implementación:** Febrero 2024
**Estado:** ✅ COMPLETADO
**Siguiente Fase:** Integración Frontend-Backend
