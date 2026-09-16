# SCRUM-795 · Quién crea clientes, y quién se los queda

**Fecha:** 6-sep-2026 · **Carril:** producto · backend clientes — **MEDICIÓN** · **Gate:** sin gate
**Medido contra:** `origin/main` = `95be56e4dd523b45d3046bda8cf09578ff953ab8` · 2026-09-06T21:38:12+01:00
**Tanda:** 5692 tests, 5596 pass, 0 fail, 96 skipped

> 🛑 **ESTE TICKET NO ARREGLA NADA.** Ni una línea de `src/`, ni `prisma/schema.prisma`, ni
> `ensurePortalToken` (lo lleva SCRUM-767). Lo único que se entrega es
> `scripts/_censo-alta-de-cliente.mjs`, un instrumento de medición — no un guard.

---

## 🔴 EL CONTROL QUE DECIDE — provocado por el camino real, contra desarrollo

Handler **compilado y real** de `charges.routes.ts`, montado en express, base doblada por
`global.prisma` (el punto que ofrece `prisma.ts:13`), contra `…/yaqu_dev_javier` verificado como
DESARROLLO por `_db-guard.mjs` antes de abrir nada.

```
POST /charges → HTTP 201
  cliente id=902  merchantId=1  portalToken=NULL
  cargo   id=136  merchantId=1006
  merchant que hizo la petición : 1006
  merchant DUEÑO del cliente    : 1

¿LO VE ALGUIEN QUE NO DEBERÍA?
  listando como merchant 1 (demo)      : 1 coincidencia 🔴 id=902
  listando como merchant 1006 (el suyo): 0 coincidencias
```

**Sí aparece.** El demo lo ve; el dueño no ve a su propio cliente.

### Pero el diagnóstico de partida era inexacto, y en los dos sentidos

El encargo decía «un cliente sin merchantId… un registro que no pertenece a nadie». **Medido en el
schema:**

```prisma
merchantId  Int  @default(1) @map("merchant_id")
```

No es nullable. **No nace sin dueño: nace del merchant 1, que es el demo (regla 8).** Menos grave
que «de todos» —no lo ve cualquiera—, y más grave en la otra dirección: el dato aterriza en una
cuenta real y operada, y el profesional que lo creó **pierde a su cliente de su propia lista**.

### Lo que acota la urgencia, medido y no supuesto

- **`/charges` no es público:** `app.ts:334` → `app.use('/charges', requireInternalSecret, chargesRouter)`.
- **Ningún llamador del árbol hace `POST /charges` con `customer` dentro.** El panel usa
  `/admin/charges/…`, que es otro router; `app.ts:305` dice que a `/charges` lo llama CI.
- **0 cargos con cliente de otro merchant** en desarrollo (foto de las 20:0x del 6-sep-2026).

---

## ① EL CENSO DEL ALTA — `scripts/_censo-alta-de-cliente.mjs`

Por AST y con la población **derivada del schema**: qué modelos existen y qué forma tiene su
`merchantId` sale de leer `prisma/schema.prisma`. Ninguna lista cableada — sería un censo
congelado el día que se escribió (SCRUM-778).

**Sobre `src/` + `scripts/`, árbol `95be56e4`: 91 creaciones de fila, 7 de `Customer`.**

| camino | `merchantId` | `portalToken` |
| --- | --- | --- |
| `src/modules/billing/app/routes/charges.routes.ts:24` | **NO** | **NO** |
| `src/modules/system/customerAdmin.ts:147` (`createCustomer`) | sí | sí |
| `src/modules/whatsappBot/domain/botFlow.service.ts:264` | sí | **NO** |
| `scripts/e2e-critico.mjs:122` | sí | **NO** |
| `scripts/medir-concurrencia-emision.mjs:96` | sí | **NO** |
| `scripts/seed-staging.mjs:110` | sí | **NO** |
| `scripts/seed-video.mjs:390` | sí | **NO** |

**Vía `createCustomer` (el camino real): 4 llamadores** — `customersAdmin.routes.ts:106`,
`scripts/seed-demo.mjs:301`, y dos del panel (`customersView.js:1481`, `homeView.js:1240`).

**Creaciones ANIDADAS de `Customer` (`{ Customer: { create: … } }`): 0.**
**En `tests/`: 281 creaciones, 78 de `Customer`, 0 donaciones.**

### ✅ Control positivo — los tres caminos conocidos

