# SCRUM-1244 · El fichero más pesado de la tanda (`scrum1093h`, 1,19 GB) baja a 690 MB sin dejar de medir el árbol real — y la tanda entera cabe hoy, pero no se ha demostrado que sea por eso

**Medido contra:** `origin/main` = `8a27dd4a85b731faea7f4902295cbec1c64ef870` · 2026-09-28T20:54:47Z (rebasada después sobre `eb22747894488820a6f09ffb091e1340e6fea187`, 2026-09-28T21:14:40Z: entre los dos, ningún cambio en `src/` ni en el censo; el test se repitió tras el rebase: 16/16, 690,8 MB)

J6 (jv-j6). Windows 11 · Node `v24.18.0` · 12 núcleos (`node --test` corre 11 ficheros a la vez) ·
16 GB, de los que había entre 2,8 y 3,8 GB libres al empezar cada medición (hay otras seis sesiones vivas).

## ① De dónde sale la memoria DENTRO de `scrum1093h`

Sonda que repite los pasos del test en el mismo orden y anota `rss` y `resourceUsage().maxRSS` tras
cada uno (fuera del árbol, de un solo uso):

| paso | rss | pico |
| --- | --- | --- |
| importar el censo | 78 MB | 89 MB |
| `censar('.')`: el árbol REAL, 304 ficheros de `src/`, 58 filas | 649 MB | 649 MB |
| `git show` de los tres históricos (5.832 / 6.037 / 39.349 caracteres) | +0 MB | — |
| programa histórico `quoteNumber.service.ts` (678 `SourceFile`) | 835 MB | 835 MB |
| programa histórico `albaranNumber.service.ts` (678) | 1.015 MB | 1.015 MB |
| programa histórico `partes.routes.ts` (785) | 1.150 MB | 1.191 MB |
| cinco programas fabricados (667 cada uno, UNA raíz sin imports) | 1.182 MB | 1.191 MB |

⇒ **No son los `git show`** (cero) **ni el censo del árbol en sí** (650 MB, y ése es el suelo de medir
el árbol real con tipos). Son los **ocho programas de TypeScript siguientes**: cada `ts.createProgram`
con un host nuevo **vuelve a parsear ~670 ficheros** (la lib, `@types`, prisma) aunque sólo tenga una
raíz, y V8 no recoge los anteriores antes de crecer. Con `--expose-gc` y un `gc()` entre pasos, el pico
se queda en 654 MB: la memoria era basura acumulada, no datos vivos.

## ② El arreglo, sin cambiar lo que el test vigila

`scripts/_censo-fecha-sin-zona.mjs`: los `SourceFile` leídos de **disco** se guardan y se reutilizan
entre programas del mismo proceso (lo mismo que hace el servicio de lenguaje de TypeScript). Los
**overrides** —el código histórico de `git show` y los casos fabricados— se consultan **antes** que la
caché y no entran nunca en ella. Las opciones son siempre las de `tsconfig.json`.

- **No cambia la población**: sigue siendo el árbol real, 304 ficheros; no se ha tocado el test.
- **No cambia el resultado**: la salida completa de los nueve censos (árbol real + 3 históricos + 5
  fabricados), serializada, es **byte a byte idéntica** antes y después (sha256 `8542aa98…`, 12.717 bytes).

## ③ Por efecto

El fichero de test real, solo, con la sonda `maxRSS` por hijo:

| | veredicto | pico del proceso | tiempo |
| --- | --- | --- | --- |
| antes (script de `main`) | 16/16 | **1.190 MB** | 10,6 s |
| después | 16/16 | **690 MB** | 4,9 s |

**Control positivo: tres mutaciones, las tres caen** (el test entero, sin tocarlo):

| mutación | casos que caen |
| --- | --- |
| M1 · la familia deja de ver `getFullYear` | 5 (los tres históricos ③, el fabricado ⑤ y el de `USO` vivas) |
| M2 · `esTipoDate` → `true` (por nombre y no por tipo) | 3 (el ratchet y los dos negativos de `number`) |
| M3 · **la caché le gana al override** (el defecto que este arreglo podría meter) | 3 (los tres históricos ③: leerían el texto de hoy) |

