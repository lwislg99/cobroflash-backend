# SCRUM-432 · `Plantillas` pasa a pestaña de Presupuestos y sale de la barra

**Medido contra:** `origin/main` = `9ccfb2a54b2ce1c9503d7f6ca54827ed44ad4d3d` · 2026-08-10T18:31:28+02:00
**Rama:** `scrum-432-plantillas-pestana`

**10-ago-2026, 18:31 CEST (UTC+0200)** · commit `d139b271ca2a4cbf4b6a4e8924b995d12e764c85`

## Las dos mitades, en el mismo commit

Entre «quitar la entrada» y «construir la pestaña» hay un estado en el que `templates` **no es
alcanzable desde ningún sitio**, y ése no puede llegar a `main`. Por eso van juntas.

**Por qué sale de VENTA:** sus entradas son **estados por los que pasa el dinero** —presupuesto,
albarán, factura— y `templates` nunca fue uno. **No hay ningún trabajo «en plantillas»**: era una
herramienta del paso 1, y su sitio es donde se usa. La secuencia queda
`quotes-list · albaranes · invoices` y sigue siendo el ciclo.

## `#templates` sigue navegando

Abre Presupuestos con la pestaña **Plantillas** activa. Hay marcadores vivos: **caer donde el
usuario venía buscando es mejor que un 404**, y es el mismo criterio que SCRUM-136 usó con
`operarios` — ser coherentes con esa decisión vale más que ahorrarse un `case`.

Y el menú activo traduce `templates` → `quotes-list`. Sin eso, entrar por el marcador dejaría la
barra **apagada** y al profesional sin saber en qué sección está: un defecto que no da error, solo
desorienta, que es peor de detectar.

## 🔴 Componente nuevo, DECLARADO — propuesta de alta en AB3

`.tabs` **no estaba en el inventario**. Se construye mínimo y **sin lenguaje visual nuevo**: ni un
color, ni un radio, ni un tamaño que no estuviera ya. El activo usa **el mismo verde de marca y el
mismo peso que `.nav-item.active`**, para que «dónde estoy» se lea igual en la barra y aquí; el foco
lo pone el `:focus-visible` global (`--ring`), no uno propio.

> **Propuesta para el inventario AB3:** `.tabs` / `.tab` — pestañas de sección dentro de una
> pantalla, para cuando dos listados son el mismo objeto visto de dos maneras. Tokens:
> `--neutral-200` (línea del grupo), `--muted` → `--ink` (inactiva/hover), `--green-600` (activa).
> Decide el fundador si entra al inventario o se queda local a esta pantalla.

Hay un test que **falla si aparece un hex literal** en ese bloque: un color inventado aquí sería
rediseño encubierto entrando por una pestaña.

## El módulo común de la barra: se mueve una declaración, no un número

`tests/_barra-lateral.mjs` lo leen **cuatro** guards y **no cuenta entradas por sección** — lleva
mapas declarados. `templates` se **mueve**:

| de | a |
|---|---|
| `ANADIDAS_DECLARADAS` (la barra la tiene y el diseño no la lista) | `VISTAS_SIN_ENTRADA` (vista viva, sin entrada, con camino) |

Tenerla en los dos sitios habría sido **decir dos cosas opuestas de la misma vista**, y la que se
creyera dependería de qué test mirases. **Ningún número tocado.**

Dos guards de SCRUM-420 se actualizan **porque su premisa cambió, no porque estorbaran**: el de
alcanzabilidad ya no exige «que esté en la barra» sino **que tenga camino** — que es lo que siempre
quiso decir.

## Una limitación de mi propio censo, encontrada poniéndome rojo a mí mismo

El censo de SCRUM-433 reconoce `renderAppView('literal')` y **no una variable**. Navegando con
`renderAppView(p.vista)`, `templates` salía como **vista sin camino teniéndolo**.

Los dos destinos van **escritos**, que además es lo que lee quien abre el fichero preguntándose a
dónde lleva cada pestaña. **Pero la limitación es real y queda reportada** (regla 9): cualquier
navegación por bucle o por variable es invisible a ese censo, y el día que alguien la use tendrá un
falso positivo. El arreglo sería resolución de un salto, como se hizo en SCRUM-245.

## Verificación

| | |
|---|---|
| la pestaña hace **lo mismo** | llama a `renderTemplatesView`; no repinta nada nuevo |
| **rojo por el mecanismo** | se quita el pintado → cae **nombrándola** |
| **rojo 2** | se quita la navegación → cae el guard de caminos (`HAY VISTAS A LAS QUE NO LLEGA NADA: templates`) **y** el de la barra |
| no queda enlace roto | la entrada ya no está **y** Presupuestos sigue estando — sin esa segunda mitad, borrar la barra entera pasaría el test |

Las dos mitades caen por guards distintos, que es lo que se quería: uno vigila que la pestaña
**pinte** y otro que **lleve**.

## Lo que NO toca

El historial de presupuestos, que no se rehace · el resto de la barra · `prisma/schema.prisma` · el
camino de emisión · la lógica de plantillas, que funciona.

Ficheros: `public/dashboard/js/quotesListView.js` · `public/dashboard/js/app.js` ·
`public/dashboard/index.html` · `public/dashboard/css/styles.css` · `tests/_barra-lateral.mjs` ·
`tests/scrum420-barra-lateral.test.mjs` · `tests/scrum433-dispatch-sin-camino.test.mjs` ·
`tests/scrum432-plantillas-pestana.test.mjs` (nuevo).
