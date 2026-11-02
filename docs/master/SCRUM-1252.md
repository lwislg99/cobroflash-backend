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

Después se corre `tests/scrum1252-evidencias-libro-solo-facturas.test.mjs` con `node --test`. Hasta el
2-oct-2026 este párrafo mandaba copiarlo a mano desde un `.mjs.txt` de la carpeta de evidencias, porque
contra el `main` de entonces salía 2 de 4 en rojo (`salida-rojo-main.txt`) y un test rojo no entra en la
carpeta de tests. SCRUM-1252b lo movió allí junto con la línea que lo pone verde. `diff-propuesto.diff` se
conserva como evidencia de lo que se propuso; ya no aplica, porque su línea está dentro. Lo que cambió
después de esta medición está en el anexo de abajo.

## Anexo SCRUM-1252b · la línea y el literal, juntos

**Medido contra:** `origin/main` = `35e1060e365a4cc11f16e4ccee393581679e73d9` · 2026-10-02T05:58:25Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `.claude/hooks/guard-dangerous.sh`

Lo que cazó ese hook: al heredar el árbol había un renombrado preparado sin comitear, de la sesión
anterior, y fui a descartarlo con `git restore`. El hook lo paró y enseñó lo que se perdía. Se deshizo
con el movimiento inverso (`git mv`), que no descarta nada: el fichero volvió a su sitio con el mismo
blob. Los demás tropiezos, en «Lo que hice mal», al final.

Sesión J1c (`jv-j1c`), 2-oct-2026, por encargo del orquestador de Javier (`cobroflash-backend-5b`).
El permiso es el comentario 18028 de SCRUM-1252 (GO del orquestador) sobre la firma del fundador del
comentario 17726, que dice que la línea la aplica J1 y que **no entra sin el texto**.

### ① Qué entra

| fichero | qué |
|---|---|
| `src/modules/fiscal/evidencias/paquete.repo.ts` | la llamada al lector del libro pide `soloFacturas: true` |
| `src/modules/fiscal/evidencias/paquete.ts` | la constante `AVISO_LIBRO_SOLO_FACTURAS` (el literal firmado) y una línea que la mete en `avisos` cuando `justificantesFuera > 0` |
| `tests/scrum1252-evidencias-libro-solo-facturas.test.mjs` | el test propuesto de J6d (4 casos, sin tocarles un aserto) más 3 casos para el aviso |
| `docs/microcopy/2026-10-01-SCRUM-1252-libro-solo-facturas.md` | la ficha de la firma |

No se escribe ningún criterio: qué es un justificante lo decide `esJustificante` (SCRUM-1232, por `type`
y sólo por `type`) y el recuento es el `justificantesFuera` que ya devuelve el lector.

El aviso sale **sólo cuando el libro dejó algo fuera**. Lo decidió el orquestador (2-oct-2026, por el
canal de sesiones): un aviso que sale siempre deja de leerse. El comentario 17726 dice «dentro del ZIP»
y no dice dónde; va en `avisos`, que viaja en `manifiesto.json`, que es lo que proponía el §③ de arriba.

### ② Antes de tocar: ¿está el paquete de evidencias en el camino de emisión?

No. Medido por AST sobre este `main` (`b-camino-de-emision.cjs.txt`, salida en
`b-camino-de-emision-salida.txt`): 315 ficheros `.ts` en `src/`, 0 imports relativos sin resolver.

- A `fiscal/evidencias/` sólo llegan `src/app.ts` (monta la ruta) y `src/index.ts`.
- Desde `paquete.repo.ts` se alcanzan 15 módulos, y ninguno llama a `create`, `update`, `upsert`,
  `delete`, `$executeRaw` ni `$transaction`. Control positivo del mismo detector: 6 en
  `verifactu.service.ts` y 1 en `invoiceNumber.service.ts`.
- El cierre de imports de ocho ficheros del camino de emisión (`lib/invoicing`, `registro.builder`,
  `invoiceNumber.service`, `selladoEstado`, `verifactu.service`, `pdf.service`, `invoice.routes`,
  `facturaSuelta`) no toca ni `evidencias/` ni el lector del libro ni el del 303.

El detector marca dos `crypto.createHash('sha256').update`: no son escrituras en base. Uno recalcula el
sello de un albarán para verificarlo. El otro (`paquete.ts`) es el resumen de cada fichero del ZIP que
va en `manifiesto.json`: no es la cadena de VeriFactu, se calcula en cada descarga y no se guarda en
ningún sitio (la ruta no escribe). El orquestador lo leyó igual: no es el STOP de la regla 40.