Cada mutación con su `git diff --numstat` al lado (1/1, 1/1, 1/0) y el árbol restaurado con
`git restore --source=HEAD` después de cada una, comprobado con `git status --porcelain`.

## ④ ¿Basta? — la respuesta honesta: **la tanda cabe hoy, y NO puedo decir que sea gracias a esto**

Tres tandas enteras con la concurrencia de `npm test` (11), sonda por hijo y un corte propio a 700 MB
libres que no llegó a saltar en ninguna:

| tanda | censo | tests | pass | fail | min | pico suma `node.exe` | mínimo libre |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T11 · después, sesión activa | este | 8.925 | 8.789 | 2 | 4,1 | 3.650 MB | 1.487 MB |
| T11-antes · script de `main`, sesión activa | `main` | 8.924 | 8.789 | 1 | 4,2 | **4.352 MB** | **744 MB** |
| T11-inactiva · después, en segundo plano con la sesión quieta | este | 8.924 | 8.789 | 1 | 3,6 | 3.488 MB | 1.201 MB |

Y una cuarta, **T11-final**, sobre esta rama ya con este registro (`70f05bda`), en segundo plano con la
sesión quieta: **8.931 tests · 8.797 pass · 0 fail · 134 saltados** (los gateados por base), 1.072
ficheros, 3,8 min, pico de la suma 3.460 MB, mínimo libre 1.263 MB, `exit 0`.

Los fallos: `scrum854` en las tres (esta rama aún no traía su registro: es este fichero), y en T11 además
`scrum1216b` por el abort de libuv (abajo, «De paso»). Ninguna la paró nadie.

- **La tanda completa, entera, cabe hoy en esta máquina — tres de tres.** El veredicto es de
  `ℹ tests` con su recuento, no un «no murió».
- **Pero la tanda «antes» también cupo.** El arreglo le quita ~700 MB al pico de la suma y ~500 MB al
  fichero más pesado, y en estas pasadas **no** es lo que separa caber de no caber. Las tres muertes de
  la tarde (J1, J2 y J6) no se han podido reproducir: ni con el script viejo, ni en segundo plano con la
  sesión quieta, ni bajando a 744 MB libres, que es menos que los ~1,9 GB con los que saltó el reaper
  por la tarde. **El umbral del reaper no es sólo la memoria libre**, y no lo conocemos.
- **Lo que queda pesado** (pico por hijo, T11): `scrum775-suelo-que-no-dispara` **781 MB**, `scrum1093h`
  690, `scrum534b` 604, `scrum1185` 551, `scrum846c` 544, `scrum759` 472; nueve ficheros pasan de 350 MB.
  No se ha mirado de dónde les sale.

⇒ **Veredicto: «no demostrado que baste».** Hoy la tanda corre entera aquí; si vuelve a morir, este
arreglo no garantiza que no pase, y el siguiente candidato medido es `scrum775`.

## De paso: `scrum1216b` aborta con la firma de SCRUM-1204, y el censo de SCRUM-1218 no lo ve

