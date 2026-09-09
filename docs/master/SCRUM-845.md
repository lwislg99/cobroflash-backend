# SCRUM-845 · La lista de Facturas ofrecía una acción en un estado que el registro declara oculta

**Medido contra:** `origin/main` = `2484eee73462e6b4be69ee0b15343075a5a606dc` · 2026-09-09T16:56:44+02:00
**Rama:** `scrum-845-facturas-accion-en-estado-oculto`, partida de `main`.
**Origen:** SCRUM-837 — la primera vez que esta familia la encuentra un instrumento.

---

## 1 · ✅ Primero, lo que NO pasaba

**No había daño de datos.** `POST /admin/invoices/bulk-paid` ya filtraba con
`status: { notIn: NO_SE_MARCAN_PAGADAS_EN_LOTE }` (`['paid','annulled']`), que SCRUM-496 puso ahí
exactamente para esto. Y una rectificativa nace con `status: 'paid'`
(`invoicesAdmin.routes.ts:1000`), así que también queda fuera. Ninguna anulada volvía a salir
cobrada.

> 🔴 **Mi primera versión del ticket daba a entender que la acción se ejecutaba.** Al medir el
> servidor resultó que no. Se corrigió la descripción en Jira antes de escribir una línea. El
> ticket queda más pequeño y más cierto: **el servidor es sólido; el defecto era de la pantalla.**

## 2 · 🔴 Lo que sí pasaba

| lo medido | dónde |
| --- | --- |
| `soloFacturas()` filtra **sólo los justificantes** → las `annulled` **se listan** | `invoicesView.js:79` |
| la casilla se creaba en **todas** las filas, sin mirar `inv.status` | `invoicesView.js:580` |
| «Seleccionar todas» las incluía → el camino por defecto | `invoicesView.js:407` |
| el servidor las descarta en silencio y devuelve `updated` | `invoicesAdmin.routes.ts:413` |
| la pantalla pinta `textoMarcadas(updated)` con tono **`success`** | `invoicesView.js:35` |
| `invoicesView.js` consultaba el registro, la ley o un resolutor | **0 veces** |

**La secuencia:** seleccionas 5 (3 pendientes + 1 anulada + 1 pagada) → pulsas → **«✓ 3 facturas
marcadas como pagadas»**, en verde. Dos filas no cambiaron. No dice cuáles ni por qué.

Y el registro firmado ya lo declaraba: `btnTogglePaid → { annulled: oculta, R1: oculta }`. El
detalle la escondía; la lista la ofrecía. **Dos pantallas, el mismo documento, respuestas
distintas.**

## 3 · La causa: la CUARTA vez de la familia

| ticket | qué vivía encerrado | quién no lo tenía | **quién lo encontró** |
| --- | --- | --- | --- |
| SCRUM-366 | `jobNextAction` en `jobDetailView.js` | la lista de Trabajos | una persona |
| SCRUM-823 | `abrirAgendar` en `jobsView.js` | el detalle del Trabajo | una persona |
| SCRUM-831 | `primariaDeAlbaran` en `jobDetailView.js` | la lista de Albaranes | una persona |
| **SCRUM-845** | `ubicarAccion` + `estadoFactura` + `ctxAcciones` | **la lista de Facturas** | 🔴 **`npm run censo:decisiones-encerradas`** |

Y aquí estaba **más** encerrado que en los tres anteriores: no era una función de fichero, eran
**constantes locales dentro de `renderInvoiceDetailView`**. En los otros casos había al menos un
nombre que mover; aquí no había ni eso.

🔒 *Una decisión de producto no vive en una vista.*

## 4 · El arreglo

**`public/dashboard/js/invoiceAccion.js`** (nuevo) — traslado **VERBATIM**, sin rediseño:

- `estadoDeFactura` — el mapeo de los cuatro estados de la Parte L. `R1` manda porque es el `type`,
  columna **distinta** de `status`; `expired` es un `pending` vencido.
- `ctxAccionesFactura` — los dos predicados **complementarios** de Bizum (SCRUM-402), que
  garantizan que la ranura primaria nunca queda vacía.