### ③ El positivo que podía tumbar el trabajo: el 303 no se mueve

Mismo `dist/`, compilado con la línea y sin ella, misma muestra (la de SCRUM-1232), cliente falso en
memoria, ninguna base. Salidas enteras en `b-paquete-antes.txt` y `b-paquete-despues.txt`
(instrumento: `b-medir-paquete.cjs.txt`).

| muestra | fichero del ZIP | antes | después |
|---|---|---|---|
| con un justificante propio | `modelo-303.csv` | `2e5cecbe…ebf1537b` · TOTAL 250,00 / 52,50 | **idéntico** |
| con un justificante propio | `libro-registro.csv` | 4 filas, con `J-2026-0001` | 3 filas: `F260001`, `J-20260805-AB12`, `R260001` |
| con un justificante propio | `indice.csv` | 4 filas | las mismas 3 |
| con un justificante propio | `manifiesto.json` | 1.475 B, 2 avisos | 1.707 B, 3 avisos (el nuevo) |
| sin justificantes propios | los 7 ficheros | — | **los 7 idénticos**, manifiesto incluido |

Las tres facturas siguen en libro e índice (la `F1` con número `J-` entre ellas). Los otros tres
ficheros del ZIP (verificación de albaranes, entregas y alcance) no cambian en ninguna muestra.

Con un justificante en el periodo cambian también cuatro cifras de `resumen` del manifiesto, porque
cuentan asientos del libro: `asientos` 4→3, `miradas` 5→4, `facturasSinAlbaran` 4→3,
`facturasSueltas` 4→3.

**Consecuencia medida, para quien ya tenga un ZIP descargado:** si en ese trimestre había un
justificante, una descarga nueva trae otro `libro-registro.csv` y otro `indice.csv`, y por tanto otros
`sha256` en el manifiesto (y otro manifiesto). Si no había ninguno, la descarga nueva es byte a byte
la misma. El ZIP es un export que se genera en el momento; no hay ningún resumen guardado que deje de
cuadrar.

### ④ Las mutaciones, vistas en rojo

Cada una sobre el árbol comiteado, recompilando, y restaurada después (`git status` sin cambios en
`src/`). El test tiene 7 casos.

| mutación | caen | cuáles |
|---|---|---|
| sin la línea (el `main` de hoy) | 4 | libro, índice, «la línea no entra sola», y el control del aviso |
| **la línea sin el texto** (no se mete el aviso) | 2 | «la línea no entra sola» y el control del aviso |
| el aviso sale siempre | 1 | el control «sin nada fuera, el aviso NO sale» |
| una letra distinta en el literal («solo» por «sólo») | 1, y 2 de `scrum514` | «letra a letra, el texto que firmó el fundador» |
| el 303 también filtra (parcheando `dist/`, sin tocar `src/`) | 3 | «el 303 es IDÉNTICO», y los dos del aviso |

### ⑤ Lo corrido

- Tipos: `tsc --noEmit` sobre los 316 ficheros de `src/`, 0 errores, con el cliente de Prisma del árbol
  `cobroflash-jv1` (generado hoy, mismo `schema.prisma`). El worktree donde se trabajó hereda los
  `node_modules` del checkout compartido, cuyo cliente es viejo: con él salen 6 errores en `app.ts`,
  `invoiceNumber.service.ts` y `merchantAdmin.ts` por columnas que ese cliente no conoce, ninguno en
  lo que este cambio toca.
- El test y sus 9 ficheros vecinos (`scrum297` ×4, `scrum294c`, `scrum1232`, `scrum438` ×2,
  `scrum636`): 92 casos, 90 pasan, 0 caen, 2 saltan. Los dos que saltan son de
  `scrum297-evidencias-postgres` y piden un Postgres desechable (`LIBRO_PG_URL`): **no corridos
  aquí**. Su muestra no lleva justificantes.
- La tanda completa y la dirigida no se han corrido: las cubre el CI.

### ⑥ Lo que no entra, y lo que se ha visto

- Los puntos B y C del comentario 17723, Informes, el 303 y el censo de los cinco documentos: fuera,
  como estaban.
- Un comentario de `invoicing/domain/libroRegistro.repo.ts` (el de `soloFacturas`) dice que las
  evidencias «siguen leyendo lo de siempre». Desde este cambio ya no es verdad. En la entrega no se
  tocó; después el orquestador pidió corregirlo (2-oct-2026, canal de sesiones) y lleva una nota
  fechada al final de ese mismo párrafo, sin borrar la frase y sin mover ninguna línea del fichero.
