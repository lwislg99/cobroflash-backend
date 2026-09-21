# SCRUM-987 · «Válido hasta» en el PDF del presupuesto: un literal, el mismo que lee el cliente

**Aprobado por el orquestador por delegación del fundador** el 21-sep-2026 — SCRUM-915 comentario 16165.

## El literal, tal cual se escribe

> Válido hasta el {fecha larga}

`{fecha larga}` no es un literal: es la fecha de validez del presupuesto escrita con día de dos cifras,
mes en letra y año, en español y **en la zona horaria del negocio**. Ejemplo: «Válido hasta el 15 de
octubre de 2026».

- **Sin emoji.** La landing donde el cliente decide lo pinta con un ⏳ delante; el ⏳ es de la página,
  no del texto, y las fuentes estándar del PDF no lo dibujan.
- **Sale en el PDF del presupuesto**, en la cabecera, justo debajo de «Presupuesto #N» y con su mismo
  estilo (11 pt, gris, alineado a la derecha).
- **Es la misma frase que ya lee el cliente en la landing** (`quoteDecisionLanding.routes.ts`), que
  desde este ticket la pide al mismo sitio que el PDF: `src/modules/quotes/domain/validez.ts`. Su
  texto NO cambia: sólo deja de escribirse dos veces.

## De dónde sale la fecha

1. La columna `validUntil` del presupuesto.
2. Si la fila no la trae (presupuestos anteriores a A16.2): fecha de creación + 30 días, que es el
   respaldo que ya aplicaba la landing.
3. Si no hay ninguna de las dos, o el dato no es una fecha, **la línea no se pinta**: nunca «Invalid
   Date» en un papel del cliente.

## Lo que este ticket decide, y por eso queda escrito

**Un presupuesto ya firmado sale SIN la línea.** No es un olvido: añadirla no toca ningún hash (el sello
de la firma sella `validUntil` como dato, no los bytes del PDF), pero `GET /admin/quotes/:id/pdf`
regenera el papel y **sobrescribe** el `pdfUrl` de una fila firmada, y el papel de un documento ya
firmado no puede cambiar de aspecto por debajo. Se considera firmado cualquier presupuesto con
`acceptedAt`, `signatureUrl` o `evidenciaFirma`. La validez ya la vio el cliente en la landing donde
firmó.

Alternativa NO elegida: una fecha de corte para que lo firmado a partir de ella sí llevara la línea.
Necesita su propio OK.

## Lo que esta ficha NO firma

- Ningún otro texto del PDF ni de la landing. La factura no se toca.
- El emoji ⏳ de la landing: ya estaba y no cambia.
