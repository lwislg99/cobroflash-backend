# SCRUM-869 · Los 63 que CI no corre nunca — censo con suelo, prioridad y coste MEDIDO

**Fecha:** 16-sep-2026 · **Carril:** medición · **Gate:** ninguno (este ticket no desgatea nada)

**Medido contra:** `origin/main` = `956be91d588031cd46b68b577968b82c4bc01660` · 2026-09-16T09:28:11+02:00
**Preámbulo:** `prisma generate` rc=0 · `npm run build` rc=0
**Re-derivado tras mezclar `main`:** el censo se volvió a pasar sobre el árbol ya mezclado
(los dos ficheros de test que traía `main` no gatean nada) y sale lo mismo: **57 ficheros · 95 tests**.

> ⛔ **AQUÍ NO SE DESGATEA NADA.** Ni una línea de `tests/`, ni una de `.github/workflows/ci.yml`,
> ni el guard `tests/_staging-db.mjs`. Lo único que se entrega es medición y propuesta.
> Lo gateado por `destinoSembrable` es SCRUM-868 (Sesión 3) y queda fuera: **medido, no se solapa
> con nada de aquí** (§2.4).

---

## 0 · El titular

| | |
|---|---|
| Ficheros con al menos un test gateado por base de datos | **57** (no 63) |
| Tests gateados | **95** |
| ¿Pueden correr contra el banco desechable del CI **tal y como están**? | **NO.** Tres barreras distintas lo impiden (§3) |
| ¿Y si se les da un destino que sí acepten? | **41 de los 57 pasan enteros** contra un banco recién creado, sólo con el esquema (§4) |
| Lo que añadirían al CI | **≈ +27 s** sobre un job cuya mediana son **318 s** — **menos de medio minuto** (§5) |

---

## 1 · El instrumento, y su suelo

El censo se hace por **AST** (`ts.createSourceFile` + `forEachChild`), no por `grep`: el gate viaja
en el objeto de opciones de `test(nombre, { skip: … }, fn)`, y contar apariciones del nombre de la
variable cuenta también los comentarios que explican cómo correrlos.

**El suelo va primero y puede parar el censo.** Se le dan siete ficheros FABRICADOS y tiene que
acertar en los siete; si falla uno, imprime `🔴 CIEGO` y sale con código 2:

| Fabricado | Esperado | |
|---|---|---|
| gateado con la variable `ENABLED` | 1 | ✅ |
| gateado con **otro nombre** de variable (`DB`) | 1 | ✅ — si sólo reconociera el nombre más frecuente, el censo contaría de menos y no lo diría |
| `skip: true` **ajeno** al gate | 0 | ✅ |
| sin gate ninguno | 0 | ✅ |
| gate a nivel de `describe` (2 tests dentro) | 2 | ✅ |
| gate **dentro de un template literal** (un maniquí) | 0 | ✅ |
| gate leído en el propio `skip` (`process.env…` sin variable) | 1 | ✅ |

🔴 **La v1 de este instrumento era ciega, y el suelo la cazó.** Buscaba `process.env.QA_DB_TEST`
en el **texto** del inicializador, así que registraba como «puerta» una variable cuyo VALOR era un
template con ese texto dentro. Eso existe de verdad en el repo:
`tests/scrum754-el-juez-que-oscila.test.mjs:705` guarda un fichero-maniquí completo
—`const TODOS_SALTADOS = \`…test('…', { skip: !ENABLED }…\`;`— que el meta-guard escribe en disco
para juzgarse a sí mismo. La v2 busca el **nodo** `process.env.<GATE>` en el árbol: el contenido de
un template no es expresión, así que el árbol lo ignora solo. Un `grep` lo habría contado.

### 1.1 · Y un segundo instrumento, independiente, que confirma el primero

Un censo por AST puede equivocarse de forma sistemática. Así que la cifra se comprueba **corriendo
la suite** y contando lo que salta de verdad:

```
npm test  →  6.943 tests · 6.833 pass · 0 fail · 110 skipped · 253 s
```

