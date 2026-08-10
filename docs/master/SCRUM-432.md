# SCRUM-432 · B1 · incremento 3 — `Plantillas` deja de ser menú y pasa a pestaña

**Fecha:** 10-ago-2026 · **Carril:** B (UI) · **Gate:** sin gate, corre en `npm test`
**Medido contra:** `origin/main` = `9ed7f26c763a349c8ad0e776e6533f491d606003` · 2026-08-10T17:09:59+01:00
**Tanda:** 2625 tests · 2551 pass · **0 fail** · 74 gateados · `npm test` exit **0**

> Con esto **el bloque B queda cerrado salvo la entrada `Cobros`**, que es de B4 (SCRUM-285) y entra
> con su pantalla.

## PASO 0 — medido antes de tocar nada

**ENTRADA: un solo camino, y era la barra.** `index.html:85` (`data-view="templates"`) →
`app.js:256` `case 'templates'` → `renderTemplatesView`. Barrido sobre `public/dashboard/js/`:
**ningún otro fichero navega a `templates`**. Retirar la entrada sin poner antes la pestaña dejaba
la vista sin ningún camino — por eso SCRUM-420 la dejó fuera, y por eso aquí las dos mitades van en
el mismo commit.

**MECANISMO: las pestañas ya existen en la casa, y se reutilizan.** No hay que inventar nada
(regla 4). El control segmentado de la casa es `btn-sm` + `btn-secondary` (activa) / `btn-ghost`
(resto), 44 px de alto, con `role="tablist"` y `aria-selected`. Lo usan el filtro de Trabajos
(`jobsView.js:59`) y los diez submenús de Configuración (`settingsView.js`, SCRUM-284, que ya lo
declaró como *«mismo control segmentado que el filtro de Trabajos. Cero componentes nuevos»*).
**Escribir un segundo mecanismo de pestañas sería tener dos formas de lo mismo en el mismo
producto.**

## Lo que se construye, y en qué orden

`public/dashboard/js/quotesTabs.js` — la tira `Historial · Plantillas`, pintada por **las dos**
vistas. Y **solo entonces**, en el mismo commit, la retirada de la entrada de la barra.

### Por qué la pestaña NAVEGA en vez de esconder y enseñar

Podría haber fundido las dos pantallas en una y alternar `display`. No se hace, por tres motivos
medidos:

* **las dos vistas ya existen enteras**, con su carga y su estado propios: fundirlas es rehacerlas,
  y el encargo dice que el historial no se toca;
* **el enlace directo sigue vivo**: `#templates` está en `HASH_VIEWS` (`app.js`), así que un
  marcador que el profesional tuviera guardado **no se rompe** con este cambio. Hay test;
* **el router es quien pinta el título** de la pantalla, así que no hay dos sitios decidiendo en
  cuál estás.

Y una línea que no es cosmética: `setActiveMenu` mapea `templates → quotes-list`. Sin ella, estando
en Plantillas **la barra no marcaría ninguna sección** y el profesional no sabría dónde está.

## El test: se mide CARGANDO la pantalla, no leyendo el fuente

Aquí se cobra el banco de SCRUM-417. Medido antes de escribir el test: **las dos vistas implicadas
pintan en el banco** (`renderQuotesListView` con `{}`, `renderTemplatesView` con `[]`), así que la
pestaña se comprueba **en el árbol que la pantalla pinta de verdad** — no en una expresión sobre el
fuente. El positivo dice literalmente lo que importa: *`Plantillas` no está en la barra **y** sí es
alcanzable desde la pestaña*.

Y se comprueba en las **dos** vistas: sin la tira en Plantillas, entrar sería un callejón —se llega
y no se puede volver—. Más que la activa esté marcada en cada una: si las dos se pintaran igual, la
tira diría dónde puedes ir pero no dónde estás.

### 🔴 Corrección a SCRUM-417: el hueco era real y su CAUSA estaba mal escrita

SCRUM-417 declaró como hueco que *«el banco sirve `{}` a `apiRequest`»* y que por eso 5 de 12 vistas
no pintaban. **El hueco existía; el motivo no era ése.** `api.js` define su propio `apiRequest` de
nivel superior, así que al cargarse **PISA** el del banco: lo que las vistas llamaban era el de
verdad, contra un `fetch` que devolvía `{}` pasara lo que pasara.

Servir el fixture por **`fetch`** —que es lo que se ha hecho— no solo arregla eso: hace el banco más
fiel, porque ejercita `apiRequest` **entero** (sus errores tipados, su `res.json()`, su trato del
204) en vez de saltárselo. Medido después del cambio: `renderTemplatesView` y `renderTeamView` pasan
a pintar. **El hueco encoge y no desaparece:** quedan vistas que fallan porque el mini-DOM no
resuelve ids de marcado anidado, y eso sigue siendo del banco, no del código.

