# Inicio del Técnico — el título del bloque «Actividad del equipo» · SCRUM-1341

**Aprobado por el fundador** el 1-oct-2026, en **SCRUM-1341** (comentario 17827: «1-Ese esta bien»).

La firma no me llegó a mí: el orquestador del equipo de Javier le presentó al fundador dos
opciones con su razón y transcribió la respuesta en ese comentario. J2j lo abrió en Jira y copió
el literal de allí, no del mensaje del encargo.

## Texto aprobado, literal

> Actividad del equipo · este mes

El separador es « · » (espacio, punto medio, espacio), el mismo que lleva el título del panel del
admin.

## Dónde se pinta

`public/dashboard/js/homeView.js`, en `renderTeamActivity`: el título del bloque que el Técnico ve
en su Inicio, encima de la tabla con la actividad de sus compañeros. Sólo se pinta con sesión de
Técnico y cuando el negocio tiene equipo de campo.

## Qué cambió y por qué

Texto nuevo. Antes el Técnico no tenía este bloque: «Rendimiento del equipo» es del admin, y su
ruta le contesta 403.

**Por qué no se reusó el título del admin.** El del admin es «Rendimiento del equipo · este mes».
Sin la columna de importes eso ya no describe rendimiento, describe actividad: reusar un literal
firmado para un contenido distinto es texto nuevo aunque las letras no cambien (comentarios 17825
④ y 17827). «Actividad» es la palabra de la frase que el fundador firmó en SCRUM-1337: «Sí el
operario ve la actividad de sus compañeros».

**Lo que se descartó, que es parte de lo firmado.** «Presupuestos del equipo · este mes»: más
literal, pero ponía «Presupuestos» al lado de una cabecera que dice «Cotizaciones», dos palabras
para lo mismo en un bloque de cuatro líneas.

## Lo que este bloque reusa, y quién lo aprobó

No son textos nuevos y no los firma esta ficha. Los aprobó como REUSO el orquestador del equipo de
Javier, no el fundador:

- Las tres cabeceras de la tabla —«Miembro», «Cotizaciones», «Aceptación»—, tal cual las lleva el
  panel del admin, porque siguen describiendo lo que muestran (SCRUM-1341, comentario 17825 ④).
- El rótulo de rol bajo cada nombre —«Propietario», «Operario»—, la misma celda y los mismos
  literales del panel del admin. No estaba en la lista de reusos del comentario 17825; el
  orquestador lo aprobó por mensaje a J2j el 1-oct-2026, y consta en el registro del ticket.

## Lo que NO se le pinta al Técnico, y está decidido

- La columna «Cobrado», el pie «Sin asignar» y el «Total cobrado»: son el dinero.
- La estrella «Mejor del mes»: se calcula por lo cobrado, y dársela por aceptados sería cambiarle
  el significado a un rótulo firmado (comentario 17825 ②).
- El aviso «Sin actividad esta semana»: es una herramienta de gestión. Lo decidió el orquestador,
  no el fundador (comentario 17825 ③).
- El botón «Ver equipo →»: lleva a una pantalla sólo-admin (comentario 17825 ④).

## Queda sin firmar

Nada en este bloque.
