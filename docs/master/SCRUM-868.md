# SCRUM-868 · Los tests gateados: censo con suelo, y el reparto

**Medido contra:** `origin/main` = `77ce9d1e86d6ffa921b1c92561ec2d7994f8e5eb` · 2026-09-16T07:02:25Z
**Rama:** `scrum-868-el-censo-de-los-gateados` · **Carril:** `tests/` (Sesión 3) · **Gate:** sin gate

> Un cero sin un caso conocido delante no vale. Y aquí el cero salió a la primera.

⏱ Las horas son **de GitHub**: el reloj de esta máquina va 334 s adelantado (medido el 16-sep-2026
contra la cabecera `Date:` de la API).

---

## 0 · PASO 0, y el cero que el ticket anticipó

El encargo dice «los gateados por `destinoSembrable`». Medido antes de escribir una línea de censo:

| lectura | resultado |
|---|---|
| ¿algún `skip` del árbol nombra `destinoSembrable`? | **NINGUNO** |
| ¿algún `skip` mira `DATABASE_URL`? | **NINGUNO** |
| ¿quién nombra `destinoSembrable`? | 6 ficheros: los 3 sembradores y 3 tests que **lo comprueban** (no lo usan de gate) |

O sea que por la lectura literal la población es **cero**. Y ese cero es exactamente el que el
ticket prohíbe publicar a secas: «no hay» y «no sé mirar» dan la misma salida. Por eso el censo
**no empieza por el árbol**, sino por un gateado fabricado que tiene que ver.

## 1 · El instrumento, y su suelo

`censo-868.mjs` (scratchpad; esto MIDE, no toca `src/` ni `tests/` ni el gate de nadie).

**Sigue la variable, no el literal.** No lleva lista de gates: recoge cualquier `process.env.X` o
llamada que aparezca en la expresión de `skip`, resolviendo identificadores locales hasta el final.
El patrón real del árbol es `const ENABLED = process.env.X === '1'` + `{ skip: !ENABLED && '…' }`,
y en SCRUM-840 un detector de esta casa dio **CERO sobre un árbol con 57 gateados** por buscar
`process.env` DENTRO del `skip`.

🔴 **El suelo, sobre un banco fabricado de tres tests** —uno gateado por `destinoSembrable`, uno por
variable de entorno, uno sin gate—:

```
ve el gateado por `destinoSembrable`: ✅
ve el gateado por variable de entorno : ✅
y NO inventa el que no tiene gate     : ✅
```

Si cualquiera de los tres falla, el instrumento **se declara CIEGO y no publica ningún número del
árbol**. Es lo único que hace que el cero de arriba signifique algo.

## 2 · El censo: 113 tests gateados en 70 ficheros

| variable del gate | tests | ¿quién la pone? |
|---|---|---|
| `QA_DB_TEST` | **93** | el runner gateado (staging) — **es SCRUM-869, carril de la Sesión 1** |
| `LIBRO_PG_URL` | **12** | **CI**, en su job del banco desechable |
| (por llamada: git / bash) | 4 | nadie: dependen de que haya `origin/main` o `bash` |
| `A55_DB_TEST` | 1 | el runner gateado (staging) |
| `BOT_SUITE_TEST` | 1 | el runner gateado (staging) |
| `SERIE_PG_URL` | 1 | 🔴 **NADIE** |
| `TRAMOS_PG_URL` | 1 | 🔴 **NADIE** |

### ⚠️ Son 113, no 107 — y la diferencia es el defecto que el ticket avisa

SCRUM-844 contó 107, que es exactamente `93 + 12 + 1 + 1`. Los **6 que le faltaban** son
`SERIE_PG_URL`, `TRAMOS_PG_URL` y los 4 gateados por llamada. No es un error de aquel barrido: es
que su detector lleva la **lista de gates escrita a mano** (`const GATES = new Set([…])`), así que
un gate nuevo le es invisible por construcción. El mío no lleva lista, y por eso los ve.

## 3 · La frontera con el 869, medida y no supuesta

De los 113, **93 son `QA_DB_TEST`** y quedan fuera de este ticket por orden expresa: son de la
Sesión 1. **20 son míos.** Los 4 «por llamada» (`scrum759`, `scrum766`, `scrum810`, `scrum810b`) no
son de base de datos: se saltan si falta `origin/main` en el clon o si no hay `bash`. Los cuento y
los declaro, pero no son de este carril: quien los retira es quien mantenga esos guards.

