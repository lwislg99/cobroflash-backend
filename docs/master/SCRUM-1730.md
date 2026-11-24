# SCRUM-1730 · Criterio de caja: los tres huecos del libro, el 303, los libros AEAT y las evidencias

## J1 · SCRUM-1730 · reproducir (i) y (ii) ejecutando el código, y proponer el GO

**Medido contra:** `origin/main` = `2c52196fddfdee2f2875c38d51642785d2566812` · 2026-11-12T18:05:57Z (hora de GitHub; sesión J1 `jv-j1eg`, por encargo del orquestador `cobroflash-backend-63`. Re-medido contra `420ee00b709e461b70f1c0e99766a5a1de834986`: 0 cambios en `src/` y `prisma/` entre los dos)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

**Qué es.** Sale de SCRUM-1240 c.21773 (medición de `jv-j1ef`, leída en el código) y de la decisión c.21776 (los tres huecos a un ticket J1, cada arreglo con su GO). Aquí se REPRODUCEN ejecutando, se dejan fijados como defecto declarado y se propone el arreglo. **No toca `src/`** (regla 38): el test importa el libro y el 303 de `dist/`, que no son el camino de emisión. Comentario de Jira con la medición y las preguntas: **SCRUM-1730 c.21785**.

**Reproducido** (libro registro y 303 reales, base en memoria, merchant con `criterioCaja: true` leído por `criterioDelMerchantParaElLibro`):

- **(i) S2.** Factura con una línea `causa: 'S2'`, emitida el 15-feb-2027 y cobrada el 20-may-2027: cae en el T2 del libro y de la casilla 122 del 303, no en el T1. Control positivo: una S1 con las mismas fechas cae en el T2 (la caja está encendida).
- **(ii) 31-dic.** Factura del 10-mar-2026 sin cobro: `fechaDeDevengo` = `null` y el libro del T4-2027 no la trae. Controles: cobrada en nov-2027 sí sale en ese T4; sin caja sale por emisión en el T1-2026.
- **(iii) vivo contra congelado.** No reproducible: `invoices.merchant_criterio_caja` da 0 en `src/` y `prisma/` de `origin/main` (entra con el PR de 1129).

**Dato nuevo.** `fechaDeDevengo` tiene 0 llamadores en `src/` (huérfana declarada en `tests/_huerfanos-declarados.mjs`); el libro decide en el `where` de `leerLibroRegistro`. Arreglar sólo la función no cambia ningún libro: lo fija la 2ª mutación del test (MEDIO ARREGLO → rojo).

**Cobro parcial.** `Invoice` tiene un `paidAt`, un `status` y un `chargeId`; no hay tabla de cobros por factura (`Charge` → `Invoice[]` es un cobro para varias facturas, no al revés). El flujo que sí es parcial es la retención de garantía (SCRUM-1107): la liberación es un `Charge` nuevo sin enlace a la factura. Leído, no ejecutado.

**El test.** `tests/scrum1730-criterio-caja-huecos-declarados.test.mjs`, 7 casos: `DEFECTO_CONOCIDO` con una entrada por hueco citando SCRUM-1730 (patrón 1240b). Rojo si el comportamiento cambia con la declaración puesta, si se retira sin arreglar, con medio arreglo o en CIEGO.

**Rojo primero** con `correr` + `aplicarUna` del meta-guard, árbol commiteado en `5863c33506240d216cfaca1ebfc2d9915426c4d5` (base 7/7): las 5 mutaciones declaradas tumban el test que nombran, cada una por su motivo — CAMBIADO (prototipo del arreglo de (i)), MEDIO ARREGLO (sólo la función de (ii)), CIEGO (caja desconectada) y dos «se retiró la declaración». `git status` limpio tras la pasada.

**Propuesta de GO** (detalle en c.21785 ③; ninguna toca la emisión): (i) `libroRegistro.repo.ts` lee por emisión las facturas con líneas S2 — riesgo: la factura mixta; (ii) el `where` del libro + `fechaDeDevengo` con el tope del 31-dic — riesgo: no volver a contar las cobradas después del tope, y `createdAt` como fecha de la operación; (iii) tras 1129, criterio por factura y decisión de qué hace NULL. Preguntas ✅/❌ en c.21785 ④.

