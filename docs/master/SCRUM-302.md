# SCRUM-302 · C2: el patrón de detalle aplicado al albarán — la ley, la tabla y las tres premisas

**Fecha:** 5-ago-2026 · **Carril:** A (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `fbe050592594569b967100114bf41724eede6ff0` · 2026-08-05T11:29:24+02:00
**Tanda:** 1571 tests, 1503 pass, 0 fail (el resto, gateados a staging)

> ⚠️ **ENTREGA PARCIAL, declarada.** Esto entrega **la ley compartida, la tabla del albarán y sus
> guards**. La **página de detalle** (`albaranDetailView.js` + su ruta) **NO está construida**: el
> albarán sigue viviendo como fila dentro de la pila de DOCUMENTOS del Trabajo. Lo que hay aquí es
> el cimiento sobre el que esa página se pinta sin volver a decidir nada — y sin él, la página se
> habría escrito sobre tres premisas de las que **dos son falsas**.

## Una sola ley, que era el riesgo que el encargo nombró

La maquinaria del patrón (destinos, reglas, resolutor, marcador de microcopy) vivía dentro de
`invoiceActionsRegistry.js`. Se ha extraído a **`patronDetalleAcciones.js`**, y ahora la usan
**los dos** documentos: la factura sigue con sus guards de B2 en verde (20/20 sin tocarlos) y el
albarán declara **solo su tabla**.

Si el albarán se hubiera llevado su copia, hoy habría dos registros del mismo hecho — el defecto de
las dos listas que esta casa lleva toda la semana pagando. Hay un **suelo** que lo vigila: si algún
registro vuelve a definir su propio `destinoEfectivo`, rojo.

*(El resolutor conserva la semántica de B2 —`con-chargeId`/`sin-chargeId`— **y** admite la forma
genérica `ctx[cuando]` que necesita el albarán. Y una condición que nadie sabe responder se
**oculta**: el patrón entero se apoya en que la primaria sea de fiar.)*

## Las tres premisas, medidas — y dos desmienten al enunciado

**1 · El estado NO se llama «Enviado».** Son `borrador | emitido | firmado`, derivado del schema
(`estado String @default("borrador")`) y de `ALBARAN_ESTADOS`. El test **deriva los estados del
modelo** y los compara con la tabla: una columna inventada haría que ninguna transición cuadre.
Y «enviado para firmar» **existe, pero es un derivado** (`enviadoParaFirmaAt != null && estado ===
'emitido'`), no un estado — lo dice el propio schema.

**2 · «Facturado» no es un estado.** Es un derivado de **tres** valores —`sin_facturar`,
`parcial`, `facturado`— calculado contra `AlbaranLineaFacturada`. **Aplanarlo pierde el
parcial, que en una obra por fases es el caso normal.** Por eso no es columna de la tabla sino
**contexto**: la acción de facturar solo ocupa la primaria si queda algo pendiente. Con el albarán
ya facturado del todo —o sin contexto— se oculta, en vez de ofrecer un botón que no hace nada.

**3 · Las líneas del albarán no se pueden casar con las del presupuesto.** `AlbaranLineaFacturada`
referencia `lineaIndex` (el índice dentro del Json del **albarán**) e `invoiceId`; del
presupuesto, **nada**. Así que **no se construye ninguna vista de «albarán vs presupuesto»**, y hay
un test que se pone rojo si mañana aparece esa referencia — no para prohibirla, sino para que la
decisión se rehaga en vez de seguir asumiéndose.

## Verificado en rojo

- **Segunda primaria** en `emitido` → caen 2 tests, nombrando el estado.
- **«Enviado» metido como estado** → caen 4, con «la tabla usa estados que el modelo no tiene».
- **El guard de SCRUM-237 me cazó a mí**: mi `doesNotMatch` sobre `function destinoEfectivo` no
  tenía hermano positivo, así que habría sido verde para siempre aunque la regex estuviera rota. Se
  añadió el respaldo —el patrón **sí** casa en la ley compartida— en vez de silenciarlo.

## Lo que falta para cerrar C2

- **La página** (`albaranDetailView.js`, la ruta `albaran-detail`, el rail de solo lectura y el
  traslado de las acciones desde la fila del Trabajo).
- **Los rótulos**: siguen sin aprobar; la ley trae el marcador `[PENDIENTE microcopy oficial]` y
  la tabla **no escribe textos** (regla 30).
- **AB6 · matriz de dispositivos: hueco declarado.**

## Ficheros

`public/dashboard/js/patronDetalleAcciones.js` (nuevo — la ley) ·
`public/dashboard/js/invoiceActionsRegistry.js` (deja de definirla y delega) ·
`public/dashboard/js/albaranActionsRegistry.js` (nuevo — la tabla) ·
`tests/scrum302-patron-albaran.test.mjs` (8).
