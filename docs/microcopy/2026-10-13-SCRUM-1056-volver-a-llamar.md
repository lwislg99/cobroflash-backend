# «Volver a llamar»: el bloque de la ficha del cliente y la marca de la lista

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1056 comentario 19401.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

El título del bloque:

> Volver a llamar

El botón, cuando no hay fecha:

> Poner fecha

La frase del bloque, según lo que diga el servidor (para más adelante, hoy, vencida):

> Volver a llamar el {fecha}

> Volver a llamar hoy

> Había que llamar el {fecha}

Los dos rótulos del formulario:

> Día

> Nota de la llamada

Las acciones, con fecha puesta:

> Hecho

> Cambiar

La marca del cliente en la lista (hoy, vencida):

> Llamar hoy

> Llamar: {fecha}

Cuando no se puede guardar la fecha ni marcarla como hecha:

> No se ha podido guardar la llamada. Inténtalo otra vez.

Los dos botones del formulario:

> Guardar

> Cancelar

`{fecha}` es el día escrito como dd/mm/aaaa, que es como la ficha del cliente escribe un día.

## Dónde se pinta

`public/dashboard/js/clienteVolverALlamar.js`: los once fijos en `TEXTOS` y los tres con fecha en
`FRASES`. Al escribir esta ficha la pieza está cargada en el panel y ninguna pantalla la monta
todavía: la ficha y la lista de clientes son de otro carril.

## La conducta que se firmó con el texto

El comentario 19401 dice que firma la conducta que se iba a construir, sin medir. Ésta es la que
tiene la pieza:

1. Si toca hoy, si está vencida o si es para más adelante lo dice el servidor. La pieza no compara
   ninguna fecha con el reloj del navegador.
2. Una fecha en el pasado no se rechaza al escribirla: se manda, y se pinta lo que el servidor
   devuelve.
3. La marca de la lista sale sólo si toca hoy o está vencida.
4. El aviso de fallo sale tanto si falla guardar como si falla «Hecho», y en los dos casos lo que
   había en pantalla no cambia.
5. Si lo que llega no se entiende (un día sin estado, por ejemplo), el bloque se queda vacío y no hay
   marca. No es un texto: es no afirmar nada.

## Qué cambió

Nada: estos textos son nuevos. De la propuesta a la firma cambiaron dos, el rótulo de la nota (la
ficha ya tiene otro campo con casi el mismo nombre) y el aviso de fallo (dice qué no se guardó). Se
retiró un tercero, el que rechazaba una fecha pasada.

## Lo que queda sin firmar en esa pantalla

Nada de esta pieza. El comentario 19401 firma además el título del apunte que deja «Hecho» en el
historial; lo escribe el servidor, no esta pieza, y su registro va con quien lo construya.