De esos **110 saltos**, los que **nombran un gate de base de datos** son **95 — exactamente los 95
del censo por AST**. Los otros 15 son otra cosa y están explicados en §8.2.

### 1.2 · Y un tercero, escrito por otra sesión sin hablar conmigo

`docs/master/SCRUM-868.md` (Sesión 3, ya en `main`) censó los gateados con **su propio**
instrumento —uno que ni siquiera lleva la lista de gates escrita a mano— y publicó, en su §2:

| | Sesión 3 (SCRUM-868) | aquí (SCRUM-869) |
|---|---|---|
| `QA_DB_TEST` | 93 | 93 |
| `A55_DB_TEST` | 1 | 1 |
| `BOT_SUITE_TEST` | 1 | 1 |
| **total de gates de base** | **95** (su §3, tabla) | **95** |

**Tres instrumentos distintos, en dos carriles que no se coordinaron, dan la misma cifra.** Es la
mejor prueba que puedo dar de que el 95 no es un artefacto de cómo yo miro.

---

## 2 · El censo

### 2.1 · La cifra, y por qué no es 63

| Criterio | Ficheros |
|---|---|
| **mencionan** `QA_DB_TEST` en `tests/*.test.mjs` | 65 |
| mencionan cualquiera de los tres gates (`QA_DB_TEST`, `A55_DB_TEST`, `BOT_SUITE_TEST`) | 67 |
| **gatean de verdad** al menos un test | **57** |
| tests gateados dentro de esos 57 | **95** (de 175 que viven en esos mismos ficheros) |

Los **10 ficheros que mencionan pero no gatean** lo hacen en comentarios o en cadenas: explican por
qué ELLOS no están gateados (`merchant-fixture`, `scrum244-registro-portabilidad`,
`scrum55-admin-fail-closed`, `wa-log-sync`…), o llevan el maniquí de §1. No corresponde contarlos:
esos sí corren en `npm test`.

Reparto por variable de entorno: **`QA_DB_TEST` 55 ficheros · `A55_DB_TEST` 1 · `BOT_SUITE_TEST` 1**.

### 2.2 · Dos familias, no una

| Familia | Ficheros | Qué pide |
|---|---|---|
| **staging** (importa `tests/_staging-db.mjs`) | 53 | `DATABASE_URL_TESTS` + las dos barreras de §3.1 |
| **`yaqu_dev_javier`** (guard propio por destino) | 4 | que `.env` traiga `DATABASE_URL_DEV` apuntando a una base **llamada literalmente `yaqu_dev_javier`** |

Los cuatro de la segunda familia son `scrum592-concurrencia-serie`, `scrum767-cura-concurrencia`,
`scrum781-concurrencia-de-la-factura` y `scrum793-la-carrera-del-token`: justo los que prueban
`pg_advisory_xact_lock` y las carreras del emisor y del token. **No usan `destinoSembrable`**: su
guard es `parseBDSegura(url).base === 'yaqu_dev_javier'`, leído del `.env`.

### 2.3 · Una corrección al enunciado

`scrum244-supresion-y-anonimizado.test.mjs` aparecía en la lista del encargo como uno de los que CI
no corre nunca. **Medido: CI SÍ lo corre.** No está gateado por `QA_DB_TEST` sino por
`LIBRO_PG_URL`, y `ci.yml:175` exporta esa variable en el mismo paso que lanza `npm test`. Está
declarado en el inventario de `tests/scrum419-ci-declara-lo-que-no-corre.test.mjs:79`.

### 2.4 · Lo que es de SCRUM-868 y queda fuera

Los ficheros que usan `destinoSembrable` son `scrum381-semilla`,
`scrum746-barrera-y-punto-de-conexion` y `scrum746b-guarda-en-la-conexion`. **Ninguno de los tres
aparece en los 57**: no hay solape y no se ha tocado nada suyo.

---

## 3 · ¿Pueden correr contra el banco desechable del CI? — NO, y no por una razón sino por tres

