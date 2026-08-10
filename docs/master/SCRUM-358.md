# SCRUM-358 · H3 — La clave de idempotencia (informe del 10-ago) + el ALTA idempotente (11-ago)

> **Este fichero tiene DOS entradas.** Arriba, la del 11-ago: lo construido. Abajo, sin tocar, la
> medición del 10-ago que decidió la clave. La medición no se reescribe: es la que sostiene el
> diseño y quien lo discuta tiene que poder leer sobre qué se decidió.

---

# 11-ago-2026 · EL ALTA DE ALBARÁN, IDEMPOTENTE (mitad de SERVIDOR)

**Carril:** H (albarán sin red) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `7f826e6…` · con SCRUM-425 dentro (columna en las tres bases
**y** en `schema.prisma`).

> **Cero `prisma migrate diff`** — ya no está prohibido, pero no hace falta para nada de esto.
> Cliente de Prisma regenerado desde este worktree antes de la primera tanda, y comprobado que
> conoce el campo: `claveIdempotencia String nullable=true`, únicos
> `[["merchantId","claveIdempotencia"],["merchantId","numero"]]`.

## 1 · La rebanada, y lo que NO entra

**Se construye la mitad de SERVIDOR: que el alta sea idempotente.** Es lo que la columna
desbloqueaba, no necesita navegador y se puede probar entera.

**NO se construye la mitad de CLIENTE** —la cola en IndexedDB, el drenado, los reintentos con
espera creciente, el tope de 50, el control del portal cautivo— y **no se finge probada**: el
fichero de tests declara ese hueco en su cabecera. Sigue dependiendo de H5 (almacenamiento) y del
`[HUECO]` de H0/P2 (qué navegadores usan los pros).

## 2 · Las tres preguntas que quedaban del PASO 0

### 3 · ¿Qué devuelve el servidor a una repetición legítima? **El original, con 200**

Se devuelve `yaExiste` **sin reservar número** y con `200`, no `201`. Tres decisiones, cada una con
su motivo:

* **El albarán original, nunca un error.** Un 409 ahí le diría al profesional que salió mal algo
  que salió **bien**, y dejaría a la cola sin el documento con el que cerrar su elemento.
* **200 y no 201.** Se está entregando algo que ya existía; `201` afirma «he creado».
* 🔴 **Y no se reserva número.** Si se reservara antes de mirar la clave, en una repetición ese
  número quedaría **consumido y sin documento**: un **hueco en la serie** abierto por la propia
  idempotencia — justo lo que `allocateAlbaranNumber` vive dentro de la transacción para evitar
  (SCRUM-234/302). **Por eso el orden es cerrojo → constraint → número, y hay test del orden.**

### 4 · Misma clave con contenido distinto: **conflicto, y se nombra qué cambió**

`compararAlta` compara `jobId · modoValoracion · lineas · notas`. Si difieren → **409** con
`numeroOriginal` y `diferencias`. No se devuelve el original (sería tirar el segundo alta en
silencio) ni se crea otro (chocaría contra el único).

> ⚠️ **LÍMITE DECLARADO:** se compara contra el contenido **ACTUAL** del original, porque no se
> guarda ninguna huella de cómo nació — eso pediría otra columna. Si alguien **edita** el albarán y
> luego llega la repetición, saldrá conflicto sobre una repetición legítima. **En el escenario de
> la cola no puede pasar** (si la respuesta se perdió, el pro no sabe que el albarán existe y no ha
> podido editarlo), pero fuera de él sí. Queda escrito en el módulo, no supuesto.

### 5 · Ausencia de clave: **no falla, pero no pasa en silencio**

Sin clave el alta funciona igual —los clientes de hoy no la mandan y los albaranes históricos no la
tienen—, pero la respuesta **lo dice**: `idempotencia: 'no_solicitada' | 'aplicada' | 'repetida'`.

