---
marp: true
theme: default
paginate: true
backgroundColor: #f8fafc
style: |
  section {
    font-size: 24px;
    font-family: 'Segoe UI', sans-serif;
  }
  section.title {
    background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%);
    color: white;
  }
  section.title h1 {
    color: white;
    font-size: 2.2em;
    border: none;
  }
  section.title p {
    color: #e2e8f0;
    font-size: 0.9em;
  }
  section.section-title {
    background: #1e3a5f;
    color: white;
  }
  section.section-title h2 {
    color: white;
    font-size: 1.6em;
  }
  h1 {
    color: #1e3a5f;
    font-size: 1.8em;
    border-bottom: 3px solid #2c5282;
    padding-bottom: 0.2em;
  }
  h2 {
    color: #2c5282;
    font-size: 1.3em;
    margin-bottom: 0.5em;
  }
  ul {
    line-height: 1.5;
  }
  strong {
    color: #1e3a5f;
  }
  table {
    font-size: 0.85em;
  }
  table th {
    background: #1e3a5f;
    color: white;
    padding: 0.4em 0.6em;
  }
  table td {
    padding: 0.35em 0.6em;
  }
  footer {
    font-size: 0.65em;
    color: #64748b;
  }
---

<!-- _class: title -->

# Caso Práctico: ServiGlobal Contact Center

**Resolver — Gestión de servicios TI e ITIL**

Industria BPO / Servicios · 1.200 empleados · 3 sedes

---

<!-- _class: section-title -->

# 1. Procesos afectados

---

## 1. Procesos afectados

- **Gestión de incidentes** — Saturación del Service Desk y aumento del 35% en incidentes críticos.
- **Gestión del servicio al cliente** — Soporte telefónico, chat y backoffice; las caídas del CRM afectan a los tres canales.
- **Operación del CRM** — Indisponibilidad recurrente (2 veces por semana), impacto directo en agentes y clientes.
- **Cumplimiento contractual** — Penalizaciones por incumplimiento de niveles de servicio (ej. 150.000 USD).
- **Gestión de la capacidad** — Crecimiento del 40% en 18 meses sin escalar bien infraestructura y procesos.

---

<!-- _class: section-title -->

# 2. Detectar causas raíz

---

## 2. Detectar causas raíz

- **Infraestructura y aplicaciones** — El CRM no está dimensionado ni monitoreado para el volumen actual; posibles fallos de red, servidores o base de datos.
- **Falta de procesos estándar** — No hay procedimientos claros de gestión de incidentes, escalamiento ni priorización, lo que satura el Service Desk.
- **Crecimiento sin madurez** — El crecimiento no fue acompañado de mejoras en procesos, capacidad y controles.
- **Ausencia de gestión de problemas** — Se reacciona a incidentes sin análisis de causa raíz ni acciones preventivas.
- **Falta de SLA** — No hay objetivos claros ni métricas acordadas con el negocio.

---

<!-- _class: section-title -->

# 3. Por qué implementar ITIL

---

## 3. Por qué implementar ITIL

- **Procesos definidos** — ITIL aporta marcos para Gestión de Incidentes, Gestión de Problemas, Gestión de Nivel de Servicio y Gestión de la Capacidad.
- **Menos caídas y mejor respuesta** — Con Gestión de Problemas se atacan causas raíz (ej. del CRM) y se reducen incidentes repetidos; con Gestión de Incidentes se prioriza y escala mejor, aliviando el Service Desk.
- **Objetivos claros** — Gestión de Nivel de Servicio permite definir SLA con el negocio y con clientes, reduciendo penalizaciones y expectativas desalineadas.
- **Escalabilidad ordenada** — Gestión de la Capacidad y Gestión del Cambio ayudan a crecer de forma controlada sin degradar el servicio.
- **Cultura de mejora continua** — ITIL fomenta medición, indicadores y mejora, alineados con ingresos y productividad de agentes.

---

<!-- _class: section-title -->

# 4. Reducción de incidentes

---

## 4. En qué porcentaje se podrían reducir incidentes

**Referencia con ITIL:** muchas organizaciones logran **20–40%** menos incidentes repetidos y críticos en 12–24 meses.

**Objetivo para ServiGlobal:**
- **Reducción de 25–35%** de incidentes críticos en el primer año (estabilizando CRM, procesos y escalamiento).
- Reducción adicional en años siguientes con madurez de Gestión de Problemas.

**Condición:** Aplicar bien Gestión de Problemas (causa raíz del CRM), definir SLA y mejorar capacidad y monitoreo.

---

<!-- _class: section-title -->

# 5. SLA a nivel macro

---

## 5. Identificar los SLA a nivel macro

| SLA | Objetivo |
|-----|----------|
| **Disponibilidad del CRM** | 99,5% mensual (o 99,9% según contrato) |
| **Tiempo de respuesta (crítico)** | &lt; 15 min |
| **Tiempo de respuesta (alto)** | &lt; 1 h |
| **Tiempo de resolución (crítico)** | &lt; 4 h |
| **Tiempo de resolución (alto)** | &lt; 24 h |
| **Cumplimiento de SLA** | ≥ 95% mensual |
| **Disponibilidad de canales** | 99% en horario operativo |

---

<!-- _class: section-title -->

# 6. KPI de mejora

---

## 6. Identificar KPI de mejora

| KPI | Objetivo |
|-----|----------|
| Incidentes críticos | Reducción 25–35% en 12 meses |
| Disponibilidad CRM | Alcanzar y mantener SLA (99,5% / 99,9%) |
| MTTR (tiempo medio resolución) | Reducción 20–30% |
| Incidentes repetidos | Reducción con Gestión de Problemas |
| Cumplimiento de SLA | ≥ 95% |
| Horas perdidas por agente | De 2 h a &lt; 1 h por mes |
| Penalizaciones (USD/año) | De 150.000 USD hacia &lt; 50.000 USD |
| Saturación Service Desk | Reducir colas y reasignaciones |

---

<!-- _class: section-title -->

# Resumen

---

## Resumen

- **Procesos afectados:** incidentes, CRM, servicio al cliente, capacidad, cumplimiento contractual.
- **Causas raíz:** infraestructura, falta de procesos estándar, crecimiento sin madurez, ausencia de Gestión de Problemas y SLA.
- **ITIL** aporta procesos, SLA y KPIs para reducir incidentes, penalizaciones y tiempo perdido.
- **Objetivo:** 25–35% menos incidentes críticos, cumplir SLA y bajar penalizaciones en el primer año.

---

<!-- _class: title -->

# Gracias

**Caso Práctico ServiGlobal Contact Center**

*Resolver — ITIL y Gestión de Servicios TI*
