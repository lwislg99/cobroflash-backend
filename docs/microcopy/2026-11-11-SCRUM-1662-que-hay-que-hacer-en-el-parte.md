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

## Quién leyó la firma, y qué no se ha comprobado

Quien escribió esta ficha (S4, 17-nov-2026) no tiene lectura de Jira. Los comentarios 21548 y 21956 los
leyó el orquestador de Luis el 17-nov-2026, a petición suya, y esto es lo que dijo de ellos:

- **21548** — existe, es de SCRUM-1662 y es del 11-nov-2026. Lo escribe el orquestador y registra la
  firma del fundador («respuesta directa a la pregunta del orquestador; literal de la opción elegida»).
  Dice literalmente el rótulo.
- **21956** — existe, es de SCRUM-1662 y es del 17-nov-2026. Lo escribe el orquestador y registra que
  el fundador aceptó que el mismo rótulo vale dentro del parte.

El comentario 21801 («sin tarea no hay línea») no lo ha leído nadie para esta ficha: se cita por su
número, tal como viene en el encargo.
