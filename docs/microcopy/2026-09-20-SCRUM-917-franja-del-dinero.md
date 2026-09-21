# SCRUM-917e · la franja del dinero del detalle del Trabajo

**Aprobado por el orquestador por delegación del fundador** el 18-sep-2026 — SCRUM-917 comentario 15881, que
firma literal todos los textos de `docs/prototipos/SCRUM-917/textos-propuestos.md` salvo los dos que nombra.

**Aplicado en el mismo acto** (regla 30), en el corte 917e (`jobDetailView.js`). La delegación es la permanente
de `docs/equipo/limites-del-fundador.md`, sección «Delegación permanente», línea de microcopy.

De la franja, **sólo «Cobrado del todo» es texto nuevo**. «Te falta por cobrar», «Aceptado» y «Cobrado» ya
existían en esta misma pantalla y aquí sólo cambian de sitio — el propio documento de textos lo dice así.

## Texto aprobado, literal

> Cobrado del todo

## Texto aprobado: los que ya existían y sólo cambian de sitio

> Te falta por cobrar

> Aceptado

> Cobrado

## Dónde se pinta

`public/dashboard/js/jobDetailView.js`, dentro de `renderJobDetailView`: la franja `.detail-dinero` del cuerpo.
El rótulo es «Te falta por cobrar» cuando queda algo por cobrar y «Cobrado del todo» cuando no queda nada;
«Aceptado» y «Cobrado» van al lado, una vez cada uno.

## Qué cambió

Antes, un Trabajo cobrado entero decía **«Te falta por cobrar 0,00 €»**: enseñaba un cero donde se espera una
deuda, y obligaba a leer el número para entender que no había nada que hacer. Ahora lo dice con palabras.

Y con él se retiran de la pantalla, por repetidos, el titular «Total aceptado» a 2,2 rem, el texto
«Cobrado X de Y» de dentro de la barra y las filas de importes de «Qué falta para cobrar». Ninguno era un texto
nuevo y ninguno se sustituye por otro: **la franja los dice una sola vez**. Medido: el mismo «590,00 €» se leía
siete veces en la misma pantalla (`docs/master/evidencias/SCRUM-917/salida-paso0-detalle.txt`).

## Qué queda sin firmar

🔴 **«Se ha cobrado de más»** y **«El cobro supera el importe aceptado. Revísalo antes de facturar.»**
NO están firmados y **no se construyen**. El comentario 15881, leído al pie de la letra, sólo excluye por su
nombre los dos textos de la LISTA, pero el propio `textos-propuestos.md` marca éstos como «forma propuesta,
decisión de la S1», y el orquestador lo confirmó y cerró por el canal el 20-sep-2026: manda la lectura
restrictiva.

Para ese caso se reutiliza el literal que YA está firmado y pintado desde SCRUM-887 (comentario 15697):

> Has cobrado {importe} más de lo aceptado.

Vive en `public/dashboard/js/jobCobroHuecos.js`, función `avisoCobradoDeMas`, y se sigue dando en «Qué falta
para cobrar». No se ha escrito una segunda forma de decir lo mismo. Lo vigila `guard:detalle-trabajo-917`
(D.10), que falla si ese aviso desaparece de la pantalla.