| camino | resultado |
| --- | --- |
| `botFlow.service.ts:264` | ✔ lo ve (creación directa) |
| `charges.routes.ts:24` | ✔ lo ve (creación directa) |
| sembrador (`seed-demo.mjs`) | ✔ lo ve — **pero ya no como creación directa** |

🔴 **El tercero cambió de cubo mientras medía, y se dice en vez de esconderse:** al mezclar `main`
entró **SCRUM-767**, que pasó el sembrador a `createCustomer(DEMO_ID, c)`. El censo lo encuentra,
en la lista de llamadores del camino real. En la foto anterior (antes de mezclar) aparecía como
`scripts/seed-demo.mjs:276`, creación directa con `portalToken` no escrito.

---

## ② 🔴 LA DONACIÓN SILENCIOSA — la cifra que decide

**De los 27 modelos del schema, 23 tienen `merchantId`. De esos, EXACTAMENTE UNO lo tiene con
`@default(1)`: `Customer`.**

| forma de la columna | modelos | creaciones | **omiten `merchantId`** | no se sabe |
| --- | --- | --- | --- | --- |
| `@default(1)` | 1 (`Customer`) | 7 | **1** | 0 |
| nullable (`Int?`) | 1 (`BotSession`) | 1 | 0 | 0 |
| obligatorio | 21 | 71 | 0 | 7 |

> ### 🔴 **UN (1) `create` en todo el árbol omite `merchantId` sobre una columna con `@default(1)`:**
> ### `src/modules/billing/app/routes/charges.routes.ts:24`

**✅ Control positivo del punto 6:** el censo encuentra ese camino, que es el que ya sabíamos que
omite el `merchantId`. Sin eso, la cifra de arriba no valdría.

**Por qué el resto no es riesgo silencioso:** en una columna **obligatoria** una omisión no dona,
**Prisma se niega** — el fallo es ruidoso y sale al primer intento. Los 7 «no se sabe» son todos
de columna obligatoria (`Albaran`, `AlbaranLineaFacturada` ×2, `Job`, `WhatsAppMessage`,
`AuditLog` ×2) y construyen su `data` fuera del literal o con spread: **no se dan por buenos ni
por malos, se declaran**.

**La superficie del riesgo es, por tanto, `Customer` y sólo `Customer`.** Cualquier decisión sobre
el `@default(1)` afecta a un modelo, no a veintitrés.

---

## ③ LA FICHA 360 CONTRA LA LISTA — recomendación, no construcción

| | qué hace | consecuencia |
| --- | --- | --- |
| **LISTA** (`customersView.js:630`) | pinta «Portal» **siempre**; al pulsar llama a `GET /admin/customers/:id/portal-url` | siempre funciona — **porque ese GET ESCRIBE**: `ensurePortalToken` hace `prisma.customer.update` |
| **FICHA 360** (`customerDetailView.js:76`) | pinta `🔗 Portal` **sólo si** `customer.portalUrl` | sin token **el botón no existe**. No falla el enlace: desaparece, sin decir nada |

El detalle calcula `portalUrl` en crudo (`customersAdmin.routes.ts:262`):
`customer.portalToken ? url : null`. No cura.

### Cuál es la correcta, y qué recomiendo

**Ninguna de las dos lo es del todo, y la que «funciona» lo hace por el motivo equivocado:** la
lista sólo acierta porque hay una **escritura dentro de un GET**. Eso no es el patrón a extender.

**Recomiendo el arreglo DE PANTALLA:** que la ficha 360 pinte el botón **siempre**, como la lista,
y llame al mismo `/portal-url` al pulsar. Motivos:

1. **No añade una segunda escritura dentro de un GET.** Hacer que el endpoint del detalle cure
   convertiría *otro* GET —el de la ficha, que se llama al abrirla— en una escritura, y encima una
   que se dispara sola sin que nadie pulse nada.
2. **Alinea las dos pantallas en un solo comportamiento**, que es lo que hoy no pasa.
3. **No toca `ensurePortalToken`**, que lleva otra sesión (SCRUM-767).

⚠️ Y la salvedad honesta: eso deja en pie la escritura-dentro-de-GET que ya existe. **No la
resuelve, la contiene.** Si se quiere quitar, es otro ticket y no es de pantalla.

---

## ④ LOS CLIENTES SIN TOKEN, POR ORIGEN

> ⚠️ **FOTO de una base COMPARTIDA.** `…/yaqu_dev_javier`, **2026-09-06T20:25:52Z**. Otras
> sesiones la editan mientras se mide.