- El comentario 17726 dice que el literal son dos frases. Son tres, y mide 217 caracteres. El texto es
  el del comentario, letra a letra. Y la razón que daba para partirlo ya no aplica: desde SCRUM-1329
  `scrum514` admite un texto firmado largo entero en una línea de cita, que es como va en la ficha.
- Un justificante **sin número** contaría en `justificantesFuera` y haría salir el aviso, aunque no
  estaba ni en el libro ni en el 303. Por el código de hoy no puede existir (el tipo se derivaba del
  número `J-`); en datos no se ha medido.
- El literal se copió de lo que la herramienta de Jira devuelve del comentario 17726. Si el original
  llevara algún carácter invisible distinto (un espacio duro), desde aquí no se ve.

### Lo que hice mal

- Fui a descartar el renombrado heredado con `git restore`. Lo paró el hook (arriba).
- Un `grep` con un paréntesis sin cerrar falló y lo vi por el error, no por su resultado: repetido con
  el patrón partido y con control positivo.
- Le pregunté a `scripts/zona-roja.mjs` por mis ficheros y leí la salida vacía sin un control al lado.
  La lista se leyó después entera: ninguno de mis ficheros está en ella.
- Medí primero sobre el árbol heredado, que iba 5 ficheros de `src/` por detrás de `main`. Lo vi al
  comparar los dos y repetí la medición del camino de emisión en un árbol nacido de `origin/main`.

## Anexo SCRUM-1252c · punto B: qué es una `F1` con número `J-` en cada sitio

**Medido contra:** `origin/main` = `2c45bf589aeae007eb12ed388b3e0f4d2d8d98ed` · 2026-10-23T20:59:45Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `docs/master/evidencias/SCRUM-1252/c-banco-f1-con-j.cjs.txt`

Lo que caza ese banco, y por qué existe: mi primera pasada clasificó el correo y el PDF como «ni
factura ni justificante» porque comparaba textos que llevan dentro el número de cada documento; lo vi
leyendo la salida, no por un testigo. El banco compara ahora con el número sustituido, y lleva su
propio control negativo (`SABOTEO=1`: el justificante de control pasa a ser una factura más, y las 12
filas tienen que salir CIEGAS; salen 12 de 12, `c-banco-salida-saboteo.txt`). Otro tropiezo, sin
salir: la rama me llegó nombrada `scrum-1252b-…`, y `1252b` ya es el PR #2129; lo cazó el control de
sufijo de A4 antes del primer empujón, y la rama es `scrum-1252c-f1-con-numero-j`.

Sesión J1ay (`jv-j1ay`), 23-oct-2026, por encargo del orquestador de Javier
(`cobroflash-backend-62`). **Sólo se mide y se propone.** No se toca `src/`, ni `public/`, ni el
esquema, ni ningún texto. El camino de emisión se LEE y se LLAMA con un cliente falso (regla 38); no
se modifica. El punto C (55 contra 2 filas) y el censo de los cinco son filas de producción: fuera.

### ① Cómo se midió

`dist/` compilado de este mismo árbol (`tsc --noCheck`, salida 0), cliente Prisma falso en memoria,
ninguna base, y el directorio de trabajo en una carpeta temporal (lo que escriben el PDF y el correo
cae allí, no en el árbol). Tres documentos: el del ticket (`type: 'F1'`, número `J-2026-0001`) y dos
controles, una factura normal (`F1`, `F260001`) y un justificante (`JUST`, `J-2026-0002`). Una fila
sólo vale si los dos controles dan cosas distintas. Salida entera: `c-banco-salida.txt`.

**Población del banco: 12 filas · 3 la tratan como factura · 9 como justificante · 0 ciegas.**

Los sitios que no se pueden llamar sin una ruta HTTP montada o un envío real se leyeron: van
marcados «leído» y su predicado es el que dice la línea citada, sin ejecutar.

### ② La tabla: qué ve cada uno

