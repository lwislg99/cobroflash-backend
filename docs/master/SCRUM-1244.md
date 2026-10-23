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

## ⑥ 1-oct: la premisa del ticket, vuelta a comprobar — «ya no se puede correr» no se sostiene, y el número de HOY sigue sin medir

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T00:38:53Z

A9: aviso → A10 «Un laboratorio que le presta su entorno al sujeto mide la suma de los dos.» — no se pudo comprobar: el coste de la tanda lo di primero por la caída de la memoria libre, que también se mueve por lo que hacen las otras sesiones (hoy osciló 3 GB en diez minutos sin tanda ninguna); lo corrigió cruzarlo con un segundo instrumento, y no hay test que pueda exigir «dos instrumentos» a una cifra escrita en prosa.

J6 (jv-j6), encargo del orquestador de Javier. Windows 11 · Node `v24.18.0` · 12 núcleos · 16.299 MB.
**Cada número lleva la fecha en que se midió**: los de las secciones ①-⑤ son del 28-sep; los nuevos, del 1-oct.

### La premisa

El título dice que `npm test` entero «ya no se puede correr» y habla de «3 muertes por memoria». Las dos
cosas estaban contestadas en este mismo registro desde el 28-sep, con el ticket todavía en «Por hacer»:

| lo que pide el ticket | dónde está | fecha |
| --- | --- | --- |
| medir dónde muere | §①-④: un fichero de 1.190 MB, bajado a 690; y §⑤: quien mata es el reaper de Claude Code, no Windows | 28-sep |
| una forma que quepa | §⑤: en primer plano terminaron 2 de 2; en total, 5 de 6 tandas enteras | 28-sep |
| distinguir «verde» de «no terminé» | `scripts/tanda-con-veredicto.mjs` (SCRUM-858b): sin línea de recuento sale con 4 | 17-sep |
| que «Argument list too long» no salga 0 | SCRUM-1245 y `tests/scrum1245b-patron-de-la-tanda-entre-comillas.test.mjs` | 28-sep |

Y un dato nuevo que cierra la pregunta de quién mata (1-oct 01:29+01, con las sesiones vivas):

| | MB |
| --- | --- |
| memoria física libre | 3.289 de 16.299 |
| archivo de paginación: reservado / en uso / pico histórico | 26.624 / 86 / 3.285 |
| compromiso libre / total | 24.132 / 42.923 |

⇒ **Windows no ha matado ninguna tanda ni está cerca de hacerlo**: tiene 24 GB de compromiso sin usar. Si la
memoria física se acaba, pagina; va más lento, no muere. Las «muertes por memoria» son todas del reaper de
Claude Code (§⑤), que mata órdenes en segundo plano de una sesión quieta con un umbral que no es la memoria
libre.

### Cuánto cuesta la tanda — dato del 28-sep, con dos instrumentos

Releídas las muestras de las seis tandas del 28-sep (1.070-1.072 ficheros, concurrencia 11 salvo la última):

| tanda (28-sep) | `node.exe` ajeno al empezar | pico de la suma | **coste propio** (pico − ajeno) | caída de la libre |
| --- | --- | --- | --- | --- |
| T11 | 1.906 | 3.650 | **1.744** | 1.806 |
| T11-antes (censo viejo) | 2.473 | 4.352 | **1.879** | 1.548 |
| T11-inactiva | 1.758 | 3.488 | **1.730** | 1.587 |
| T11-final | 1.740 | 3.460 | **1.720** | 1.797 |
| T6-1218 (concurrencia 6, censo viejo) | 1.489 | 3.713 | **2.224** | 1.961 |

⇒ **La tanda entera cuesta entre 1,7 y 2,2 GB de pico** (28-sep). Por hijo: máximo 781 MB, p99 371, p90 162,
mediana 99; 12 ficheros pasan de 350 MB y 518 de 100.

**Límite del instrumento:** la suma de `node.exe` no cuenta los nietos que no son node (`git`), y la caída de la
libre cuenta también lo que hagan las demás sesiones. Por eso van las dos columnas: coinciden en el orden
(1,5-2,2 GB), no en la cifra.

