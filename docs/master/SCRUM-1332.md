# SCRUM-1332 · `scrum1216b` moría al salir: es `fetch` + la salida forzada, no YaQu ni el orden

**Medido contra:** `origin/main` = `01d99084936c73ce975d708c31397281ebc1538f` · 2026-10-01T06:26:51Z
(J3e del equipo de Javier, relevo de J3d, por encargo del orquestador `cobroflash-backend-5b`)

A9: comprobación → `tests/scrum1332-la-caida-no-tapa-lo-de-despues.test.mjs`

## 0 · En una frase

El proceso de `tests/scrum1216b-numero-de-arranque.test.mjs` moría al cerrar con
`Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94`
(0xC0000409) y sus 9 casos en verde. **No lo causa nada de YaQu ni el orden de la tanda: lo causa
el `fetch` global seguido de la salida forzada de `--test-force-exit`**, que es como corre
`npm test`. Se reproduce con un servidor http pelado y cero líneas de la casa. El banco que usa
1216b pedía con `fetch`; ahora pide con `node:http` y el fichero deja de morir.

Todo lo de aquí está medido en **Windows 11, node v24.18.0**. Linux: §5.

## 1 · El rojo primero

El fichero SOLO, con `--test-force-exit` y la máquina cargada (10 procesos ocupando CPU), como lo
dejó medido J3d (comentario 17735). Re-medido hoy sobre `258fc29b`:

    node --test --test-force-exit --test-reporter=tap tests/scrum1216b-numero-de-arranque.test.mjs

**7 muertes de 40.** Las 7 con la frase de libuv y `exitCode: 3221226505` en su TAP.

## 2 · La causa, separada por variantes

Cada fila son 40 pasadas del fichero solo, con `--test-force-exit` y la misma carga
(`evidencias/scrum1332/pasadas.sh`; las variantes, en `variante-<letra>.mjs.txt`: se copian a
`tests/` con nombre `.test.mjs` para correrlas). Una muerte se cuenta por la frase de libuv o el
`exitCode: 3221226505` en el TAP de esa pasada; un «0» es código de salida 0 en las 40.

| variante | qué tiene | muertes / 40 |
|---|---|---|
| c | la app real montada, **sin peticiones** | 0 |
| a | sólo importa el emisor (`invoiceNumber.service.js`) | 0 |
| b | la app real + 6 peticiones a la ruta de la serie, sin importar el emisor | **29** |
| **f** | **un `http.createServer` pelado + 6 `fetch`. Ni una línea de YaQu** | **33** |
| **g** | el mismo servidor pelado + las mismas 6 peticiones por **`http.request`** | **0** |
| e | la f, esperando 1,5 s antes de cerrar | 0 |
| h | la f, cerrando antes el despachador global de `fetch` | 7 ⚠️ |
| i | la f, con `server.closeAllConnections()` al cerrar | 7 ⚠️ |

⚠️ h e i corrieron a la vez que otra pasada mía de guards: su carga no es la de las demás filas.
Valen para «cerrar las conexiones no lo quita», no para comparar 7 con 33.

Lo que estas filas DEMUESTRAN:

- **No es YaQu** (f muere sin nada de la casa; c y a, con la casa y sin `fetch`, no).
- **No es el orden de la tanda** (cada fila es un fichero solo; ya lo había separado J3d).
- **Es `fetch`**: misma petición, mismo servidor, por `http.request` → 0 de 40 (f contra g).
- **Es la salida pegada al `fetch`**: con 1,5 s entre el último `fetch` y la salida → 0 de 40 (e).
- **No es «se dejó algo abierto»**: cerrar las conexiones del cliente o del servidor no lo quita.

Lo que NO demuestran, y no lo afirmo: **el mecanismo por dentro**. Que `uv_async_send` llegue a
un manejador que se está cerrando dice que algún hilo avisa al bucle mientras el proceso sale; qué
hilo es (la maquinaria de `fetch` de node trabaja en parte fuera del hilo principal) no lo he
medido. Tampoco he probado otra versión de node.

