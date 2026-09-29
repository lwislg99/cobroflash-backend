# SCRUM-1204 · `scrum910d` abortaba al salir: el tier-up de WebAssembly de V8 (el `llhttp` de `fetch`) terminaba mientras el proceso se cerraba — ARREGLADO pasándolo a `node:http`

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:26:43Z

J6 (jv-j6). Windows 11 · Node `v24.18.0`. Primero el diagnóstico y después, por decisión del
orquestador, el arreglo de 910d (§ «El arreglo»). **No se ha tocado ningún otro test, ni el
script `test`, ni ninguna bandera.**

## La firma real (no es un test que falle)

En la tanda, los 5 tests del fichero salen ✔ y **después** el proceso hijo aborta:

    Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94
    ✖ tests\scrum910d-microcopy-recibo-pendiente.test.mjs   'test failed'

Es la clase que ya midió SCRUM-556 (el `fetch` de undici contra un `listen(0)`), cuyo remedio
probado es `node:http` con `agent: false` (SCRUM-100). Lo que faltaba, y es este ticket, es
**por qué cae éste y no sus vecinos**.

## ① Reproducido a voluntad — y NO depende del orden

Mismo fichero, **solo**, 20 pasadas cada fila:

| invocación | abortos libuv |
|---|---|
| `node --test --test-force-exit tests/scrum910d-…` | **18/20** (20/20 en una copia idéntica fuera del árbol) |
| `node --test tests/scrum910d-…` (sin la bandera) | 0/20 |

**No hace falta ningún test anterior:** cae solo. El «pasa 5/5 aislado» que dijeron cuatro
sesiones era porque se corría **sin** `--test-force-exit`.

## ② Qué lo distingue de los vecinos: la CAUSA, medida por eliminación

Variantes en copias **fuera del árbol**, cambiando UNA cosa cada vez, 20 pasadas y
`--test-force-exit` en todas:

| variante | cambio único | abortos |
|---|---|---|
| A | ninguno (control del instrumento) | 20/20 |
| B | `fetch` → `node:http` con `agent:false` | **0/20** |
| C | 300 ms de pausa al final, antes de salir | **0/20** |
| D | 1 caso en vez de 4 | 0/20 |
| G / H | 2 / 3 casos | 20/20 · 20/20 |
| I | `Connection: close` (sin keep-alive) | 20/20 → **no** es el pool |
| J | quitar el test síncrono final | 20/20 |
| K / L / M | sólo casos sin Connect / con Connect / `ninguno` ×2 | 20/20 las tres |
| S / T / U | cargar `payInvoice`; `fetch` previo a otra ruta; 2 `fetch` previos | 20/20 las tres |
| E | vecino `scrum910-la-transferencia…` tal cual (21 `fetch`, mismo arnés) | 0/20 |
| F | vecino + un `fetch` como último acto | 0/20 |
| **Q** | **vecino reducido a su test ④ (2 `fetch` a `/recibo`)** | **20/20** |

**No es** la ruta, ni el número de `fetch` (U tiene 6 y cae; el vecino tiene 21 y no), ni el
keep-alive, ni Connect. **Es el TIEMPO** entre los primeros `fetch` y la salida: el vecino entero
tarda lo bastante y no cae; recortado a su final (Q), cae como 910d.

**Lo que corre en ese tiempo, medido con banderas de V8** (comprobado que llegan al hijo: salen en
su `process.execArgv`), sobre 910d, 20 pasadas:

| bandera | qué apaga | abortos |
|---|---|---|
| — | — | 20/20 |
| `--no-wasm-dynamic-tiering` | recompilación en segundo plano de **WebAssembly** | **0/20** |
| `--liftoff-only` | el salto de Liftoff a TurboFan en wasm | **0/20** |
| `--no-liftoff` | compila wasm optimizado de entrada (sin salto posterior) | **0/20** |
| `--no-concurrent-recompilation` | recompilación en segundo plano de **JS** | 20/20 |
| `--no-opt` | optimizador de **JS** | 20/20 |
| `--no-wasm-tier-up` | (bandera antigua; en este V8 no gobierna el tiering dinámico) | 20/20 |

**Contraprueba en el vecino:** Q sin bandera 10/10; Q con `--no-wasm-dynamic-tiering` **0/20**.

**Conclusión:** `fetch` es undici, y undici interpreta HTTP con `llhttp` compilado a
**WebAssembly**. Tras unas cuantas peticiones, V8 promociona esas funciones wasm y las recompila en
un hilo de fondo. Si el proceso sale mientras esa recompilación está en vuelo, el aviso de vuelta
al hilo principal (`uv_async_send`) llega sobre un handle que ya se está cerrando, y libuv aborta
en `async.c:94`. Con **una** petición no hay promoción (D); con 300 ms de margen termina a tiempo
(C); sin wasm (B, `node:http`) no hay nada que promocionar.

