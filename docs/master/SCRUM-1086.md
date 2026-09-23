# SCRUM-1086 · Lote único de literales de la web que prometen cobro

**Fecha:** 22-sep-2026 · **Carril:** J4 (legal y cumplimiento) · **Gate:** ninguno — solo propone
**Medido contra:** `origin/main` = `763d37e5225ea4897827b1a997e34cf5e117c5c3` · 2026-09-22T22:38:42Z

## Encargo

Javier va a firmar una vez, no seis: J4 reúne en `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md`
todos los textos de la web que siguen prometiendo cobro por YaQu (falso desde la regla 24,
`INVOICING_ES_ENABLED` OFF para España, SCRUM-612) en un solo documento listo para firmar.

## PASO 0 (medido, no asumido)

- Las **13 líneas** de `scrum-1016c-literales-verdad-hoy` (PR #1653, mergeado) se revalidaron
  letra por letra contra `origin/main` de hoy: mismo fichero, misma línea, mismo texto en las 13.
  No se redactan de nuevo, se traen tal cual.
- El **demo interactivo de `#probar`** (`public/index.html:523-601`) — hallazgo de J3, sin
  propuesta previa — se describe y se dan 3 opciones con pro/contra. No se propone un literal
  porque el propio encargo pide una decisión de Javier, no una redacción.
- Se midieron **3 literales nuevos** no cubiertos por SCRUM-1016c: el toast `✓ Cobrado · 961,95 €`
  de la animación del hero (`index.html:466`, un elemento DISTINTO del `beat-label` que ya cubría
  el ítem 5 de la tabla A), la tarjeta de precios propia de `index.html` (`:747-748`, paralela pero
  distinta de la de `precios.html`) y la respuesta del FAQ sobre "dos botones — Firmar y Pagar"
  (`index.html:760`, la 2ª de las 4 preguntas — la tabla A solo cubría la 1ª y la 3ª, saltándose
  ésta).
- La **categoría de la Parte H2** del máster (`docs/YAQU_MASTER.md:215`) se verificó contra el
  guion H2 recién aplicado (mismo comentario 16432 de hoy): el guion dice "no cobramos por la
  app — la señal la gestionas tú por fuera", pero la categoría de la Etapa 1, tres frases antes,
  sigue diciendo "...cobrar señales por WhatsApp". Contradicción confirmada dentro de la misma
  línea del máster, no supuesta.

## Qué se hizo

- Nuevo fichero `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md` con las cuatro secciones (A-D)
  descritas arriba.
- **No se aplica nada** a `public/index.html`, `public/precios.html` ni `docs/YAQU_MASTER.md`:
  todo es propuesta a la espera de la firma de Javier. La sección D, además, lo marca aparte como
  cambio de máster (regla 35): ni siquiera con la firma la aplica esta sesión.

## Control al cerrar

- No se tocó ningún fichero de `public/` ni `docs/YAQU_MASTER.md` — `git diff --stat` de esta rama
  solo toca `docs/legal/` y `docs/master/`.
- El STOP de siempre en J4: copy fiscal/de producto, propone y para — no envía ni aplica.

## Corrección post-CI (rojo obligatorio, misma rama)

El PR entró en rojo en «build + tests (con banco desechable)» (run 35793619444) por dos guards de
`docs/legal/` que la entrega original no satisfacía — ninguno pide relajar el guard (regla 41):

- **SCRUM-525d (trinquete de anclas con testigo):** la cita `docs/YAQU_MASTER.md:215` de la
  sección D no llevaba testigo escrito. Se le añadió el testigo `` (`cobrar señales por WhatsApp`) ``
  — literal que sí está en esa línea — sin cambiar la afirmación.
- **SCRUM-547 (documento «para aprobar» sin enlazar):** el nombre del fichero nuevo contiene
  "PENDIENTES", así que el censo lo cuenta como a la espera de aprobación; no estaba enlazado desde
  ninguna puerta. Se añadió una entrada en `docs/PENDIENTES_FUNDADOR.md` (sección "✍️ Aprobar
  textos") que dice qué decidir y cómo contestar.

El fallo de «meta-guard · los guards caen cuando deben» del mismo run era consecuencia del segundo
punto: la pasada limpia de control ya caía por SCRUM-547 antes de mutar nada, así que el meta-guard
no podía medir la mutación. Se resuelve solo al arreglar la causa.

---

# SCRUM-1086d · El bloque D aplicado al máster (categoría de la Parte H2)

**Medido contra:** `origin/main` = `976fa30ef7330c516ea2c4bf505aeda66a15d1d8` · 2026-09-23T08:32:33Z
**Aplica:** el orquestador del equipo de Javier (A13), con la firma de Javier del 23-sep-2026
(SCRUM-1086, comentario 16576).

## Qué se cambia, y por qué no lo aplicó J4

El bloque D del lote (`docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md`) es el único que **no vive en
`public/`**: es una línea de `docs/YAQU_MASTER.md`. Por la regla 35 el máster no se toca sin la
firma de Javier, y por la regla de puesto J4 propone pero no aplica. Los bloques A, C y B (opción 3)
los aplica J3 en `public/`; éste lo aplico yo.

## El cambio, literal

`docs/YAQU_MASTER.md:215`, Parte H2 («Mensaje en dos etapas»), Etapa 1 (pre-SIF):

| | texto |
|---|---|
| **antes** | `categoría = "herramienta para presupuestar, firmar y cobrar señales por WhatsApp"` |
| **después** | `categoría = "herramienta para presupuestar y firmar por WhatsApp"` |

Se retira «y cobrar señales» **sin sustituto**: hoy no hay ninguna función de cobro que sea verdad
para un merchant español, así que no hay nada que poner en su lugar.

## Por qué era falso: se contradecía consigo mismo en la misma línea

La línea 215 lleva, tres frases después de esa categoría, el guion único ante «¿me vale para
VeriFactu?» —reescrito y firmado el 22-sep (SCRUM-534, comentario 16404)— que dice literalmente:

> *«…en España la beta es de presupuestos y firma: **no emitimos ningún documento de facturación ni
> cobramos por la app** — la señal la gestionas tú por fuera.»*

La categoría de la propia Etapa 1 prometía justo lo que el guion de al lado negaba. Es la misma
familia de contradicción que motivó la reescritura del guion (regla 24 / SCRUM-612), sin resolver
en esta línea concreta hasta hoy.

## Controles de la aplicación, ejecutados y no supuestos

El cambio se aplicó con un script que **aborta** si cualquiera de estos controles no se cumple
(`scratchpad/aplicar-1086d.mjs`), no con una edición a mano:

| control | resultado |
|---|---|
| apariciones del texto viejo antes de tocar (se exige exactamente 1) | **1** |
| líneas del fichero antes → después | **1887 → 1887** |
| líneas que difieren entre antes y después | **1** |
| bytes retirados | **17** |
| el guion H2 de la misma línea sigue entero | **sí** |
| ocurrencias de «cobrar señales» que quedan en todo el máster | **0** |

## Lo que NO se ha tocado

- **Nada de `public/`** — los bloques A, C y B son de J3, en su propia rama.
- **Ninguna otra línea del máster.** No se aprovechó el viaje para corregir nada más: un cambio de
  máster lleva una firma, y esta firma cubre esta línea.
- **Ningún estado, flag ni transición** (reglas 27 y 30).