Por qué `scrum597`, que usa el mismo banco, no murió en las 40 de J3d: **no lo sé.** La fila e
sugiere que basta con que pase tiempo entre el último `fetch` y la salida, y 597 es un fichero
largo; es una hipótesis que encaja, no una medida.

## 3 · El arreglo, y lo que mide

`tests/_banco-camino-real.mjs` · `pedir()` hace la petición con `http.request` y `agent: false`
(una conexión por petición, que se cierra al terminar). Misma firma y mismo valor de retorno
(`{ status, json, texto }`). Lo único que cambia respecto a `fetch`: no sigue redirecciones.

Los dos ficheros que usan el banco, tras el cambio: `scrum1216b` + `scrum597` → 17 tests, 17 pass.

Y la misma medida del §1, con el fichero **dentro** y sin quitar nada (regla 41):

| | muertes |
|---|---|
| `scrum1216b`, antes | 7 / 40 |
| `scrum1216b`, después | **0 / 80** (dos tandas de 40) |
| `scrum597`, después (control: el otro usuario del banco) | 0 / 19 — **incompleta** |

Con una tasa de partida de 7/40, 80 pasadas limpias seguidas por azar son del orden de 1 entre
cinco millones (0,825⁸⁰). Las pasadas de `scrum597` se quedaron en 19 de 40: **el sistema paró la
orden por falta de memoria** con la sesión ociosa, y no la relancé. Las 19 que hay salieron 0 y
sin huella. Salidas: `evidencias/scrum1332/salida-pasadas.txt`.

La mutación declarada del test (el banco vuelve a `fetch`), aplicada a mano: **1 viva de 1**
(`salida-mutaciones.txt`).

## 4 · El control ④ del ticket — fabricado, que es lo que faltaba

*«Que un fallo posterior a la caída se siga viendo.»* J3d vio que el padre sobrevivía, pero no
fabricó el caso. Ahora es el caso ① de `tests/scrum1332-la-caida-no-tapa-lo-de-despues.test.mjs`:
tres ficheros de uno en uno (`--test-concurrency=1`), por el envoltorio de `npm test`:

1. `a-muere` pasa su caso y **aborta** al salir (`process.abort()`: muerte nativa de verdad);
2. `b-falla-despues` tiene un caso rojo y uno verde;
3. `c-sano`.

Resultado, seis pasadas directas idénticas y el test: **5 resultados, 3 pass, 2 fail** — el
fichero que murió y el rojo posterior — y exit 1. El caso del que murió consta como pasado, y lo
de después consta entero. **La caída no tapa nada: `node --test` corre cada fichero en su proceso
y el padre sigue contando.** El test lleva su suelo: si `a-muere` no muere de verdad (código > 1
o señal), se declara ciego.

Y el caso ② fija el arreglo por AST: el banco tiene 1 llamada a `http.request` y 0 a `fetch`
(con su control: el contador ve un `fetch(` real y no cuenta el de un comentario).

## 5 · Linux y el CI

Esa aserción no puede saltar en Linux: `src\win\async.c` sólo se compila en Windows. Eso no
prueba que el runner no tenga otra forma de morir al salir, así que se miró:

Barrido de los logs del job obligatorio (`evidencias/scrum1332/ci-ficheros-caidos-sin-caso.sh`):
se busca la entrada `test at tests/<fichero>:1:1`, que `node --test` sólo emite cuando el proceso
de un fichero sale ≠ 0 sin que ninguno de sus casos haya caído.

- **14 logs leídos · 0 con un fichero caído sin caso caído · 0 con huella de red.** Seis son de
  runs fallidos del 1-oct y ocho del 17 y 18-sep.
