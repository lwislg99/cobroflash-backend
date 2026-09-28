# SCRUM-1188 (parte A) · «Guardar como plantilla» guarda también la condición de cobro

**Medido contra:** `origin/main` = `3f4c643e93871234e59e5ca5db145ba5cef8f9ee` · 2026-09-28T14:03:07Z

## Qué pasaba

`POST /admin/templates` acepta `paymentTerms` desde siempre, y el editor ya lo restaura al abrir una
plantilla desde «Plantillas → Usar» (SCRUM-926). Pero el único que guarda plantillas, «💾 Guardar como
plantilla» del editor, mandaba solo `{ name, currency, lines }`: una plantilla hecha desde el panel
nunca traía condiciones. Y el otro camino de aplicar —las fichas rápidas y «📋 Usar plantilla» DENTRO
del editor (`cargarPlantilla`)— solo leía líneas: aunque la plantilla trajera condición, no la ponía.

## Qué cambia (solo front, sin ALTER)

Decisión del orquestador en Jira (SCRUM-1188, c.17282):

- `quotesView.js`: `CONDICIONES_QUE_GUARDA_UNA_PLANTILLA = FULL_UPFRONT · FIFTY_FIFTY · MANUAL`, las
  que caben en `quote_templates.payment_terms`. Guardar manda `paymentTerms` si es una de ellas y
  `null` si no. **«CUSTOM» no se guarda**: sus tramos viajan aparte (`customBillingPlan`) y la
  plantilla no tiene columna; guardar «CUSTOM» sola abriría «Personalizado» con cero tramos.
- `cargarPlantilla`: si el editor está EN BLANCO (el mismo criterio que ya decide reemplazar las
  líneas) pone la condición de la plantilla. Si el presupuesto está empezado, solo suma líneas: no
  pisa las condiciones que el profesional ya eligió.
- `scripts/_sin-consumir-declarados.json`: `cuerpo · POST /admin/templates::paymentTerms` pasa a
  `retiradas` (trinquete de SCRUM-1185).

## Pruebas

`tests/scrum1188-plantilla-guarda-el-cobro.test.mjs` mide el viaje en el banco: elegir condición →
guardar → servidor en memoria con la regla de `templates.routes.ts` → montar OTRO editor → pulsar la
ficha → sale la condición. Por FIFTY_FIFTY, MANUAL y por «Usar» (plantilla como argumento). CUSTOM se
guarda con `null`. Control: con el presupuesto empezado, la ficha no cambia la condición.
Comprobado en rojo: sin `paymentTerms` en el cuerpo y sin restaurar en la ficha caen los 3 del viaje;
mandando cualquier valor cae el de CUSTOM.

## Lo que NO cierra este ticket

- **El aviso al guardar una plantilla en «Personalizado»**: el texto no está firmado (regla 39). Sin
  él, ese caso sigue perdiendo el plan sin avisar. Propuesta enviada al orquestador para firma.
- **B (plantilla de 3 opciones) y C (editar una plantilla guardada)**: APARCADAS por diseño
  (c.17282). `POST::tiers` y las cuatro de `PUT` siguen declaradas.
- **«Sin condiciones específicas»** (valor `""`): no es una de las tres; se guarda `null` y al aplicar
  el editor se queda en «Pago 100% al aceptar», igual que antes de este cambio. Reportado.
