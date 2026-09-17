# Por qué no ha llegado la firma de «3 opciones», y qué hacer

**Aprobado por el orquestador por delegación del fundador** el 17-sep-2026 — SCRUM-892 comentario 15660.
**Aplicado en el mismo acto** (regla 30).

La delegación es la permanente de `docs/equipo/limites-del-fundador.md`, sección «Delegación
permanente», línea de microcopy. Esta ficha **no** lleva la firma del fundador.

## Texto aprobado, literal

> No nos ha llegado tu firma. Dibújala otra vez en el recuadro o marca «Acepto sin firmar».

## Dónde se pinta

`src/modules/quotes/domain/firmaConTrazo.ts` — constante `COPY_FIRMA_VACIA`. Sale como `message`
del **422 `firma_vacia`** de `POST /quote/:token/decision` (`quotes.routes.ts`), y la página de
aceptación (`quoteDecisionLanding.routes.ts`) lo pinta en rojo bajo el recuadro de firma. Lo lee la
cliente, en los dos modos (un precio y «3 opciones»).

## Qué cambió

Antes no había texto: una firma sin trazo se aceptaba con 200 y se sellaba la evidencia sobre ella.
Firmado sin cambios respecto a la propuesta de la sesión (comentario 15626); la firma comprobó que
el tuteo y el nombre de la casilla coinciden con la página («Acepto sin firmar»).

## Qué queda sin firmar en esa pantalla

Nada de este ticket. La firma del albarán y del parte con un PNG vacío con tamaño queda anotada en
`docs/master/SCRUM-892.md` y no se toca aquí.