**Errores míos.** ① Mi primer driver le pasó a `correr` la ruta con `tests/` delante y la base salió 0 pasados · 1 caído: lo paró la PUERTA 1 del meta-guard (no muta sin base en verde). ② El ancla de la 5ª mutación no casaba (el `},` no va en su propia línea): lo paró su comprobación del ancla. ③ Encadené un `sed` roto con `&&` delante del `node` y leí el fichero de salida de la pasada ANTERIOR como si fuera el nuevo; lo vi por el `EXIT=1`, borré el fichero viejo y relancé con un driver escrito con la herramienta de escritura.

**Sin medir:** ninguna base de datos · los libros AEAT y el paquete de evidencias (sólo ejecutados el libro y el 303) · la suite local entera (NO CORRIDA; los guards dirigidos, en la entrega).

## J1 · SCRUM-1730b · construir (i) S2 por emisión y (ii) el tope del 31-dic (GO de c.21789)

**Medido contra:** `origin/main` = `a29e8fadcaa208fb9c6139341de3648318947da5` · 2026-11-13T16:21:11Z (hora de GitHub; sesión J1 `jv-j1ek`, por encargo del orquestador `cobroflash-backend-63`)

A9: comprobación → `tests/scrum1730-criterio-caja-huecos-declarados.test.mjs`

**Qué se ha hecho.** Con el GO de Javier en c.21789 (puntos 1 y 2). Sólo libros: ni builder, ni sellado, ni PDF.

- **`devengoPorCaja.ts` · `fechaDeDevengo` decide.** Con caja: si alguna línea lleva `causa: 'S2'`, devenga en `createdAt` (una mixta va ENTERA por emisión, como decide c.21789). Si no, devenga en el cobro si es hasta el tope, y en el tope si no hay cobro o el cobro es posterior. El tope es el 31-dic del año siguiente a `createdAt`, a las 23:59:59.999 locales, como el `hasta` de `rangoTrimestre` (`topeDeDevengo`). Con caja ya nunca devuelve `null`. La detección de S2 está copiada de `tieneLineasIsp` (`destinatarioIsp.ts`): aquélla no se exporta, y exportarla es tocar el camino de emisión (regla 38).
- **`libroRegistro.repo.ts` · `leerPorCaja`.** Con caja y rango, la base trae CANDIDATAS con tres consultas de un solo rango cada una: cobradas en el rango, emitidas en el rango y emitidas en los años cuyo tope cae en el rango. Cada candidata entra sólo si su `fechaDeDevengo` cae dentro, y el orden es fecha de devengo y número. Una cobrada después del tope sale como candidata por su `paidAt`, pero su devengo es el tope y se queda fuera: no se cuenta dos veces. Sin caja, o sin rango, la consulta es la de siempre.
- **El test de 1730.** Se retiran `s2` y `tope31dic` de `DEFECTO_CONOCIDO` (queda vacío; el (iii) nunca estuvo ahí). Los dos casos cambian de nombre y se añaden tres: la mixta (libro, casilla 122 y casilla 27 = 126 € en el T1), la cobrada DESPUÉS del tope (sale en el T4-2027 y NO en el T1-2028, y la casilla 27 da 210 y 0) y «el tope no adelanta nada» (sin cobro, fuera de 2026-T1, 2026-T4 y 2027-T3, que es lo de `scrum294b`). Casillas 28/29: salen del libro de recibidas, que no se toca.
- **Dos listas de piezas sin consumidor.** `fechaDeDevengo` ya tiene llamador: sale de `tests/_huerfanos-declarados.mjs` (la entrada de `devengoPorCaja.ts`, con `CAMPO_COBRO`, que también se usa ya) y pasa de `declaradas` a `retiradas` en `scripts/_sin-consumir-declarados.json`, un contenedor de S0 (`scrum1185` lo exige). Avisado al orquestador antes de tocarlo.

**Rojo primero.** Con `dist/` de los dos ficheros de `HEAD` (transpilados aparte) y el test nuevo: caen 4 de 10, los cuatro casos del arreglo. Con el arreglo, 10 de 10.

**Mutaciones** (catálogo rehecho contra el arreglo, con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): base 10 pasados, 0 caídos, 0 saltados. Las **6 VIVAS**: sin la excepción S2; con la función devolviendo `null` sin cobro; con el libro sin pedir la ventana del tope (medio arreglo); con la cobrada después del tope contando en su cobro; con la caja desconectada (CIEGO); y con `s2` declarado otra vez. Árbol limpio después.