El CI levanta un `postgres:16-alpine` con puerto dinámico, crea `yaqu_libro_test`, le aplica el
esquema con `prisma migrate diff --from-empty` + `psql` y exporta **`LIBRO_PG_URL`**
(`ci.yml:161-175`). Es un banco de verdad. Lo que pasa es que los 57 no piden eso.

### 3.1 · Barrera 1 — la allowlist de host (`scripts/_db-guard.mjs`)

`assertSafeStagingUrl` sólo acepta el host exacto de staging. **El banco del CI vive en
`127.0.0.1`: no está en la lista y aborta antes de abrir la conexión.** Y esta barrera **no se
toca**: `tests/_staging-db.mjs:107` deja escrito que, desde SCRUM-165, la allowlist es la ÚNICA
barrera que actúa ANTES de que la URL sea utilizable.

### 3.2 · Barrera 2 — el marcador `YAQU_STAGING`

Tras conectar se le pregunta a la propia base por su comentario de catálogo. Una base recién creada
por el CI **no lo lleva**, así que aborta igual. Es fail-closed a propósito: «si no se puede
verificar, no se corre».

### 3.3 · Barrera 3 — el nombre de la base (los 4 de concurrencia)

Exigen un `.env` con `DATABASE_URL_DEV` apuntando a una base llamada `yaqu_dev_javier`. **En CI no
hay `.env`**, así que estos cuatro no es que se salten: es que **fallarían** si se les activara el
gate sin más.

> **Respuesta corta a la pregunta 3 del encargo: no, hoy no pueden. Ninguno de los 57.**
> No por falta de banco, sino porque **piden un destino concreto** y el banco del CI es otro.

---

## 4 · Y si se les da un destino que sí acepten: qué pasa (medido, no supuesto)

Para poder cronometrarlos **sin desgatear nada**, la medición se hizo en un directorio
**desechable** (`tests869/`, hermano de `tests/` para que `../dist` y `../scripts` sigan
resolviendo), con copias de los ficheros y una copia de `_staging-db.mjs` sin barreras. El
directorio se borró al terminar; **`tests/`, `src/` y `ci.yml` no se tocaron en ningún momento**.

El banco: PostgreSQL **16.4** local y desechable (misma mayor que el `postgres:16-alpine` del CI),
puerto propio, durabilidad **por defecto** (`fsync on`, `synchronous_commit on` — la primera medición
salió con `fsync=off` y **se descartó**), esquema aplicado por `migrate diff --from-empty` con el
binario local, **sin sembrar ni un dato**.

| Resultado (3 pasadas, 53 ficheros de la familia staging) | |
|---|---|
| tests ejecutados | **153-154** según la pasada · **0 saltados** |
| pasan | **137** |
| fallan | 16 / 17 / 16 según la pasada |
| ficheros limpios en las tres pasadas | **38 de 53** |

Y los 4 de `yaqu_dev_javier`, con un `.env` temporal apuntando al mismo banco local (creado y
**borrado en la misma orden**, comprobado después): **22 tests, 21 pasan, 1 falla**.

**Total: 41 de los 57 ficheros pasan enteros contra un banco pelado.** No necesitan staging: les
basta el esquema.

### 4.1 · Los 16 que sí necesitan «base de verdad» — y qué les falta exactamente

No fallan por estar rotos. Fallan porque **leen datos que ese banco no tiene**, y lo dicen ellos
mismos en la aserción:

| Fichero | Lo que pide, según su propio mensaje de error |
|---|---|
| `scrum173-cadena-verifactu-serializada` | **cadenas YA PERSISTIDAS**: relee huellas de facturas que existen en staging (`🔴 CADENA PERSISTIDA ROTA`) |
| `albaran` | el **formato de serie** configurado del merchant: espera `ALB-2026-001` y en banco limpio sale `AB260001` |
| `scrum234-carrera-serie.gated`, `scrum814-carrera-del-tramo.gated` | lo mismo: serie fiscal `/^\d{4}-/` frente a `F260001` |
| `scrum781-concurrencia-de-la-factura` | serie `/^\d{4}-QA-\d{3}$/` — la del merchant de QA |
| `bot-suite`, `scrum47`, `scrum49`, `scrum50` | sesiones y plantillas de WhatsApp del entorno |
| `tenancy-permisos`, `scrum52`, `scrum68`, `scrum72`, `scrum13`, `scrum17`, `scrum692` | datos previos del merchant (roles, evidencias, cobros, consolidaciones) |

