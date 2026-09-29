# Fila del modo de emisión en Ajustes, modo `receipt` — SCRUM-1220

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1220 comentario 17385.

## Texto aprobado, literal

> Aún no se emiten documentos

> Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Aún no se emiten documentos» | `public/dashboard/js/settingsView.js`, `TITULO_MODO_EMISION.receipt` (píldora de la fila del modo, pestaña «Cumplimiento») | «Se emiten justificantes de cobro» |
| «Por ahora, YaQu no genera facturas ni justificantes desde tu cuenta.» | mismo fichero, `DETALLE_MODO_EMISION.receipt` | «Cada cobro genera un justificante para tu cliente, con su propia referencia. No es una factura y no consume tu serie de facturación.» |

## Qué cambió y por qué

La redacción anterior (fundador, 7-ago-2026) prometía un justificante por cobro. Desde SCRUM-1027,
en `receipt` (España real, `INVOICING_ES_ENABLED` en OFF) `allocateInvoiceNumber` lanza
`invoicing_es_disabled` y no sale ningún documento. Medido ejecutándolo en
`tests/banco-scrum1220/medir-ajustes-modo-justificante.mjs` y en `docs/master/SCRUM-1220.md`.

El texto nuevo solo niega: no promete fecha ni cobro, y no nombra VeriFactu, la AEAT ni Hacienda
(regla 26). Sigue el patrón «Aún no…» ya firmado en SCRUM-904.

## Lo que queda sin firmar en esa misma pantalla

Nada de la fila del modo. `fiscal` y `demo` siguen con sus textos del 7-ago-2026, sin tocar. El IBAN
y el Bizum de la pestaña «Cobros» en `receipt` quedan declarados en el ticket como carril de J2.
