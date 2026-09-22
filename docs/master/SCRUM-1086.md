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
