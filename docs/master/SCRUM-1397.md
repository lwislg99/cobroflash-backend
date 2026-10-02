# SCRUM-1397 · El Técnico ve sus facturas, por una sola puerta — y lo que eso NO cierra

**Medido contra:** `origin/main` = `d2ed6c8a2c4d2b3487c4557094d12915e9dfb83c` · 2026-10-02T02:04:22Z

2-oct-2026 · **J2a** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5b`).
[Escrito por J2a. Las frases del fundador las transcribe el orquestador en Jira; aquí se citan de allí, y
los comentarios que se nombran los he leído en Jira, no en el mensaje del encargo.]

A9: comprobación → `tests/banco-scrum1397/mutar.mjs`

## Ⓐ Qué se decidió, quién, y dónde consta

| qué | quién | dónde lo leo |
|---|---|---|
| El Técnico ve sólo SUS facturas | fundador, «1-Ok la B» | SCRUM-1346 c.17828 |
| «Suya» = de lo que es autor MÁS lo que se le ha asignado como trabajo; «mejor ser más laxo al principio y evitar errores» | fundador | SCRUM-1346 c.17932 |
| Vale para facturas y para presupuestos | fundador, «1-Para los dos» | SCRUM-1346 c.17952 |
| Estar asignado AL DOCUMENTO cuenta para verlo | fundador, «1-Sí» | SCRUM-1390 c.17962 |
| La regla es: autor del documento O `esSuyoElTrabajo` O asignado al documento | orquestador, corrigiendo c.17962 con la medición de J4h | SCRUM-1390 c.17964 |
| El eje del Trabajo son los TRES de la casa, no sólo `Job.operarioId` (el ticket decía eso y era más estrecho) | orquestador, por mensaje, al avisarle yo de que el ticket y c.17964 no decían lo mismo | mensaje del 2-oct; la fuente escrita es c.17964 |

El máster ya lo declaraba decidido y sin construir (`docs/YAQU_MASTER.md:665`, SCRUM-1390).

## Ⓑ Qué se ha construido

**Una puerta**, `src/core/documentos/accesoALaFactura.ts`, con dos funciones que son el mismo criterio:

- `whereFacturasVisibles(quien)` devuelve el recorte de `invoices` para quien pregunta. Para quien ve
  todo el negocio devuelve `null` y su consulta sale como salía.
- `puedeVerLaFactura(quien, id)` aplica ese mismo recorte a un id.

Las tres rutas de `src/modules/system/app/routes/invoicesAdmin.routes.ts` pasan por ella: la lista le
pide el recorte y se lo da a `listInvoicesAdmin`; la ficha y el PDF preguntan antes de leer la factura. Una
factura ajena contesta `404 not_found`, igual que una que no existe. No hay ningún texto nuevo.

**Quién ve todo** lo decide `seesAllJobs` (`src/core/http/roleCapabilities.ts`), la allowlist que ya
existía: sólo `admin`. La persona propietaria entra con sesión sin miembro y `requireAuth` le pone `admin`.

**Qué es «suya»**, en el orden en que está escrito en la puerta:

| eje de la decisión | cómo se mira | caso que lo prueba (número de la factura sembrada) |
|---|---|---|
| autor | `quote.teamMemberId` | `SUYA-AUTORA` |
| asignada al documento | `invoice_assignees` | `SUYA-ASIGNADA-AL-DOCUMENTO` |
| Trabajo, por el presupuesto que lo abrió | `Job.quoteId`, con los tres ejes del Trabajo | `SUYA-TRABAJO-OPERARIO`, `-ASIGNADO`, `-TABLA` |
| Trabajo, por un adicional | `Quote.jobId` | `SUYA-TRABAJO-ADICIONAL` |
| Trabajo, por un albarán entero (recapitulativa) | `Albaran.invoiceId` | `SUYA-ALBARAN-ENTERO` |
| Trabajo, por un albarán a medias (parcial) | `AlbaranLineaFacturada.invoiceId` | `SUYA-ALBARAN-PARCIAL` |
| la rectificativa de una suya | `rectifiesId`, un nivel | `SUYA-RECTIFICATIVA` |

Los tres ejes DEL TRABAJO (operario, asignado, tabla de asignados) no se escriben en la puerta: se le
piden a `whereSuyoElTrabajo` (`src/modules/jobs/domain/accesoAlTrabajo.ts`). Un caso del test lo vigila
por AST.

### Son tres lecturas antes de la consulta, y no se pueden juntar

`Invoice` no tiene relación de Prisma con `Job` ni con `Albaran`. `Job.quoteId`, `Quote.jobId`,
`Albaran.invoiceId` y `AlbaranLineaFacturada.invoiceId` son columnas sueltas, así que un único `where`
sobre `invoices` no llega al Trabajo. La puerta lee primero los Trabajos de la persona, luego los
albaranes de esos Trabajos y luego el libro de líneas facturadas, y con esos ids arma el recorte.
Quien quiera dejarlo en una consulta pierde un camino entero: las facturas parciales y las
recapitulativas nacen sin presupuesto, y el operario dejaría de ver facturas de su propia obra sin que
nada falle. Las mutaciones M12, M13 y M14 del banco son exactamente eso.

Los ids viajan en listas `in`. Con miles de Trabajos por persona habría que cambiarlo por una
subconsulta. No lo he medido con volumen.

### Lo que NO se ha tocado, a propósito

- **`prisma/schema.prisma`**, ni una línea. Su comentario «ASIGNAR NO ES UN PERMISO» queda falso para
  VER desde c.17962. Lo dejo como está: tiene su ticket, SCRUM-1400, y el máster dice que se corrige en
  un paso propio.
- La misma frase en `src/core/documentos/asignacionDeDocumento.ts` **se conserva**; debajo va una línea
  fechada que dice que para ver sí cuenta, y que para editar y emitir sigue siendo verdad. Autorizado
  por el orquestador por mensaje.
- `requireRole` de ninguna ruta. El camino de emisión. Ningún workflow.
- **`docs/YAQU_MASTER.md:665`** sigue diciendo «sin construir». Después de este PR es verdad a medias
  (ver Ⓒ). No la he tocado: es una fila del máster y su literal no es mío.
- Las otras 17 rutas del censo de SCRUM-1390.

## Ⓒ Lo que este cambio cierra, y lo que no

Dos frases, y sólo una es verdad:

- ⛔ FALSO: «el Técnico ya no reconstruye el total del negocio».
- ✅ VERDADERO: «el Técnico ya no lo reconstruye **por las tres rutas de factura**».

El cálculo que hizo J2i el 1-oct (SCRUM-1346) sumaba `GET /admin/invoices`. Contra el build de `main`
sale exacto y el test lo dice en su fallo: «1050 = 1050». Con el cambio, la misma Técnica suma 100 de
1.050 y 0 de los 900 de su compañero.

Pero el resultado sigue a su alcance por otras dos puertas. Medido por ejecución
(`docs/evidencias/scrum1397/sonda-otras-puertas.mjs.txt` y su `.salida.txt`), con el mismo negocio:

| por dónde | qué suma | resultado |
|---|---|---|
| la lista de facturas (cerrada aquí) | las cobradas de su lista | 100 de 1.050 |
| las fichas de cliente (ruta 8 del censo): `GET /admin/customers` y `GET /admin/customers/:id/detail` | el `totalPaid` de cada ficha | **1.050 de 1.050** |
| las fichas de presupuesto (rutas 2 y 3): `GET /admin/quotes?teamMemberId=` y `GET /admin/quotes/:id` | las facturas cobradas que trae cada ficha | **900 de 900** del compañero |

`totalPaid` es un agregado sin tope y no necesita el filtro por autor. Filtrar las facturas que enseña
la ficha no lo arregla. Lo lleva SCRUM-1403; aquí no se toca.

**Límites de esa medición:** es el negocio fabricado de J2i (4 clientes, 4 facturas), no datos de
ninguna cuenta. La ficha de cliente trae sólo las 20 últimas facturas de cada uno, pero eso no acota el
camino del agregado.

### «Cuánto sigue reconstruyendo» (③ del ticket)

Por las tres rutas de factura, un Técnico suma lo suyo y nada más: en el negocio de J2i, el 9,5 %
(100 de 1.050). Eso es aritmética del fixture, no una medida de ninguna cuenta: en un negocio de una
persona propietaria y un operario que lleva todos los Trabajos, «lo suyo» es todo lo que pasa por un
Trabajo y el porcentaje se acerca a 100. No lo he medido con datos reales porque no hay base
autorizada. Y por las otras dos puertas el porcentaje es 100 hoy, tenga el equipo el tamaño que tenga.

## Ⓓ Los controles del ticket, y dónde se ven

Todos en `tests/scrum1397-el-tecnico-ve-sus-facturas.test.mjs`. Los dos primeros casos hablan por HTTP
con `dist/app.js` y con Prisma de verdad sobre el banco desechable (`LIBRO_PG_URL`); sin él saltan
diciendo por qué.

| control del ticket | caso | qué afirma |
|---|---|---|
| ① el rojo primero | commit `0ff720a9`, `docs/evidencias/scrum1397/rojo-contra-dist-de-main.tap.txt` | contra el build de `main` caen los dos casos con base; el primero dice «1050 = 1050» |
| ② el cálculo de J2i deja de salir | «un Técnico ya NO reconstruye…» | el panel dice 1.050 y 900 (suelo); la Técnica suma 100 y 0; su lista es exactamente `A-1` |
| ③ sigue viendo las suyas | «el Técnico SIGUE viendo cada factura suya…» | las 9 formas de ser suya, por nombre: en la lista, ficha 200 y PDF 200 `application/pdf`; un justificante suyo abre |
| lo ajeno no | el mismo caso | las 5 formas de no ser suya: fuera de la lista, ficha 404, PDF 404; buscando por número o por cliente tampoco; el compañero ve las suyas y no las de ella |
| ④ el admin, todo | el mismo caso | la administradora y la propietaria listan las 14 y abren ficha y PDF de las 16 |
| ⑤ Prisma de verdad | los dos casos con base | el `where` lo contesta Postgres |

Otros tres casos corren sin base: las tres rutas llaman a la puerta antes de leer (AST); la puerta no
recorta al admin y sin identidad no casa nada; y los ejes del Trabajo no están copiados en la puerta.

**Dos avisos sobre «Prisma de verdad»:**

- El banco desechable nace de `prisma/schema.prisma`, así que coincide con el esquema por construcción.
  Sirve para probar que este `where` hace lo que digo. No dice nada sobre los datos reales.
- En local no hay Postgres. Lo he corrido contra PGlite 0.5.8 (Postgres 18 en memoria), instalado fuera
  del repo. El check obligatorio corre `postgres:16`. No es el mismo motor: el veredicto que cuenta es
  el del obligatorio, leído por nombre.

## Ⓔ Las huérfanas: el recuento que se puede dar y el que no

**El número real está SIN MEDIR.** No tengo base: este árbol no lleva ningún `.env`, y el orquestador
no autoriza ni producción ni staging. Lo que hay es el recuento estructural, por camino de creación, y
el SELECT para quien tenga la base.

Hay diez sitios en `src/` que crean un documento en `invoices` (buscados por las llamadas a
`emitInvoice` y `crearFacturaEmitida`):

| # | dónde | `quoteId` | otro vínculo | ¿puede nacer sin ningún eje? |
|---|---|---|---|---|
| 1 | `POST /admin/invoices` (la factura suelta) | `null` | ninguno | **siempre** |
| 2 | `ensureInvoiceForCharge` (`src/lib/invoicing.ts`), el documento de un cobro | el del presupuesto del cobro, o `null` | ninguno | **siempre que el cobro no venga de un presupuesto** |
| 3 | `POST /admin/albaranes/:id/facturar-parcial` | `null` | libro de líneas | si el Trabajo del albarán no tiene a nadie |
| 4 | `emitirRecapitulativas` | `null` | `Albaran.invoiceId` | si ninguno de sus Trabajos tiene a nadie |
| 5 | `POST /admin/albaranes/:id/convertir-en-factura` | el del presupuesto | libro de líneas | si no hay autor ni nadie en el Trabajo |
| 6 | `POST /admin/jobs/:id/collect-rest` | el del presupuesto | — | ídem |
| 7 | `POST /quote/:token/decision` (la aceptación pública) | el del presupuesto | — | ídem |
| 8 | `POST /admin/quotes/:id/invoice` | el del presupuesto | — | ídem |
| 9 | `POST /admin/quotes/:id/invoice-manual` | el del presupuesto | — | ídem |
| 10 | `POST /admin/invoices/:id/rectify` | el de la original | `rectifiesId` | hereda lo de la original |

**Dos caminos dejan la factura sin ningún eje por construcción**: la suelta (1) y la del cobro sin
presupuesto (2). Sólo pasan a ser de alguien si se les asigna a mano. Otros dos (3 y 4) nacen sin
presupuesto y dependen de que el Trabajo tenga a alguien. Los cinco restantes llevan presupuesto: son
de nadie del equipo cuando el presupuesto lo hizo la persona propietaria y el Trabajo no tiene operario
ni asignado — que no es una factura «huérfana», es una factura de la oficina.

Con el cambio, a ninguna de ésas la ve un Técnico. El admin las ve todas. Qué se hace con ellas no lo
decido yo.

**El SELECT**, de sólo lectura: `docs/evidencias/scrum1397/huerfanas.sql.txt`. Devuelve una fila con el
nombre de la base, el total, y tres cifras: de ningún eje; de ésas, las que no nacen de nada; y las que
son de la oficina. Lleva sus tres controles escritos en la cabecera. Lo he visto contar bien trece
documentos sembrados, uno por clase (`control-del-select.mjs.txt` y su salida: 7 de alguien, 3 sin
origen, 3 de la oficina). Lo puede correr quien tenga acceso de lectura a la base; yo no.

## Ⓕ Lo que he visto y no es de este ticket

1. **La pantalla, y hace falta una decisión de texto.** No he cambiado ninguno. Dos cosas que el Técnico
   va a leer:
   - Con cero facturas suyas, la lista dice «Aquí verás tus facturas» y «Cuando un cliente acepte un
     presupuesto, sus facturas aparecerán aquí.» (`public/dashboard/js/invoicesView.js`). Para él la
     segunda frase ya no es exacta: sólo aparecerán si el presupuesto o el Trabajo son suyos.
   - Si abre desde la ficha de un cliente una factura que no es suya (la ficha se las sigue listando,
     ruta 8), la pantalla dice «Error cargando la factura.» (`invoiceDetailView.js`). No es un error.
   Leído en el fuente; no visto en navegador.
2. **`GET /admin/invoices/:id/pdf` contesta 500 `pdf_generation_failed` para una factura
   `pendiente_de_sellado`**, no el 409 que su propio `catch` prepara. `ensureInvoicePdf` lanza
   `invoice_pendiente_de_sellado` y la ruta sólo reconoce `invoice_sin_sellar`. Ejecutado (mi primer
   fixture nacía sin sellar y el PDF de una factura propia dio 500). Es camino de emisión: lo reporto,
   no lo toco.

## Ⓖ Lo corrido

Se rellena al final, con la tanda dirigida, el banco de mutaciones y el check obligatorio leído por nombre.

## Ⓗ Mis errores de esta tanda

1. **Di por bueno un rojo sin leer por qué caía.** La primera pasada contra el banco dio «caen 2», que
   era el número que esperaba, y caían por el banco: «prepared statement "s0" already exists». Lo vi al
   abrir el TAP. Ahora el lanzador imprime el motivo de cada caída, y el banco de mutaciones exige el
   texto del fallo además del caso. Es la línea `A9:` de arriba.
2. **Deduje un 409 leyendo el `if` de la ruta del PDF, y era un 500.** Escribí el caso positivo del PDF
   contra lo que la ruta «debía» contestar. Lo cazó el propio test. De ahí salió el hallazgo 2 de Ⓕ, y
   el positivo es ahora un PDF generado de verdad (200).
3. **Escribí una limpieza que borraba por prefijo** (`<id del merchant>-`) en `storage/invoices/`. En un
   banco recién creado ese id es 1 o 2: se habría llevado los PDF de cualquier otro merchant con ese id
   en esa máquina. Lo vi antes de ejecutarlo. Borra por nombre exacto.
4. **Puse «~02:50Z» a ojo** en un mensaje al orquestador; GitHub decía 02:18Z. Es la cuarta sesión de J2
   que lo hace. Corregido en el mensaje siguiente.
5. **Pasé texto a `node -e` por bash** para dos reemplazos en el test. Salió bien porque el texto no
   llevaba acentos ni comillas invertidas; la nota de la máquina dice que no se hace. El resto, con la
   herramienta de ficheros.
