# SCRUM-1389 · `node --test` cuenta un proceso que no arranca como un test que falla — MEDIDO, sin construir

**Medido contra:** `origin/main` = `965e3d053f1f7d9ba24830f17abc7a54254c83f9` · 2026-10-07T16:57:53Z

A9: aviso → cicatriz J4 «un banco que le da al instrumento una entrada que la casa nunca le da lo deja mudo, y ese silencio se lee como que no dice nada: pasé rutas absolutas al lector de huellas, que compara nombres como los da npm test, relativos, y salió callado en nueve casos de nueve» — no se pudo comprobar: el banco es de un solo ticket y nada obliga al siguiente a pasarle a la puerta las rutas como se las pasa `npm test`; lo que lo cazó fue que un cero en los nueve casos, incluidos los que la casa ya sabía leer, no podía ser verdad

Sesión J4g (`jv-j4`), por encargo del orquestador del equipo de Javier (`cobroflash-backend-90`).
**Este PR no toca ningún script, ningún test, ningún guard, ninguna lista ni ningún workflow.** Lleva
este registro, un banco, dos guiones de sólo lectura sobre los logs del CI, sus salidas y una línea en
las cicatrices de J4.

## Por qué no se construye

Dos motivos independientes, y cualquiera basta:

1. **Carril.** El ticket (1-oct) dice «tocas `scripts/` → decláralo en el PR, es de S0». Desde
   SCRUM-1480 (6-oct) `scripts/tanda-con-veredicto.mjs` y `scripts/_huella-de-la-caida.mjs` tienen fila
   propia en `docs/equipo/dos-equipos.md` §3 y son de **S5**. Son los dos sitios donde cabe el arreglo
   sin escribir una tercera forma de decidir un veredicto.
2. **Decisión.** El punto ① del ticket («que no se cuente como un caso que falla») cambia lo que
   denuncia el check obligatorio, que corre para los dos equipos.

Confirmado por el orquestador por el canal el 7-oct. Lo que sigue es lo medido y las salidas, sin elegir.

## ① El rojo y su control: en el RECUENTO son idénticos

Banco: `docs/master/evidencias/scrum1389/banco.mjs` (parte del de J1h,
`docs/master/evidencias/scrum1343/banco-otras-puertas.mjs`, y le añade los casos intermedios, los
eventos y el TAP). Salida: `docs/master/evidencias/scrum1389/salida-sobre-965e3d05.txt`.
Población: 9 casos, node v24.18.0, win32, cada uno corrido cuatro veces (`spec`, eventos, `tap` y la
puerta de la casa). Testigo del caso 9: binario renombrado en 4 de 4 pasadas.

| caso | qué se fabrica | recuento de `spec` | EXIT |
|---|---|---|---|
| 1 | control: dos limpios | tests 2 · pass 2 · fail 0 | 0 |
| 2 | control: un assert que cae dentro de un test | tests 2 · pass 1 · fail 1 | 1 |
| 3 | el proceso se crea y muere: import que no resuelve | tests 2 · pass 1 · fail 1 | 1 |
| 4 | se crea y muere: error de sintaxis | tests 2 · pass 1 · fail 1 | 1 |
| 5 | se crea y muere: `throw` en la primera línea | tests 2 · pass 1 · fail 1 | 1 |
| 6 | se crea y muere: `process.exit(1)` sin una letra | tests 2 · pass 1 · fail 1 | 1 |
| 7 | se crea y sale con 3221225794 sin una letra (IMITACIÓN del código nativo) | tests 2 · pass 1 · fail 1 | 1 |
| 8 | se crea, pasa un caso y muere a medias con 3221225794 (IMITACIÓN) | tests 2 · pass 1 · fail 1 | 1 |
| 9 | el proceso NO se crea (ENOENT, dos ficheros) | tests 3 · pass 1 · fail 2 | 1 |

Los casos 2 a 8 dan la misma línea y el mismo código. **El defecto del ticket existe hoy.**

## ② Lo nuevo: en los EVENTOS y en el TAP sí se separan, en tres clases

| clase | nombre del caído | `exitCode` | causa |
|---|---|---|---|
| rojo de caso (caso 2) | el nombre del test | no hay | `ERR_ASSERTION` |
| el proceso se creó y murió (casos 3 a 8) | la ruta del fichero, en `:1:1` | **sí**: 1, o 3221225794 | `'test failed'` |
| el proceso no se creó (caso 9) | la ruta del fichero, en `:1:1` | **no hay** | `spawn … ENOENT`, `code: 'ENOENT'` |

