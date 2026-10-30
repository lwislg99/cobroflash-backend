# SCRUM-1330 · Una factura sellada no se vuelve a sellar — dos guardas, y SCRUM-1304 entra con ellas

**Medido contra:** `origin/main` = `c1fe641c929b2dfbc3d55db60cced6c4640974bc` · 2026-10-01T03:52:35Z

1-oct-2026 · **J1e** (equipo de Javier), relevo de J1d, que midió el defecto y paró. GO del fundador
en SCRUM-1330, comentario 17724 («1-GO»): **me llegó por el orquestador** (`cobroflash-backend-5b`),
que se lo oyó al fundador; yo lo leí en Jira, no lo oí. Autoriza dos guardas, A y B, y nada más.

A9: comprobación → `tests/scrum1330-una-sellada-no-se-resella.test.mjs`

## El defecto

`ensurePdfAndEvent` (`src/lib/invoicing.ts`) llamaba a `sellarTrasEmision` siempre, y `applyVeriFactu`
(`src/modules/invoicing/domain/verifactu.service.ts`) no miraba si la factura ya tenía huella:
recalculaba y pisaba `vfHash`, `vfPrevHash` y `vfTimestamp`. Una factura emitida, editada por el
propio código (regla 29 de `docs/YAQU_MASTER.md`).

## Qué cambia

- **A · en el punto de llamada.** `ensurePdfAndEvent` no llama a `sellarTrasEmision` si la fila que
  tiene en la mano ya está `sellado`.
- **B · dentro del cerrojo.** `applyVeriFactu`, después de tomar el cerrojo de la cadena, lee la
  fila; si ya tiene `vfHash`, no recalcula ni escribe: devuelve el sello persistido y lo dice por
  `console.warn`, con otra redacción que la línea de un sellado.

Hacen falta las dos. La A mira una fila que puede ser vieja: la entrega que la leyó antes de que la
otra la sellara entra igual (④b), y a ésa la para la B. La B sola conserva la huella, pero deja
entrar en `sellarTrasEmision`, que reescribe el estado y vuelve a encolar el alta.

La B **devuelve, no lanza**, por dos motivos medidos: una factura que se quedó con la huella escrita
y el estado sin marcar tiene que poder terminarse; y una B que lanza hace caer el caso «resellar un
alta» de `tests/scrum173` (mutación `MB-lanza`, abajo).

No hay cambio de esquema, ni flag, ni texto que vea el usuario. Ninguna huella persistida se toca.

## El rojo primero

`docs/master/evidencias/scrum1330/rojo-antes-del-arreglo-1c828df9.tap.txt`: 14 casos sobre el código
sin las guardas (con el arreglo de SCRUM-1304 dentro), **7 rojos por efecto y 7 controles verdes**.

| Caso | Sin las guardas | Con A + B |
| --- | --- | --- |
| Primer sellado de tres facturas | encadenadas, reproducibles | igual |
| `applyVeriFactu` sobre una ya sellada, con otra detrás | 🔴 huella, anterior y sello cambian | cadena byte a byte |
| Dos sellados a la vez de la misma factura | 🔴 2 escrituras de huella | 1 |
| Fila con huella y estado `pendiente_de_sellado` | 🔴 se le cambia la huella | se termina sin tocarla |
| ④a España · entrega repetida 1,1 s después | 🔴 huella y sello cambian | cadena byte a byte, 1 sellado |
| ④b España · dos entregas a la vez | 🔴 1 factura, 2 sellados | 1 factura, 1 sellado |
| ④f España · cobrar el enlace de una factura sellada hace un mes | 🔴 se re-sella encadenada a la posterior | cadena byte a byte, 0 sellados |
| Fila ya `sellado`: ¿entra en `sellarTrasEmision`? | 🔴 2 pasadas, 2 intentos de encolar | 1 y 1 |

Corre `dist/` tal cual —`/webhooks/psp`, `ensureInvoiceForCharge`, `sellarTrasEmision`,
`applyVeriFactu`— sobre el banco con estado de SCRUM-1304, sacado a `tests/_banco-emision-con-estado.mjs`.
Se doblan la base, el PDF y el correo.

