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

## SCRUM-1188c · el `PUT` ya puede VACIAR el cobro de una plantilla (9-oct, S1)

**Medido contra:** `origin/main` = `85d8d01e64196569928b523c9074542d6ffbbd0a` · 2026-10-09T09:55:45Z

Es la línea de servidor que la parte C (editar una plantilla, de S2) tenía delante: c.18609 y c.19052.
La parte C NO se construye aquí.

**El fichero.** `src/modules/templates/app/routes/templates.routes.ts`. El encargo traía otra ruta, sin
`app/routes/` en medio, que no existe: se localizó con `git ls-tree -r origin/main --name-only`.

**Qué pasaba.** El `PUT` decidía con `req.body?.paymentTerms != null`, que junta dos cuerpos distintos:

| cuerpo | qué quiere decir | qué hacía | qué hace ahora |
|---|---|---|---|
| `{ name }` (la clave no viaja) | «no me cambies el cobro» | no tocaba la columna | igual |
| `{ paymentTerms: null }` | «déjala sin cobro» | **no tocaba la columna** | la vacía |
| `{ paymentTerms: "FIFTY_FIFTY" }` | «ponle éste» | lo escribía | igual |

**¿`null` es «sin cobro» o «no lo cambies»?** Medido, no supuesto: es «sin cobro».

- El `POST` de la misma ruta guarda `paymentTerms ?? null`, y la parte A manda ese `null` cuando el
  presupuesto está en «Plan personalizado» (aviso firmado en c.17332).
- «No lo cambies» ya tiene su forma, y es la que usa el único llamador del `PUT`
  (`public/dashboard/js/templatesView.js`, renombrar): manda `{ name }`, sin la clave.
- JSON distingue las dos, así que el `PUT` no necesita ningún valor centinela: basta con mirar
  `!== undefined` en vez de `!= null`. Por eso sigue siendo una línea.

**Qué cambia.** Esa línea, y nada más. `name`, `currency` y `lines` siguen con `!= null`: sus columnas
no admiten vacío y un `null` ahí sería un 500 de la base.

**Lo que NO cambia, y se dice.** `tiers` es la otra columna anulable (`Json?`) y sigue ignorando el
`null`. No la manda nadie (`scripts/_sin-consumir-declarados.json`) y vaciar un `Json?` por Prisma no se
ha medido: la sonda que lo intentó sin base salió CIEGA (su control, una columna que no existe, daba el
mismo error de conexión que los demás casos). El test la fija como está.

**Tampoco valida el valor.** Ni el `POST` ni el `PUT` comprueban que `paymentTerms` sea uno de los tres
que caben; eso no lo cambia esta entrega.

### Pruebas de SCRUM-1188c

`tests/scrum1188c-el-put-vacia-el-cobro.test.mjs`: 6 casos por el handler de `dist/`, con la base doblada
(`_envio-doblado.mjs`); se mide el `data` que la ruta le pasa a `quoteTemplate.update`.

- **Control positivo:** con la línea vieja caen 2 de 6 (el `null` que vacía, y el que fija `tiers`, que
  también manda `paymentTerms: null`); los otros 4 pasan con las dos versiones.
- Con la línea nueva: 6 de 6. Con sus vecinos (`scrum1379b`, `scrum1317`, `scrum1185`, `scrum1344`,
  `scrum1188`, `scrum1219`, `scrum337`): 124 pasan, 0 fallan, 0 saltos, en 8 ficheros.
- 🔴 **Sin `tsc`:** había entre 0,9 y 2,3 GB libres y no cabía. El `dist/` de esas tandas se hizo con
  `ts.transpileModule` fichero a fichero (321 de 321), que NO comprueba tipos. Los tipos los comprueba el
  check obligatorio del PR.

### No visto en yaqu.app, y por qué

El `PUT` con `paymentTerms: null` no lo manda ninguna pantalla hasta que exista la parte C, y
`scripts/qa/sesion-panel.mjs` sólo deja hacer `GET`, a propósito. Lo que sí se leyó en producción
(versión desplegada `85d8d01e…`, cuenta QA): la plantilla 38 tiene `paymentTerms: "FIFTY_FIFTY"` y
`tiers: null`, o sea que el `null` del `POST` llega a la base. El gesto entero lo ve S2 con su sonda al
construir la parte C.