Lo mismo se lee en el TAP que el CI ya guarda (`tanda.tap`): el bloque del fichero lleva `exitCode:` y
`signal:` cuando el proceso existió, y `error: 'spawn …'` con `code: 'ENOENT'` cuando no. El criterio
que el ticket pedía («el proceso no se creó» frente a «murió al empezar») es alcanzable sin adivinar.
Y el suelo de SCRUM-1343 (`0xC0000000`) se puede aplicar a ese `exitCode`.

Lo que **no** se separa por ningún camino: dentro de «se creó y murió», un import roto, un `throw` y un
`process.exit(1)` mudo dan los tres `exitCode: 1`. Ahí el lado seguro sigue siendo no afirmar.

## ③ Lo que la casa dice HOY de esos rojos, y dónde afirma algo falso

`scripts/_huella-de-la-caida.mjs` (SCRUM-1331 / SCRUM-1332), sin tocar, corrido por
`tanda-con-veredicto.mjs`: no dice nada en los casos 1 y 2 (correcto) y dice **la misma frase** en los
siete ficheros caídos de los casos 3 a 9:

> FICHERO CAÍDO SIN CASO CAÍDO · … 0 casos caídos dentro, y sin huella reconocida de red ni nativa.
> Puede ser un error AL CARGAR el fichero, también del cambio que se prueba: su salida está justo
> encima de su ✖.

- En el caso 9 esa frase es **falsa**: el proceso no existió, no cargó nada y no tiene salida encima
  de su `✖`. La línea `Error: spawn … ENOENT` está en la sección «failing tests» que el lector ya
  recorre (guarda las tres primeras líneas del error de cada entrada) y no la usa.
- En los casos 7 y 8 dice «sin huella nativa» de un proceso que salió con un código ≥ `0xC0000000`. Es
  su límite declarado (`spec` no trae el código de salida), no un descuido.
- No cambia el código de salida, y lo dice en su cabecera.

## ④ Segundo hallazgo, aparte: un fichero que muere a medias se lleva los casos que SÍ pasaron

Caso 8: el fichero declara tres casos; el primero pasa, el segundo mata el proceso, el tercero no
corre. El recuento dice `tests 2 · pass 1 · fail 1`: el `pass 1` es del otro fichero. El caso que pasó
no está ni en el recuento, ni en los eventos, ni en el TAP; el fichero entero queda como UNA entrada
caída. O sea: el recuento no sólo confunde dos cosas, además pierde casos que se ejecutaron y
pasaron. No se ha medido cuántas veces ocurre en el CI (ver ⑥: 0 ficheros caídos en la ventana).

## ⑤ Quién lee ese recuento

**Los que leen el TAP o la salida de la tanda del obligatorio** (leídos por mí en `965e3d05`):

| quién | carril | qué hace con un fichero que no arrancó |
|---|---|---|
| `scripts/tanda-con-veredicto.mjs` | S5 | pasa el código 1 tal cual; sus cuatro guardas (2, 3, 4, señal) son del runner, no del fichero |
| `scripts/_huella-de-la-caida.mjs` | S5 | la frase de ③ |
| `scripts/equipo/por-que-cayo.mjs` | S5 | imprime el bloque del TAP entero, con su `exitCode` o su `spawn`: está a la vista, nadie lo clasifica |
| `scripts/_senal-de-nombres.mjs` | equipo de Javier (SCRUM-1339) | cuenta los casos del fichero como **ausentes** y marca el bloque con `conEntradaDeFichero`; no mira si la entrada cayó, ni su `exitCode`, ni el `spawn`. Un fichero no arrancado sube la tasa de «pierde nombres» |
| `scripts/_suelo-de-la-tanda.mjs` | S3 | lee `# tests N`: un fichero de n casos que no arranca resta n−1. No medido si eso cruza su holgura |

**Los que lanzan `node --test` y deciden con su resultado.** Censo hecho por un subagente de esta
sesión, sólo leyendo `scripts/`; **no lo he verificado fila a fila**, va como lo entregó:

| lanzador | ¿separa «no arrancó o murió» de «un test falló»? |
|---|---|
| `tanda-con-veredicto.mjs` | no para un fichero (sí para el runner entero) |
| `guards-entrada.mjs` | sí: `r.error`, falta de resumen, y `✖` cuyo nombre es una ruta → ciego |
| `staging-gated.mjs` | parcial: «NO EJECUTÓ» sólo si `tests === 0`; un fichero muerto entre varios, no |
| `censo-mudez.mjs` | no: en la pasada mutada un hijo muerto cuenta como VIVO |
| `censo-lista-como-fixture.mjs` | no: una copia que muere al cargar sale «cae» confirmado |
| `tests-que-cubren.mjs` | no por fichero; sí por lote |
| `puerta-claude-empuje.mjs` | parcial: fichero muerto con `fail > 0` → ROJO |
| `verificacion-s5/romper-los-quince.mjs` | no: CAE = `status ≠ 0 && fail > 0`, y un fichero muerto lo cumple |

Más tres que usan `run()` de `node:test` y leen eventos: `_trinquete-de-zona-hijo.mjs`,
`meta-guard-mutaciones.mjs` y `censo-guards-gateados.mjs`. **Lanzan y deciden: 8, más 3 por `run()`.**
El ticket preguntaba si esto es «un arreglo o cinco»: por este censo, los lanzadores que no separan son
más de uno y están en carriles distintos (S5, S3, S0 y el equipo de Javier).

## ⑥ Cuántas veces ha pasado en el obligatorio

Guiones: `docs/master/evidencias/scrum1389/cuantas-veces.mjs` y `resumir-veces.mjs`. Leen
`gh run view <id> --log-failed`. Salida: `docs/master/evidencias/scrum1389/veces-corridas-failure.txt`.

- **Población:** las 300 corridas de `ci.yml` con conclusión `failure` más recientes (tope de la
  lista), del 29-sep 16:40Z al 7-oct 16:48Z. 299 con log, 1 sin él.
- 83 tienen algún paso rojo del job obligatorio; en 79 se ve la sección «failing tests».
- **Sobre esas 79: 0 con un fichero caído a nivel de proceso. 0 `spawn … E…`. 0 señales.**
- Control del instrumento: a mitad de la lectura veía rojos de caso en 57 de las 60 corridas con
  obligatorio leídas hasta entonces; y pasado por la corrida `36806690822` (el fichero caído de SCRUM-1331) da 1 de 1.

Lo que esa cifra **no** dice:

- **Esa misma corrida de control NO estaba en la población:** su conclusión es `cancelled`, no
  `failure`. Una corrida con el obligatorio en rojo y otro job cancelado por un push posterior queda
  fuera de la lista. Por eso se leyeron también las canceladas:
  `docs/master/evidencias/scrum1389/veces-corridas-cancelled.txt` (su cabecera dice «rojas» porque
  el guion es el mismo; son las 300 `cancelled` más recientes, del 29-sep 16:53Z al 7-oct 17:05Z).
  252 no dan log de pasos rojos (no tenían ninguno), 48 sí; 45 con el obligatorio en rojo y su
  sección a la vista. **1 de 45 con un fichero caído: `tests/scrum804b-el-barrido-de-la-42.test.mjs`,
  el de SCRUM-1331** — un proceso que se creó y murió por falta de red, no uno que no arrancó.
  0 `spawn … E…`, 0 señales.
- **Las dos listas juntas: 124 corridas con el rojo del obligatorio legible · 1 fichero caído a nivel
  de proceso · 0 procesos no creados.** La caída de `scrum1216b` (SCRUM-1332) no aparece en ninguna
  de las dos: no sé en qué corrida fue ni con qué conclusión acabó.
- Las dos listas empiezan el 29-sep y no traen nada del 3 al 5 de octubre. No he comprobado si es
  que no hubo corridas esos días o si la lista las pierde.
- `--log-failed` sólo trae pasos en rojo, y «Por qué cayó» sale siempre 0: el `exitCode` del TAP no
  está en lo leído. El recuento de `exitCode` (0) es ciego, no un cero.
- Los runners del CI son Linux. Todo el banco es Windows. Qué deja allí un proceso matado por falta de
  memoria (lo esperable es `signal: SIGKILL`, sin `exitCode`) **no está medido**.
- Las máquinas de trabajo, donde el ticket sitúa el caso de hoy, no dejan log: **no se puede saber**.

## Las salidas, con su coste — no se elige aquí

