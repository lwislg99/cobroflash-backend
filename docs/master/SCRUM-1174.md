# SCRUM-1174 · El presupuesto ya tiene dónde escribir la cabecera y las Observaciones

**Medido contra:** `origin/main` = `bc07e2e21c1240a13aa011bede38c2b45fae51b7` · 2026-09-27T17:14:44Z
**Rama:** `scrum-1174-textos-del-presupuesto`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). Pantalla: el editor de presupuesto (`quotesView.js`).

## PASO 0 (medido en `origin/main`, no leído del ticket)

- El servidor guarda `docHeaderText` / `docFooterText` al crear (`quotes.routes.ts:215-216`), el PDF los
  pinta y las revisiones los heredan (`revision.ts:208`).
- En el panel sólo los montaba el albarán (`jobDetailView.js:2816`). `quotesView.js` no los nombraba.
- El editor sólo CREA presupuestos (no hay ruta que edite el cuerpo de uno; las revisiones las hace el
  servidor heredando). O sea: montar el campo no puede borrar un texto ya guardado.

## El cambio

- En «Ajustes del documento» (la fila plegada del paso Condiciones, v3 de SCRUM-915), detrás de «Incluir
  descripción en el PDF»: los dos campos con **el mismo componente que el albarán**
  (`textoDelDocumentoMontar`), con sus rótulos ya firmados: «Añadir texto en el documento» y
  «Observaciones». **Ni copy nueva ni un segundo formulario.** El presupuesto lleva los dos; el albarán,
  sólo la cabecera (su pie es `notas`).
- Se leen con el lector con VEREDICTO (`textoDelDocumentoLeer`): si no se ven los campos, las claves NO
  viajan, en vez de mandar `null` como si se hubieran dejado en blanco.
- Viajan en el POST de crear con las claves escritas a mano (el censo de SCRUM-286 no ve un spread), y
  quedan registradas en `tests/_asignacion-bloques-presupuesto.mjs` (bloque `blockDelivery`, junto a
  `docFields` e `ivaModo`: los tres deciden cómo SALE el documento).
- **Sólo en el presupuesto.** La factura suelta usa el mismo editor pero compone su cuerpo en
  `cuerpoDelDocumentoSuelto.js` (otro carril y la regla 29 detrás): ahí no se ofrecen.
- La guarda va en la forma simple que lee el censo de SCRUM-600e (`if (!esDocumentoSuelto) …`). Mi primera
  versión la escribía compuesta y ese censo la declaró opaca, con razón: se cambió el CÓDIGO, no el censo.

## El hueco declarado, cerrado (aceptación 2)

- `scrum593e` decía «QUÉ NO SE VIGILA AQUÍ: el PRESUPUESTO», hasta SCRUM-598. SCRUM-598 cerró sin montarlo
  y el hueco se quedó sin dueño. Ahora vigila también el presupuesto: se monta, con la pieza comprobada, los
  dos campos, se lee con veredicto, viaja en el POST y el servidor lo guarda al crear.
- 🔴 Y **su test de alcance tenía un agujero**: `/PRESUPUESTO.*montad/` casaba también con «PRESUPUESTO …
  NO montado», así que con el formulario montado y la entrada sin actualizar daba verde. Ahora exige la
  fila en su estado real. Mutación medida: código montado + `SCRUM-593.md` de main → **cae**.
- `docs/master/SCRUM-593.md`: la fila del PRESUPUESTO pasa a «montado por SCRUM-1174», conservando el
  historial.

## Verificación en navegador (Edge, 390 px, producto real con la sesión simulada)

Montaje de `scripts/guard-965-un-solo-presupuesto.mjs`: cliente, una línea y «Continuar» hasta Condiciones,
«Cambiar» en «Ajustes del documento», escribir los dos textos y «Generar presupuesto».

| caso | resultado |
|---|---|
| los dos campos A LA VISTA, con sus rótulos firmados | ✅ |
| el POST de crear lleva los dos textos EXACTOS (salto de línea incluido) | ✅ 1 POST |
| errores de página | 0 |
| **control negativo:** factura suelta, los campos no están ni en el DOM | ✅ |

Antes de abrir «Cambiar» los campos NO se ven (la fila va plegada por diseño, como el IVA o la dirección de
obra) y lo tecleado no entra: la primera pasada del instrumento lo cazó así, dando `null`.

Captura: `docs/master/evidencias/scrum1174/scrum1174-textos-del-presupuesto-390.png`. La píldora «undefined»
y el desplegable «Sin resultados» de arriba son del FIXTURE (sesión simulada con `/admin/me` recortado y el
buscador con foco), no del producto: no se abre ticket.

**Falta, y por eso el ticket NO se cierra con el merge:** ver el texto en el **PDF** de un presupuesto real
en yaqu.app. El PDF ya los pinta según el servidor (`presupuestoParaPdf.ts:136-137`), pero la aceptación
pide verlo, no deducirlo.

## Tests

- `scrum593e`: contra main **2 fallan** (los dos del camino del presupuesto); con el cambio, 14/14.
- Vecinos (todo lo que lee `quotesView.js`, `_asignacion-bloques-presupuesto` o `textoDelDocumento`, más
  286, 593*, 237, 553, 666b, 267): **726 · 722 pass · 0 fail · 4 saltados**. Los 4 son `scrum593d`,
  gateados por `QA_DB_TEST` (este checkout no tiene base de staging), y el primero es precisamente «se
  escribe, se guarda, se RELEE y sale en el PDF»: la parte que queda por ver en yaqu.app.

## Visto al medir, fuera de este ticket

- **Duplicar un presupuesto no copia los dos textos** (`quotesDetailView.js:1291`, `duplicateQuote`):
  el mismo defecto que SCRUM-926 corrigió para el descuento global. Hoy no se pierde nada porque el editor
  no los tenía; desde este ticket, sí. Se pasa al orquestador.

## Apéndice · 27-sep-2026 · el check obligatorio en rojo por dos trinquetes de recuento

El primer CI de este PR cayó en 3 tests: scrum697 (1) y scrum698 (2), que cuentan los nodos que monta
enderQuotesView en el banco y esperaban 248. Con este ticket son **255**. No es un arreglo del banco:
lo mueve la VISTA, y se declara por identidad como las dieciséis subidas anteriores. Medido sobre el árbol
montado con el mismo contador 	odos, en los DOS montajes (con y sin datos): el subárbol de
div.quote-texto-documento es **7** — el envoltorio + 2 × (div.field · label · 	extarea) — y
255 − 248 = 7, así que no hay una resta compensada escondida. Ni se relaja el guard ni se retira el campo:
se anota la subida en los dos tests con su motivo. Vecinos (todo lo que monta enderQuotesView + 593e,
237, 553, 286, 600e): **291 · 291 pass · 0 fail**.

**Medido contra:** `origin/main` = `0a10475c144763982b7b9d535bbaa14718843ee8` · 2026-09-27T17:29:23Z
