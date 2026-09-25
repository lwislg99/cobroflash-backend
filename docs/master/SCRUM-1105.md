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