**Dirigida.** 54 ficheros: los que importan el libro, el 303, los libros AEAT, las evidencias, el 130, el 347 o `devengoPorCaja`, más `scrum294*`, `1063*`, `1064*`, `1240b`, `553`, `237`, `976`, `1387*`, `411`, `494`, `1185`, `189`, `615`, `622`, `719`, `273`, `267` y `1294`. Resultado: 518 casos, 511 ok, 6 saltados (todos `sin LIBRO_PG_URL`: 295, 296, dos de 297 y dos de 389) y 1 rojo, `scrum1185`, que se arregló con el movimiento de arriba (11 de 11 después).

**Build con tipos:** `tsc -p .` sale 2 por UN error, y no es de esta rama: `Job.queHayQueHacer` no está en el cliente Prisma compartido (junction al árbol común, no se regenera; A1). En los ficheros de esta rama, 0 errores.

**Errores míos.** ① Leí el arranque de normas después de Jira y no antes, y la cifra del arranque no la mandé al medirla (va a mis cicatrices). ② El primer obligatorio (`2995507b`) cayó por 2 de 13.589 casos, de dos guards que recorren el árbol entero sin nombrar mis ficheros y que la dirigida no listó: `scrum1093h` (los `getFullYear` nuevos sin clase en `USO`) y `scrum289` (el `findMany` nuevo del libro sin censar). Es la misma forma que la de 1051g. Arreglado en la rama: los dos van a `AGREGADO` en `scripts/_censo-fecha-sin-zona.mjs`, en la zona de `rangoTrimestre`, que es quien pone las fronteras del trimestre, y el `findMany#2` se censa en `tests/_censo-origen-factura.mjs` como `OPACO`, porque no ata al origen. Después, 78 de 78 en los 8 ficheros que los leen. El job de navegador cayó por `guard:detalle-trabajo-917` (Trabajos), que no es de esta rama.

**Sin medir:** ninguna base de datos (los 6 casos de `LIBRO_PG_URL`, saltados) · los libros AEAT y las evidencias, ejecutados sólo a través de los tests de la dirigida que los importan · la suite local entera (NO CORRIDA, por orden del encargo: 10 sesiones a la vez) · el cobro parcial (punto 4 de c.21789, ticket aparte) · el (iii), que espera a 1129.

## J1 · SCRUM-1730c · (iii) vivo contra congelado: la medición (el arreglo NO se ha construido)

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:08:06Z (hora de GitHub; sesión J1 `jv-j1ju`, por encargo del orquestador `cobroflash-backend-2d`)

A9: sin fallo que generalice — tramo sólo de medición, leída en el código; el arreglo no cupo en el tope de 160k del encargo (medido: 102k al acabar el arranque, 131k tras leer Jira), y eso es del reparto, no de una comprobación que falte.

**El GO.** SCRUM-1730 c.21789, punto 3: «(iii) ✅: tras 1129, el libro lee el criterio congelado de cada factura, y NULL = por emisión, sin caer al Merchant vivo, igual que el PDF.» La propuesta que aprueba es la fila (iii) de c.21785 ③. 1129 ya está: la columna existe.

**Medición ①. Leída en el código, NO EJECUTADA** (este árbol no trae `dist/` y no se compiló).

- **La columna se escribe, y sólo en las F1.** `Invoice.merchantCriterioCaja` se sella en `verifactu.service.ts:352-354` y `:443` con el valor del `Merchant` en ese momento, pero solo si el tipo es `F1`. Con cualquier otro (R1, F2…) se queda en NULL.
- **El libro no la lee.** Hay 0 apariciones de `merchantCriterioCaja` en `libroRegistro.repo.ts` y en `devengoPorCaja.ts`, y `CAMPOS_FACTURA` (16 campos) no la selecciona. Sin ese campo en el `select`, el libro no puede decidir factura por factura.
- **Quién decide.** Lo decide `libroRegistro.repo.ts:276`: `campo = 'criterioCaja' in rango ? campoDeDevengo(rango.criterioCaja) : CAMPO_EMISION`. Es un solo valor por CONSULTA. Hay tres llamadores que lo pasan, y los tres lo sacan de `criterioDelMerchantParaElLibro` (`criterioDelMerchant.ts:92`), que hace `merchant.findUnique` sobre la fila VIVA del comercio:
  - `modelo303.repo.ts:24-27`, con `devengo: true`;
  - `librosAeat.repo.ts:49-51`;
  - `paquete.repo.ts:43-50`, las evidencias.
  Los demás no lo pasan y leen siempre por emisión: `libroRegistro.routes.ts:32`, `reports.routes.ts:278` y `:372`, `modelo130.repo.ts:22` y `modelo347.repo.ts:32`.
