# SCRUM-1787a · Facturas iguales que presupuestos: medición lado a lado, clasificación y plan por tramos (no se construye)

**Medido contra:** `origin/main` = `e24f2828ed68d0159d53e546fe6fb25903f79972` · 2026-11-21T05:00:17Z

A9: sin fallo que generalice — el único error propio fue de los datos de ejemplo del guion (IVA de las líneas del presupuesto puesto como 21 en vez de 0,21: la ficha pintó «2.100 %»); se cazó mirando la captura antes de darla por buena, se corrigió en el guion con su comentario y se repitió la pasada; no es un defecto del producto ni de un instrumento compartido.

Carril J1 (solo documentos y evidencias: nada en `src/`, `public/` ni `prisma/`). Encargo del orquestador J (`cobroflash-backend-87`), 21-nov-2026, sesión `jv-j1gu`. Orden del fundador, literal en la descripción del ticket. Concreción del fundador en c.22300 (la FICHA de factura es la pantalla prioritaria). Medición y preguntas publicadas en Jira **c.22301**.

## Hallazgos principales

1. **El editor ya es uno.** La factura suelta abre el editor del presupuesto en modo recortado: `public/dashboard/js/quotesView.js:26` (`renderQuotesView`), bandera `:70`, entrada `:6067`. El cuerpo que se manda sólo lleva cliente + concepto/cantidad/precio/IVA (`cuerpoDelDocumentoSuelto.js:57`).
2. 🔴 **El PDF de la factura no imprime el NIF ni la dirección del cliente**: el tipo `customer` de `generateInvoicePdf` no los tiene (`src/modules/invoicing/infra/pdf/pdf.service.ts:383`), bloque del cliente `:551-557` (nombre, correo, teléfono). El del presupuesto sí imprime el NIF (`:1016`). El dato existe (`prisma/schema.prisma:783`, `customerTaxId`). RD 1619/2012 art. 6.1 d) y e) los pide en factura completa, con excepciones (BOE no releído hoy). Camino de emisión → GO aparte.
3. **La ficha de factura no muestra líneas** (`invoiceDetailView.js`: 0 apariciones de `lines`); la del presupuesto sí (`quotesDetailView.js:700`).

## La ficha (pantalla prioritaria, c.22300): bloque a bloque

| bloque del presupuesto | dónde | en la factura hoy | equivalente propuesto | textos a firmar |
|---|---|---|---|---|
| Cabecera «Presupuesto #N» + PDF / Duplicar / Volver | `quotesDetailView.js:102,120,126` | «Factura» sin número + «← Volver a facturas» (`invoiceDetailView.js:38,45`); el PDF está abajo, en Acciones (`:358`) | título con el número de serie; PDF y Volver arriba. Duplicar: no tiene sentido igual (una emitida no se copia: sería «nueva factura con estas líneas») | título y subtítulo; si se quiere, el de «duplicar» |
| ESTADO + chip WhatsApp + TOTAL grande | `:286-332` | ya igual (`invoiceDetailView.js:150-166`, mismas clases) | nada | — |
| Línea de progreso Creada → Enviada → Aceptada → Facturada → Cobrada | `:1589-1602` | no hay | **Emitida → Enviada → Cobrada** (y estado final Rectificada / Anulada) — los estados son CERRADOS (Parte L): pintar los que ya existen, no inventar | «Emitida», «Enviada», «Cobrada» |
| SIGUIENTE PASO (botones del paso que toca) | `:393-396` | «ACCIONES» con botones del registro (`:287`, `:350-355`) | renombrar y ordenar: primero lo que toca (Enviar / Marcar cobrada) | el rótulo «Siguiente paso» en la factura |
| CLIENTE (nombre, teléfono, correo) | `:593` | «DATOS» con cliente y fecha (`:222`) | columna CLIENTE con nombre, NIF, dirección, teléfono, correo (los congelados de la factura) | rótulos NIF y Dirección |
| DECISIÓN (condiciones de pago) | `:604` | no hay; el bloque «Cobro» de SCRUM-285 está dentro del resumen | columna **COBRO**: forma de pago, fecha de cobro | rótulo «Cobro» y sus filas |
| Marcar aceptado / rechazado | bajo Cliente | — | su equivalente es «Anular / Rectificar», que ya existe (`:705`) y se queda (regla 29) | — |
| CONCEPTOS | `:700` | no hay | tabla de líneas igual (sólo lectura) | — (mismos rótulos) |

