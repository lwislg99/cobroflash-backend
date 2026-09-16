# SCRUM-628 · COBERTURA-VISUAL: el verde de los guards visuales no decía sobre qué pantallas miraba

**Fecha:** 16-sep-2026 · **Carril:** B (guard) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `026677a1bd8260ce073648680a8eb7d7003f4b39` · 2026-09-16T05:20:00+01:00

> **Un guard que termina sin hallazgos y no dice sobre qué miró es indistinguible de uno que no
> miró nada.**

## Los dos números del censo

| | |
| --- | --- |
| ficheros de guard `guard:*` | **20** |
| vistas del dashboard (`*View.js`) | **27** |
| de ésas, **nombradas por algún guard** | **7** |
| 🔴 **DIFERENCIA: sin cubrir** | **20** |

Y ahora el verde lo imprime, que es el entregable principal:

```
población: 20 guards visuales · 27 vistas del dashboard · 7 nombradas por algún guard · 20 SIN CUBRIR
la más grande sin cubrir: jobDetailView.js (3002 líneas)
```

Es la norma **A3** aplicada a los guards de navegador: *un cero no significa «está limpio»,
significa «no he mirado»*. Hasta hoy los guards pasaban en verde y nadie sabía que el dashboard
—donde el profesional vive todo el día— no lo miraba ninguno.

## ⚠️ El enunciado del ticket, matizado y medido

«El dashboard entero no tiene ninguno» **no es exacto**: **10 de los 20** guards tocan alguna ruta
del dashboard. Pero casi siempre cargando su `styles.css` **dentro de una página sintética**
(`/__caja-avisos.html`, `/__caja-semaforo.html`…), y eso ejercita el CSS, no la vista.

Por eso la unidad de este censo **no es «¿toca una ruta del dashboard?» sino «¿algún guard nombra
esta VISTA?»** — que es la pregunta que se corresponde con lo que un profesional abre. Con la
unidad del ticket el número habría sido 10 y habría sonado mejor de lo que es.

⚠️ **Y el criterio es deliberadamente GENEROSO:** cuenta como cubierta que un guard **nombre** el
fichero, aunque no lo ejercite. Se elige así a propósito: un criterio generoso que aun así deja
**20 fuera** es más difícil de discutir que uno estricto. Si mañana se afina, el número sólo puede
empeorar.

## La vista cubierta, y su criterio — que sale del censo, no de la intuición

**`jobDetailView.js` · 3.002 líneas · la más grande de las 20 que hoy no mira nadie**, y es el
detalle del Trabajo.

El criterio vive en `laQueMasPesaSinCubrir()` y se puede volver a ejecutar: **tamaño en líneas,
entre las que el índice enlaza** —una vista que el índice no carga no la abre nadie—. No es «la más
importante», que no se puede medir: es **la más grande de las desatendidas**, que sí.

🔴 **Y la elección no se queda apuntando a un árbol viejo:** hay un test que cae el día que otra
vista pase a ser la más grande sin cubrir, obligando a rehacer el criterio en vez de reescribir el
nombre a mano.

**⛔ No se hacen las 27.** Construirlas en una tanda sería adivinar cuáles importan, y el ticket lo
prohíbe expresamente.

## Verificado en rojo

**🔴 EL QUE DECIDE** — se rompe la vista de verdad (el render lanza al entrar), comprobando que la
mutación **ENTRÓ** y restaurando **byte a byte** contra los bytes de disco:

```
mutación aplicada · ¿ENTRÓ? SÍ, el fichero cambió
not ok 4 - SCRUM-628 · 🔴 EL QUE DECIDE: el detalle del Trabajo SE MONTA, y pinta su contenedor
    🔴 LA VISTA DEL DETALLE DE TRABAJO NO SE MONTA: la vista no publica `renderJobDetailView`
# pass 5 · fail 1
RESTAURADO byte a byte: ✅ idéntico
```

**✅ POSITIVO, y DISCRIMINA** — en esa misma pasada, el test de las vistas que **ya** se vigilaban
(`customersView`, `quotesView`) **siguió pasando**. Eso es lo que acredita que el rojo era de la
vista rota y no del banco: si el banco se hubiera roto, «la vista está mal» y «el banco no monta
nada» habrían dado el mismo rojo.

**⚠️ Por IDENTIDAD, no por subcadena** — el aserto cuenta **nodos del árbol pintado**, no
`includes` sobre el HTML. Es la lección de ayer: `includes('btn-primary')` pasaba porque la página
también pinta `btn-primary btn-sm`, y el guard aprobaba por una razón distinta de la que creía.

**SUELO** — cero vistas o cero guards sale **CIEGO**, no verde; y `cubiertas + sinCubrir` tiene que
sumar el total, para que el censo no pueda perder pantallas por el camino.

**Trinquete** — las 20 sin cubrir están declaradas: si el número **sube**, alguien añadió una vista
sin guard y el rojo la nombra; si **baja**, también cae, para que la mejora quede **anotada** en vez
de pasar desapercibida.

## Lo que NO cubre

* **26 vistas siguen sin guard propio.** Este ticket entrega el censo, el que el verde lo diga, y
  **una** cubierta como prueba de que el camino funciona.
* **La vista se ejercita en el banco (JSDOM), no en navegador.** Comprueba que **monta y pinta**,
  que es justo lo que hoy no comprobaba nadie; no comprueba contraste, tamaño táctil ni CLS — eso
  son los `guard:*` de navegador, que viven fuera de la tanda.
* **No se ha tocado ningún guard existente**, así que ninguno ha podido dejar de cazar lo suyo.
* **No se toca UI**: se lee la vista, no se modifica. `src/` y `public/` quedan intactos.

## Ficheros

* `scripts/_cobertura-visual.mjs` — el censo, con el criterio de elección escrito dentro.
* `tests/scrum628-cobertura-visual-del-dashboard.test.mjs` — la población declarada, el trinquete,
  la vista cubierta y sus controles.