### ¿Cabe hoy? — proyectado; medirlo me lo denegaron

Hoy la tanda tiene **1.139 ficheros** (+67 desde el 28-sep). El orquestador dio turno para una tanda entera
medida, en primer plano y con corte propio a 800 MB libres; **el clasificador de permisos de la sesión denegó
lanzarla** («Interfere With Workloads»). No se reintentó por ningún otro camino. **El pico de hoy no está
medido.** Lo desbloquea Javier: o la corre él, o la autoriza en la sesión.

Lo que sí se midió hoy, sin tanda (entre la 01:29 y la 01:38+01, un fichero cada vez, en primer plano):

- **Los 12 ficheros más pesados del 28-sep no han engordado**: 12 de 12 verdes; suma de sus picos **5.557 MB**
  (28-sep, dentro de la tanda: 5.504). El mayor, `scrum1093h`, 700 MB; `scrum775`, 538.
- **La memoria libre, sin tanda ninguna, osciló entre 1.636 y 4.626 MB** en esos diez minutos (38 lecturas).
  O sea: el margen depende más de lo que hagan las otras sesiones que de lo que cueste la tanda.
- No se sabe si alguno de los 67 ficheros nuevos pesa. Con la concurrencia topada en 11, ficheros normales
  (~100 MB) alargan la tanda sin subir el pico — **derivado, no medido**.

**Veredicto:** con el coste del 28-sep (1,7-2,2 GB) y 3,3 GB libres, quedarían **1,1-1,6 GB**; en el peor
momento medido hoy (1,6 GB libres) no quedaría margen físico y Windows paginaría. **Cabe** en el único sentido
que importa —termina y da veredicto—, y **no está demostrado hoy**. Lo que el ticket afirma («no se puede
correr») queda tumbado por 5 tandas enteras; lo que nadie puede prometer es que el reaper no corte una orden
en segundo plano de OTRA sesión mientras corre (§⑤: derivado, nunca medido).

### Lo que se puede hacer sin pedirle nada a Javier — cada opción con su coste

| opción | qué se midió | coste | ¿sirve? |
| --- | --- | --- | --- |
| **bajar la concurrencia** | 28-sep, mismo censo viejo: con 6, coste propio 2.224 MB; con 11, 1.879. Tiempo 4,3 contra 4,2 min. n = 1 cada una | ninguno en tiempo; cambiar `package.json` afecta a los dos equipos | **no es la palanca**: el pico lo ponen unos pocos ficheros pesados que coinciden, no el número de trabajadores |
| **`--max-old-space-size=512`** | 1-oct, los 12 pesados uno a uno: 12 de 12 verdes; suma de picos 5.257 MB contra 5.557 sin tope (**−5 %**). Un fichero SUBIÓ 103 MB: el ahorro está dentro del ruido | tendría que ir en `NODE_OPTIONS` del script o del CI | **no**: donde no rompe, no ahorra. Lo que pesa son datos vivos (programas de TypeScript), no basura |
| **`--max-old-space-size=256`** | 1-oct, los mismos 12: **5 mueren** con «heap out of memory» y la tanda los cuenta como «1 test, 1 fail» | fabrica cinco rojos que no son defectos del producto | **no, y hace daño**: un rojo así se lee como un guard que ha saltado |
| **trocear la tanda** | no medido hoy. Los 12 pesados en serie tardan 125 s (1-oct) | exige un agregador que dé UN veredicto y declare CIEGO el trozo sin recuento (requisito 3 del ticket), y tocar `package.json` | **no hace falta para caber**: la tanda entera ya cabe. Solo tendría sentido aislar los 12 pesados, +2 min |
| **adelgazar los pesados, uno a uno** | 28-sep: `scrum1093h` 1.190 → 690 MB con salida idéntica byte a byte | un cambio de código por censo, con su prueba de salida idéntica y sus mutaciones | **es lo único que ha bajado el pico de verdad** (−700 MB en la suma). Siguientes: `scrum534b` 592, `scrum846c` 543, `scrum775` 538. No hace falta para caber |
| **correrla en primer plano** (§⑤) | 28-sep: 2 de 2 terminaron | pedir turno: ninguna otra sesión con órdenes en segundo plano | **es la receta vigente** |

