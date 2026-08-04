# SCRUM-257 · ALBARÁN DESDE PRESUPUESTO: nace prellenado, y no nace sin presupuesto

**Fecha:** 4-ago-2026 · **Carril:** A · **Gate:** sin gate — sin schema, sin fiscal, sin dinero
**Medido contra:** `origin/main` = `24e0e4f336119797cc40e45f29fadc34d399352a` · 2026-08-04T11:17:22+02:00
**Tanda:** 1191 tests, 1124 pass, 0 fail (el resto, gateados a staging)

## Qué cambia para quien lo usa

«+ Nuevo albarán» ya no abre un borrador vacío: **abre el borrador con las líneas del presupuesto,
sin precios**. El pro tacha lo que no ha entregado y corrige cantidades, en vez de teclear la lista
entera desde la furgoneta. Y un trabajo **sin presupuesto** ya no puede tener albarán.

Las tres decisiones del fundador se respetan tal cual: no hay albarán sin presupuesto · el campo de
comentarios sigue saliendo en el PDF que firma el cliente (`Albaran.notas`, ya estaba) · el albarán
es comprobante de entrega, **no** origen de la factura — por eso no se toca `modoValoracion` ni la
facturación.

## (a) El prellenado — `lineasDeQuoteParaAlbaran`

`concept → concepto`, `qty → cantidad`, `unidad: 'ud'`, y **`price` y `tax` se descartan**. No es
criterio estético: `validarLineas` **rechaza** una línea con precio o IVA en `SIN_VALORAR`, así que
colar el precio no daría un albarán con precios — daría un **400 al crear**.

**Las líneas se piden con un fetch al pulsar el botón, no ensanchando el serializer del detalle.**
Medido: el detalle manda `quote: {id, number, total, currency…}` y **NO** manda `lines` (las carga
de la BD, pero para el plan de cobro de SCRUM-141, y se quedan en el servidor). Ese detalle se abre
cada día; estas líneas hacen falta al crear un albarán. Engordar la carga de siempre por un botón
que se pulsa a veces sería pagar todos los días por un caso ocasional.

**Los cuatro criterios del ticket, tal como estaban decididos:** borrar líneas del prellenado SÍ ·
añadir líneas fuera del presupuesto SÍ (las dos cosas las da el editor de borrador que ya existía,
sin tocarlo) · **prellenado UNA VEZ, jamás re-sincroniza** —y el motivo no es la semántica de
«foto»: `computeAlbaranContentHash` sella esas líneas como el contenido FIRMADO, así que volver a
traerlas del presupuesto no actualizaría una vista, **rompería la firma**— · `unidad: 'ud'` porque
el presupuesto no la trae y el albarán la exige.

### Dos consecuencias que se decidieron aquí, y conviene que estén escritas

- **Solo se prellena en `SIN_VALORAR`.** En `VALORADO` el backend exige precio en **todas** las
  líneas y las del presupuesto llegan sin él por decisión del fundador. Prellenar ahí daría un 400
  al crear, así que con precios el albarán se rellena a mano, exactamente como hasta hoy.
- **Una línea que no puede ser línea de albarán se descarta, y se dice cuántas.** `validarLineas`
  rechaza **el lote entero** si una sola no vale, así que colar una línea sin cantidad convertiría
  el prellenado en un error al crear. Se descartan — y el toast dice cuántas no se copiaron:
  omitir en silencio en un documento que alguien firma es lo que cerró SCRUM-271.
- **Si el presupuesto no se puede leer, el albarán se crea vacío** como siempre. Quedarse sin
  prellenado es un incordio; no poder crear el albarán estando en obra es un problema.

## (b) El guard — `POST /admin/jobs/:id/albaranes`

`!job.quoteId` → **409** `job_without_quote` con el texto aprobado (regla 30):

> Este trabajo no tiene presupuesto; no se puede crear un albarán.

El `message` no es adorno: sin él el dashboard enseñaría el código crudo, que es el defecto que
cerró SCRUM-275 en la página de acceso.

**El guard es seguro y formaliza un invariante que ya se cumple:** la única vía de creación de
`Job` en `src/` es aceptar un presupuesto, y siempre fija `quoteId`. Efecto lateral consciente y
aceptado en el ticket: cierra la puerta al «trabajo manual» futuro que `Job.quoteId` nullable
dejaba preparada.

## Verificado en rojo — y los DOS casos que el ticket exige

**El rojo llegó antes de escribir el guard, y dijo justo lo que había que oír:** con un job sin
presupuesto la ruta respondía **`201` con el albarán creado**
(`{"id":9,…,"estado":"borrador"}`). Ésa es, literalmente, la verificación de «neutraliza el guard»
que pide el ticket — sale gratis cuando el rojo va primero.

Aun así se repitió **con el guard puesto y neutralizado a mano** (`if (false && !job.quoteId)`):

| Caso | Guard neutralizado | Guard puesto |
|---|---|---|
| job **sin** presupuesto | **201** + albarán creado | **409** + texto aprobado |
| job **con** presupuesto | 201 | **201** |

La segunda fila es la que importa tanto como la primera: **probar solo el que bloquea no demuestra
que no se haya bloqueado todo.** Un guard que rechazara siempre pasaría el primer test.

Del prellenado, cuatro rojos por el mecanismo: el mapeo se **extrae del fichero del dashboard y se
ejecuta** sobre líneas de presupuesto reales, en vez de buscar su texto — un guard de texto pasa en
verde con el mapeo escrito al revés.

Y un ancla contra la trampa que este ticket ya tendió una vez: hay **otro** `job_without_quote` en
el mismo fichero, en `collect-rest`, que es **el precedente que el ticket cita**. Medir por el
código de error habría dado 257 por hecha estando sin empezar, así que un test comprueba que el
texto aprobado está **dentro del cuerpo de la ruta de albaranes**.

## Lo que NO cubre

- **El origen por línea no se guarda.** Una línea añadida en obra es indistinguible de una
  prellenada salvo por el texto. Está fuera de alcance a propósito: hoy nadie lo leería, y añadirlo
  el día que haga falta es tocar `validarLineas`, **no** una migración.
- **Estos albaranes no son facturables directamente** (`SIN_VALORAR` no lleva precios). Es la
  consecuencia declarada de la decisión 3: la factura sale del presupuesto por su camino.
- **La ruta de creación sigue sin `requireRole('admin')`**, igual que antes: no se ha tocado quién
  puede crear albaranes, solo sobre qué trabajos.

## Ficheros

`src/modules/jobs/app/routes/jobs.routes.ts` (guard) ·
`public/dashboard/js/jobDetailView.js` (`lineasDeQuoteParaAlbaran` + el fetch al crear) ·
`tests/scrum257-albaran-desde-presupuesto.test.mjs` (7).
