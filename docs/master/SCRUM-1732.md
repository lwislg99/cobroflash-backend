# SCRUM-1732 · Criterio de caja y cobro parcial: la retención de garantía y el 100 % en el primer cobro

## J1 · SCRUM-1732 · opción C: el defecto declarado y fijado con el código real

**Medido contra:** `origin/main` = `8c61c10e34728282942cb896151cfde331a26072` · 2026-11-13T17:06:42Z (hora de GitHub; sesión J1 `jv-j1eo`, por encargo del orquestador `cobroflash-backend-63`)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

**Qué es.** La medición ejecutada es de `jv-j1em` (SCRUM-1732 c.21820). La decisión de Javier está en c.21824: **«C ahora + A antes de caja»**, y B queda descartada. Esto es la C: un test `DEFECTO_CONOCIDO` que fija lo medido, **sin tocar `src/`, ni el esquema, ni ninguna base** (reglas 38 y 40). La sonda de c.21820 se quedó fuera de git, así que aquí se rehace y se sube: `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs`.

**Cómo mide.** Ejecuta tres piezas reales de `dist/` contra una base en memoria con estado:

- el webhook `POST /webhooks/psp` (`psp.routes`);
- `POST /admin/charges/:id/garantia` y `/:id/garantia/liberar` (`chargesAdmin.routes`, SCRUM-1107);
- `leerLibroRegistro` con `criterioCaja: true`.

El caso: una factura F-1732 de 1.000 € con su enlace de pago (un `Charge` de 1.000 €). El cliente paga 950 € por Bizum, con fecha declarada del 31-mar-2026, y retiene el 5 %. Después se declara la retención y se libera.

**Los cuatro huecos, fijados** (los cuatro salen DEFECTO, 9/9 casos en verde):

| hueco | lo que sale hoy |
| --- | --- |
| (a) pagada al 100 % | el webhook con `amount: 950` deja la factura `paid` y el `Charge` en `1000.00`, y no escribe nada más: la misma huella que con 1.000 |
| (b) liberación sin enlace | `Charge` 1733 de 50 €, `paid`; 0 escrituras en `invoice`; su evento lleva `{tipo: 'liberacion_garantia_obra', chargeOriginalId: 1732}` |
| (c) el libro, el 100 % de golpe | un solo asiento, en el T1-2026, con base 826,45 y total 1.000; ningún otro trimestre tiene nada |
| (d) cobros que suman más | `Charge` pagados del cliente: 1732 = 1000.00 y 1733 = 50, que suman 1.050 para una factura de 1.000 |

**Lo que NO está aquí.** La factura recibe `paidAt = new Date()`: es SCRUM-1735 (J2, GO en c.21824 ②). El test no mira nunca ese `paidAt`, y el libro se alimenta con una factura fabricada cuyo `paidAt` es el del cobro.

**Mutaciones** (`MUTACIONES_QUE_ME_TUMBAN`, pasadas una a una con `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`): **6 de 6 vivas**, con la pasada limpia en 9/9 y el árbol restaurado (`git status` vacío). Las seis son:

- el webhook no marca pagada una factura si el importe no llega (a);
- la liberación escribe en la factura (b);
- la caja desconectada (c);
- la liberación con importe 0 (d);
- retirar la declaración de (a);
- retirar la declaración de (c).

**Error mío, cazado por el instrumento.** En la primera pasada, la mutación «caja desconectada» salió **MUDA**: el caso se emite y se cobra en el mismo T1, así que filtrar por emisión da lo mismo. Le faltaba a (c) un control positivo de que la caja está ENCENDIDA. Lo añadí sembrado (la misma factura cobrada el 20-may tiene que salir en el T2), y la mutación pasó a viva. Lo cazó el arnés de la casa, que es la comprobación de la línea `A9:`.

**Qué tendrá que cambiar cuando llegue A** (tabla de cobros por factura: decisión → ALTER aditivo en las 3 bases → un PR, orden A5). Está escrito también en la cabecera del test:

