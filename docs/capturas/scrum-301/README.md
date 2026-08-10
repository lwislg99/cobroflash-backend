# SCRUM-301 (C1) · capturas del listado global de albaranes (AB6)

**Medido contra:** `origin/main` = `56874623baa406a0e8e38b93c236f7a4740b1e6a` · 2026-08-05T16:38:08+01:00

Producidas con un **banco aislado** (puppeteer-core sobre el Edge instalado + servidor estático
efímero sirviendo `public/`). Se carga el **dashboard REAL** —su `index.html`, sus 40+ scripts, su
CSS y su sidebar— y se sustituye **solo la puerta de red**. Se entra por el menú, pulsando la
entrada nueva, como entraría el profesional. **Sin BD, sin auth, sin servidor de la app, sin
producción.** El banco no se commitea: vivió en el scratchpad.

> **La red se sustituye ANTES de que corra un solo script.** Sin sesión, `app.js` hace
> `window.location = /login.html`: la primera tanda murió con «Execution context was destroyed».

## 🔴 Lo que encontró la captura y el suelo NO

La segunda tanda salió **con el modal de onboarding tapando la pantalla entera**, y el suelo la dio
por buena: comprobaba que la tarjeta computa fondo, que hay 5 filas y 4 pestañas —todo cierto, todo
**detrás** del modal—. Lo que no comprobaba era que la vista **se viera**.

Es la misma familia que la lección de SCRUM-350 (una captura sin CSS es una captura de otra cosa),
con una vuelta más: aquí el CSS estaba bien y **el objeto fotografiado no era el que se creía**.
Ahora el suelo también falla si hay un `.modal-overlay` / `#onboarding-backdrop` visible.

## Las cuatro capturas

| Fichero | Qué enseña |
| --- | --- |
| `scrum301-listado-1280.png` | Escritorio: sección propia en el menú, 4 pestañas con contador (todos 5 · borrador 1 · emitido 2 · firmado 2), buscador, filtro de facturación y la tabla. |
| `scrum301-listado-390.png` | Móvil 390 (gama media): la tabla en modo tarjetas (`table--cards-mobile`). |
| `scrum301-error-1280.png` | **La captura que sostiene el ticket**: con la consulta caída NO hay pestañas, NO hay contadores y NO hay ceros — solo el aviso en rojo. |
| `scrum301-listado-390-ANTES.png` | **El defecto, medido**: sin las clases `cell-*`, con un cliente largo el número del albarán queda PISADO por la fecha. |
| `scrum301-error-390.png` · `scrum301-vacio-390.png` | Las dos pantallas que enseñan las cinco ranuras firmadas, a 390 px. |
| `scrum301-vacio-1280.png` | Cero albaranes de verdad: pestañas a 0 y estado vacío. Es el contraste del anterior: el mismo número con significado opuesto, y se distinguen en pantalla. |

## Microcopy: las NUEVE ranuras firmadas

La primera tanda de capturas se hizo con `[PENDIENTE microcopy oficial]` en cada rótulo, y el
marcador **empujaba `Cliente`, `Trabajo` y `Estado` fuera del ancho visible** — incluida la columna
que es la ventaja del ticket. No era maquetación: era el coste del marcador.

El asesor firmó primero las cuatro de estructura (el filtro con retoque: «todos», no «todas») y
después las cinco de estado. **Estas capturas están rehechas con el texto definitivo y ya no queda
ni un marcador en pantalla**: las seis columnas caben y `Trabajo` se ve enlazada.

Las dos de 390 px existen porque son las que enseñan las cinco últimas ranuras: el aviso de error
—que nombra la CARGA y no el inventario, para que un fallo no se lea como «no tienes albaranes»— y
el vacío con su recuento, su buscador y su «Todavía no hay albaranes».
## 🔴 Lo que encontró S1 en esta pantalla, medido antes de tocarlo

`.table--cards-mobile` recompone cada fila en una tarjeta con **áreas con nombre**
(`id`/`client`/`date`/`status`/`actions`). Una celda sin su clase `cell-*` no cae en su área: cae en
la **rejilla implícita**, auto-colocada en pares y por orden de aparición.

**Medido a 390 px** (`scrum301-listado-390-ANTES.png`): las dos primeras tarjetas salen con el
número del albarán **pisado por la fecha** —se lee `ALB-2026-0143/08/2026`— y el título del Trabajo
tapado por la píldora de estado. Las otras tres se salvan, y eso es lo que lo hacía fácil de no ver:
**el defecto se dispara con nombres de cliente largos**, porque la segunda columna es `auto`, se
come el ancho y la primera colapsa. «Comunidad de Propietarios Alcalá 231» no es un caso raro.

Veredicto: **ilegible, no cosmético** — el identificador del documento, que además es el enlace, no
se puede leer. Y no era una decisión de diseño: `invoicesView.js` pone 4 clases y
`quotesListView.js` pone 6; ésta ponía **0**. Arreglado aquí, dentro de 301.

El reparto: `Nº → cell-id` · `Cliente → cell-client` · `Entrega → cell-date` · `Estado →
cell-status` · `Trabajo → cell-actions` (franja inferior a ancho completo, con su target ≥44 px) ·
`Emisión → col-hide-mobile` (la tarjeta enseña la fecha operativa, la de entrega).

⚠️ **La clase del `<table>` no se toca**: `table--cards-mobile` se queda, porque hay un guard de S1
en vuelo que deriva de ella qué patrón usa esta lista.
## Checklist AB6

| Punto | Estado |
| --- | --- |
| Contraste AA · foco visible · targets ≥44 px | ✅ componentes existentes (`data-card-tab`, `input`, `table`), sin CSS nuevo |
| `aria-label` en buscador y filtro | ✅ |
| Capturas antes/después | ⚠️ **no hay «antes»**: la sección no existía |
| Estados empty / error / loading | ✅ vacío y error capturados; *loading* es el subtítulo «Cargando…» (sin skeleton: la carga es una sola petición) |
| Textos largos | ✅ el propio marcador ES el caso de texto largo, y está fotografiado |
| Importes grandes | n/a — este listado no enseña importes |
| **Matriz Android gama media / iPhone / tablet (V0-5)** | 🕳️ **HUECO DECLARADO**: solo se ha medido 390 px en Edge de escritorio. Ni dispositivo real, ni iOS, ni tablet. |
| Merchant sin logo / cliente sin WhatsApp / demo con marca de agua | n/a en esta pantalla |
