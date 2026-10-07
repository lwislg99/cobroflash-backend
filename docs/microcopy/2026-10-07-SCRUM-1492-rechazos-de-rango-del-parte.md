# El parte: un número que la ruta rechaza por negativo o por no caber

**Aprobado por el orquestador por delegación del fundador** el 7-oct-2026 — SCRUM-1492 comentario 18706.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

Para el código `desplazamientos_negativo`:

> No se ha guardado. Desplazamiento es 0 o más

Para el código `kilometros_negativo`:

> No se ha guardado. Kilómetros es 0 o más

Para el código `desplazamientos_no_cabe`:

> No se ha guardado. Ese número es demasiado grande para Desplazamiento

Para el código `kilometros_no_cabe`:

> No se ha guardado. Ese número es demasiado grande para Kilómetros

Para el código `kilometros_invalido` no hay texto nuevo: el comentario 18706 firma que se diga el que
Kilómetros ya tenía aprobado en este mismo ticket (comentario 18633), sin cambiar una letra.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`: `TEXTOS.desplazamientoEsCeroOMas`, `TEXTOS.kilometrosEsCeroOMas`,
`TEXTOS.desplazamientoDemasiadoGrande` y `TEXTOS.kilometrosDemasiadoGrande` (y, para `kilometros_invalido`,
`TEXTOS.kilometrosEsUnNumero`, que ya existía).

En el aviso de un campo de la cabecera que no se guarda: al pie del paso «Horas y desplazamiento», con
`role="alert"`, y traído a la vista. Mismo sitio y misma caja que los demás avisos de esas dos casillas.

## En qué caso

El `PATCH` del campo falla y el error trae uno de esos códigos. Se decide por el código que pone
`apiRequest` en `err.code`, nunca por el mensaje del servidor. Los códigos son los de
`src/modules/jobs/domain/parteRango.ts`, uno por causa (SCRUM-1488).

## Las conductas que se firmaron con el texto

1. La ruta contesta 400, la ficha se relee del servidor y la casilla vuelve a enseñar lo guardado.
2. Las dos casillas llevan `min="0"`. Es cortesía y no protección: la que protege es la ruta.
3. `kilometros_invalido` pinta el texto de Kilómetros. Hoy desde la casilla no se llega a ese código (lo que no
   es un número lo para el navegador antes de mandarlo): es la red para el día que se llegue.

## Por qué los dos de «demasiado grande» no dicen lo que vale

Del comentario 18706: lo que vale ahí es el tope de la columna, que a un profesional no le dice nada, y nadie
llega salvo con un dedo dormido en la tecla. Dicen lo único cierto y útil. El tope no se escribe.

## Lo que no cubre

- Un guardado que falla por otra cosa (500, sin red): sigue «No se ha podido guardar el cambio — vuelve a
  intentarlo».
- Las demás casillas numéricas del panel (las cantidades de las líneas, los precios de oficina): nombradas
  en el ticket, sin abrir.
- Medido en Chromium con teclado físico, no en un móvil.
