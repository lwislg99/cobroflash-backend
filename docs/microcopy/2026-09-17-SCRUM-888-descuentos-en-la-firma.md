# Filas de descuento en la página de firma del cliente

Aprobado por el orquestador por delegación del fundador · SCRUM-888 comentario 15788

**Aplicado en el mismo acto** (regla 30). Firmado el 17-sep-2026. No son textos nuevos: son los rótulos
del pie del PDF del presupuesto, aprobados en SCRUM-594, pintados sin los dos puntos para seguir el
estilo de la página.

## Texto aprobado, literal

> Suma de líneas

> Descuento

> Descuento global

El IVA conserva el rótulo que la página ya enseñaba, «IVA (21%)» (con el tipo que toque), y «Base
imponible» no cambia.

## Dónde se pinta

`src/modules/system/app/routes/quoteDecisionLanding.routes.ts`, `renderQuoteDetail`, bloque de
totales (`.totals-block`) de la página que abre el cliente para firmar (`/pay/quote/:token`). Salen
SOLO si el presupuesto lleva algún descuento. Los rótulos vienen de `pieDePresupuesto`
(`presentacionIva.ts`), y la página les quita los dos puntos.

Sin descuentos, la página sale byte a byte igual que antes.

## Qué cambió

Antes la página pintaba la base y el IVA de las líneas sin descuentos, debajo de un total que sí los
llevaba (C3-B: firma 559,70 € y la página sumaba 652,78 €). Ahora las filas salen de la misma cuenta
que el pie del PDF, y base + IVA suman el total firmado.

## Hueco declarado

La página sigue siempre en el modo «sumar». El modo «IVA no incluido» del presupuesto no se refleja
aquí; queda fuera de este cambio (condición (c) de la firma).