**14 clientes · 11 sin token · 3 con token.**

| origen | cuántos | cómo se atribuye |
| --- | --- | --- |
| **sembrador** (`seed-demo.mjs`) | **7** | merchant 1, creados en el mismo segundo (05:20:47–49), y **los seis nombres comprobados están en el fuente del sembrador** (control negativo del mismo grep: 0) |
| **fixtures de test** (`scrum74` / `scrum85`) | **3** | «Cliente Secreto QA-S74-A», merchants 114/173/210 |
| **sin atribuir** | **1** | «Cliente QA», merchant 2, 23-jul-2026. Con las señales disponibles no se puede decir de dónde salió |

Suma: 7 + 3 + 1 = **11** ✔. No hay columna de origen: la atribución se **infiere** de merchant,
sello de tiempo y nombre, y donde no llega **se declara sin atribuir** en vez de repartirse.

---

## 🔴 LA BASE DE DEV SE MUEVE — y lo mediste tú mismo en mí

Tres censos míos del mismo día, sobre la misma base:

| hora (UTC) | clientes | sin token |
| --- | --- | --- |
| ~20:0x | 17 | 14 |
| ~20:2x (tras mi provocación y su limpieza) | 16 | 13 |
| 20:25:52 | **14** | **11** |

La diferencia **no es error mío**: comparando merchant a merchant, entre la primera y la segunda
desapareció el cliente del **merchant 1002** —limpieza de otra sesión— y mi propia fila sí volvió
(merchant 1: 7 → 8 → 7). **Toda cifra de dev de aquí en adelante lleva su hora.** El «11 de 14»
del encargo era cierto, dejó de serlo, y volvió a serlo en cinco horas.

---

## HUECOS DECLARADOS

**a) Lo que el censo NO ve**, y por qué no se da por bueno: `data` construido fuera del literal,
receptor con alias (`const t = tx.customer`), SQL en crudo, y migraciones a mano. Los dos primeros
salen como **«no se sabe»**, que es un resultado distinto de «omite».

**b) El censo mide `src/` y `scripts/`.** `tests/` se midió aparte (0 donaciones) y `public/` sólo
para los llamadores de `createCustomer`.

**c) Un defecto propio, corregido leyendo la primera salida.** El censo marcaba ILEGIBLE cualquier
literal con `...spread`, y con eso `createCustomer` —el único camino que hace las dos cosas bien—
salía como «no se sabe». La regla correcta es asimétrica: clave **visible** = la escribe (haya
spread o no); **ausente sin spread** = la omite; **ausente con spread** = no se sabe.

**d) `DATABASE_URL_TESTS` no se puede verificar en este worktree:** `b16` no está dado de alta en
`DESTINOS_ESPERADOS…porWorktree`. **No se ha dado de alta**, porque no sé qué base le toca a este
carril e inventármelo sería aprobar a ciegas. No hizo falta: sólo se usó `_DEV`.

**e) La tanda gateada (`npm run test:staging:gated`) NO se ha corrido:** necesita staging y su
turno. Este ticket no toca ninguna ruta ni el schema.

**f) Limpieza de lo sembrado en dev:** 0 clientes y 0 merchants con la marca `QA795`, verificado.
La primera limpieza me falló —usé un modelo inexistente, `chargeEvent`— y dejó tres filas; se
borraron en una segunda pasada comprobada.

---

# SCRUM-795 · APÉNDICE · re-medido tras la interrupción, sobre un árbol que se movió

**Fecha:** 6-sep-2026 · **Carril:** producto · backend clientes — **MEDICIÓN** · **Gate:** sin gate
**Medido contra:** `origin/main` = `5af8e7e9cdcd15ac90eb9b8a1473737872b6625c` · 2026-09-07T01:36:00+01:00
**Tanda:** 5714 tests, 5612 pass, 0 fail, 102 skipped · `meta:mutaciones`: vivas 95 · mudas 0 · ciegas 0

El ticket se pausó a mitad para cerrar el rojo de CI de SCRUM-778. Al volver, `main` había
avanzado y **traía cambios en lo que este censo mide**, así que las cifras se rehacen en vez de
citarse. Lo que sigue **sustituye** a las medidas del cuerpo de la entrada donde discrepe.

## Lo que main movió, y lo que no

`git log 8c03231a..origin/main` sobre los ficheros medidos devuelve **un** commit:
**SCRUM-793**, que cerró la carrera del token del portal por el `WHERE`. Tocó
`ensurePortalToken`, **no los caminos de alta**.

