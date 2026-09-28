# SCRUM-1135 · la selección de la lista de Clientes por fin se puede etiquetar

**Medido contra:** `origin/main` = `b7880db80707af65480b90ae00c89a3959cef540` · 2026-09-28T22:51:33Z (J2, equipo de Javier)

## Qué pasaba

`POST /admin/customers/bulk-tags` (SCRUM-1059) existía desde el 22-sep y la sonda AST de SCRUM-1185
(`scripts/_censo-sin-consumir.mjs`) lo daba SIN consumidor. La barra de selección de la lista sólo
contaba: con 50 clientes marcados, el profesional tenía que etiquetarlos de uno en uno.

## La decisión que hacía falta, y quién la tomó

`tests/scrum582-seleccion-multiple-clientes.test.mjs` exigía CERO acciones en la barra: «qué se
ofrece en bloque lo decide el FUNDADOR». No encontré esa decisión escrita (`docs/producto/CRM.md`
es un borrador v0.9 sin firma; CRM-17 va en la Ola 3 «tras su decisión»; SCRUM-1059 sólo hizo el
servidor), así que paré. El fundador contestó «1-Ok, sí» a exactamente dos acciones: **SCRUM-1135
comentario 17449**. Cualquier otra acción en bloque vuelve a necesitar su sí.

El caso del 582 se reescribe con esa decisión delante (regla 41): la barra ofrece EXACTAMENTE
[«Añadir etiqueta», «Quitar etiqueta»]. Queda más apretado que antes: cae con una tercera acción
(mutación: «Exportar» añadido → cae) y cae si se pierde una de las dos (mutación: sin «Quitar» → cae).

## Qué cambia (sólo front)

- `public/dashboard/js/filtroClientes.js`: `TEXTOS_ETIQUETADO` y `resumenDelEtiquetado` (puro).
  Textos firmados en SCRUM-1135 comentario 17447 (registro
  `docs/microcopy/2026-09-28-SCRUM-1135-etiquetar-seleccion.md`). El tope de etiquetas no se escribe:
  vive en `MAXIMO_POR_CLIENTE` del servidor.
- `public/dashboard/js/customersView.js`: campo y dos botones en la barra de selección. Sólo con 1+
  marcados, sólo para el rol `admin` (la ruta es `requireRole('admin')`), deshabilitados con el campo
  vacío. Tras la respuesta se recarga la lista y se avisa con recuentos.
- **No se pinta**: los `resultados[].motivo` del servidor (textos sin firmar) ni el detalle del error
  (medido en `api.js`: sin red es «Failed to fetch», el defecto de SCRUM-1200). Tras un error también
  se recarga: si la respuesta se perdió pero el cambio entró, la tabla enseña lo que quedó.
- `scripts/_sin-consumir-declarados.json`: `bulk-tags` pasa a `retiradas`.
- `tests/scrum698-vistas-que-no-se-miden.test.mjs`: la línea base de Clientes pasa de 78 a 82, con los
  4 nodos identificados.

## Cómo se prueba

`tests/scrum1135-etiquetar-seleccion.test.mjs`, sobre la pantalla real en el banco de vistas: 6/6.
Contra el front de `main` caen 5 (el del técnico pasa trivialmente: allí no hay acciones).
Mutaciones, todas caen: detalle crudo en el error · sin puerta de rol · sin recarga · acciones
siempre visibles · pinta el motivo del servidor · botones activos con el campo vacío.

## Lo que queda fuera

- **yaqu.app: NO VERIFICADO.**
- El exportar la selección (punto 3 de SCRUM-1059) sigue sin decidir y NO entra.
