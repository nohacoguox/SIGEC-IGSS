# Opciones para estadísticas de motivos de rechazo

Objetivo: saber cuáles son los motivos más frecuentes de rechazo (falta documento, ortografía, mal explicado, etc.) y que el sistema pueda “aprender” o mejorar con el tiempo.

---

## Opción 1: Categorías fijas al rechazar (sin IA)

**Cómo funciona:** Al rechazar un SIAF, quien rechaza elige **una categoría** de una lista (ej. “Falta documento”, “Ortografía”, “Mal explicado”, “Datos incorrectos”, “Otro”) y opcionalmente escribe un comentario libre. Esa categoría se guarda y las estadísticas son un simple conteo por categoría.

**Ventajas:** Muy simple, rápido de implementar, datos claros y fáciles de interpretar.  
**Desventajas:** No “aprende” solo; las categorías son fijas (aunque un admin pueda ampliarlas más adelante).

**Ideal si:** Quieres resultados ya y no quieres depender de IA ni de procesos extra.

---

## Opción 2: Categorías + sugerencia por palabras clave

**Cómo funciona:** Igual que la Opción 1, pero además el sistema **sugiere** una categoría según el texto que escribe quien rechaza (ej. si escribe “falta el oficio” → sugiere “Falta documento”). Se puede mantener un listado de palabras clave por categoría que un administrador pueda editar; así el sistema “aprende” en el sentido de que se van afinando las reglas.

**Ventajas:** Sigue siendo sin IA, fácil de mantener; mejora la consistencia y la rapidez al rechazar.  
**Desventajas:** Requiere definir y actualizar las palabras clave.

**Ideal si:** Quieres categorías claras y una ayuda automática sin usar IA.

---

## Opción 3: IA para clasificar el comentario

**Cómo funciona:** Se sigue guardando solo el **texto libre** del rechazo. Un proceso (al guardar o en lote) usa un modelo de lenguaje (por ejemplo API de OpenAI, o un modelo local) para **clasificar** cada comentario en categorías predefinidas. Las estadísticas se calculan sobre esas categorías. El sistema “aprende” en el sentido de que el modelo interpreta frases nuevas.

**Ventajas:** Aprovecha todo el texto histórico y nuevo sin obligar a elegir categoría al rechazar.  
**Desventajas:** Necesita API key o modelo local, coste y posible tratamiento de datos sensibles.

**Ideal si:** Tienes muchos rechazos en texto libre y quieres explotarlos sin cambiar mucho el flujo actual.

---

## Opción 4: Híbrido (recomendado para crecer)

**Cómo funciona:**

- **De ahora en adelante:** Al rechazar, se elige **categoría** + comentario libre (como en Opción 1). Así las estadísticas de motivos son fiables desde el primer día.
- **Historial:** Para rechazos antiguos que solo tienen texto, se puede:
  - Clasificarlos **una vez** con reglas de palabras clave (Opción 2) o con IA (Opción 3) y guardar la categoría inferida, o
  - Dejarlos como “Sin clasificar” y que las estadísticas solo usen los rechazos nuevos.

**Ventajas:** Buen equilibrio: datos estructurados desde ya y posibilidad de sumar IA o reglas después.  
**Desventajas:** Un poco más de trabajo inicial (elegir categoría al rechazar).

---

## Recomendación

Empezar con **Opción 1** (categorías al rechazar) y guardar la categoría en base de datos. Así tienes ya la estadística de “mayoría de motivos de rechazo” y una base limpia. Luego se puede:

- Añadir **sugerencia por palabras clave** (Opción 2) en el mismo flujo de rechazo.
- O, si lo necesitas, **clasificar con IA** el historial o los comentarios nuevos (Opción 3) y seguir mostrando las mismas estadísticas por categoría.

En el código se implementa primero la Opción 1 (categorías + endpoint de estadísticas de motivos); la estructura permite añadir después sugerencia por palabras clave o IA sin romper lo ya hecho.
