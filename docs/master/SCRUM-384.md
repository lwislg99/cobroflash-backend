# SCRUM-384 · Dos `min-height` locales que la base ya resolvía

**Fecha:** 6-ago-2026 · **Carril:** UI (CSS + una vista) · **Gate:** ninguno, corre en `npm test`
**Medido contra:** `origin/main` = `016ba48c78af18d7bafb291f24519926212b75d1` · 2026-08-06
**Tanda:** 1856 tests · 1789 pass · **0 fail** · 67 gateados

> Sale de un hallazgo de SCRUM-350: al comprobar si los parches de esa zona seguían haciendo
> falta, dos ya no lo hacían. **No se borraron al paso** — y el motivo de que fuera ticket es el
> que da título a esto:
>
> > **Vigilar un motivo muerto es no vigilar; obedecer un parche muerto es peor: sigue actuando.**

Un guard cuyo motivo caducó falla en silencio: no protege de nada y nadie lo nota. Un **parche**
cuyo motivo caducó es peor, porque **sigue aplicándose** — y aquí uno de los dos estaba cambiando
la pantalla en una anchura donde nadie había decidido nada.

## Los dos NO son el mismo caso

### ① `reportsView.js` — redundante **Y DAÑINO**

`b.style.cssText = 'min-height:44px'` en el botón de filtro. Desde SCRUM-352 la base ya da 44 px
en móvil a las variantes sueltas (`.btn-primary:not(.btn-sm)`), así que el objetivo AB6 se cumple
sin él. Pero **al ser inline gana siempre**: a 1280 px forzaba 44 donde la casa da 36.

Ese botón era **8 px más alto que sus hermanos en escritorio, y nadie lo decidió**. DESIGN.md pide
≥44 px **en móvil**; con ratón 36 cumple.

### ② `.qq-modal` — redundante a secas, y **solo su `min-height` de botones**

`.qq-modal .btn`, `.btn-primary` y `.btn-secondary` repetían 44 px dentro de su media de móvil.
No hacía daño —el resultado era el mismo— pero **escondía de dónde venía el 44**: quien lo leyera
creería que esta modal necesita algo especial que no necesita.

## LO QUE **NO** SE TOCÓ, y queda fijado con test

- **`.qq-modal .field input`.** Los INPUT no los toca la base: valen **42 px** fuera del sheet y
  suben a **44** dentro. Retirarlo habría **bajado** los campos. Medido antes, no supuesto — y hay
  un control que falla si alguien lo retira «por coherencia».
- **El apilado del pie** (`flex-direction: column-reverse` + los botones a `width: 100%`). Es
  **DISEÑO DELIBERADO**: pone los botones a ancho completo para que «Enviar por WhatsApp» quede
  dominante arriba. Queda fijado con su propio test para que el siguiente que pase **no lo
  confunda con lo que sí se retiró**.

  > La prueba de que no es un parche que compita con el `flex-wrap: wrap` de SCRUM-350 es que
  > **se aplica a un DIV DENTRO del pie, no al pie**: son dos contenedores distintos. Y `wrap` no
  > da esto — daría dos filas alineadas a la derecha, no dos botones a ancho completo.

## La medición, en navegador real y a las dos anchuras

Banco servido **por HTTP** (la lección de SCRUM-350: `setContent` sobre `about:blank` no resuelve
el CSS y pinta sin hoja de estilos → verde falso), con **suelo propio** —si `.modal-footer` no
computa `display:flex` y `flex-wrap:wrap`, para y no informa— y **esperando a que terminen las
animaciones** antes de leer geometría: los modales llevan `slide-up` con `scale(.98)` y el
`transform` del ancestro entra en el rect (sale 43,48 donde hay 44).

`min-height` computado, antes → después:

| elemento | clases | 390 antes | 390 después | 1280 antes | 1280 después |
|---|---|---|---|---|---|
| pie qq-modal · Cancelar | `btn btn-secondary` | 44 | **44** | 36 | **36** |
| pie qq-modal · WhatsApp | `btn btn-primary` | 44 | **44** | 36 | **36** |
| qq · añadir línea | `btn-ghost btn-sm` | 30 | 30 | 30 | 30 |
| qq · campo | `.field input` | 44 | **44** | 42 | **42** |
| **filtro de informes** | `btn-secondary` | 44 *(inline)* | **44** *(base)* | **44** *(inline)* | **36** ✅ |
| control | `btn` | 44 | 44 | 36 | 36 |
| control | `btn btn-primary` | 44 | 44 | 36 | 36 |
| control | `btn btn-sm` | 30 | 30 | 30 | 30 |
| control | `btn-ghost btn-sm` | 30 | 30 | 30 | 30 |

**Lo único que cambia en toda la tabla es el filtro de informes a 1280 px**, que es exactamente lo
que el ticket dice arreglar. El apilado se comprobó por separado: `flex-direction` sigue en
`column-reverse` a 390 y en `row` a 1280, y el botón del pie mide **309,09 px** de ancho antes y
después — el diseño no se movió. Cero botones fuera del pie.

## El guard que hace SEGURA la retirada no mira lo retirado

Sin los remedios locales, esos botones dependen **enteramente** de la base. Si alguien toca
SCRUM-352, se quedan sin target táctil en móvil **y ya no hay nada que lo tape ni que lo diga**.
Por eso el primer test exige que la base siga dando 44 px, y su mensaje dice la salida: o se
devuelve la regla a la base, o este ticket se revierte entero.

## Los tres rojos

| # | Qué se rompe | Qué sale |
|---|---|---|
| 1 | Vuelve el inline a `reportsView` | 🔴 «ha vuelto un `min-height` EN LÍNEA (línea 921)» |
| 2 | Se retira el `column-reverse` del pie | 🔴 «SE HA RETIRADO EL APILADO… y eso NO era un parche» |
| 3 | La base pierde `.btn-primary:not(.btn-sm)` | 🔴 «…o este ticket hay que revertirlo entero» |

El **3 es el que importa**: es el que demuestra que la retirada está sostenida y no colgando.

## Un defecto que me cazó a mí, y era el detector

Los tests de la qq-modal salieron rojos con el CSS correcto. El navegador decía 44 px y
`column-reverse`; mi lector decía «no hay regla». **El roto era el lector**: `parsearReglas`
devuelve `{ selectores, decls, medias }` con `decls` como **Map**, y yo leía `r.selector` y
`r.cuerpo`. Un `JSON.stringify` de un Map se ve como `{}` y hace creer que la regla está vacía.
Cuando el analizador y la realidad discrepan, el roto es el analizador.

## 🔴 Hallazgo (mismo defecto, fuera del alcance dado — se reporta, no se arregla)

**Hay más botones con `min-height` inline y variante suelta**, exactamente el caso ①:

| sitio | clase | qué pasa |
|---|---|---|
| `exportView.js:61` | `btn-primary` | 44 forzado también a 1280 |
| `exportView.js:83` | `btn-secondary` | ídem |
| `jobDetailView.js:1186`, `:1166`, `:1271` | `btn-primary` / botones | ídem — **fichero VETADO** (rama parada de C5) |

No se tocan: el alcance de este ticket lo fijó el fundador en dos sitios, y `jobDetailView` está
expresamente fuera. Siguiente acción concreta: mismo tratamiento que ① en `exportView.js` (ticket
propio), y los de `jobDetailView` cuando C5 libere el fichero. Los `min-height` inline sobre
**inputs, selects y labels** de esos ficheros **NO** entran: la base no los cubre y son legítimos.

Ficheros: `public/dashboard/css/styles.css` (el bloque `.qq-modal`) ·
`public/dashboard/js/reportsView.js` (el inline retirado) ·
`tests/scrum384-min-height-locales.test.mjs` (7, nuevo).
