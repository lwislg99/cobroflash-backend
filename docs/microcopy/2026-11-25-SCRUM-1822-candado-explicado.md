# El parte: el candado se explica con la frase del servidor, y el borrador lleva «Editar» arriba

Dos firmas, las dos del 25-nov-2026 y las dos por la delegación general (SCRUM-1656, comentario 21978):

**Aprobado por el orquestador por delegación del fundador** el 25-nov-2026 — SCRUM-1656 comentario 22754 (el motivo del servidor, pintado tal cual).

**Aprobado por el orquestador por delegación del fundador** el 25-nov-2026 — SCRUM-1656 comentario 22758 («Editar» en la cabecera del borrador).

**Aplicado en el mismo acto** (regla 30). Ticket: SCRUM-1822, tramo ⓐ.

## Textos aprobados, literales

En un parte que NO se puede editar, la cabecera pinta el motivo que manda el servidor
(`puedeEditarContenido.motivo`). Hoy el servidor dice, de un parte firmado o facturado:

> el parte está firmado: su contenido es lo que el cliente firmó y no se puede cambiar

Empieza en minúscula y no lleva punto final: así lo manda el servidor y así se pinta. La firma es de
**pintarlo byte a byte**, no de esta frase en particular: la vista no la lleva escrita, y si el dominio
la cambia, la pantalla pinta la nueva sin tocar el front. Cualquier frase añadida por la pantalla
necesita su propia firma (lo dice el comentario 22754).

En un parte en borrador, el botón de la cabecera:

> Editar

Es la palabra que el fundador firmó para la ficha del cliente (SCRUM-1145 comentario 20598,
`public/dashboard/js/customerDetailView.js`). Aquí estrena sitio, no palabra.

## Dónde se pintan

`public/dashboard/js/parteDetailView.js`, en la cabecera de la hoja del parte, debajo del nombre del
cliente. Es una sola ranura con dos estados, y nunca salen los dos:

- parte no editable (`puedeEditarContenido.ok` en `false`) → un candado dibujado y el motivo
  (`pintarCandado`). Sin motivo no se pinta nada;
- parte editable → «Editar» (`TEXTOS.editar`, `pintarEditar`), que deja el cursor en la primera casilla.

## Por qué

Pedido del fundador el 20-nov-2026, sobre el parte firmado PT-2026-010: «un parte ahora como que no es
editable... un boton arriba para editar y que se desbloqueen los campos». Medido el 25-nov-2026: el
servidor ya mandaba por qué no se puede editar un parte firmado y la pantalla no lo pintaba en ningún
sitio. Los candados del servidor no cambian (`src/modules/jobs/domain/parteTrabajo.ts`): cambia que
ahora se lee el porqué.

En el borrador no había nada bloqueado: las casillas ya se escribían. Ponerlo en solo lectura para que
el botón «desbloqueara» sería un toque más para el operario en la obra, y quedó descartado
(comentario 22758).