| salida | qué arregla | qué no | qué toca |
|---|---|---|---|
| **A · sólo la frase falsa** — una clase más en el lector de huellas («el proceso no se creó»), leída de la línea `spawn` que ya recorre | la afirmación falsa de ③ | el recuento; el nativo mudo (desde `spec` no hay `exitCode`); la línea que sale siempre | `_huella-de-la-caida.mjs` (S5) y sus dos tests. No cambia el código de salida |
| **B · las tres clases desde el TAP, en la señal de nombres** — que diga cuántas entradas de fichero hay, cuántas no se crearon y cuántas murieron (y con qué código), siempre, también con cero | separa el fichero no arrancado de los «nombres perdidos»; da la línea del punto ⑥ del ticket | el recuento; no corre en `npm test` local (lee `tanda.tap`); «N ficheros midieron» no sale del TAP (un fichero que pasa no deja entrada) y habría que derivarlo del árbol | `_senal-de-nombres.mjs` (equipo de Javier, ticket vivo de J6). Avisa, no bloquea |
| **C · cambiar el veredicto** — que una tanda cuyo único rojo son procesos no creados salga como CIEGO (`veredictoDe`) y no como hallazgo | el punto ① del ticket | «se creó y murió» tiene que seguir rojo (punto ⑤ del ticket: un import roto es un fallo legítimo) | `tanda-con-veredicto.mjs` (S5), el obligatorio de los dos equipos, y necesita leer eventos o TAP donde hoy sólo lee `spec`. Sigue saliendo ≠ 0: cambia lo que dice, no si bloquea |
| **D · dejarlo medido** | nada | todo | nada. 0 de 79 en la ventana leída |

A y B no se excluyen. C es la única que cumple el ticket como está escrito.

## Lo que NO se ha hecho y lo que NO se ha medido

- No se ha construido nada de lo que pide el ticket (①, ②, ⑤, ⑥ de «Lo que pide»).
- El código nativo es una IMITACIÓN (`process.exit(3221225794)`): el proceso arranca y sale con ese
  número. Un `0xC0000142` de verdad no se ha fabricado.
- No se ha corrido la tanda completa, ni `guards:entrada`, ni nada contra ninguna base.
- No se ha leído el obligatorio de este PR al escribir esto.
- El censo de lanzadores de ⑤ es de un subagente y no está verificado por mí.

## Mis errores

- Un recuento de lectores con un glob mal formado dio 0; lo delató que el control (un fichero que se
  sabe que casa) también diera 0.
- La primera versión del banco pasaba rutas absolutas y el lector de huellas salía mudo en los nueve
  casos: compara el nombre del `✖` con el del `test at`, y `npm test` se las da relativas. Leído tal
  cual habría sido «la casa no dice nada de ningún fichero caído», que es falso. Está escrito en el
  banco y en las cicatrices de J4.
- Una pasada del caso 9 falló por `EBUSY` al renombrar el binario recién copiado y el testigo, que
  miraba sólo la última copia, dijo «sí». Ahora hay reintento y un testigo por pasada.
- Di por población «las corridas rojas» y la corrida de control conocida era `cancelled`.

## SCRUM-1389b · sigue vivo hoy, y sigue sin decisión — no se construye

**Medido contra:** `origin/main` = `25ad5d43b6a8ed41fdcb90c5fdbc0e2e388ec1be` · 2026-10-24T10:03:43Z

A9: sin fallo que generalice — los dos tropiezos de esta pasada (abajo) los cazó la herramienta en el acto y no dejaron ninguna medición mala detrás

Sesión `jv-j6bj` (puesto J6), por encargo del orquestador del equipo de Javier (`cobroflash-backend-95`).
**Sólo docs:** este tramo. Ningún script, test, guard, lista ni workflow.

**El defecto existe hoy (A2).** El banco de este registro (`docs/master/evidencias/scrum1389/banco.mjs`),
corrido sin cambios sobre `25ad5d43`, node v24.18.0, Windows, 11 s, temporales en `os.tmpdir()`: los
nueve casos dan lo mismo que el 7-oct. Control verde (caso 1): `tests 2 · pass 2 · fail 0 · EXIT=0`.
Control rojo (caso 2): `tests 2 · pass 1 · fail 1 · EXIT=1`. Los dos nietos que no se crean (caso 9):
`tests 3 · pass 1 · fail 2 · EXIT=1`, y la puerta los sigue llamando «FICHERO CAÍDO SIN CASO CAÍDO …
su salida está justo encima de su ✖», que para un proceso que no existió es falso. Testigo: binario
renombrado en 4 de 4 pasadas. En los eventos y en el TAP la separación sigue ahí (`exitCode` presente
en 3–8; ausente y `causaCode: ENOENT`, `causaSyscall: spawn` en 9).

