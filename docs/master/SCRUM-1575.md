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