- **Qué hace el criterio desde 1732d.** Solo el 303 (`devengo: true`) lee por devengo, con `leerPorCaja`. El libro de expedidas sigue yendo por fecha de expedición; con caja, además, adjunta los cobros (`cobrosPorFactura`).

| caso | esperado según c.21789 ③ | lo que hace el código hoy |
|---|---|---|
| sellada con `true`; el comercio pasa hoy a `false` | el 303 la devenga al cobro (tramos o tope); el libro AEAT y las evidencias la llevan con sus cobros | `campo` = emisión: el 303 la cuenta en el trimestre en que se expidió, y sin cobros |
| sellada con `false`; el comercio pasa hoy a `true` | por emisión | `leerPorCaja`: la devenga al cobro o en el tope del 31-dic |
| congelado NULL (emitida antes de 1129, o no es F1); el comercio está en `true` | por emisión | por caja, que es lo que dice el vivo |

**El arreglo.** Toca solo el libro: ni el sellado, ni el builder, ni la cadena, ni el XML, así que no es STOP. Tiene cuatro pasos:

1. Añadir `merchantCriterioCaja` a `CAMPOS_FACTURA`.
2. En `leerPorCaja`, una candidata cuyo congelado no sea `true` devenga en `createdAt`.
3. Con `devengo` y un rango, `leerPorCaja` tiene que correr también cuando el vivo es `false`, y hoy no corre. Eso obliga a una de dos cosas: leer `invoice_payments` también para los comercios sin caja, o preguntar antes si hay alguna factura con el congelado en `true`. Es la decisión de diseño que queda abierta.
4. `cobrosPorFactura` sale de las facturas con el congelado en `true`, no del vivo.

Con esto, `criterioDelMerchant.ts` y sus tres llamadores dejan de decidir. Queda pendiente qué se hace con su comprobación de que el valor vivo se puede leer (`campoDeDevengo` lanza si no): conservarla o retirarla con el arreglo.

**Una pregunta que el GO no contesta.** Una R1 que rectifica una F1 con criterio de caja se queda con el congelado en NULL, porque `verifactu.service.ts:352` solo congela las F1. Con el GO tal como está escrito, esa R1 va por emisión. ¿Es así, o la R1 hereda el criterio de la factura que rectifica? Va al fundador en el comentario de Jira de este tramo.

**Errores míos.** ① Mi primera medida, 102k al acabar el arranque, ya decía que con un tope de 160k no cabía construir el arreglo. No lo dije hasta llegar a 131k. ② Puse la rama al día con `--ff-only` antes de mirar el cliente de Prisma. El avance traía 914d (`Equipment`), que el cliente compartido no tiene, y desde entonces `_prisma-client-guard` sale con código 1 en este árbol. A esta medición no le afecta, pero un `tsc` con tipos aquí fallaría por algo que no es de esta rama.

**Sin medir:** nada ejecutado, ni el libro ni el 303, con un comercio que cambia de criterio · ninguna base · la suite (NO CORRIDA, porque el tramo es solo de documentos) · el test rojo y el arreglo (NO HECHOS: quedan para la siguiente sesión, con este tramo como plan).

## J1 · SCRUM-1730d · (iii) el diseño cerrado y lo que el plan no contaba (el arreglo NO se ha construido)

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:16:52Z (hora de GitHub; sesión J1 `jv-j1jv`, por encargo del orquestador `cobroflash-backend-2d`)

A9: sin fallo que generalice — tramo sólo de medición y diseño, leído en el código; el arreglo no cupo en el tope de 160k del encargo (medido: 104k al acabar el arranque, 137k tras leer el registro, el libro y los fixtures), y se avisó al orquestador antes de empezar a construir.

**Permisos.** GO del fundador SCRUM-1730 c.21789, punto 3: el libro lee el criterio congelado de cada factura, y NULL = por emisión, sin caer al vivo. Decisión c.22620, lo elegido: «La R1 hereda de su F1 (Recomendado)». Los literales están en Jira; aquí van el número y lo que se construye.

**① Cómo enlaza una R1 con su original. Leído en `prisma/schema.prisma`, no tocado.** `Invoice.rectifiesId Int? @map("rectifies_id")`, comentado «factura original a la que rectifica (solo R1)». La herencia se resuelve AL LEER: para cada R1 con `merchantCriterioCaja` NULL, el libro busca la factura `rectifiesId` (con `merchantId` en el `where`, regla 2) y toma su congelado. Si `rectifiesId` es NULL, o la original no aparece, NULL = por emisión. No toca el sellado ni el esquema: no es STOP. **Sin medir:** si alguna R1 apunta a otra R1 (cadena), y cuántas R1 hay sin `rectifiesId`.