**Por qué importa:** el día que la cola dejara de enviar la clave por un fallo suyo, todo seguiría
en verde con la idempotencia **apagada** y nadie lo notaría. «Con clave» y «sin clave» no pueden
dar la misma salida.

## 3 · La forma copiada, y lo que se copió con ella

`invoiceNumber.service.ts:115-122`, **con su motivo**:

* **Se pregunta al constraint**, por el nombre del índice (`merchantId_claveIdempotencia`): si el
  índice cambiara de forma, esto **no compilaría**.
* **No se captura el `P2002`.** En PostgreSQL una sentencia fallida **aborta la transacción**:
  reintentar dentro de la misma `tx` no es reintentar, es insistir sobre una tx muerta (`25P02`).
  Hay test de que no aparece un `P2002` en el alta.
* **La consulta va DENTRO de `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)`**, cuya clave es
  `merchantId` — exactamente el alcance del índice. Mismo namespace que la numeración **a
  propósito**: es la misma sección crítica (decidir si este alta ocurre y con qué número), y
  separarlas dejaría que dos peticiones con la misma clave pasaran a la vez la comprobación.

**Y una clave demasiado larga se RECHAZA, no se recorta** (`VARCHAR(64)`): recortar convertiría dos
claves con el mismo prefijo en la misma, y la segunda alta se tomaría por repetición de la primera
— **un albarán perdido en silencio**, el modo de fallo por el que el propio ticket descarta el
content hash como clave.

> **Y lo que ya sabíamos de SCRUM-425 sigue valiendo aquí:** `claveIdempotencia` **no viaja al
> duplicar**. Si algo de H3 la copiara por otro camino, chocaría contra el mismo único.

## 4 · Verificación — 9 tests, y tres rojos por el mecanismo

| | Qué | Resultado |
| --- | --- | --- |
| **EL test** | la misma alta dos veces es UNA · **y dos albaranes legítimamente idénticos NO se deduplican** (la búsqueda es por CLAVE, jamás por contenido) | ✅ |
| Conflicto | misma clave + contenido distinto → nombra **cuál** de los cuatro campos cambió | ✅ |
| Clave larga | se rechaza, con control positivo en el tope exacto | ✅ |
| Sin clave | no falla · y las tres salidas se distinguen | ✅ |
| Orden | cerrojo → constraint → número | ✅ |
| `P2002` | no se captura | ✅ |
| Microcopy | el 409 lleva marcador (regla 30) | ✅ |
| SUELO | si no encuentra la ruta o el recorte sale corto, **falla declarándose ciego** | ✅ |

**Los tres rojos, sobre código ya commiteado:**

| Mutación | Cae diciendo |
| --- | --- |
| la consulta de la clave, fuera del cerrojo | *«LA CONSULTA DE LA CLAVE VA FUERA DEL CERROJO … dos peticiones con la misma clave pasan las dos la comprobación»* |
| reservar el número antes de mirar la clave | *«un HUECO EN LA SERIE abierto por la propia idempotencia»* |
| la repetición devuelve 409 en vez del original | *«le diría al profesional que salió mal algo que salió BIEN»* |

### 🔴 Y una mutación que salió VERDE por estar rota ella, no el guard

La primera prueba del orden **pasó**, y el primer impulso fue buscar el hueco en el guard. No
estaba ahí: el fichero tiene **CRLF**, el `replace` de la línea del cerrojo llevaba `\n` y **no
casó**, así que la mutación **duplicó** el cerrojo en vez de moverlo — y con dos, el primero seguía
antes de la búsqueda. **El guard acertaba al pasar.**

La mutación se declaraba «aplicada» porque el texto había cambiado, y eso no es lo mismo que haber
cambiado **lo que se pretendía**. Rehechas las tres con **post-condición explícita** («hay
exactamente un cerrojo y va después de la búsqueda»), y ahí sí cayeron.