| sitio | quién lo ve | decide por | la `F1` con `J-` sale como | cómo |
|---|---|---|---|---|
| PDF (`pdf.service.ts:322`, título en `:410`) | cliente | tipo | **factura**, con su número y **con QR** | ejecutado |
| libro registro y su ZIP (`libroRegistro.repo.ts:95`) | profesional, gestoría | tipo | **factura** | ejecutado |
| lista de Facturas, consulta del servidor (`invoiceAdmin.ts:44`) | — | tipo | **dentro** | ejecutado |
| lista de Facturas, filtro del navegador (`invoicesView.js:79`, vía `tipoDeFactura`) | profesional | número | **no se pinta** | ejecutado (el fichero real, en `vm`) |
| pila del Trabajo y bloque DINERO (`jobDocsReparto.js:36`, `jobRailBlocks.js:157`) | profesional | número | justificante | ejecutado |
| detalle del documento en el panel (`invoiceDetailView.js:91`, `:135`, `:540`) | profesional | número | justificante (título y distintivo) | leído |
| correo al cliente: asunto y cuerpo (`email.service.ts:39`, `:91`) | cliente | número | justificante, **con el PDF de «factura» adjunto** | ejecutado (asunto) |
| página pública del recibo (`receipt.routes.ts:106`, `:195`) | cliente | tipo **o** número | justificante, y su botón descarga el PDF de «factura» | leído |
| WhatsApp del envío y concepto del cobro (`invoiceWhatsApp.service.ts:76`, `:102`) | cliente | número | justificante | leído |
| recordatorios de pago (`invoiceReminder.service.ts:171`, `invoicesAdmin.routes.ts:796`) | cliente | número | justificante | leído |
| páginas de pago y aviso de cobro (`payInvoice.routes.ts:48`, `psp.routes.ts:320`, `mpWebhook.routes.ts:216`) | cliente, profesional | número | justificante | leído |
| portal del cliente (`customerPortal.routes.ts:427`, `:413`) | cliente | **nada** | factura (lo dice de todo documento, también de un `JUST`) | leído |
| cadena de huellas (`portonDocumento.ts:84`, `selladoEstado.ts:75`) | — | número | **fuera** | ejecutado |
| sellado y anulación VeriFactu (`verifactu.service.ts:252`, `:469`) | — | número | **rechazado**, 0 llamadas a base | ejecutado |
| anular y rectificar (`invoicesAdmin.routes.ts:911`, `:1076`; `invoiceDetailView.js:694`) | profesional | número | no se anula ni se rectifica | leído |
| des-pagar (`invoiceAdmin.ts:261`) | profesional | tipo **o** número | **se des-paga** (una `F1` normal, no) | ejecutado |
| facturar o consolidar albaranes (`albaranes.routes.ts:1388`, `:1670`; `recapitulativa.service.ts:118`) | profesional | número | rechazado | leído |

### ③ Lo que dice la tabla

**a) La premisa del comentario 17451 sobre la lista de Facturas sólo es cierta a medias.** El
servidor la mete (la consulta filtra por tipo), pero el navegador la vuelve a sacar con
`tipoDeFactura`, que mira el número. **Hoy la `F1` con `J-` no se ve en la pantalla de Facturas.** Lo
medido el 1-oct (§① de arriba) era la consulta del servidor, no la pantalla.

**b) Al cliente le llegan las dos cosas en el mismo gesto.** El correo dice justificante y adjunta un
PDF que dice factura; la página del recibo ofrece descargar el justificante y baja la factura; el
portal la llama factura. No es un sitio equivocado: son dos criterios que se encuentran en el mismo
envío.

**c) Para la emisión es un justificante, y el PDF la imprime como factura.** No entra en la cadena,
VeriFactu no la sella ni la anula, no se rectifica y se puede des-pagar; y su PDF sale con el rótulo
de factura y con QR (en el camino real el QR lleva el `qrData` de la fila o, si está pendiente, el
genérico `INV:…` de `lib/invoicing.ts:85`; sin `vfHash` no es un QR de la AEAT: leído, no ejecutado
sobre ese camino). Un documento que el cliente recibe como factura sin registro de
facturación es lo que la regla 24 no deja emitir en España antes de SIF-1. **Con el fundador
diciendo que son facturas (17451), el defecto no es el rótulo del correo: es que una factura no tiene
registro ni forma de corregirse.**

**d) La población es histórica y no crece.** El generador `J-` no existe (SCRUM-1027, SCRUM-825) y
`invoicing.service.ts:114` ya no fuerza `JUST`. Que hoy haya alguna en producción es el punto C, y no
se ha medido.

### ④ Las opciones, para el fundador

No se elige ninguna y no se construye nada. Los literales que alguna necesitaría van en el comentario
de Jira de esta entrega, para firmar allí; aquí sólo se nombra dónde irían.

