# SCRUM-453 · ¿sirve de algo el precache si el HTML pide los scripts con huella?

**Medido contra:** `origin/main` = `e05087b0bb6edf7fc9a1b9ca391e2340eace76dc` · 2026-08-10T19:38:21Z

**10-ago-2026** · sesión 1 · sin gate, corre en `npm test`

El ticket llegó como **hipótesis, no como medición**: si el HTML pide `/dashboard/js/api.js?v=<huella>`
y el SHELL precachea `/dashboard/js/api.js`, la query entra en la clave de la Cache API y no casaría
ninguno — el precache estaría lleno y sería peso muerto, y el profesional sin cobertura no abriría el
dashboard.

## Veredicto: **LA HIPÓTESIS ES FALSA.** El precache sí sirve.

Y por eso este ticket no arregla `sw.js`: **arreglar lo que ya funciona es la peor manera de romperlo.**
Lo que sí faltaba —y es la entrega— es que nada mantenía la hipótesis falsa.

## PASO 0

* **`docs/master/SCRUM-453.md` no existía en `main`.**
* **Premisa comprobada antes de aceptarla**, que es lo que pedía el encargo. Resultado abajo.
* **ENTRADA: no hay pantalla.** Es un guard.

## El circuito, medido entero

| # | Paso | Cómo se contó |
|---|------|----------------|
| 1 | `dashboard/index.html` en disco pide `./js/api.js` **desnudo** | leídos los `<script src>` locales: **51 scripts, 0 con query** |
| 2 | El servidor lo reescribe **al servirlo**: `sellarReferencias` añade `?v=<huella>` | `src/core/http/huellaEstaticos.ts:183`, montado en `src/app.ts:184-206` |
| 3 | El navegador pide `/dashboard/js/api.js?v=<huella>` | consecuencia de 2 |
| 4 | El SHELL precachea la ruta **pelada** | `const SHELL` en `public/sw.js:19` — **54 entradas, 0 que no resuelvan** |
| 5 | `caches.match(request, { ignoreSearch: true })` las hace casar | `public/sw.js`, en el `.catch()` del network-first |

El paso 5 es el que desmonta la hipótesis. **Y ya estaba, con un comentario que explicaba el
razonamiento exacto del ticket** (SCRUM-274: «`ignoreSearch` NO es laxitud: sin él este fallback
deja de existir»).

> ⚠️ **Mi primer conteo del punto 2 fue engañoso**: «51 scripts, 0 con query» es cierto **sobre el
> HTML de disco**, antes de la transformación del servidor. Leído sin el paso 2 sugiere que el
> navegador tampoco pide con query, que es lo contrario de lo que pasa. El número no estaba mal;
> estaba incompleto, y la conclusión habría salido al revés.

## Lo que faltaba: **NADIE vigilaba el paso 5**

Ningún test del árbol menciona `ignoreSearch`, `searchParams` ni `url.search`. Un comportamiento del
que depende **todo** el offline, sin una sola prueba: el patrón exacto de SCRUM-417.

### `tests/scrum453-precache-con-huella.test.mjs` (nuevo, 6 tests)

**Ejercita, no lee.** Carga `public/sw.js` en un contexto de `node:vm`, dispara su manejador de
`fetch` con la red caída y mira qué responde. Un `assert.match(codigo, /ignoreSearch/)` habría
pasado con la palabra escrita en un comentario, o con la opción puesta en la llamada equivocada.

**Y el doble de la Cache API es FIEL:** respeta el flag `ignoreSearch` en vez de ignorar la query
siempre. Eso no es un detalle de estilo — es lo que decide si el guard sirve:

| Estado | Positivo «con huella» | Suelo del doble |
|---|---|---|
| árbol tal cual | ✅ verde | ✅ verde |
| `sw.js` sin `ignoreSearch` | 🔴 **cae** (y **sólo** ése: el de sin query sigue verde) | ✅ verde |
| doble mentiroso **+** `sw.js` sin `ignoreSearch` | ✅ **falso verde** | 🔴 **cae** |

La tercera fila es la que justifica el suelo: con un banco infiel, el defecto real pasa
desapercibido y **lo único que lo delata es el test que interroga al propio banco**. Un banco infiel
no mide de menos: mide otra cosa (SCRUM-417, SCRUM-444).

**Controles negativos:** lo que no está precacheado no se sirve —`ignoreSearch` afloja la query, no
la ruta—, y las rutas de API siguen yendo a red sin tocar la caché con la red caída.

