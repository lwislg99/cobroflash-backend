# SCRUM-889 · En el parte, «Añadir línea» no hacía nada y el técnico no podía apuntar ni una línea

**Medido contra:** `origin/main` = `364e7d3a267d8babc49a92244168dc12096ce996` · 2026-09-16T18:37:39Z
**Rama:** `scrum-889-parte-anadir-linea` · **Estado:** EN PR — rojo, arreglo, mutantes y QA corriendo hechos. El dictado se separa (depende de una clave de IA: coste, regla 36). Hallazgo abierto: la «×» de una línea ya guardada.

Nace de SCRUM-882 (recorrido del electricista, 🔴 #1).

## PASO 0 · medido corriendo, en local (nunca producción ni staging)

App REAL (`node dist/index.js` de `origin/main`) contra un Postgres desechable propio (`127.0.0.1:55889`,
`yaqu_889_test`, esquema por `migrate diff --from-empty` con el CLI local 6.18.0), sin ninguna clave
externa. Semilla: un profesional con su sesión, un cliente, un trabajo y partes en borrador. Edge
headless por `puppeteer-core`, pulsando como un técnico (toque a 390, clic a 1280).

| paso | 390 px | 1280 px |
|---|---|---|
| pulsar «Añadir línea» (mano de obra) | **0 → 0 filas**, ninguna petición | **0 → 0 filas**, ninguna petición |
| reabrir el parte | 0 líneas | 0 líneas |
| pulsar la «×» de una línea guardada (puesta por `PATCH`) | **ninguna petición**, la línea sigue en servidor y pantalla | — |
| dictar + «Ordenar en líneas» | `POST /dictado` → 200, «No se ha podido sacar ninguna línea — escríbelas tú» | igual |

Errores de página: 0. Causa, en el código: `.parte-anadir` y `.parte-quitar-linea` se pintan en
`parteDetailView.js` y **ningún fichero les ata un escuchador**.

### El dictado: no es un botón muerto, es la falta de clave → SEPARADO

`POST /admin/partes/:id/dictado` devuelve a propósito la propuesta VACÍA con un 200 cuando
`isAiConfigured()` es falso (ni `GEMINI_API_KEY` ni `ANTHROPIC_API_KEY`), para no bloquear el parte. En
el banco no hay clave y el log no registra ningún error de IA: sale por esa rama. Arreglarlo es
**poner una clave de IA en el entorno = coste** → STOP (regla 36), no se toca aquí.

Medido para que la separación no esconda otro defecto: con la respuesta del modelo DOBLADA en el
navegador (y el service worker saltado, que si no hace él el `fetch` y la intercepción no lo ve —
la primera pasada fue un «no pude mirar» por eso), el resto de la cadena funciona de punta a punta a 390
y 1280: la propuesta se pinta, «Añadir estas líneas» manda el `PATCH` con la lista entera → 200, y
las líneas quedan en el servidor. **Lo único que falta para el dictado en un entorno es la clave.**
Staging no la tiene (SCRUM-882); producción **no medido** (es una variable de Railway).

## El arreglo — el patrón de líneas de la casa, sin textos nuevos ni schema

El de «Añadir estas líneas» del dictado (`confirmarLoDictado` + `lineasConfirmadas`):

* pulsar «Añadir línea» **añade una fila** en su bloque (mismas clases que una guardada, foco en UNDS,
  que abre el teclado numérico) y **no escribe nada**;
* se guarda cuando tiene **cantidad > 0 y descripción** —una línea sin cantidad no sale, igual que en
  el dictado—, al salir del campo (`change`, como el resto de campos del parte);
* por el `PATCH` de siempre con la **lista entera** (las que había + la nueva), y luego **se relee
  del servidor**;
* si el guardado falla **no se relee** (se perdería lo tecleado): se dice con el literal ya aprobado
  `noSeGuardo` y la fila se queda. Pulsar otra vez «Añadir línea» con la fila completa reintenta;
* una sola fila nueva a la vez; la «×» de la fila nueva la quita de la pantalla (nunca llegó al servidor).

Textos: ninguno nuevo (`anadirLinea`, `unds`, `descripcion` y `noSeGuardo` ya existían).

### Hallazgo · la «×» de una línea YA GUARDADA sigue muerta, a propósito

El `PATCH` de `lineas` conserva los precios de oficina **casando por índice**
(`partes.routes.ts`, `previas[i]` con el mismo bloque y descripción), y `puedeEditarPrecios` deja poner
precios también en **borrador**. Quitar la línea *i* corre las de detrás: su precio no casa y **se
pierde en silencio**. Eso toca dinero y no cabe en este PR (regla 37). Siguiente acción: casar el
precio por identidad de línea y no por índice, o no ofrecer la «×» cuando la línea tiene precio;
**decide el orquestador**. Mientras, una línea guardada se corrige editando sus campos.

## Commits

| sha | qué |
|---|---|
| `c383f9e05058fd5d26c2c5ba0fb6492c3c2de229` | ROJO: 8 caen por aserción («sin escuchador»); el parte firmado en verde |
| `ef7ea85e4bcf712e0610574467b016c907e4a0b1` | el cable de «Añadir línea» + la «×» de la fila nueva; se retira del rojo el caso de la «×» guardada (hallazgo) · 8/8 |

El rojo usa la vista DE VERDAD (`vm`) sobre el mini-DOM de `_banco-vistas.mjs`, sin dependencias
nuevas; lo único doblado es `apiRequest`.

### Rojos por mutación (7, todos ROJOS; reverso 8/8)

| mutante | caen |
|---|---|
| el botón sin escuchador | 7 |
| mandar sólo la línea nueva (sin las que había) | lista entera · materiales |
| aceptar cantidad 0 | sin cantidad no sale |
| releer tras un fallo | el fallo se dice y lo tecleado sigue |
| no releer tras guardar | lista entera y relee |
| sin «una fila nueva a la vez» | dos pulsaciones |
| la «×» de la fila nueva sin escuchador | la «×» nueva |

## QA — corriendo, con la rama

Misma app y misma base, ahora con `public/` de la rama; misma sonda que el PASO 0.

| paso | 390 px | 1280 px |
|---|---|---|
| pulsar «Añadir línea» | **0 → 1 fila**, foco en `parte-linea-unds`, sin scroll horizontal | igual |
| teclear 2 + «Cambio de diferencial» y salir | `PATCH` → 200; el servidor tiene la línea | igual, **tras** la línea que ya había |
| reabrir el parte | la línea vuelve | la línea vuelve |
| «×» de la línea guardada | sin petición (hallazgo, declarado) | igual |

Errores de página: 0. Capturas miradas: la fila nueva es idéntica a una guardada y el foco se ve.

**Negativo cumplido:** sin schema, sin textos nuevos, sin dependencias, ninguna ruta tocada.

## Sesión 2 · 16-sep-2026, 21:30 CEST — estado y el dictado APARCADO

**Medido por el orquestador** (no repetido aquí): #1371 está **desplegado**; producción en `f12c1574`, que lo
contiene. **El ticket NO se cierra todavía:** falta el segundo PR, la «×» de una línea guardada (abajo).

### El dictado queda APARCADO

No se arregla en SCRUM-889 ni en otro ticket por ahora. Lo único que le falta para funcionar en un entorno
es **una clave de IA** (`GEMINI_API_KEY` o `ANTHROPIC_API_KEY`): el resto de la cadena está medido de punta
a punta (PASO 0, arriba). Poner esa clave es **coste → regla 36**, y el fundador todavía no necesita el
dictado. Mientras, el técnico apunta las líneas a mano con «Añadir línea», que ya funciona.

Se reabre cuando el fundador lo pida; entonces la acción es sólo poner la clave en Railway (la pega él,
regla 9) y medir el dictado en producción, que hoy está **no medido**.

## Segundo PR · la «×» de una línea guardada (16-sep-2026, 21:50 CEST)

**Rama:** `scrum-889b-quitar-linea-guardada`, desde `origin/main` = `787d5716`. **Decisión** (orquestador, opción 1):
los precios de la oficina se casan por **identidad** de línea, no por índice.

### PASO 0

Las líneas **no tenían id**. `ParteTrabajo.lineas` es `Json`, así que el id va **dentro del JSON**: sin
schema, y por eso no se para (la opción 2 no hace falta). El sello no lo ve: `lineasCanonicasParte` escribe
tres campos a mano (lo vigila un test). El id no es dinero y viaja al técnico: la lista cerrada de claves
de 652/652c pasa a `bloque, descripcion, id, unds` y cualquier otra clave sigue cayendo.

### El arreglo

* `parteTrabajo.ts` · `idDeLinea` (la línea de antes, sin id, viaja con uno derivado `pos-N` que no se
  guarda) y `casarLineasPorIdentidad`: con id casa con esa línea, cada una UNA vez (un id repetido no
  clona el precio) y un id desconocido es línea nueva; sin id casa por posición como antes. El precio se
  conserva con el mismo bloque y la misma descripción, **igual que antes**. Toda línea se guarda con un
  UUID propio.
* `partes.routes.ts` · el `PATCH` de `lineas` usa esa regla; en `precios`, con `id` se busca la línea por
  id: si ya no está, 400 `precio_sin_linea` (mensaje existente) en vez de caer en la de detrás. Sin id,
  por índice como antes (pantalla de la oficina en caché).
* `parteDetailView.js` · las líneas se devuelven **con** su id (edición, «Añadir línea», dictado) y la «×»
  guardada ya tiene cable: lista sin ella, relee; si falla, `noSeGuardo` (literal ya aprobado).
  `parteOficinaView.js` manda el id con cada precio.

Textos: ninguno nuevo. Schema: ninguno. Dependencias: ninguna.

### Commits

| sha | qué |
|---|---|
| `3f0d4f515775b0b342adc36f935bf4842193100f` | registro: el dictado queda aparcado |
| `455110d389bdfb1f4096448b5d93bb0a03d19908` | ROJO: 8 caen por aserción (la tercera pierde su precio o hereda el de la segunda; la oficina con pantalla vieja valora la de detrás; un id desconocido hereda por posición; la «×» sin escuchador) |
| `befc005e9bd29995b5de624d11a1e2b0feb844ee` | el arreglo: 17/17 |

**Suelo:** si el banco no guarda las 3 líneas con precio, o el técnico no las recibe, «NO PUDE MIRAR».

### Rojos por mutación (9, todos ROJOS; reverso 17/17)

| mutante | caen |
|---|---|
| sin casado por id | 8 |
| un id repetido reutiliza la línea | 1 (id repetido) |
| un id desconocido cae a posición | 1 |
| la oficina ignora el id | 1 |
| el técnico sin id | 5 (incluido 652) |
| el id entra en el sello | 1 |
| la vista devuelve las líneas sin id | 2 |
| la vista no relee tras quitar | 1 |
| el precio se conserva aunque cambie la descripción | 1 |

Dos mediciones se repitieron por inválidas: la del técnico sin id no compilaba (el tipo exige `id`), y
dos de la vista corrieron con el `dist/` del mutante anterior aún puesto.

### Hallazgo · el banco de vistas no reemplaza en `innerHTML`

`tests/_banco-vistas.mjs` **añade** los nodos de cada `innerHTML = …` a los de antes. Tras releer, el banco
veía las 3 filas viejas más las 2 nuevas. Arreglarlo es una línea, pero mueve trinquetes ajenos
(SCRUM-697/698: presupuestos pasa de 261 a 237 nodos) → no cabe aquí (regla 37). El test mide sobre el
último marcado pintado (`cont.innerHTML`), que es fiel. Queda por abrir un ticket con ese dato.

### QA · app real de la rama, Postgres desechable

`node dist/index.js` de la rama contra `127.0.0.1:55889/yaqu_889_test`; dos partes en borrador con 3 líneas
valoradas **sin id** (como están hoy): 10, 20, 30, con la 2.ª y la 3.ª llamadas igual («Hora de oficial»,
el caso en que la tercera heredaba el precio de la segunda). Edge headless, service worker saltado.

| | 390 px (toque) | 1280 px (clic) |
|---|---|---|
| «×» de la 2.ª línea | un `PATCH` con `pos-0` y `pos-2` | igual |
| precios en la oficina después | **10 y 30** | **10 y 30** |
| en pantalla | 2 líneas | 2 líneas |
| en la base | UUID propio en cada línea, precio en la suya | igual |
| claves que recibe el técnico | `bloque, descripcion, id, unds` | igual |
| errores de página · scroll horizontal | 0 · no | 0 · no |

### Suite completa

Con `origin/main` mergeado (`999b556e`): **7139 tests, 1 rojo, de esta rama** — SCRUM-237: la negación
«la línea quitada ya no está» no tenía su control positivo. Añadido (`ac1bcfd49ab25e5101c18402f5b35c8975a1ac6e`): 237 + 889b, 25/25.
