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

- ~~El aviso al guardar una plantilla en «Personalizado»~~ → hecho en la rama
  `scrum-1188-aviso-plan-personalizado` (apéndice de abajo).
- **B (plantilla de 3 opciones) y C (editar una plantilla guardada)**: APARCADAS por diseño
  (c.17282). `POST::tiers` y las cuatro de `PUT` siguen declaradas.
- **«Sin condiciones específicas»** (valor `""`): no es una de las tres; se guarda `null` y al aplicar
  el editor se queda en «Pago 100% al aceptar», igual que antes de este cambio. Reportado → SCRUM-1219
  (decisión del orquestador: se arregla guardando y restaurando `""`, sin aviso).
- **Ancla de `scrum601`**: la constante nueva baja «Solo presupuesto (facturación manual)» de 935 a
  939; corregida con la cifra del propio censo (el check obligatorio de #1864 lo cazó).

## Apéndice · el aviso de «Personalizado» (28-sep, s2-28b)

**Medido contra:** `origin/main` = `cd78b8264d042dc01afe1ee714b002278f25e0a1` · 2026-09-28T14:42:22Z

Texto FIRMADO por el orquestador en SCRUM-1188, comentario 17332, pintado letra por letra:

> Plantilla "{nombre}" guardada sin el plan de cobro. Los tramos de un plan personalizado no se guardan
> en las plantillas: al usarla, elige el cobro en el presupuesto.

- Sustituye al éxito **solo** cuando el cobro es `CUSTOM` (condición de la firma); con las otras tres
  sale el éxito de siempre. Alerta neutra (ni `success` ni `error`): la plantilla se guardó, el plan no.
- Comprobado lo que afirma: la plantilla guarda líneas y `paymentTerms: null`; al usarla, el editor
  sale en «Pago 100% al aceptar».
- El literal va junto a su uso (no en lo alto del fichero) para no volver a mover el ancla de `scrum601`.
- Test: `scrum1188-plantilla-guarda-el-cobro` mira la alerta visible tras guardar. En rojo: sin aviso
  cae 1; con aviso siempre caen 2.
- CI del PR #1877 cayó en `scrum600` (censo de ranuras que nombran el documento: 29 → 30). Es la
  ranura NUEVA de este aviso, que dice «presupuesto»: entra en `RANURAS_A` en su posición con la
  referencia de la firma (c.17332), y el recuento pasa a 30 posiciones / 28 textos. No se relaja el
  censo: se le añade el texto que ahora existe.
