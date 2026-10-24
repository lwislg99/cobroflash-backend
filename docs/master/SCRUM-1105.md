# SCRUM-1105 · Los seeds aceptan `--dev`/`--staging` y resuelven la clave por dentro

**Medido contra:** `origin/main` = `dac1f9d7f9cd5237778aa2cd3f9241bd2210855a` · 2026-09-25T14:57:22Z

**Puesto:** J3 · Alta y crecimiento (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1105-seeds-destino-por-bandera`

**Enunciado (Jira, título entero, sin cuerpo):** «Que los seeds acepten `--dev`/`--staging` y resuelvan
la clave por dentro: hoy una sesión tiene que exportar una credencial a mano, y el clasificador lo
bloquea (con razón)». Esta sesión no tenía Jira; el orquestador pegó el enunciado y confirmó el alcance.

## 1 · PASO 0 — el defecto existe hoy (medido corriendo)

- Los tres sembradores, `seed-demo.mjs`, `seed-video.mjs` y `seed-staging.mjs`, leían **solo**
  `process.env.DATABASE_URL`.
- `cargarEnvDelEquipo` (`_cargar-env.mjs`, SCRUM-932) mira 2 ficheros. Encuentra el `.env` del checkout
  principal, con 3 claves: `DATABASE_URL_STAGING` → `acela.proxy.rlwy.net/railway`,
  `DATABASE_URL_DEV` → `acela.proxy.rlwy.net/yaqu_dev_javier` y
  `DATABASE_URL_TESTS` → `acela.proxy.rlwy.net/yaqu_dev_javier`. **`DATABASE_URL`: ausente**, y es a
  propósito (SCRUM-418: en un árbol no vive producción).
- Consecuencia: para sembrar había que copiar el valor de una credencial a `DATABASE_URL` en la línea
  de órdenes.

## 2 · Lo que se hace

`scripts/_destino-de-semilla.mjs` → `fijarDestinoPorBandera({argv, env, cwd})`:

1. `argv` con **exactamente una** de `--dev` / `--staging`. Si vienen las dos, se aborta. No existe
   ninguna bandera para producción ni una genérica `--clave=`.
2. `cargarEnvDelEquipo` y lectura de `DATABASE_URL_DEV` o de `DATABASE_URL_STAGING`.
3. `comprobarClaveVsDestino`, que compara **host Y nombre de base**. Si falla, el mensaje dice
   **cuál de los dos** («Falla: la BASE.» / «Falla: el HOST»).
4. `destinoSembrable`: la allowlist, en la que producción no está.
5. `env.DATABASE_URL = url`, **solo en el proceso**: nada en argv, nada en disco y nada en ningún
   mensaje. Lo único que sale es `host/base`.
6. Si ya venía una `DATABASE_URL` heredada, **se ignora y se avisa**: manda la bandera.

Los tres seeds lo llaman antes de leer `DATABASE_URL`, y después siguen **su mismo camino de
siempre**: `destinoSembrable` en demo y vídeo, `assertSafeStagingUrl` en staging. Sin bandera, el
comportamiento es exactamente el de antes.

Medido: Prisma resuelve `DATABASE_URL` **al conectar, no al construirse**. Se comprobó con un cliente
construido con la URL A, la variable cambiada a B y `$connect`: el error nombró B. Por eso no importa
que los `import` de `dist/` construyan el singleton antes que el guard.

## 3 · SCRUM-208: se sustituye un control que no discriminaba por uno que sí

Con bandera, **no se pide `SEED_DEMO_CONFIRM` / `SEED_VIDEO_CONFIRM`**. No es que se quite un
control, y va con la medición delante:

- Ese control confirma el **hostname**, y el hostname de dev y el de staging es **el mismo**:
  `acela.proxy.rlwy.net`, medido arriba en §1. Frente al caso peligroso (sembrar en staging creyendo
  que era dev, o al revés) no distinguía nada.
- La bandera nombra la **base**, y `comprobarClaveVsDestino` exige que la base sea la prometida. Es
  un control **más** preciso.
- Producción sigue cerrada **antes** de todo eso, por la allowlist (SCRUM-381). Ninguna bandera la
  nombra.

Firmado por el orquestador en el chat de la tanda (25-sep-2026). Sin bandera, la confirmación sigue
exigiéndose igual que antes: el test de SCRUM-381 sobre el orden (allowlist antes que confirmación)
sigue en verde.

## 4 · Verificación

`tests/scrum1105-semilla-destino-por-bandera.test.mjs`: 8 tests, puros, con un `.env` de pega en un
directorio temporal fuera del repo.

| pasada | resultado |
|---|---|
| base (código de la rama) | 8 pass · 0 fail |
| M1 · helper sin `comprobarClaveVsDestino` | **2 fail**: «--dev → base de STAGING» y «--staging → PRODUCCIÓN» |
| M2 · los tres seeds como en `main` | **1 fail**: «seed-demo.mjs no llama a fijarDestinoPorBandera» |

Contra el `.env` real, sin escribir en ninguna base:

- `--dev` fija `acela.proxy.rlwy.net/yaqu_dev_javier` y `--staging` fija `acela.proxy.rlwy.net/railway`.
- `seed-staging.mjs --dev --staging` aborta con exit 1.
- `seed-video.mjs` sin bandera aborta diciendo cómo nombrar el destino.

### 4.1 · `npm test` completo: lo que cayó y de quién era

La primera pasada dio **8.322 tests · 8.179 pass · 9 fail · 134 skipped**. Todos los ficheros que
fallaron se corrieron solos en la rama y después en la **base**: los tres seeds devueltos a
`origin/main` y mis dos ficheros nuevos retirados, restaurado todo después con `git checkout HEAD`.

| fallo | de quién | qué se hizo |
|---|---|---|
| SCRUM-864c · un `mkdtempSync` sin borrar | **mío** (mi test) | pasa a usar `temporal()` de `tests/_temporal.mjs` |
| SCRUM-921c · el trinquete baja de 28 a 27 | **mío** | ver abajo |
| SCRUM-804b, SCRUM-939b ×3, SCRUM-910d | ajenos: fallan **igual en la base** | nada; son de esta máquina/`main`, no de esta rama |
| SCRUM-815, SCRUM-824b | ajenos: cayeron solo con la suite entera | solos pasan, en la rama y en la base |

**SCRUM-921c, el que enseña algo.** `seed-video.mjs:12` dice «el fundador decide la BD». El guard
lo cuenta como una marca de firma del fundador, y sin respaldo. Mi línea nueva de uso, en el mismo
bloque de comentario, llevaba `SCRUM-1105`, y el guard acepta un `SCRUM-<n>` en el bloque como
«dice dónde consta». Resultado: la marca salió del censo **sin que nadie firmara nada**, y el
trinquete bajó. Se arregló el **código**, no el guard (regla 41): el número de ticket sale de ese
bloque y el trinquete vuelve a 28. Después, 921c + el test nuevo: 21 pass · 0 fail.

**Suelo declarado:** ningún seed se ha corrido hasta escribir. `seed-demo` **borra** el merchant 1
de la base elegida, y sembrar no era el encargo.

## 5 · Declarado, no arreglado

- `DESTINOS_ESPERADOS.DATABASE_URL_TESTS.porWorktree` (`_clave-vs-destino.mjs`) no conoce los árboles
  `cobroflash-jv*`. **No afecta a este ticket**, porque `--dev` y `--staging` tienen base fija y no
  pasan por ese mapa. Si hay que arreglarlo, va con su propio ticket (orden del orquestador).
- `seed-staging.mjs` está en `CODEOWNERS` (`@lwislg99`): el PR necesita esa revisión.

## 6 · Censo pedido: ¿sirve el patrón para los demás scripts que leen `DATABASE_URL` a pelo?

Solo medido, no tocado. Población: `git grep` de `process.env.DATABASE_URL` en `scripts/` de
`origin/main`, **19 ficheros**. Control positivo: los 3 seeds están entre ellos. No entran los
scripts que dejan que Prisma lea la variable por su cuenta, sin nombrarla.

- **Ya resuelven su clave por dentro (5):** `censo-escalera-por-estado`,
  `pasada-real-etiquetas-del-documento`, `test-staging-gated`, `turno-staging` y
  `clean-staging-tests`.
- **Candidato claro (1):** `marcar-staging.mjs`, que escribe en staging con `assertSafeStagingUrl`.
- **No es este patrón (4):** `backup-restore` (su destino es la base DESECHABLE, con otra allowlist),
  `db-push-prod`, `backup-bd` y `backfill-quote-jobid` (estos tres miran `PROD_HOST`: están pensados
  para producción o la vigilan).
- **Sin clasificar sin leerlos uno a uno (6):** `backup-dump`, `cambiar-flag-fiscal`,
  `censo-vias-de-cobro`, `conciliar-auditoria-fiscal`, `preview-migracion` y `puerta-cliente-real`.

# SCRUM-1105b · El cuarto sembrador: `prisma/seed.ts` también elige su base por bandera · carril J3

**Medido contra:** `origin/main` = `4c6c70e846d3e80b72be210e5010c1e43a9a15f8` · 2026-10-24T10:21:45Z

A9: comprobación → `tests/scrum1105b-prisma-seed-por-bandera.test.mjs`

**Puesto:** J3 (`jv-j3ba`, equipo de Javier) · **Rama:** `scrum-1105b-prisma-seed-con-bandera`. El hook de
arranque dijo «SIN IDENTIDAD» (SCRUM-1498); el puesto lo da el encargo del orquestador, y se dice aquí.

## 1 · PASO 0 — 3 de los 4 seeds ya estaban hechos

- **Ya en `main` por #1762** (merge `0a504cf774328b3de396d8958e47075bbea8b7a2`, 25-sep): `seed-demo.mjs`,
  `seed-video.mjs` y `seed-staging.mjs` aceptan `--dev`/`--staging` (tramo de arriba). Jira seguía en «Por
  hacer» y sin comentarios: por eso el ticket parecía sin empezar.
- **El resto, medido hoy:** `prisma/seed.ts` (`npm run seed`, y `npm run db:seed` vía `package.json#prisma.seed`)
  leía solo `DATABASE_URL`, y su mensaje de rechazo enseñaba `DATABASE_URL=<la de dev> npm run db:seed`: copiar
  la credencial a mano, que es lo que el ticket quita. El tramo de arriba contó «tres sembradores» y SCRUM-746
  contó otros tres; ninguno de los dos conteos tenía los cuatro.
- `carriles.mjs de prisma/seed.ts` → «sin fila en §3: nadie lo reclama». No es de ningún S*. Se toca solo ese
  fichero de `prisma/` (orden del orquestador); `schema.prisma` no se toca.

## 2 · De paso: `prisma/seed.ts` no compilaba

Desde SCRUM-746 su `import()` de `_db-guard.mjs` daba **TS7016** (el `.mjs` no trae tipos) y ts-node paraba
antes de la primera línea: `npm run seed` y `npm run db:seed` estaban rotos en `main`. Nadie lo vio porque
ningún test ejecutaba el fichero (746b lo lee con una regex). Se arregla con `@ts-expect-error` en los dos
`import()`, que nombra el error aceptado y cae solo si un día el `.mjs` trae tipos.

## 3 · Lo que se hace

`prisma/seed.ts` llama a `fijarDestinoPorBandera` (`scripts/_destino-de-semilla.mjs`, el mismo de los otros
tres) **antes** de leer `DATABASE_URL`, y después sigue por su camino de siempre (`destinoSembrable`).

- `npm run seed -- --dev` (o `--staging`) · o `npm run db:seed -- -- --dev`: prisma necesita su propio `--`.
  **Medido**, con el cliente de pega y las dos banderas (que se niegan antes de leer ningún `.env`):
  `prisma db seed -- --dev --staging` lanza `ts-node prisma/seed.ts --dev --staging` y sale el rechazo del
  seed; `prisma db seed --dev` lo para prisma con «unknown or unexpected option: --dev». La vía no se rompe:
  sin el `--` se niega con su motivo.
- **Sin bandera, el camino de antes**, y aquí me aparto de la frase del encargo («sin bandera se niega»): el
  comentario de SCRUM-746 en el propio fichero pone como condición no añadir fricción para sembrar en
  desarrollo, y los otros tres seeds tampoco se niegan sin bandera. Producción queda cerrada igual por las
  dos vías: con bandera, por `comprobarClaveVsDestino` + allowlist; sin ella, por la allowlist. Lo que cambia
  sin bandera es el mensaje: ya no enseña a exportar la URL, sino `npm run seed -- --dev`.
- Ningún mensaje lleva la URL: sale `host/base` y nada más.

## 4 · Verificación — ningún seed contra ninguna base

`tests/scrum1105b-prisma-seed-por-bandera.test.mjs`, 7 casos. Ejecuta el `prisma/seed.ts` REAL en un proceso
hijo, con el binario de ts-node (lo que lanza `npm run seed`), un `.env` de pega en un temporal fuera del
repo y **sin base posible**: un `-r` cambia `@prisma/client` por un cliente que, en la primera consulta,
imprime `host/base` y lanza; y `PRISMA_QUERY_ENGINE_LIBRARY` apunta a un fichero que no existe.

| pasada | resultado |
|---|---|
| base (rama) | 7 pass · 0 fail |
| M0 · `prisma/seed.ts` de `main` | **7 fail** de 7 |
| M1 · sin los `@ts-expect-error` (el TS7016 de §2) | **6 fail** (pasa solo el caso AST) |
| M2 · sin llamar a `fijarDestinoPorBandera` | **5 fail** (pasan `--prod` y «sin bandera», que no dependen de ella) |

Después de las tres, `prisma/seed.ts` == HEAD (comparado por contenido).

**Lo que me salió mal, y cómo se ve:** la primera versión del test lanzaba el hijo con
`node -r ts-node/register`, y así el hijo salía **mudo y con código 0**, sin ejecutar nada. Un verde
que no habría ejecutado nada. Lo cazó el control positivo (la marca del cliente de pega tiene que salir en
`--dev` y `--staging`), y el test pasó al binario. Por qué `-r ts-node/register` sale mudo en Node 24: sin medir.

**Guards dirigidos**, sobre la rama con `origin/main` mergeado y `dist/` construido con `tsc --noCheck`:
27 ficheros (1105, 1105b, 1294, 1415, 237, 262, 267, 273, 381 ×2, 383, 418, 418c, 419, 700, 702, 719, 723,
744, 746, 746b, 812, 824, 836, 864c, 921c, 976) → **254 tests · 254 pass · 0 fail · 0 skipped**. Control
positivo: los 7 casos de 1105b están entre los 254. **Suite entera local: NO CORRIDA** (10 sesiones a la
vez; el obligatorio de CI hace de tanda).
