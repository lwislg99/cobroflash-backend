# La página pública del presupuesto: los tres títulos de la pestaña

**Aprobado por el orquestador por delegación del fundador** el 6-oct-2026 — SCRUM-1476 comentario 18404.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Textos aprobados, literales

El título de la pestaña cuando el presupuesto ya no se puede firmar. Una frase entera por país:

| País | Caducado | Ya aceptado | Rechazado |
|---|---|---|---|
| ES, AR | Presupuesto caducado | Presupuesto ya aceptado | Presupuesto rechazado |
| MX, CO, PE, CL | Cotización caducada | Cotización ya aceptada | Cotización rechazada |

## Dónde se pintan

`src/core/i18n/locales.ts`, campos `quoteExpiredTitle`, `quoteAcceptedTitle` y `quoteRejectedTitle`.
Los lee `src/modules/system/app/routes/quoteDecisionLanding.routes.ts` como título (`<title>`) de la
página que ve el cliente final en `GET /pay/quote/:token/accept` cuando el presupuesto está
caducado, aceptado o rechazado.

## Qué cambió y por qué

Antes el título se componía con la palabra del documento más un participio fijo en femenino, y en
España se leía «Presupuesto caducada», «Presupuesto ya aceptada» y «Presupuesto rechazada». En los
países que dicen «Cotización» el texto queda como estaba.

No se compone con otra terminación: la palabra del documento cambia de género por país, y la regla
de SCRUM-1443 es que ningún participio ni pronombre concuerde con ella. Cada país escribe su frase.

## Lo que no cubre

Las demás frases de esa página que concuerdan con el documento («este presupuesto», «pide uno
actualizado»…). En España se leen bien; están nombradas en el ticket y no llevan firma.