⚠️ El mecanismo exacto dentro de Node/V8 (qué tarea hace el `uv_async_send`) es **inferido** del
conjunto de mediciones, no leído en el código de Node. Lo medido son las tablas.

## ③ ¿Depende del orden de la tanda?

**No.** Cae solo, sin ningún test delante (① y A). En la tanda cae por lo mismo.

## ④ `--test-force-exit`: ¿condición o sitio donde se nota?

**Para ESTE fichero es condición necesaria, pero no es la causa:**
- sin la bandera, 0/20: el proceso no sale de golpe y la recompilación termina antes;
- **con** la bandera, pero sin tier-up de wasm (`--no-wasm-dynamic-tiering`), también 0/20;
- con la bandera y 300 ms de margen (C), 0/20.

La bandera **adelanta la salida** hasta caer dentro de la ventana. **Quitarla no arreglaría la
clase:** SCRUM-556 midió `scrum334` abortando también sin ella (3 de 5). Quitarla y llamarlo
arreglo sería esconder la carrera.

## La población en riesgo, hoy

Censo **por AST** (TypeScript): llamadas a `fetch(…)` y a `<x>.listen(0, …)`; comentarios y
cadenas no cuentan. **1.035** ficheros `tests/*.test.mjs`, **0 ciegos** (todos parsean): 41 con
`fetch()`, 55 con `.listen(0…)` y **41 con los dos**. Controles: `scrum910d` sale ✅ y
`scrum1107b` (`node:http`) no sale ✅.

**Barrido de los 41, cada uno solo, con `--test-force-exit`, 3 pasadas:** `scrum910d` 3/3
abortos; **los otros 40, 0/3 y limpios.** Con N = 3 eso **no** demuestra que no puedan caer:
es una carrera, y terminan más tarde. La lista de 31 de SCRUM-556 ha crecido a 41 (`scrum334` ya
no tiene el patrón).

## El arreglo — APLICADO (decisión del orquestador, 28-sep-2026)

**910d → `node:http` con `agent: false`**, el remedio de la casa (SCRUM-100/556) que ya usan
`scrum1107b`, `scrum1108b`, `scrum923` y `scrum924`. Sólo cambia el **transporte** de
`pedirRecibo`, no lo que el test afirma.

| momento | invocación | resultado |
|---|---|---|
| **ROJO**, test sin tocar (sha256 `9bb2d388e7b77d77`) | `node --test --test-force-exit tests/scrum910d-…` ×20 | **20/20 abortos**, firma literal: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 94` |
| **VERDE**, con el arreglo | la MISMA invocación, **con la bandera puesta**, ×20 | **0/20**, y 5 tests · 5 pass · 0 fail |

El verde se mide **con `--test-force-exit`**, no «5/5 sin bandera». Ése fue el error que tuvo a
cuatro sesiones (J1, J2, J3 y J6) diciendo «pasa aislado»: respondían a otro comando.

**Las aserciones no se han tocado.** El texto del fichero desde `const AMBOS` hasta el final tiene
el mismo sha256 antes y después (`07d063189d051b17`). El diff es un solo trozo, dentro de
`pedirRecibo`. `node:http` no sigue redirecciones, igual que el `redirect: 'manual'` de antes.

**Los otros 40** van a **SCRUM-1218**, que es una declaración y no una migración: la lista, el
porqué, el remedio y el criterio de disparo (si cae un segundo, se migran todos).

**Lo que NO es arreglo**, con estas palabras:
- **Quitar `--test-force-exit` no arregla la clase:** SCRUM-556 midió `scrum334` cayendo también
  sin ella.
- **Meter `--no-wasm-dynamic-tiering` en `npm test` es relajar el instrumento de 1.035 tests por
  culpa de uno.**
- **Meterlo en una lista de excepciones o saltos** está prohibido por el propio ticket y por la
  regla 41.

## Lo que NO se ha medido

- **Linux / CI (`ubuntu-latest`).** Todo es Windows; allí un abort de libuv no tendría esta firma.
  Y esto importa: **si en CI no cae, el verde de CI nunca lo habría cazado**, y eso explicaría
  por qué llevaba días pasando desapercibido mientras cada sesión lo veía en local.
- **Desde cuándo cae.** El fichero existe desde `62176956` (23-sep-2026, PR #1694) y no ha
  cambiado. Que cayera desde el primer día queda SIN DETERMINAR: habría que compilar y correr
  aquel commit.
- **Si es un defecto conocido de Node** (upstream): no se ha buscado.
- **El pie del mecanismo** dentro de Node/V8: inferido, no leído (ver ②).