> **La lección, dicha para la próxima:** ante un verde bajo mutación, el primer sospechoso es **la
> mutación**, igual que ante un rojo raro el primer sospechoso es el escáner. Una mutación sin
> post-condición es un experimento sin control.

## 5 · Microcopy del 409 — ✅ **APROBADA** (asesor, 11-ago-2026)

```
Este parte ya se creó antes con datos distintos a los que se están enviando ahora.
No hemos creado nada para no duplicarlo: el parte ALB-2026-097 sigue guardado.
Ábrelo desde el trabajo para revisarlo.
```

**El número del original va DENTRO del texto**, no solo en el campo de al lado del JSON: el
profesional lee el mensaje, no la respuesta. En el 409 siempre se tiene (`yaExiste.numero`); sin
él se cae a «el parte original sigue guardado», que es el texto aprobado tal cual.

### 🔴 La corrección que trajo, y por qué quedó como guard

Mi propuesta terminaba en *«Vuelve a crearlo desde el trabajo»*, y **contradice la frase
anterior**: si el original existe y lo que se está evitando es duplicarlo, la salida no puede ser
crear otro.

> **Un mensaje que da una salida que produce el problema que acaba de evitar es peor que uno sin
> salida.**

Y fuera *«datos de envío»*: un fontanero no sabe qué es eso.

**No se queda como nota: se queda como test.** El texto se fija **entero** (reformularlo es cambio
de máster) y, además, hay un invariante aparte que prohíbe que el mensaje vuelva a mandar *crear
otro*. Las dos capas están probadas en rojo por separado:

| Mutación | Cae diciendo |
| --- | --- |
| se cambia la salida a «vuelve a crearlo» | *«el texto del 409 no es el aprobado … no se reformula, se cambia por máster»* |
| se cambia la salida **y** se actualiza el test exacto a juego —lo que haría alguien «arreglándolo»— | *«el mensaje vuelve a mandar CREAR OTRO parte … la salida es ABRIR el que hay»* |

La segunda es la que justifica tener dos capas: la primera sola se puede desactivar editando el
propio test.

Vive en `src/`, fuera del censo de SCRUM-402 (que escanea `public/dashboard/js/`).

## 6 · Lo que no se ha tocado

`prisma/schema.prisma` · el sellado, la huella y `computeAlbaranContentHash` · el camino de emisión
· el mecanismo de firma (que **ya era idempotente**: 409 `albaran_locked`) · la ruta de duplicar ·
ningún `.env` · ninguna base de datos.

---
---

# 10-ago-2026 · LA MEDICIÓN QUE DECIDIÓ LA CLAVE (informe, cero construcción)


**Fecha:** 10-ago-2026 · **Carril:** H (albarán sin red) · **Gate:** sin gate — esta tarea **solo lee**

**Medido contra:** `origin/main` = `db814df3d9b438ca969bdb0ec3c5e9587159bb7e` · 2026-08-10T14:55:00+01:00

> **NO SE HA CONSTRUIDO NADA.** No se ha tocado `prisma/schema.prisma`, ni el mecanismo de firma, ni
> el camino de emisión (leer sí, modificar es STOP — regla 38). **No se ha consultado ninguna base.**
> **No se elige opción**: el §5 las pone con su coste y decide el fundador.

## Paso 0 · chequeo de duplicados

| Comprobación | Resultado |
| --- | --- |
| Ramas remotas con `358` o `idempot` en el nombre | **ninguna** |
| `SCRUM-358` en el árbol | **1 fichero**, y es mío: `docs/master/SCRUM-307.md` |
| `docs/master/SCRUM-358.md` | **no existía** — esta entrada es la primera |
| SCRUM-328 (`86fa3d72`) en `origin/main` | **SÍ** — ancestro ✅ y `docs/master/SCRUM-328.md` existe ✅ |
| SCRUM-307 (`44840ce6`) en `origin/main` | **SÍ** — ancestro ✅ y `docs/master/SCRUM-307.md` existe ✅ |