**El censo no se mueve** (árbol `ce189353`, 2026-09-06T22:09:25Z): 91 creaciones, mismas 7 de
`Customer`, misma tabla de `merchantId`/`portalToken`, mismos 4 llamadores de `createCustomer`.

## ⑥ La cifra que decide — sin cambio

> **UN (1) `create` en todo el árbol omite `merchantId` sobre una columna con `@default(1)`:**
> **`src/modules/billing/app/routes/charges.routes.ts:24`**

| forma de la columna | modelos | creaciones | omiten | no se sabe |
| --- | --- | --- | --- | --- |
| `@default(1)` | **1** (`Customer`) | 7 | **1** | 0 |
| nullable | 1 (`BotSession`) | 1 | 0 | 0 |
| obligatorio | 21 | 71 | 0 | 7 |

**✅ Control positivo del punto 6:** encuentra `charges.routes.ts:24`, que es el que ya sabíamos.
**✅ Control de los tres caminos:** `botFlow:264` ✔ directo · `charges:24` ✔ directo · sembrador ✔
vía `createCustomer` (SCRUM-767 lo movió de cubo, y se dice en vez de esconderse).

## ④ La ficha 360 — la recomendación se sostiene, y ahora mejor fundada

Comprobado sobre el árbol de hoy: la 360 sigue leyendo en crudo
(`customerDetailView.js:76`, y `customersAdmin.routes.ts:262` calcula
`customer.portalToken ? url : null`); la lista sigue pintando siempre.

Y **`ensurePortalToken` sigue escribiendo dentro de un GET** — SCRUM-793 lo hizo más correcto
(`updateMany` con `portalToken: null` en el `WHERE`, y el `merchantId` también en la escritura),
pero sigue siendo una escritura. Eso **refuerza** la recomendación: el arreglo es **de pantalla**
—que la 360 pinte el botón siempre y llame al mismo `/portal-url`—, porque curar en el endpoint
del detalle metería una **segunda** escritura dentro de un GET, y encima disparada sola al abrir
la ficha. Contiene el problema; no lo resuelve.

## ⑤ Los clientes sin token — y dos series que no cuadran

> ⚠️ **FOTO de una base COMPARTIDA.** `…/yaqu_dev_javier`, **2026-09-06T22:09:38Z**.

**14 clientes · 11 sin token · 3 con token.**

| origen | cuántos |
| --- | --- |
| sembrador (`seed-demo.mjs`) | **7** (merchant 1, mismo segundo 05:20:47–49, seis nombres verificados en el fuente) |
| fixtures de test (`scrum74`/`scrum85`) | **3** |
| sin atribuir | **1** («Cliente QA», merchant 2, 23-jul) |

### 🔴 El desacuerdo con S3, dicho y no redondeado

El encargo cita que S3 midió **14 de 16** hacia las 21:00. Mi serie del mismo día no pasa por ahí:

| hora (UTC) | clientes | sin token | quién |
| --- | --- | --- | --- |
| ~20:0x | 17 | 14 | yo |
| ~20:2x | 16 | 13 | yo (tras mi provocación y su limpieza) |
| 20:25:52 | 14 | 11 | yo |
| ~21:00 | 16 | 14 | S3 (citado, no medido por mí) |
| **22:09:38** | **14** | **11** | yo |

**No lo resuelvo inventando una explicación.** La hipótesis que encaja —y va marcada como
hipótesis— es que los tests gateados de SCRUM-793 **escriben clientes**: su motivo de salto lo
dice literalmente («necesita Postgres real: escribe clientes y provoca concurrencia»). Filas
transitorias de una pasada gateada explicarían un 16 entre dos 14. **No lo observé**, así que no
lo afirmo.

Lo que sí es un hecho es lo de fondo, y ya está escrito: **la base de dev es compartida y se
mueve**. Dos sesiones que la miden con una hora de diferencia obtienen números distintos y las
dos tienen razón.

## Lo que no se ha podido tener en cuenta

El encargo dice que **la decisión del backfill de `portalToken` se ha plegado a este ticket, como
comentario en Jira**. **No tengo acceso a Jira y ese comentario no está en el árbol**, así que no
he podido tenerlo presente al medir. Si contiene un criterio que cambie qué hay que contar —por
ejemplo, si el backfill debe alcanzar también a los 3 clientes de fixtures o sólo a los 7 del
demo—, esta medición no lo refleja. Se dice aquí en vez de suponerlo.