1. Retirar de `DEFECTO_CONOCIDO` la entrada de cada hueco que A arregle, en el mismo cambio.
2. Enseñar a `baseConEstado` el modelo nuevo. Hoy, una escritura a un modelo desconocido se apunta en `otrasEscrituras`, y eso pone en ROJO (a) y (b).
3. Rehacer la medida de (c) contra la tabla de A. Lo que tiene que salir: 950/1.000 de la base en el T1 y 50/1.000 en el trimestre de la liberación. El tope del 31-dic para lo retenido es la pregunta 4 al asesor, en c.21820.
4. Si A deja (d) así a propósito, reescribir su entrada con el motivo; no borrarla a secas.

**Sin medir.** Ninguna base de datos. `mpWebhook.routes.ts` y el marcado manual (`invoiceAdmin.ts`) no se ejecutan aquí. Tampoco se ejecutan el 303 ni los libros AEAT con este caso, ni `ensureInvoiceForCharge`: se dobla para que lance, así que solo corre el marcado «P0-3» del webhook. El cliente de Prisma de este árbol va por detrás del esquema (`Job.queHayQueHacer`, según `_prisma-client-guard`), pero el test no lo usa, porque la base va doblada.

No se cierra (A13): queda A.

## J2 · SCRUM-1732c · opción A, PR-1: la tabla `invoice_payments` y sus escritores

**Medido contra:** `origin/main` = `6c5327559bb8e17f1ecad128f99331ee16b31a2f` · 2026-11-18T04:35:14Z (hora de GitHub; sesión J2 `jv-j2d0`, relevo 4 de `jv-j2c7`, `jv-j2c8` y `jv-j2c9`)

A9: comprobación → `tests/scrum1732c-escritores-invoice-payments.test.mjs`

**Qué es.** El PR-1 de la opción A, con las decisiones y los 7 textos firmados de c.21928, el ALTER aplicado en las tres bases (c.21940) y el orden A5. Modelo `InvoicePayment` → `invoice_payments`: una fila por cada dinero que entra y se atribuye a una factura. Append-only: una fila mal apuntada se anula con otra (`tipo = 'anulacion'`, `anula_id`). `Charge.amount` pasa a ser «lo pedido» y la tabla «lo cobrado» (c.21928 ②; la cabecera de SCRUM-1107/397 en `schema.prisma` lo dice). `Invoice.status` no cambia (V1).

**Escritores** (todos por `src/modules/billing/domain/cobrosDeFactura.ts`, idempotente por el único `(invoice_id, charge_id)`): `/webhooks/psp` (los dos marcados), `confirm-bizum` (importe declarado), `mpWebhook`, `/garantia` (409 si el cobro no está `paid` o cobrado + retenido ≠ total), `/garantia/liberar` (fecha declarada, fila `liberacion_garantia` con el `invoice_id`), el marcado manual y `/bulk-paid` (cruce J2→J1) y `/invoice/:id/paid-webhook`, que **se queda y apunta su fila** (lo miden `scrum1455b/c`; c.21947). **Los lectores no cambian: el devengo por tramos es el PR-2, de J1.** Cruces declarados en los commits: J1 (`invoiceAdmin.ts`, `invoicesAdmin.routes.ts`, `invoice.routes.ts`) y J3 (`ORDEN_BORRADO_MERCHANT`), autorizados por el orquestador J el 16-nov.