### Lo que es de Javier, por separado

1. **Cerrar Discord, Spotify e iTero no es lo que hace caber la tanda.** El orquestador midió 2,22 GB entre
   los tres con cero sesiones; a la 01:29 yo vi Discord 847 MB e iTero 619, y **a la 01:38 ya no estaban**
   (libre: 4.626 MB). Son más memoria que la que consume la tanda entera, y ayudan a todo lo demás; pero la
   restricción no era la memoria libre.
2. **La tanda de hoy**: correrla él (`npm test` en una consola) o autorizarla en la sesión.
3. **El reaper** (`CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP`) sigue siendo suyo y sigue sin tocarse (§⑤).

### Lo que NO se ha tocado

Ni `package.json`, ni el CI, ni ningún test, ni ningún proceso ajeno, ni ninguna base. Este tramo es solo
registro. Instrumentos fuera del árbol y de un solo uso: la sonda de pico por hijo del 28-sep (con el tope de
heap efectivo añadido, para comprobar que la bandera LLEGA al hijo: 704 MB con 512, 448 con 256) y un
lanzador que corre un fichero cada vez.

### Mis errores en esta entrega

- Di el coste de la tanda al orquestador como «1,5-2,0 GB» leyendo solo la caída de la memoria libre. Cruzado
  con la suma de `node.exe`, es **1,7-2,2 GB**. La corrección está arriba.
- Le escribí una hora «a ojo» en el aviso de la denegación en vez de leerla del reloj.

## ⑦ 1-oct: la tanda de HOY terminó — y dos condiciones del entorno que fabrican rojos con cara de defecto

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:01:05Z

A9: aviso → A10 «Un rojo sin población no es un hallazgo: es un instrumento que no llegó a arrancar.» — no se pudo comprobar: lo que falta es que la receta de la tanda diga en qué shell se corre, y ese texto vive en `CLAUDE.md`, derivado del máster; lo decide el fundador y aquí sólo se deja medido.

### El número de hoy

| quién, dónde | tests | pass | fail | saltados | duración |
| --- | --- | --- | --- | --- | --- |
| el fundador, `npm test` en `cmd.exe`, esta máquina, 1-oct | 9.338 | 9.156 | 44 | 138 | 5 min 17 s |
| CI del PR #2033 (Linux), 1-oct 00:49Z | 9.343 | 9.243 | 2 | 98 | — |

⇒ **La tanda entera TERMINÓ hoy en la máquina del equipo, con su línea de recuento.** La afirmación del
título queda tumbada también con el número de hoy, no sólo con las cinco tandas del 28-sep.

**De segunda mano, y dicho:** la fila local me la ha pasado el orquestador a partir de lo que pegó el
fundador; no he visto la salida. La fila del CI la he leído yo del log del job.

**Sin pico de memoria.** Se corrió `npm test` a secas, sin el muestreador: no hay ni pico ni caída de la
memoria libre de hoy. **El coste sigue siendo el del 28-sep (1,7-2,2 GB)**; el de hoy queda sin medir.

### Los 44 rojos locales: 2 son de `main`, 42 son de la shell

- **2 son los trinquetes de fecha** (`scrum128` y `scrum55`, «la lista mengua (ratchet + caducidad)»).
  Son los mismos 2 del CI: `main` los lleva desde medianoche y los trae cualquier PR de hoy.
- **42 son por correrla desde `cmd.exe`, donde no hay `bash` en el PATH**: `spawnSync bash ENOENT`,
  «🔴 CIEGO: no hay `bash` en esta máquina» y, en cascada, `null !== 0`. Reparto 2 + 42 según la lectura
  del orquestador sobre el pegado; **no los he contado yo uno a uno**. Lo que sí he medido, leyendo el
  árbol: **9 ficheros de test nombran `bash` literalmente** para lanzarlo.

### 🔴 Dos condiciones del entorno que fabrican rojos con cara de defecto