- **Control positivo: 1 de 1.** El run `36806690822` (PR #2046) sí lo trae:
  `tests/scrum804b-…:1:1` y cuatro líneas de `Could not resolve host`. El instrumento ve lo que
  hay cuando lo hay.
- 🔴 **Es una muestra corta e incompleta, y no la vendo como «en Linux no pasa».** El sistema paró
  las dos pasadas por falta de memoria; quedaron sin procesar 70 de los 94 runs fallidos de la
  ventana. Y la ventana tenía un agujero que destapó el control: el run de #2046 consta como
  `cancelled`, no como `failure`, así que **los 46 runs cancelados de esos 150 no estaban en la
  población**. Detalle: `salida-ci-ficheros-caidos-sin-caso.txt`.

Lo que sí queda dicho: en 14 logs de Linux no hay ninguna muerte de proceso, y la única caída
sin caso que consta en CI es la de red de SCRUM-1331.

Y de paso, con ese log real en la mano: el lector de huellas de SCRUM-1331 (PR #2058), alimentado
con las 13.029 líneas del log de #2046, dice `NO HABÍA RED · tests/scrum804b-… — 0 casos caídos
dentro … RELANZA` y «no hay ningún otro rojo de caso» (`salida-lector-sobre-el-log-de-2046.txt`).
Es una repetición fuera de línea sobre un log de verdad, **no** el aviso visto en un run.

## 6 · 🔴 Lo que queda abierto: es una CLASE, y este PR arregla un miembro

`fetch(` aparece en **57 ficheros de 1.287** de `tests/` (recuento por TEXTO: incluye menciones
y helpers; es un techo, no la población exacta). Cualquiera que use el `fetch` global y acabe
justo después puede morir igual en Windows bajo carga. Este PR quita la causa de los dos que usan
el banco de la app real, que es donde se vio. **Los demás siguen expuestos**, y lo que hoy los
cubre es el aviso del envoltorio (SCRUM-1331): cuando pase, la tanda dirá `MURIÓ EL PROCESO, NO
FALLÓ UN TEST` en vez de un «1 fail» mudo.

Tres salidas para la clase, **sin elegir** (la decisión no es mía):

- **A · migrar los que usan `fetch`** a un helper común sobre `node:http`. Quita la causa; toca
  ~55 ficheros de los dos equipos.
- **B · quitar `--test-force-exit` de `npm test`.** Sin el flag, 0 muertes de 65 (J3d). Pero el
  flag está ahí porque hay ficheros que no terminan solos (J3d vio colgarse a `scrum100` sin él).
- **C · no hacer nada más** y vivir con el aviso: en CI (Linux) no pasa; en local es intermitente
  y ahora se nombra solo.

Y un trinquete «ningún test nuevo usa el `fetch` global» sólo tiene sentido si se elige A.

## 7 · Tres errores míos

**La población del barrido del CI estaba mal dos veces.** Primero pedí
`gh run list --status failure --limit 40` y me devolvió runs del 17 y 18-sep, no los últimos; lo
vi por las fechas de la salida. Rehecha filtrando yo `conclusion == failure`, seguía dejando
fuera los runs `cancelled` — y el único caso conocido estaba justo ahí. Lo cazó ir a buscar el
control positivo, no el recuento: sin él habría escrito «0 de 94».

**La hora del ancla de este registro la escribí a ojo** al redactarlo (una hora que aún no había
llegado). La que hay arriba sale de `gh api -i zen`, copiada al cerrar.

**Y el del control ④:**

Escribí el control ④ exigiendo «6 resultados, 4 pass» contando de cabeza, y cayó contra una
salida que decía 5 y 3. Por un momento lo leí como «el recuento pierde un resultado tras la
caída» — justo lo que el ticket temía. No: 1 + 1 + 2 + 1 son 5, y seis pasadas directas dieron
las cinco líneas cada vez. El número del aserto sale ahora de contar las líneas de resultado, y
el test compara las dos cosas (`vistos.length` y `# tests`).
