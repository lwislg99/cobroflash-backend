# SCRUM-559 · Los suelos de umbral son ciegos a la pérdida parcial

**Medido contra:** `origin/main` = `1ccbb769279a3d760b8c9d4938cd883f95c62012` · 2026-08-20T12:40:00+01:00

> ⚠️ Esa hora es la del trabajo de esta rama, no una lectura de reloj — mismo criterio R14 que
> las demás entradas.

**Alcance:** dos guards arreglados, un censo entregado. **No se ha relajado ningún guard, no se
ha subido ningún umbral, y no se ha tocado el marcado ni el copy.**

---

## El defecto, en una línea

Un suelo existe para distinguir «he mirado y no hay nada» de «no he sabido mirar». Cuando lo hace
con un **umbral con holgura**, sólo detecta la ceguera **TOTAL**: la pérdida **PARCIAL** le pasa
por debajo y el guard informa cero **EN VERDE**.

> El daño no es un rojo raro: es un verde que parece una respuesta.

## Lo arreglado, con su holgura medida

Población real de `public/dashboard/index.html`: **60 etiquetas `<script>`**.

| guard | exigía | holgura | ahora |
|---|---|---|---|
| `dashboard-colision-declaraciones` | `>= 25` | **35** (más de la mitad) | `=== 60` |
| `scrum417-descargar-datos-carga` | `>= 40` | **20** | `=== 60` |

**Por qué exacto y no un umbral más alto:** subirlo a `>= 59` seguiría siendo ciego el día que la
población crezca a 70. **El problema es la FORMA, no el número.**

**Por qué se puede:** esta población es **ESTABLE** — 60 etiquetas en un fichero. Que cambiar el
número sea una decisión explícita, en el mismo commit que añade el script, es el objetivo.

🔴 **Y el número vive en UN SOLO SITIO**, `tests/_banco-vistas.mjs`. Si cada guard fijara el suyo,
el día que el index crezca uno se actualizaría y el otro no, y volveríamos a tener la misma
población vigilada a medias. **Divergencia imposible, no divergencia vigilada.**
`dashboard-colision` importa **sólo el recuento**, no el extractor: sigue leyendo el index con el
suyo, que necesita el orden y la posición.

## ⚠️ La tercera ocurrencia de la ficha YA NO EXISTE

El censo de anclas del bloque F **lo arregló SCRUM-557** añadiendo «SECCION DECLARADA QUE NO
EXISTE». Medido antes de tocarlo, pasándole un HTML modificado **en memoria** (no se toca
`public/index.html`):

| caso | ciego | unidades | sinAncla | problemas |
|---|---|---|---|---|
| intacto | false | 17 | 3 | 0 |
| **sin 1 de 2 secciones** | false | 14 | 2 | **1** ← lo canta |
| sin las 2 (ceguera total) | **true** | 0 | 0 | 0 |

**No se toca su suelo: ya distingue la pérdida parcial.** Y la población de hoy son **DOS**
secciones censadas (`heroe-f4`, `gremios`), no tres: la ficha traía el número de antes de que
`#comparativa` saliera del censo.

## El censo de umbrales, derivado

Con AST sobre `tests/` y `scripts/` (`typescript`, ya dependencia):

| | cuántos |
|---|---|
| Comparaciones `>=` / `>` con literal > 1 dentro de `assert`/`if` | **502** |
| De ésas, marcadas como suelo por su comentario o su mensaje | **335** |
| **Con umbral ≤ 100** — las que cuentan ELEMENTOS, no caracteres | **272** |

> ⚠️ **El primer censo filtraba por VOCABULARIO** (buscaba «CIEGO»/«SUELO» en el mensaje) **y se
> declaró ciego**: el suelo de `dashboard-colision` dice *«la extracción del orden está rota»*,
> sin la palabra CIEGO — el «SUELO» está en el **comentario** de encima. Filtrar por palabras
> habría dado un censo incompleto en verde, que es el defecto de este ticket aplicado a su propia
> medición. **Se filtra por FORMA**, que es lo que crea el problema.

**Los umbrales grandes (`s.length > 5000`) son otra clase y no tienen este defecto:** miden «el
fichero no está vacío», y perder parte del texto no deja un elemento sin vigilar. Hay ruido
declarado: `guard-a11y-comparativa.mjs:201 · ancho >= 641` es un **breakpoint CSS**, no un suelo.

**Hueco declarado:** de los 272, se han arreglado **2**. El resto queda censado para que el
fundador priorice — decidir cuáles son población estable exige mirarlos uno a uno, y hacerlo en
bloque sería convertir en recuento exacto poblaciones que varían legítimamente, es decir fabricar
rojos permanentes. **Un rojo permanente es el que el segundo que lo ve desactiva.**

## ⬜ La tercera vía (comparar contra la ejecución anterior): NO, y con motivo medido

Detectaría la pérdida parcial sin fijar nada a mano, que es su atractivo. Se descarta por dos
razones, y la primera es del propio repo:

1. **En CI no hay ejecución anterior.** Cada job es un runner limpio, y `ci.yml:120` dice que la
   casa **retiró la única caché que tenía** (`cache: npm`, 27-jul-2026) porque *«tumbaba el job
   con exit 1 aunque `npm test` hubiera pasado»*. Un suelo que dependa de estado entre
   ejecuciones necesita exactamente eso, y volvería a atar el rojo del CI a algo que no es el
   código.
2. **La primera ejecución de una rama nueva no tiene referencia**, así que el caso en que más
   falta hace —una rama que acaba de romper algo— es justo el que no cubriría.

Donde sí valdría: población **VARIABLE por diseño**, donde un recuento exacto es imposible. No hay
ninguno de ésos entre los tres de este ticket.

## Verificación

- **Control positivo:** 16/16 en verde con la población intacta. Sin rojo permanente.
- **Rojo por el mecanismo:** `defer` en **`js/jobCobroHuecos.js`** — la del **medio** (índice 30
  de 60), no la primera. Los dos guards caen nombrando el número: *«se leyeron 59 y se esperaban
  60»*. Antes de este cambio, esa misma inyección daba **16/16 en verde**.
  > El aviso de S1 que ahorró el error: su primera inyección cascó **la primera** etiqueta y
  > `dashboard-colision` cayó — pero por `scripts[0] === 'api.js'`, no por su suelo. **Un rojo que
  > llega por el motivo equivocado se lee igual que uno bueno.**
- **Ceguera total:** `defer` en las 60 → siguen cayendo (0 de 60). Lo que ya funcionaba no se
  pierde.
- **Reversión:** `Buffer.compare(disco, blob) === 0`, 20.425 bytes.