**Qué cambió desde el 7-oct en los tres sitios del arreglo:** `scripts/tanda-con-veredicto.mjs` y
`scripts/_senal-de-nombres.mjs`, nada; `scripts/_huella-de-la-caida.mjs`, 6 líneas añadidas
(`git diff --stat 7f3bfbde3 origin/main`), y la frase falsa del caso 9 sigue saliendo.

**Por qué no se construye.** El ticket pide ①–⑥ pero no fija el arreglo, y este registro dejó cuatro
salidas «no se elige aquí»; en Jira (descripción y los 2 comentarios, c.18776 y c.18782) no hay
decisión posterior. Carriles medidos con `node scripts/carriles.mjs de <ruta>` el 24-oct:
`tanda-con-veredicto.mjs` y `_huella-de-la-caida.mjs` → **S5**; `_senal-de-nombres.mjs` y
`_hallazgos-y-ciegos.mjs` → sin cerradura (fila general de `scripts/`, «S0, sólo verificación o censo
de consulta»). La salida C, la única que cumple ① tal como está escrito, es de S5 y cambia lo que dice
el obligatorio de los dos equipos. La B cae en un fichero sin dueño decidido.

**Lo que hace falta para seguir, como preguntas ✅/❌** (para el orquestador y, si cruza de equipo, para
los dos jefes):

1. ¿Se elige la salida **C** (tanda que sólo tiene procesos no creados → CIEGO por `veredictoDe`, «se creó
   y murió» sigue rojo)? ✅ → es trabajo de S5, se le pasa por Jira. ❌ → se queda ①.
2. ¿Se construye la **B** (la señal de nombres cuenta siempre, también con cero, entradas de fichero ·
   no creadas · muertas con su código) en `_senal-de-nombres.mjs`, y ese fichero pasa a ser de J6 con
   fila propia en `dos-equipos.md` §3? ✅ → la construye J6 con rojo primero, positivo sembrado y mutación.
3. ¿La **A** (una clase más en el lector de huellas para el proceso que no se creó)? ✅ → S5.
4. ¿O **D**, dejarlo medido? (0 procesos no creados en las 124 corridas legibles del 7-oct.)

**No hecho / no medido:** no se ha corrido la tanda, ni `guards:entrada`, ni los guards de suite (no se
ha tocado ni código ni tests); el obligatorio de este PR, el que diga la entrega.

**Mis errores:** probé el `cloudId` de Jira con el host del dueño del repo de GitHub, y era otro; lo dijo
la herramienta al primer intento. Y el primer comando del arranque encadenaba con `&&` un
`git rev-parse --short` con dos refs, que sólo admite una: falló y se llevó por delante la lectura de
la norma, que repetí en un comando aparte.

## SCRUM-1389c · salida B construida: la señal de nombres cuenta SIEMPRE las entradas de fichero del TAP

**Medido contra:** `origin/main` = `0e86dada4887f1ac54ce0ed5cad3c53c99c72c1c` · 2026-10-24T10:18:19Z

A9: aviso → cicatriz J6 «Escribí las regex de un test sobre fixtures de texto con `$` y `\n` a pelo, y en un checkout de Windows esos ficheros salen con CRLF» — no se pudo comprobar: ningún guard corre un test nuevo con sus fixtures en los dos finales de línea; lo cazó el aviso de git al commitear

Sesión `jv-j6bm` (puesto J6), por encargo del orquestador del equipo de Javier (`cobroflash-backend-95`).
Decisión del fundador en Jira, SCRUM-1389 c.20720 (24-oct-2026): **B sí, la construye J6**; C y A no;
D queda medido como está.

**Lo construido.** `scripts/_senal-de-nombres.mjs` (`procesosDelTap`, `lineaDeProcesos`; `leerTap` lee
el bloque YAML de primer nivel de cada entrada de fichero). El informe lleva, como SEGUNDA línea y
siempre —también con cero y también cuando los nombres no se pueden medir—:

    [señal de nombres · procesos v1] medible=si entradas_de_fichero=N no_creadas=K murieron=M codigos=<código>:<veces>,… otras=J

- **murieron**: el bloque lleva `exitCode:` (el proceso se creó y salió); con el código y cuántas veces.
- **no creadas**: sin `exitCode:` y con `error: 'spawn …'` (el proceso no existió).
- **otras**: cualquier otra entrada de fichero; se cuenta y no se clasifica. Las tres suman el total.
- Si el TAP no está entero, todas las cifras salen `?` y `medible=no`: no se cuentan como cero.
- Con `no_creadas > 0` sale además una línea que lo dice en prosa.