**Cómo se mide «byte a byte».** Se serializa lo persistido de cada factura (número, estado, huella,
anterior, sello con milisegundos, QR, huella de anulación), se comparan las líneas y su sha256 antes
y después; si algo cambia, el fallo nombra la factura. Los sellados se cuentan por **escrituras de
`vfHash` en la fila**, no por la huella (dos sellados en el mismo segundo dan la misma) ni por una
línea de log.

## 🔴 La B contra `tests/scrum173`

**No encontré choque en la transcripción; eso NO prueba que el test real pase.**

`tests/scrum173` está gateado por `QA_DB_TEST` contra una base real. Este árbol no tiene claves de
ninguna base, en la máquina no hay Postgres y CI no pone `QA_DB_TEST`: **el test real no lo ha
corrido nadie con la B puesta.** Lo que se midió son sus casos, transcritos con sus mismas llamadas y
aserciones, sobre el banco:

- Transcritos **6 de 7**: ①, ②, ③, 173b, SCRUM-177 y el de `excluirId` («resellar un alta»). Verdes
  antes de la B y verdes con la B.
- El séptimo —recomputar las cadenas ya persistidas— no es transcribible: mira filas de staging.
- La asimetría: si la transcripción cayera, habría choque y bastaría para parar. Que pase no prueba
  que el real pase; el banco no es Postgres.

`tests/scrum173` **no se ha tocado**.

### Una pérdida de cobertura conocida, no un detalle

El caso «resellar un alta no la encadena a sí misma» **sigue verde, pero con la B ya no ejercita
`excluirId`**: una factura sellada ya no llega a buscar su anterior, así que el parámetro que ese
caso vigilaba deja de ejecutarse en él. *Un test que pasa por otro camino es un test que ha dejado de
vigilar lo que vigilaba.* `excluirId` se queda en el código, sin tocar; si alguien lo rompe, ese caso
ya no lo dirá. Recuperar esa cobertura es una decisión aparte.

## Mutaciones

`docs/master/evidencias/scrum1330/mutar.mjs` y su salida, `mutaciones.json` (dos pasadas, base sin
mutar primero, sobre los dos ficheros de test: 34 casos).

| Mutación | Resultado |
| --- | --- |
| MA · la A no decide (B puesta) | cae 1: el caso de la A |
| MB · la B no decide (A puesta) | caen 7 |
| MAB · ninguna decide | caen 12 |
| MB-lanza · la B lanza en vez de devolver | caen 6, entre ellos la transcripción de «resellar un alta» |
| MB-anterior · la B devuelve como anterior la propia huella | caen 3, entre ellos esa misma transcripción |
| MB-calla · lo conservado se anuncia como un sellado | **MUDA** en la primera pasada; cae tras añadir su caso |

Con MB puesta, ④a y ④f por la ruta siguen verdes: los sujeta la A. Con MA puesta, sólo cae el caso
que cuenta pasadas por `sellarTrasEmision`. Dos guardas redundantes: cada una se ve en lo que la otra
no cubre, y por eso hay un caso para cada una.

## SCRUM-1304 entra aquí

El arreglo de SCRUM-1304 estaba hecho y parado (`docs/master/SCRUM-1304.md`): solo, en ④f era peor
que el defecto. Va en este mismo PR — el GO dice que ninguna de las tres piezas se empuja suelta. Sus
tres casos «RESIDUAL CONOCIDO», que fijaban el re-sellado contando dos sellados, **dicen ahora lo
contrario en este mismo cambio**: una escritura de huella y la fila sin tocar.

Es una excepción a A17 (un ticket, una rama): dos tickets, una rama, decidido por el orquestador. La
rama lleva el nombre del ticket que manda.

## Lo que NO cierra: SCRUM-1333

`sellarTrasEmision` encola el alta para la AEAT después de cada sellado y `VfSubmission` no tiene
único por factura. Medido por la ruta real:

- **④b con A + B: 1 factura, 1 escritura de huella, 2 pasadas por `sellarTrasEmision` y 2 filas en
  `vfSubmission`** con el mismo registro.
- Sin las guardas, la entrega repetida de ④a pasa de 1 a 2 intentos de encolar. Con la A, se queda en 1.
- ④f con la A: 0 pasadas, 0 intentos.
- **El límite:** el 2 sale sólo si la factura es declarable (cliente con NIF, IVA clasificable). Con
  el cobro pelado del banco los dos intentos acaban en `encolado_fallido` y la cola queda en 0 filas.