## 4 · Los 20 míos, y qué decide cada uno

| test | gate | asserts | qué decide |
|---|---|---|---|
| `a55-window-quote:38` | `A55_DB_TEST` | 10 | con la ventana de 24 h abierta el presupuesto sale como **texto de sesión (0 €)**, no como plantilla |
| `bot-suite:74` | `BOT_SUITE_TEST` | 39 | la conversación entera del bot por webhook, en dry-run |
| `scrum244:246` | `LIBRO_PG_URL` | 13 | al anonimizar, **la anotación sobrevive** y la cadena sigue verificando |
| `scrum295:64` | `LIBRO_PG_URL` | 13 | el **modelo 303** de un merchant no declara ni un euro de otro |
| `scrum296:90` | `LIBRO_PG_URL` | 18 | el **libro** de un merchant no ve ni una factura de otro |
| `scrum297:42` · `:362` | `LIBRO_PG_URL` | 34 · 5 | el paquete de **evidencias** (suelo, tenencia, dos controles) y que un sello que no cuadra **se declara** |
| `scrum324:130` · `:178` | `LIBRO_PG_URL` | 7 · 5 | la **cadena entera** hasta el libro con desglose, y el control negativo sin él |
| `scrum389:128` · `:171` | `LIBRO_PG_URL` | 3 · 8 | las **tres pantallas** dan la misma cifra del trimestre, al céntimo |
| `scrum728d:117` · `:139` · `:213` | `LIBRO_PG_URL` | 1 · 3 · 2 | el RTT en loopback y **la pendiente del viaje** que escala |
| `scrum728:129` | `SERIE_PG_URL` | 21 | el aviso del **cerrojo de numeración** saturado |
| `scrum814:139` | `TRAMOS_PG_URL` | 12 | los dos caminos de **carrera de tramos** que staging no cubre |
| 4 más (`scrum759`, `766`, `810`, `810b`) | por llamada | 14 | suelos derivados y el `grep` de la plataforma — **no son de base** |

## 5 · 🔴 Lo que CI corre y lo que no: «110 saltados» no significa «110 que nadie corre»

| grupo | ¿lo corre CI? | ¿lo corre alguien? |
|---|---|---|
| `LIBRO_PG_URL` (12) | **SÍ** — `ci.yml` levanta un `postgres:16-alpine`, crea `yaqu_libro_test`, le carga el esquema con `migrate diff --from-empty` y exporta la variable | sí |
| `QA_DB_TEST` / `A55` / `BOT_SUITE` (95) | **NO**, por diseño: es la base de STAGING | sí, la tanda gateada a mano |
| `SERIE_PG_URL` · `TRAMOS_PG_URL` (2) | **NO** | 🔴 **NADIE**: no están en ningún workflow, ni en `package.json`, ni en ningún script |

Los 110 saltos de mi tanda local son los de **esta máquina**, donde no hay ninguna variable puesta.
En CI, 12 de ellos sí corren.

## 6 · EL REPARTO, con su motivo

### A · Nada que desgatear: ya corren (12)

Los de `LIBRO_PG_URL`. Piden **loopback y base terminada en `_test`** y lo comprueban ellos mismos;
CI les da exactamente eso. Aquí no hay trabajo.

### B · Se desgatean SIN base de staging y sin infraestructura nueva (2) — **primero, por el criterio del ticket**

`scrum728:129` (`SERIE_PG_URL`, el cerrojo de la numeración) y `scrum814:139` (`TRAMOS_PG_URL`,
carrera de tramos: **emite facturas**). Son dinero y camino fiscal, que es lo que el ticket manda
primero, y **hoy no los corre nadie**.

Exigen lo mismo que los de libro —loopback, base `_test`, comprobado por ellos— así que el banco
desechable que CI ya levanta les sirve. Lo que falta es exportarles su variable y darles su base.
**No toca staging, no toca `assertSafeStagingUrl`, no añade servicio nuevo.**

⚠️ **A medir antes de prometerlo** (y por eso va en su propia rama, no aquí): que las tres bases
conviven en el mismo servicio sin pisarse, y el coste en minutos del job.

### C · Candidatos, pero con diseño propio (2)

`a55-window-quote` y `bot-suite`. Ya **no dependen del seed demo** (SCRUM-159 les dio merchant
efímero), así que lo que necesitan es *un Postgres con el esquema*, no *staging*. Pero hoy entran
por `tests/_staging-db.mjs`, que exige `DATABASE_URL_TESTS`, la allowlist de host y el **marcador**
de la base. Darles una ruta al banco desechable es diseño de su gate, no un ajuste: rama aparte,
medido, y con el resultado por delante.