> **Y la corrección de método, anotada donde se va a volver a leer:** mi comprobación anterior de
> que SCRUM-328 «no estaba en main» **se hizo con una ref vieja**. El `--is-ancestor` era correcto;
> **lo que faltaba era `git fetch origin` antes de medir**. Desde aquí, el orden es: **fetch →
> `--is-ancestor` → `git cat-file -e` del contenido**. Las dos últimas sin la primera miden el
> pasado.

---

# 1 · 🔴 LA CITA ENTERA — y **no habla de idempotencia**

Se pidió leerlo entero antes de decidir nada. Aquí está, sin resumir,
`public/dashboard/js/semaforoFiscal.js:16-26`:

```js
/* ─────────────────────────────────────────────────────────────────────────────────────────
 * CATÁLOGO DE AVISOS
 *
 * Los identificadores son SEMÁNTICOS a propósito, no aleatorios: cuando SCRUM-207 publique el
 * catálogo versionado de verdad, estos se ADOPTAN (mismo id, versión real) en vez de sustituirse.
 * Un uuid aquí obligaría a una migración de datos el día del cableado; un nombre, no.
 *
 * `version: 0` significa «texto todavía no versionado por el catálogo oficial».
 * TODO SCRUM-207: sustituir `version: 0` por la versión real del catálogo y dejar de declarar
 * los textos aquí — pasan a venir en la respuesta del endpoint.
 * ───────────────────────────────────────────────────────────────────────────────────────── */
```

**Lo que ese comentario gobierna es OTRA COSA**, y conviene decirlo con precisión porque en
SCRUM-307 lo cité como si fuera el motivo de no usar uuid *en el navegador*, y no lo es:

* Habla de los **`avisoId` del catálogo de avisos fiscales** (`ROJO_SIN_LINEAS`, `ROJO_ANULADA`…),
  que son **nombres de una CLASE** de aviso.
* Su motivo es **la adopción de un catálogo externo futuro**: SCRUM-207 publicará el catálogo
  oficial, y si hoy el id fuera un uuid, ese día habría que **migrar los datos ya guardados** para
  casarlos con el id oficial. Con un nombre semántico, la adopción es no hacer nada.

**¿Sigue vigente? Sí — para lo suyo. Y NO alcanza a la clave de idempotencia**, por una diferencia
que no es de matiz:

| | `avisoId` del semáforo | Clave de idempotencia de un albarán |
| --- | --- | --- |
| Nombra | una **clase** («este tipo de aviso») | **una ocurrencia única** («este intento concreto») |
| ¿Hay una autoridad futura que también la nombre? | **Sí** — el catálogo de SCRUM-207 | **No.** Nadie va a publicar un catálogo de intentos de creación de albaranes |
| Coste de que sea opaca | **una migración** el día del cableado | **ninguno**: no hay con qué casarla |

> **Conclusión, sin estirarla:** el motivo escrito **no prohíbe una clave opaca aquí**; prohíbe una
> clave opaca **donde vaya a haber que reconciliarla con un nombre de otro**. No era un principio
> general contra los identificadores aleatorios, y tampoco era circunstancial: es una regla correcta
> con un alcance concreto.
>
> **Lo que sí se lleva a esta decisión** es su pregunta, que vale igual: *«¿qué pasa el día del
> cableado?»*. Para la clave de idempotencia el día del cableado es **el día que se guarda en la
> base** — y eso es una columna nueva, que es del fundador (§5).

---

# 2 · Medida 1 · Dónde nace el número, hoy — **[MEDIDO]**

**El suelo no se dispara: el sitio existe y son dos.**