**Medido (ejecutado).** Tests de los escritores 13/13 y `scrum1732` 10/10, con mutaciones 11/11 y 7/7 vivas (jv-j2c8, c.21947). Tras el merge de `origin/main` `6c5327559`: tipos con un cliente Prisma propio en el temporal, salida 0; con el compartido (sin `invoicePayment`), salida 2 y 10 errores, todos de la tabla nueva. **Suite entera, 15 tramos de 113 ficheros**, uno por comando. Rojos míos que cazó y ya están arreglados en esta rama: `scrum1480f` (script nuevo declarado en `_sin-fila-declarados.json`), `scrum172` (`invoicePayment` en el fixture de merchant), `scrum241` (el backup lógico vuelca `invoice_payments`), `scrum289` (`facturaDelCobro` censada CLAVE), `scrum411` (dos conjuntos sin `export`; `esPaidViaValido` ya se consume y sale de los huérfanos), `scrum497/1547` (tres columnas de texto NO personales) y `scrum525d` (dos anclas de la auditoría que el esquema desplazó). Rojos que no son de código: el cliente Prisma compartido (`235`, `244`, `461`, `498` y el control de `241`), `1298b`, `351` y `932` (esta máquina), `1101` (intermitente: 11/11 suelto) y `854` (este registro).

**`scrum601`, re-anclado con permiso del fundador (c.22001).** El texto 7 firmado (`TEXTO_GARANTIA_NO_CUADRA`, `chargesAdmin.routes.ts:31`) sube los literales «a pelo» de 162 a 163 y los no legibles de 40 a 41. El primer intento de editarlo lo denegó el clasificador de permisos de la sesión y no se rodeó: se pidió (c.22000) y Javier dijo «Sí» con tres condiciones (c.22001). Las cifras salen de `censoCopy` sobre el árbol fusionado (`{ flag: 8, tipo: 11, aPelo: 163 }`, suman 182 de 182; 41 no legibles; el único literal nuevo en las dos listas es `chargesAdmin.routes.ts:31`). El diff de `tests/scrum601-copy-del-documento-vs-flag.test.mjs`, entero: `VEREDICTO_AL_MEDIR` pasa de `{ flag: 8, tipo: 11, aPelo: 162 }` a `{ flag: 8, tipo: 11, aPelo: 163 }` y `NO_LEGIBLES_AL_MEDIR` de `40` a `41`, cada uno con su línea de motivo `162 → 163 · 18-nov-2026 (SCRUM-1732c) · …` y `40 → 41 · …` encima. Nada más del guard cambia (12 líneas añadidas, 2 quitadas). Con eso, 5/5.

**Sin medir.** Ninguna base (staging y producción: los midió Javier, c.21940). El obligatorio de CI. yaqu.app. Que la limpieza del fixture de merchant borre bien las filas de anulación que se apuntan a sí mismas por `anula_id` con FK RESTRICT: solo corre en los tests con base.

No se cierra (A13): queda el PR-2 (J1) y la UI de los textos.

**Apéndice · relevo `jv-j2d2` · el veredicto de mudez regenerado** (2026-11-18 ~05:25Z, hora de GitHub; sobre `origin/main` `65b2e3b2a03a4a5cb6119b9b7e33465b89494769`, mergeado en esta rama). El obligatorio de `67638f7ce` (run 44240157181) dio 13.778 tests y **1 fallo**: `SCRUM-1395b · ①` en `tests/scrum719-el-suelo-de-los-doce.test.mjs`, «el veredicto de mudez no cubre el árbol de hoy». Reproducido en local tras el merge (37 = 36 + 1): la única ficha caducada era `scrum601-copy-del-documento-vs-flag.test.mjs` · «el fichero cambió desde la medida». La caducó **el re-anclaje de `scrum601` de esta misma rama** (c.22001), no el merge con main: corrijo aquí la premisa del encargo, que decía «caduca con el merge». Regenerado con el guion de la casa, `npm run censo:mudez -- --escribir`: midió 1 de 132, VIVO, `_guard-texto.mjs` comprobado idéntico. El diff de `tests/_veredicto-mudez.json` es una línea: la huella de `scrum601` pasa de `19d77490afa78381` a `3672b49d67d06312` y la clase sigue en VIVO. Después, `scrum719` 37/37. El merge de main (7 commits: 1743 y 1445f) entró sin conflictos y sin ningún fichero en común con la rama (27 de main, 29 de la rama, intersección vacía). Tipos con cliente Prisma propio en el temporal: salida 0; control con el compartido: salida 2, 10 errores, todos de `invoicePayment`. El cliente compartido no cambió (sha256 del `index.js` igual antes y después). Lo que no vio `jv-j2d0`: tras re-anclar `scrum601`, su tanda dirigida no incluía `scrum719`, y un test que se toca caduca su ficha en el veredicto guardado. La comprobación ya existía y lo cazó, pero en CI, no en local. **Sin correr:** la suite entera (la corrió `jv-j2d0`, 15/15, antes del segundo merge; CI la corre), ninguna base y yaqu.app.