| opción | qué cambia | coste | toca emisión | texto nuevo |
|---|---|---|---|---|
| **A · el tipo manda** (lo que dijo 17451) | los sitios que deciden por número pasan a `esJustificante` fuera del camino de emisión: correo, recibo, WhatsApp, recordatorios, pago, panel, filtro del navegador | unos diez ficheros, con sus guards de microcopy; la `F1` con `J-` vuelve a la lista y se llama factura en todas partes | **no, y por eso queda a medias**: seguiría sin registro, sin anulación y sin R1. Meterla en la cadena es sellar hoy una factura antigua con un número fuera de serie: STOP (reglas 29 y 40) | ninguno: se usa la rama «factura» que ya existe en cada sitio |
| **B · el número manda** | libro, lista del servidor y PDF pasan a mirar el número | tres sitios; tumba la decisión de 17451 y el criterio que fija `tests/scrum1232-libro-sin-justificantes.test.mjs` (caso de la `F1` con `J-`), que habría que cambiar por decisión, no por relajar el test (regla 41); el PDF de un documento ya emitido cambiaría de título al regenerarse (regla 29: STOP) | sí, por el PDF | ninguno: rótulos de justificante existentes |
| **C · se marca como incoherente y no se toca nada más** | sólo el panel: la `F1` con `J-` vuelve a la lista de Facturas con un distintivo que dice qué es, y el detalle lo repite | dos ficheros del panel; el cliente sigue viendo las dos cosas | no | sí: el distintivo y su explicación (propuestos en Jira) |

**Antes de cualquiera de las tres, el punto C:** si producción tiene cero `F1` con número `J-`, la
opción más barata es no construir nada y dejarlo escrito; las tres cuestan más que el problema.

### ⑤ Visto y no tocado

- `email.service.ts:96`: el titular del correo concuerda en masculino con los dos rótulos; con el de
  factura queda una concordancia de género mal. Es texto que ve el cliente (firma) y no es este
  punto.
- Nada de lo de arriba se ha tocado.

### ⑥ Lo corrido

- `tsc --noCheck` sobre el árbol, salida 0. Banco: 12 filas, 0 ciegas; con `SABOTEO=1`, 12 ciegas.
- `git status` después de cada pasada: sólo los ficheros de este anexo.
- Tests: no he corrido la tanda; este PR sólo lleva docs.

## Anexo SCRUM-1252e · que ninguna `F1` nazca, ni se convierta, con número `J-`

**Medido contra:** `origin/main` = `5262c70d97afa074d63c7dfc859700c23249f9b3` · 2026-10-23T21:51:55Z (hora de GitHub, `gh api -i zen`)

A9: comprobación → `tests/scrum1252e-f1-con-j-no-nace.test.mjs`

El fallo que generaliza es el del enunciado: el código dejó nacer cinco `F1` con `J-` (censo del
10-ago) y nada lo impedía por construcción. Desde este tramo lo impide un test que lee el código.

Sesión J1ba (`jv-j1ba`), 23-oct-2026, por encargo del orquestador de Javier
(`cobroflash-backend-62`), tras c.20683 (decisión: con cero filas, sólo un guard), c.20698 y
c.20700 (producción: 2 filas, 0 `F1`, 2 con `J-`). **Sólo se LEE el camino de emisión** (regla 38):
no se modifica ni se extrae nada de `src/`. No se tocan los tres sitios del enunciado, el 303 ni
`registro.builder.ts`.

### ① Las dos puertas

Una `F1` con `J-` sólo puede aparecer de dos formas: **nacer** así (una creación cuyo `number`
empiece por `J-`) o **convertirse** (un update que reescriba `type` o `number` de una fila que ya
existe: las dos filas `J-` de producción son justificantes, y un `type: 'F1'` encima las haría `F1`
con `J-`). Medido por AST sobre el árbol: 30 escrituras en `src/` (23 llamadas a `invoice.*` + 7 al
envoltorio `crearFacturaEmitida`; el `grep` da las mismas 23 y 7 comentarios), más 4 en `scripts/`.

### ② Las creaciones: de dónde sale el `type` y de dónde la serie del número

| sitio | `type` | `number` |
|---|---|---|
| `src/lib/invoicing.ts:417` (cobro → factura, C6) | `'F1'` literal | `const` de `allocateInvoiceNumber` |
| `src/modules/invoicing/domain/invoicing.service.ts:109` (`emitInvoice`) | `input.type ?? 'F1'`; sus 4 llamadores (`albaranes.routes.ts:1377` y `:1657`, `recapitulativa.service.ts:109`, `invoicesAdmin.routes.ts:173`) pasan `'F1'` literal | `const` del reservador |
| `src/modules/jobs/app/routes/jobs.routes.ts:1549` | `'F1'` | `const` del reservador |
| `src/modules/quotes/app/routes/quotes.routes.ts:658` | `'F1'` | `const` del reservador |
| `src/modules/system/app/routes/invoicesAdmin.routes.ts:1107` (R1) | `'R1'` | del reservador con `rectifying` |
| `src/modules/system/app/routes/quotesAdmin.routes.ts:363` y `:656` | `'F1'` | `const` del reservador |
| `scripts/seed-demo.mjs:377` y `:437`, `scripts/seed-video.mjs:551` | `isReceiptNumber(number) ? 'JUST' : 'F1'` | del reservador (SCRUM-203) |

