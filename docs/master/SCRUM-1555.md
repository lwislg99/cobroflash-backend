# SCRUM-1555 · El Técnico deja de abrir, aceptar, rechazar y reescribir el presupuesto de otro

**Medido contra:** `origin/main` = `0e8c20aff315bbd19d2d71aa54d94855eb90b816` · 2026-10-14T09:08:19Z
A9: comprobación → `tests/scrum1346-el-tecnico-ve-documentos-ajenos.test.mjs`

Carril S1 · rama `scrum-1555-el-tecnico-solo-lo-suyo`, montada sobre la de SCRUM-1346
(`scrum-1346-el-tecnico-solo-lo-suyo`, PR #2437, abierto al empezar) porque el trinquete vive ahí y
todavía no estaba en `main`. Medición y sitios: los del equipo de Javier (SCRUM-1555 y su c.19622).
Decisión: SCRUM-1346 c.17952, «1-Para los dos» (presupuestos y facturas: autor o asignado); para
Inicio, la tabla «Qué VE el Técnico en Inicio» de la Parte S1 del máster (la decisión de la tarde del
1-oct sustituye a la de la mañana).

## Reproducido antes de tocar nada

Banco desechable propio (Postgres 16 en 127.0.0.1:55555, base `yaqu_1555_test`, esquema por
`migrate diff --from-empty`), `dist/app.js` real y sesión de verdad, con el trinquete de 1346. Con el
código de `main` y `SCRUM1346_SIN_TRINQUETE=1`, Ana (Técnico) sobre los documentos de Blas (Técnico):

| clave | ruta | `main` |
|---|---|---|
| pdf-presupuesto | `GET /admin/quotes/:id/pdf` | 200 con el PDF |
| inicio | `GET /admin/metrics/inicio` | lo enseña en la actividad reciente |
| albaran-buscador | `GET /admin/albaranes/presupuestos` | lo lista |
| notas | `PUT /admin/quotes/:id/notes` | **200: reescribe la nota** |
| aceptar | `POST /admin/quotes/:id/accept` | **200: lo acepta** |
| rechazar | `POST /admin/quotes/:id/reject` | **200: lo rechaza** |
| enviar-whatsapp | `POST /admin/quotes/:id/send-whatsapp` | 400 `customer_missing_phone` |
| enviar-correo | `POST /admin/quotes/:id/send-email` | 400 «falta correo» |

Las de escritura se reprodujeron por el código de respuesta: `acceptQuoteAdmin` y `rejectQuoteAdmin`
devuelven la fila ya escrita. La fila no se releyó por otra vía: el banco borra sus datos al acabar.

## El arreglo: las dos puertas que ya existían

- Las seis rutas por id (`quotesAdmin.routes.ts`): `puedeVerElPresupuesto(quienPideDe(req), id)`, el
  mismo gesto que la ficha. El ajeno recibe **el 404 que cada ruta ya daba al que no existe**, con su
  forma (`{ error: 'not_found' }` o `{ ok: false, error: 'not_found' }`). Ningún texto nuevo.
- `PUT /:id/notes`, además: con 0 filas contestaba `ok: true`. Ahora 404, como `/tags`. Si no, el
  inexistente (200) y el ajeno (404) volverían a distinguirse.
- Inicio (`metrics.routes.ts` → `getInicioOperario`): la actividad reciente lleva el recorte de
  `wherePresupuestosVisibles`. **Los recuentos de los globos NO** (no son documentos y la decisión
  no los nombra; c.19622 lo deja sin decidir a propósito). El comentario del servicio decía que el
  Técnico ve la actividad de sus compañeros: era la decisión de la mañana, ya sustituida; corregido.
- El buscador del albarán (`albaranes.routes.ts`): `listQuotesAdmin` con su 7.º parámetro, el recorte.

**Ni esquema ni camino de emisión.** Ninguna de las ocho rutas emite: `POST /:id/invoice` y
`/invoice-manual` no se tocan, y la puerta va antes de cualquier lectura o escritura de la ruta.

## El 400 frente al 404, aparte

`send-whatsapp` y `send-email` no dejaban ver el documento, pero contestaban **400 «falta teléfono» /
«falta correo»** al ajeno y **404** al que no existe. Distinguir las dos respuestas basta para saber
qué ids existen en el negocio, aunque no se pueda abrir ninguno. Ahora las dos dan el mismo 404.

## Verificado, ejecutando

| caso del trinquete | `main` | con el arreglo |
|---|---|---|
| ① las ocho, con la lista LLENA | 8 VE, verde | **8 NO-VE: cae** (el control de que se cerraron las ocho) |
| ① con la lista VACÍA | — | verde |
| ② el Técnico sigue con lo suyo | verde | verde |
| ③ la admin lo ve todo | verde | verde |
| ④ el Técnico acepta y rechaza lo SUYO | verde | verde |

`FUGAS_CONOCIDAS` queda vacía.

**NO medido:** en yaqu.app (haría falta una cuenta de Técnico en la cuenta QA).