Carril: `invoiceDetailView.js` es **J1** y sólo pinta datos ya guardados: no toca emisión. Es el tramo más barato y el que pide el fundador.

## Resto de pantallas (detalle en c.22301)

Editor (filas 1-6), factura desde presupuesto (7), lista (10-11), PDF (12-15), envío (16-17) y página del cliente (18): tabla completa con fichero:línea y clasificación NECESARIA / NO NECESARIA en Jira c.22301. Carriles medidos con `node scripts/carriles.mjs de`: `quotesView.js`, `cuerpoDelDocumentoSuelto.js`, `quotesDetailView.js`, `quotesListView.js` → S2; `quotesAdmin.routes.ts`, `email.service.ts`, `quoteDecisionLanding.routes.ts` → S1; `invoiceDetailView.js`, `invoicesView.js`, `pdf.service.ts`, `invoicesAdmin.routes.ts`, `invoiceLines.service.ts`, `invoiceWhatsApp.service.ts` → J1; `payInvoice.routes.ts` → J2.

## Plan por tramos

- **T0 (GO de emisión):** NIF y dirección del cliente en el PDF de la factura (`pdf.service.ts`, J1).
- **T1 (J1, sin emisión):** la ficha de factura con la forma de la del presupuesto (tabla de arriba). Textos a firmar antes.
- **T2:** editor completo en la factura (S2 + J1; crear con esos datos toca emisión → GO).
- **T3:** factura desde presupuesto conserva pie de texto, descuento global y forma de pago (S1 + emisión → GO).
- **T4:** PDF de factura con el dibujo del presupuesto (J1, emisión → GO).
- **T5:** página de pago y correo con las líneas (J2 + S1; textos a firmar).

## Capturas (código real de main, datos de EJEMPLO, sin red)

`evidencias/SCRUM-1787/ficha-lado-a-lado-escritorio.png` y `ficha-lado-a-lado-movil.png`: presupuesto a la izquierda, factura a la derecha. Guion: `evidencias/SCRUM-1787/guion/capturas.js` — `public/` servido en estático en 127.0.0.1:5787, contexto con `serviceWorkers: 'block'`, `/admin/*` contestado por el guion, cada foto exige `.detail-total-amount` visible. Última pasada: 0 peticiones fuera de 127.0.0.1:5787; 2 escrituras (`POST /admin/entorno`, que manda el panel al arrancar), contestadas por el guion sin servidor. Las dos capturas, miradas una a una.

## NO medido

Editor, lista, PDF y página del cliente sin captura (no cabían en el contexto; su comparación es por código). Si las cabeceras de apartado llegan a `Invoice.lines` al facturar: un subagente lo afirmó y mi grep en `invoiceLines.service.ts` no lo confirma. Factura desde albarán y desde parte más allá de sus rutas. Ningún dato real ni base. BOE no releído. Suite entera: no corrida (solo docs; el orquestador pidió guards de docs y `guards:entrada`).

# SCRUM-1787b · Ficha de factura con la forma de la ficha del presupuesto (construida)

**Medido contra:** `origin/main` = `41b0e031083b02c35e1a4cf74c4e71756f4d20f5` · 2026-11-21T05:22:07Z

A9: aviso → cicatriz J1 «Un botón nuevo en la cabecera de la ficha de factura lo vigilan scrum283 y scrum600d: se mira el censo ANTES de diseñarlo, no después» — no se pudo comprobar: lo comprueban ya esos dos guards (cayeron a la primera); lo que falló fue que el plan de c.22307 lo dio por posible, y ningún guard mira un plan escrito en Jira.

