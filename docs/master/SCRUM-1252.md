# SCRUM-1252 · Los sitios que «cuentan justificantes»: censo, PASO 0 por efecto y arreglo propuesto

**Medido contra:** `origin/main` = `f5d99bd7bac005f7cb8053447dc416ba6334f06e` · 2026-10-01T03:05:22Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum391-guards-declarados-presentes.test.mjs`

Lo que cazó ese guard: la primera versión de este registro nombraba, en su receta, la ruta de un test
que todavía no existe en el árbol, y la entrada salió roja antes de empujar. Otros tres tropiezos que
no llegaron a salir: leí la ficha del puesto después de crear la rama (lo paró la tabla de carriles de
`dos-equipos.md`, antes de tocar `src/`); cité de memoria el ticket de un comentario (442, no 460; lo
cazó releer la fuente antes de comitear); y un escape de carácter del test propuesto aterrizó como BOM
literal, que es la A22 ya escrita y lo cazó su recuento.

Sesión J6d (`jv-j6d`), 1-oct-2026, por encargo del orquestador de Javier (`cobroflash-backend-5b`).
**Aquí sólo se mide y se propone.** No se toca `src/` (J6 no construye producto y `src/modules/fiscal/**`
es de J1), ni ninguna base, ni ningún texto de usuario. La línea de arreglo la aplica J1 con el test y
el diff de `evidencias/SCRUM-1252/`.

## ① De los tres sitios del enunciado queda UNO vivo

Dos estaban contestados en los comentarios del propio ticket desde el 29-sep, y los re-medí hoy:

| # | sitio | veredicto | medido hoy |
|---|---|---|---|
| 3 | lista de Facturas (`system/invoiceAdmin.ts:41`) | **estaba bien** (comentario 17451: las `F1` con `J-` son facturas) | filtra `type: { not: 'JUST' }` y sólo eso |
| 2 | Informes (`reports.routes.ts:278` y `:372`) | **nunca fue defecto** (comentario 17452: es «lo que va al 303») | leen el libro sin `soloFacturas`, igual que el 303 |
| 1 | paquete de evidencias (`fiscal/evidencias/paquete.repo.ts:42`) | **VIVO** | lee el libro sin `soloFacturas` |

El bloqueo que tenía el (1) —«hasta que entre #1932»— **ha caducado**: `bb542f6d` (merge de #1932) es
ancestro de este `main`, y `soloFacturas` / `esJustificante` / `justificantesFuera` están en
`invoicing/domain/libroRegistro.repo.ts`.

`leerLibroRegistro` tiene **6 llamadas**: pantalla del libro y libro de la AEAT (con filtro), 303
(sin filtro, por ley), Informes ×2 (sin filtro, decisión A del fundador) y evidencias (sin filtro, sin
motivo escrito: es el que queda).

## ② PASO 0 por efecto: el paquete de hoy mete el justificante en su libro y en su índice

Código real de `dist/` compilado desde este `main` (`prisma generate` y `npm run build`, los dos con
salida 0), cliente Prisma falso en memoria, **ninguna base**. Muestra: la de SCRUM-1232 (una `F1`, un
`JUST`, una `F1` con número `J-`, una `R1`, una sin número y un `JUST` de otro merchant).

| pasada | casos | resultado | salida |
|---|---|---|---|
| `main` tal cual | 4 | **2 pasan, 2 caen**: `J-2026-0001` sale en `libro-registro.csv` y en `indice.csv` | `salida-rojo-main.txt` |
| con la línea propuesta | 4 | **4 pasan** | `salida-verde-parche.txt` |
| mutación: el criterio mira también el número | 4 | caen 2 (se pierde la `F1` con `J-`) | `salida-m1-por-numero.txt` |
| mutación: el 303 también filtra | 4 | cae 1 (la base total del 303 baja de 250,00) | `salida-m2-303-filtrado.txt` |
| vecinos con la línea propuesta (8 ficheros: `scrum297` ×4, `scrum294c`, `scrum1232`, `scrum438`, `scrum636`) | 67 | 65 pasan, 0 caen, 2 saltan (gateados por base) | `salida-vecinos-parche.txt` |

**Cómo se probó la línea sin tocar `src/`:** se parcheó la copia compilada
(`dist/modules/fiscal/evidencias/paquete.repo.js`, que git ignora) y se restauró después; `git status`
quedó sin cambios en `src/`. Las dos mutaciones, igual.

**Control positivo, dentro del test:** las tres facturas siguen en el libro y en el índice (la lista
entera se compara, no la ausencia de una), y el `modelo-303.csv` del paquete es **idéntico** con filtro
y sin él, con su fila TOTAL en 250,00 = 100 + 200 del justificante + 50 − 100. Filtrar el libro del
paquete no mueve el 303 del paquete: `leerModelo303` lee el libro por su cuenta.

**El arreglo propuesto** es una línea (`diff-propuesto.diff`): añadir `soloFacturas: true` a la llamada
de `paquete.repo.ts:42`. Reutiliza el criterio de SCRUM-1232; no escribe un segundo.

## ③ Lo que el arreglo NO resuelve, y hay que decidir antes de aplicarlo

Con la línea puesta, el justificante **desaparece del paquete sin que el paquete lo diga**. El lector
devuelve `justificantesFuera`, pero `construirPaqueteEvidencias` no lo escribe en ningún fichero. Y en el
mismo ZIP el 303 sigue llevando su IVA: quien sume el libro del paquete no llega al total del 303 del
paquete, y nada le explica por qué. `paquete.ts` dice de sí mismo que «un paquete de cumplimiento que
esconde lo que no cuadra es peor que no tenerlo».

Declararlo exige escribir algo dentro del ZIP (una línea en `avisos` del manifiesto, o una cifra en
`resumen`). Es texto que lee un tercero: **firma** (regla 39). No se ha escrito.

## ④ La población entera: 48 lecturas, y por qué sólo una filtra

`poblacion-lecturas-de-invoice.txt`: 49 líneas de `invoice.(findMany|count|aggregate|groupBy)` en
`src/` (búsqueda por texto, no AST); una es un comentario (`job.service.ts:224`). **48 lecturas.**
Sólo `invoiceAdmin.ts:66` filtra por `type` en la consulta, y el lector del libro lo ofrece como opción.

| grupo | lecturas | ¿le importa el tipo? |
|---|---|---|
| Serie y numeración (`app.ts` ×4, `invoiceNumber.service.ts` ×2, `merchantAdmin.ts`) | 7 | No: filtran por el prefijo del NÚMERO, y un `J-` no empieza por el del año |
| Tramo de un presupuesto (`jobs.routes`, `quotes.routes`, `quotesAdmin.routes`) | 3 | No: cuentan documentos emitidos para ese presupuesto; un justificante de anticipo es un tramo emitido |
| Dinero cobrado o pendiente (Home, Informes de caja, resumen semanal, saldo por cliente, recordatorios, Cobros) | 22 | No: un cobro es un cobro, se documente como se documente |
| Listados de documentos (buscador, portal del cliente, ficha de cliente) | 3 | No para existir; sí para el rótulo, que es texto |
| Recuentos rotulados «facturas» (resumen semanal ×2, embudo ×2, aviso del ZIP, fusión de clientes ×2) | 7 | **Sí, pero sin efecto nuevo** (abajo) |
| Exportes (`exports.routes.ts:154`, `exportData.ts:200`) | 2 | **Sí**: `facturas.csv` lista justificantes sin columna de tipo |
| VeriFactu (`verifactu.service.ts:648`, `:702`) | 2 | Camino de emisión: se lee, no se toca |
| Lector del libro | 1 | Opción `soloFacturas`, 6 llamadas (①) |
| Lista de Facturas | 1 | La única que filtra |

**Por qué filtra justo ésa:** su comentario lo dice (SCRUM-442): midió que «44 de 55 documentos en
producción (10-ago-2026) no eran facturas», y comprobó antes que los justificantes seguían visibles en
Cobros, que lista toda `Invoice` sin mirar el tipo.

**Por qué las otras casi no importan hoy:** el generador de números `J-` **ya no existe** (retirado en
SCRUM-1027 y SCRUM-825, `invoiceNumber.service.ts:75-78`), y los seis sitios que escriben `'JUST'` lo
derivan de ese número. Hoy ningún camino del código puede crear un justificante nuevo: lo que cualquier
sitio «cuenta» son **filas antiguas**. Los recuentos con ventana (resumen semanal, embudo del periodo) no
pueden volver a incluir uno; los históricos y los exportes sí.

## ⑤ Los cinco documentos: lo que se puede medir sin base

**El censo de los cinco no se puede hacer desde aquí.** Son filas; hace falta una consulta contra cada
base, y ninguna sesión toca producción. Dos cosas sí salen del código:

**a) El código no se pone de acuerdo sobre qué es una `F1` con número `J-`.** El fundador dijo que es una
factura. Por búsqueda de texto de `'JUST'`, `isReceiptNumber(` y `J-` en `src/` y `public/dashboard/js/`:

- deciden **sólo por el tipo** (la tratan como factura): el libro (`libroRegistro.repo.ts:96`), la lista
  (`invoiceAdmin.ts:41`) y el título del PDF (`pdf.service.ts:306`);
- deciden **por el número**, solo o junto al tipo (la tratan como justificante): el correo
  (`email.service.ts:38`), la página de recibo (`receipt.routes.ts:104`), los rótulos de WhatsApp, del
  recordatorio y de la pasarela, el detalle de factura en el panel, la serie (`fiscalInput.ts:165`),
  y el camino de emisión: no entra en la cadena de huellas (`portonDocumento.ts:84`,
  `selladoEstado.ts:75`), ni el sellado ni la anulación de VeriFactu la aceptan
  (`verifactu.service.ts:252` y `:444`), y **se puede des-pagar** (`invoiceAdmin.ts:254`), que es justo lo que ese mismo fichero
  prohíbe a una factura emitida.

Ninguno se ha tocado: los de texto piden firma y los del camino de emisión son STOP (regla 40).

**b) Dos registros medidos se contradicen sobre producción.** El comentario de `invoiceAdmin.ts` dice
55 documentos en producción el 10-ago-2026; el enunciado de este ticket, 2 filas en `invoices` el
28-sep-2026, y de ahí deduce que los cinco «no están en producción». Las dos cifras no caben en la misma
base sin un borrado entre medias. No sé cuál es: se resuelve con la consulta.

La consulta que haría falta, por base (sólo lectura): cuántas filas de `invoices` hay por `type`, y de las
`F1` cuántas tienen un número que empieza por `J-`, con su `merchant_id` y si llevan huella.

## Reproducir

    ./node_modules/.bin/prisma generate
    npm run build

Después se copia `docs/master/evidencias/SCRUM-1252/propuesto-scrum1252-evidencias-libro-solo-facturas.mjs`
a la carpeta de tests, con el nombre que dice su primera línea, y se corre con `node --test`. Sale 2 de 4
en rojo hasta que se aplique `diff-propuesto.diff` y se recompile. La ruta de destino no se escribe aquí
a propósito: el guard de SCRUM-391 exige que todo test que un registro declara exista en el árbol, y
éste todavía no existe.
