# El parte: «Ordenar en líneas» cuando la ruta no contesta

Aprobado por el orquestador por delegación del fundador · SCRUM-1302 comentario 18491

Firmado el 6-oct-2026. La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

> No se ha podido ordenar el dictado — vuelve a intentarlo o escribe las líneas tú

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.noSePudoOrdenar`.

Debajo del botón «Ordenar en líneas» y encima del hueco de la propuesta. Vive en la vista y no en los avisos
que manda el servidor: es el caso en que el servidor no ha contestado.

## En qué casos

Tres, y sólo esos: la petición no llega, la ruta contesta 5xx, o contesta 502. Son los tres en los que repetir
puede funcionar, y el dictado sigue escrito en su casilla para repetirlo.

Se quita cuando un intento siguiente sí recibe respuesta.

## Las dos conductas que se firmaron con el texto

1. Si ya hay una propuesta en pantalla y el nuevo intento falla, la propuesta no se toca: lo que el técnico
   corrigió a mano sigue ahí.
2. Con un 409 o un 404 no sale este texto: se relee el parte. Ahí repetir no va a funcionar nunca. La ficha
   sale firmada, o dice que no se ha podido cargar el parte, con el literal que ya estaba aprobado.

## Lo que no cubre

- Que la ruta conteste y no saque ninguna línea: eso lo dice el aviso que viaja en la respuesta, y no invita a
  repetir.
- Cualquier otro rechazo (400, 401, 403…): no hay texto firmado para él. La propuesta tampoco se toca, y no se
  dice nada.
- Los mensajes que el servidor manda con un rechazo: no se enseñan.