**La serie.** `allocateInvoiceNumber` tiene un solo `return`: un `const` de `formatInvoiceNumber`, que
devuelve `formatoNumeroDocumento(SERIES.factura, …)` (`F<AA><NNNN>`, con `SERIES.factura = 'F'`) o
`` `${year}-…` `` (empieza por el año). En modo `receipt` lanza (SCRUM-1027). **Ningún número nuevo
puede empezar por `J-`**, sea cual sea el prefijo de serie del comercio.

### ③ Los updates

22 escrituras de `invoice` en `src/` y 1 en `scripts/`, del censo de la casa
(`scripts/_censo-escrituras-sin-version.mjs`). Ninguna escribe `type` ni `number`. Las dos que el
censo deja OPACAS se resuelven en el test, no a ojo: `invoicesAdmin.routes.ts:817` →
`{reminder7SentAt, reminder14SentAt}` y `invoiceAdmin.ts:303` → `{status, paidAt, paidVia}`. Cero
SQL en crudo que actualice `invoices` en 639 ficheros de `src/` y `scripts/`.

### ④ El test, y lo que hace caer

`tests/scrum1252e-f1-con-j-no-nace.test.mjs`, 8 casos, sin base, sin `dist/`:

- ① ningún update de `invoice` escribe `type` ni `number`; un opaco que no se resuelve es ROJO.
- ② el reservador sólo devuelve serie `F` o de año (AST de los `return`).
- ③ toda creación toma el número del reservador (`_embudo-factura.mjs`) en un `const`: SCRUM-203
  mira sólo el inicializador, y un `let` reescrito después pasaba.
- ④ ningún SQL en crudo hace `UPDATE invoices`.
- Cuatro positivos SEMBRADOS, uno por detector, con su negativo al lado.

**Mutación declarada** (`MUTACIONES_QUE_ME_TUMBAN`): `invoiceReminder.service.ts`, el `data` del
recordatorio de 7 días gana `type: 'F1'`. Vista en ROJO con el árbol comiteado en `c181e6a7`: cae
① nombrando `invoiceReminder.service.ts:109 (updateMany) · escribe type`; `git diff --numstat` 1/1;
restaurado con `git restore --source=HEAD`, `git status --porcelain` vacío. No muto el camino de
emisión, ni siquiera en local: los sembrados ② y ③ cubren esas formas.

### ⑤ Lo que no se mide aquí

- Filas: staging y dev siguen sin medir (los cinco del 10-ago pueden estar ahí).
- Un receptor con alias (`const t = tx.invoice`) y el SQL fuera de `src/` y `scripts/`: lo mismo
  que declara SCRUM-203.

### Lo que hice mal

Al arrancar redirigí a `$T/fichero` sin comillas con una ruta que lleva un espacio: bash dio
«ambiguous redirect» y no escribió nada. Avisó en voz alta y lo repetí con comillas; no generaliza
más allá de la trampa ya conocida de esta máquina.

Y crucé los 200k de contexto sin avisar al cruzarlos: medí al acabar el arranque (111.079) y Jira
(122.434), y la siguiente medida, tras la tanda de guards, ya daba 246.598. Lo avisé en ese momento,
tarde. La lectura del ticket por la herramienta de Jira, la salida de los tests y la del censo
fueron más gruesas de lo que estimé, y entre medias no me medí.

## Anexo SCRUM-1252f · las `F1` con número `J-`, contadas en STAGING y DEV

**Medido contra:** `origin/main` = `25ad5d43b6a8ed41fdcb90c5fdbc0e2e388ec1be` · 2026-10-24T10:04:53Z (hora de GitHub, `gh api -i zen`)

A9: aviso → cicatriz J1 «Fui de Jira a la medición sin correr `node scripts/equipo/norma.mjs --arranque`, que CLAUDE.md pide en cada tanda» — no se pudo comprobar: lo impediría un hook de arranque que exigiera haberla leído, y los hooks no son de este puesto