**Traducción:** lo que necesitan no es «una base», es **un merchant configurado**. Eso es sembrar,
y sembrar es trabajo de otro ticket.

### 4.2 · Dos intermitentes, que hay que decir

`webhooks-idempotencia` falló en una de las tres pasadas y pasó en las otras dos; `a55-window-quote`
falló en la pasada fría y pasó en las tres siguientes. **Un test intermitente no es cobertura**: si
alguna de estas tandas se desgatea, estos dos entran con su intermitencia investigada, no tapada.

### 4.3 · No dejan poso

Al acabar las cinco tandas, **`select count(*) from merchants` = 0 en las dos bases**. Las fixtures
(`withMerchant`) crean y borran lo suyo. Un banco desechable compartido les vale.

---

## 5 · El coste: medido, con su aritmética a la vista

**Línea base del CI** — job «build + tests (con banco desechable)», **43 ejecuciones reales** leídas
por `gh api`:

| mín | p50 | p90 | máx |
|---|---|---|---|
| 211 s | **318 s** | 344 s | 535 s |

Y el paso `npm test` dentro de ese job: **284 s de mediana** (5 ejecuciones). En esta máquina el
mismo `npm test` tarda **273 s** → **factor entre máquinas ≈ 1,04**: van casi iguales.

**El coste marginal no es lo que tardan los 57 ficheros, sino la DIFERENCIA**, porque esos ficheros
**ya corren hoy** en CI: lo que se salta son 95 de sus tests, no los ficheros enteros.

| Los mismos 53 ficheros | reloj | CPU (suma de tests) |
|---|---|---|
| **sin** gate (como corre CI hoy) | 2 s | 1,3 s |
| **con** gate, contra banco real | 19-21 s | 104-115 s |
| **diferencia** | +18 s | **+106 s de CPU** |

Extrapolación al runner (`ubuntu-latest` = **4 núcleos**; esta máquina, 8):

- por CPU repartida: 106 s ÷ 4 ≈ **27 s**
- suelo duro: el fichero más lento (`bot-suite`, A8.4) tarda **19,5 s** él solo y no se puede
  paralelizar consigo mismo
- con el factor de máquina 1,04: **≈ 27-28 s**

> **+27 s sobre 318 s = +8,5 %. Menos de medio minuto.** Con el `timeout-minutes: 10` actual
> (600 s) y un p90 de 344 s, **cabe de sobra**: el margen no baja de 4 minutos.

---

## 6 · Prioridad: por lo que decide cada uno

El criterio no es el número de ticket ni la antigüedad: **qué sale mal si eso está roto y nadie lo
mira**. Fiscal y dinero primero, como se pidió. `⚠` = de los 16 que piden datos (§4.1).

### ① FISCAL — una declaración equivocada · 14 ficheros, 29 tests

| Fichero | Tests | |
|---|---|---|
| `scrum173-cadena-verifactu-serializada` | 7 | ⚠ |
| `scrum592-concurrencia-serie` | 4 | |
| `scrum781-concurrencia-de-la-factura` | 4 | ⚠ |
| `scrum814-carrera-del-tramo.gated` | 3 | ⚠ |
| `scrum207-emision-auditada` | 2 | |
| `scrum17-recapitulativa` | 1 | ⚠ |
| `scrum234-carrera-serie.gated` | 1 | ⚠ |
| `scrum170-facturacion-parcial`, `scrum171a-consolidar-cliente`, `scrum178-emision-manual`, `scrum221-export-fiscal-cero-bytes`, `scrum66-tipo-operacion`, `scrum73-verifactu-gate`, `scrum82-zip-verifactu` | 1 c/u | |

### ② DINERO — un cobro equivocado, o su llave en manos ajenas · 8 ficheros, 19 tests