A9: comprobación → `tests/scrum719-el-suelo-de-los-doce.test.mjs`

## J1 · SCRUM-1732d · PR-2: el libro con criterio de caja según U′ y el 303 por tramos

**Medido contra:** `origin/main` = `bcff9d8b1ea465938ef797c17548cb5217de02bc` · 2026-11-18T15:26:17Z (hora de GitHub; sesión J1 `jv-j1fd`, por encargo del orquestador `cobroflash-backend-ee`)

A9: comprobación → `scripts/meta-guard-mutaciones.mjs`

**Diseño:** U′ (c.22012, ✅ del fundador en c.22014) + Q3–Q6 de c.22007; lectura legal de J5 en c.22011 (tramo 1264v de `docs/master/SCRUM-1264.md`). Construir hoy: confirmado por el fundador («sí», publicado por el orquestador tras c.22014).

**Qué cambia (solo lectores; ni emisión, ni sellado, ni esquema):**
* `libroRegistro.repo.ts` · el libro de expedidas va por fecha de EXPEDICIÓN también con caja (RIVA 69.5): un asiento por factura, entero (63.3), con `cobros: [{ fecha, importe, metodo, origen }]` leído de `invoice_payments` sin anuladas ni anulaciones (61 decies.1; Q4). Con caja el libro declara además `cobrosSinMedio` (Q3) y `cobradoDeMas` (Q5). Sin caja: `cobros: []` y nada más.
* `leerPorCaja` alimenta SOLO al libro que pide `devengo: true`, que es el del 303 (`modelo303.repo.ts`). Candidatas: las tres tandas de siempre más las facturas con un tramo de `invoice_payments` en el rango. Cada factura con filas devenga por TRAMOS (`tramosDeDevengo` en `devengoPorCaja.ts`): cada fila viva en su `fechaCobro` hasta lo que falte para el total, y el resto en el tope del 31-dic X+1. Los importes del asiento del 303 son la prorrata de `porTipo` (y `suplidosPorTipo`) de los tramos del trimestre, con el último tramo como resto (c.21926). Sin filas, con S2 o con un total que no es positivo legible: la regla de una fecha de siempre (c.21926 §①; la R1 no se toca).
* Un cliente sin `invoicePayment` con criterio de caja hace LANZAR al libro: «no pude leer los cobros» no se convierte en «no hubo cobros».
* **Tercer consumidor de `leerPorCaja`, no nombrado en c.22012:** las evidencias (`src/modules/fiscal/evidencias/paquete.repo.ts:50`). Su libro es el de expedidas (`soloFacturas`) y sigue la expedición como `librosAeat`; su 303 interno es `leerModelo303` y va por tramos. Lo acordó el orquestador antes de construir.
* Q6: la garantía retenida sin liberar devenga en el tope y su liberación posterior al tope no vuelve a devengar. Pregunta 49 del asesor sin respuesta: `DEFECTO_CONOCIDO.garantiaRetenidaAlTope` en `tests/scrum1732d-libro-por-tramos.test.mjs`.