| condición | lo que fabrica | cómo se lee en el resumen |
| --- | --- | --- |
| **`--max-old-space-size=256`** (§⑥) | 5 de los 12 ficheros pesados mueren con «heap out of memory» | «1 test, 1 fail» por fichero: parece un guard que ha saltado |
| **correr `npm test` desde `cmd.exe` o PowerShell** | 42 tests sin intérprete | «fail 44»: varios se declaran CIEGOS, que es lo correcto, pero el total no lo distingue |

Las dos son la misma forma: el test no llegó a medir y el resumen lo cuenta como un fallo del producto.
Quien persiga esos rojos persigue un defecto que no existe.

**La receta de la casa no dice en qué shell se corre la tanda.** El bloque de comandos de `CLAUDE.md` es
de bash, pero en ningún sitio dice que la tanda NECESITA `bash` en el PATH. **Propuesta, no aplicada**
(es texto derivado del máster): una línea en ese bloque — «la tanda se corre desde Git Bash: desde `cmd`
o PowerShell, los tests que lanzan `bash` salen en rojo sin serlo».

### El CI de este PR

`build + tests` salió rojo en #2033 **sólo por los dos trinquetes de fecha** (9.343 tests, 2 fail): no es
de este cambio, que es sólo registro. El meta-guard también salió rojo, por dos mudos de `scrum853` y un
ciego de `scrum859`, ninguno tocado aquí.

## ⑧ 23-oct: la línea de Git Bash, firmada — el diff exacto para el máster y `CLAUDE.md`, sin aplicar (carril de un jefe)

**Medido contra:** `origin/main` = `6b7b18db9fcbae42fbcb2c90a5795f4b4a7e6780` · 2026-10-23T13:51:36Z (hora de GitHub)
A9: sin fallo que generalice — este tramo sólo prepara un diff; el literal se copió de `c.20515` y no de la propuesta ni de la ficha del encargo

J4 (`jv-j4q`, equipo de Javier).

### Lo firmado

- **SCRUM-1244 comentario 20481** (decisión): añadir la línea; entra en el máster por cambio de máster y `CLAUDE.md` la copia (regla 35).
- **SCRUM-1244 comentario 20515** (firma del literal): la opción A de la propuesta `c.20489` (jv-j4p). Va al máster, Parte AA, AA1, al final del punto 3, y `CLAUDE.md` la copia en «Comandos» encima de `npm test`.

El «51» del literal lo midió `c.20489` sobre 10 ficheros (95 tests: 0 rojos con `bash` en el PATH, 51 sin él) y dice que es un mínimo. Es parte del texto firmado: se copia tal cual, no se re-mide.

### Por qué no lo meto yo

`node scripts/carriles.mjs de docs/YAQU_MASTER.md` y `… de CLAUDE.md` → «SIN CERRADURA · `docs/equipo/dos-equipos.md:197` · **un jefe**». El encargo decía: si es de S0 o del fundador, no se toca; se deja el diff.

### Diff 1 · `docs/YAQU_MASTER.md` (manda; regla 35)

Sitio: `## AA1. Protocolo de sesión (obligatorio)`, el punto que empieza por `3. Tests relevantes en verde antes de commit` (hoy la línea 1803).

```diff
-3. Tests relevantes en verde antes de commit; verificación en **yaqu.app** (no localhost) antes de cerrar tarea.
+3. Tests relevantes en verde antes de commit; verificación en **yaqu.app** (no localhost) antes de cerrar tarea. La tanda de pruebas (`npm test`) se corre desde Git Bash. Desde cmd o PowerShell, si `bash` no está en el PATH, los tests que lanzan `bash` salen en rojo sin serlo: 51 el 23-oct-2026 (SCRUM-1244).
```

### Diff 2 · `CLAUDE.md` (copia)

Sitio: el bloque de código de `## Comandos`, encima de la línea `npm test                 # compila + node --test (tests/*.test.mjs contra dist/)` (hoy la 136). Va como comentario de shell, igual que los avisos de SCRUM-850 y SCRUM-1245 de debajo.

