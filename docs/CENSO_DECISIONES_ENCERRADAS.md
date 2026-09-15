# Censo de decisiones de producto encerradas dentro de una vista — SCRUM-837

**Medido:** 2026-09-09T16:30:40+02:00 · `origin/main` = `54ad4a68b807b8f3e22c709947096fd48dd1d4ae`
(primera medición sobre `45e3012155ad5370a5404a5d725229cff7f55008`; **recontado** tras fusionar
`54ad4a68`, que trae SCRUM-832 tocando `quotesListView.js`. Las dos cuentas dan **10**.)
**Instrumento:** `node scripts/censo-decisiones-encerradas.mjs` (AST, no `grep`)
**Suelo:** `tests/scrum837-decisiones-encerradas.test.mjs` — corre en `npm test`

---

## 0 · Antes del número: el suelo, porque sin él un cero no es una respuesta

El censo se probó contra los **tres árboles de git de justo antes de cada arreglo**. No contra
casos inventados: contra los tres defectos que ya costaron un ticket cada uno.

| ticket | árbol | qué había que encontrar | ¿lo encuentra? |
| --- | --- | --- | --- |
| SCRUM-366 | `16ba5cf4^` | `jobNextAction` en `jobDetailView.js` | ✅ |
| SCRUM-823 | `786bdc59^` | `abrirAgendar` en `jobsView.js` | ✅ |
| SCRUM-831 | `9cacafad^` | `primariaDeAlbaran` en `jobDetailView.js` | ✅ |

Y **la calibración va en las dos direcciones**: los tres, ya arreglados, **no** salen en el árbol
de hoy. Un detector que dijera «sí» a todo también habría pasado la mitad de arriba.

> ⚠️ SCRUM-823 renombró la función al mudarla (`abrirAgendar` → `abrirAgendarTrabajo`). Buscando el
> nombre de DESPUÉS en el árbol de ANTES, el suelo decía «se escapa» sobre un censo que la estaba
> cazando bien. El fallo era de la comprobación, no del instrumento.

### Y el censo se cazó a sí mismo dos veces mientras se construía

🔴 **La ceguera del alias.** `invoiceDetailView.js` no nombra `INVOICE_ACTION_REGISTRY` dentro de
su resolutor: guarda `const REGISTRO_ACC = window.INVOICE_ACTION_REGISTRY` y usa el alias. Buscando
sólo el nombre del registro, **la función que de verdad decide qué se puede hacer con una factura
salía con cero documento y se descartaba**: el censo devolvía CERO resolutores de factura teniendo
uno. Se cazó porque dos números no cuadraban — `grep` decía un consumidor, el censo decía ninguno.

🔒 *La sospecha no encuentra cegueras; las encuentra un número que no cuadra con otro número.*

🔴 **La tercera columna definida de más.** «Esta pantalla pinta ese documento» estaba definido como
«decide por alguno de sus estados». `jobDetailView.js` pinta un Trabajo entero sin comparar contra
ningún literal de estado, así que quedaba fuera de la población y **la tercera columna de SCRUM-823
salía vacía** — justo la columna que sostiene el censo. Ahora también cuenta pedir el documento por
su ruta (`/admin/jobs`, `/admin/invoices`, …).

---

## 1 · La forma, y lo que este censo NO afirma

Se busca lógica que decide **qué se puede hacer con un documento** viviendo dentro del fichero de
una pantalla. Tres familias, calcadas de los tres casos reales:

- **① resolutor** — abre el registro de acciones y lo resuelve él. *(831)*
- **② segunda fuente** — decide por su cuenta qué control ofrecer, existiendo un registro al que no
  pregunta. *(366)*
- **③ ejecutor** — construye el control que escribe el cambio de estado. *(823)*

⚠️ **La barrera NO es de sintaxis.** El panel son `<script>` clásicos sin módulos (regla 4), así que
todos comparten ámbito global: una `function` de nivel superior en `jobDetailView.js` **sí** es
técnicamente alcanzable desde `albaranesView.js`. Las barreras reales son de **descubrimiento**
(nadie busca la regla del albarán dentro de la vista del Trabajo) y de **orden de carga** (el global
existe en tiempo de llamada, no de definición, y esa dependencia no está declarada en ningún sitio).