### D · ⛔ El límite duro, y hoy no lo toca nadie

**Ninguno de los 20 se desgatea aflojando `assertSafeStagingUrl`.** Es fail-closed y se queda como
está. Si al medir el grupo C apareciera que sólo se puede por ahí, **se queda gateado y se dice por
qué** — que es lo que manda el ticket.

## 7 · ⚠️ Hallazgo: el trinquete que vigila esto está anclado a UNA variable

`tests/scrum419-ci-declara-lo-que-no-corre.test.mjs` existe justo para que «CI declare lo que no ha
ejecutado». Su inventario cuelga de `const VARIABLE = 'LIBRO_PG_URL'`. Por eso `SERIE_PG_URL` y
`TRAMOS_PG_URL` **entraron sin que nada se pusiera rojo**: un gate nuevo con otra variable le es
invisible, igual que los 6 que se le escaparon al barrido de SCRUM-844 por llevar lista fija.

Se reporta con su medida y **no se toca aquí**: cambiar ese guard es trabajo del grupo B, donde
además habrá que declararlos. Anotarlo sin arreglarlo es la regla 9.

## ⛔ No tocado

`scripts/_db-guard.mjs` (ni `destinoSembrable`, ni `destinoDesechable`, ni `assertSafeStagingUrl`) ·
`tests/_staging-db.mjs` · el gate de ningún test · los 93 de `QA_DB_TEST` (SCRUM-869, Sesión 1) ·
`scrum419` · `.github/workflows/` · `src/`.

## Lo que también entra en esta rama

La **corrección de la cifra del registro de SCRUM-829b** (decía `vivas 197 · mudas 0 · ciegas 0`; el
CI dio `196 · 1 · 0`, con la muda en `scrum859`, que es SCRUM-866 y ya estaba en `main`). Va aquí por
orden del orquestador: no se abre un PR sólo para eso.

---

# SCRUM-868 · APÉNDICE · 22-sep-2026 · grupo C, medido y con diseño — listo para construir, sin construir

**Fecha:** 22-sep-2026 · **Carril:** S5 · **Gate:** ninguno — cero código, solo lectura
**Medido contra:** `origin/main` = `067601b809b9601d8182bb9e3f84c6ca6b874d1b` · 2026-09-22T10:23:34Z

## El defecto

El estado del 21-sep (comentario 16277 de Jira SCRUM-868) dejaba el **grupo C**
(`a55-window-quote.test.mjs`, `bot-suite.test.mjs`) como «diseño propio, rama aparte, sin
relajar `assertSafeStagingUrl`: M, no listo esta semana». El encargo de hoy pedía continuar.

## Lo que se midió (leído entero, sin ejecutar código)

Leí los dos ficheros de test y `tests/_merchant-fixture.mjs` (`withMerchant`) completos.

* **Los dos son de esquema puro.** Ninguno lee una fila que no haya creado él mismo:
  `withMerchant` crea el merchant efímero con `prisma.merchant.create` (sin datos de siembra),
  y todo lo demás (customer, whatsAppMessage, botSession…) lo crea el propio test dentro de
  su cuerpo. SCRUM-159 ya se lo garantizó explícitamente en su cabecera («ya NO depende del
  seed demo»); lo que confirmo aquí es que **tampoco depende de nada más de staging**: ni una
  fila, ni una configuración, ni un merchant preexistente.
* `a55-window-quote.test.mjs`: solo Prisma directo (`customer.create`, `whatsAppMessage`) +
  `sendWhatsAppWindowFirst`/`buildQuoteDecision` en `WHATSAPP_DRY_RUN`. Sin servidor HTTP.
* `bot-suite.test.mjs`: monta `dist/app.js` en proceso y golpea `/webhooks/whatsapp` con
  payloads fabricados, todo en `WHATSAPP_DRY_RUN=1`. Sin red real. Es una suite grande (un solo
  `test()` con muchos pasos: menú, presupuestos, pago, handoff, mudo 24h, opt-out).
* Los dos importan `./_staging-db.mjs` **solo por su gate** (`A55_DB_TEST`/`BOT_SUITE_TEST` →
  exige `DATABASE_URL_TESTS` + marcador de staging). Nada del CUERPO del test necesita que la
  BD sea staging — necesita que sea Postgres con el esquema actual.