```diff
 npm run build            # tsc → dist/
+# La tanda de pruebas (`npm test`) se corre desde Git Bash. Desde cmd o PowerShell, si `bash` no está en el PATH,
+# los tests que lanzan `bash` salen en rojo sin serlo: 51 el 23-oct-2026 (SCRUM-1244).
 npm test                 # compila + node --test (tests/*.test.mjs contra dist/)
```

⚠️ El corte en dos líneas y el `# ` delante son forma de comentario, no cambian el literal. Si quien lo aplique prefiere una sola línea, es la misma frase.

### Lo que no he hecho

- No he tocado el máster ni `CLAUDE.md`, ni el estado del ticket (A13).
- No he medido si algún guard lee `CLAUDE.md` o el punto 3 de AA1 y cambiaría al aplicar el diff: lo tiene que correr quien lo aplique.

## ⑨ 23-oct: la línea de Git Bash, APLICADA al máster y a `CLAUDE.md` (carril un jefe, por encargo)

**Medido contra:** `origin/main` = `a3c13611ed6f078fa7fe5af5882b0b8b2d1b2d3f` · 2026-10-23T14:14:13Z (hora de GitHub)
A9: sin fallo que generalice — el literal se copió de `c.20515` y no del diff ⑧ ni del encargo, y el diff de los dos ficheros da 0 líneas borradas

J4 (`jv-j4s`, equipo de Javier). Carril «un jefe» (`dos-equipos.md:197`), aplicado por encargo del orquestador `cobroflash-backend-62` (SCRUM-1406 `c.20525`: «Tú, como jefe»).

- **Máster**, AA1, punto 3: la frase de `c.20515` va **en una línea nueva, sangrada tres espacios**, que en markdown sigue dentro del punto 3. El diff ⑧ la pegaba al final de la misma línea; eso reescribe la línea del punto 3, y el encargo pedía sólo líneas añadidas. El texto es el mismo.
- **`CLAUDE.md`**, «Comandos»: las dos líneas de comentario del diff ⑧, encima de `npm test`.
- Diff: `docs/YAQU_MASTER.md` +1 / −0 · `CLAUDE.md` +2 / −0.
- El «51» es parte del literal firmado: no se re-mide (lo dice ⑧).

## ⑩ 23-oct: la tanda entera no cabe en UN comando con el equipo trabajando — y por tramos sí, con un veredicto que no confunde «no terminé» con verde

**Medido contra:** `origin/main` = `0f1f4fb8758d991708d68e3eb335548f07b4406a` · 2026-10-23T20:24:51Z (hora de GitHub; la medición ① se hizo sobre `28098fe4b1a160303526f5a4002d52556d2c5b22`, 19:02-19:41Z)
A9: comprobación → `tests/scrum1244c-tanda-entera-por-tramos.test.mjs`

J6 (`jv-j6au`), encargo del orquestador `cobroflash-backend-62`, tras la reapertura de `c.20605`. Windows 11 · Node `v24.18.0` · 12 núcleos · 16.299 MB. Cada número es del 23-oct y lleva su hora.

### ① Dónde muere hoy: en el TIEMPO de un comando, y la memoria es lo que impide comprarlo con concurrencia

La tanda entera en 8 trozos, en primer plano, a concurrencia 4, con un muestreador por segundo (memoria libre y suma de `node.exe` de TODA la máquina) y una sonda `maxRSS` por hijo (instrumentos de un solo uso, fuera del árbol).

| trozo | hora (GitHub) | sesiones (`claude agents`) | s | tests | fail | libre mínimo | `node.exe` de la máquina, máx. |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0-100 | 19:04:32Z | 11 | 29 | 739 | 0 | 832 MB | 3.774 MB |
| 100-300 | 19:05:12Z | 9 (8 activas) | 130 | 1.234 | 5 | **473 MB** | 4.857 MB |
| 300-500 | 19:07:24Z | 9 (9) | 178 | 1.910 | 0 | 989 MB | 6.229 MB |
| 500-700 | 19:10:27Z | 9 (8) | 382 | 1.442 | 2 | **318 MB** | 6.657 MB |
| 700-900 | 19:19:01Z | 10 (9) | 272 | 1.829 | 4 | 1.934 MB | 4.792 MB |
| 900-1100 | 19:23:46Z | 9 (8) | **501** | 2.007 | 5 | **312 MB** | 7.429 MB |
| 1100-1250 | 19:32:31Z | 8 (7) | 241 | 1.256 | 0 | 1.467 MB | 5.144 MB |
| 1250-1482 | 19:36:41Z | 8 (7) | 287 | 1.980 | 4 | 868 MB | 6.073 MB |
| **total** | | | **2.020** | **12.397** | **20** | | |