## El tercer hueco, cerrado: `aFichero` y las query strings

En `tests/scrum274-shell-alineado.test.mjs`, `aFichero` trataba `/algo?v=1` como un fichero literal
llamado `algo?v=1` — que no existe en ningún sistema de ficheros y en Windows ni siquiera es un
nombre válido. Tiene **dos mitades**, y las dos están cerradas:

**① El veredicto mentía.** Medido reconstruyendo el `aFichero` viejo y metiendo `?v=abc123` en una
entrada del SHELL que **sí existe**: el guard respondía

```
🔴 EL SHELL PRECACHEA RUTAS QUE NO EXISTEN:
    /dashboard/js/api.js?v=abc123
  `cache.addAll` es ATÓMICO: … el `install` falla entero y NADIE tiene offline
```

**Falso.** `express.static` sirve ese fichero ignorando la query: `addAll` lo traería con 200 y el
`install` no fallaría. El guard acusaba de la avería más grave que sabe nombrar por un defecto que
no era ésa — y un guard que acusa en falso no se corrige, se desactiva. Es el argumento de SCRUM-450
aplicado al propio guard de SCRUM-450. Ahora `aFichero` pela query y fragmento antes de resolver.

**② El defecto real pasa a tener quien lo mire.** Una huella escrita a mano en el SHELL congela un
valor que el servidor recalcula del contenido: en cuanto el fichero cambie queda obsoleta, y
**`ignoreSearch` lo taparía** —la petición casaría igual con la entrada vieja—, así que sin cobertura
se serviría una versión que ya no es la del despliegue, sin error en ninguna parte. Lo mismo que hace
funcionar el offline es lo que haría invisible este defecto. Test propio, con su motivo.

### Rojo por el mecanismo, sobre `public/sw.js` real

| Mutación | Existencia (+302) | Huella a mano (453) | HTML↔SHELL |
|---|---|---|---|
| `?v=abc123` en una ruta que **sí existe** | ✅ no acusa | 🔴 **cae** | 🔴 cae |
| `?v=abc123` en una ruta que **no existe** | 🔴 **cae** | 🔴 cae | 🔴 cae |

La primera fila es el arreglo (antes acusaba en falso); la segunda es el control negativo: **el
pelado no es una puerta trasera**, ponerle `?v=` a una ruta muerta no la esconde. Ambos casos
aplicados con post-condición que verifica en disco que la mutación se escribió — un rojo que sale
verde porque la mutación no llegó al fichero es una prueba **no ejecutada**.

## Lo que NO se ha hecho, y es deliberado

* **No se ha tocado `public/sw.js`.** La salida del encargo para «hipótesis falsa» era medir y
  guardar, no arreglar. El único cambio de comportamiento está en un fichero de test.
* **No se vigila que el servidor siga inyectando la huella.** Eso ya lo cubre
  `tests/scrum274-huella-estaticos.test.mjs`; duplicarlo aquí sería la segunda detección del mismo
  hecho que SCRUM-436 y SCRUM-447 acaban de cerrar con los formateadores de euros.

## Huecos que se declaran

* **El doble de la Cache API es un doble.** Reproduce la regla que importa —la query entra en la
  clave salvo `ignoreSearch`— y se le interroga para probar que la distingue, pero no es la Cache API
  de un navegador. Lo que este guard demuestra es que **`sw.js` pide la normalización y la usa en el
  camino vivo**; que Chrome y Safari implementen `ignoreSearch` según el estándar se da por supuesto.
  La verificación en navegador real sigue siendo de `docs/QA_MASTER.md`.
* **`cache.addAll` no se ejercita.** El `install` no se dispara en este banco: lo que se ejercita es
  el `fetch`. La atomicidad de `addAll` la cubre por lectura el guard de SCRUM-274/302, como hasta
  ahora.
* **El pelado de `aFichero` corta por el primer `?` o `#`.** Una ruta con `?` codificado como `%3F`
  en el nombre real del fichero no se contempla. No hay ninguna en el árbol (54 entradas) y sería
  una elección muy rara; se anota por no dejarlo implícito.

## Tests

* `tests/scrum453-precache-con-huella.test.mjs` — 6 tests (2 de suelo, 2 positivos, 2 controles
  negativos)
* `tests/scrum274-shell-alineado.test.mjs` — 10 tests (3 nuevos de SCRUM-453)

`npm test`: **2800 tests, 0 fallos** (74 saltados, los de BD). `npm run guards:entrada`: **17 en
verde**.