> Es la cuarta vez en dos días que este banco «encuentra» un defecto que era suyo. Se anota con las
> otras tres: **un banco infiel no mide de menos, mide otra cosa.**

## Verificado en rojo — tres inyecciones, comprobadas EN DISCO

| # | qué se rompe | qué sale |
|---|---|---|
| **R1** | se quita la pestaña `Plantillas` | 🔴 «`Plantillas` NO está en la barra y **TAMPOCO en la pestaña**: la vista se ha quedado sin ningún camino. Un profesional que guarde plantillas ya no puede volver a ellas» — y cae también el de composición de SCRUM-420 |
| **R2** | el detector de pestañas se ciega | 🔴 «**ESCÁNER CIEGO: solo veo 0 pestañas** (esperaba ≥2)» |
| **R3** | `Plantillas` vuelve a la barra | 🔴 «ha vuelto a la barra … dos caminos es el desorden que B1 arregla» + «**SOBRAN** en la barra entradas que el diseño no lista» |

Las tres abortan si el reemplazo no llega al fichero (forma de la casa desde SCRUM-420). **R1 es el
que pedía el encargo** y cae por los dos lados: el de composición y el que carga la pantalla.

## Lo que este ticket cambia del guard de SCRUM-420, y por qué no es relajarlo

Su test ① exigía `templates` **en la barra**, y tenía razón mientras la pestaña no existía.
Mantenerlo ahora sería **fijar el estado anterior como requisito**: el test caería el día que
alguien hace el trabajo bien — exactamente lo que ya corrigió `scrum296` ayer. Se da la vuelta y
sigue exigiendo lo mismo de siempre contra el camino de hoy: que **haya uno**, y solo uno.

`templates` se muda de `ANADIDAS_DECLARADAS` a `VISTAS_SIN_ENTRADA`, **con su ticket**, y hay un
test que impide que esté en las dos listas a la vez: *una de las dos estaría mintiendo*.

Y un arreglo pequeño de usabilidad del propio guard: la comprobación pasa de `assert.match` a
`assert.ok`, porque un `match` que falla imprime **el fichero entero** en `actual` y entierra el
mensaje, que es lo único que quien lo lea necesita.

## Microcopy (regla 30)

`Historial` y `Plantillas` salen **literales** del diseño §B1 (`Historial · Plantillas`): aprobados
por eso, mismo criterio que los rótulos de SCRUM-420. **Cero texto nuevo, cero marcadores** — hay
test de las dos cosas.

## Lo que NO cubre

* **`Cobros` sigue sin estar.** Es B4 (SCRUM-285) y entra con su pantalla.
* **AB6 · matriz de dispositivos y capturas: PENDIENTE** (humano). La tira reutiliza un control ya
  medido y lleva sus 44 px, pero **no está verificada en dispositivo**.
* **El banco no ve CSS ni layout**: dice que la tira se monta y con qué rótulos, no cómo se ve.
* **No se pulsa la pestaña.** Que el clic navegue lo sostiene `renderAppView`, que es el mismo
  camino que usa el resto del dashboard; el banco no dispara eventos.
* **Las vistas que el banco aún no pinta** siguen fuera: el hueco de SCRUM-417 encoge, no se cierra.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · ningún `.env` · **el historial de presupuestos**
(hay test de que sigue pintando, sin ids sin resolver, con su contador y con la tira ANTES de la
tarjeta) · `templatesView.js` más allá de la línea que pinta la tira.

## Ficheros

* `public/dashboard/js/quotesTabs.js` (nuevo) — la tira, reutilizando el control de la casa.
* `public/dashboard/js/quotesListView.js` · `templatesView.js` — una línea cada uno: la pintan.
* `public/dashboard/index.html` — la entrada de barra se retira; el script nuevo se declara.
* `public/sw.js` — el script nuevo, en el SHELL (el guard de SCRUM-274 lo exige en los dos sentidos).
* `public/dashboard/js/app.js` — `setActiveMenu`: `templates → quotes-list`.
* `tests/_banco-vistas.mjs` — el fixture pasa a servirse por `fetch`.
* `tests/_barra-lateral.mjs` — `templates` pasa de añadida a vista sin entrada, con su ticket.
* `tests/scrum432-plantillas-pestana.test.mjs` (nuevo, 8) — suelo, positivo, microcopy, no-regresión.
* `tests/scrum420-barra-lateral.test.mjs` — el guard se da la vuelta, sin dejar de exigir un camino.