En T11 salió `'test failed'` sin subtest caído, con
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`. Solo, 20 pasadas:
**2/20 con `--test-force-exit`**, **0/20 con `--no-wasm-dynamic-tiering`** (el mismo mecanismo), 0/20 sin
la bandera. No llama a `fetch` él mismo: lo hace `tests/_banco-camino-real.mjs` (`app.listen(0)` + `fetch`),
que importan 4 tests. El censo de SCRUM-1218 mira cada fichero por separado y no sigue los imports. Se
lleva al orquestador como hallazgo de SCRUM-1218; aquí no se ha tocado.

## Reproducir

    node --test tests/scrum1093h-censo-fecha-sin-zona.test.mjs     # 16/16

El pico se mide con una sonda `--import` que escribe `process.resourceUsage().maxRSS` al salir (sólo entra
en los hijos de `node --test`).

## ⑤ El reaper de Claude Code: qué mata, qué no, y la receta para correr la tanda aquí

**Medido contra:** `origin/main` = `3928cf10720e700b451e0f3eb893ab0743d764e0` · 2026-09-28T21:34:50Z

Esta sección es del equipo de Javier. La trampa se REPORTA a la S0 para su `trampas-del-entorno.md`,
que es suyo y que no se toca desde aquí.

### Las seis tandas enteras de esta noche, cada una en su condición real

Todas son la tanda completa (1.070-1.072 ficheros), medidas con `tanda-medida.mjs`: sonda por hijo, muestra
del sistema cada segundo y un corte propio a 700 MB libres que no saltó en ninguna.

| tanda | cómo se lanzó | sesión | conc. | resultado | mínimo libre |
| --- | --- | --- | --- | --- | --- |
| T11 | segundo plano | ACTIVA (trabajando) | 11 | terminó, 4,1 min | 1.487 MB |
| T11-antes | **primer plano** | activa | 11 | terminó, 4,2 min | **744 MB** |
| T11-inactiva | segundo plano | **QUIETA** | 11 | terminó, 3,6 min | 1.201 MB |
| T11-final | segundo plano | **QUIETA** | 11 | terminó, 3,8 min | 1.263 MB |
| T11-1218 | segundo plano | **QUIETA** | 11 | **MUERTA a los 35 s** (271/1.072), «stopped because the system is running low on memory» | 1.704 MB |
| T6-1218 | **primer plano** | activa | 6 | terminó, 4,3 min, verde | 1.991 MB |

### Lo que dice la medición, y ni una palabra más

- **Lo que mata el reaper son órdenes en SEGUNDO PLANO con la sesión QUIETA.** Es lo que dice su propio aviso
  («while the session was idle»), y la única muerte medida es de esa clase. Una tanda en segundo plano con la
  sesión trabajando (T11) no murió. Con n = 1, eso no demuestra que no pueda morir.
- **Su umbral NO es la memoria libre que mide `os.freemem()`.** Dentro de la misma condición (segundo plano
  y sesión quieta), la que murió no bajó de 1.704 MB libres y las dos que sobrevivieron bajaron a 1.201 y
  1.263. **Cuál es el umbral, no lo sé.** Solo sé que no es el que yo medía.
- **En primer plano, 2 de 2 terminaron**, una con la concurrencia de `npm test` (11) bajando a 744 MB libres.
  Con n = 2, más el texto del aviso, que sólo habla de segundo plano. No es una garantía.

### La receta, con su condición

La tanda entera **se puede correr en esta máquina en PRIMER PLANO**, con la herramienta Bash y **sin**
`run_in_background`, con el comando de `CLAUDE.md` (sección Comandos, patrón entre comillas simples).
Con concurrencia 6 y con la de por defecto (11) terminaron las dos.

⚠️ **Condición: sólo cuando NO haya otras sesiones trabajando.** DERIVADO del mecanismo, **NO medido**: una
tanda en primer plano que aprieta la memoria puede hacer que el reaper mate las órdenes en segundo plano de
OTRA sesión, que no se enteraría más que por el aviso. Con cinco sesiones vivas, una tanda puede tumbar a las
otras cuatro.

⚠️ **El límite de 10 minutos de la herramienta Bash** (su tope en primer plano): la tanda ha tardado entre 3,6 y
4,3 min, así que cabe, pero el margen se estrecha con la máquina cargada. Se le pasa el `timeout` máximo
(600.000 ms). Si lo agota, lo que hay es una tanda sin terminar, no un veredicto: sin la línea `ℹ tests N`
con su recuento, no hay tanda (A21).

⛔ **Esto NO sustituye al CI**, que sigue siendo el juez obligatorio. **Y no autoriza a tocar**
`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP`: es configuración de Javier, y desactivar una protección de
memoria no es arreglar el consumo.
