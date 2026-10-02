# El estado de facturación en la ficha del albarán

Aprobado por el orquestador por delegación del fundador · SCRUM-1375 comentario 18203

Firmado el 2-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Textos aprobados, literales

| Valor del dato (`estadoFacturacion`) | Texto |
| --- | --- |
| `sin_facturar` | Sin facturar |
| `parcial` | Facturado en parte |
| `facturado` | Facturado |

## Dónde se pintan

`public/dashboard/js/albaranDetailView.js`, `TEXTOS_FACTURACION_ALBARAN`:

- en la fila «Facturación» del detalle del albarán, los tres;
- en la píldora de la cabecera, `parcial` y `facturado`, **con las mismas palabras** que la fila. Un albarán sin
  facturar no lleva píldora de facturación (así era antes y así sigue).

## Por qué «Facturado en parte» y no «Parcial»

Suelto en una fila, «Parcial» no dice parcial de qué. La fila siguiente ya da el detalle («Pendiente de
facturar: N líneas»).

## Lo que no es un texto

Un valor que el código no conozca no se pinta tal cual: la fila pinta la raya «—» y no hay píldora.

## Fuera de esta ficha

La lista de albaranes (`albaranesView.js`) sigue diciendo «sin facturar», «parcial» y «facturado» en sus pestañas
y en la marca de cada fila. No es de este ticket ni está firmado que cambie.