| Camino | Ancla de HOY | Qué hace |
| --- | --- | --- |
| **Crear** — `POST /admin/jobs/:id/albaranes` | `src/modules/jobs/app/routes/jobs.routes.ts:732-744` | `prisma.$transaction(async (tx) => { const numero = await allocateAlbaranNumber(tx, …); return tx.albaran.create({…}) })` |
| **Duplicar** — SCRUM-302 | `src/modules/jobs/app/routes/albaranes.routes.ts:627` | misma forma, dentro de su `tx` |
| **La reserva** | `src/modules/jobs/domain/albaranNumber.service.ts:77-102` | `allocateAlbaranNumber(tx, merchantId, now)` |

**Ancla de hoy para lo que preguntabas:** H0 citaba `jobs.routes.ts:681`; **hoy es `:733`**. El
fichero se movió con SCRUM-347 y SCRUM-372. La forma es idéntica.

---

# 3 · Medida 2 · Qué protege esa transacción — **son DOS cosas, no una**

Y esto es lo que puede romper una clave mal puesta.

**(a) Que no haya DUPLICADOS** — `albaranNumber.service.ts:88`, primera sentencia:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SERIE_LOCK_NS}::int, ${merchantId}::int)`;
```

SCRUM-234, con su motivo escrito al lado (`:82-87`): *«misma carrera y mismo arreglo que
`allocateInvoiceNumber`: read-then-write con valor absoluto, que no serializa en READ COMMITTED»*.
`SERIE_LOCK_NS = 1749` (`invoiceNumber.service.ts:79`).

**(b) Que no haya HUECOS EN LA SERIE** — cabecera del fichero, `:7-9`: *«contador en Merchant,
reserva **DENTRO de la transacción del create (sin huecos si el create falla)** y reset anual»*. Si
el `create` falla, el `nextAlbaranNumber` **se deshace con él**.

Y el cerrojo es **de transacción**, con la consecuencia dicha en `invoiceNumber.service.ts:276-279`:

> *«El cerrojo es de TRANSACCIÓN: se libera al commit. Eso es lo correcto —cubre reserva Y creación,
> que viven en la misma `tx`— pero significa que si alguien llamase a esta función con el cliente
> GLOBAL en vez de con una `tx`, el lock se tomaría y liberaría en el mismo instante y no serviría
> de nada.»*

## 🔴 Lo que esto le exige a la clave de idempotencia

**Confirmado: sigue siendo así.** Y de ahí salen dos requisitos que no son de estilo:

1. **La comprobación de la clave tiene que ir DENTRO de la misma `tx` y DESPUÉS del cerrojo.**
   Comprobarla antes de abrir la transacción reintroduce exactamente la carrera de SCRUM-234: dos
   reintentos simultáneos pasan los dos el «no la he visto» y **se llevan dos números**.
2. **No se puede "intentar crear y capturar el `P2002`".** Está medido y escrito en
   `invoiceNumber.service.ts:104-113`:

   > *«el `P2002` no es capturable aquí … en PostgreSQL una sentencia fallida **aborta la
   > transacción**. El segundo intento no daría otro número, daría `25P02 current transaction is
   > aborted`. **Reintentar dentro de la misma `tx` no es reintentar: es insistir sobre una tx
   > muerta.**»*

   Y la alternativa que la casa ya usa, en las líneas siguientes (`:115-122`): **preguntarle al
   propio constraint dentro del cerrojo**, porque *«la clave del cerrojo es `merchantId` —
   exactamente el alcance del índice»*, así que dentro de él la pregunta **no tiene carrera**.

**Esa es la forma que este ticket puede copiar**, y ya está probada en casa.

---

# 4 · Medida 3 · Caminos idempotentes que YA existen — **tres formas, y no valen lo mismo**

