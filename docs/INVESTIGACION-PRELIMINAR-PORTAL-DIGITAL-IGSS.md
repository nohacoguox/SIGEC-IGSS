# Investigación preliminar – Portal Digital IGSS  
## Trabajo de graduación – Viabilidad y dimensionamiento

---

## 1. Contexto y problema identificado

### 1.1 Unidad de estudio

- **Institución:** IGSS (Instituto Guatemalteco de Seguridad Social).  
- **Unidad:** Consultorio de Palín, Escuintla.  
- **Área de enfoque:** Área de Compras.

### 1.2 Situación actual (deficiencias)

| Problema | Descripción |
|----------|-------------|
| **Proceso manual** | Toda la documentación se trabaja en formato físico y en hojas de cálculo (Excel). |
| **Formatos Excel robustos** | Formularios pesados que incluyen catálogo de códigos de productos/bienes; el libro crece y se vuelve lento y difícil de manejar. |
| **Desperdicio de papel** | La magnitud de correcciones en cada expediente implica reimpresiones constantes. |
| **Búsqueda ineficiente** | Los SIAF se guardan en el mismo libro; al crecer, localizar un expediente o SIAF es tedioso. |
| **Libro de actas manual** | Control de números SIAF en libro físico; riesgo de duplicados o errores de secuencia. |
| **Rechazos en DAF** | La Dirección de Administración Financiera (DAF) departamental de Escuintla revisa todos los expedientes de los municipios; alto porcentaje de rechazos por: redacción incorrecta, ortografía, falta de comparación entre AS-400 y SIAF en mantenimientos, etc. |
| **Demora y reenvío** | Rechazos implican devolver expedientes completos a Palín, corregir, reimprimir, firmar y enviar de nuevo; cuellos de botella y pérdida de tiempo. |

### 1.3 Flujo actual resumido

1. **Origen:** Solicitud de compra (bien o servicio). Para servicios (mantenimiento, instalación) se requieren especificaciones técnicas (Informática del consultorio o Subgerencia de Tecnología).  
2. **SIAF:** Se anota el número en libro de actas; se llena el formato Excel (pesado por catálogo); se imprime y firma. El SIAF es la base de todo el expediente.  
3. **Documentos posteriores:** Orden de compras, acta administrativa, entre otros (según tipo de compra).  
4. **Expediente:** Se arma un expediente físico robusto (impreso y firmado).  
5. **Envío a DAF Escuintla:** Revisión de todos los expedientes de los municipios del departamento.  
6. **Revisión DAF:** Validación de SIAF (redacción, ortografía, coherencia con especificaciones técnicas y, en mantenimientos, con AS-400).  
7. **Rechazo:** Si hay errores, se devuelve todo el expediente; se corrige desde el SIAF y se reimprime y reenvía todo.

---

## 2. Idea del proyecto: Portal Digital IGSS

### 2.1 Objetivo general

Desarrollar un **portal digital** que permita:

- Llenar y gestionar el **SIAF** de forma digital (sin Excel pesado ni libro de actas físico).  
- Adjuntar documentos de respaldo (especificaciones técnicas, AS-400, etc.) desde el origen.  
- Enviar el SIAF a la **DAF** para que un analista lo evalúe en línea (aprobar/rechazar).  
- Mantener una **bitácora** de aprobaciones, rechazos y correcciones.  
- Una vez aprobado el SIAF, permitir armar un **expediente digital** con todos los documentos (incluidos los generados en otras plataformas como GuateCompras) y someterlo nuevamente a revisión del analista DAF.  
- Ofrecer **dashboards** para identificar cuellos de botella (quién tiene más rechazos, tiempos de evaluación, tiempo hasta aprobación).

### 2.2 Alcance inicial y proyección

- **Inicial:** Consultorio de Palín Escuintla (área de Compras) y DAF Escuintla (analistas con rol específico para revisar SIAF y expedientes).  
- **Proyección:** Extensión a otras unidades del departamento y, potencialmente, a otros departamentos.

---

## 3. Viabilidad como trabajo de graduación

### 3.1 Criterios típicos de un trabajo de graduación

| Criterio | Cumplimiento |
|----------|----------------|
| **Problema real y delimitado** | Sí: proceso manual, rechazos y demoras en el área de Compras del IGSS Palín y en la DAF Escuintla. |
| **Solución tecnológica definida** | Sí: sistema web (portal) con roles, flujo SIAF → DAF → expediente y bitácora. |
| **Alcance acotado** | Sí: se centra en SIAF, revisión DAF, expediente digital y métricas; no reemplaza GuateCompras ni otros sistemas externos. |
| **Base teórica y práctica** | Sí: gestión documental, flujos de aprobación, control de versiones (bitácora), dashboards; tecnologías (backend, frontend, BD) aplicadas. |
| **Resultado verificable** | Sí: prototipo funcional para Palín y DAF con datos de prueba y métricas. |
| **Proyección social/organizacional** | Sí: reducción de papel, tiempo y errores; mejora en la trazabilidad y control. |

### 3.2 Viabilidad técnica

- **Tecnologías utilizadas:** Backend (Node.js, Express, TypeORM), frontend (React, Material-UI), base de datos (PostgreSQL), almacenamiento de archivos y generación de PDF. Todas son viables y ya están en uso en el proyecto.  
- **Modelo de datos:** Entidades definidas (usuarios, roles, permisos, SIAF, items, bitácora, adjuntos, expedientes, catálogos, organización). Relaciones claras y normalizadas.  
- **Integración con sistemas externos:** El portal no sustituye GuateCompras ni otros sistemas; se limita a recepción de documentos (carga de archivos) y flujo interno de aprobación, lo que reduce dependencias críticas.

### 3.3 Viabilidad operativa y de investigación

- **Acceso al contexto:** La problemática se conoce por contacto directo con el Consultorio de Palín y el flujo de la DAF Escuintla.  
- **Investigación preliminar:** Este documento y el análisis del flujo actual constituyen la base; se puede complementar con entrevistas, revisión de formatos SIAF y de criterios de rechazo de la DAF.  
- **Dimensionamiento:** El mapa mental y el diagrama ER permiten dimensionar el tamaño del trabajo (módulos, entidades, relaciones y funcionalidades).

---

## 4. Conclusiones de la investigación preliminar

1. **La idea es viable** como trabajo de graduación: responde a un problema real, tiene alcance delimitado, solución tecnológica clara y resultado comprobable.  
2. **El proyecto está alineado** con los parámetros típicos de un trabajo de graduación (problema, objetivos, marco teórico-práctico, alcance y proyección).  
3. **La investigación preliminar** (contexto, flujo actual, deficiencias y propuesta) sustenta la viabilidad y sirve de base para el mapa mental y el diagrama ER que dimensionan el tamaño del trabajo.

---

*Documento elaborado con base en el proyecto Portal Digital IGSS y en el contexto del IGSS Consultorio de Palín Escuintla y DAF Escuintla.*
