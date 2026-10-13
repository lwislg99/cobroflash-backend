# Las páginas que ve el cliente final al aceptar un presupuesto y al firmar un parte

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1302 comentario 19428.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

A · la insignia de la opción que el profesional marcó, en un presupuesto con varias opciones:

> Recomendada

B · bajo la firma, cuando la petición no vuelve y no se sabe si llegó. En el presupuesto y en el parte:

> No hemos podido confirmar que tu firma haya llegado. Comprueba tu conexión y vuelve a intentarlo.

C · bajo la firma, cuando el servidor contesta un error que no trae texto. En el presupuesto y, desde
SCRUM-1302 comentario 19454, también en el parte:

> No se ha podido firmar. Inténtalo de nuevo.

## Dónde se pinta

- A: `src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, `renderTierCards`, sólo en la
  tarjeta cuya opción lleva `recommended`.
- B: el `catch` de la petición de firma de `quoteDecisionLanding.routes.ts` y el de
  `src/modules/jobs/app/routes/albaranPublic.routes.ts`.
- C: el texto de reserva de `quoteDecisionLanding.routes.ts`, detrás de `data.message` y `data.error`,
  y el de `albaranPublic.routes.ts`, detrás de `d.message`.

## Qué cambió, y por qué

- A sustituye a «⭐ Más popular». El código no mide popularidad: lo único que hay es que el
  profesional marcó esa opción, y «Recomendada» dice eso y nada más.
- B sustituye a «Error de conexión.» en las dos páginas. Dice lo que le pasa a quien firma: no
  sabemos si su firma llegó.
- C sustituye a «Error al procesar.», que no decía qué no se procesó.
- **Retirado, sin texto nuevo (decisión del mismo comentario):** «Recibirás tu copia por WhatsApp.»
  en las dos pantallas del parte firmado. Se queda «Gracias, {nombre}.». El envío de la copia es de
  mejor esfuerzo y lo corta un tope diario que la página no ve, así que la promesa se incumplía
  algunas veces sin que nadie se enterase.

## La condición con la que se firmó B, y cómo quedó

B aconseja reintentar, así que se firmó a condición de medir antes qué pasa al reintentar cuando la
primera firma sí llegó. Medido corriendo las rutas de verdad, y confirmado por el orquestador antes
de construir:

- Parte: el segundo intento contesta 200 con `already`, no escribe, no rehace el PDF y no pide otra
  copia; quedan el trazo, el nombre, el sello y la fecha de la primera. Lo sujeta
  `tests/scrum1302d-textos-de-la-pagina-de-firma.test.mjs`.
- Presupuesto: 200 `already_accepted` sin escribir. Lo sujeta `tests/scrum1276-decision-no-reabre.test.mjs`.

## Lo que queda sin firmar en estas páginas

- Nada del texto de reserva: el del parte era «No se pudo firmar. Inténtalo de nuevo.», parecido a C
  y no igual, y el comentario 19428 nombraba C sólo para el presupuesto. El comentario 19454 lo pasa
  al mismo literal, y el parte lo pinta desde la rama 1302e.
- El final de C es «Inténtalo de nuevo.». El comentario 19454 lo cambió a «otra vez» y el orquestador
  lo anuló el mismo día (SCRUM-1215 comentario 19460): «de nuevo» es la forma de la casa, medida.
- «Elegir este plan» y «IVA incluido» de las tarjetas de opción, y el aviso del enlace de una revisión
  antigua: no entran en esta firma.
