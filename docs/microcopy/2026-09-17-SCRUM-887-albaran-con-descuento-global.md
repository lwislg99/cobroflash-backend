# Rechazo al facturar un albarán cuyo presupuesto lleva descuento global

**Aprobado por el orquestador por delegación del fundador** el 17-sep-2026 — SCRUM-887 comentario 15675.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Este albarán no se puede facturar: su presupuesto lleva un descuento global, que no se reparte entre albaranes. Cobra el resto desde el Trabajo.

La frase firmada terminaba en «Factura el presupuesto entero desde el Trabajo», con el encargo de
usar el nombre que la acción de facturar lleva en la pantalla del Trabajo. Esa acción es
«💰 Cobrar el resto» (`public/dashboard/js/jobNextAction.js`), y por eso cierra con «Cobra el resto».

## Dónde se pinta

Vive en UN sitio, `src/modules/jobs/app/routes/albaranes.routes.ts` (`COPY_ALBARAN_CON_DESCUENTO_GLOBAL`).
Viaja en el campo `message` del 409 `albaran_con_descuento_global` de
`POST /admin/albaranes/:id/convertir-en-factura`. La pantalla que lo pinta es de SCRUM-895.

## Qué cambió

Antes, un albarán de un presupuesto con descuento global se facturaba a precio bruto, sin el
descuento que el cliente firmó. Ahora no se factura, y el mensaje dice por qué y qué hacer.