Población: 1.482 ficheros, sondados 1.482 de 1.482; pass + fail + skipped (12.214 + 20 + 163) = 12.397.

- **El tiempo.** Entera, a concurrencia 4, son 2.020 s: 3,4 veces los 600 s que la herramienta Bash deja en primer plano. Medido: los tres trozos 100-700 lanzados en UN comando no cupieron, y el arnés lo pasó a segundo plano a los 600 s. Es lo que le pasó a `jv-j3at` (`c.20605`). Lo que queda en segundo plano lo mata el reaper (tramo ⑤).
- **La memoria.** Con sólo 4 trabajadores la libre bajó a 312 MB. Subir la concurrencia para que quepa en el tiempo es justo lo que la acaba. Los picos por fichero (`maxRSS` del hijo, sin nietos): `scrum1571c` **1.270 MB**, `scrum1571b` **1.199 MB** (van seguidos en orden alfabético y corren a la vez), `scrum775` 876, `scrum1537` 843, `scrum1093h` 740 (690 el 28-sep), `scrum846c` 687. Los demás, por debajo de 662.
- **El agregador.** No es él: el TAP entero son 3,1 MB repartidos en 8 ficheros. Su memoria propia no la he medido aparte.
- **Los 20 fallos** son de entorno de este árbol anidado (sin `node_modules` propio, y midiendo el árbol principal): `scrum1199` ×2 (`MODULE_NOT_FOUND`), `scrum1298b` ×2, `scrum245` ×2, `scrum351`, `scrum385` ×3, `scrum471`, `scrum475` ×3, `scrum476`, `scrum932` ×4. Más uno que cae sólo con carga: `scrum1266b` pasa solo.

### ② La forma que cabe: `scripts/tanda-entera-por-tramos.mjs` (`npm run tanda:tramos`)

    npm run build
    node scripts/tanda-entera-por-tramos.mjs --plan          # 1.486 ficheros → 13 tramos de hasta 115
    node scripts/tanda-entera-por-tramos.mjs --tramo 1/13    # uno por comando, en primer plano
    …
    node scripts/tanda-entera-por-tramos.mjs --resumen 13    # 0 verde · 1 rojo · 2 ciego

- **Reutiliza, sin tocarlo**, lo que S3 ya tenía para la dirigida (`_tanda-por-tramos.mjs`, SCRUM-1412): el reparto contiguo, la huella de la pasada (ficheros + n + estado del árbol, con `estadoDelArbol` de `tests-que-cubren.mjs`) y `resumenDeTramos`, que nace CIEGO y sólo dice VERDE con los n tramos vistos. Lo nuevo es la tanda ENTERA, los criterios de CIEGO de cada tramo y el tope de tiempo.
- 🔴 **Un tramo que no termina no suma como verde:** sin `# tests N`, con cuentas que no suman N, con `cancelled`, con cero tests, con salida ≠ 0 sin caídos, o pasado el tope de **540 s** (se para su árbol de procesos), el tramo sale CIEGO. Y si muere el comando entero, no deja registro: al resumen le falta, y sale CIEGO.
- **Concurrencia 4**: la medida. **120 ficheros por tramo**, derivado del peor tramo medido (412 s para 149, abajo): 332 s, el 61 % del tope. La primera cifra, 150, la derivé de 2,5 s por fichero y la segunda pasada la dejó en el 76 %: la recalculé.

**Rojo primero.** El test siembra tramos de muestra. Uno de ellos mata a su propio `node --test`, como el reaper. Con las dos reglas que dejan CIEGO a un tramo sin recuento quitadas a la vez, `EL CASO` cae con `0 !== 2`: el tramo muerto salía verde. Restauradas, 6/6. Con una sola regla quitada, el caso caía sólo por el TEXTO: la otra seguía diciendo CIEGO (abajo, «mis errores»).

