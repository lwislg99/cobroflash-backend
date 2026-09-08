# Los tres rótulos del atajo «N» — presupuesto, cliente y factura

**Aprobados por el fundador** el 4-sep-2026, en **SCRUM-599**.
**Aplicados en el mismo acto** (regla 30).

## Textos aprobados, literales

| Ranura | Texto aprobado |
|---|---|
| `atajoNuevo.TEXTOS["quotes-list"]` | Nuevo presupuesto |
| `atajoNuevo.TEXTOS.customers` | Nuevo cliente |
| `atajoNuevo.TEXTOS.invoices` | Nueva factura |

## Dónde se pinta cada uno

Los tres salen de **un solo sitio** —`public/dashboard/js/atajoNuevo.js`, la constante `TEXTOS`— y
de ahí los recogen tres pantallas distintas. Medido, no supuesto:

| Texto | Quién lo pinta | Cómo |
|---|---|---|
| Nuevo presupuesto | `public/dashboard/js/quotesListView.js:48` | `atajoNuevo.etiquetar(createBtn, "quotes-list")` — botón `btn-primary btn-sm` + `<kbd>N</kbd>` |
| Nuevo cliente | `public/dashboard/js/customersView.js:73` | `atajoNuevo.etiquetar(newBtn, "customers")` — igual |
| Nueva factura | `public/dashboard/js/invoicesView.js:174` | `atajoNuevo.textoDe('invoices')` — **sin `etiquetar`**: monta su propio botón `btn-primary`, sin la tecla |

**Las cajas, medidas en navegador real** con el CSS de producción y la cabecera reproducida
(`.view-container > .data-card > .data-card-header`):

| Texto | A 929 px | A 390 px |
|---|---|---|
| Nuevo presupuesto | 171,5 × 30 px | 134,8 × 30 px |
| Nuevo cliente | 138,8 × 30 px | 208,6 × 30 px |
| Nueva factura | 155,3 × 36 px | 155,3 × 44 px |

Los tres caben con holgura: el rótulo **es** la caja, porque el botón crece con su texto y ninguno
llega a desbordar su cabecera a 390 px (comprobado: la página no scrollea en horizontal).

El `<kbd>N</kbd>` **desaparece por debajo de 640 px** (`styles.css:2761`): en una pantalla sin
teclado la tecla no significa nada. En móvil, los tres botones son sólo texto.

## Qué cambió

**Ni una letra de los tres textos.** Ya estaban aplicados desde SCRUM-599 con la aprobación del
asesor; lo que faltaba era la firma del fundador. Lo que cambia es lo que se declara:

* `SIN_APROBAR` pasa de **3 a 0** en `atajoNuevo.js`.
* La constante **NO se retira**, y aquí está la diferencia con una entrada del censo de SCRUM-402
  —que sí se borra—: el cero de `SIN_APROBAR` no dice «no hay nada que declarar», dice **«las tres
  que hay están firmadas»**. El día que una cuarta lista estrene su atajo, su rótulo nace sin firma,
  el número sube y los dos tests que lo atan caen.
* El comentario de cabecera deja de decir «a la espera de la firma del fundador» y dice quién firmó
  y cuándo.

## Qué queda sin firmar en esas pantallas

**Nada de microcopy.** `atajoNuevo.js` no tenía —ni tiene— un solo marcador: medido, **cero**
`[PENDIENTE` en el fichero, y por eso nunca estuvo en el censo de SCRUM-402. Aplicar esta firma **no
mueve ese censo**, y eso es lo correcto: no había marcador que retirar.

## Dos cosas medidas al aplicarlo que NO son microcopy, y no van como «pendientes de firma»

1. **«Nueva factura» no pasa por `etiquetar`:** monta su propio botón, más grande y sin la tecla.
   No es un texto sin aprobar — es que la pieza se cerró con tres listas de cuatro. **SCRUM-721.**
2. **Ninguno de los tres llega a 44 px de alto** en escritorio (30 · 30 · 36), y los dos `btn-sm`
   tampoco en móvil. Es el objetivo táctil de AB6 y **no lo avisa `guard:objetivo-tactil`**.
   **SCRUM-711.**