Sesión J1bg (`jv-j1bg`), 24-oct-2026, por encargo del orquestador de Javier
(`cobroflash-backend-95`). Resultado y controles también en Jira, c.20718. **Sólo lectura:** cada
consulta va dentro de `SET TRANSACTION READ ONLY` (la base contestó `transaction_read_only = on`).
Ninguna fila cambiada (regla 29). Producción no se toca: en un árbol no vive.

### ① Qué bases

`node scripts/comprobar-claves-bd.mjs` → `rc=0`: `DATABASE_URL_STAGING` (base `railway`) y
`DATABASE_URL_DEV` (base `yaqu_dev_javier`); `DATABASE_URL` ausente. `DATABASE_URL_TESTS` apunta a la
misma base que DEV: se mide una vez. El script es de un solo uso, vive fuera del repositorio y no
imprime clave ni URL. El turno de staging no se tomó: la receta (RUNBOOKS, SCRUM-188/232) lo pide
para tandas y operaciones que escriben, y tomarlo escribe un marcador en la base.

### ② Resultado

| base | c.20697 (`F1` con `J-`) | total | f1 | con_j | por `type` |
| --- | --- | --- | --- | --- | --- |
| STAGING | 0 filas | 9 | 0 | 9 | `JUST` 9, las 9 con `J-` |
| DEV | 0 filas | 5 | 5 | 0 | `F1` 5, ninguna con `J-` |
| PRODUCCIÓN (c.20700, la corrió el fundador) | 0 filas | 2 | 0 | 2 | — |

Controles: el mismo predicado (`type = 'F1' AND number LIKE 'J-%'`) sobre tres filas sembradas
(`F1`/`J-…`, `F1`/`F26…`, `JUST`/`J-…`) da 1 en las dos bases. Ninguna tabla está vacía. STAGING
cumple el criterio de c.20698 (total > 0 y con_j > 0). DEV no tiene ningún `J-`, así que su cero no
pone a prueba esa mitad del predicado. Como no salió ninguna fila, no hay id, número, merchant ni
fecha que dar (la consulta de detalle, con `isDemoMerchant` de la casa, volvió vacía).

### ③ Lo que dice

- Los cinco del 10-ago no están hoy en ninguna de las tres bases medibles.
- Corrección a la premisa del enunciado («son de desarrollo o de staging»): el censo del 10-ago fue
  **de producción** (`SCRUM-1232.md:197-198`, que cita `PREGUNTAS_ASESOR.md:640-641`). Los cinco
  estaban en producción, y producción tenía 2 filas el 28-sep. Cuándo y por qué desaparecieron esas
  filas: NO MEDIDO. Es pregunta para el fundador (regla 29 si eran documentos emitidos).
- NO MEDIDO: bases de desarrollo que no están en este árbol (las del otro equipo, los Postgres locales).

### Lo que hice mal

No corrí la lectura de arranque (`norma.mjs --arranque`): pasé de Jira a la medición. Va a mi
cicatriz, porque no hay ningún guard que lo vea.

## Anexo SCRUM-1252g · el titular del correo de una factura concuerda: «Tu factura está lista»

**Medido contra:** `origin/main` = `77ce98573b1b5e090dfcf7754c4e7960bc63b85a` · 2026-10-27T15:33:32Z (hora de GitHub, `gh api -i zen`)

A9: sin fallo que generalice — escribí primero la cita en la forma del ancla contando con añadir su par a la lista de J6; la regla del carril lo paró antes de editar, y la cita quedó en forma rastreable (§②).

Lo hace la S1 del equipo de Luis (carril: `node scripts/carriles.mjs de src/modules/messaging/domain/email.service.ts`
→ S1, `dos-equipos.md:136`), por encargo de su orquestador. Es lo único que c.20899 dejaba abierto en
este ticket. **SCRUM-1604** («PARA S1 · El correo de una factura dice "Tu factura está listo"», 23-oct)
es el MISMO defecto con la misma firma; el trabajo va aquí y 1604 apunta a este tramo.

### ① La firma

c.20683, punto ②, decisión del fundador transcrita por el orquestador del equipo J: «Sí: «Tu factura
está lista»». Con la factura, ese titular; con los documentos en masculino (el justificante), nada
cambia; ningún otro texto. No se ha redactado nada: el literal es el firmado.

### ② El arreglo

`src/modules/messaging/domain/email.service.ts` (`sendInvoiceEmail`): el titular se elige por
`isJust`, la misma variable que ya elige `docLabel`. Factura → «Tu factura está lista»; justificante →
«Tu justificante de cobro está listo», como antes. Asunto y cuerpo, sin tocar. El comentario de la
línea cita la firma como `SCRUM-1252 c.20683, punto ②`.

