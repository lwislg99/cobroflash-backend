# SCRUM-700b · Migrados los filtros que cegaban: de 31 a 7

**Medido contra:** `origin/main` = `5bfc11360ba26146369d6f994812de665996f566` · 2026-09-04T13:23:48+02:00
**Medido en:** host `DESKTOP-T5MONF5` · rama `scrum-700b-migrar-los-31`

## PASO 0 (regla 39)

**Remedido antes de tocar**, porque `main` se había movido y SCRUM-700 ya estaba dentro: el
trinquete pasaba en verde, así que seguían siendo **exactamente 31**.

## Qué se migró

**24 guards a `soloEjecutable`**, y el censo baja de **31 a 7**. Cada uno se aceptó sólo tras dos
comprobaciones **por fichero**: que parsea (`node --check`) y que **su propio test sigue en verde**.
El que fallara cualquiera de las dos se revertía solo.

**Y hubo que hacerlo dos veces, porque la primera pasada estaba mal.** Mi patrón de sujeto se tragaba
el primer `.replace`, así que dejaba `soloEjecutable(codigo.replace(/…/g, ''))` **con el filtro
peligroso dentro**: once ficheros quedaron a medias y el censo lo cantó —bajaba a 16 y no a 6—. Una
segunda pasada dirigida los cerró.

**Antes de eso, una primera versión más burda rompió seis ficheros** insertando el `import` en medio
de un `import {` multilínea, porque anclaba «detrás del último import» y el último era la primera
línea de uno multilínea. Se revirtió entera y se rehízo anclando en el primer import de una sola
línea. Queda escrito porque el fallo no fue el patrón: fue no verificar fichero a fichero antes de
seguir.

## Los SIETE que quedan, y por qué

- **`scrum694-los-guards-migrados`** conserva el filtro viejo **a propósito**, como control de que la
  migración no es cosmética. Migrarlo sería borrar la prueba de que hacía falta — la trampa de
  autorreferencia, esta vez sobre un control. (Igual que `scrum700`, que por eso ya estaba excluido.)
- **`scrum377-plural-de-programador`: revertido y reportado.** Ver abajo.
- **Cinco** (`scrum128`, `scrum574-switch`, `scrum577`, `scrum636`, `scrum696`) escriben el filtro con
  una forma que la migración automática no encajaba. Quedan pendientes, nombrados.

## 🔴 El hallazgo: un guard cuyo verde dependía de estar ciego

**`SCRUM-377`, al dejar de ser ciego, encuentra un SÉPTIMO «(s)» de pantalla con el tope en 6.**
«1 factura(s) creada(s)» es cómo se escribe un plural cuando no se quiere pensar en el plural, y el
profesional lo lee como software a medio hacer. Ese séptimo **no es nuevo**: estaba ahí, tapado por
el filtro.

No se toca ninguna de las dos cosas desde aquí: el texto lo aprueba **el fundador** (regla 30) y el
guard es de **otro carril** (regla 9). Subir su tope de 6 a 7 sería relajarlo. Se revierte la
migración de ese fichero y se reporta.

## El control de mudez, y lo que destapa

Migrar y quedarse con guards que ya no muerden sería cambiar ruido por silencio. Como no se puede
inyectar el token prohibido de 24 guards distintos, se hizo uno **uniforme**: se rompe
`soloEjecutable` para que devuelva la cadena vacía y se corre cada guard migrado. **Uno vivo tiene
que ponerse ROJO**; si sigue verde mirando la nada, está mudo.

**Sólo 9 de los 24 se ponen rojos.** Los otros 15 pasan mirando la nada — y **tres de ésos**
(`_afirmaciones-derivadas`, `_censo-correo`, `_censo-eol`) son módulos auxiliares sin tests propios,
así que ahí el control ni siquiera aplica. Quedan **12 guards** cuyas afirmaciones son negaciones sin
respaldo: pasarían igual sobre un fichero vacío.

**Eso no lo causó esta migración** —es anterior, y es exactamente el patrón que persigue SCRUM-237—,
pero se descubre aquí y se deja dicho con nombres. El helper quedó intacto tras la mutación,
comprobado.
