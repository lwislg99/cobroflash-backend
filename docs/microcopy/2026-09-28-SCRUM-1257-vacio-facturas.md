# El vacío de Facturas según el modo, y tres rótulos que decían «justificante» — SCRUM-1257

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1257 comentario 17444.

## Textos aprobados, literales

> Aún no se emiten documentos

> Por ahora, YaQu no genera facturas desde tu cuenta.

> Aquí verás tus facturas

> Cuando un cliente acepte un presupuesto, sus facturas aparecerán aquí.

> Complétalos antes de emitir tu primera factura

> 🧾 Ver factura

> Presupuesto firmado + evidencia de aceptación + factura + registro de mensajes, listo para responder al banco

## Dónde se pinta

| # | dónde | cuándo | texto aprobado | qué sustituye |
|---|---|---|---|---|
| P1 | `invoicesView.js`, vacío de Facturas, título | modo `receipt` | «Aún no se emiten documentos» | «Aquí verás tus cobros» |
| P2 | `invoicesView.js`, vacío de Facturas, cuerpo | modo `receipt` | «Por ahora, YaQu no genera facturas desde tu cuenta.» | «Cuando un cliente acepte un presupuesto, el documento de cobro se genera solo y aparece aquí.» |
| P3 | `invoicesView.js`, vacío de Facturas, título | fiscal y demo | «Aquí verás tus facturas» | «Aquí verás tus cobros» |
| P4 | `invoicesView.js`, vacío de Facturas, cuerpo | fiscal y demo | «Cuando un cliente acepte un presupuesto, sus facturas aparecerán aquí.» | el mismo cuerpo de P2 |
| P5 | `settingsView.js`, fila «Datos fiscales» cuando faltan | fiscal y demo (en `receipt` la tarjeta no se ve) | «Complétalos antes de emitir tu primera factura» | «Sin ellos, el documento tras el pago es un justificante de cobro» |
| P6 | `quotesDetailView.js`, botón del presupuesto cobrado | el documento cobrado es de tipo factura | «🧾 Ver factura» | «🧾 Ver justificante» |
| P7 | `invoiceDetailView.js`, tooltip de «Ver la reclamación del banco» | el documento no es un `J-` | «Presupuesto firmado + evidencia de aceptación + factura + registro de mensajes, listo para responder al banco» | el mismo, con «justificante» en lugar de «factura» |

P1 ya estaba firmado como título de Ajustes en SCRUM-1220 (comentario 17385). Aquí se reutiliza en otra
ranura, no es texto nuevo. P2 es el detalle firmado allí, sin «ni justificantes».

## Por qué

El vacío le prometía a todos que el documento «se genera solo». En `receipt` (España, con
`INVOICING_ES_ENABLED` apagado) al aceptar un presupuesto no se emite nada (SCRUM-1027). Cambiar la
palabra no lo arreglaba: «la factura se genera sola» sería igual de falso y además un claim fiscal
(regla 7). Ahora el vacío mira `window.appModoEmision`, y en `receipt` dice lo que pasa.

**P4, la alternativa y no la recomendada:** «su factura se genera sola» solo estaba medido en los dos
planes predefinidos, no en los personalizados. «Aparecerán aquí» es cierto en los tres.

## Lo que NO se firma aquí

- **P8** («Por ahora, YaQu no genera facturas desde tu cuenta.» en `settingsView.js:44`): el texto de
  hoy es cierto. «Ni justificantes» sobrará cuando la figura desaparezca de verdad (SCRUM-825, fase 2).
- **La rama muerta «justificante»** de `rotulosDelDocumento` y compañía (grupo A): se retira borrando la
  rama, no reescribiendo textos (SCRUM-825).
- **Los rótulos de los documentos `J-` antiguos** (grupo D): no se renombran, porque eso sería un claim
  fiscal (regla 7) y reetiquetar un documento emitido (regla 29). Lo decide SCRUM-1252. Por eso P6 y P7
  conservan el texto viejo en su rama `J-`.