Mutaciones: catálogo → `tests/scrum1787b-ficha-de-factura-como-presupuesto.test.mjs`

**Skill UI:** cargada

Decisión y firma: SCRUM-1787 c.22303 (literales `Emitida` · `Enviada` · `Cobrada` · `Siguiente paso` · `Cobro` · `NIF`; sin «Duplicar»). Plan: c.22307. Entrega: c.22312.

Qué cambia, solo en `public/dashboard/js/invoiceDetailView.js` (J1) y en un bloque `/* J1: SCRUM-1787b */` de `public/dashboard/css/styles.css`:
- Título «Factura <número>» («Justificante de cobro <número>» en un justificante). Volver va en `.detail-head-acciones`, y no hay «Duplicar».
- Línea de progreso Emitida → Enviada → Cobrada, con clases y sin `style=`. El último paso es «ANULADA» si la factura está anulada y «RECTIFICATIVA» si es R1.
- «Acciones» pasa a ser «Siguiente paso» (`.detail-next`), colgado del resumen. El marcador del fuente sigue en su sitio por scrum597.
- «Datos» pasa a ser Cliente (Cliente, NIF, Teléfono, Email; congelados si la factura lo está, regla de 1576b) + Cobro (Método, Pagada, Rectifica a, Rectificada por). Si Cobro no tiene filas, no se pinta.
- Conceptos: la tabla del presupuesto, con los helpers compartidos sin tocarlos.

**NO HECHO, y por qué:**
- **La cabecera NO lleva PDF.** `tests/scrum283-censo-acciones-factura.test.mjs` solo admite `btnBack` como navegación de la cabecera, y `tests/scrum600d-el-envio-tras-emitir.test.mjs` fija los rótulos de envío («📄 PDF» sería microcopy de factura sin firmar). Para moverlo hay que decidir por escrito: `btnPdf` del registro a la cabecera, el censo 283 y el rótulo. Decisión del orquestador J: se queda en «Siguiente paso».
- **«Dirección»:** la factura no la guarda (c.22304/c.22305). Llega en 1787d.

**Evidencias:** `docs/master/evidencias/SCRUM-1787/1787b-ficha-{pendiente,cobrada,anulada}-{escritorio,movil}.png`, generadas con `docs/master/evidencias/SCRUM-1787/guion/capturas-1787b.js` (datos de EJEMPLO, SW bloqueado y DOM exigido antes de cada captura).

**Verde:** el test nuevo da 10/10. Lo vi ROJO primero (8 de 10; los 2 que pasaban eran los controles), y las dos mutaciones de catálogo lo tumban. Dirigida de 42 ficheros (los guards de c.22307 y los del encargo): 370/370, 0 fail, 0 skip.

**NO medido:**
- La suite entera y la tanda de guards de navegador: no me cabían en el contexto.
- «Enviada» no sabe del envío por correo, porque la vista no recibe ese dato.
- En móvil, la tabla de Conceptos deja Precio, IVA y Total fuera de vista. No he mirado si a la del presupuesto le pasa lo mismo.

# SCRUM-1787e · En móvil, la tabla de Conceptos de la ficha de factura se apila (Precio, IVA y Total a la vista)

**Medido contra:** `origin/main` = `be85bc71640bb7a8e8af969e2717d233a223e161` · 2026-11-21T05:44:27Z

A9: aviso → cicatriz J1 «Escribí el arreglo de la tabla antes del test rojo que pedía el encargo; el rojo lo saqué después devolviendo el arreglo con `git apply -R` del parche guardado» — no se pudo comprobar: el orden en que una sesión escribe test y arreglo no queda en el diff, y ningún guard lo ve.

Mutaciones: catálogo → `tests/scrum1787e-conceptos-en-movil.test.mjs`