⚠️ La cita queda **rastreable, no anclada**: la forma del ancla (`SCRUM-N comentario M`) exige su par
en `tests/_pares-leidos-en-jira.mjs`, que es de J6 (`carriles.mjs` → `dos-equipos.md:194`), y no se
edita desde S1. Si J6 añade el par (1252, 20683), el comentario puede pasar a la forma del ancla.

No toca el camino de emisión: `ensureInvoicePdf` y lo que viene antes del titular siguen igual. La
línea tocada es la plantilla del correo, después de tener el PDF.

### ③ El test, y lo que lo hace caer

`tests/scrum1252g-titular-del-correo-de-factura.test.mjs`, sin base ni red: el banco de scrum1235
(base, emisión y `axios.post` doblados; `sendInvoiceEmail` y `renderEmailLayout` reales). Lee el HTML
que llegaría a Resend.

| `dist/` | factura | justificante (control) |
|---|---|---|
| arreglado | ✔ | ✔ |
| mutante 1: titular de factura vuelve a «está listo» (el defecto) | ✖ | ✔ |
| mutante 2: el justificante pasa a «está lista» | ✔ | ✖ |

Cada mutante tumba sólo su caso: los dos casos miden cosas distintas. `dist/` restaurado y comprobado
por hash tras cada mutante.

### ④ Fuera

- La verificación en yaqu.app: producción no tiene `INVOICING_ES_ENABLED` en ON, y una factura nueva
  no se emite sólo para ver un correo (regla 24). Lo que se ve es el test sobre el HTML real.
- Ningún otro texto del correo.

## Anexo SCRUM-1252h · anclar la cita de la firma del correo: parado, la fila sola no ancla

**Medido contra:** `origin/main` = `95016f26f5b0d31dcb542467cbdb2a9249a71366` · 2026-10-27T18:08:39Z (hora de GitHub, `gh api -i zen`)

A9: aviso → cicatriz J6 «Escribí una sonda de node con un heredoc de bash y se comió una barra invertida de una regex» — no se pudo comprobar: lo cazó node al no compilar, y ningún hook de este árbol para un heredoc que lleva barras invertidas

Lo hace jv-j6dx (puesto J6, equipo de Javier), por encargo de su orquestador y a petición de S1 (c.21098 ②).
Medición y preguntas en c.21192. **No se ha cambiado ningún fichero de código ni de test.**

### ① Lo que se pidió y por qué no basta

El encargo: añadir el par (1252, 20683) a `tests/_pares-leidos-en-jira.mjs` para que la cita de
`src/modules/messaging/domain/email.service.ts:95` pase de rastreable a anclada. Pero el par sólo
cuenta si la cita tiene la forma del ancla, y ésta no la tiene. `RE_ANCLA_JIRA`
(`tests/_respaldo-de-firma.mjs:60`) exige la palabra «comentario», y la línea 95 dice `c.20683`.
S1 la bajó a esa forma a propósito (anexo 1252g, §②).

### ② La sonda

`respaldoDe()` de la casa sobre el bloque real (líneas 94-96), con la lista de main y con la lista
más (1252, 20683). Control positivo sembrado: el mismo bloque con `comentario 20683`.

| bloque | lista | veredicto |
|---|---|---|
| real (`c.20683`) | main | `rastreable` |
| real (`c.20683`) | main + par | `rastreable` |
| sembrado (`comentario 20683`) | main | `rastreable`, motivo «par no leído» |
| sembrado (`comentario 20683`) | main + par | `anclado` |

El control cambia con la lista; el bloque real, no. Para anclarla hay que tocar los dos lados: la
línea 95, de S1 (`carriles.mjs de` → `dos-equipos.md:136`), y la lista, de J6 (`dos-equipos.md:194`).
La cabecera de la lista pide además que la fila vaya «en el mismo PR que la marca que lo cita».

### ③ Lo que el encargo daba por hecho y no existe

Que el guard compruebe el literal: los pares no llevan literal (`ticket`, `comentario`, `leido`,
`por`), y la lista declara que «No caza el CONTENIDO». Comprobarlo sería un mecanismo nuevo.

### ④ Pendiente de decisión (c.21192)

Un PR con los dos lados (cruce declarado), dos PR con la fila huérfana mientras tanto, o un ticket
de J6 para el mecanismo de contenido. La lectura de c.20683 para la fila está hecha (27-oct, por
`getJiraIssue`): existe, es de SCRUM-1252, y su punto ② dice «Sí: «Tu factura está lista»».