## Y el árbol se movió OTRA VEZ mientras se escribía este apéndice

El ancla de arriba es la **segunda**: la primera (`50312d32`, 6-sep 23:10) caducó antes de empujar
porque `main` avanzó a `5af8e7e9` — entre otras cosas, con **mi propio SCRUM-778 ya mergeado** y
con **SCRUM-792**, que toca `customersView.js`, una de las dos pantallas de ④.

Se volvió a medir todo sobre el árbol mezclado (`61029954`, 2026-09-07T00:35Z) en vez de citar lo
de antes:

| medida | resultado |
| --- | --- |
| creaciones en `src/`+`scripts/` | **91** · suelo `[]` |
| caminos directos de `Customer` | **7** |
| 🔴 donaciones silenciosas | **1** — `charges.routes.ts:24` |
| modelos con `merchantId @default(1)` | **1** — `Customer` |
| controles | `botFlow` ✔ · `charges` ✔ · sembrador ✔ vía `createCustomer` |
| dev (`…/yaqu_dev_javier`) | **14 clientes · 11 sin token** · 2026-09-07T00:35:46Z |

Y las dos pantallas, re-verificadas tras SCRUM-792: la lista **sigue** pintando siempre y curando
al pulsar (`customersView.js:649` y `:655` — el ticket sólo movió líneas), y la 360 **sigue**
leyendo en crudo (`customerDetailView.js:76`). **La recomendación de ④ no cambia.**

Nada de esto altera ninguna cifra. Se deja escrito porque el hecho —que el árbol y la base se
mueven bajo una medición larga— es parte del resultado, no ruido alrededor.

## Y un fallo fantasma que me hice yo, por segunda vez

Corriendo la tanda con reporter TAP **a la vez que** `npm run meta:mutaciones`, salió **1 fallo**:

```
not ok 5404 - SCRUM-745/748 · 🔴 el meta-guard mira la LÍNEA BASE, y NO reconoce mensajes de error
  error: '🔴 el meta-guard ya no consulta la pasada limpia.'
```

No era un fallo: en ese instante el meta-guard tenía **mutado su propio fichero** —la mutación ①
de SCRUM-745 sustituye la comprobación de línea base por `if (false)`— y la tanda leyó ese árbol.
Repetida **sola**, tras terminar el meta-guard: **0 fallos**.

Ya lo había medido el 6-sep y volví a hacerlo. La regla, escrita otra vez y con su motivo: **nada
en paralelo con `meta:mutaciones`, ni siquiera una lectura de la suite**, porque durante su pasada
el árbol NO es el árbol — y una tanda concurrente no mide lo que cree medir.

---

# SCRUM-795 · APÉNDICE · el botón del portal, puesto de acuerdo con la lista

**Fecha:** 7-sep-2026 · **Carril:** producto · front clientes · **Gate:** sin gate
**Medido contra:** `origin/main` = `349350c8a7a34f24e9263aba1ca2af36e3cb4a91` · 2026-09-07T02:39:27+01:00
**Tanda:** 5753 tests, 5651 pass, 0 fail, 102 skipped

La recomendación ④ de esta misma entrada queda ejecutada: **arreglo de pantalla**, no de endpoint.

## 🔴 EL ROJO, en navegador real — antes de tocar nada

`npm run guard:portal-en-la-ficha` (Edge vía puppeteer-core, DOM renderizado):

```
  caso        LISTA    FICHA 360
  SIN token   botón    NO EXISTE     ← el defecto
  CON token   botón    botón         ← control positivo
                                        exit 1
```

**Se mide el DOM, no el fuente**: un `${cond ? botón : ''}` bien puesto y uno mal puesto se leen
igual (lección de SCRUM-515). Las vistas son las de verdad, con sus dependencias reales
(`api.js`, `csvImport.js`, `filtroClientes.js` en el orden que declara `_banco-vistas.mjs`); lo
único doblado es `apiRequest`, que es el punto por el que las dos piden datos.

## El cambio

`customerDetailView.js`: el botón deja de colgar de `customer.portalUrl` y **se pinta siempre**;
la URL se pide **al pulsar**, con la misma llamada que ya hacía la lista. Sin estado nuevo y sin
literal nuevo: el rótulo `🔗 Portal` ya estaba en el fichero y el texto de error es el que la
lista usa para esta misma acción.

```
  caso        LISTA    FICHA 360
  SIN token   botón    botón
  CON token   botón    botón          exit 0
```