Por eso «vive en una vista» no es el hallazgo. **El hallazgo es la tercera columna.**

---

## 2 · El resultado en una tabla: quién tiene resolutor alcanzable y quién no

Ésta es la respuesta corta del censo, y se lee sola:

| documento | ¿resolutor alcanzable? | consumidores de su registro |
| --- | --- | --- |
| trabajo | ✅ `jobNextAction` · `destinoAccionTrabajo` (ficheros compartidos) | 2 pantallas |
| albarán | ✅ `primariaDeAlbaran` (`albaranAccion.js`, SCRUM-831) | 3 |
| **factura** | 🔴 **ninguno** — vive dentro de `renderInvoiceDetailView` | **1** |
| **presupuesto** | 🔴 **ninguno** — el registro existe y **no lo consulta nadie** | **0** |

**Los dos documentos que se arreglaron tienen resolutor compartido. Los dos que no, no.**

---

## 3 · LAS TRES COLUMNAS — las 10 candidatas

La máquina da 10. La tercera columna de la máquina es generosa (cualquier vista que pinte ese
documento y no llame a la función), así que cada fila lleva **veredicto leído a mano**.

| # | qué decide | dónde vive hoy | 🔴 quién la necesita y no la tiene | veredicto |
| --- | --- | --- | --- | --- |
| 1 | `ubicarAccion()` + `estadoFactura` + `ctxAcciones` — **qué se puede hacer con una factura** según su estado y si Bizum manual está disponible | `invoiceDetailView.js`, en **constantes locales dentro de `renderInvoiceDetailView`** | **`invoicesView.js`** (lista de Facturas) · `cobrosView.js` · `customerDetailView.js` · `renderInvoices()` de `quotesDetailView.js` | 🔨 **SE CONVIERTE EN TRABAJO** — hay mentira medida (§4) |
| 2 | `renderQuotesView` · `renderRows` · `submitQuickQuote` · `renderQuoteDetailView` — **qué se puede hacer con un presupuesto**, decidido por separado en CUATRO pantallas | `quotesView.js` · `quotesListView.js` · `homeView.js` · `quotesDetailView.js` | ninguna en concreto: **es que no lo tiene NADIE**. `QUOTE_ACTION_REGISTRY` está declarado y tiene **0 consumidores** | 📋 **QUEDA EN LA LISTA** — la más grande, sin mentira medida todavía |
| 3 | `destinoEnFila()` — el destino de UNA acción del albarán en la fila | `jobDetailView.js` | `albaranDetailView.js` · `albaranesView.js` | 📋 queda — ninguna miente: la lista ya usa `primariaDeAlbaran` y el detalle tiene su bucle |
| 4 | `buildAlbEditor()` — el editor de albarán incrustado en la ficha del Trabajo | `jobDetailView.js` | `albaranDetailView.js` (tiene el suyo, aparte) | 📋 queda — **dos editores del mismo documento**; sin mentira medida |
| 5 | `jobRow()` — escribe el estado del Trabajo desde la lista | `jobsView.js` | `jobDetailView.js` | ✅ **sin hueco** — SCRUM-823 verificó las dos pantallas en los cinco estados y lo vigila `guard:escalera-por-estado` |
| 6 | `loadRequests()` — `status === 'pending'` | `quoteRequestsView.js` | — | ❌ **FALSO POSITIVO**: ese `pending` es de una **solicitud**, no de una factura. Estado homónimo (§6) |

Las filas 7-10 de la salida cruda (`renderQuoteDetailView`, `renderInvoices`, `renderRows`,
`renderQuotesView`) están agregadas arriba en las filas 1 y 2: son la misma decisión repartida.

### Y hay una cuarta resolución a mano del registro de albarán