Orden del fundador: SCRUM-1787 c.22314 («2-Ok sí»). Rama `scrum-1787e-conceptos-en-movil`, nacida de `scrum-1787b-ficha-de-factura` (PR #3299, sin mergear al empezar).

## Lo medido (sonda `evidencias/SCRUM-1787/guion/sonda-1787e.js`, datos de EJEMPLO, `serviceWorkers: 'block'`)

`public/` de este árbol servido con `guion/servidor-estatico.mjs` en 127.0.0.1:5788 (el 5787 lo ocupaba el servidor de OTRO árbol: medir contra él habría sido medir otro código). Primera línea con importe; `visibles` = celdas enteras dentro de la ventana y de la tabla; `carril` = px escondidos tras el scroll propio de la tabla. 0 peticiones fuera de 127.0.0.1.

| vista · anchura | antes | después |
|---|---|---|
| factura · 390 px | 2 de 5 · carril 197 px · página 0 | **5 de 5** · carril 0 · página 0 |
| presupuesto · 390 px | 2 de 5 · carril 197 px · página 0 | igual (no se toca: S2) |
| factura · 1280 px | 5 de 5 | 5 de 5, mismas coordenadas (control) |
| presupuesto · 1280 px | 5 de 5 | igual |

Causa: la regla global de ≤768 px `.table { display:block; overflow-x:auto }` con `white-space:nowrap` en las celdas: la tabla scrollea en su propio carril y nada avisa de que hay más columnas. Capturas: `evidencias/SCRUM-1787/1787e-{antes,despues}-{factura,presupuesto}-{movil,escritorio}.png`, miradas.

## El arreglo (solo `invoiceDetailView.js` y el bloque J1 de `styles.css`)

A ≤640 px (el umbral de `.table--cards-mobile` y `.table--stack-mobile`), la tabla `.j1-fac-conceptos` oculta la cabecera y cada línea es una rejilla: el concepto a todo el ancho y Cant., Precio, IVA y Total debajo, en cuatro columnas, cada uno con su rótulo por `::before { content: attr(data-label) }`. El `data-label` se LEE de la cabecera de la propia tabla: ningún texto nuevo. Sin `style=` ni `on*=`. Escritorio: ninguna regla de la clase fuera del `@media`.

Test: `tests/scrum1787e-conceptos-en-movil.test.mjs` — rojo 3/3 con el arreglo quitado (`git apply -R`), verde 3/3 con él. Suelos: el banco ve ≥3 filas de 5 celdas; el parser ve `.j1-prog-paso`; ≥5 reglas de la clase.

## Para Luis (S2): el presupuesto tiene el mismo defecto

`quotesDetailView.js:703-707` pinta la misma tabla (`table.className = 'table'`, cabecera Concepto/Cant./Precio/IVA/Total) y a 390 px enseña 2 de 5 columnas, con 197 px tras el scroll de la tabla (captura `1787e-antes-presupuesto-movil.png`). El arreglo literal, el mismo que el de la factura:

1. `table.className = 'table quote-conceptos-tabla';` y, tras el `innerHTML` de la cabecera, `const rotulos = [...table.querySelectorAll('thead th')].map((th) => th.textContent);`; en cada fila con importe, `[...tr.children].forEach((td, k) => { if (k > 0) td.dataset.label = rotulos[k]; });`.
2. En el bloque S2 de `styles.css`, dentro de `@media (max-width: 640px)`, las seis reglas del bloque J1 `SCRUM-1787e` cambiando `.j1-fac-conceptos` por `.quote-conceptos-tabla`.
3. De paso: el `<th style="text-align:right">Total</th>` de `:707` es un `style=` en `innerHTML` (CSP); en la factura va a la clase `j1-fac-col-total`.

## NO medido

- La suite entera: no la pasé, por orden del orquestador (la pasa el obligatorio).
- El aspecto con un concepto muy largo o importes de 9.999,99 € en las cuatro columnas a 320 px.
