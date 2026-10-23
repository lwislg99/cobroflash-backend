# SCRUM-1575 · El preview de migraciones pasa por el guard de destino antes de conectar

**Medido contra:** `origin/main` = `63ad68347c0c6df7f22bcc5900f0eb8fa369b8e7` · 2026-10-22T09:54:41Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575-preview-por-destino.test.mjs`

22-oct-2026 · **J5** (sesión `jv-j5r`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1575 entero, descripción y 0 comentarios.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Etiquetas: `area-j5`, `equipo-javier`, `calidad`, `instrumentos`. Los dos ficheros tocados salen
sin cerradura (fila general `scripts/**`, según el ticket); el test y este registro son nuevos.

## PASO 0

- `git log origin/main --grep=1575` → solo aciertos del PR #1575 (SCRUM-985/236), otra cosa.
  `ls-remote 'refs/heads/scrum-1575*'` → 0. `docs/master/SCRUM-1575.md` → no existía.
- `scripts/preview-migracion.mjs` en `8ad167195` y en `f02e48be2`: 10.355 B, sin `_clave-vs-destino`.
  Lo encontró jv-j5n (SCRUM-1569 c.20212) y lo confirmó jv-j4k.

## 🔴 El diseño del ticket estaba mal, y el del orquestador también

El ticket (y el encargo) pedían `exigirDestinoCorrecto('DATABASE_URL', …)` **más**
`comprobarCredencialDeProduccion`. Antes de construirlo pasé las dos funciones puras con URLs fabricadas,
sin conectar a nada, sobre la clave `DATABASE_URL`:

| URL fabricada (host/base)            | `comprobarClaveVsDestino` (383) | `comprobarCredencialDeProduccion` (418) |
|--------------------------------------|---------------------------------|-----------------------------------------|
| `autorack.proxy.rlwy.net/railway`    | `cuadra`                        | `produccion_en_arbol`                   |
| `acela.proxy.rlwy.net/yaqu_dev_javier` | `no_cuadra`                   | `cuadra`                                |
| `acela.proxy.rlwy.net/railway`       | `no_cuadra`                     | `cuadra`                                |
| `127.0.0.1/nada`                     | `no_cuadra`                     | `destino_no_reconocido`                 |

Por qué: en `DESTINOS_ESPERADOS`, `DATABASE_URL` **promete PRODUCCIÓN**, así que la de 383 solo aprueba
producción y la de 418 solo la rechaza. Si se ponen las dos, el preview **se niega siempre**, también contra
dev, y eso contradice el propio criterio de aceptación («una de dev → sigue»). `aplicar-sql-dev.mjs` sí
puede usar la de 383 porque su clave es `DATABASE_URL_DEV`, que promete una base que no es producción.

Se lo mandé al orquestador antes de escribir código, y lo aprobó por mensaje: solo la de 418, sobre la
MISMA url que recibe el hijo.

## Lo que cambia

`scripts/preview-migracion.mjs`:
- `urlDelHijo(env)`: una sola función para la URL que comprueba el guard y la que recibe el hijo de Prisma
  (`ejecutorLocal`). Así no pueden ser dos URLs distintas.
- `destinoDelPreview({ desde, env, worktree })`: con `--desde` → `offline`, no se pide URL. Sin `--desde`
  y sin `DATABASE_URL` → `sin_url`, se niega. Con URL → `comprobarCredencialDeProduccion('DATABASE_URL', …)`,
  y todo lo que no sea `cuadra` se niega con el motivo del guard (producción, destino sin declarar o URL
  ilegible).
- En el arranque, **lo primero, antes de lanzar Prisma**: si `destino.ok` es falso → `stderr` + salida 1.

Con esto vuelve a ser verdad la frase de `CLAUDE.md` («desde SCRUM-418 el guard lo hace cumplir por
DESTINO») para el preview, que es justo el guard de 418. La frase no se ha tocado: es de un jefe.

## Rojo, verde y mutaciones (local, `node --test` del fichero; ningún caso conecta con nada)

- **Rojo:** con el script de `origin/main` (10.355 B) el test cae al importar (`does not provide an export
  named 'URL_QUE_NO_LLEVA_A_NADA'`). Es un rojo débil, porque cae antes de los casos. El que demuestra que
  la llamada está montada es la mutación A.
- **Verde:** 5 tests, 5 pass, 0 fail.
- **Mutación A** (anular la negativa del arranque, con la función intacta): 4 pass + 1 fail = 5. Cae el test
  del proceso hijo.
- **Mutación B** (`destinoDelPreview` deja de negarse ante la credencial): 3 pass + 2 fail = 5.
- Después de cada mutación el árbol vuelve exacto al commit (`git diff HEAD` = 0 B).
- Vecinos (`scrum1575`, `scrum385`, `scrum418`, `scrum383`, `scrum1526`, `scrum237`, `scrum976`): 68 tests,
  65 pass, 3 fail. Los 3 son de `scrum385` y caen porque **este árbol no tiene `node_modules`** («no hay CLI
  de Prisma en node_modules»), no por el cambio. En CI se corren con el CLI.

## Lo que NO se ha medido

- El proceso hijo, en local, se negó antes de lanzar Prisma. Bajo la mutación A cayó porque falta el CLI;
  **en CI, con el CLI, intentaría conectar al loopback `127.0.0.1:1`**, y eso no lo he visto aquí. La URL de
  producción fabricada NO se pasa nunca al hijo, a propósito: sin el guard intentaría conectar con ella.
- `--desde` ejecutado de verdad, con el CLI: no aquí (sin `node_modules`). Lo cubre `scrum385` en CI; mi
  test lo cubre en la función pura.
- No se ha barrido qué otros scripts conectan con `DATABASE_URL` sin pasar por el guard: el encargo era
  el preview.
- El obligatorio de esta rama: se lee después del empujón y va en la entrega y en Jira, no aquí.
- Visto en yaqu.app: NO HECHO → no hay pantalla; es un script de desarrollo.

## Errores propios

- La ficha pide medir el contexto dos veces, al acabar el arranque y al acabar Jira. Leí Jira lo primero,
  así que solo hay un punto: **119.751** al terminar las dos.
- Para traer el script viejo y ver el rojo, choqué tres veces con `guard-dangerous` (un `>` que truncaba,
  y dos `git checkout --` con cambios sin commitear, uno de ellos encadenado al commit en el mismo comando).
  La vía limpia fue un commit de trabajo local y un `git stash push -m` con etiqueta, soltado por su sha.
  No usé `.claude/allow-destructivo`.

## SCRUM-1575b · ¿Qué otros scripts conectan con una base sin pasar por el guard de destino?

**Medido contra:** `origin/main` = `0d5fc6b0d0d72f844bd62f3b7eb7f1590e68f970` · 2026-10-22T10:55:01Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575b-censo-conexiones.test.mjs`

22-oct-2026 · **J5** (sesión `jv-j5s`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier. Tramo nuevo de este registro, no ticket nuevo, como pidió el encargo.
Leído en Jira: SCRUM-1575 entero, descripción y su único comentario (c.20277).] Carril a mano: el hook dijo
«SIN IDENTIDAD» (SCRUM-1498). Los tres `scripts/` tocados salen SIN CERRADURA (`dos-equipos.md:172`, fila
general, y ninguno es verificación ni censo de consulta salvo el censo nuevo); los dos tests, «sin fila».
PASO 0: ninguna rama `scrum-1575*` en el remoto, nada de `1575b` en `main` ni en `docs/master/`.

### El instrumento

`scripts/_censo-conexiones-a-base.mjs`, por AST (`typescript`), sobre `scripts/**` y `tests/**`. Reutiliza el
criterio de SCRUM-746 (`censoDeConexiones`, que solo mira `new PrismaClient` con regex) y lo ensancha:
`$executeRaw*`/`$queryRaw*`, procesos hijo (`prisma db …`, `prisma migrate …` con URL, `psql`, `pg_dump`,
`pg_restore`), `await import()` desestructurado y guards llamados a través de un módulo local.
**Población:** 1.967 ficheros, 1.937 parseados, 61 conectan. Fuera del AST: `scripts/db-push-prod` (bash,
contra producción por diseño, con GO explícito) y `scripts/validate-registros-xsd.ps1`.
**Positivo sembrado:** el propio instrumento analiza un script fabricado que borra filas sin guard
(`SIEMBRA`); si no lo ve, o el árbol no tiene conexiones, sale `CIEGO` con código 2. Visto con un árbol de
un solo fichero sin base.

| clase | n | qué es |
|---|---|---|
| `sin_guard_escribe` | 0 (eran 2) | conecta, escribe y no comprueba el destino |
| `sin_guard_lee` | 6 | conecta y solo lee, sin comprobar |
| `guard_propio` | 14 | se niega comparando `.host`/`.base`/`*_HOST` a mano dentro de un `if` o un `assert` |
| `usa_cliente_ajeno` | 11 | no abre conexión: usa un cliente que le pasan |
| `banco_desechable` | 14 | tests de `LIBRO_PG_URL`/`destinoDesechable` |
| `protegido` | 16 | llama a `_clave-vs-destino` o `_db-guard`, directo o por un módulo local |

### Los dos graves, arreglados

- `scripts/backfill-quote-numbers.mjs`: `new PrismaClient()` a pelo (la `DATABASE_URL` implícita del esquema)
  y escribe con `--apply`. SCRUM-746 lo tenía en `NO_SON_PROBLEMA` («mitigación, no guarda»).
- `scripts/backfill-quote-jobid.mjs`: escribía con `--aplicar` y su única comprobación era un ternario en un
  `console.log` que AVISA «ES PRODUCCIÓN» y sigue.

Los dos llaman ahora a `comprobarCredencialDeProduccion('DATABASE_URL', url, …)` sobre la MISMA `url` que
reciben en `new PrismaClient({ datasources: { db: { url } } })`, antes de construirlo, y se niegan (salida 1)
si no es `cuadra`. El patrón es el del preview (SCRUM-1575), no `exigirDestinoCorrecto`: con la clave
`DATABASE_URL` ésa solo aprueba producción. `backfill-quote-numbers.mjs` carga `dotenv/config` para que el guard
vea la misma URL que antes leía Prisma del `.env`. En `tests/scrum746-…` pasa de `NO_SON_PROBLEMA` a
`CERRADOS_EN_FASE_B`: el trinquete inverso caerá si alguien le quita la guarda. Eso endurece el guard, no lo
relaja.

**🔴 La puerta que se cierra, dicha (condición del orquestador):** desde un árbol de trabajo, estos dos
backfills **ya no se pueden correr contra producción**, ni en modo preview. Es a propósito y es la regla de
SCRUM-418: la URL de producción vive en Railway y no baja a ninguna máquina (AA1.9). Si algún día hiciera
falta uno contra producción, lo decide y lo ejecuta el fundador, fuera de un árbol de trabajo. **No he medido
ninguna vía concreta para hacerlo** (ni la consola de Railway ni otra), y no la escribo aquí para no
inventarla. Contra dev o staging (destinos declarados) siguen corriendo.

### Rojo, verde y mutación (local; ningún caso conecta con una base)

- **Verde:** `tests/scrum1575b-censo-conexiones.test.mjs`, 8 pass + 0 fail = 8.
- **Rojo:** con los dos backfills de `origin/main`, el fichero nuevo más el de 746: 8 pass + 4 fail = 12
  (trinquete, los dos hijos y el trinquete inverso de 746). Esa pasada fue antes de añadir los 2 casos de AST.
- **Mutación** (el constructor de `backfill-quote-numbers.mjs` vuelve a `new PrismaClient()`): 7 pass + 1 fail
  = 8; cae su caso de AST. Árbol devuelto: `git diff HEAD -- scripts/` vacío.
- Los hijos van con `127.0.0.1:1`, que el guard no reconoce. La URL de producción fabricada solo entra en la
  función pura; nunca a un proceso, porque sin guard intentaría conectar con producción.
- **Vecinos** (18 ficheros: 1575, 746, 418, 383, 195, 414, 381, 237, 976, 1526, 927): 117 pass + 6 fail = 123.
  Los 6 son de `dist/`, que este árbol no trae (`ERR_MODULE_NOT_FOUND` en `dist/…`, y 381 lo dice: «`dist/` no
  está construido»). Ninguno nombra un fichero de esta rama.

### Lo que no se toca: tabla con carril (condición del orquestador)

| fichero | clase | carril (`carriles.mjs de`) |
|---|---|---|
| `scripts/backup-dump.mjs` | sin_guard_lee | SIN CERRADURA (`dos-equipos.md:172`) |
| `scripts/censo-vias-de-cobro.mjs` | sin_guard_lee | SIN CERRADURA |
| `scripts/puerta-cliente-real.mjs` | sin_guard_lee | SIN CERRADURA |
| `scripts/verificar-email-messages.mjs` | sin_guard_lee | SIN CERRADURA |
| `scripts/verificar-vf-submissions.mjs` | sin_guard_lee | SIN CERRADURA |
| `tests/scrum815-el-modelo-apunta-a-la-tabla.test.mjs` | sin_guard_lee | sin fila |
| `scripts/_rastro-limpieza.mjs` | usa_cliente_ajeno | SIN CERRADURA |
| `scripts/_staging-lock.mjs` | usa_cliente_ajeno | SIN CERRADURA |
| `tests/banco-scrum911/estado.mjs` | usa_cliente_ajeno | sin fila |
| `tests/banco-scrum911/paso2-ciclo.mjs` | usa_cliente_ajeno | sin fila |
| `tests/banco-scrum911/paso6-iva-929.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum1304-un-cobro-una-factura.test.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum234-carrera-serie.gated.test.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum574-mismo-cliente-tras-migracion.test.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum593d-viaje-completo-del-texto.test.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum728-serie-ocupada-postgres.test.mjs` | usa_cliente_ajeno | sin fila |
| `tests/scrum855-el-doble-llama-al-callback.test.mjs` | usa_cliente_ajeno | sin fila |

`guard_propio` (14): 6 de ellos (`medir-concurrencia-emision`, `renumerar-documentos`, y los tests 592, 767,
781 y 793) leen `DATABASE_URL_DEV=` del `.env` a mano y solo comprueban que la base se llame
`yaqu_dev_javier`, **no el host**. No es el caso grave (la clave promete dev), pero es más débil que
`exigirDestinoCorrecto`. Los otros 8 se nombran en la salida del censo. No se han tocado.

### Lo que NO se ha medido

- «Llama al guard» no es «lo llama antes de conectar»: `guardaAntes` compara la posición en el texto.
  `aplicar-sql-dev.mjs`, `preview-migracion.mjs` y `seed-video.mjs` salen «DESPUÉS en el texto»; el del preview
  sé que va antes en ejecución (registro de arriba); **los otros dos no los he leído**.
- Un proceso hijo armado entero en variables, sin ningún literal de una palabra, no lo ve.
- La protección indirecta se da si el fichero llama a CUALQUIER cosa de un módulo local que llama a un guard.
- `src/` y `prisma/` quedan fuera (los mira 746). Los `usa_cliente_ajeno` no se han seguido hasta quien
  construye su cliente.
- Los dos backfills, ejecutados contra una base de verdad: no (encargo: nada contra ninguna base).
- El obligatorio de esta rama: va en la entrega y en Jira, no aquí.
- Visto en yaqu.app: NO HECHO → no hay pantalla; son scripts de desarrollo.

### Errores propios

- El instrumento salió mal **cuatro veces** antes de valer, y lo cacé mirando a mano los graves, no por un
  test: no veía `await import()` desestructurado (`backup-restore.mjs` salía sin guard y llama a
  `destinoDesechable`), contaba como «conecta» a quien solo recibe un cliente, daba por guard propio a quien
  solo NOMBRA `PROD_HOST`, y contaba como guard un ternario que avisa y sigue (`backfill-quote-jobid.mjs`).
  Cada caso tiene ahora su fichero en la siembra del test.
- Encadené el commit de trabajo y el `git checkout` del rojo en una orden: el hook paró la orden ENTERA y el
  commit tampoco se hizo. Lo vi en la lista de ficheros que dio el hook, no lo supuse.
- Contexto: 86k al acabar el arranque, 114k tras Jira, 203.664 al avisar al orquestador; pasé de 200k sin
  medirme entre medias.

## SCRUM-1575c · El censo ve el singleton y los clientes que le abren otros

**Medido contra:** `origin/main` = `82f3ea4115723db78ca56c4b2e1c426a810a0433` · 2026-10-23T02:44:29Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575c-censo-ve-el-singleton.test.mjs`

23-oct-2026 · **J5** (sesión `jv-j5v`, equipo de Javier), relevo de `jv-j5t` (murió por un corte de la API con
el censo a medio editar, sin commit), por encargo del orquestador (`cobroflash-backend-62`). [Escrito por la
sesión, no por Javier. Leído en Jira: SCRUM-1575 entero, descripción y c.20277, c.20297 y c.20331.] Carril a
mano: el hook dijo «SIN IDENTIDAD» (SCRUM-1498). `scripts/_censo-conexiones-a-base.mjs` sale SIN CERRADURA
(`dos-equipos.md:172`); el test y este tramo son nuevos. PASO 0: nada de `1575c` en `origin/main` ni rama en
el remoto; lo que había era la edición sin commit de jv-j5t (las dos constantes `LEE_PRISMA` y `SINGLETON`).

### Arriba: los que escriben sin guard

**Ninguno, también con la población nueva.** Con el censo arreglado salen 144 ficheros que conectan (eran 61),
83 filas nuevas y ninguna en `sin_guard_escribe` ni en `sin_guard_lee`. Los más cercanos a «escribe contra
staging sin el guard de la casa» son los de `tests/banco-scrum911/` (tabla de abajo): escriben con
`.deleteMany`/`.update`/`.create` y solo comprueban a mano `host === STAGING_HOST`. Eso cierra producción,
pero no separa staging de dev: según el mapa de `_clave-vs-destino`, comparten el host `acela` (tabla de
c.20277). No están arreglados (encargo: clasificar, no arreglar).

### El hueco que tenía el censo de 1575b

Medido por jv-j5t: solo contaba como conexión `new PrismaClient`, el SQL crudo y los procesos hijo. Lo que
ahora ve, y el caso sembrado que cae si se le quita (mutación sobre el fichero, test de 1575c):

| pieza | qué ve | sin ella |
|---|---|---|
| singleton | `import { prisma } from '../dist/core/db/prisma.js'` + una consulta sobre ese nombre | 2 pass + 3 fail; el CLI dice `CIEGO` y sale 2 |
| consulta de modelo | `x.modelo.método({…})`; el argumento tiene que ser un objeto literal (`mapa.delete(id)` no cuenta) | — (la usan todas) |
| `abiertoPor` | `limpiar.mjs` llama a `prismaStaging()` de `_entorno.mjs`, que abre: hereda su conexión y su guard a mano | 4 pass + 1 fail |
| import por efecto | `import './_staging-db.mjs'` corre el guard sin nombrar nada | 4 pass + 1 fail |
| posición de la conexión | la primera CONSULTA, no el `new` (Prisma conecta al consultar); el hijo, en su `spawn`, no en 0 | 3 pass + 2 fail |
| `const db = prisma` | alias del mismo cliente | 4 pass + 1 fail |
| `$transaction` | es una consulta del cliente sobre el que se llama | 4 pass + 1 fail |
| `({ prisma } = await import(…))` | por asignación, sin `const` (`scrum814`) | — (lo cubre la siembra por asignación) |
| `await imp('dist/…')` | envoltorio que importa desde la raíz (`banco-scrum911/paso2/3/4/6`) | 4 pass + 1 fail |
| `[…].includes(p.host)` | comprobación de destino por lista (`scrum728`, `scrum814`) | 4 pass + 1 fail; `scrum814` pasaría a `sin_guard_escribe` |
| fuera Stripe | `stripe.prices.create({…})` no es Prisma | 4 pass + 1 fail |

Siembra: `SIEMBRA_SINGLETON` (un test que borra con el singleton) se suma a la de 1575b, y `veSusSiembras()`
exige las dos. El control de cero también está: importar el singleton sin consultarlo no cuenta como conexión.

### `aplicar-sql-dev` y `seed-video`: protegidos, y el «DESPUÉS» era del censo

Ahora salen `protegido` con el guard ANTES (en el test, sobre el árbol real). Lo volví a ejecutar yo, sin
`DATABASE_URL*` en el entorno salvo la que se pasa, y con `127.0.0.1:1` (nada escucha):

- `aplicar-sql-dev.mjs --file uno.sql --go`, `DATABASE_URL_DEV` al loopback → salida 1, «el destino NO cuadra»,
  0 «Can't reach». Se niega antes de lanzar Prisma.
- `seed-video.mjs`, `DATABASE_URL` al loopback → salida 1, «Confirma la BD de forma EXPLÍCITA», 0 «Can't reach».
- Positivo: el mismo con `SEED_VIDEO_CONFIRM=127.0.0.1` → pasa su guard y SOLO entonces intenta conectar:
  «Can't reach database server at `127.0.0.1:1`», en `prisma.merchant.count()`.
- `aplicar-sql-dev` no tiene positivo: haría falta una URL que cuadre con el destino de dev, y no hay ninguna
  que no sea la de verdad.

### Los que entran: tabla con carril (no se tocan)

60 de las 83 nuevas salen `protegido`: 59 por `import './_staging-db.mjs'` y 1 por `exigirDestinoCorrecto`. El
resto, y las 7 que cambian de clase (`carriles.mjs de`):

| fichero | clase | escribe | carril |
|---|---|---|---|
| `tests/banco-scrum911/limpiar.mjs` | guard_propio (vía `_entorno.mjs`) | `.deleteMany` `.updateMany` | sin fila |
| `tests/banco-scrum911/paso1-alta.mjs` | guard_propio (vía `_entorno.mjs`) | `.update` | sin fila |
| `tests/banco-scrum911/restaurar.mjs` | guard_propio (vía `_entorno.mjs`) | `.update` | sin fila |
| `tests/banco-scrum911/paso3-botones.mjs` | guard_propio (host) | `.create` `.update` | sin fila |
| `tests/banco-scrum911/paso4-api-y-ficha.mjs` | guard_propio (host) | `.create` `.updateMany` | sin fila |
| `tests/banco-scrum911/paso6-iva-929.mjs` | usa_cliente_ajeno → guard_propio | `.update` `.updateMany` | sin fila |
| `tests/banco-scrum911/paso2-ciclo.mjs` | usa_cliente_ajeno → guard_propio | — | sin fila |
| `tests/banco-scrum911/estado.mjs` | usa_cliente_ajeno → guard_propio | — | sin fila |
| `scripts/cambiar-flag-fiscal.mjs` | guard_propio (`FLAG_CONFIRM` = host) | — (lo detectado; escribe por un servicio) | SIN CERRADURA (`dos-equipos.md:172`) |
| `tests/scrum814-carrera-de-tramos-postgres.test.mjs` | guard_propio (loopback por lista) | `.create` | sin fila |
| `tests/scrum1346-…`, `1397-…`, `1403-…`, `1489-…`, `974-…` | banco_desechable (`LIBRO_PG_URL`) | `.create` | sin fila |
| `tests/scrum234-carrera-serie.gated.test.mjs` | usa_cliente_ajeno → protegido | `.create` | sin fila |
| `tests/scrum574-mismo-cliente-tras-migracion.test.mjs` | usa_cliente_ajeno → protegido | — | sin fila |
| `tests/scrum593d-viaje-completo-del-texto.test.mjs` | usa_cliente_ajeno → protegido | `.create` `.update` | sin fila |
| `tests/scrum52-operario.test.mjs` | banco_desechable → protegido | `.create` | sin fila |

Los 11 `usa_cliente_ajeno` nuevos (`_factura-fixture`, `_tenancy-diag`, 1291, 1296, 1330, 255, 399, 576, 815c,
984, `wa-log-sync`) los he leído uno a uno: son dobles (`prismaDoble`, `prismaFalso`, `bancoTabla`,
`mesaDeClientes`, un objeto literal) o funciones que reciben el cliente por parámetro. Ninguno abre nada.
`cambiar-flag-fiscal.mjs` escribe, pero a través de un servicio de `dist/` (`cambiarFlagFiscal` de
`flagFiscal.service.js`, `:81` y `:114`): «—» es lo que el censo detecta, no lo que hace. Es un ejemplo
del punto ciego de abajo.

### Lo que NO se ha medido

- **`_staging-db.mjs` protege solo con el gate puesto** (`QA_DB_TEST`, `A55_DB_TEST`, `BOT_SUITE_TEST`). Sin él no
  hace nada. Que los 59 se salten sin gate antes de consultar no lo he medido fichero a fichero.
- Un test que llama a un SERVICIO de `dist/` que escribe por dentro con el singleton: el censo solo ve a quien
  consulta con sus propias manos. Esa población no está contada.
- `abiertoPor` toma el primer módulo local llamado que abre, no sigue qué cliente concreto se usa.
- `guardaAntes` sigue siendo posición en el texto, no flujo de control (ahora con la primera consulta).
- `src/` y `prisma/` siguen fuera (los mira 746).
- El obligatorio de esta rama: va en la entrega y en Jira, no aquí. Visto en yaqu.app: NO HECHO, no hay
  pantalla (scripts y tests de desarrollo; además, producción no despliega desde el 20-oct).

### Errores propios

- Quité el seguimiento de `await imp(…)` porque «no cambiaba ninguna clase», y sí cambiaba lo que el censo
  dice: sin él, `paso2/3/4/6` salían como «abiertos por `_entorno.mjs`» cuando consultan el singleton. Medí la
  clase y no la fila entera. Lo cacé al comparar la salida completa; ahora tiene su caso sembrado.
- Mi primera versión seguía también el nombre `tx` dentro de `$transaction`: la mutación salió MUDA porque el
  `$transaction` ya cuenta como consulta. La quité en vez de dejar código que nada distingue.
- Escribí en el árbol fabricado que el `_staging-db.mjs` de pega saldría como fila, y no conecta: el error era
  de la expectativa, no del censo.

## SCRUM-1575d · Staging se comprueba por DESTINO en el banco 911, y el censo ve las escrituras por servicio de `dist/`

**Medido contra:** `origin/main` = `c26f7d6dd5af600e154919e7d341c0d8be2fc684` · 2026-10-23T03:16:19Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575d-staging-por-destino.test.mjs`

23-oct-2026 · **J5** (sesión `jv-j5w`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-62`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1575 entero, descripción y c.20277, c.20297,
c.20331 y c.20369.] Carril a mano: el hook dijo «SIN IDENTIDAD» (SCRUM-1498). `tests/banco-scrum911/*` sale
«sin fila en §3: nadie lo reclama» y `scripts/_censo-conexiones-a-base.mjs`, SIN CERRADURA
(`dos-equipos.md:172`), según `node scripts/carriles.mjs de`. PASO 0: nada de `1575d` en `origin/main` ni rama
en el remoto. El censo se midió sobre `bdcefe50c`; de ahí a `c26f7d6dd` sólo entra #2699 (SCRUM-1577), que no
toca ninguno de estos ficheros.

### Corrección al encargo: no eran 7 «guard_propio», eran 24

Los 7 de c.20369 son los que ENTRARON en esa clase con 1575c; la clase entera tenía 24 sobre `bdcefe50c`. Qué
compara cada uno y si separa staging de dev (que comparten el host `acela`). «Ejecutado» es con URLs
fabricadas a `127.0.0.1:1` o, para mostrar el hueco, al host de staging en un árbol SIN `node_modules` ni
`dist/`: si la comprobación deja pasar, el script cae al importar el cliente, sin red. Nada contra una base real.

| fichero | compara | escribe | ¿separa staging de dev? | cómo se midió |
|---|---|---|---|---|
| `scripts/aviso-programado-acreditacion-invoicing-es.mjs` | host (staging o prod-ro) | no | no — solo lee | lectura |
| `scripts/guard-acreditacion-invoicing-es.mjs` | host (staging o prod-ro) | no | no — solo lee | lectura |
| `scripts/censo-etiquetas-del-documento.mjs` | host ≠ producción | no | no — solo lee | lectura |
| `scripts/censo-tipo-cliente.mjs` | host ≠ producción | no | no — solo lee | lectura |
| `scripts/preflight-schema-drift.mjs` | host ≠ producción | no (`migrate diff`) | no — solo lee | lectura |
| `scripts/conciliar-auditoria-fiscal.mjs` | host clasificado (prod / staging / local) | no: transacción `READ ONLY` con sonda; su `$executeRawUnsafe` es `SET TRANSACTION`/`SAVEPOINT` (el censo lo cuenta como escritor: falso positivo, sin arreglar) | no — solo lee | lectura |
| `scripts/backup-bd.mjs` | host ≠ producción en origen y verificación; verificación ≠ origen y VACÍA antes de restaurar | `pg_restore`/`psql` en la base de verificación | no lo necesita: sólo escribe en una base vacía distinta del origen | lectura |
| `scripts/medir-concurrencia-emision.mjs` | base = `yaqu_dev_javier` | sí | **sí, por base** (no mira el host) | condición evaluada sobre URLs fabricadas: `acela/yaqu_dev_javier` → pasa, `acela/railway` → se niega; el script no corre aquí (importa `node_modules` antes) |
| `scripts/renumerar-documentos.mjs` | base = `yaqu_dev_javier` | sí (`--aplicar`) | **sí, por base** | igual que la fila anterior |
| `tests/scrum592-…`, `scrum767-…`, `scrum781-…`, `scrum793-…` | base = `yaqu_dev_javier` (`assert`) | sí | **sí, por base** | igual; gateados por `QA_DB_TEST` |
| `tests/scrum814-carrera-de-tramos-postgres.test.mjs` | loopback + `_test` + lista de prohibidas | sí | sí (ni staging ni dev) | lectura |
| `scripts/cambiar-flag-fiscal.mjs` | `FLAG_CONFIRM` = host | **sí, por `cambiarFlagFiscal()` de `dist/`** | **NO** | ejecutado: `127.0.0.1:1/yaqu_dev_x` y `127.0.0.1:1/railway` con `FLAG_CONFIRM=127.0.0.1` pasan las dos y caen al importar `dist/core/db/prisma.js` |
| `tests/banco-scrum911/_entorno.mjs` (`prismaStaging`) | host = staging | — (abre para otros) | **NO** → arreglado | ejecutado, abajo |
| `tests/banco-scrum911/limpiar.mjs`, `paso1-alta.mjs`, `restaurar.mjs` | host (vía `_entorno`) + `current_database() = 'railway'` | sí | **sí, pero DESPUÉS de conectar** (la consulta de la base es una lectura previa a escribir) → arreglado | lectura + ejecutado |
| `tests/banco-scrum911/paso2-ciclo.mjs`, `paso6-iva-929.mjs` | host + `current_database() = 'railway'` | `paso6` sí; `paso2` por servicio | sí, después de conectar → arreglado | lectura + ejecutado |
| `tests/banco-scrum911/paso3-botones.mjs`, `paso4-api-y-ficha.mjs` | **solo host** | **sí** (`.create`/`.update`/`.updateMany` + servicios) | **NO** → arreglado | ejecutado, abajo |
| `tests/banco-scrum911/estado.mjs` | host (vía `_entorno`) | no | no — solo lee → arreglado con `_entorno` | ejecutado |

**Corrección a c.20369:** `limpiar.mjs` sí separaba staging de dev antes de su `deleteMany`: comprueba
`base !== 'railway'` con lo que contesta el servidor (`select current_database()`). Lo que no hacía es
comprobarlo ANTES de abrir la conexión. Los dos que escribían sin separar eran `paso3` y `paso4`.

### Lo que cambia (punto 2)

`tests/banco-scrum911/_entorno.mjs` exporta `exigirStaging(url)`: llama a `exigirDestinoCorrecto('DATABASE_URL_STAGING', url, WT)`
de `scripts/_clave-vs-destino.mjs` (host Y base `railway`, por el mapa de la casa) y devuelve la MISMA url.
`prismaStaging` la llama antes de construir el cliente; `paso2`, `paso3`, `paso4` y `paso6` la llaman en lugar
de su `host !== STAGING_HOST`, antes de importar `dist/`. Las comprobaciones de `current_database()` se quedan.

Ejecutado, los 8 recorridos que abren, con `YAQU_ENV_FILE` fabricado (el fichero real no se lee):

| `DATABASE_URL_STAGING` fabricada | antes (main) | ahora |
|---|---|---|
| `127.0.0.1:1/railway` | `NO ES STAGING` (los 3 probados) | los 8: `LA CLAVE NO APUNTA A DONDE DICE SU NOMBRE` |
| **rojo sembrado:** host de staging + base `yaqu_dev_x` | **pasa** y cae al importar el cliente (`limpiar`, `paso3`, `paso4` probados) | los 8: `LA CLAVE NO APUNTA…`, `Apunta a: acela…/yaqu_dev_x` |
| positivo: host de staging + `railway` | pasa | pasa el guard y cae al importar `node_modules/@prisma/client` o `dist/` (no hay en este árbol): no llega a conectar |

### Lo que cambia (punto 3): el censo ve la escritura a través de un servicio de `dist/modules/`

Una llamada a algo importado de `dist/modules/` cuenta como «puede escribir» cuando (a) la fuente del módulo en
`src/` nombra el cliente de la base (`core/db/prisma` o `PrismaClient`) y (b) el fichero ya conecta o nombra
una clave de base. Si es lo único que conecta, la conexión es esa llamada. Tercera siembra (`SIEMBRA_SERVICIO`):
si no la ve, el CLI dice CIEGO. La salida declara la población: «servicios de dist/modules leídos en src/: 44
hablan con la base · 109 no · 12 sin fuente (cuentan como sí)».

**Sobre el árbol real**, contra el censo de 1575c: 145 filas (eran 144). Cambian de clase 10: los 9 del banco
911 (`guard_propio` → `protegido`, por el arreglo) y `scrum692-guardado-parcial-en-base` (no salía → `protegido`,
vía `_staging-db`). 44 filas más ganan escrituras por servicio sin cambiar de clase, `cambiar-flag-fiscal.mjs`
entre ellas. **`sin_guard_escribe` sigue en 0.** Una primera versión sin la condición (a) subía
`puerta-cliente-real.mjs` a `sin_guard_escribe`: llama a `evaluarPuerta`/`textoDelAviso`, que son puros
(`src/modules/system/domain/puertaClienteReal.ts`: 0 apariciones de `prisma`). Era ruido del instrumento, no un hallazgo.

**No arreglado, a propósito (punto 3 del encargo):** `cambiar-flag-fiscal.mjs` escribe por su servicio y solo
compara el host. No se le puede poner `exigirDestinoCorrecto`: su `DATABASE_URL` puede ser la de producción,
fuera de un árbol, a mano del fundador. Separar dev de staging ahí cambia su interfaz (`FLAG_CONFIRM` tendría
que nombrar host/base), y además es el interruptor fiscal: es decisión de un jefe, no un arreglo trivial.

### Rojo, verde y mutaciones (local; ningún caso conecta con nada)

- `tests/scrum1575d-staging-por-destino.test.mjs`: 5 pass + 0 fail. Con 1575c, 1575b y 1575: 23 pass + 0 fail = 23.
- Contra el `_entorno.mjs` de main: el fichero cae al importar (`exigirStaging` no existe): rojo débil.
- Seis mutaciones, una por pieza, cada una restaurada desde `HEAD` y con `git status` limpio al final:

| mutación | resultado |
|---|---|
| A · `exigirStaging` compara solo el host | 3 pass + 2 fail |
| B · `paso3` vuelve a `host !== STAGING_HOST` | 4 pass + 1 fail |
| C · `prismaStaging` construye el cliente antes de comprobar | 4 pass + 1 fail |
| D · el censo no mira servicios | 3 pass + 2 fail |
| E · el censo no lee la fuente del servicio | 4 pass + 1 fail |
| F · sin exigir que el fichero hable con una base | 4 pass + 1 fail |

### Lo que NO se ha medido

- El censo es por FICHERO: `estado.mjs` sale protegido «vía `sesionQA`», que no es un guard; y un `paso3` que
  volviera al host a mano seguiría saliendo protegido (por importar `cargarSecretos` de `_entorno`). Eso lo
  caza el test, no el censo.
- Un servicio que llama a OTRO módulo que escribe, o uno llamado como `S.metodo(…)`, no se ve. La fuente se lee
  como texto: un comentario que nombre `PrismaClient` cuenta como «habla con la base».
- Los que comparan solo la base (`yaqu_dev_javier`) no miran el host: separan staging de dev, pero un loopback
  con ese nombre pasaría. No es lo que pedía este tramo.
- Los recorridos del banco 911 no se han corrido contra staging (encargo: nada contra bases reales). Visto en
  yaqu.app: NO HECHO, no hay pantalla (son tests de desarrollo; además, producción no despliega desde el 20-oct).

### Errores propios

- La comprobación de orden de mi test buscaba la primera `exigirStaging(` del fichero, y en `_entorno.mjs` es la
  DECLARACIÓN: la mutación C salía MUDA. Y la primera mutación C movía el `import` del cliente, no el `new`: no
  cambiaba cuándo se conecta, así que tampoco podía caer. Arreglados los dos antes del commit.
- La primera versión del criterio de servicios contaba cualquier módulo de `dist/modules/` y fabricó un
  `sin_guard_escribe` que no existía (`puerta-cliente-real.mjs`). Lo vi al comparar el censo entero fila a fila.

## SCRUM-1575e · El interruptor fiscal comprueba el DESTINO —host y base— antes de conectar

**Medido contra:** `origin/main` = `3f889f9e7d9c39c3d7875c7ab297549a076f4a3c` · 2026-10-23T09:48:15Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575e-interruptor-fiscal-por-destino.test.mjs`

23-oct-2026 · **J5** (sesión `jv-j5x`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-62`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1575 entero, descripción y c.20277, c.20297,
c.20331, c.20369, c.20383 y c.20436.] Autoriza: el fundador, «Ok encárgaselo», transcrito por el orquestador
en c.20436, con este alcance: comprobar el DESTINO antes de conectar, sin cambiar qué hace el interruptor ni su
valor y sin ejecutarlo contra ninguna base. Carril a mano: el hook dijo «SIN IDENTIDAD» (SCRUM-1498).
`scripts/cambiar-flag-fiscal.mjs` sale SIN CERRADURA (`dos-equipos.md:172`) y el test nuevo, «sin fila en §3»,
según `node scripts/carriles.mjs de`. PASO 0: nada de `1575e` en `origin/main` ni rama en el remoto.
No toca `src/` ni el camino de emisión: el script llama al servicio de `dist/` igual que antes.

### El hueco (c.20383, jv-j5w)

`FLAG_CONFIRM` tenía que ser igual al HOSTNAME de `DATABASE_URL`. Staging (`acela/railway`) y desarrollo
(`acela/yaqu_dev_javier`) comparten host, así que con `FLAG_CONFIRM=acela.proxy.rlwy.net` pasaban las dos.

### Lo que cambia — y la INTERFAZ cambia

`FLAG_CONFIRM` ya no nombra el host: nombra la CLAVE que promete el destino, una de las de `DESTINOS_ESPERADOS`.
`exigirDestinoCorrecto(clave, DATABASE_URL, raíz)` compara host y base sobre la MISMA URL que usa el cliente,
antes de importar nada de `dist/`. Un valor que no es una clave declarada (el hostname de antes, por ejemplo)
se niega con la lista de los que valen.

| | antes | ahora |
|---|---|---|
| staging | `FLAG_CONFIRM=acela.proxy.rlwy.net` | `FLAG_CONFIRM=DATABASE_URL_STAGING` |
| desarrollo | `FLAG_CONFIRM=acela.proxy.rlwy.net` (el mismo) | `FLAG_CONFIRM=DATABASE_URL_DEV` |
| base del carril | — | `FLAG_CONFIRM=DATABASE_URL_TESTS` (la base la decide el worktree) |
| producción | `FLAG_CONFIRM=<host de producción>` | `FLAG_CONFIRM=DATABASE_URL` |

La URL sigue llegando por `DATABASE_URL`, y `--merchant`, `--flag`, `--valor` y `--email` no cambian.
**Producción sigue siendo un destino válido si se nombra**: el script es la llave del override por merchant
(máster, línea 504), y cerrarla cambiaría lo que hace el interruptor, que el encargo excluye. Para
producción el mapa sólo declara el host (`base: null`), así que ahí la comprobación es la de antes.
`docs/RUNBOOKS.md` no documenta el script (`git grep` de `FLAG_CONFIRM` y `cambiar-flag-fiscal`: sólo el
propio script, el máster en la línea 504, que no da la invocación, y dos comentarios). No hay runbook que
actualizar.

El censo (`scripts/_censo-conexiones-a-base.mjs`, 1.983 ficheros, 1.953 por AST, 145 conectan) lo pasa de
`guard_propio` a `protegido`: 15 → 14 y 90 → 91. `sin_guard_escribe` sigue en 0.

### Rojo, verde y mutaciones (local; ningún caso conecta con nada)

`tests/scrum1575e-interruptor-fiscal-por-destino.test.mjs`, 6 casos, con el script como proceso hijo y URLs
inventadas al puerto 1. Los que pasan el guard van sin argumentos y paran en «Falta --merchant», antes de
importar `dist/`. El único con los argumentos completos va a `127.0.0.1:1`, y se niega en el guard.

- Verde: 6 pass + 0 fail = 6.
- Con el script de `main` (`git show origin/main:`): 0 pass + 6 fail. El que mide el defecto es el caso 2
  («el hostname sigue valiendo como confirmación»: la URL de dev con `FLAG_CONFIRM=<host>` llegaba a los
  argumentos). Los otros cinco caen por la interfaz nueva, no por el defecto (rojo débil).
- Mutación A, quitar la llamada a `exigirDestinoCorrecto`: 1 pass + 5 fail.
- Mutación B, quitar la comprobación de que `FLAG_CONFIRM` es una clave declarada: 5 pass + 1 fail. Sin
  ella el guard se sigue negando (`clave_desconocida`), pero sin decir qué valores valen: cae el caso 2.

### Lo que NO se ha medido

- El interruptor no se ha ejecutado contra ninguna base (encargo). Que con un destino que cuadra y los
  argumentos completos siga cambiando el flag como antes está leído en el código, no corrido.
- `DATABASE_URL_TESTS` desde un worktree de `.claude/worktrees/` sale `worktree_no_declarado` (el mapa sólo
  conoce cuatro árboles): leído en `_clave-vs-destino.mjs`, no probado aquí.
- Visto en yaqu.app: NO HECHO, no hay pantalla (es un script de operador).

### Errores propios

- Mi primera medición de contexto leyó el jsonl de OTRA sesión (`jv-j4n`): cogí el más reciente de todas las
  carpetas de proyectos. La cifra que di fue la del contador («15M − restantes»), no esa.
- Escribí el test sin correr antes `scrum237`: dos negaciones del caso 3 iban sobre `r.todo` con el positivo
  sobre `r.err`, y salieron NINGUNO (con ellas caía también `scrum976`). Lo cazó el guard en la pasada de
  vecinos, antes del commit; añadí el positivo sobre el mismo sujeto.

Vecinos y guards de registro (1575, 1575b, 1575c, 1575d, 1575e, 1294, 237, 267, 273, 812, 921, 921c, 976, 1284
y 850): 117 pass + 2 fail = 119 en la primera pasada (los dos, el tropiezo de arriba); tras arreglarlo, 237,
1575e y 976 otra vez: 25 pass + 0 fail = 25.