Además de `albaranAccion.js` (compartido), **`albaranDetailView.js` recorre el registro por su
cuenta** con su propio contexto duplicado, y `jobDetailView.js` tiene `destinoEnFila`. Tres sitios
resolviendo lo mismo, uno de ellos alcanzable. No miente ninguna pantalla hoy —por eso queda en la
lista— pero es la mitad del camino, no el final.

---

## 4 · 🔨 LA QUE SE CONVIERTE EN TRABAJO: la lista de Facturas MIENTE hoy

Regla 37: sólo se convierte en trabajo la que tenga una pantalla concreta que hoy miente. Ésta la
tiene, y la mentira está medida, no supuesta.

**El registro lo declara** (`invoiceActionsRegistry.js`):

```
{ id: 'btnTogglePaid', destinos: { pending: 'primaria', paid: 'overflow',
                                   annulled: 'oculta',  R1: 'oculta' } }
```

`annulled` → **oculta**. `R1` → **oculta**. Marcar pagada una anulada o una rectificativa no es una
acción de esos estados.

**Y la lista lo ofrece igual:**

| lo medido | dónde |
| --- | --- |
| `soloFacturas()` filtra **sólo los justificantes** → las `annulled` y las `R1` **sí se listan** | `invoicesView.js:79` |
| la casilla se crea en **todas** las filas, sin mirar `inv.status` | `invoicesView.js:581` |
| «Seleccionar todas» las marca todas, incluidas ésas | `invoicesView.js:407` |
| la barra ofrece **«✓ Marcar como pagadas»** sobre el lote entero | `invoicesView.js:431` |
| `invoicesView.js` consulta el registro, la ley o un resolutor | **0 veces** |
| la tabla tiene **7 columnas y ninguna es «Acciones»** | `invoicesView.js:407-413` |

Es exactamente la forma de SCRUM-823 —una acción ofrecida en un estado que no la admite— con la
diferencia de que **el registro que lo impediría ya existe**: la lista simplemente no puede
preguntarle.

Y cuadra con la otra medición, hecha ayer por otro camino: en `docs/CENSO_ACCION_DEL_80.md`,
**Facturas salió como «la segunda peor»** de las cinco listas, sin acción nombrada en la fila y con
su acción del 80% en la barra de arriba. Dos instrumentos distintos, el mismo sitio.

### Lo que NO se hace aquí

No se arregla en este ticket. Se entrega el censo y su mecanismo; el arreglo es el ticket de
Facturas, que es el siguiente y va solo (A17: un ticket, una rama, un PR).

---

## 5 · Lo que este censo NO cubre, dicho antes de que alguien lo dé por completo

- **Los estados que no están en una lista declarada.** Sólo se leen `ALBARAN_STATES`,
  `INVOICE_STATES`, `QUOTE_STATES` y `JOB_STATES`. Un documento sin su lista —las **solicitudes de
  presupuesto**, los **partes**— es invisible para este censo.
- **Los estados homónimos.** `pending` es a la vez estado de factura y de solicitud, y el censo no
  los distingue: por eso la fila 6 es un falso positivo. Se declara, no se esconde.
- **Las decisiones que no miran el estado.** Una regla de producto por permisos, por importe o por
  bandera no entra por ninguna de las tres familias.
- **② segunda fuente da 0 hoy, y eso es un artefacto del orden.** Las familias se asignan por
  prioridad ①→③→②, así que una función que además escribe sale como ③. El 0 de ② significa «ninguna
  que no fuera ya otra cosa», no «no existe ese defecto».
- **El servidor.** Sólo se mira `public/dashboard/js`.

---

## 6 · Cómo reproducirlo

```bash
node scripts/censo-decisiones-encerradas.mjs                # el árbol de hoy
node scripts/censo-decisiones-encerradas.mjs --ref 9cacafad^ # un árbol histórico
node --test tests/scrum837-decisiones-encerradas.test.mjs    # el suelo
```

El censo **se declara ciego por documento** cuando no puede leer una lista de estados en su fuente
(pasa en árboles de julio de 2026, sin registro de albarán ni de presupuesto) y **para con exit 2**
si le falta alguna en el árbol de trabajo. Un censo parcial no se presenta nunca como completo.