No se ha tocado: el GO nombra las dos guardas y la cola es otra cosa. Queda fijado en el test como
RESIDUAL CONOCIDO. SCRUM-1333 tiene su propio GO (comentario 17733, «2-Go»), que llegó a la vez que
la orden de cerrar la tanda: autorizado y en la cola, **sin construir**.

Tampoco se tocan los dos eventos `invoiced` de la misma factura en ④b (dichos en SCRUM-1304).

## Lo que cambió fuera de las dos guardas

- **`tests/scrum1258`** (entró en `main` esta noche): su doble de la base entiende exactamente las
  consultas del sellado y revienta con cualquier otra. La B añade una, y al traer `main` cayeron 7
  de sus casos. Se le enseñó esa consulta; sus aserciones no se tocan y cualquier otra sigue
  reventando. Es un cambio en un test para que pase un cambio del sellado, y por eso va dicho aquí.
- **`docs/legal/AUDITORIA_CAMINO_EMISION.md`**: dos coordenadas con testigo movidas por las líneas
  nuevas (`:634`→`:659` y `:248`→`:261`), cazadas por `tests/scrum525d`. Constatado y no corregido:
  tres coordenadas SIN testigo de ese documento a `verifactu.service.ts` (`:527`, `:674`, `:947`) ya
  apuntaban a otra cosa antes de este cambio.

## Lo que se corrió, y lo que no

- Los dos ficheros del ticket: 16 + 18 casos, verdes.
- Barrido dirigido sobre el árbol con `main` `c1fe641c` dentro, en dos mitades: **587 ficheros de
  1.153, 5.087 tests, 5.031 pasan, 1 falla, 55 saltan**. Entran los que tocan el sellado o lo
  modelan con un doble y los que barren el árbol o `docs/master`. Los saltos son de tests gateados
  por una base real (`QA_DB_TEST`, `LIBRO_PG_URL`, `SERIE_PG_URL`, `TRAMOS_PG_URL`).
- El que falla es `tests/scrum754-el-juez-que-oscila.test.mjs` (vigila ficheros que nacen y mueren
  en `tests/`), un caso de 22. **Suelto, dos veces: 22 de 22.** No toca nada de este cambio; la
  causa no está demostrada (hipótesis: otros tests escribiendo en `tests/` a la vez).
- `npm run guards:entrada`: 12 guards, 112 tests, verde.
- **La tanda completa no se ha corrido.** Orden del orquestador al cerrar la tanda: la cubre el CI.
- No medido: la carrera contra un Postgres real, y `tests/scrum173` real.

## Lo que salió mal

- Escribí el aviso de la B sin un caso que lo sujetara, y la mutación salió muda. La misma forma que
  las M4 y M5 de SCRUM-1304, en el mismo puesto.
- Le dije al orquestador «④f con la A: 0 intentos de encolar» antes de medirlo. Lo medí después y es
  cierto, pero lo afirmé por razonamiento. Apuntado en las cicatrices, sin comprobación.
- El primer barrido dirigido elegía ficheros por el nombre de las funciones del sellado. Un doble que
  modela el sellado sin nombrarlo no entraba; lo ensanché a 243 después de que `scrum1258` cayera.

## SCRUM-1330d · `tests/scrum173` real, con la guarda B puesta (jv-j1cg, puesto J1, 26-oct-2026)

**Medido contra:** `origin/main` = `f6a3119675c2584480d846fa0a20572d48cadaa5` · 2026-10-26T16:04:33Z

A9: aviso → cicatriz J1 «Medí el contexto al acabar el arranque y al acabar Jira, y no mandé las cifras en ese momento: fueron juntas en el mensaje del bloqueo, aunque el encargo las pedía al medirlas» — no se pudo comprobar: lo que se dice en un mensaje entre sesiones no pasa por ningún guard del repositorio

Es el punto ③ que dejó abierto c.19519: `tests/scrum173` no había corrido nunca con la B, porque está
gateado por `QA_DB_TEST` y CI lo salta. Sólo medir: no se ha tocado `src/`, ni la emisión, ni
`schema.prisma`, ni `tests/scrum173`.

### Lo corrido

```
node scripts/staging-gated.mjs tests/scrum173-cadena-verifactu-serializada.test.mjs
```