- `destinoDeAccionFactura` — la resolución contra `INVOICE_ACTION_REGISTRY`, ahora **con nombre**.

`invoiceDetailView.js` los consume: mismo criterio, mismo registro, mismo `destinoEfectivo`, ni un
destino cambiado. Se borra `ctxAcciones`, que quedaba sin lector — dejarlo habría dejado en pantalla
dos contextos donde hay uno, que es el aspecto exacto del defecto.

### 🔴 Y la lista pregunta a `sePuedeMarcarPagadaEnLote`, NO al registro

Son **dos preguntas distintas**:

| pregunta | quién la contesta | `annulled` | `paid` |
| --- | --- | --- | --- |
| ¿dónde va el interruptor en el DETALLE? | `INVOICE_ACTION_REGISTRY` | oculta | **overflow (visible)** |
| ¿puede pasar a pagada en LOTE? | `puedeMarcarsePagadaEnLote` (servidor) | no | **no** |

Coinciden en `annulled` y **no** en `paid`. Contestando la de la lista con el registro, el defecto
se habría quedado a medias **justo en el caso más común**. El encargo hablaba del registro; la
medición dice que la fuente buena es la del servidor, y **gana la medición**.

**El espejo, y su mecanismo.** El panel es vanilla sin bundler (regla 4) y no puede importar
TypeScript, así que `FACTURA_NO_SE_MARCA_PAGADA_EN_LOTE` es una copia. *Un espejo sin mecanismo es
una copia que diverge en silencio*: el test importa la constante del servidor desde `dist/` y exige
el **mismo conjunto** — conjuntos, no cuentas, porque un número igual deja pasar «he perdido una y
he ganado otra».

### La casilla se QUITA, no se deshabilita

🔒 *Un control que no se puede usar y no puede explicar por qué, no se deshabilita: se quita.* Una
casilla muerta no sabe decir si es el permiso, la carga o el estado — y decirlo exigiría un texto
que nadie ha firmado (regla 30).

Se llama **sin guarda `typeof`**, igual que `soloFacturas` y por el mismo motivo: con guarda, un
resolutor ausente degradaría al comportamiento **viejo** —casilla en todas— en silencio. Un fallo
tiene que reventar, no volver al defecto.

## 5 · Verificación

`tests/scrum845-la-lista-pregunta-lo-que-el-servidor-contesta.test.mjs` — 7 en verde, y **los tres
probados EN ROJO** con un caso que cae dentro del mecanismo:

| rojo inyectado | qué cayó |
| --- | --- |
| `expired` añadido al espejo del panel | **2** tests: el de conjuntos (nombrando `expired`) y el de predicados estado a estado |
| la condición de la casilla → `if (true)` | el de la lista, nombrando «vuelve a crearse en TODAS las filas» |
| el contexto de Bizum reescrito en el detalle | el del detalle, citando el precedente de SCRUM-831 |

**Y el juez independiente:** `npm run censo:decisiones-encerradas` pasa de **10 a 9** y de **2
resolutores encerrados a 1**. El instrumento que encontró el defecto registra su propio arreglo —
que es la otra mitad de su calibración.

## 6 · Lo que salió mal, y lo cuento yo

🔴 **Backticks a través del shell, otra vez.** El primer `git commit -m` llevaba `` `paid` `` y la
shell lo ejecutó: el mensaje quedó con un hueco («El registro manda ⟨nada⟩ a overflow»). Es mi
trampa documentada y van cinco esta semana. Enmendado con el mensaje **en fichero**, y comprobando
antes con `ls-remote` que la rama no estaba publicada — un amend sobre algo empujado sí sería
reescribir historia (AA2).

## 7 · Lo que NO se ha tocado

- El camino de emisión: **sólo leído** (regla 38). Ni una línea del servidor.
- `INVOICE_ACTION_REGISTRY` ni sus destinos · `NO_SE_MARCAN_PAGADAS_EN_LOTE` · `prisma/schema.prisma`.
- **Ni una columna «Acciones» en la lista.** Eso es rediseño de pantalla y no es este ticket; queda
  propuesto aparte.
- Las otras nueve filas del censo de SCRUM-837 siguen en la lista, sin mentira medida.
