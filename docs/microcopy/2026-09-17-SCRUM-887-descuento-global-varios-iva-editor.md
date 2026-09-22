# Aviso al guardar un presupuesto con descuento global y varios tipos de IVA

Aprobado por el orquestador por delegación del fundador · SCRUM-887 comentario 15697

**Aplicado en el mismo acto** (regla 30). Firmado el 17-sep-2026.

## Texto aprobado, literal

> Un descuento global no se puede aplicar a un presupuesto con varios tipos de IVA. Quítalo o pon el descuento en cada línea.

## Dónde se pinta

- **Editor del presupuesto:** `public/dashboard/js/quotesView.js`, con `setAlert("error", …)` al pulsar guardar. El texto vive en `public/dashboard/js/quoteDescuentos.js` (`TEXTO_DESCUENTO_GLOBAL_VARIOS_IVA`).
- **400 `descuento_global_con_varios_iva` de `POST /quote/create`**, campo `message`. Sale de `src/modules/quotes/domain/descuentoGlobalConVariosIva.ts` (`COPY_CREAR_CON_DESCUENTO_GLOBAL_VARIOS_IVA`).

Las dos copias son idénticas byte a byte, y lo comprueba `tests/scrum887c-caso-c-bloqueado.test.mjs`.

## Qué cambió

Antes se podía guardar un descuento global en un presupuesto con varios tipos de IVA, y al
facturarlo el cliente pagaba más de lo que firmó (C3: firma 539,05 €, cobro 628,60 €). Ahora no se
guarda hasta que la asesoría fije cómo repartir el descuento entre tipos.
