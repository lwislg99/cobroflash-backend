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
