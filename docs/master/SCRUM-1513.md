# SCRUM-1513 · El tope de plantillas contra un Postgres de verdad: NO aguanta — medido, sin arreglar nada

**Medido contra:** `origin/main` = `16e80dea496dad3819bf444983f9974d3c13ebb9` · 2026-10-08T07:58:26Z

A9: comprobación → `docs/master/evidencias/SCRUM-1513/tope-postgres.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA:** no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow. Entran este
registro y `docs/master/evidencias/SCRUM-1513/` (el guion y ocho salidas; de dos pasadas más, una en rojo a propósito y una con una sola conexión, hechas antes de añadir la sección 4, sólo quedan las cifras de la tabla). Nada contra producción ni staging.
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió porque el encargo es medir.

Al escribir esto `origin/main` ya era `4f8c473da8a565fdb6f00316f7ef5b14be3c1f1c`. Entre los dos cambia UN fichero de
`src/` o `prisma/` (`src/modules/invoicing/domain/modoVisible.ts`), que no está en el camino medido. El `dist` se
compiló en `16e80dea4` con `tsc --noCheck`; no se corrió `prisma generate`.

## La respuesta a la parte ②

**El defecto es REAL. No es un artefacto de la base en memoria.** Contra PostgreSQL 16.13, con el tope en 100:

| caso | pool normal, 7 pasadas | una sola conexión, 2 pasadas | transporte con 150 ms, 1 pasada |
| --- | --- | --- | --- |
| L1 · 120 peticiones de 1 mensaje, seguidas | 100 y 20 bloqueadas (7 de 7) | 100 y 20 | 100 y 20 |
| **L2 · UNA petición con 120 mensajes** | **113, 115, 116, 117, 117, 117, 118** | **120 y 120** | **120** |
| **L3 · 120 peticiones a la vez** | **120 (7 de 7)** | **120 y 120** | **120** |
| L4 · 99 ya enviadas y una petición con 2 | 2 en 5 pasadas, 1 en 2 | 2 y 2 | 2 |
| L5 · 99 ya enviadas y una petición con 5 | 1, 1, 1, 2, 2, 2, 3 | 5 y 5 | 5 |

Lo que cambia respecto a SCRUM-1509f (c.18923), y son dos correcciones de signo contrario:

1. **El lote (L2) se confirma, con otra cifra.** En memoria salieron 120 de 120. En Postgres con el pool normal
   salen entre 113 y 118: se cuelan de 13 a 18 por encima del tope, nunca las 20. Las 120 exactas vuelven con una
   sola conexión o con un transporte que tarda.
2. **Lo simultáneo (L3) era el artefacto, y estaba del lado tranquilizador.** En memoria, 120 peticiones a la vez
   dieron 100 y 20 bloqueadas. En Postgres dan 120 y 0 bloqueadas, 10 de 10 pasadas. c.18923 ya avisaba de que esa
   fila no probaba nada porque la base contestaba al instante; aquí queda medido.

Mi predicción del lote, escrita en la cabecera del guion antes de correrlo, era «120 y 0 bloqueos». **Con el pool
normal no se cumplió en ninguna de las 7 pasadas.** Se cumple con una conexión y con latencia.

## En qué se apoya para colarse

Leído en `src/integrations/whatsapp.ts` y visto en la corrida:

- El tope es un `count` (`:376`). Después va la petición al proveedor. La fila que ese `count` cuenta la escribe
  `recordWaMessage` al final y **sin esperarla** (`:460`). Entre la pregunta y la fila no hay transacción ni cerrojo.
- El webhook lanza cada mensaje de la petición sin esperar al anterior (`whatsappIncoming.routes.ts:128-190`).
- **No es cosa del aislamiento de Postgres.** El servidor estaba en `read committed`; con UNA sola conexión, donde
  las consultas van estrictamente de una en una, el lote sale peor (120 de 120, las 120 preguntas contestan 0).
  Cada consulta ve lo que hay; lo que falla es que la decisión y la fila están en instantes distintos.
- Cuánto se cuela depende de cuánto tarda en escribirse la fila frente a las preguntas que quedan. Con el pool
  normal y un transporte instantáneo, 111 a 116 preguntas se contestaron antes de la primera fila. Con 150 ms de
  transporte, las 120. **Un proveedor real tarda, así que la cifra de producción se parece más a la columna de la
  derecha; eso es una inferencia mía, no una medición.**
- El mínimo que lo rompe: con 99 enviadas, una petición con 2 mensajes saca 2 (101 en el día) en 8 de 10 pasadas.

## Controles

15 casos por pasada, 11 con esperado; 0 no cuadran en las 8 pasadas buenas (las otras 2 son el rojo a propósito). 4.218 operaciones de Prisma observadas
por pasada.

| control | esperado | salió |
| --- | --- | --- |
| **¿Hablo con Postgres?** `version()`, base, host y puerto por una conexión `pg` aparte | PostgreSQL, loopback, base acabada en `_test`, el puerto que arranqué | `PostgreSQL 16.13`, `127.0.0.1`, `yaqu_tope_1513_test`, coincide |
| conexiones del cliente de Prisma vistas EN EL SERVIDOR | más de 0 | 2 al empezar, 13 tras L3 (1 con `--pool 1`) |
| la app usa ese cliente y no otro | el mismo objeto | el mismo (si no, sale 2) |
| esquema puesto | `whatsapp_messages` existe; una tabla inventada, no | 33 tablas, 1 y 0 |
| CERO: firma mala ×5 | 401, 0 avisos, 0 filas | 401×5, 0, 0 |
| CERO: número que no es cliente de nadie · cliente sin albarán | 0 avisos, 0 filas | 0 y 0 |
| **POSITIVO: 1 mensaje** | 1 aviso, 1 plantilla, **1 fila en Postgres** leída por la otra conexión | 1, 1, 1 |
| **POSITIVO del tope: 100 filas sembradas por SQL, fuera de Prisma, y 1 mensaje** | bloqueado; la pregunta contesta 100 | bloqueado, contesta 100 |
| BORDE: 99 sembradas y 1 mensaje | sale; la pregunta contesta 99 | sale, contesta 99 |
| plantillas pedidas al transporte = filas en Postgres, en cada caso | iguales | iguales en los 126 casos de las 10 pasadas |
| el guion esperando un aviso menos | rojo | salida 1, 3 casos en rojo de 15 |

El DDL sale de `prisma migrate diff --from-empty` sobre `prisma/schema.prisma` (35.482 B, 33 tablas); el generado
desde el esquema del cliente instalado da el mismo sha256, así que cliente y base coinciden.

## Parte ①, sólo medida: la baja (`handleOptOutRequest`, `whatsappIncoming.routes.ts:270-306`)

Repetido contra Postgres: la primera BAJA da 1 aviso; un cliente ya de baja que escribe BAJA 10 veces da 10 avisos,
10 plantillas y 10 textos de vuelta.

- **Filas que hay que consultar: las que la ruta YA lee.** La lectura de `:271` trae una fila por cada ficha de
  cliente con ese número (1 con un comercio, 2 con dos) y pide `id`, `merchantId` y `name`. **No pide `waOptOut`:
  0 de 13 lecturas.** No hace falta ninguna consulta más; falta una columna en una que ya existe.
- **Dónde: antes de `:284`.** Esa línea escribe la baja en todas las fichas; después ya no se distingue quién
  estaba de baja. La escritura tampoco lo dice: sobre un cliente ya de baja devuelve «1 fila tocada» igual.
- **La pregunta es por FICHA, no por número.** Medido (B3): cliente de dos comercios, de baja sólo en el primero,
  escribe BAJA una vez → 2 avisos, uno al comercio donde ya estaba de baja y otro al comercio donde la baja es
  nueva. Un «ya está de baja → no aviso» por número dejaría sin aviso al segundo.

No se propone código. Si un cliente de baja debe generar aviso, y si se le vuelve a contestar, lo decide el
fundador (reglas 28 y 39).

## Lo que NO medí

- **Postgres de producción ni de staging.** Es un servidor desechable en esta máquina (binarios oficiales 16.13 para
  Windows, del paquete `embedded-postgres` instalado en el temporal del trabajo, fuera del repositorio; CI usa
  `postgres:16-alpine`). Mismo motor y misma versión mayor; no la misma red ni la misma latencia hasta la base.
- **Si Meta agrupa de verdad 120 mensajes, ni 2, en una entrega.** Sigue sin juzgar, como en c.18923.
- **El proveedor real:** el transporte está doblado. La latencia de 150 ms es una cifra mía, una sola pasada.
- El tope por CLIENTE (3): mismo patrón en `:392`, leído y no ejecutado.
- Los otros llamadores de `sendWhatsAppTemplate`. Sólo el aviso al profesional por `:409` y por la baja.
- El tamaño real del pool en producción. Aquí 13 conexiones (12 núcleos); el resultado va de 113 a 120 según eso.
- Ninguna tanda completa: no hay cambio de código.

## Errores propios

- Predije 120 para el lote y con el pool normal no salió ninguna vez. La lectura del código daba la dirección, no
  la cifra.
- Tras la primera pasada tenía «L4 = 2» seis veces seguidas y lo iba a escribir como fijo; la séptima dio 1.
- Pasé dos veces un parche con barras invertidas por la consola y las dos se las comió. Lo delató `node --check`.
- Crucé los 200k de contexto sin avisar: lo medí a 254.410.

Reproducir: un Postgres desechable con `npm i embedded-postgres@16.13.0-beta.17` en una carpeta fuera del
repositorio, el DDL con `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`,
`tsc --noCheck`, y `node docs/master/evidencias/SCRUM-1513/tope-postgres.cjs dist <carpeta> <ddl.sql>`
(`--pool 1`, `--latencia 150`, `--esperado-menos-uno`).


# SCRUM-1513b · Dónde va el cerrojo del tope de plantillas: la propuesta, escrita y SIN construir

**Medido contra:** `origin/main` = `aa0b22acc3abe8572cd5e527caed0dab1e5c0f31` · 2026-10-08T08:09:33Z (hora de GitHub)

A9: sin fallo que generalice — tramo de lectura y propuesta, sin instrumento propio; los tres tropiezos los delató la propia salida y van en «Errores propios»

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es LECTURA y
PROPUESTA.** No se ha tocado ningún fichero de `src/`, `tests/`, `public/`, plantilla, texto ni workflow, y **no se
ha ejecutado nada contra ninguna base**: todas las cifras de comportamiento de este tramo son de la medición de
arriba (c.18973), no mías. Lo mío son recuentos sobre el árbol (con su población al lado) y razonamiento sobre el
código leído; donde razono y no mido, lo dice la frase. El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se
siguió porque el encargo no construye. No hay GO del fundador para arreglar nada (regla 40).

## 0 · Seis cosas leídas que cambian la propuesta

1. **El estado que hace falta ya está en el máster y nadie lo escribe.** `docs/YAQU_MASTER.md:403` (Parte L):
   «`queued → sent → delivered → read` · `queued|sent → failed(error)`». Es el valor por defecto de la columna
   (`prisma/schema.prisma:1274`). En `src/` hay 6 menciones de `queued` y ninguna es una escritura: 4 comentarios,
   el rango (`whatsappLog.service.ts:109`) y UN lector (`envioDelDocumento.ts:56`). Hoy una fila nace ya en `sent`
   o en `failed`. No hay que inventar estado (regla 5) ni tocar el esquema (regla 40).
2. **El tope sólo cuenta filas con identificador del proveedor** (`whatsapp.ts:377` y `:393`, `waMessageId: { not:
   null }`). Una fila escrita ANTES de llamar al proveedor no lo tiene: cualquier opción que reserve tiene que
   cambiar esa condición, o la reserva no cuenta.
3. **Una transacción no es un cerrojo.** La medición de arriba lo dejó dicho con una sola conexión: 120 de 120.
   Envolver la pregunta y la fila en una transacción en `read committed` deja a dos envíos leer 99 y escribir los
   dos. Hace falta algo que haga ESPERAR al segundo.
4. **El patrón de cerrojo ya existe en la casa:** `pg_advisory_xact_lock(<espacio>, <merchantId>)` como primera
   sentencia de una transacción, en 3 sitios (`app.ts:1025`, `encolarRemision.ts:56`, `invoiceNumber.service.ts:372`;
   espacios 1748, 1749 y 1750). Los tres están en el camino de emisión: se LEEN y se copia la forma con otro
   espacio; no se tocan.
5. **El máster ya dice qué error es peor para uno de los dos topes.** J6 (`YAQU_MASTER.md:320`): «tope duro 3
   mensajes-iniciados-por-negocio/cliente/día […] Violar esto = ban del número = producto muerto». El de 100 por
   comercio (A3.2) protege el gasto y el número compartido; el máster no le pone esa frase.
6. **Una corrección al encargo.** Decía que el caso mínimo (99 enviadas y una petición con 2) «tiene que pasar de
   2 a 0». Con el tope en 100 queda UN hueco legítimo: lo correcto es **1 plantilla y 1 bloqueada**. Un arreglo
   que diera 0 mandaría de menos sin motivo. El control de §3 espera 1.

## 1 · Dónde va el cerrojo: cinco sitios y lo que cuesta cada uno

Hoy (`sendWhatsAppTemplate`): pregunta (`:376`, `:392`) → proveedor (`:437`) → fila sin esperarla (`:460`). Si la
pregunta falla, el envío sale igual (`:404`, «no se bloquea»); si la fila falla, se traga el error
(`whatsappLog.service.ts:49`). **Hoy el sistema elige siempre lo mismo: contar de menos.** No existe ningún camino
que deje algo contado y no enviado.

| | A · transacción que abarca pregunta, proveedor y fila | B · cerrojo por comercio sostenido durante el envío | **C · reservar la fila (`queued`) bajo un cerrojo corto, y resolverla después** | D · contador atómico en tabla propia | E · cola en memoria del proceso |
| --- | --- | --- | --- | --- | --- |
| ¿Cierra el exceso? | No en `read committed` (punto 3). En `serializable` sí, a cambio de reintentos | Sí | Sí | Sí | Sólo si hay UNA instancia de la app (sin medir) |
| Si el proveedor tarda | Una conexión retenida por envío todo ese tiempo (el plazo es de 10 s, `:454`). 120 envíos piden 120 conexiones a un pool que aquí era de 13 | Los envíos de ese comercio van de uno en uno: 120 × 150 ms son 18 s, y cada uno que espera retiene una conexión. Los demás comercios no esperan, pero el pool es común | Nada: el cerrojo se suelta antes de llamar al proveedor. Dura lo que una pregunta y una fila | Nada | Nada |
| Si el proceso muere a mitad | La transacción se deshace: **enviado y no contado** | El cerrojo lo suelta la base sola; la fila no llegó: **enviado y no contado** | Antes de llamar: **contado y no enviado**. Después de llamar y antes de anotar: enviado y contado, pero la fila se queda en `queued` sin identificador (ver §2) | **Contado y no enviado**, y además el contador y el registro de mensajes discrepan | Se pierde la cola; lo ya enviado sin fila: **enviado y no contado** |
| Qué error prefiere | **Contar de menos** | **Contar de menos** (sólo al morir; en marcha normal, ninguno) | **Mandar de menos** | **Mandar de menos** | Contar de menos |
| Esquema | No | No | No | **Sí: tabla nueva** (regla 40, ALTER previo en las tres bases, A5) | No |
| Cambia lo que ve el usuario | No | No | **Puede** (§2: el chip «En cola») | No | No |
| Lo peor que trae | Un reintento por conflicto de serialización, si abarca al proveedor, **reenvía**. Y el plazo por defecto de una transacción interactiva de Prisma (5 s, de su documentación; no lo he ejecutado) es menor que el del proveedor | Un proveedor lento seca el pool de TODA la app, no sólo los envíos | Reservas huérfanas: cada muerte a mitad se come un hueco de ese día (sólo de ese día: el tope cuenta desde las 00:00) | Dos fuentes para la misma cifra; hay que devolver el hueco cuando el proveedor dice que no | No sobrevive a un segundo proceso ni a un despliegue |

**Lo que propongo: C.** Es la única que cierra el exceso sin retener nada mientras el proveedor contesta, sin
esquema nuevo y sin estado inventado. Forma, en prosa y sin código:

1. Transacción corta: cerrojo de transacción por comercio (espacio propio, distinto de 1748-1750) → las dos
   preguntas (comercio y cliente), que pasan a contar «tiene identificador del proveedor **o** está en `queued`» →
   si cabe, la fila nace en `queued`. Fin de la transacción. El MISMO cerrojo cubre los dos topes, porque los dos
   se preguntan debajo de él.
2. Fuera del cerrojo: la llamada al proveedor, igual que hoy.
3. Según el desenlace, que ya existe desde SCRUM-1477 (`rechazado` · `sin_respuesta`): la fila pasa a `sent` con su
   identificador, o a `failed`.

A, B, D y E quedan descritas para que el fundador elija con las alternativas delante. D es la más barata por envío
y la más limpia de razonar, pero pide tabla y deja dos cifras que pueden no coincidir; no la propongo antes de SIF-1.

### 🔴 LA pregunta para el fundador. No se pueden evitar los dos errores a la vez

Entre «he decidido que cabe» y «sé que salió» hay una llamada a un tercero. Si ahí se corta algo, el sistema tiene
que haber elegido de antemano en cuál de los dos lados cae:

- **Mandar de menos** (reservar antes: C o D). Un envío que no se sabe si salió **ocupa su hueco** hasta
  medianoche. Lo peor: un día con cortes, un comercio se queda sin algún aviso que cabía. Nunca se pasa del tope.
- **Contar de menos** (lo de hoy, A, B, E). Un envío que no se sabe si salió **no ocupa hueco**. Lo peor: se pasa
  del tope en tantos como envíos queden sin anotar. Nunca se deja de mandar algo que cabía.

Son tres decisiones, no una, y pueden tener respuestas distintas:

| | qué se decide | qué pasa hoy |
| --- | --- | --- |
| **P1** | El proveedor dijo que NO (`rechazado`, un 4xx). ¿Devuelve el hueco? | No lo ocupa. **Propongo que siga así**: se sabe que no salió, no hay error que elegir |
| **P2** | No se sabe si salió (`sin_respuesta`: plazo, corte, 5xx; o el proceso murió). ¿Ocupa hueco? | No lo ocupa. **Ésta es la decisión de fondo.** Para el tope por cliente el máster ya contesta (punto 5 de §0): ocupa. Para el de 100 por comercio no hay texto |
| **P3** | No se pudo ni preguntar (la base no contesta). ¿Sale? | Sale (`:404`). Es la misma elección con otra cara, y c.18894 ya midió que «fallar cerrado» ahí no toca el 10 de 10 de SCRUM-1509 |

Mi lectura, que no es una decisión: P2 = ocupa, en los dos topes. El coste de equivocarse por ese lado es un aviso
que no sale un día; por el otro, lo que J6 llama producto muerto. P3 no la propongo cambiar en este arreglo: es
otra superficie (qué ve el profesional cuando la base está caída) y merece su propia medición.

## 2 · Qué se rompe

**Llamadores** (población: `src/**/*.ts`, llamadas con paréntesis en la misma línea; control de cero: un nombre
inexistente, `sendWhatsAppPlantillaInexistente(`, da 0):

- `sendWhatsAppTemplate(`: **6 llamadas en 5 ficheros** — `whatsapp.ts` (1, la caída a plantilla de
  `sendWhatsAppWindowFirst`), `whatsappNotifications.ts` (2), `albaranWhatsApp.service.ts` (1),
  `reminder.service.ts` (1, carril S1), `invoicesAdmin.routes.ts` (1, carril J1).
- `sendWhatsAppWindowFirst(`: **5 llamadas en 5 ficheros** — `whatsappNotifications.ts`, `invoiceReminder.service.ts`,
  `invoiceWhatsApp.service.ts` (J1), `albaranWhatsApp.service.ts`, `sendQuote.service.ts` (S1).
- `notifyMerchantAlert(` (el aviso al profesional): **9 llamadas en 6 ficheros**, contando la interna.

Ninguna opción cambia la firma ni lo que devuelve la función: los llamadores no se tocan. Los dos ficheros vedados
(`invoicesAdmin.routes.ts`, `reminder.service.ts`) sólo aparecen aquí como llamadores leídos.

**Lectores del registro que verían una fila `queued`** (los 18 accesos a `whatsAppMessage` de `src/`, leídos uno a
uno; importan cuatro):

| lector | qué haría con una fila `queued` | ¿lo ve el usuario? |
| --- | --- | --- |
| `getDeliveryStatus` / `getDeliveryStatusMany` (`whatsappLog.service.ts:170`, `:204`) → chip de entrega | `public/dashboard/js/api.js:1422` ya tiene `queued: 🕓 «En cola»`. Hoy ese texto es inalcanzable | **Sí.** Durante la llamada al proveedor (milisegundos a 10 s) y, en una reserva huérfana, para siempre |
| `envioDelDocumento` (`envioDelDocumento.ts:56`, J1) | Menos de 10 minutos: `en_curso`. Más: `no_enviado` | **Sí**: una reserva huérfana de un envío que SÍ salió diría «no enviado», y el profesional puede reenviar |
| `historialWhatsAppDelCliente.ts:35` | Enseña el `status` de cada fila | Sí, lo que pinte para `queued` (no lo he leído en pantalla) |
| `getWhatsAppMetrics` (`:296`) | `templateToday` y `month.total` cuentan filas sin mirar estado: ya cuentan las `failed` | Sí, en Informes: +1 mientras dure |

- **Regla 39:** no hay texto nuevo, pero «En cola» pasaría de no verse nunca a verse. No sé si ese literal tiene
  firma; **no lo he buscado en `docs/microcopy/` y no lo juzgo.** Se pregunta antes, o la reserva nace sin
  `relatedType`/`relatedId` y los recibe al confirmarse: así el chip y `envioDelDocumento` no la ven (el historial
  del cliente sí).
- **Regla 28:** ninguna opción añade un envío ni un destinatario; el orden de los cortes delante del proveedor
  (credenciales → demo → baja → topes → validación de plantilla) se queda. Lo que cambia en C es el orden de
  ESCRITURA: hoy proveedor y después fila, pasaría a fila, proveedor y actualización. Y la validación de plantilla
  (`:410`) va hoy DESPUÉS de los topes: con reserva, una plantilla inválida reservaría un hueco para devolverlo
  enseguida. Habría que subirla delante de la reserva, que es mover una línea del camino de envío (regla 40): va
  dentro del mismo GO o no va.
- **Regla 40:** las cinco opciones modifican `whatsapp.ts`; C además `whatsappLog.service.ts`. Los dos son J2.

**Tests que lo tocan** (población: 1.293 ficheros `tests/*.test.mjs`, y `tests/` entero para los recuentos; los
recuentos son de ficheros que NOMBRAN el término, no de casos):

- Nombran `sendWhatsAppTemplate`: 11 ficheros de test (14 contando bancos y auxiliares).
- Nombran los topes (`daily_cap` o sus dos variables): 5 — `scrum116`, `scrum126`, `scrum1443`, `scrum1465b`, `scrum1478`.
- Nombran `recordWaMessage`: 10. Nombran `queued`: 6, de ellos 4 del registro de mensajes (`scrum475`, `scrum885`,
  `scrum986`, `whatsappLog`).
- Nombran `whatsAppMessage` junto a `count` o `create`: 22. **Éstos son los que más riesgo tienen con C:** si doblan
  el cliente de Prisma a mano, un `$transaction` o un `$executeRaw` nuevos no existen en su doble.
- **No he ejecutado ninguno contra un cambio, porque no hay cambio.** Cuáles caen de verdad se sabe construyendo.

De paso, leído y NO ejecutado: una fila `failed` de plantilla nace con coste estimado de 0,023 €
(`whatsappLog.service.ts:44-46` no mira el estado) y `aggregateWaRows` suma el coste de todas. Un envío que no
llegó al proveedor sumaría al coste del mes. Es de J2; no lo arreglo porque el encargo veda `src/`.

## 3 · El control, escrito antes que el arreglo

Se monta sobre el guion de arriba (`docs/master/evidencias/SCRUM-1513/tope-postgres.cjs`: Postgres 16 de verdad en
loopback, app de `dist` por HTTP con firma válida, transporte doblado), y sus cifras de HOY son la línea base ya
medida. Tope en 100. «Sale» = plantillas pedidas al transporte.

| # | caso | hoy (medido arriba) | con el arreglo | qué prueba |
| --- | --- | --- | --- | --- |
| C1 | 99 enviadas, UNA petición con 2 | 2 en 8 de 10 pasadas | **1 y 1 bloqueada, 10 de 10** | el caso mínimo |
| C2 | 99 enviadas, una petición con 5 | de 1 a 5 | 1 y 4 bloqueadas | |
| C3 | UNA petición con 120 | 113 a 120 | **100 y 20** | el lote |
| C4 | 120 peticiones a la vez | 120 | **100 y 20** | varias conexiones |
| C5 | 1 mensaje, base limpia | 1, 1 fila | **1, 1 fila en `sent` con identificador** | el envío normal sigue saliendo |
| C6 | 100 sembradas por SQL y 1 mensaje | bloqueado | bloqueado | el positivo del tope |
| C7 | 99 sembradas y 1 mensaje | sale | sale | el borde |
| C8 | C1, C3 y C4 con `--pool 1` y con `--latencia 150` | 120 / 2 | las mismas cifras que con el pool normal | que no dependa del pool ni del proveedor |
| C9 | 20 mensajes del mismo comercio, transporte con 150 ms: tiempo total | — | **cerca de 150 ms, no de 3 s** | que el cerrojo NO se sostiene durante el envío (separa C de B) |
| C10 | 2 comercios, 99 cada uno, 2 mensajes a cada uno a la vez | — | 1 y 1 en CADA uno | que el cerrojo es por comercio y no global |
| C11 | tope por cliente: 2 enviadas a un cliente y una petición con 3 hacia él | sin medir (leído, `:392`) | 1 y 2 bloqueadas | el tope de J6 bajo el mismo cerrojo |
| C12 | 99 enviadas; el transporte RECHAZA una (4xx) y luego llega otra | — | la segunda SALE | P1: un «no» devuelve el hueco |
| C13 | 99 enviadas; el transporte NO CONTESTA a una y luego llega otra | — | **lo que el fundador decida en P2**: bloqueada si ocupa, sale si no | P2, con el esperado fijado por la decisión y no por el código |
| C14 | fila `queued` de hoy sin identificador, sembrada por SQL (una muerte a mitad), 99 más, y 1 mensaje | — | igual que C13 | la reserva huérfana |
| C15 | fila `queued` de AYER sembrada, 99 de hoy y 1 mensaje | — | sale | que la huérfana caduca a medianoche |
| C16 | filas en la base = decisiones tomadas | iguales en 126 casos | iguales, y ninguna en `queued` al acabar un caso sin cortes | que nada se queda a medias |

**Rojo primero:** el control se escribe y se corre ANTES del arreglo: C1, C3 y C4 tienen que caer con las cifras
de arriba. Con el arreglo puesto, **quitando sólo el cerrojo** (la reserva se queda) C1 y C4 tienen que volver a
caer: si no caen, lo que arregla no es el cerrojo y hay que entender por qué. Positivos obligatorios en cada
pasada, los de la medición: `version()` de la base por otra conexión, C5, C6, y el guion esperando un aviso menos
tiene que salir en rojo.

**Lo que este control NO puede probar:** el proveedor real, el pool de producción, y una muerte de proceso de
verdad (C14 la fabrica con una fila; no mata nada).

## 4 · Parte ① (la baja): lo que la medición de arriba cambia del arreglo

Lo medido arriba: la lectura de `whatsappIncoming.routes.ts:271` ya trae una fila por ficha y no pide `waOptOut`
(0 de 13 lecturas); la escritura de `:284` marca todas las fichas y contesta «1 fila tocada» también sobre quien ya
estaba de baja; y con dos comercios y baja en uno solo, salen 2 avisos, **uno de ellos legítimo**.

1. **La decisión es por FICHA, no por número.** «Este número ya está de baja → no aviso» dejaría sin aviso al
   comercio donde la baja es nueva. El arreglo no puede ser un corte al principio de la función.
2. **Mirar antes de `:284` es necesario y NO basta.** Es razonamiento mío, no medición: una entrega con 120 BAJA de
   un cliente que todavía NO está de baja lanza 120 ejecuciones sin esperarse (`:128-190`); las 120 leerían «no
   está de baja» antes de que ninguna escriba, y saldrían 120 avisos. Es la misma enfermedad que la del tope.
3. **Lo que sí cierra: decidir con la ESCRITURA.** Que la escritura de `:284` lleve la condición «y no estaba de
   baja» y se haga por comercio; avisa sólo el comercio en el que tocó alguna fila. Postgres hace esperar a la
   segunda escritura sobre la misma fila y le hace reevaluar la condición: toca 0. Sin cerrojo nuevo y sin esquema.
   **No lo he ejecutado.**
4. **Queda una decisión de canal (regla 28) que no es mía:** el texto de vuelta al cliente («Hecho ✅…», `:288`). Hoy
   sale las 120 veces. ¿Se le contesta a quien repite BAJA estando ya de baja en todas sus fichas? Contestar es
   una respuesta a un entrante; callar es no generar tráfico hacia quien pidió no recibirlo. Si se elige otro
   texto para ese caso, es regla 39.
5. **Un comercio con DOS fichas del mismo número** (una por `phone` y otra por `mobile`): ¿un aviso o dos? Propongo
   uno por comercio, con el nombre de la primera ficha, que es lo que ya hace `:296`.

Control de ①, sobre el mismo guion: (a) ya de baja, BAJA ×10 → hoy 10 avisos, esperado **0**; (b) NO de baja, UNA
petición con 120 BAJA → esperado **1** aviso (hoy sin medir en Postgres; el ticket da 120 en memoria); (c) dos
comercios, baja en uno solo, BAJA una vez → esperado **1**, y al comercio donde es nueva (hoy 2); (d) positivo: no
de baja, BAJA una vez → **1** aviso y la ficha marcada; (e) cero: firma mala → 0.

**Orden que propongo si hay GO:** ① antes que ②. No toca `whatsapp.ts`, no cambia nada que vea el profesional, y
cierra la puerta que el ticket llama «la más ancha». ② sigue haciendo falta: quedan `:409` y los otros llamadores.

## 5 · Para el siguiente: cómo se consigue un Postgres en ESTA máquina

La receta de `docs/RUNBOOKS.md:671-679` da por hechos `psql` y «contenedor, instalación local…». **Esta máquina no
tiene ninguno de los tres** (lo comprobó mi antecesora antes de montar el suyo; yo no lo he vuelto a medir). Lo
que sí funciona, medido por ella el 8-oct-2026:

- `npm i embedded-postgres@16.13.0-beta.17` en una carpeta FUERA del repositorio (el temporal del trabajo). Son
  los binarios oficiales de PostgreSQL 16.13 para Windows: servidor de verdad, varias conexiones, en loopback.
- **PGlite no vale para medir concurrencia:** una sola conexión.
- El DDL: `<checkout compartido>/node_modules/.bin/prisma migrate diff --from-empty --to-schema-datamodel
  prisma/schema.prisma --script` (el árbol anidado no trae `node_modules/.bin`). Nunca `prisma generate` aquí.
- Una siembra por SQL lleva `now() at time zone 'utc'` (Prisma escribe UTC). El comercio de prueba no puede ser el
  id 1 (el de demostración apaga puertas).
- **Permiso:** el orquestador contestó en el encargo de esta tanda (8-oct-2026) que esto «estaba bien y no
  necesitaba más permiso»; lo vedado es producción y staging. Queda aquí y en Jira para que no viva sólo en un
  mensaje. `RUNBOOKS.md` no lo edito: no sé de quién es su carril y el encargo no lo pide; el texto está propuesto.

## Lo que NO he medido

- **Nada de este tramo está ejecutado.** Ni las cinco opciones, ni el control, ni el punto 3 de §4.
- Cuántas instancias de la app corren en producción y el tamaño de su pool (decide E, y lo grave que es A o B).
- Si la base de producción va detrás de un agrupador de conexiones (un cerrojo de transacción lo aguanta; no lo
  he comprobado).
- Qué pinta el historial del cliente para una fila `queued`, y si «En cola» tiene firma.
- Cuáles de los tests de §2 caerían: son ficheros que nombran un término.
- El guion de arriba con la línea que le añado (abajo): pasa `node --check` y el control que lo señalaba, pero
  **no lo he vuelto a correr contra Postgres** (el encargo veda repetir la medición).

## De paso: el obligatorio de #2316 (la medición de arriba) salió ROJO, y por qué

Leído por nombre (job 113211094712, log de 1.790.024 B): 11.071 tests, 10.977 pasan, **1 cae**, 93 saltan.
Positivo: «SCRUM-124 (r28)» está en ✔ (1 línea). Cero: un nombre inventado, `SCRUM-1513zz-no-existe`, 0 líneas.

Cae `SCRUM-864c · ③ NINGÚN temporal nuevo nace sin borrarse`: `tope-postgres.cjs:185` crea su carpeta de datos con
`mkdtempSync` y sólo la borra dentro de `apagar()`, que no corre si el guion revienta antes. No es un fallo de la
medición ni de sus cifras: es el guion dejando restos en el temporal.

Arreglado aquí, en el guion (evidencias de J2; ni `src` ni `tests`, y el control no se toca: regla 41): una línea
detrás de la que crea la carpeta, que la borra al salir el proceso. En local, antes: `scrum864c` 3 de 4, nombrando
`:185`; después: 4 de 4. Esta rama lleva dentro el commit de #2316 (`0bef6b284`) para poder anexar el registro:
**si entra ésta, #2316 queda sin nada propio que aportar**; si se prefiere que entre #2316, necesita esta misma línea.

## Errores propios

- Un recuento de tests salió con la opción de filtro detrás de la ruta: `grep` la tomó por un fichero, protestó en
  cada vuelta y contó `tests/` entero en vez de sólo `*.test.mjs` (14 donde son 11). Lo delató la salida; las dos
  cifras van arriba con su población.
- Iba a proponer «escribir la fila antes» como una opción suelta. Leyendo la columna de una sola conexión de la
  medición de arriba se ve que sola no cierra nada: por eso C lleva el cerrojo dentro.
- Al comprobar en rojo los dos controles de registro quité de una vez mi ancla y mi línea `A9:`. Cayó `scrum267`
  (3 casos, nombrando este tramo) y `scrum1294` siguió verde: sin ancla, mi tramo se fundía con el de arriba, que
  sí tiene su línea. Dos cambios a la vez tapan uno. Repetido quitando sólo la línea: cae 1 de 4 y nombra
  `SCRUM-1513.md:123`. Y deshice la siembra a mano: `git restore` lo para el hook, con razón.

| aceptación (del encargo) | dónde se ve |
| --- | --- |
| 1 · Dónde va el cerrojo, con opciones y precio, y cuál de los dos errores prefiere cada una | §1 de este tramo |
| 2 · Qué se rompe: llamadores, tests, regla 39 y regla 28 | §2 |
| 3 · El control, escrito de antemano | §3 (y §4 para ①) |
| 4 · La parte ①: por ficha y no por número | §4 |
| Dejar escrito lo de Postgres en esta máquina | §5 |
| Construir el arreglo | NO HECHO → fundador: no hay GO (regla 40). Decide P1, P2 y P3 de §1 y el punto 4 de §4 |

---

# SCRUM-1513d · El cerrojo del tope de plantillas, construido: la opción C

**Medido contra:** `origin/main` = `497f516710e5ff843a6cfbee77f33c2692bba98f` · 2026-10-08T09:25:52Z (hora de GitHub)

A9: comprobación → `tests/scrum1513d-la-reserva-del-tope.test.mjs`

**J2 (relevo, sesión `jv-j2`, equipo de Javier).** Orden de construir: Jira `c.18998`. GO del fundador: `c.18988`
(P1 devuelve el hueco · P2 ocupa hueco = mandar de menos · P3 no se toca). Firma del rótulo del chip: `c.18995`.
El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha común.

## Qué se ha construido

- `src/modules/messaging/domain/whatsappLog.service.ts` (J2): `reservarPlantilla` y `resolverReservaDePlantilla`.
  Una transacción corta: cerrojo del comercio (`pg_advisory_xact_lock`, espacio propio 1751), las dos preguntas del
  tope y, si cabe, la fila en `queued`. El cerrojo se suelta ANTES de hablar con el proveedor.
- `src/integrations/whatsapp.ts` (J2), sólo `sendWhatsAppTemplate`: la validación de la plantilla sube delante de
  la reserva; el envío que sale pasa la fila a `sent`; el rechazo, a `failed`; sin respuesta, la deja en `queued`.
  Ninguna firma ni valor devuelto cambia: no se ha tocado ningún llamador.
- Qué cuenta para el tope: lo que tiene identificador del proveedor **o** sigue en `queued`, de hoy.
- Los tres cerrojos de emisión (1748, 1749, 1750) no se han tocado. Ni esquema, ni estado nuevo, ni texto nuevo.
- `tests/_envio-doblado.mjs`: el doble de la base aprende UNA sentencia, el cerrojo de transacción, como no-op.
  Cualquier otro `$executeRaw` sigue avisando. Es un doble, no un control: no se ha relajado ninguna comprobación.

## El control, contra PostgreSQL 16.13 de verdad (desechable, loopback), tope en 100

El mismo guion de la medición de arriba (`evidencias/SCRUM-1513/tope-postgres.cjs`), una pasada de cada:

| caso | ROJO PREVIO (`main`, sin arreglo) | con el arreglo | con el arreglo y **sin la línea del cerrojo** |
| --- | --- | --- | --- |
| UNA petición con 120 mensajes | 117 | **100 y 20 bloqueadas** | 108 |
| 120 peticiones a la vez | 120 | **100 y 20** | 110 |
| 99 enviadas y UNA petición con 2 | 2 | **1 y 1 bloqueada** (no 0) | 2 |
| 99 enviadas y UNA petición con 5 | 2 | **1 y 4** | 3 |
| el envío normal de 1 | 1 | **1** | 1 |

Con `--pool 1` y con `--latencia 150`, las mismas cifras de la columna del arreglo (una pasada de cada; esas dos
salidas no se han guardado). 11 controles con esperado, 0 sin cuadrar, en todas las pasadas.

**La tercera columna es la que importa mañana.** Quitando SÓLO la línea del cerrojo en `dist`, con la reserva
puesta, el defecto vuelve: 108, 110, 2 y 3. La reserva sola no cierra nada; lo que cierra es el cerrojo. En un
banco en memoria esos números seguirían saliendo bien.

Y los desenlaces del proveedor, que desde el webhook no se pueden provocar
(`evidencias/SCRUM-1513d/reserva-postgres.cjs`, 19 comprobaciones, 0 sin cuadrar):

| caso | salió |
| --- | --- |
| P1 · el proveedor RECHAZA (400) con 99 enviadas, y llega otro | la fila pasa a `failed`; el siguiente SALE |
| **P2 · el proveedor NO CONTESTA (conexión cortada) con 99 enviadas, y llega otro** | la fila se queda en `queued`; **el siguiente NO sale** |
| P2 · el proveedor contesta 500 | igual que el anterior |
| mientras el proveedor contesta | la fila ya existe, en `queued` y sin documento |
| una reserva parada de ayer · de hoy | no cuenta · cuenta |
| tope por cliente: 2 enviadas a ese cliente y 3 envíos a la vez | 1 sale y 2 bloqueadas |
| dos comercios al borde, 2 envíos a la vez en cada uno | 1 y 1: el cerrojo no es global |
| 20 envíos a la vez con el proveedor tardando 150 ms | 233 ms en total, no 3.000: no van de uno en uno |
| plantilla inválida | no sale y no ocupa hueco |

Sin la línea del cerrojo ese guion sale 1: caen el tope por cliente (salen 2) y los dos comercios (salen 2 en uno).
El caso «99 y 2 a la vez» NO cayó en esa pasada: la carrera no se pierde siempre, y por eso no es el único control.

## El paquete de disputa, medido antes de que `queued` se vea

Leído (`invoicesAdmin.routes.ts:363-374` y `:431`, carril J1, sin tocar): busca los mensajes **por documento**, no
filtra por estado e imprime el estado tal cual. Una reserva asociada al documento habría impreso `queued`.

**Por eso la reserva nace SIN documento, y sólo lo recibe cuando deja de estar en `queued`.** Ejecutado: tras un
envío sin respuesta, el documento tiene 0 filas en `queued`. El paquete y los tres chips de documento no llegan a
verlo; no hace falta traducir nada ni otra frase. La pestaña de WhatsApp de la ficha del cliente lee por cliente y sí
lo ve, con el rótulo firmado en `c.18995`, que ya pinta `public/dashboard/js/api.js` (S2; no se ha tocado).

## Lo que cambia para quien mira la pantalla, y no es un texto nuevo

Cuando el proveedor no contesta, hoy se escribe una fila `failed` asociada al documento y el chip del documento dice
«No entregado». Con este cambio la fila se queda en `queued` y sin documento, así que **el chip del documento ya no
dice «No entregado» en ese caso** — y el aviso al profesional de que el documento está sin enviar **no cambia**: la
regla que lo pinta da el mismo aviso y el mismo texto con y sin esa fila (medido en `c.18984`). «No entregado» es
una afirmación, y en ese caso no se sabe si se entregó: el producto deja de afirmar lo que ignora. Aprobado por el
orquestador el 8-oct-2026; es un cambio por ausencia, no por texto, y queda aquí para quien se lo pregunte.

## Tests de la casa

- `tests/scrum1513d-la-reserva-del-tope.test.mjs`: 11 de 11. Fija el orden (cerrojo, pregunta, fila), qué cuenta la
  pregunta, y qué lleva la fila en cada desenlace. **No puede probar que el cerrojo cierre la carrera**: eso sólo se
  ve con varias conexiones, y es lo medido a mano arriba.
- Los 101 ficheros que nombran el camino de envío o su registro: 955 tests, 937 pasan, 16 saltan, **2 caen**, los
  dos de `scrum245-tipo-obliga-declarar` con `MODULE_NOT_FOUND`. No los he corrido sobre `main` en este árbol:
  que sean del árbol anidado y no de este cambio es lo que dice el error, no una medición.
- **La tanda completa NO se ha corrido.** La lancé y el arnés la mató por falta de memoria; lo que dejó no se cuenta.
  El veredicto de la tanda entera es el del obligatorio en CI.

Tres rojos míos por el camino, arreglados en el código y no en el control: `scrum1477` exige el literal
`desenlace: desenlaceDeMeta(err)` en los siete `catch` (lo había sacado a una variable); `scrum411` cazó un `export`
sin llamador (el espacio del cerrojo); y ocho tests de `scrum1465b` y `scrum1478` doblan la base sólo en
`whatsapp.js`, y la reserva preguntaba desde otro módulo — ahora recibe el cliente de la base por parámetro.

## Lo que NO he medido

Producción ni staging · el proveedor real · el pool y el número de instancias de producción · la muerte del proceso
entre la reserva y la respuesta (deja una fila en `queued` hasta medianoche; razonado, no ejecutado) · P3, la base
que no contesta en la reserva: sigue saliendo como antes, cubierto sólo por el test con un doble · una ráfaga que
agote la espera de la transacción (15 s): caería en P3 y saldría sin reserva; con 120 a la vez y una sola conexión
no pasó · la cadena de una fila `queued` hasta la pestaña del cliente en un navegador · `getWhatsAppMetrics`, que
suma una fila `queued` en el total y en el coste (leído en `c.18984`, no ejecutado) · yaqu.app, que no se puede
verificar hasta el merge.

## Errores propios

- Los tres rojos de arriba: escribí el código sin correr antes los controles de la casa que lo miran.
- Lancé la tanda completa en segundo plano con la máquina corta de memoria, contra el aviso de la ficha; la mató
  el arnés y perdí esa pasada.
- Crucé los 200k de contexto antes de avisar: medido 210.344.

| aceptación (de `c.18998`) | dónde se ve |
| --- | --- |
| cerrojo corto por comercio y reserva en `queued`, resuelta al volver | «Qué se ha construido» |
| sin tocar los 3 sitios de emisión | ídem; espacio propio 1751 |
| subir la validación de plantilla delante de la reserva | ídem; caso «plantilla inválida» |
| 99 y una petición con 2 pasa de 2 a 1, NO a 0 | tabla del control |
| el envío normal de 1 sigue saliendo | tabla del control |
| visto en rojo antes, contra Postgres de verdad | columnas primera y tercera |
| medir el paquete de disputa antes de que `queued` sea visible | «El paquete de disputa» |
| la parte ① (la baja) | NO HECHO → sin GO |
| P3 | NO HECHO → no se toca aquí |
| tanda completa en local | NO HECHO → la mató el arnés; queda el obligatorio |