**② El paso 3 del plan: se pregunta antes.** Con `devengo` y un rango, antes de elegir camino el libro pide `invoice.findMany({ where: { merchantId, merchantCriterioCaja: true }, select: { id: true }, take: 1 })`. Si no hay ninguna, va por emisión, como hoy. Si hay una, corre `leerPorCaja`, y cada candidata decide por su congelado. Por qué esta y no leer `invoice_payments` para todos:
- **No da falsos negativos.** Para que una factura devengue por caja, ella o la F1 que rectifica tiene que tener el congelado en `true`, y esa F1 es del mismo comercio. Si no hay ninguna, nada devenga por caja, y el camino de emisión da el mismo conjunto en el mismo orden (`createdAt`, después `number`).
- **Es la más barata.** El comercio sin caja, que hoy es la inmensa mayoría, paga una consulta de una fila y sigue por el camino de una sola consulta. Leer `invoice_payments` siempre le añadiría a cada 303 tres consultas de candidatas y una de cobros.
- **Un doble que ignore el filtro sólo da falsos positivos**, y con ellos corre `leerPorCaja`, que sigue decidiendo bien factura por factura.

`campoDeDevengo(rango.criterioCaja)` se queda como comprobación de que el vivo se pudo leer (lanza si no), pero deja de decidir. `'criterioCaja' in rango` sigue marcando qué llamadores preguntan por el criterio (303, libros AEAT, evidencias). Los que no preguntan (pantalla del libro, informes, 130, 347) siguen por emisión y sin cobros: cambiarlos queda fuera de este GO. `cobrosPorFactura` sale sólo de las facturas que devengan por caja, con la R1 heredada incluida.

**③ Lo que el plan de 1730c no contaba: siete tests cambian de lado.** Estos leen el libro, el 303 o los libros AEAT con `criterioCaja: true`, y sus facturas de prueba **no llevan `merchantCriterioCaja`**: `scrum1730-criterio-caja-huecos-declarados`, `scrum1732-cobro-parcial-defecto-declarado`, `scrum1732d-libro-por-tramos`, `scrum294b-devengo-por-cobro`, `scrum294c-criterio-del-merchant`, `scrum1055b-caja-31mar-zona-y-devolucion` y `scrum1445d-bordes-fiscales-en-la-zona`. Con el arreglo, sus facturas llegan con el congelado ausente, que es NULL, y van por emisión: los casos que esperan caja se ponen en ROJO. El arreglo les da `merchantCriterioCaja: true` en la fábrica de facturas, que es lo que la fila real trae desde 1129 para una F1 de un comercio con caja. Así no cambia ningún `assert`, y se declara así en el registro de quien lo construya (regla 41: se cambia el dato que el doble no traía, no lo que el test exige). Recuento: `grep -l criterioCaja` en `tests/` da 21 ficheros, y de ellos 7 llaman al libro con caja. **Sin medir:** que sean los únicos. El recuento casa por nombre de función, y un test que llegue al libro por otra puerta no sale.

**Los casos del test rojo, para quien lo construya** (encargo de hoy; ninguno escrito):
| caso | esperado |
|---|---|
| F1 sellada `true`, comercio hoy `false` | por caja: devenga al cobro, con sus cobros |
| F1 sellada `false`, comercio hoy `true` | por emisión |
| F1 con el congelado NULL | por emisión |
| R1 (NULL) cuya F1 `rectifiesId` está en `true` | por caja, como su F1 |
| R1 (NULL) sin `rectifiesId`, o con una original que no aparece | por emisión |
Con el control positivo sembrado: una F1 `true` cobrada en otro trimestre tiene que moverse. Si no se mueve, el test dice CIEGO. Mutación de catálogo propuesta: en la herencia, devolver siempre NULL; tiene que tumbar el caso de la R1 heredada.

**Errores míos.** ① Leí el libro y los fixtures antes de medirme otra vez. El 137k lo vi después de leer, y no antes, que es cuando se decide si cabe. ② La skill `yaqu-verifactu-sif` se cargó, pero sus tres lecturas previas (`docs/SIF_SPEC_NOTES.md`, U1.3, `docs/AUDITORIA_RRSIF.md`) NO se leyeron, porque no cabían. No hacen falta para este tramo, que no toca código, pero quien construya el arreglo tiene que leerlas antes de tocar `invoicing/`.

