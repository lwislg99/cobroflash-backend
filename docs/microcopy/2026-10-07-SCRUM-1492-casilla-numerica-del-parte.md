# El parte: lo que una casilla numérica no entiende («1e», «-», «,»)

**Aprobado por el orquestador por delegación del fundador** el 7-oct-2026 — SCRUM-1492 comentario 18633.

La delegación de microcopy es la permanente de `docs/equipo/limites-del-fundador.md`.

## Texto aprobado, literal

Para Kilómetros, nuevo:

> No se ha guardado. Kilómetros es un número, como 12 o 12,5

Para Desplazamiento no hay texto nuevo: el comentario 18633 firma que se diga el que SCRUM-1491 ya
tenía aprobado para ese campo (comentario 18517), sin cambiar una letra, también en este caso.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.kilometrosEsUnNumero` (y, para Desplazamiento,
`TEXTOS.desplazamientoEsEntero`, que ya existía).

En el aviso de un campo de la cabecera que no se guarda: al pie del paso «Horas y desplazamiento», con
`role="alert"`, y traído a la vista. Mismo sitio y misma caja que el de SCRUM-1491.

## En qué caso

Al salir de una de las dos casillas numéricas de la cabecera con algo que el navegador no entiende como
número: `validity.badInput`. La vista no mira lo tecleado ni copia ninguna regla de la ruta.

## Las conductas que se firmaron con el texto

1. Con `validity.badInput` no se manda nada. El valor guardado no se toca.
2. La casilla vuelve a enseñar lo guardado. Lo que se ve es lo que hay.
3. También cuando la casilla estaba vacía de antes.

## Por qué se firmó decir lo mismo en Desplazamiento

Del comentario 18633: teclear `1,5` y teclear `1e` son, para el profesional, el mismo error; lo único que
cambia es dónde se caza. Un texto por campo vale más que dos que pueden divergir. Se firmó después de
comprobar que la ruta ya da un código por causa (SCRUM-1488): `desplazamientos_invalido` quiere decir
sólo «no es un número entero».

## Lo que no cubre

- Un guardado que falla por otra cosa (500, sin red): sigue «No se ha podido guardar el cambio — vuelve a
  intentarlo».
- Las demás casillas numéricas del panel (las cantidades de las líneas, los precios de oficina): nombradas
  en el ticket, sin abrir.
- Medido en Chromium con teclado físico, no en un móvil.
