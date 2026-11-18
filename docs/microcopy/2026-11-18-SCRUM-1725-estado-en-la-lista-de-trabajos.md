# «Estado», la columna de la lista de Trabajos (lista plana)

**Aprobado por el orquestador por delegación del fundador** el 18-nov-2026 — SCRUM-1725 comentario 22076.
La delegación general de firma es de SCRUM-1656, comentario 21978. Propuesto por S4 como P1 de la
vuelta «lista plana» de SCRUM-1725, tras el veredicto del fundador (comentario 22073: «un listado
normal como los que tenemos en otros sitios»).
**Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1725g.

## Texto aprobado, literal

| dónde | antes | ahora |
|---|---|---|
| cabecera de la tabla de Trabajos | Cliente · Importe · Fecha · Acciones | Cliente · Importe · Fecha · **Estado** · Acciones |

Es el mismo `<th>` que ya llevan Presupuestos y Albaranes, y el que Trabajos tuvo hasta SCRUM-816.

En cada fila, bajo esa columna, va la píldora del estado del Trabajo. **No se estrena ninguna
etiqueta**: salen de `jobStatusMeta` (`public/dashboard/js/api.js`), la misma pieza que pinta la ficha:
«Sin agendar», «Agendado», «En curso», «Terminado», «Cerrado».

## Lo que desaparece de la pantalla (decisión P4 del mismo comentario 22076)

Con la lista plana se van los rótulos de grupo y, con el de Terminados, dos textos firmados que NO se
reescriben: dejan de pintarse.

| texto | firmado en | qué pasa |
|---|---|---|
| «🔨 En curso», «📅 Hoy», «📅 Esta semana», «⏳ Sin agendar», «🗓 Más adelante», «🔒 Cerrados» | SCRUM-428 / SCRUM-917 c.15881 | dejan de pintarse; el estado lo dice la píldora de cada fila |
| «✅ Terminados — cobra el resto» y «· X € por cobrar» | SCRUM-428 / SCRUM-917 c.15881 | dejan de pintarse; lo que falta queda en la tarjeta «Por cobrar» y en «💰 Cobrar el resto (importe)» de cada fila |
| «N sin importe de referencia: no se sabe cuánto falta y no entran en el total.» | fundador, 10-ago-2026 | deja de pintarse; queda la salvedad corta de la tarjeta, «N sin importe de referencia, no entra(n)» (SCRUM-917 c.15881) |
| «✅ Terminados» a secas (M1) | SCRUM-1725 c.22052 | SUPERADO: no hay cabecera para ningún rol. Su registro, en esta misma carpeta y con la misma fecha, se conserva |

«Ver N cerrados» se queda, tal cual, como última fila de la lista.

## Dónde se pinta

`public/dashboard/js/jobsView.js`: el `<th>` en `renderJobRows`; la píldora en `jobRow` (`td.cell-status`).

## Lo vigila

`tests/scrum1725-lista-operario-sin-cobro.test.mjs` (la lista es plana para los tres roles, en el orden
de la cola y con el estado en cada fila) y `npm run guard:lista-trabajos-917` (B.1, C.4, C.5).
