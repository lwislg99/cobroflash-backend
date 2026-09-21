# La nota del cliente, a la vista en la ficha del Trabajo — SCRUM-982

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-982 comentario 16065.

Un solo rótulo. Se registra **en el mismo acto** en que se aplica al código (regla 30), y la firma es
la del comentario 16065 de SCRUM-982: «Rótulo firmado: «Nota del cliente», como etiqueta pequeña, sin
dos puntos y sin icono. Si el cliente no tiene nota, la línea no aparece.»

## Texto aprobado, literal

> Nota del cliente

## Dónde se pinta

| texto | dónde | qué sustituye |
|---|---|---|
| «Nota del cliente» | etiqueta de la línea de nota del bloque CLIENTE del rail de la ficha del Trabajo: la constante `ROTULO_NOTA_DEL_CLIENTE` de `jobRailBlocks.js`, que `jobDetailView.js` pinta con la clase de las demás etiquetas del rail | nada: `Customer.notes` no salía en ninguna pantalla de trabajo, sólo en la ficha del cliente |

## Qué cambió, y por qué

- **Antes:** la nota del cliente («timbre roto, llamar al móvil, perro suelto») sólo se leía en la
  ficha del cliente. Quien llega a la puerta abre el Trabajo, no la ficha del cliente.
- **Ahora:** el bloque CLIENTE del rail del Trabajo lleva, después del teléfono y del WhatsApp, la
  nota con su rótulo encima y el texto entero debajo, respetando los saltos de línea que escribió el
  profesional. **Sin nota, no hay línea ni rótulo** (regla del hueco de SCRUM-318: nada de «—» ni de
  «Sin nota»).
- **El técnico también la ve**, porque es quien llega a la puerta (decisión del orquestador en el mismo
  comentario).

## Lo que esta ficha NO firma

- Ningún texto para el caso «sin nota»: **no se dice nada**. Un «Nota del cliente: —» ocuparía sitio
  para decir que no sabe.
- Ningún «ver más» ni recorte para una nota larga: se lee **entera**, y por eso no hace falta. Si al
  medirla se hubiera descompuesto el rail, se habría avisado antes de inventar un texto nuevo. No se
  descompone (`docs/master/evidencias/scrum982/salida-navegador-21sep.txt`).