**Sin medir:** nada ejecutado · ninguna base · ni el test rojo ni el arreglo (NO HECHOS) · la suite (NO CORRIDA: el tramo es solo de documentos) · si `construirLibroRegistro` trata igual `cobrosPorFactura` ausente que un `Map` vacío. Es lo que decide si el camino «sin ninguna `true`» es idéntico al de hoy para libros AEAT y evidencias.

## J1 · SCRUM-1730e · (iii) PARTE 1 de 2: las facturas de prueba que se leen por caja llevan su congelado (sin tocar `src/`)

**Medido contra:** `origin/main` = `86103cb18c55e289b706cd3b530e717e644d54ca` · 2026-11-24T12:33:45Z (hora de GitHub; sesión J1 `jv-j1jz`, por encargo del orquestador `cobroflash-backend-2d`. La línea base se corrió sobre `2d1ac4c7157e352ba08dd7a06d124977009d84d8`: 0 cambios en `src/` y `prisma/` entre los dos)

A9: sin fallo que generalice — tramo sólo de fixtures de test, con el mismo conjunto de casos en verde antes y después; mi único tropiezo (un commit local «wip» sin carril, hecho para poder mergear) se rehízo antes de empujar y no llegó al remoto, y un mensaje de commit local no lo ve ningún guard del repositorio.

**Por qué.** El libro va a decidir con el criterio CONGELADO de cada factura (GO c.21789 ③; la R1 hereda el de su F1, c.22620), y NULL = por emisión. Estos tests leen el libro con `criterioCaja: true` y sus facturas no llevaban el campo: con el arreglo (1730f, otra sesión) pasarían a emisión. Hoy el libro IGNORA `merchantCriterioCaja` (`Invoice.merchantCriterioCaja`, `prisma/schema.prisma`, leído), así que el control de esta parte es que nada cambie: **los 5 ficheros, 47 casos, 47 pass, 0 fail, 0 saltados, antes y después, con el MISMO conjunto de nombres** (comparado por `diff` de los nombres, no por la cuenta). Ningún `assert` cambia: 0 líneas con `assert` en el diff. Ninguno de los 5 usa `LIBRO_PG_URL`, así que no hay saltados que declarar.

**Fixture por fichero** (cada cambio lleva al lado `// SCRUM-1730e: el congelado de la factura (c.21789 ③); hoy el libro lo ignora`):
| fichero | fixture | cambio |
|---|---|---|
| `tests/scrum1730-criterio-caja-huecos-declarados.test.mjs` | `S1`, `SIN_COBRO` | `merchantCriterioCaja: true` |
| ídem | `S2` y `F-MIXTA` | `true` también (decisión del orquestador, abajo) |
| `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs` | `FACTURA_LIBRO` | `true` |
| `tests/scrum294b-devengo-por-cobro.test.mjs` | `FACTURA` | `true` |
| `tests/scrum1732d-libro-por-tramos.test.mjs` | `FA` | NO se toca: la comparte el caso ③, que va POR EMISIÓN |
| ídem | `FA_CAJA` (nuevo, copia de `FA` con `true`) | la leen ①, ④, ⑤, ⑥, ⑦, ⑧ y el control «sin poder leer invoice_payments» |
| ídem | `F-B` (caso ②) | `true` |
| ídem | `fCaja` (nuevo en ⑨, copia de `F-R` con `true`) | la leen los tres tramos; `f` sin marca se queda para `entera`, que se mide con la caja apagada |
| `tests/scrum294c-criterio-del-merchant.test.mjs` | ninguna | NO se toca: es un censo estático de llamadores de `leerLibroRegistro`, sin facturas (grep de `paidAt`/`findMany`/`number:` da 0 en él y 6 `paidAt` en 294b, el positivo) |

**S2 y F-MIXTA con `true`: por qué** (decisión del orquestador en el encargo). El caso (i) espera que la S2 vaya por emisión por la REGLA S2 «aunque el merchant tenga caja». Sin la marca, con el arreglo iría por emisión por el NULL y no por la regla, y el caso quedaría verde sin medir nada. Lo mismo para la mixta. Va comentado en el test.

**Contradice el tramo 1730d ③**, que pone `scrum294c-criterio-del-merchant` entre los siete que «cambian de lado»: 294c no tiene facturas de prueba (arriba). Los que leen el libro por caja con fixtures son seis, no siete: los cuatro de aquí más 1055b y 1445d.

