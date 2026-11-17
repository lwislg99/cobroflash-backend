# El parte: la tarea del trabajo, con su rótulo

**Aprobado por el fundador** el 11-nov-2026, en **SCRUM-1662**.
La firma del rótulo es SCRUM-1662 comentario 21548: al elegir la opción «Columna nueva», el fundador
firmó el campo propio «con el rótulo "Qué hay que hacer" que el operario SÍ ve en su trabajo». Que ese
mismo rótulo vale dentro de la hoja del parte consta en SCRUM-1662 comentario 21956.
**Aplicado** en la hoja del parte el 17-nov-2026 (pieza (d) de SCRUM-1662). En el alta y en la ficha del
trabajo ya estaba puesto desde el 12-nov-2026.

## Texto aprobado, literal

> Qué hay que hacer

Es el mismo literal en los tres sitios; no hay variante para el parte.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js`, `TEXTOS.queHayQueHacer`: el título de la tarjeta de la tarea
en la hoja del parte, justo debajo de la cabecera, en borrador y firmado. Debajo va la tarea que el jefe
escribió en el trabajo, tal cual.

Los otros dos sitios del rótulo, que esta ficha no cambia: el alta de un trabajo (`jobNuevoModal.js`) y
la ficha del trabajo (`ROTULO_TAREA`, en `jobTrabajoPlegable.js`).

## Lo que NO se pinta

**Sin tarea no hay línea** (SCRUM-1662 comentario 21801): si el trabajo no tiene tarea, o el parte no
cuelga de un trabajo, la hoja no pinta ni el rótulo ni un texto de relleno. No existe un «Sin tarea»:
nadie lo ha firmado.

Es de **solo lectura**. No hay botón de editar ni textos de guardado o de error: la tarea se escribe en
el trabajo.

## Lo que no se ha comprobado desde esta ficha

Quien la escribió (S4, 17-nov-2026) no ha leído los comentarios 21548, 21956 y 21801 en Jira: los cita
por su número tal como constan en `docs/master/SCRUM-1662.md` (el 21548, con su literal) y en el
encargo del orquestador (el 21956 y el 21801). La fecha del 11-nov-2026 sale de ese registro, que da
el comentario 21548 por existente en su hallazgo del 11-nov.