**Tests:** `tests/scrum1732d-libro-por-tramos.test.mjs`, 10 casos (dos tramos T1/T2, sin filas, criterio general, sin medio, anulación, cobrado de más, retenida al tope, zona de Madrid frente a UTC, redondeo en tres tramos, y el control de que lanza sin `invoice_payments`). Rojo primero: 10/10 en rojo contra el código de main y 10/10 en verde después. En `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs` se RETIRA el hueco (c) (`libroCienDeGolpe`): su caso exige ahora el arreglo (950 en T1 y 50 en T4 en el 303, y la factura entera en el libro de expedidas del T1). En `scrum1055b`, `scrum1445d`, `scrum1730` y `scrum294b` la base en memoria gana `invoicePayment` (sin filas) y sus llamadas con caja piden `devengo: true`, porque lo que miden es el devengo. Ninguna aserción cambia de valor. Los nueve ficheros de caja: 75/75.
Mutaciones: catálogo → tests/scrum1732d-libro-por-tramos.test.mjs
Mutaciones: catálogo → tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs
Las 11 tumban con `correr` + `aplicarUna` del runner de la casa.

**Mis errores, contados:** (1) mi driver de mutaciones le pasó a `correr` la ruta con `tests/` delante y las 12 salieron CIEGAS, también (a) y (b) de main. Lo cazó la línea base del runner, que no muta si el test no sale en verde limpio. (2) Dos mutaciones salieron MUDAS: «sin tope de lo cobrado» (mis dos cobros caían en el mismo trimestre, y el resto del último tramo lo tapaba: el segundo cobro va ahora al T2) y «el 303 sin `devengo`» en el test de la opción C (su medida no pasa por `leerModelo303`; la retiré y la cubre el test nuevo). (3) Un heredoc con acentos reventó al escribir el parche (cicatriz conocida); no dejó nada escrito.

**Sin correr / sin medir:** ninguna base real, ni staging ni yaqu.app (`INVOICING_ES_ENABLED` OFF: sin víctima). La pantalla del libro (`libroRegistro.routes.ts`) no pasa el criterio y no cambia: **no muestra** `cobros` ni los avisos, y el aviso de «tramo sin medio» es texto nuevo que espera firma (Q3). `librosAeat` no pinta los cobros en sus filas: el literal no dice dónde (c.22011). LIVA 164/167 y RIVA 71, sin leer (J5).

No se cierra (A13).

### J1 · SCRUM-1732d · relevo: los rojos del obligatorio de ce969687b (run 44336229482)

**Medido contra:** `origin/main` = `34939a6ad7c0ad7abc4f06e34e92b43fd519400b` · 2026-11-18T16:06:49Z (hora de GitHub; sesión J1 `jv-j1fh`, relevo de `jv-j1fd`, por encargo del orquestador `cobroflash-backend-ee`)

A9: comprobación → `tests/scrum757-la-declaracion-que-nadie-lee.test.mjs`

Seis rojos del obligatorio, tres causas, todas en tests (ni `src/` ni guards tocados):
- `scrum1415`, `scrum757`, `scrum745`, `scrum765`: en `tests/scrum1732d-libro-por-tramos.test.mjs` el nombre del caso ① vivía en una constante (`CASO_A`), y la usaban el `test()` y dos `cae`. El lector de declaraciones solo lee literales y el censo de nombres construidos solo acepta nombres escritos: ahora los tres son el literal. Visto en rojo en local con el fichero de ce969687b (4 de 4) y en verde con el arreglo.
- `scrum836` · SCRUM-1321 (ancla ambigua): la declaración «`fechaDeDevengo` no pasa la zona al tope» de `tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs` anclaba a una línea que el PR-2 repite en `devengoPorTramos` (`devengoPorCaja.ts`, líneas 116 y 185). El ancla lleva ahora la línea siguiente de `fechaDeDevengo`, y sigue tumbando su caso.
- `scrum810` (suelo contra la base de fusión): `tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs` bajaba de 7 a 6 declaraciones al retirar «se retira la declaración de (c)», que murió con la declaración. No se apunta en `RETIRADAS_A_PROPOSITO`: se repone la vigilancia con una mutación del ARREGLO (el libro de expedidas vuelve a anotar por cobro → (c) deja de salir ARREGLADO). Vuelve a 7.