**El mapa no casaba con el fichero en 1732d ⑨.** Decía «en ⑨ marca también `F-B` y `fCaja`»: `F-B` está en el caso ②, no en el ⑨, y `fCaja` no existía. Lo apliqué con el mismo patrón que `FA`/`FA_CAJA`: `F-B` con `true` en ②, y en ⑨ una copia `fCaja` para las lecturas por caja.

**Para quien construya 1730f (no lo he cambiado: ningún `assert` se toca).** Dos controles leen la MISMA factura ya marcada SIN pasar `criterioCaja` y esperan emisión: el «CONTROL NEGATIVO» de 294b (`FACTURA`, Q1 sí y Q2 no) y el positivo sembrado `sinCaja` de `medirLibro` en 1732 (`FACTURA_LIBRO` en el T1). Siguen en verde con el arreglo sólo si un rango SIN `criterioCaja` sigue yendo por emisión diga lo que diga el congelado. Si el diseño hace mandar al congelado también sin `criterioCaja`, esos dos necesitan su copia sin marca, como `FA` en 1732d.

**PARTE 2 pendiente:** `tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs` (tiene una R1: puede necesitar `rectifiesId`) y `tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs`.

**La rama lleva también 1730c y 1730d** (nació de `scrum-1730d-libro-criterio-congelado-construido`): 1730c tiene PR propio abierto (#3385) y 1730d no tenía ninguno.

**Verde antes de empujar:** los 5 ficheros de arriba (47/47, antes y después) · `scrum1415`, `scrum1294`, `scrum267`, `scrum854` y `scrum719`: 67 casos, 67 pass, 0 fail, 0 saltados · `npm run guards:entrada`: 16 guards, 177 casos, 177 pass, 0 fail, salida 0. TAP y salidas a fichero fuera del árbol, leídos en un segundo comando.

**Sin medir:** el arreglo (1730f, NO HECHO), así que nada aquí demuestra que estos fixtures basten con él; la suite entera (NO CORRIDA: el encargo dice no correrla); 1055b y 1445d (PARTE 2).

### Parte 2 de 2: 1055b y 1445d (sesión J1 `jv-j1kb`, sin tocar `src/`)

Medido sobre `origin/main` = `2ee08d25c7bee09a3f8cb3a63b98e42868a56426` · 2026-11-24T12:40:23Z (hora de GitHub). La rama nace de la punta de la parte 1 (`26049dce877c61273d2fd7b87a52152db03e4aa3`).

A9: aviso → cicatriz J1 «Con la orden de empujar a 130k, me medí al acabar la primera tanda y ya estaba en 132k sin haber empujado: del arranque (103,5k) a esa tanda subí 29k sin medirme» — no se pudo comprobar: el umbral de un encargo vive en su prompt y ningún hook ni guard lo lee.

**Control:** los 2 ficheros, 15 casos, 15 pass, 0 fail, 0 saltados, antes y después, con el MISMO conjunto de nombres (`diff` de los nombres; su control: quitar un nombre da «distinto»). 0 líneas con `assert` en el diff (positivo: 6 con `merchantCriterioCaja`).

**Fixture por fichero** (mismo comentario que en la parte 1):
| fichero | fixture | cambio |
|---|---|---|
| `tests/scrum1055b-caja-31mar-zona-y-devolucion.test.mjs` | `F-10551` (caso ①) | `f` NO se toca: la lee el control por emisión (`caja: false`); `fCaja` nuevo, copia con `true`, para la lectura por caja |
| ídem | `F-10552` (① control) y `F-10553` (`medirBorde`, ②) | `true`: sólo se leen por caja |
| ídem | `F-10554` (③, la F1) | `true` |
| ídem | `R-10555` (③, la R1) | `rectifiesId: f1.id`, sin congelado propio: hereda el de su F1 (c.22620) |
| `tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs` | `A-1` y `N-2` | `true`: `numerosEn` siempre lee con `criterioCaja: true` |

**Quién lee `rectifiesId` hoy en ese camino:** nadie. El cierre de imports relativos de `libroRegistro.repo.ts` son 9 ficheros de `src/`, y 0 contienen `rectifiesId` (positivo: 3 contienen `paidAt`; desde `invoicesAdmin.routes.ts` el mismo barrido encuentra 3 con `rectifiesId`). Tampoco `merchantCriterioCaja`: 0 de 9. Los casos de des-pagar (③) no pasan sus facturas por el libro.

**Casos dudosos (③ del encargo):** ninguno. En los dos ficheros, cada lectura dice si va con `criterioCaja` o sin él.

**Para quien construya 1730f.** En ③ de 1055b, la R1 cae en el T2 tanto por caja como por emisión (su `paidAt` es su `createdAt`), y la F1 cae en el T1 de las dos maneras. Así que ese caso NO mide la herencia por `rectifiesId`: hace falta un caso propio en el que caja y emisión den trimestres distintos.

**Verde antes de empujar:** los 2 (15/15, antes y después) · los 5 de la parte 1 más 1415, 1294, 267, 854 y 719: 10 ficheros, 114 casos, 114 pass, 0 fail, 0 saltados · `npm run guards:entrada`: 16 guards, salida 0.

**Sin medir:** la suite entera (NO CORRIDA, por encargo) y el arreglo 1730f (NO HECHO).

## J1 · SCRUM-1730f · (iii) CONSTRUIDO: el Libro registro decide factura por factura con el criterio congelado, y la R1 hereda el de su F1

**Medido contra:** `origin/main` = `3bbce2b4045d2065da480af9c3564843e410e454` · 2026-11-24T12:55:02Z (hora de GitHub; sesión J1 `jv-j1kc`, por encargo del orquestador `cobroflash-backend-2d`)

**Permisos:** GO del fundador SCRUM-1730 c.21789 ③ (el libro lee el congelado por factura; NULL = por emisión, sin caer al vivo) y decisión c.22620 («La R1 hereda de su F1»). Los literales los tomé del encargo del orquestador: **no he releído Jira** (el encargo lo prohibía para caber en el tope), así que no están cotejados byte a byte. El camino de sellado no se ha tocado: el diff es `libroRegistro.repo.ts` (lector, sólo lectura) y un test nuevo.

**Qué:** `merchantCriterioCaja` y `rectifiesId` entran en `CAMPOS_FACTURA`. `hayFacturaPorCaja` (un `findMany` con `take: 1`) decide si hay camino por caja: con la clave `criterioCaja` y al menos una factura sellada en `true`, corre aunque el vivo sea `false`; si no hay ninguna, el libro es el de siempre, por emisión. `idsPorCaja` decide cada factura: `true` → por caja; `false` o NULL → por emisión, entera; una R1 sin congelado propio coge el de su F1 por `rectifiesId` (segunda consulta acotada a esos ids y al comercio). `cobrosPorFactura` sale sólo de las de caja. El vivo se sigue leyendo con `campoDeDevengo` para que una lectura fallida LANCE.

**Ausente frente a `Map` vacío** (lo que j1jv no midió): NO son iguales. Con un `Map`, `construirLibroRegistro` añade `cobrosSinMedio` y `cobradoDeMas` (`libroRegistro.ts:347`); los `cobros` de cada asiento salen siempre. Por eso, con ninguna factura en `true`, `cobrosPorFactura` se queda `undefined`, y el test lo ata comparando el libro entero con vivo `true` y con vivo `false`.

**Esperado · visto:** `tests/scrum1730f-libro-decide-por-factura.test.mjs`, 7 casos. Antes del arreglo: 7 de 7 en rojo, todos por el control positivo («CIEGO: la F1 sellada por caja no se ha movido»). Después: verdes. Con el test nuevo, los de los fixtures (1730, 1732, 1732d, 294b, 294c, 1055b, 1445d), `scrum296-lector-tenencia` y los que nombran `libroRegistro`, `devengoPorCaja`, `modelo303` o los libros AEAT: **56 ficheros, 550 casos, 546 pasan, 0 fallan, 4 saltados** (los gateados por base). Compilado con tipos (`tsc -p .`): salida 0. Medido ANTES de `git merge origin/main`; el merge entró sin conflictos.

Mutaciones: catálogo → `tests/scrum1730f-libro-decide-por-factura.test.mjs`. En la herencia, devolver siempre NULL: cae sólo el caso «R1 hereda», corrido una vez a mano.

**Tras el merge, con este tramo dentro:** el test nuevo con 1415, 1294, 267, 854 y 719: 6 ficheros, 74 casos, 74 pasan, 0 fallan. `npm run guards:entrada`: salida 0 (16 guards).

**NO medido:** la suite entera (orden del encargo: no correrla), ni los 5 guards de árbol entero que `guards:entrada` manda correr a mano (SCRUM-1560); `censo:mudez` no corrido; ninguna base real (los de Postgres, saltados).

A9: sin fallo que generalice — el arreglo cupo justo: el arranque se comió 105k de 165k (medido) y el test nuevo, el arreglo y su mutación salieron en una pasada, sin una segunda lectura del libro.