| # | Dónde | Forma | Límite **medido** |
| --- | --- | --- | --- |
| **F1** | `stripe.routes.ts:20-27` — `isDuplicateStripeEvent` | **`Set` + array en memoria del proceso**, tope 500 | **Se pierde al reiniciar** (cada merge a `main` redeploya) y **no se comparte entre instancias**. Sirve para un webhook que reintenta en segundos; **no para un albarán que se reintenta horas después** |
| **F2** | `products.routes.ts:67`, `:119` · `products.service.ts:187` | **Unicidad en BD + tragarse el `P2002`** — `if (e?.code !== 'P2002') throw e; // duplicado → idempotente` | Funciona porque **ahí no hay transacción con un número reservado**. Dentro de la `tx` del albarán choca con el `25P02` del §3 |
| **F3** | `invoiceNumber.service.ts:115-122` | **Preguntar al constraint DENTRO del `pg_advisory_xact_lock`** | Ninguno para este caso: **es la única de las tres que ya convive con la reserva del número** |

**Y una cuarta forma, para acuñar el identificador (no para reconciliarlo):** la casa tiene un
patrón único y consistente para tokens opacos — `crypto.randomBytes(16).toString('hex')` en
`quoteToken.service.ts:20`, `albaranWhatsApp.service.ts:132`, `customerAdmin.ts:7`,
`lib/invoicing.ts:149`. **Todos en el SERVIDOR.** En `public/` hay **cero** usos de Web Crypto
(`crypto.randomUUID`, `getRandomValues`, `subtle`): lo que se elija aquí es **el primero**.

> ⚠️ **Y el contraejemplo, con su ancla, para que no se copie por error:** `Math.random()` se usa
> hoy para la referencia del justificante (`invoiceNumber.service.ts:88`, `utils.ts:70`) — es
> SCRUM-396, abierto. El equivalente de navegador de `randomBytes` **no es `Math.random()`**: es
> `crypto.getRandomValues()` / `crypto.randomUUID()`, de la Web Crypto API, criptográficamente
> fuertes. `randomUUID()` **exige contexto seguro** (HTTPS o localhost) — `yaqu.app` lo es.

---

# 5 · Medida 4 · El caso que decide — **y primero, un hallazgo que lo parte en dos**

**Firmar YA es idempotente; crear NO lo es.** No son el mismo problema y hoy no se comportan igual.

| Operación | ¿Qué pasa hoy si el primer envío SÍ había llegado? | Ancla |
| --- | --- | --- |
| **Firmar** `POST /admin/albaranes/:id/firmar` | **409 `albaran_locked`** — *«Este albarán ya está firmado.»* **No se duplica nada.** Y la ruta **no abre transacción**: es un `update` directo | `albaranes.routes.ts:644-646` |
| **Crear** `POST /admin/jobs/:id/albaranes` | **Nada lo impide: dos albaranes, dos números** de la serie, los dos válidos | `jobs.routes.ts:732-744` |

Y el camino de firma **ya sabe distinguir el fallo de red**, con microcopy aprobada
(`albaranDetailView.js:25`): *«No se ha podido conectar. La firma sigue en pantalla: inténtalo otra
vez cuando tengas señal.»* — más el arreglo de SCRUM-404 que deja el trazo en pantalla.

> **Lo que queda vivo en el camino de firma no es un duplicado, es una ESCENA**, y está descrita en
> `albaranDetailView.js:405-408` (SCRUM-379): si el envío llegó pero la respuesta se perdió, el pro
> *«vuelve a pulsar "Firmar aquí mismo", le pide al cliente que firme POR SEGUNDA VEZ delante de él,
> y al terminar lee "Este albarán ya está firmado" (409). Ningún dato roto y la peor escena.»*

**Así que la clave de idempotencia es del ALTA del albarán.** Las opciones son éstas.

## Las cuatro opciones, con su coste

### Opción 1 · Clave del cliente, comprobada dentro del cerrojo *(la forma F3)*

* **Cómo:** el navegador acuña la clave con **Web Crypto**; viaja en el cuerpo; el servidor, dentro
  de la `tx` y **después** del `pg_advisory_xact_lock`, pregunta si ya hay albarán con esa clave para
  ese merchant. Si lo hay → devuelve **ese**. Si no → reserva número y crea.