Mutaciones: catálogo → tests/scrum1732d-libro-por-tramos.test.mjs
Mutaciones: catálogo → tests/scrum1732-cobro-parcial-defecto-declarado.test.mjs
Mutaciones: catálogo → tests/scrum1445d-bordes-fiscales-en-la-zona.test.mjs
Las 20 de los tres ficheros (5 + 7 + 8) tumban su caso con `correr` + `aplicarUna` del runner de la casa; ninguna muda ni ciega. Censo `--solo-censo`: 1.236 declaraciones, 0 ilegibles.

**Mis errores, contados:** el encargo me nombraba solo el fichero 1732d, y `scrum836`/`scrum810` no estaban en mi tanda dirigida: los vi al leer el log del job, no corriendo. Mi primer parche del ancla de 1445d escribió un salto de línea real en vez de `\n` dentro del literal (lo vi en el diff antes de correr nada).

**Sin correr:** la suite entera (la corre CI). El job «guards de navegador» (`guard:escalera-por-estado`) cae también en #3201: no es de este PR y no se ha tocado.

## J2 · SCRUM-1732f · la cuenta QA de STAGING se queda sin vías de aviso y con el Bizum manual encendido (operación, no código)

**Medido contra:** `origin/main` = `6cabd3d42c1e0c7ba531a91ab94471c17c288949` · 2026-11-19T18:00:42Z (hora de GitHub; sesión J2 `jv-j2d8`, por encargo del orquestador `cobroflash-backend-c7`)

A9: aviso → cicatriz J2 «leí el `.env` de staging con un regex de claves `[A-Z_]+`, sin dígitos: `E2E_TEST_LOGIN_SECRET` no casó y el login QA salió 404 con el secreto vacío» — no se pudo comprobar: el lector vive en el temporal de la sesión y ningún guard ve cómo una sesión lee su `.env`

Aplica el ✅ del fundador de **c.22165** («OK» a la pregunta de jv-j4bs en c.22158): SOLO staging, SOLO el comercio 2
(`qa@staging.yaqu`). `src/` no se toca. Staging `/health`: `version` = el mismo sha, `db: up` (17:59:28Z).

### 1 · Antes → después

| dato | ANTES | DESPUÉS | de dónde |
|---|---|---|---|
| ① cliente de prueba sin teléfono ni correo | no había (el 49 «Cliente QA» tiene teléfono y correo) | **id 3936 «Cliente QA sin avisos»**: `phone`, `mobile` y `email` vacíos | `GET /admin/customers` |
| ② `notifyEmailOnPaid` | `true` | **`false`** | `GET /admin/merchant` y columna `notify_email_on_paid` |
| ③ `merchants.flags` (fila id=2) | `{"INVOICING_ES_ENABLED": true}` | `{"BIZUM_MANUAL_ENABLED": true, "INVOICING_ES_ENABLED": true}` | `SELECT` de la fila |
| ③ `BIZUM_MANUAL_ENABLED` efectivo | OFF | **ON** | `isFlagEnabled` de `dist/core/flags.js` sobre la fila leída |
| `whatsappPhone` del comercio | presente | presente (**no se tocó**) | `GET /admin/merchant` |
| cliente 49 | teléfono y correo | igual (no se tocó) | `GET /admin/customers` |

Evidencias (sin secretos, sin teléfonos: solo «presente/vacío»): `evidencias/SCRUM-1732/1732f-antes.json` y
`evidencias/SCRUM-1732/1732f-despues.json`.

### 2 · Cómo se hizo (comandos sin secretos)

1. PASO 0: sin ramas `scrum-1732f*` en el remoto ni PR; turno de staging LIBRE.
2. Login: `POST /auth/test-login` con `qa@staging.yaqu` y el secreto del `.env` del árbol, leído por código: 200 + cookie.
3. ① El 49 no se podía editar quitándole los datos: `customerUpdateSchema` es `phone/mobile: z.string().min(5).optional()`,
   `email: z.string().email().optional()`, sin `nullable()` (`schemas.ts:547-565`), así que la ficha no deja borrarlos.
   Se creó uno nuevo: `POST /admin/customers {"name":"Cliente QA sin avisos"}` → 201, id 3936. `createCustomer` no envía nada (leído).