**Avisa, no bloquea.** No entra en `ausentes`, ni en la línea de registro (la que lee el vigía), ni en
las anotaciones `::notice`/`::warning` (`scrum1339d` exige UNA `::notice`), ni en el código de salida
del guion. Lo comprueba el caso ⑤ del test: con un proceso muerto, o dos no creados, y ningún nombre
ausente, el guion sale 0 y escribe la línea.

**El positivo, sembrado.** `docs/master/evidencias/scrum1389/capturar-tap.mjs` corre los nueve casos de
`banco.mjs` (los mismos ficheros) con el reporter TAP y deja los nueve TAP en
`tests/fixtures/scrum1389c/`, con las rutas de la máquina cambiadas por `<banco>`. Node v24.18.0,
win32, 8 s; testigo del caso 9: binario renombrado. El test, `tests/scrum1389c-senal-tres-clases.test.mjs`:

| caso | entradas | no creadas | murieron (códigos) |
|---|---|---|---|
| 1 control verde · 2 control rojo de caso | 0 | 0 | 0 |
| 3–6 se crea y muere (import, sintaxis, throw, exit mudo) | 1 | 0 | 1 (`1:1`) |
| 7–8 se crea y sale con 3221225794 (imitación) | 1 | 0 | 1 (`3221225794:1`) |
| 9 no se crea (ENOENT, dos ficheros) | 2 | 2 | 0 |

Quitado el positivo (TAP vacío, o sin resumen), la línea sale `medible=no … ?`, no ceros (caso ③).

**Rojo primero:** el test, escrito antes que el código, cayó al importar (`does not provide an export named
'lineaDeProcesos'`). **Mutaciones declaradas** en el propio test (`MUTACIONES_QUE_ME_TUMBAN`), aplicadas una
a una con el árbol commiteado (`8921108d`), restauradas y comprobadas por contenido:
1. el no creado vuelve a contarse como muerto → caen ①, ④ y ⑤ (la declarada, ①, entre ellas);
2. la línea sólo sale cuando hay entradas → caen ② y ③ (la declarada, ②, entre ellas).
Sin mutar: 5 de 5. El meta-guard entero (`meta:mutaciones`) no se ha corrido.

**La fila de `dos-equipos.md` §3 queda PENDIENTE DE S0.** El encargo decía ponerla en este PR; el
orquestador lo corrigió a mitad (el fichero es de S0) y la pasa él a Luis/S0. Se escribió, se regeneró
`.claude/carriles.json` y se quitó antes de empujar: el PR no toca `docs/equipo/dos-equipos.md` ni
`.claude/`. Hoy `node scripts/carriles.mjs de scripts/_senal-de-nombres.mjs` sigue dando «SIN
CERRADURA» (fila general de `scripts/`). Medido de paso: con la fila puesta, `scrum1480f` exige bajar
`suelo.quedan` de 223 a 222 en `scripts/_sin-fila-declarados.json` (el fichero está en la foto del 9-oct,
línea 71): quien ponga la fila, que lo baje en el mismo PR.

**Corrido:** los guards de la señal (1339d, 1339u, 1415, 1389c), los de suite (237, 976, 824, 836, 419,
702, 700, 719), los de carriles (1295, 1480e, 1480f, 1408) y los de piezas sin consumir (1185, 411):
**200 pass · 0 fail · 0 skipped en 18 ficheros**, con `dist/` construido con `tsc --noCheck` (sin él,
`scrum836` cae por tres ficheros de `dist/` que no existen en este árbol). Los de registro (1294, 267,
273, 723, 921c): **45 pass · 0 fail en 5 ficheros**; positivo: `scrum1294` cayó antes en este mismo tramo
(línea A9) cuando la cita llevaba el `(SCRUM-1389c)` que el guard quita de la frase de la cicatriz.
**No corrido:** la tanda entera (hoy hay 10 sesiones a la vez), `guards:entrada`. **No medido:** el TAP
de un runner Linux con un nieto matado por memoria (si deja `exitCode: ~` con `signal:`, cae en
«murieron» con el nombre de la señal; no se ha visto nunca uno real). El obligatorio, en la entrega.

**Mis errores:** la primera captura dejó la ruta de la máquina en los TAP (node la escribe con el nombre
corto `JAVIER~1` y yo sustituía la larga); lo cazó un recuento de «Users» que daba 0 en la buena y 4 en
la mala. Las regex del test no admitían CRLF (la cicatriz de arriba). Un guion mío de mutación pasado por
heredoc perdió una barra y no compiló; lo reescribí con la herramienta de escritura.