* **Cuesta:** 🔴 **una columna nueva en `Albaran` + `@@unique([merchantId, clave])`.** Eso es
  `prisma/schema.prisma` → **STOP: es tuyo, y este informe no lo toca.** Medido: **el modelo `Albaran`
  no tiene hoy ni un campo libre** donde meterla — los 23 campos son semánticos.
  Y necesita **dónde guardar la clave en el móvil mientras no hay red** → IndexedDB, que **no
  existe** (H5).
* **Da:** lo único que sobrevive a un reinicio y a varias instancias, con la forma ya probada en casa.

### Opción 2 · Memoria del proceso *(la forma F1, la de Stripe)*

* **Cuesta:** ~10 líneas. **Cero schema, cero migración, cero STOP.**
* **Pierde, medido:** se borra en cada redeploy y no se comparte entre instancias. **El escenario del
  bloque H es justo el que no cubre:** el pro sale del sótano al final de la jornada y reintenta
  **horas** después. Stripe reintenta en segundos; un albarán, no.

### Opción 3 · Sin clave: deducirlo del contenido

* **Cómo:** mismo `jobId` + mismas líneas + ventana de tiempo → se toma por el mismo.
* **Cuesta:** cero schema.
* **Pierde:** **adivina, y hay un caso legítimo que rompe.** `albaranDuplicado.ts:4-5` dice que *«en
  una reforma de tres semanas **cada día es un parte**»* y SCRUM-302 existe para **duplicar** el de
  ayer: **dos albaranes con el mismo contenido son normales aquí**. Esta opción convertiría una
  función del producto en un falso positivo.

### Opción 4 · No crear sin red: la cola guarda el borrador y crea al volver

* **Cómo:** offline solo se guarda borrador + firma; el albarán nace con red.
* **Cuesta:** 🔴 **toca el mecanismo de firma → STOP.** Y el motivo es medido: **el número está DENTRO
  del contenido sellado** — `contenidoCanonico` lo incluye como `numero` (`albaran.service.ts:399`,
  v:1; igual en v:2). Firmar antes de tener número obliga a **sellar sin número o resellar después**,
  y resellar es cambiar la evidencia de un documento ya firmado.
* **Da:** el problema de reconciliar desaparece… **hasta que la cola reintente**, que es el mismo
  problema movido de sitio.

## El resumen que pediste, en una tabla

| | Schema | STOP | Sobrevive a reinicio | Sobrevive a horas | Adivina |
| --- | --- | --- | --- | --- | --- |
| **1 · clave del cliente + cerrojo** | **sí (columna)** | **sí** | **sí** | **sí** | no |
| **2 · memoria del proceso** | no | no | **no** | **no** | no |
| **3 · por contenido** | no | no | sí | sí | **sí** |
| **4 · crear al volver** | no | **sí (firma)** | — | — | no |

**No elijo.** Lo que sí digo, porque es medida y no opinión: **las opciones 2 y 3 no cubren el
escenario que el bloque H existe para cerrar** —la 2 por el tiempo, la 3 porque choca con SCRUM-302—
y **las opciones 1 y 4 pasan las dos por una puerta tuya**: la 1 por el schema, la 4 por la firma.

---

# 6 · Lo que hay que saber antes de decidir

* **El enunciado real de SCRUM-358 sigue sin estar en el repo** (solo Jira). Este informe mide **la
  clave de idempotencia** tal como la definió H0 y como la pediste; si el ticket pide algo más, no
  está contrastado.
* **La decisión no desbloquea H3 sola:** sigue faltando el almacén (IndexedDB = cero) y el hash de
  navegador (SCRUM-307 §1②).

# 7 · Lo que no se ha tocado

`prisma/schema.prisma` · el mecanismo de firma · el camino de emisión (leído, no modificado — regla
38) · `public/**` · `src/**` · ninguna base de datos. **Cero construcción.** El único fichero de este
commit es este documento.