`scrum793-la-carrera-del-token` (6) · `scrum135-gasto-tenencia` (4) · `scrum767-cura-concurrencia`
(4) · `scrum127-paywall-bloquea` (1) · `scrum13-cobrado` (1 ⚠) · `scrum74-recibo-token` (1) ·
`scrum85-pay-routes-token` (1) · `scrum90-pay-bank-mp-token` (1)

### ③ DATOS DE OTRO — tenencia y permisos · 17 ficheros, 22 tests

`scrum136-hub-equipo` (3) · `scrum109-expense-teammember` (2) · `scrum148-filtro-por-miembro` (2) ·
`tenancy-permisos` (2 ⚠) · y 13 más con 1 test cada uno (`pdfs`, `scrum104`, `scrum120`, `scrum22`,
`scrum24`, `scrum25-export-zip`, `scrum25-exports`, `scrum52` ⚠, `scrum57`, `scrum68` ⚠,
`scrum72` ⚠, `scrum92`, `scrum94`).

### ④ OPERATIVA — albaranes, WhatsApp, bot, arranque · 18 ficheros, 25 tests

`scrum593d-viaje-completo-del-texto` (4) · `albaran` (2 ⚠) · `scrum115`, `scrum222`, `scrum574`
(2 c/u) · y 13 con 1 test (`a55-window-quote`, `bot-suite` ⚠, `scrum106`, `scrum116`, `scrum131`,
`scrum47` ⚠, `scrum49` ⚠, `scrum50`, `scrum51`, `scrum58`, `scrum692` ⚠, `scrum76`,
`webhooks-idempotencia` ⚠).

**Suma comprobada contra el censo: 57 ficheros · 95 tests.** La clasificación revienta si un fichero
se queda sin clasificar o si aparece una clave que el censo no tiene.

---

## 7 · La propuesta (medida; **no se ejecuta en este ticket**)

**No tocar las barreras de staging.** Lo que impide correr contra el banco del CI es una decisión de
seguridad, y aflojarla para ganar velocidad es exactamente lo que `_staging-db.mjs:13` prohíbe. La
vía barata ya existe **y ya está en producción en el propio CI**: `LIBRO_PG_URL`, un destino
**distinto**, loopback, desechable, con su propio guard fail-closed (host loopback + base terminada
en `_test`) y su trinquete declarado (SCRUM-419).

**Tanda 1 — 12 ficheros, 13 tests, coste ≈ 3 s.** Fiscal y dinero que **hoy ya pasan** contra un
banco pelado y son de la familia staging: `scrum207`, `scrum170`, `scrum171a`, `scrum178`,
`scrum221`, `scrum66`, `scrum73`, `scrum82`, `scrum127`, `scrum74`, `scrum85`, `scrum90`.
Cada uno pasa a aceptar **también** el destino desechable, como ya hacen los 12 de `LIBRO_PG_URL`.

**Tanda 2 — los 4 de concurrencia (18 tests).** Son los de más valor: `pg_advisory_xact_lock`, la
carrera del emisor y la del token. Sólo les falta que su guard por destino acepte el banco
desechable además de `yaqu_dev_javier`. **3 de los 4 pasan ya**; el cuarto (`scrum781`) falla por el
formato de serie del merchant de QA.

**Tanda 3 — los 16 que piden datos (§4.1).** Antes hay que decidir qué se siembra. Es un ticket
propio, y ahí la pregunta es de producto, no de CI.

**Y el trinquete que falta.** `scrum419` declara fichero a fichero los gateados por `LIBRO_PG_URL`,
y salta en rojo si aparece uno nuevo sin declarar. **Para los 95 de `QA_DB_TEST` no existe ese
trinquete**: hoy se puede añadir un gateado nuevo y nadie se entera. El instrumento de §1, con su
suelo de siete fabricados, es exactamente lo que hace falta para montarlo — y esto sí debería nacer
dentro de `npm test`, porque un artefacto que no corre en la tanda no existe.

---

## 8 · Hallazgos colaterales (se reportan, no se arreglan — regla 9)

