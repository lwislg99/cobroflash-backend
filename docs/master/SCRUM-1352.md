# SCRUM-1352 · `invalid_id` no se alcanza firmando un parte desde el pad: límite declarado, nada construido

**Medido contra:** `origin/main` = `36071b72e69f04d3b7b39f2942c899f7f27037ae` · 2026-10-01T13:16:02Z
A9: sin fallo que generalice — el ticket nació «leído, no ejecutado» y pedía reproducir antes de arreglar; se reprodujo y no se alcanza

1-oct-2026 · **S4**. El ticket decía: el aviso firmado del parte («…Vuelve a firmar el parte.»,
SCRUM-890 c.15665) promete que repetir sirve, y con `400:invalid_id` repetir da el mismo no.
Es cierto leyendo la lista `RECHAZOS_DEFINITIVOS`. Ejecutándolo, ese código no llega nunca a una
firma hecha desde el pad. **No se toca `parteDetailView.js` ni ningún texto.**

## La medición (yaqu.app, build `425065aa`, cuenta QA, sólo peticiones GET)

Sonda con el service worker bloqueado y todo lo que no es GET cortado (control del interceptor
antes de empezar: un POST de prueba murió en la sonda).

| Qué | Resultado |
| --- | --- |
| Quién contesta `invalid_id` en las dos rutas de firma del parte | sólo `findParte` (`partes.routes.ts`), cuando el id de la URL no es un entero. No hay otro origen en esas dos rutas |
| Ids que dan `400 invalid_id` | `abc`, `1.5`, `9x`, `NaN`, `undefined`, `null` (6 de 14 probados) |
| Ids que NO lo dan | `9`, ` 9`, `9.0`, `1e1`, `0x9` → 200 · `-1`, `0` → 404 `not_found` · `99999999999999999999` → 500 `internal_error` |
| Abrir `#parte-detail/<id>` con `abc`, `1.5`, `9x`, `NaN` | la pantalla pide el parte, recibe el 400 y vuelve a «Trabajos»: 0 botones de firmar, 0 campos. El pad no se puede abrir |
| Control: `#parte-detail/9` | se abre, con «Firmar aquí mismo» y «Firma del técnico» |
| El id que viaja a la cola | el `id` que el servidor devolvió al abrir ese parte: `number`, entero |

El pad sólo se abre sobre un parte que el servidor acaba de entregar, y el parte no tiene apertura
sin red (no hay precarga de partes en `almacenLocal.js`; la hay de albaranes). La cola guarda ese
mismo `id`, y la ruta de subida se arma con él. Un id que el servidor entregó como entero no puede
recibir `invalid_id` del mismo servidor.

## Lo que NO se ha medido

- No se ha mandado ningún POST de firma a producción: lo de arriba sale del GET, que pasa por la
  misma `findParte`, y de leer que las dos rutas de firma no tienen otro `invalid_id`.
- Una entrada de la cola alterada a mano en el almacén del navegador sí lo alcanzaría. No es un
  camino del producto.
- El albarán no se ha medido aquí. Su aviso ya calla con `invalid_id` (SCRUM-1353).

## Cuándo caduca este límite

Si una ruta de firma del parte gana otro origen de `invalid_id`, o si el parte pasa a abrirse sin
red desde una copia local, hay que volver a medir: entonces el aviso podría prometer algo falso.

## Visto de paso, sin tocar

`GET /admin/partes/99999999999999999999` contesta 500 `internal_error` en vez de 404 o 400. Es de
la ruta (otro carril); queda reportado al orquestador.
