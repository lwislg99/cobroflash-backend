# SCRUM-341 · la condición del precio sube a la landing, copiada del texto vinculante

**Fecha:** 5-ago-2026 · **Carril:** B (superficie pública / consistencia legal) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `64b42807353c8336107a245234cf77af2a0dc846` · 2026-08-05T04:41:18+01:00

## El problema (decisión ya tomada en el ticket, no se reabre)
La landing promete la PERMANENCIA del precio founding —«9,90 €/mes **para siempre** / **de por vida**»—
pero la condición vinculante vivía DESPUÉS del checkout, donde el visitante no la lee antes de decidir.
Texto vinculante: **ALCANCE_BETA.md:38** — «9,90 €/mes DE POR VIDA … **mientras mantengas la suscripción
activa**» (se acepta antes del checkout founding, regla 25). Decisión: la condición SUBE a la superficie
de la promesa, COPIADA del documento. No se redacta microcopy nueva.

## Medición (derivada, confirmada por contenido — no se repite SCRUM-327 por fe)
Censo de promesas de permanencia del precio (marcador `para siempre|de por vida` co-localizado con
`9,90`, lo que excluye falsos positivos como el «para siempre» de los build-ids). **5 sitios, ninguno
con la condición:**
- `public/index.html:297` (barra de anuncio) · `public/index.html:480` (banner fundadores)
- `public/precios.html:65` (página de precios)
- `public/dashboard/js/plansView.js:76` (plan activo) · `:105` (oferta de alta founding)

Los tres primeros son la superficie del visitante; el panel se incluye porque ofrece el alta founding a
un usuario que va a decidir (lo que SCRUM-327 midió como «el precio aparece en el panel»).

## El arreglo (verbatim, sin mejorar ni acortar)
Se añade la condición **«mientras mantengas la suscripción activa»** —copiada del documento, palabra por
palabra— junto a cada promesa. Texto plano que HEREDA el estilo del elemento (fuera del `<b>`, para que
lea como cualificador, no como titular): ni tokens, ni colores, ni estilos inline nuevos (DESIGN.md /
Parte AB). No se toca «para siempre»/«de por vida» ni el resto del copy de la oferta: la promesa se
CONDICIONA, no se reescribe. La condición queda visible también en móvil (fuera de `.hide-sm`).

## 🔴 El guard — acopla las DOS fuentes, no puede divergir en silencio
`tests/scrum341-condicion-precio-publicada.test.mjs`:
- **Fuente A (vinculante):** la condición se EXTRAE de `ALCANCE_BETA.md` (regex sobre el documento), NO
  se escribe a mano en el test — eso sería la enésima lista sin guard.
- **Fuente B (publicada):** el censo recorre los sitios y, por CADA promesa de precio, exige la condición
  en su ventana.
- **SUELO doble:** si no se extrae la condición del documento → falla; si el censo no ve NINGUNA promesa
  (≥3 esperadas) → falla, nunca «ninguna».
- **Divergencia (teeth):** si el documento reformula su condición y la landing no, el guard cae — probado
  en memoria (condición reformulada → las 5 promesas dejan de contenerla) SIN tocar el documento real.
- **Rojo por el mecanismo sobre el defecto REAL (sin inyectar):** corrido contra la landing de hoy, lista
  las 5 promesas sin condición y falla. Verde tras el arreglo.
- **Dos caras + control negativo:** promesa+condición pasa; promesa sin condición se marca; «para siempre»
  SIN precio (build-ids/avisos) NO es promesa de precio → no se marca.

## Lo NO tocado
El **precio** (9,90/19,90 intactos) · el **cierre en la plaza 20** (`subscriptions.routes.ts:79`, 409
`founding_sold_out`, funciona) · el **resto del copy** de la oferta · el **contador** (SCRUM-340, decisión
propia) · `prisma/schema.prisma` · el camino de emisión.

## Premium-UI (AB6)
Cambio de un solo concepto (la condición del precio), texto plano que hereda tokens existentes, vanilla,
sin componente ni color nuevo. Antes/después: cada promesa gana «, mientras mantengas la suscripción
activa» tras el importe. La **matriz de dispositivos (V0-5) es humana y del fundador**; la condición se
deja visible en móvil (no va en `.hide-sm`).

## Ficheros
- `public/index.html` (:297, :480) · `public/precios.html` (:65) · `public/dashboard/js/plansView.js` (:76, :105).
- `tests/scrum341-condicion-precio-publicada.test.mjs` — el guard derivado (SUELO, divergencia, dos caras, control negativo).

**Suite: antes 1371 · 1304 pass · 0 fail · 67 skip → después 1374 · 1307 pass · 0 fail · 67 skip** (+3 tests, +3 pass).
