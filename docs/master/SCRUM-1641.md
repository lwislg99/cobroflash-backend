# SCRUM-1641 · La portada deja de afirmar «validez legal» en la tarjeta «Presupuestos y firma»

**Medido contra:** `origin/main` = `fc51ec7a2f11dd93e34141fae48b4357b72d9990` · 2026-11-24T12:17:04Z (cabecera `Date:` de GitHub)
**Skill UI:** `yaqu-premium-ui` cargada ANTES de editar `public/index.html`. El cambio no toca estilos, tokens, clases ni estructura: quita 18 caracteres de texto (« con validez legal»). Por eso no se releyó `DESIGN.md` y el checklist AB6 se reduce a que el párrafo sigue en la misma tarjeta.

Carril J3 (`node scripts/carriles.mjs de public/index.html` → J3). Sesión `jv-j3cy`.

## La decisión

Fundador, SCRUM-1641 c.22605, opción elegida: «Quitar la coletilla (Recomendado)»: «Queda «fírmalos por WhatsApp», sin afirmar nada legal. Es lo más seguro mientras no haya dictamen.»

⚠️ El literal lo copié del encargo del orquestador, NO de Jira: el encargo decía «NO leas Jira». No lo he cotejado byte a byte con el comentario.

## Antes → después (`public/index.html:288`, tarjeta «Presupuestos y firma»)

- Antes: «Créalos en 30 s del catálogo de tu oficio, con IA, y fírmalos por WhatsApp con validez legal.»
- Después: «Créalos en 30 s del catálogo de tu oficio, con IA, y fírmalos por WhatsApp.»

Ni una palabra nueva (regla 39): sólo se quita « con validez legal».

## Dónde más aparece «validez legal» (medido sobre `fc51ec7a`)

- `public/`: sólo esa línea (control positivo: «catálogo de tu oficio, con IA» casa en la misma línea 288).
- `tests/` y `scripts/`: sólo `tests/scrum438-atestiguar.test.mjs`, que la PROHÍBE en el alcance del paquete de evidencias (otro documento). No se toca.
- Ningún test ni script fijaba el párrafo viejo: `scripts/_afirmaciones-publicadas.mjs:241` fija el título de la tarjeta («Presupuestos y firma»), no el párrafo.

## El test

`tests/scrum1641-portada-sin-validez-legal.test.mjs` (4 casos): suelo (la portada se lee y trae la tarjeta), control sembrado (el detector ve «validez legal» en un HTML fabricado y no en un comentario), la portada no la afirma, y el párrafo es EXACTAMENTE el firmado, una sola vez.

No lo añadí a un guard existente: los que leen la copia de la landing (`tests/scrum400-conformidad-landing.test.mjs`, `tests/scrum537-afirmacion-falsa.test.mjs`) son detectores de afirmaciones fiscales y de conformidad con su propia lógica; meter ahí una afirmación sobre la firma era cambiar un detector ajeno a este ticket.

Rojo primero: contra `public/index.html` sin tocar, 4 casos, 2 pasan y 2 caen (los dos que miran el texto). Verde después del cambio.

## La mini-tanda (no la suite entera: el encargo lo prohíbe por contexto)

Población: 38 ficheros — los 29 que nombran `public/index.html` más el nuevo, scrum438, 1415, 1294, 267, 854, 811c, 719, 564, 564b y 568. Primera pasada, antes de este registro: 376 casos, 372 pasan, 4 caen (372 + 4 = 376):

1. `tests/scrum553-etiquetas-pegadas.test.mjs`: mi propio test buscaba la tarjeta con la etiqueta pegada a su `>` y subía el tope de 20 a 21. Arreglado en mi test (busca el título sin la etiqueta); el guard no se toca.
2. `tests/scrum1340` y `tests/scrum854` ②: piden este registro. Caen hasta que existe.
3. `tests/scrum438-v3-sobre.test.mjs` (entró por el comodín `scrum438-*`, no es el scrum438 del encargo): no arranca, `Cannot find module …\cobroflash-backend\node_modules\.prisma\client\index.js`. Es el entorno: este árbol cuelga del `node_modules` compartido y ese cliente no está generado. No lo regenero (A1). No lo toca este cambio, que sólo es HTML y un test que lee HTML.

Segunda pasada, con el registro: RESULTADO_SEGUNDA_PASADA

A9: comprobación → `tests/scrum553-etiquetas-pegadas.test.mjs`
