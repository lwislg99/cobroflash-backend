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

# APÉNDICE · 23-sep-2026 · SCRUM-1086b · Bloques A, C y B(opción 3) aplicados a `public/`, J3

**Fecha:** 23-sep-2026 · **Carril:** J3 (alta y crecimiento) · **Gate:** ninguno — literales y demo,
no toca fiscal ni cobro
**Skill UI:** cargada
**Medido contra:** `origin/main` = `54769d968903a53a6a5b0c02bc84662e1f81cedf` · 2026-09-23T08:55:10Z

## Encargo

Javier firmó en SCRUM-1086 (comentario 16576): bloque A (las 13 líneas), bloque C (3 literales
nuevos) y bloque B opción 3 (el demo de `#probar` se corta en la firma). A, C y B los aplica J3 en
`public/`; el bloque D (`docs/YAQU_MASTER.md:215`) lo aplica el orquestador aparte (cambio de
máster, regla 35) y no es parte de esta entrada.

## PASO 0 (medido, no asumido)

El lote de `docs/legal/LITERALES_COBRO_WEB_PENDIENTES.md` se midió contra `origin/main` =
`763d37e5...` (22-sep). Antes de aplicar se comprobó `git log 763d37e5..origin/main --
public/index.html public/precios.html`: **0 commits** — ningún tercero tocó esos dos ficheros desde
entonces, y las 13 líneas de A más los 3 sitios de C se releyeron letra por letra y coincidían
exactamente con el documento. Se aplicó tal cual, sin adaptar nada.

## Qué se hizo

- **Bloque A** (13 líneas, `index.html` y `precios.html`): meta description/og/twitter/JSON-LD sin
  "cobro"/"pago"; el beat-label del hero anima "Firmado. Presupuesto cerrado." en vez de "Cobrado,
  sin perseguir a nadie"; el paso "3 · Cobra" pasa a "3 · Organiza"; FAQ y CTA sin "cobro"; la tarjeta
  de `precios.html` sin la comisión de tarjeta ni el "cobro integrado".
- **Bloque C**: C1 el toast del hero dice "Firmado · 961,95 €" (antes "Cobrado ·", coherente con el
  beat-label de al lado — los dos se tocaron juntos, nunca uno solo); C2 la tarjeta de precios propia
  de `index.html` cambia "Cobro con tarjeta, Bizum y transferencia" por "Recordatorios automáticos de
  firma" y retira su nota de tarifa; C3 el FAQ de "dos botones — Firmar y Pagar" ahora dice que el
  cliente "lo firma con el dedo", sin mencionar pago.
- **Bloque B opción 3**: se retiran los `try-step` `data-s="3"` ("Recibe el enlace de pago") y
  `data-s="4"` ("Paga como quiera"), y las pantallas `data-scr="3"` (recibe enlace), `data-scr="4"`
  (elige método de pago) y `data-scr="5"` (¡Cobrado!). El JS del botón de firmar (`#signBtn`) ya NO
  se relabela a "Firmado — ver cómo paga" ni navega a `data-go="3"` (pantalla retirada): tras dibujar
  la firma, se deshabilita (`disabled=true`) y ahí termina el recorrido — sin inventar copy nueva
  para un "paso 4" que no existe (regla 39). El reset restaura `disabled=false`. `active=Math.min(n,4)`
  pasa a `Math.min(n,2)` (solo 3 pasos ya). Nada de esto tocó CSS, tokens ni componentes nuevos
  (`yaqu-premium-ui`: vanilla, sin estilos inline nuevos).

## Control al cerrar

- `npm run build` limpio; `npm run guards:entrada` 112/112 verde.
- Verificación funcional con Edge headless (`puppeteer-core`, vía `scripts/_navegador.mjs`): tras
  step1→step2→firma quedan exactamente 3 pantallas y 3 pasos en el DOM, el botón de firmar sale
  `disabled`, no queda ningún "Pagar" ni "¡Cobrado!" en el `body`, el pad de firma dibuja, y "Volver a
  empezar" restaura el estado inicial. Script de un solo uso, no se comitea (no es un guard
  permanente del repo, es la comprobación manual de esta entrega).
- `git diff --stat` de esta rama solo toca `public/index.html` y `public/precios.html`.

## Dos hallazgos NUEVOS, reportados y NO aplicados (piden firma aparte)

1. **El párrafo de cabecera de `#probar`** (`index.html:525`) sigue diciendo *"avanza — del
   presupuesto al pago, como lo viven tú y tu cliente"* — inexacto tras la opción 3 (el recorrido ya
   no llega al pago). No está en el lote firmado (el documento solo describía el mecanismo, no este
   párrafo), así que no se toca sin firma explícita: sería copy nuevo sin aprobar (regla 39). Queda
   contradictorio hasta que Javier decida el texto.
2. **El subtítulo del hero espejo** (`index.html:508`, sección `#heroe-f4`, propuesta F6 SIN
   PINTAR — `hidden` + `data-microcopy="PENDIENTE_FUNDADOR"`, cero palabras publicadas) repite la
   misma promesa de cobro que el hero vivo (`:428`). Censo hecho por `git grep` sobre
   `origin/main`: la frase "te paga — con tarjeta, Bizum o transferencia" aparece en EXACTAMENTE
   2 sitios del repo — `:428` (hero vivo, fuera de este lote, depende de V0-6/el titular parado por
   SCRUM-1016j) y `:508` (este, oculto). No se adapta del `:428` sin que Javier lo firme aparte
   (instrucción explícita del orquestador). Como la sección entera está `hidden`, no es una promesa
   VISIBLE hoy — pero el texto vive en el árbol y repite la misma redacción bloqueada.