### ③ Por efecto: dos pasadas enteras, con la máquina como está

| pasada | sobre | de | a | sesiones | tramos | ficheros | tests | fail | tramo más largo | suma |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `3a7ecc3f2` (antes del merge de main) | 19:58:27Z | 20:17:23Z+1m30s | 5-7 | **10 de 10** | 1.483 | 12.403 | 24 | 3m23s | 19m04s |
| 2 | `18af39600` (con main `0f1f4fb87` dentro) | 20:25:33Z | 20:51:29Z+2m28s | 6-11 | **10 de 10** | 1.486 | 12.424 | 21 | **6m52s** | 26m42s |

Libre al empezar cada tramo, entre 2.017 y 5.833 MB. Las dos pasadas dieron **un veredicto: ROJO**, y cuadra con lo visto.
- Pasada 1: 20 de entorno, más 4 míos que cazaron los guards de la casa y ya están arreglados: `scrum702`, `scrum864c`, `scrum775` (SCRUM-1179-B) y `scrum854`, que pide este registro.
- Pasada 2: los mismos de entorno, menos `scrum864c`, más `scrum854` (el registro aún no estaba) y `scrum1351`, que pasa solo (36/36): cae con carga.

Sobre el árbol con este registro dentro **no he corrido** una tercera pasada. Lo que dicen las dos: con 5-11 sesiones vivas, ningún tramo pasó del tope, y cada comando acabó en primer plano.

### Propuesta para `CLAUDE.md`, NO aplicada (carril «un jefe», regla 35)

En «Comandos», debajo del bloque del TAP:

    # Con el equipo trabajando, la tanda entera NO cabe en un comando (2.020 s el 23-oct-2026, SCRUM-1244):
    # se corre por tramos, uno por comando en primer plano, y vale el veredicto del resumen.
    node scripts/tanda-entera-por-tramos.mjs --plan
    node scripts/tanda-entera-por-tramos.mjs --tramo 1/13    # … hasta 13/13
    node scripts/tanda-entera-por-tramos.mjs --resumen 13    # 0 verde · 1 rojo · 2 CIEGO (falta un tramo o uno no terminó)

### Lo que no he hecho, o no he medido

- No he tocado `CLAUDE.md`, el máster, ni los ficheros de S3 o S5 (`_tanda-por-tramos.mjs`, `tests-que-cubren.mjs` y `tanda-con-veredicto.mjs`: se leen o se importan).
- El script no tiene fila en `dos-equipos.md` §3.3, que es de la S0: queda declarado en `scripts/_sin-fila-declarados.json`.
- Sin medir: si en Linux, parado por el tope, el runner se lleva a sus trabajadores. Allí `taskkill` no existe y el script cae a `SIGKILL` del runner. Su caso del test lo correrá el CI.
- Sin medir: el umbral exacto del reaper (sigue como en ⑤), y si una concurrencia 3 cabría con más margen de memoria.
- `scrum702` pone tope a quien lee `process.platform`. No lo he subido (regla 41): el script mira si existe `taskkill`, no la plataforma.

### Mis errores en esta entrega

- **Los guards de la casa me cazaron cuatro veces en un fichero nuevo:** una ruta del temporal con un token mío en vez de `tokenDeSesion` (`scrum258`), un `mkdtemp` sin `finally` (`scrum864c`), leer la plataforma (`scrum702`) y propiedades que el censo no veía nacer (`scrum775`). Los cuatro estaban escritos antes de que yo empezara.
- **Di casi por buena una mutación que no movía el veredicto.** Quité una regla y el test cayó, pero por el texto: la segunda regla seguía diciendo CIEGO. Y mi primera mutación con `sed` no se aplicó entera, sin avisar: el recuento la delató. La rehice con un script que sale con error si no encuentra lo que va a quitar.
- **Derivé el tamaño del tramo con una pasada, y la segunda lo dejó al 76 % del tope:** lo recalculé.
