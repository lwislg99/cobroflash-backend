# SCRUM-974 · «Firmado y sin facturar» en el resumen del lunes

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-974 comentario 16056.

## Los literales, tal cual se pintan

Bloque debajo de «⏳ Pendiente de cobro» en el resumen semanal
(`src/modules/messaging/domain/weeklyDigest.service.ts`, `bloqueFirmadoSinFacturar`):

**T1** · título:

    📝 Firmado y sin facturar

Lleva emoji porque los demás bloques del mismo correo lo llevan («💰 Cobrado», «⏳ Pendiente de cobro»).

**T2** · importe: `{total}` con el formato del resumen (`1.234,56 EUR`), **con IVA**, como la bandeja.

**T3** · detalle, con plurales de verdad:

    1 parte firmado de 1 cliente
    3 partes firmados de 1 cliente
    3 partes firmados de 2 clientes

Importe 0 → el bloque no aparece. Y solo aparece con la facturación encendida para ese negocio
(modo de emisión distinto de `receipt`).

## Qué cambió respecto a la propuesta

- T3 sin «(s)»: plurales reales.
- La condición de la facturación encendida (regla 7), decidida por el orquestador.

## Lo que queda sin firmar

Nada. El hueco que pedía declarar el orquestador —«{n} factura(s) sin cobrar»— **no existe**: ese
detalle ya se escribe con plural real (`factura${n !== 1 ? 's' : ''}`), así que no hay «(s)» en el correo.
