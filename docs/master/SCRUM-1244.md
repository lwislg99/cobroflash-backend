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
