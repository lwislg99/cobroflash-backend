# «Volver a llamar»: el aviso cuando no se puede marcar como hecha

**Aprobado por el orquestador por delegación del fundador** el 13-oct-2026 — SCRUM-1056 comentario 19453.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

Cuando se pulsa «Hecho» y no se puede marcar:

> No se ha podido marcar como hecha. Inténtalo otra vez.

## Dónde se pinta

`public/dashboard/js/clienteVolverALlamar.js`, clave `noMarcado` de `TEXTOS`: en el bloque en reposo
de la ficha del cliente, debajo de «Hecho» y «Cambiar». Al escribir esta ficha la pieza está cargada
en el panel y ninguna pantalla la monta todavía.

## La conducta que va con el texto

1. Sale sólo cuando falla «Hecho». La llamada sigue en pantalla como estaba, con sus dos botones
   encendidos.
2. Sale una vez, aunque «Hecho» falle varias seguidas.
3. Cuando lo que falla es «Guardar», en el formulario, sale el aviso de guardar la llamada, no éste.

## Qué cambió

Hasta esta firma, el fallo de «Hecho» salía con el aviso de guardar la llamada: nombraba una acción
que no era la que se acababa de pulsar. La pieza no cambia de conducta: es el mismo aviso, en el
mismo sitio, con otro texto.

La primera firma (SCRUM-1056 comentario 19452) acababa en «Inténtalo de nuevo.». El orquestador la
corrigió antes de que se escribiera en ningún fichero, para que los dos avisos de la pieza acaben
igual (SCRUM-1188 comentario 19450; el literal entero, en SCRUM-1056 comentario 19453).

## Lo que queda sin firmar en esa pantalla

Nada de esta pieza.