## 🔴 Y LA MITAD QUE MÁS IMPORTA: no se ha añadido una escritura

Se descartó curar en el endpoint del detalle **con este argumento**, así que caer en ello al
arreglarlo habría sido peor que no arreglarlo. **Medido**, no razonado, con el contador de
consultas de SCRUM-58 (`QA_QUERY_LOG=1`), contra desarrollo y por el camino real (el handler
compilado, con `req.merchantId` inyectado):

| | consultas | **escrituras** |
| --- | --- | --- |
| ① ABRIR la ficha (`GET /detail`) | 5 | **0** ✅ |
| ② PULSAR el botón (`GET /portal-url`) | 4 | **1** — `UPDATE "customers" SET "portal_token" …` ✅ |

Token presente tras el clic. Limpieza verificada: 0 clientes y 0 merchants con la marca.

## Lo que vigila la suite (el navegador no corre en `npm test`)

`tests/scrum795-el-portal-en-la-ficha.test.mjs`, por AST y con dos mutaciones declaradas:
① el botón no cuelga de una condición sobre `portalUrl`; ② la llamada a `/portal-url` está
**dentro del manejador del clic**, nunca en el render. Con control positivo del detector: se le
enseña una llamada puesta en el render (la reconoce) y una dentro de un `onclick` (no la acusa).

## 🔴 CUATRO TRINQUETES DE LA CASA ME CAZARON, y uno era un defecto de verdad

| trinquete | qué cazó |
| --- | --- |
| **SCRUM-644** | 🔴 **defecto real mío**: mi primera versión pintaba `err.message` del servidor en la ficha, cuyo techo de mensajes crudos es CERO. Un `customer_not_found` en pantalla es una tubería interna asomando. Corregido: el texto de la lista, sin la parte que filtra el mensaje |
| **SCRUM-262** | mi guard sembraba `34600000000`, un rango de **móvil español ordinario**. Al rango imposible (`340…`) |
| **SCRUM-522** | guards fuera de la tanda 12 → 13, declarado con su motivo |
| **SCRUM-548** | mi guard entra en el conjunto de destinos **no derivables** (su ruta sale de una variable): se declara para que su solape invisible no se lea como «no tiene» |

Y un quinto, mío y ya conocido: la primera versión de mi test miraba el fichero entero y salió
roja **contra mi propio comentario**, que cita la construcción prohibida para explicarla. Es el
defecto de `_guard-texto.mjs` y van tres veces que muerde en esta sesión. Se mira código
ejecutable.

## Un intermitente, dicho y no escondido

En la primera tanda con mis cambios cayó también
`SCRUM-738 · SCRUM-684 NO se da por hecho`. Corrido solo, **dos veces, con mis cambios puestos:
7/7 en verde**; y en la tanda siguiente, verde. Ese test censa contra refs de `origin`, que otras
sesiones mueven mientras corre — el mismo fenómeno de base compartida que ya está escrito arriba.
**No lo he tocado.** Queda anotado por si a alguien le sale.

## Lo que no se ha tocado

`ensurePortalToken`, `botFlow`, `charges`, `prisma/schema.prisma`, ningún backfill. El
`@default(1)` sigue en la mesa del fundador con la cifra de esta entrada dentro.

---

# SCRUM-795 · CIERRE · lo que dijo la skill de UI, y lo que costó cumplirla

**Medido contra:** `origin/main` = `44562c332d1aed2c4ad4c7dfeaf71fd7bd59ce21` · 2026-09-07T03:19:09Z

`yaqu-premium-ui` lleva **88 días en el árbol** (nace el 11-jun-2026, commit `b028bad6`, un solo
commit y nunca modificada) y se declara **obligatoria antes de tocar cualquier UI**. La leí
DESPUÉS de escribir el botón, no antes. Ese orden es el defecto, y de él sale todo lo de abajo.

## ① El literal vuelve al oficial, y se cuentan los bytes

`customersView.js:660` pinta esta misma acción con `"Error al obtener el portal: " + err.message`.
Mi primera versión escribía `'Error al obtener el portal'` — **26 bytes contra 28**, o sea la
oficial menos `": "`. Un recorte es microcopy nuevo (regla 30): la regla no distingue entre
inventar una frase y quitarle dos caracteres a la de la casa.

Ahora la línea 113 lleva los **28 bytes exactos**, comprobado por sha256 y no a ojo:

