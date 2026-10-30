# SCRUM-1640 · Facturas: el marcado en bloque cuando se marcan cero (punto ①)

**Medido contra:** `origin/main` = `3527028a3388de64c5e2429cb0d19d665e768473` · 2026-10-30T17:39:38Z (cabecera `Date` de GitHub)

A9: comprobación → `tests/scrum1640-lote-marca-cero.test.mjs`

Lo escribe J1 (`jv-j1dq`). Sólo el punto ①; el ② va a SCRUM-1523 y el ③ sigue sin decidir (c.21292). Textos firmados en SCRUM-1640 comentario 21292; ficha en `docs/microcopy/2026-10-30-SCRUM-1640-lote-marca-cero.md`.

## Qué pasaba, medido

Con el banco de vistas (`tests/_banco-vistas.mjs`), POST y recarga por su `fetch`, y el botón del lote pulsado de verdad, antes del arreglo:

| lote | recarga | la pantalla decía | ahora |
|---|---|---|---|
| 0 | bien | `✓ 0 facturas marcadas como pagadas.`, en verde | primer literal de la ficha, `warning` |
| 0 | cae | lo mismo, en verde | segundo literal de la ficha, `warning` |
| 2 | cae | `✓ 2 facturas marcadas como pagadas.`, en verde | tercer literal de la ficha, `warning` |
| 2 | bien | `✓ 2 facturas…` | igual |

**El ticket describía otra cosa.** SCRUM-1215l ejecutó la función pura y vio el aviso de la recarga con 0 marcadas. En pantalla ese aviso no salía nunca: `reload()` capturaba su propio error y no lo devolvía, así que `recargaOk` no llegaba a ser `false` por un fallo de red. La frase que se veía con cero era el `✓ 0`, y el aviso firmado de la recarga era código al que la pantalla no llegaba.

## Qué se ha cambiado

- `resultadoMarcadoEnBloque`: con `marcadas === 0` y la escritura bien, sale el literal según la recarga, tono `warning` y `seMarcaron: false`. El comentario de los tres tonos ya no dice que `warning` sea «sí se marcó».
- `reload()` devuelve `true` o `false`, y el lote mira lo que devuelve. **No lo pedía el encargo**: sin esto, el segundo literal firmado no se ve nunca. No añade texto. Con el fallo, `reload()` pinta su error y el aviso del lote lo sustituye, como ya hacía el `✓`.
- `recargaFallida` pierde su marca y cita la firma. Sale de «ambiguos» y «acusadas» del censo 1157 y pasa a «retiradas»: 34 → 33 acusadas. Fila nueva en `tests/_pares-leidos-en-jira.mjs` (carril J6), la que pide `_respaldo-de-firma.mjs` para el par citado.

## Comprobado

- Rojo primero: 5 de 8 casos en rojo sobre el código viejo (los 3 que pasaban son los controles de «no cambia»), y el noveno, el de la lista vacía, en rojo sobre mi primer arreglo. Base 9 en verde.
- Mutaciones: 6 de 6 caen con `aplicarUna`, sobre `MUTACIONES_QUE_ME_TUMBAN`.

## Lo que falló

Mi primer `return true` dejó fuera la salida temprana de `reload()` con la lista vacía: devolvía `undefined`, y al marcarlas todas en «Pendientes» la pantalla habría dicho que la lista no se pudo actualizar. Lo vi barriendo los `return` antes de cerrar, con el test nuevo ya en verde; ahora lo ata su propio caso y su mutación. El test de la función pura no lo habría visto.

## Lo que no se ha medido

- El color del aviso y cómo lo anuncia un lector de pantalla.
- yaqu.app: la carrera pide dos pestañas y una cuenta con facturas; no lo he intentado.
- Suite entera local: NO CORRIDA, por orden del encargo.