4. ② `PUT /admin/merchant {"notifyEmailOnPaid": false}` (nada más: lo ausente no se toca) → 200.
5. ③ **No hay ruta ni guion para `BIZUM_MANUAL_ENABLED`**: el único escritor de `merchants.flags` en `src/` es
   `flagFiscal.service.ts:136`, y él y `cambiar-flag-fiscal.mjs` solo admiten `INVOICING_ES_ENABLED|SIF_ENABLED`
   (`FLAGS_FISCALES`). Por eso, UPDATE del JSONB, con el turno (`turno-staging.mjs tomar --base staging --ref SCRUM-1732f`,
   17:59:40Z) y la URL de `DATABASE_URL_STAGING` pasada solo a ese proceso, detrás de
   `exigirDestinoCorrecto('DATABASE_URL_STAGING', …)` (`_clave-vs-destino.mjs`), que dijo `acela…/railway (STAGING) ✅`:
   `UPDATE merchants SET flags = COALESCE(flags,'{}'::jsonb) || '{"BIZUM_MANUAL_ENABLED": true}'::jsonb WHERE id = <id> AND email = 'qa@staging.yaqu' RETURNING id, flags`
   - control negativo, antes: con `id = 999999` → **0 filas**;
   - el real, con `id = 2` → **1 fila**, con el JSON de la tabla. El resto de claves se conserva (`||` fusiona).
   - Turno soltado (`soltar --base staging`), y `estado` da LIBRE. Mi primer `soltar` fue sin `--base` y apuntó a la base por defecto: no soltó nada ni quitó nada a nadie.
   - Sin fila de auditoría `cambio_flag`: esa la escribe solo el servicio fiscal. El rastro es este tramo.

### 3 · Lo que NO está hecho o no está medido

- 🔴 **El WhatsApp al PROFESIONAL sigue siendo una vía viva.** `psp.routes.ts:383` llama a `notifyMerchantPaid` sin
  condición propia, y `notifyMerchantAlert` solo se para si `whatsappPhone` está vacío (`whatsappNotifications.ts`), y en el comercio 2 está presente.
  No lo quité: no está en la lista ①②③ de c.22165 (aunque su pregunta decía «sin aviso al profesional»), y la ruta
  del panel no deja vaciarlo (`whatsappPhone: z.string().min(6).max(20).optional()`, `schemas.ts:468`): haría falta otro UPDATE
  directo. Si staging tiene credenciales de Meta, **no lo sé**: `/health` solo da `ok service version db dbMs`.
  Hasta que se decida, **un confirm-bizum en la QA puede mandar un WA al número del profesional.** Al cliente 3936 no
  le llega nada: ni confirmación (`tieneNumeroDeContacto`) ni reseña.
- Hallazgo de paso (J2, sin arreglar porque el encargo no toca `src/`): `GET /admin/me` (`app.ts:484`, `:495`) y
  `GET /admin/connect/status` (`connect.routes.ts:23`) calculan `BIZUM_MANUAL_ENABLED` con un `merchant` **sin `flags`**,
  así que no ven el override por comercio: con ③ aplicado, el panel puede decir que el Bizum está apagado. `confirm-bizum`
  (`chargesAdmin.routes.ts:74`) sí carga `flags`, y es la puerta que usa CIERRES. Leído en el código, no visto en pantalla.
- Ninguna factura, cobro ni envío: la F1 nueva con cobro parcial, el libro con `cobros[]` y el 303 por tramos son de CIERRES 14.
- `dist/` para leer `isFlagEnabled`: `tsc -p . --noCheck` local (no se empuja). Ni `prisma generate` ni nada contra producción.
## J5 · SCRUM-1732e · la R1 de una factura sin cobrar con criterio de caja: lo que dice la norma