**Conclusión: SÍ se puede dar a los dos una ruta al banco desechable, sin tocar
`assertSafeStagingUrl` ni el camino de staging existente.** No es una suposición: es lo que
`withMerchant` y los dos ficheros hacen, leído línea a línea.

## El diseño propuesto (no implementado — ver «Por qué no lo construyo hoy»)

**Aditivo, nunca sustituye el gate de staging.** `A55_DB_TEST=1`/`BOT_SUITE_TEST=1` +
`DATABASE_URL_TESTS` de staging siguen funcionando exactamente igual (para
`npm run test:staging:gated`, verificación real contra staging). Se AÑADE un segundo camino:

1. Dos variables nuevas, mismo patrón que `LIBRO_PG_URL`/`SERIE_PG_URL`/`TRAMOS_PG_URL`:
   `A55_PG_URL` y `BOT_PG_URL`. Cuando están puestas, el test NO importa `_staging-db.mjs`
   (o lo importa pero esa rama no se ejecuta — a decidir en la implementación) y en su lugar
   corre un guard local `exigirBancoDesechable`-equivalente (loopback + base `_test`, calcado
   de `scrum814-carrera-de-tramos-postgres.test.mjs:73-82`) y fija `DATABASE_URL` antes de que
   `dist/core/db/prisma.js` se construya — mismo orden síncrono que ya exige `_staging-db.mjs`
   (comentario SCRUM-165 en ese fichero: asignar ANTES del primer `await`).
2. `.github/workflows/ci.yml`: sumar `yaqu_a55_test` y `yaqu_bot_test` al bucle de
   `CREATE DATABASE`/aplicar esquema (línea ~228) — mismo esquema, sin coste nuevo de imagen
   (ya hay un servicio `postgres:16-alpine` levantado para libro/serie/tramos).
3. **`bot-suite` probablemente necesita ir AISLADO**, como `TRAMOS_PG_URL`/`scrum814`: es una
   suite grande de un solo `test()` con muchos pasos, y `scrum814` ya midió (comentario en
   ci.yml:262-275) que un test así, dentro de la tanda paralela de ~800 ficheros, revienta por
   timeout de transacción bajo carga aunque el defecto no sea suyo. **No medido si a
   `bot-suite` le pasaría lo mismo — es la primera cosa a comprobar al construir, no se
   supone.** `a55-window-quote` es un test pequeño (un solo `withMerchant`, dos casos); no hay
   señal de que necesite aislarse.

## Por qué no lo construyo hoy

Esto es dinero y bot (dos de los caminos que la Parte I trata con más cuidado), y esta casa
exige **verificado en rojo** antes de dar un guard/gate por bueno — no «debería funcionar».
Verificarlo de verdad exige un Postgres real corriendo los dos ficheros contra él, y en esta
máquina eso implica montar el banco portable documentado en la memoria de equipo
(`project_postgres_banco_local.md`): sin Docker ni WSL, binarios portátiles de 338 MB, con un
historial de que el Sensor de almacenamiento de Windows se lleva `share/`/`bin/` a mitad de
sesión. Medido hoy: el cluster de una sesión anterior (`$TEMP\pgb`, puerto 55432) sigue con
procesos `postgres` vivos pero **no escucha** y le faltan `psql.exe`/`pg_isready.exe` — hay que
volver a montarlo desde cero. Es una inversión real (descarga + `initdb` + verificación), y
apresurar un cambio de gate en el camino del bot/dinero sin esa verificación viva sería
exactamente lo que este ticket, y esta casa, piden no hacer.

**Con esto el ticket pasa de "M, no listo esta semana" a "listo para construir": el diseño está
medido y decidido, solo falta ejecutarlo con su verificación en rojo.** Rama aparte, como pide
el ticket.

## Lo que NO cubre este apéndice

* No implementa nada: cero cambios en `ci.yml`, en los dos test files ni en ningún script.
* No decide si `bot-suite` necesita aislarse — eso se mide al construir, con el banco real.
* No toca `assertSafeStagingUrl`, `_staging-db.mjs` ni el camino de staging existente.
* No actualiza el inventario de `scrum419` (SCRUM-868 ya lo reportó como trabajo del grupo B,
  no de éste — regla 9).

## Ficheros

`docs/master/SCRUM-868.md` (este apéndice). Ninguno más — solo lectura.
