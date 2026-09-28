# Estado final de la demo «Pruébalo tú» de la landing — SCRUM-1130

**Aprobado por el orquestador por delegación del fundador** el 28-sep-2026 — SCRUM-1130 comentario 17403.

## Texto aprobado, literal

> Firmado · Acepto

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Firmado · Acepto» | `public/index.html`, sección `#probar`, `#signOk` (píldora verde con check en la pantalla de firma del móvil), tras «Firmar y aceptar» y cuando acaba el trazo | el botón «Firmar y aceptar» deshabilitado, que antes se quedaba así para siempre |

## Qué cambió y por qué

Antes la demo no terminaba: al firmar solo se dibujaba el trazo y el botón se apagaba. Ahora el paso 3
de la lista se marca como hecho (eso no lleva texto) y en el sitio del botón sale este literal.
«Volver a empezar» no cambia.

Se propuso también la opción A, «Firmado · 961,95 €», y **no se firmó**: ese literal es el fotograma
`paid` (COBRADO) de la animación de cabecera, `index.html:465`, y como final de la firma se leería
como que el dinero ha entrado. En España con la emisión apagada no hay cobro por YaQu (regla 24). La
B es la confirmación de la firma de la cabecera (`sign-ok`, `index.html:463`), que es lo que acaba
de pasar.

## Lo que queda sin firmar en esa misma pantalla

Nada de este cambio. Queda abierta, **y no es una tarea**, la divergencia que anota el comentario
17403: el máster A22 describe la demo con cinco pasos (crear→enviar→firmar→factura→pagar) y hay tres.
Los dos que faltan no se construyen: pondrían una factura y un cobro delante de cualquier visitante.
Lo decide el fundador.
