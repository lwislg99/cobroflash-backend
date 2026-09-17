# Rechazo al facturar o revisar un presupuesto con descuento global y varios tipos de IVA

Aprobado por el orquestador por delegación del fundador · SCRUM-887 comentario 15698

**Aplicado en el mismo acto** (regla 30). Firmado el 17-sep-2026, tras comprobar que en un presupuesto
aceptado el profesional no puede quitar el descuento global: un firmado no se edita y su revisión lo
hereda, así que la única salida es «⎘ Duplicar».

## Frases aprobadas, completas

> No se puede facturar: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.

> No se puede crear una revisión: este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.

## Texto aprobado: sus partes fijas, tal cual están en el código

Todo lo que va tras los dos puntos sale de UNA constante (condición de la firma), así que las dos
frases se COMPONEN y no aparecen enteras en el código. Lo que se cruza con el código (guard
SCRUM-514) son sus tres partes fijas:

> No se puede facturar:

> No se puede crear una revisión:

> este presupuesto tiene un descuento global y varios tipos de IVA. Duplícalo, pon el descuento en cada línea y envíaselo al cliente para que lo firme.

## Dónde se pinta

`src/modules/quotes/domain/descuentoGlobalConVariosIva.ts`: `REMEDIO_DESCUENTO_GLOBAL_VARIOS_IVA`, más
los dos prefijos.

- **Primera frase:** campo `message` del 409 `descuento_global_con_varios_iva` al facturar desde el
  panel: `POST /admin/quotes/:id/invoice`, `POST /admin/quotes/:id/invoice-manual` y
  `POST /admin/jobs/:id/collect-rest`.
- **Segunda frase:** campo `message` del 400 `descuento_global_con_varios_iva` de
  `POST /admin/quotes/:id/revisiones`.

El cliente que acepta un presupuesto así no lee ninguna de las dos: lee el copy público ya aprobado
del portón de SCRUM-246 (`COPY_PUBLICO_SIN_LINEAS`, 3-ago-2026).

## Nota

Hoy «Duplicar» pierde el descuento global (D6 de SCRUM-883, punto 3 de SCRUM-888). Aquí no importa,
porque el texto pide poner el descuento en cada línea.
