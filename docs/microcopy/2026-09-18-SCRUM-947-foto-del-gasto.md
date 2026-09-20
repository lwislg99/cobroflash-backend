# SCRUM-947 · el aviso de que la foto del ticket no se ha podido abrir

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-947 comentario 15931.

**Aplicado en el mismo acto** (regla 30). La delegación es la permanente de
`docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy. Esta ficha
**no** lleva la firma del fundador.

## Texto aprobado, literal

> No hemos podido abrir esta foto. Prueba con otra o haz una captura de pantalla del ticket.

## Dónde se pinta

`public/dashboard/js/expensesView.js` — constante `AVISO_FOTO_NO_SE_ABRE`. Sale en la caja de error del
modal del gasto (`#exp-error`, la que ya existía) al pulsar «Añadir gasto» o «Guardar cambios» cuando la
foto elegida NO cabe tal cual en la petición y el navegador no sabe abrirla para reducirla (por ejemplo,
una foto HEIC en un Chrome de escritorio), o cuando ni reducida cabe. El gasto no se manda. Lo lee el
profesional o el técnico, normalmente a 390 px y en obra; el mismo modal se abre desde la ficha del Trabajo.

## Qué cambió

Antes, en ese caso, el panel mandaba la foto igual, el servidor contestaba 413 en HTML y el aviso era
«API 413: Payload Too Large» (medido en el guard `guard:foto-del-gasto` contra `e76580b1`).

La propuesta de la sesión era «No hemos podido leer la foto. Prueba con otra o hazle una captura.» y el
orquestador la firmó con un cambio: «leer» se confundiría con la lectura con IA de SCRUM-912, y «hazle una
captura» no decía de qué. La firma comprobó que no está en `MICROCOPY_BLOQUEADA` ni en `PREGUNTAS_ASESOR`.

## Lo que queda sin firmar en esta pantalla

Nada nuevo: el resto del modal no cambia en SCRUM-947.
