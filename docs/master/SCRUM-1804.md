# SCRUM-1804 · IVA al 10 %: las pantallas de S2 y el informe X2 (PARTE S de SCRUM-1316)

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T09:37:05Z

**Skill UI:** cargada (`yaqu-premium-ui`) — ⚠️ TARDE: la cargué con el código ya escrito, cuando la suite
pidió esta línea. Repasado contra AB6 después: componentes del inventario AB3 (`.alert.warning`, el selector
común de 44 px), sin `style=`, `label` + `aria-required` + `aria-describedby`; capturas abajo.

Puesto S2 (frontend), rama `scrum-1804-iva10-parte-s` (base = merge-base `8e0d40816`). Ticket padre: **SCRUM-1316** (RDL 29/2026, desde el
1-dic-2026 el 10 % en obras de vivienda depende del medio de pago). El servidor y la ficha de factura los dejó
el equipo J en main (SCRUM-1316l, PR #3336/#3334/#3328). Esto pone lo que faltaba: el aviso al elegir el 10 %
en el editor, la ficha del TRABAJO y una línea del informe X2. Órdenes: orquestador `cobroflash-backend-41`,
24-nov (cola ①-⑤ de SCRUM-1804; SCRUM-1766, que detallaba ②, está deduplicado dentro de este ticket).

## ① El texto del aviso: MEDIDO, no escrito (regla 39)

Había dos redacciones firmadas, distintas: la variante A del fundador (SCRUM-1316 c.22084, copiada en
SCRUM-1766) y la de Javier (SCRUM-1316 c.22424, posterior). Medido con `git grep` en `public/`, `src/` y
`tests/` de `origin/main` `8e0d40816`:

| redacción | dónde está en main |
|---|---|
| **c.22424 (Javier)**: «Desde el 1 de diciembre de 2026, el IVA del 10 % en obras de vivienda solo se aplica si el cliente paga con tarjeta, transferencia bancaria, cheque nominativo o ingreso en cuenta. Si cobras en efectivo, consúltalo con tu asesor.» | `public/dashboard/js/invoicesView.js:123` (`COPY_IVA_10.avisoEfectivo`), que pinta la ficha de factura (`invoiceDetailView.js:1041`); `tests/scrum1316l-medio-de-cobro-con-iva-10.test.mjs:52` |
| variante A (c.22084): «…queda condicionado a que el cliente pague…» | **ningún fichero** de `public/`, `src/` ni `tests/` |

No hay mezcla entre pantallas, así que se usa la de c.22424, idéntica, y **sin copiarla**: las tres
pantallas de este ticket leen `window.COPY_IVA_10` (de J1). Decisión del orquestador en SCRUM-1804
c.22550 (delegación c.21978). T3, el error «Elige cómo lo has cobrado: en esta factura hay IVA al 10 %.»
(SCRUM-1316 c.22438), sale de esa misma constante (`COPY_IVA_10.eligeMetodo`). Texto nuevo de S2: **cero**.

## ② El aviso al elegir el 10 % (editor del presupuesto)

- `public/dashboard/js/tiposDeIva.js`: `conectarAvisoIvaAlDiez(select, contenedor)` ata al selector un
  `.alert.warning` (`role="status"`, `hidden`, atado por `aria-describedby`) y `avisoIvaAlDiezVisible(valor)`
  (puro: solo el 10 % exacto). El nodo **nace la primera vez que hace falta**, no al montar: la primera tanda
  completa lo cazó con `scrum697`/`scrum698` (el editor pasaba de 267 a 268 nodos al 21 %). En vez de
  cambiar esa exigencia, cambié el código: al 21 % el editor monta los mismos nodos que antes. `ponerValor` lo refresca, así que el aviso sigue al **valor** y no solo al clic (borrador, plantilla,
  IA, autocompletado y suplido escriben por `ponerValor` y no disparan `change`). Sin `COPY_IVA_10` servido
  no hay aviso: la pantalla no lo inventa.
- `public/dashboard/js/quotesView.js`: dos llamadas, en el IVA de la línea (hoja de ajustes, tras
  `vatTd.appendChild(vatInput)`) y en «IVA por defecto» del documento (`fieldVatDefault`). La línea `:385`
  del encargo es de antes: hoy el campo está en `quotesView.js:884`.
- No bloquea, no cambia el tipo elegido y no toca ningún cálculo (el test comprueba que el valor sigue siendo
  `10` después del aviso).

## ③ La ficha del trabajo (`jobDetailView.js`, «Marcar como PAGADA»)

**Medido antes de tocar:** la fila de factura de la ficha del trabajo NO tenía selector de método (mandaba
`{status:'paid'}` a pelo), y `GET /admin/jobs/:id` no servía `lines` ni `metodosConAvisoIvaAlDiez`: la
pantalla no podía saber si la factura lleva línea al 10 %. Se lo llevé al orquestador con tres opciones; la A,
la autorizada, añade al detalle del trabajo lo que la ficha de factura ya recibe.

- `public/dashboard/js/jobDetailView.js`: con `inv.conIvaAlDiez === true` (y solo el admin, que es quien
  puede marcar) se pinta «¿Cómo lo has cobrado?» con la pieza común `window.pintarSelectorMetodo`
  (`selectorMetodoCobro.js`, J2; opciones servidas, mismos `value` de `PAID_VIA`), `required` +
  `aria-required`; debajo, T4 cuando el medio elegido es de los que el servidor sirve con aviso
  (`window.avisoDeEfectivoVisible`, de J1). Al pulsar «Marcar como PAGADA» sin medio: T3 en la barra de
  estado y foco al selector, **antes** del `confirm` y del `prompt` del importe; con medio, el PUT lleva
  `paidVia` (`window.cuerpoConMetodo`). El servidor ya lo exigía (422, `invoiceAdmin.ts:430`).
- **Diferencia A PROPÓSITO con la ficha de factura** (decisión del orquestador, c.22550): allí J1 pinta el
  selector SIEMPRE, opcional, y obligatorio con el 10 %; aquí sale **solo** en facturas con línea al 10 %.
  Las demás filas siguen exactamente como hoy (mismo PUT `{status:'paid'}`). Si el fundador quiere unificarlo,
  es una condición y la decide él.
- Un servidor sin `conIvaAlDiez` (despliegue a medias) deja la ficha como hoy; el 422 del servidor sigue
  mandando.

### AUTORIZACIÓN NOMINAL (copiada literal del orquestador)

«AUTORIZACIÓN NOMINAL · 24-nov-2026 · cruce S2→S1 (opción A, decidida en SCRUM-1804 c.22550) — src/modules/jobs/app/routes/jobs.routes.ts sobre base 8e0d40816, SEIS líneas añadidas y cero quitadas: L83 import { llevaLineaAlDiez, METODOS_CON_AVISO_IVA_10 } de invoiceAdmin (solo lectura, sin ciclo) · L732 lines: true en el select de Invoice de serializeJobDetail (se lee y NO se serializa; el test lo exige y exige los 14 campos previos intactos) · L793-794 comentario · L795 conIvaAlDiez: llevaLineaAlDiez(inv.lines) · L796 metodosConAvisoIvaAlDiez: METODOS_CON_AVISO_IVA_10. Además ④: src/modules/reports/app/routes/reports.routes.ts L182 añade status: true al select del charge (SCRUM-1316 c.22445). invoiceAdmin.ts INTACTO. Rojo-primero visto: 9 rojos antes del código, 13/13 después; 5 mutaciones tumban su test cada una. — firma del orquestador, c.21978»

## ④ El informe X2 (`reports.routes.ts:182`)

`charge: { select: { method: true } }` → `{ method: true, status: true }`. La regla ya la había arreglado el
equipo J en `metodoDeUnCobro` (#3334, SCRUM-1316k): con `status` ausente se conservaba la regla vieja (el
cargo manda siempre). Ahora que X2 lo trae, un cargo NO pagado cede ante el método declarado. Decisión:
SCRUM-1316 c.22445. El tipo `FacturaDelInforme` no se ha tocado (una línea, como se pidió): el campo de más
viaja igual en tiempo de ejecución.

## ⑤ Qué · esperado · visto

`tests/scrum1804-iva10-parte-s.test.mjs` (13 casos). **Rojo primero:** escrito y corrido ANTES del código,
9 rojos, cada uno por su aserción (sin aviso, sin selector, PUT sin medio, `conIvaAlDiez` ausente, X2
contando `card`); el de la línea salió CIEGO y lo corregí para abrir la hoja de ajustes como el profesional.

| qué | esperado | visto |
|---|---|---|
| IVA por defecto al 10 % / 21 % / 4 % | aviso firmado byte a byte, `.alert.warning`, valor intacto / oculto / oculto | ✔ |
| IVA de la línea (hoja de ajustes) | ídem | ✔ |
| 10 % puesto por código / 0 % de suplido | aviso visible / oculto; conectar dos veces no duplica | ✔ |
| sin `COPY_IVA_10` | no hay aviso (ni vacío ni inventado) | ✔ |
| copias del literal en `tiposDeIva.js`, `quotesView.js`, `jobDetailView.js` | cero | ✔ |
| ficha del trabajo, factura con 10 % | selector obligatorio con su rótulo de siempre; T4 con efectivo, oculto con transferencia | ✔ |
| ídem, pulsar sin medio | T3, sin `confirm`/`prompt`, sin PUT | ✔ |
| ídem, con transferencia | PUT `{status:'paid', paidVia:'transfer'}` | ✔ |
| factura sin 10 % / servidor sin el campo | sin selector, PUT `{status:'paid'}` como hoy | ✔ |
| `GET /admin/jobs/:id` con facturas al 10 % y al 21 % | `conIvaAlDiez` true/false, `metodosConAvisoIvaAlDiez: ['cash']`, 14 campos previos intactos, `lines` NO servidas (el doble solo devuelve `lines` si el `select` las pide) | ✔ |
| X2 con cargo `pending` `card` y `paidVia: 'cash'` | cuenta `cash`, no `card` (el doble solo devuelve `status` si el `select` lo pide) | ✔ |
| X2 con cargo `paid` | manda el cargo (control positivo) | ✔ |

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, cinco, una por pieza): las cinco TUMBAN su test nombrado y el
árbol queda restaurado byte a byte (pasada manual; para los dos `.ts`, la mutación equivalente en su `.js` de
`dist/`).

**Suite completa:** _PENDIENTE_

## Capturas (antes = merge-base · después = esta rama; 390 y 1280)

`node scripts/capturas-iva10-parte-s.mjs` → `docs/master/evidencias/SCRUM-1804/`. _PENDIENTE_

## Lo que NO se ha tocado

`invoiceAdmin.ts`, `invoicesAdmin.routes.ts`, `invoiceDetailView.js`, `invoicesView.js` (J1),
`selectorMetodoCobro.js` (J2), `prisma/schema.prisma`, ningún cálculo de IVA ni el camino de emisión.
