# Mientras un albarán se convierte en factura

Aprobado por el orquestador por delegación del fundador · SCRUM-905 comentario 15696

Firmado el 17-sep-2026 (13:45 CEST); confirmado solo este texto a las 14:12 CEST. **Aplicado en el
mismo acto** (regla 30).

## Texto aprobado, literal

> Convirtiendo…

## Dónde se pinta

`public/dashboard/js/albaranDetailView.js` — constante `ESTADO_CONVIRTIENDO`, en la franja de estado
del detalle del albarán (`.alb-status alert info`) desde que se pulsa convertir en factura hasta que
responde el servidor.

No es un texto nuevo en el producto: es el mismo que ya enseña el botón de la IA de líneas del parte.

## Qué cambió

Antes la franja pintaba el marcador «[PENDIENTE microcopy oficial]» mientras convertía.

## Qué queda sin firmar en esa pantalla

El rótulo del propio botón de convertir en factura. Está bloqueado por la pregunta al asesor sobre
el presupuesto adicional (sección G de las preguntas al asesor) y no lo levanta la delegación de
microcopy: hasta que responda, en demo y en fiscal ese botón sigue con el marcador. En modo
justificante ya no se ofrece.