### 8.1 · Dos variables que el CI nunca exporta, con el banco levantado al lado

`ci.yml:175` exporta **sólo** `LIBRO_PG_URL`. Pero hay tests que piden **`TRAMOS_PG_URL`** y
**`SERIE_PG_URL`**, y por eso se saltan **también en CI** —con el banco desechable en pie a dos
líneas de distancia—: `scrum814-carrera-de-tramos-postgres` y `scrum728-serie-ocupada-postgres`.
Son **2 tests**, uno de tramos y otro de serie ocupada: **camino fiscal**. Coste de arreglarlo: dos
líneas de `env:` apuntando a la base que ya existe. No lo toco: es `ci.yml`.

🔴 **Y esto no lo encontré yo solo: la Sesión 3 llegó antes.** `docs/master/SCRUM-868.md` §2 ya
marca las dos variables con «🔴 **NADIE**: no están en ningún workflow, ni en `package.json`, ni en
ningún script», y su documento entró en `main` antes que éste. Lo dejo escrito aquí porque lo medí
por mi cuenta y **coincide** —dos carriles, el mismo agujero—, no porque sea mío.

### 8.2 · Los 15 saltos que no son de este ticket

De los 110 saltos de `npm test`: 95 son los gates de base (este ticket), **14** piden el banco
desechable (`LIBRO_PG_URL` ×12, `TRAMOS_PG_URL` ×1, `SERIE_PG_URL` ×1) y **1** se salta porque
Windows no deja crear un enlace a fichero sin elevación. En CI, los 12 de `LIBRO_PG_URL` **sí
corren**.

### 8.3 · El trinquete de SCRUM-419 no cubre la familia `QA_DB_TEST`

`tests/scrum419-ci-declara-lo-que-no-corre.test.mjs:74` declara **fichero a fichero** los gateados
por `LIBRO_PG_URL` (12 tests hoy) y se pone **rojo** si aparece uno nuevo sin declarar — «un test
que deja de ejecutarse en silencio es indistinguible de uno que no existe».

**Para los 95 de `QA_DB_TEST` no existe ese trinquete.** Hoy se puede añadir un gateado nuevo, o
gatear uno que antes corría, y nadie se entera: ni el CI, ni la revisión, ni este censo mañana. Es
la misma avería que el 419 arregló para su familia, en la familia siete veces más grande.

El instrumento de §1 —con su suelo de siete fabricados— es exactamente la pieza que le falta, y
**ésa sí tendría que nacer dentro de `npm test`**: un artefacto que no corre en la tanda no existe.

---

## 9 · Cómo reproducirlo

```bash
# censo con suelo (imprime 🔴 CIEGO y sale con 2 si no reconoce un gateado fabricado)
node censo869b.mjs <raíz-del-repo>          # → 57 ficheros · 95 tests gateados

# el segundo instrumento: la propia suite
npm test                                     # → 110 skipped; 95 nombran un gate de base

# línea base del CI, 43 ejecuciones reales
gh run list --workflow ci.yml -L 60 --json databaseId --jq '.[].databaseId'
gh api repos/lwislg99/cobroflash-backend/actions/runs/<id>/jobs \
  --jq '.jobs[]|select(.name|startswith("build + tests"))|"\(.started_at) \(.completed_at)"'
```

El cronometraje contra Postgres real se hizo en un directorio desechable, borrado al terminar; los
guiones del censo y de la prioridad viven en el scratchpad de la sesión. **Lo que queda en el repo
es este documento y nada más.**

---

## 10 · Lo que NO se tocó

`src/` · `tests/` · `.github/workflows/ci.yml` · `tests/_staging-db.mjs` · `scripts/_db-guard.mjs` ·
`prisma/schema.prisma` · nada de `destinoSembrable` (SCRUM-868) · ninguna base del proyecto
(staging, `yaqu_dev_javier` o producción): **todas las mediciones fueron contra un cluster local
desechable, creado para esto y apagado al terminar.**

`git status` al cerrar: limpio salvo este fichero.