Es el runner de `npm run test:staging:gated`: toma el turno, corre y lo suelta. Las claves las cargó él
mismo (`cargarEnvDelEquipo`, desde el `.env` del checkout principal); no se exportó ninguna a mano.
`dist/` salió de `npm run build` (tsc completo, exit 0) sobre esta misma base, y
`dist/modules/invoicing/domain/verifactu.service.js` lleva el aviso de la B (1 aparición de «ya estaba
sellada»). `_prisma-client-guard` salió 0 con el `node_modules` propio del árbol.

| hijo | `QA_DB_TEST` | tests | pasan | caen | saltan |
|---|---|---|---|---|---|
| a55 | no | 7 | 0 | 0 | 7 |
| bot | no | 7 | 0 | 0 | 7 |
| scrum180 | no | 7 | 0 | 0 | 7 |
| **qa** | **sí** | **7** | **7** | **0** | **0** |
| agregado | | 28 | 7 | 0 | 21 (suma 28, cuadra) |

Exit 0 del runner. El recibo (`.claude/evidencia-tanda.json`, fuera de git) lleva `autotest: true`,
el commit `f6a311967` y el mismo desglose. **La población que cuenta son los 7 del hijo `qa`**: los 21
saltos son los tres hijos aislados, que corren el fichero sin `QA_DB_TEST` porque el modo con argumento
apunta los cuatro al mismo fichero.

### La guarda B se ejercitó: su línea está en la salida

El caso «SCRUM-177: excluirId — resellar un alta no la encadena a sí misma» (test, líneas 246-264)
sella `QA177C-…` y la vuelve a pasar por `applyVeriFactu` (línea 259). En la salida del hijo `qa`:

```
[verifactu] invoice=QA177C-1793030643821 hash=373515B73A2AAB9E…
[verifactu] invoice=QA177C-1793030643821 ya estaba sellada: se conserva su huella 373515B73A2AAB9E… y no se vuelve a sellar
✔ SCRUM-177: excluirId — resellar un alta no la encadena a sí misma (2048.8801ms)
```

La segunda línea sólo la escribe la rama de la B (`src/modules/invoicing/domain/verifactu.service.ts:441`).
Las aserciones que pasan son las de las líneas 260 y 262 (`segundo.vfPrevHash` distinto de la huella
propia, e igual a `''`). **El choque que el ticket temía «por lectura» no existe al correrlo**: la B
devuelve el sello guardado, cuyo `prev` es `''`, y el caso sigue verde. Lo que dijo J1e sigue siendo
cierto: el caso ya no ejercita `excluirId`, porque con la B el segundo paso no llega a buscar el anterior.

### Lo que esto NO mide

- **La base no es la de staging que da nombre al comando: es `yaqu_dev_javier`.** Lo dice el turno
  («turno de staging TOMADO en "yaqu_dev_javier"»), y es la `DATABASE_URL_TESTS` del `.env` del checkout
  principal. El host lo filtra la lista de `_db-guard.mjs` (`STAGING_HOST`); no lo he impreso.
- **El preflight de esquema lo salta el modo con argumento.** Lo corrí aparte con el mismo cargador
  (sólo introspección): exit 3, **la base va POR DELANTE del schema** con 20 objetos (`equipments`,
  `equipment_id` en cuatro tablas, `invoices.retencion_irpf_importe`, entre otros). Es el orden de A5
  (ALTER antes que el PR). No se aplicó nada. Los 7 casos crean facturas y pasaron con esa base.
- **El caso «cadenas YA PERSISTIDAS» es vacío en esta base:** «0 verificadas, 0 no recomputables».
  Pasa sin haber recomputado ninguna huella.
- **No se mutó la B** para ver caer el caso: la línea «ya estaba sellada» es la evidencia de que la
  rama corrió, no de que el test la distinga. Que el test cae sin la B lo midió c.19518 con `scrum1330`,
  no con `scrum173`.
- La carrera ④b contra Postgres real y el doble encolado (②) siguen fuera.

### De paso, sin arreglar

`node scripts/comprobar-claves-bd.mjs` dice «AUSENTE» para las tres claves en este árbol, y el runner
las encuentra en el `.env` del checkout principal. Los dos instrumentos miran sitios distintos.
