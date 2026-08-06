# SCRUM-384 · Dos `min-height` locales que la base ya resolvía

**Fecha:** 6-ago-2026 · **Carril:** UI (CSS + una vista) · **Gate:** ninguno, corre en `npm test`
**Medido contra:** `origin/main` = `016ba48c78af18d7bafb291f24519926212b75d1` · 2026-08-06T00:43:01+01:00
**Tanda:** 1858 tests · 1791 pass · **0 fail** · 67 gateados

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
| 4 | Vuelve el inline a `exportView` | 🔴 «ha vuelto un `min-height` EN LÍNEA sobre un botón (línea 64, `<button>` en plantilla)» |
| 5 | Se barre el `min-height` del LABEL de datasets | 🔴 «Ése NO sobra: la base no toca labels ni inputs… quitarlo baja el objetivo táctil de esa fila» |

El **3 es el que importa**: demuestra que la retirada está sostenida y no colgando. El **5 es su
espejo**: demuestra que el guard no se ha vuelto un barredor.

## Un defecto que me cazó a mí, y era el detector

Los tests de la qq-modal salieron rojos con el CSS correcto. El navegador decía 44 px y
`column-reverse`; mi lector decía «no hay regla». **El roto era el lector**: `parsearReglas`
devuelve `{ selectores, decls, medias }` con `decls` como **Map**, y yo leía `r.selector` y
`r.cuerpo`. Un `JSON.stringify` de un Map se ve como `{}` y hace creer que la regla está vacía.
Cuando el analizador y la realidad discrepan, el roto es el analizador.

## ③ `exportView.js` — el alcance ampliado (mismo defecto ①, exacto)

El hallazgo de esta sesión se amplió al ticket **antes de mergear**, por decisión del fundador:
`exportView.js:61` (`btn-primary`, «Descargar ZIP») y `:83` (`btn-secondary`, portabilidad) son
variante suelta + inline que fuerza 44 a 1280. Mismo tratamiento y mismas comprobaciones.

Medición **pareada** —el gemelo con inline y el limpio en la MISMA página y la misma pasada, lo
que elimina la variación entre ejecuciones—:

| botón | 390 px | 1280 px |
|---|---|---|
| con inline *(antes)* | 44 | **44** ← el daño |
| sin inline *(después)* | 44 | **36** ✅ |

A 390 px **no cambia nada**: la base ya lo daba. El rótulo de `:83` sigue con su marcador — este
ticket es de layout, no de copy (regla 30).

## LOS CAMPOS NO ENTRAN, y ahora lo dice el GUARD

El detector persigue **solo botones**. Un `min-height` en línea sobre un `input`, un `select` o un
`label` es **legítimo**, y retirarlo rompe la pantalla: **la base no los cubre**. Medido, no
supuesto — a 390 y a 1280 px un `input.input` computa `min-height: 0` (alto real 38 px), y el
`label` de datasets se queda en lo que diga su estilo.

Va escrito **dentro del guard** porque el riesgo tiene nombre: el siguiente que lea «SCRUM-384
retiró los min-height locales» y haga un barrido por fichero se lleva los de los campos por
delante. Hay un **control que exige que el del label SIGA estando**: si el detector empezara a
perseguirlo, ese control cae.

> **Coherencia sin medición es una excusa para tocar lo que no toca.** Es la lección que ya había
> salvado a `.qq-modal .field input` en la primera mitad de este ticket: iba en la misma lista que
> los botones y **no sobraba**.

## 🔴 Lo que queda fuera, y dónde vive

`jobDetailView.js:1186`, `:1166` y `:1271` tienen el mismo defecto y **NO se tocan**: fichero
vetado (rama parada de C5). Anotado en **SCRUM-380**, que ya cubre los botones de esa pantalla.

Ficheros: `public/dashboard/css/styles.css` (el bloque `.qq-modal`) ·
`public/dashboard/js/reportsView.js` y `public/dashboard/js/exportView.js` (los inline retirados) ·
`tests/scrum384-min-height-locales.test.mjs` (9, nuevo).