**Medido contra:** `origin/main` = `d4a0fc951cd54405d6e9ae908a7b52b12b26c024` · 2026-11-19T17:40:04Z (hora de GitHub; sesión J5 `jv-j5bl`, por encargo del orquestador `cobroflash-backend-c7`)

A9: sin fallo que generalice — lectura de norma con su control positivo y cero por bloque; el único tropiezo fue pasar el tope de contexto del encargo (150k), y lo dije al cruzarlo, no al entregar

Solo documentos. Ni código, ni esquema, ni el camino de emisión. No es respuesta de asesor (reglas 17 y 26). El detalle y los literales están en Jira, SCRUM-1732 c.22167.

**La observación (c.22158):** con caja, la R1 `2026-QA-R-001` de la F1 `F260001`, que está sin cobrar, devenga en el 303 de 4T-2026 (cuota −11,27), y la F1 devenga en 4T-2027, en el tope.

**Fuente:** API de legislación consolidada del BOE. Siete bloques, todos `200`, `Date:` del BOE Thu, 19 Nov 2026 17:39:09 GMT. De cada uno, la última versión:

| bloque | vigente desde | sha256 (16) | positivo | cero (`SCRUM-`) |
| --- | --- | --- | --- | --- |
| LIVA `a163terdecies` | 20140101 | `6c48644a55e27cdc` | «31 de diciembre» ×2 | 0 |
| LIVA `a80` | 20230101 | `ef0f25c43a9fa2ad` | «base imponible» ×19 | 0 |
| LIVA `a89` | 20150101 | `cc6137a9c5548155` | «rectificaci» ×15 | 0 |
| LIVA `a163decies` | 20140101 | `87b9970a67d75a41` | «caja» ×3 | 0 |
| RIVA `a24` | 20240101 | `bf85c50c9e484b03` | «rectificaci» ×2 | 0 |
| RIVA `a61decies` | 20140101 | `63a6080bbdd08f46` | «cobro» ×3 | 0 |
| RIVA `a61septies` | 20140101 | `1b530870545e3d5f` | «caja» ×1 | 0 |

**Veredicto: (c). La norma leída no lo fija, y la pregunta es para el asesor.**

- LIVA 89.Cinco b) manda la minoración a la «declaración-liquidación correspondiente al periodo en que deba efectuarse la rectificación», pero habla de «cuotas inicialmente repercutidas».
- LIVA 163 terdecies.Dos dice que, con caja, la repercusión «se entenderá producida en el momento del devengo de la operación», y para una F1 sin cobrar ese momento no ha llegado.
- La única regla de caja para modificar la base está en el art. 80, apartado Cuatro: es la de los créditos incobrables, no la de una R1. «caja» sale 0 veces en el RIVA 24, 0 en el LIVA 89, y «rectificativ» 0 en el RIVA 61 decies y 61 septies.
- **NO leído:** consultas de la DGT, el manual del IVA de la AEAT y sus FAQ del régimen de caja.

**Qué hace hoy el código (leído, no ejecutado):** `tramosDeDevengo` devuelve `null` con un total ≤ 0 (`src/modules/invoicing/domain/devengoPorCaja.ts`), así que la R1 va por `fechaDeDevengo`: su `paidAt` si cae antes del tope, y si no, el tope. En staging la R1 lleva `paidAt` (`asientosCobrados: 1`). **NO medido:** quién se lo pone.

**Lo que queda pendiente:**

- La pregunta, literal, para la fila de SCRUM-1264 (la pone el orquestador): está en c.22167.
- Las opciones de producto, para cuando conteste el asesor, todas con GO del fundador (regla 38):
  - O1: como hoy.
  - O2: la R1 sigue a su F1. Toca `devengoPorCaja` y sus tres consumidores.
  - O3: mixta.
- La recomendación de la sesión es O1 hasta que conteste el asesor.
- ⚠️ Sin juzgar: F1 total 84,36 (cuota 11,28) y su R1 −84,35 (cuota −11,27). Le falta un céntimo para anularla entera.

No se cierra ni se transiciona (A13).
