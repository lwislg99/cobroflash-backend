# SCRUM-1451 · los 1-2 céntimos entre el presupuesto y la suma de sus facturas

## 22-oct-2026 · S4 · el céntimo de MENOS se pinta como deuda (sólo medir; no se ha tocado código)

**Medido contra:** `origin/main` = `a593817dd933b3dcc36224ff8594fdedff3d8b96` · 2026-10-22T10:41:59Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1451-un-centimo-de-menos`. Encargo del
orquestador del equipo de Luis, antes de proponer el texto del ticket: ¿abre hoy una deuda un cobro que
quede 1 céntimo POR DEBAJO de lo aceptado?

A9: comprobación → `docs/master/evidencias/SCRUM-1451/sonda-1451-un-centimo-de-menos.mjs`

**Por qué se miró.** SCRUM-141 acepta que las facturas de un presupuesto por tramos sumen 1-2 céntimos
distinto de lo aceptado. Por ARRIBA, el panel ya calla: `cobradoDeMas` (`jobCobroHuecos.js:318-322`)
sólo avisa por encima de 0,02 €. Por ABAJO no había nada que lo dijera.

**① ¿Pasa? Sí, en uno de cada tres casos.** `sonda-1451-signo-del-reparto.cjs` usa la misma cadena y la
misma población que `evidencias/SCRUM-1439/sonda-factura-detalle.cjs`: funciones puras de `dist/`,
encadenadas como al aceptar, con 299.901 importes de 1 a 3.000 € al 21 %.

| plan | con diferencia | por ENCIMA | por DEBAJO | por céntimos |
|---|---|---|---|---|
| FIFTY_FIFTY | **3.808** (= lo que midió 1439: control) | 2.587 | **1.221** | −1: 1.221 · +1: 1.423 · +2: 1.164 |
| FULL_UPFRONT | 0 | 0 | 0 | — |

Ejemplo por debajo: presupuesto **8,23 €** → sus dos facturas suman **8,22 €**.

**② ¿Qué ve el profesional? Una deuda de un céntimo que no puede cerrar.**
`sonda-1451-un-centimo-de-menos.mjs` ejecuta el servidor (`estadoCobroFor` e `importeDeReferencia` de
`dist/.../job.service.js`) y pinta la lista y la ficha del Trabajo en el banco de vistas. El caso: un
presupuesto de 3,40 € con sus dos facturas de tramo emitidas y pagadas; sólo cambia lo cobrado.

| caso | servidor | lista de Trabajos | ficha (franja) | píldora |
|---|---|---|---|---|
| **un céntimo de MENOS (3,39)** | **Parcial** | **«0,01 € de 3,40 €»** | **«Te falta por cobrar · 0,01 €»** | **Parcial** |
| control · igual (3,40) | Pagado | «✓ Cobrado 3,40 €» | «Cobrado del todo · 3,40 €» | Pagado |
| control · deuda real (1,70) | Parcial | «1,70 € de 3,40 €» | «Te falta por cobrar · 1,70 €» | Parcial |

Salida 0 = reproducido. Y el Trabajo cuenta en «Terminados sin cobrar» (`terminadoSinCobrar.js`: «Parcial»
es estado con deuda). Todas las facturas están pagadas, así que no hay ningún cobro que registrar.

**Mutación con la forma del arreglo esperado** (la lección de SCRUM-1518: la prueba con la misma forma
que el arreglo, no una igualdad cualquiera). Un margen de 2 céntimos en las TRES piezas a la vez:
`estadoCobroFor` (`job.service.ts:424`, cambiado sólo en `dist/`), `faltaPorCobrarDe`
(`terminadoSinCobrar.js:71`) y `pendiente` (`jobDetailView.js:742`). Resultado: el céntimo de menos pasa
a «Pagado / ✓ Cobrado / Cobrado del todo», los dos controles siguen igual y la sonda sale con **1**.
Árbol restaurado con `git restore` y `dist/` recompilado.

**Lo que esto cambia del ticket:**
- **Es un DEFECTO, no un texto.** Las tres piezas (servidor S1; `terminadoSinCobrar.js` y
  `jobDetailView.js` de S2) miden contra lo aceptado sin el margen que SCRUM-141 aceptó y que
  `cobradoDeMas` ya aplica hacia arriba. Con el margen, el «✓ Cobrado» y el «Cobrado del todo» ya
  firmados dicen la verdad: no hace falta texto nuevo para esto.
- **Hoy no lo ve nadie:** en España no se emite ni se cobra por YaQu hasta SIF-1 (regla 24, leída en
  `CLAUDE.md`; el flag de producción no lo he medido) y no hay clientes reales. Lo verá el primer
  profesional que cobre por tramos con la facturación encendida, en un tercio de los casos con
  diferencia.
- **El aviso del ticket sigue haciendo falta**, ahora en los dos sentidos: «… suman 0,01 € menos …».

**Lo que no está medido:** la población es la de 1439 (cantidad 1, un tipo, 21 %, 2 decimales), no la
de presupuestos reales. Con tipos mezclados o planes personalizados, el reparto puede salir en otra
proporción.

## SCRUM-1451b · 23-oct-2026 · S4 · ¿se ve en producción? No: la cuenta QA no puede llegar al estado

**Medido contra:** `origin/main` = `6c8706daef7399513e69e6872068aa7bed25b760` · 2026-10-23T12:38:09Z ·
`yaqu.app/version` = el mismo SHA (cabecera `Date` 12:28:10Z).

A9: sin fallo que generalice — sólo medir, con GET de `scripts/qa/sesion-panel.mjs`; sin código ni sonda nueva

Encargo del orquestador: con producción viva, ¿se puede reproducir de punta a punta en la cuenta QA el
«Te falta por cobrar · 0,01 €»? **No, y es una respuesta con motivo, no un «no pude mirar»:**

| qué | ruta (cuenta `luisdragonball+qa@gmail.com`, merchant 46) | lo recibido |
|---|---|---|
| modo de emisión del merchant | `GET /admin/me` → 200 | `"modoEmision": "receipt"` → con `INVOICING_ES_ENABLED` en OFF para este merchant (`emission.service.ts:40`). Esto mide lo que ayer quedó «no medido»: el efecto del flag en la cuenta QA |
| facturas | `GET /admin/invoices` → 200 | `[]` |
| trabajos | `GET /admin/jobs` → 200, 3 filas | el #77 (presupuesto #206, `FULL_UPFRONT`, 1,21 €) da `"estadoCobro": "Pendiente"`, `totalCobrado` 0, `invoices: []` — **control positivo:** el semáforo se lee; lo que falta es el dinero |

**Por qué no se llega.** `totalCobrado` es la suma de las facturas `paid` de los presupuestos del Trabajo
(`job.service.ts:313-317`). Sin factura no hay cobro que sumar, y las dos vías de factura de un
presupuesto contestan `409 facturacion_no_disponible` en modo `receipt`
(`quotesAdmin.routes.ts:258` y `:582`, regla 24 / SCRUM-1027). **Leído en el código, no intentado, a
propósito:** intentarlo es pedir una factura, y R25 (condición 5) lo excluye siempre. Tampoco se crea
otro merchant (puerta de SCRUM-390, aviso del orquestador del 23-oct).

**Quién sí llega hoy (MI LECTURA del código, no visto):** un merchant de fuera de España (modo `fiscal`,
`emission.service.ts:38`) y el demo (modo `demo`, regla 8: no se toca). En España, nadie hasta que el
flag se encienda tras SIF-1. Sin clientes reales, hoy no hay a quién le pase.

Los tres sitios del arreglo siguen siendo de otros (servidor `job.service.ts:424` → S1; lista y ficha →
S2), y la pregunta de si un céntimo corto cuenta como «cobrado del todo» sigue en la lista del fundador.
No se ha tocado código.
