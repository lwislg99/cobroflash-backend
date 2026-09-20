# El documento de la derecha — SCRUM-915e1

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-915 comentario 15868.

Firmados todos los textos de `docs/prototipos/SCRUM-915/textos-propuestos.md` menos UNO
(«Con su descripción, descuento y suplido.», que **no se construye**). Esta ficha registra los
que entran en código con el corte **915e1 · el documento vivo**, y se crea **en el mismo acto**
en que se aplican (regla 30). Es la ficha hermana de
`2026-09-18-SCRUM-915-pasos-del-editor.md`, que registró los del corte 915d.

## Texto aprobado, literal

El rótulo del documento y su segunda línea:

> Así lo verá el cliente

> Se actualiza mientras escribes

El hueco de la tabla de conceptos, mientras no hay ninguna línea válida:

> Aquí aparecerán los conceptos que añadas.

El pie del documento:

> Presupuesto válido hasta el dd/mm/aaaa.

## Dónde se pinta cada uno

| texto | dónde | qué sustituye |
|---|---|---|
| «Así lo verá el cliente» | `.quote-preview-title`, encima del documento | «Vista previa del documento» |
| «Se actualiza mientras escribes» | `.quote-preview-subtitle`, debajo del rótulo | nada: es nuevo |
| «Aquí aparecerán los conceptos que añadas.» | la única fila de la tabla del documento cuando no hay líneas | «Añade al menos una línea con concepto, cantidad y precio.» |
| «Presupuesto válido hasta el dd/mm/aaaa.» | `.preview-footer`, el pie del papel | «Presupuesto válido durante 30 días salvo indicación en contrario.» |

`dd/mm/aaaa` **no es un literal**: es la fecha del campo «Válido hasta», la misma que se guarda en
`validUntil` y la misma que se enseña en el resumen del paso Condiciones, escrita con la misma
función (`fechaCorta`). La ficha del prototipo lo dice con todas las letras: «sustituye al fijo
“…válido durante 30 días…”».

## Lo que esta ficha NO firma

- **«Nº al generar»**, también firmado en el comentario 15868 para este mismo bloque. No entra
  aquí porque hoy el documento no tiene ningún sitio donde pintar un número, y ponerle uno es
  estructura nueva del documento, no un rótulo: va con el corte que traiga el número
  (915g / 915i, según dónde caiga la fila).
- **«Con su descripción, descuento y suplido.»** — el único texto que el comentario 15868 dejó
  SIN firmar. No se toca y no se construye.

## Por qué el segundo texto no es decoración

«Se actualiza mientras escribes» es una promesa, y una promesa sin mecanismo es un texto que
miente. El mismo corte que la escribe cuelga el repintado del documento de la misma delegación de
eventos que ya refresca los pasos, y `npm run guard:documento-vivo` la comprueba en navegador:
se teclea un concepto y, **sin salir del campo y sin pulsar nada**, tiene que estar en el papel.