| | literal | bytes | sha256 (16) |
|---|---|---|---|
| lista `customersView.js:660` | `Error al obtener el portal: ` | 28 | `6e1e8e77b66e039b` |
| ficha `customerDetailView.js:113` | `Error al obtener el portal: ` | 28 | `6e1e8e77b66e039b` |

🔴 **Y LO QUE NO VA, DICHO:** la lista sigue con `+ err.message`. Este fichero **no puede** — el
techo de `.message` crudos de `customerDetailView.js` en SCRUM-644 es **CERO**, y su segundo
trinquete impide devolverlo a la tabla del censo heredado. Consecuencia visible: el usuario lee
`Error al obtener el portal: ` con un dos puntos y nada detrás. Es feo, está **declarado en el
código**, y se prefiere a las dos alternativas: estrenar texto por mi cuenta, o asomar un
`customer_not_found` a la interfaz.

## ② Los 30 px: la deuda que este ticket AÑADE, contada como nueva

**No se arregla aquí** (decisión del asesor: tocar `.btn-sm` son 57 objetivos en 18 vistas, y eso
es SCRUM-786). Pero se cuenta, porque un botón de 30 px sin declarar es deuda escondida.

La medida, en navegador, área de toque (no caja CSS), 7-sep-2026:

| botón | 929 px | 390 px | AB6 |
|---|---|---|---|
| `btn-secondary btn-sm` «🔗 Portal» (**el mío**) | 30,9 | 30,6 | 🔴 |
| `btn-secondary btn-sm` «Portal» de la lista (no tocado) | 30,9 | 30,9 | 🔴 |
| `btn-secondary` **sin** `btn-sm` | — | **44,0** | ✅ |

O sea: el sub-44 es propiedad de la clase, no de mi cambio. **Pero mi cambio añade un objetivo
corto donde antes no había ninguno**: para un cliente sin token el botón no se pintaba. Que la
clase sea vieja no hace vieja la deuda, y por eso entra en el contador como nueva.

Área de toque completa del mío: **80 × 30 px**. Contraste `rgb(15,28,23)` sobre blanco:
**17,52:1** (AA pide 4,5) ✅.

## ③ La ficha 360 entra en el guard — y antes NADIE la medía

El censo de SCRUM-787 no la dejó fuera por criterio: **no podía montarla**. `tests/_banco-vistas.mjs`
llamaba a todas las vistas con UN argumento y la 360 necesita dos —`renderCustomer360View(caja,
id)`, como hace `app.js:314`—, así que montaba **2 nodos** y el censo la declaraba «⚠️ sólo 2
nodos». Eso es el suelo funcionando: no la contó como cero, dijo que no sabía.

Cambio mínimo en el fichero compartido: `pintarVista` acepta un **resto opcional**. Los 91 sitios
que llaman sin argumentos (contados el 7-sep-2026 sobre `6fb51ab7`) se comportan igual —ninguno
pasaba un tercero—. El fixture vive en `_pagina-panel.mjs`, compartido por el guard y el censo,
para que el que vigila y el que cuenta hablen de la misma pantalla.

**Provocado primero, con la lista de excepciones VACÍA:** 7 interactivos, **7 por debajo de 44 px,
los siete**. Ninguno cumplía. Ésa es la superficie real, y así queda declarada:

| objetivo | px (929 / 390) | de quién es |
|---|---|---|
| `BUTTON.btn-ghost.btn-sm` «← Volver a Clientes» | 31,0 / 31,0 | pre-existente (SCRUM-786) |
| `BUTTON.btn-secondary.btn-sm` «✎ Editar» | 30,9 / 30,5 | pre-existente (SCRUM-786) |
| **`BUTTON.btn-secondary.btn-sm` «🔗 Portal»** | **30,9 / 30,5** | **SCRUM-795 — lo añado yo** |
| `BUTTON.btn-primary.btn-sm` «+ Nuevo presupuesto» | 30,9 / 30,6 | pre-existente |
| `BUTTON` «Presupuestos (1)» | 41,0 / 41,0 | tercer grupo de SCRUM-787 |
| `BUTTON` «Facturas (1)» | 41,0 / 41,0 | ídem |
| `BUTTON.btn-ghost.btn-sm` «Ver →» | 30,5 / 30,7 | pre-existente |

⚠️ **CÓMO FALLA ESTE MECANISMO, dicho antes de que lo descubra otro:** las excepciones casan por
**SELECTOR**, y `BUTTON.btn-secondary.btn-sm` es el mismo para «✎ Editar» (que ya estaba) y para
«🔗 Portal» (que pongo yo). Una línea excusa a los dos y no sabe separarlos. No se arregla aquí
—tocar el emparejador cambiaría el veredicto de las otras dos superficies, que son de otras
sesiones—, así que el motivo **nombra a los dos** y el guard imprime cada elemento con su texto y
sus píxeles. Quien lea la salida ve escrito `⚠️ EXCEPCIÓN 30.9px · «🔗 Portal» … LO AÑADE SCRUM-795`.

El suelo de la superficie **no se le atribuye a SCRUM-787**, que nunca la midió: la superficie
declara su `origen` y el guard lo imprime.

## ④ El número del censo deja de mentir: 75 → 82

`npm run censo:tactil-panel`, 7-sep-2026:

| | antes (02:18) | ahora (02:40) |
|---|---|---|
| vistas montadas | 18 | **19** |
| NO medidas | 8 | **7** |
| objetivos cortos distintos | 75 | **82** |
| de ellos `.btn-sm` | 57 (76,0 %) | **62 (75,6 %)** |

No son seis defectos nuevos: son los **7 de la ficha 360**, que hasta hoy no se podían montar. El
76 de SCRUM-787 no se reescribe — era verdad sobre la población que aquel día se podía medir.

## ⑤ El control que no se podía perder, vuelto a medir

Con el contador de SCRUM-58 (`QA_QUERY_LOG=1`), contra `yaqu_dev_javier`, **7-sep-2026 03:12 UTC**,
por el handler compilado:

- **ABRIR la ficha** (`GET /detail`) → HTTP 200 · 5 consultas · **0 ESCRITURAS** ✅
- **PULSAR el botón** (`GET /portal-url`) → HTTP 200 · 4 consultas · **1 escritura**:
  `UPDATE "public"."customers" SET "portal_token" = $1, "updated_at" = $2 WHERE id = $3`
- limpieza: clientes 0 · merchants 0

Descarté curar-al-abrir con este argumento; perderlo ahora sería peor que no haber arreglado nada.

## ⑥ Lo de AB6 que sigue SIN cumplirse, y no lo tapo

De las seis casillas del checklist, mi cambio cumple contraste ✅ y falla o no cubre:

- **targets ≥44 px** — 🔴 falla, medido y declarado arriba.
- **capturas antes/después** — no las hay.
- **matriz Android gama media / iPhone / tablet (V0-5)** — medí 929, 1280 y 390 px. Eso no es la
  matriz.
- **estados empty / error / loading** — el error se ve ahora con el `: ` colgando; no hay skeleton.
- **focus visible (anillo Foco)** — 🔴 **sigue SIN MEDIR**, y ver abajo.

Las reglas duras sí: vanilla ✅ · un componente por cambio ✅ · reutiliza el inventario AB3 ✅ ·
cero estilos inline nuevos ✅.

## ⑦ Qué haría falta para medir el foco de verdad (y por qué no se mide aquí)

`styles.css:132` **sí** declara el anillo: `:focus-visible { outline: none; box-shadow: var(--ring) }`.
Lo que no vale es cómo lo miré: `el.focus()` desde el script es foco **programático**, y el
navegador sólo aplica `:focus-visible` cuando la heurística dice que el foco vino del teclado.
Una lectura tras `.focus()` puede dar «sin anillo» con el CSS perfectamente sano.

Para medirlo hacen falta dos cosas que hoy no tiene ningún guard del panel: **(1)** llegar al
elemento con `Tab` de verdad (`page.keyboard.press('Tab')` hasta que `document.activeElement` sea
el botón, que es lo único que enciende `:focus-visible`), y **(2)** un árbitro que no sea «hay
box-shadow»: comparar el píxel del borde **con foco y sin foco** —captura y diferencia—, porque un
`--ring` mal resuelto devuelve una sombra transparente que la lectura de estilos da por buena.
Es su propio ticket; aquí no se toca.

## Lo que este cierre NO ha tocado

`.btn-sm` (57 objetivos, SCRUM-786) · los cambios de UI de SCRUM-794 y SCRUM-792, que son de otras
sesiones · `ensurePortalToken`, `botFlow`, `charges`, `prisma/schema.prisma`, ningún backfill · la
limitación del emparejador de SCRUM-634 en el banco de vistas, que sigue declarada donde estaba ·
ningún umbral bajado y ninguna excepción inventada para que un guard pase.
