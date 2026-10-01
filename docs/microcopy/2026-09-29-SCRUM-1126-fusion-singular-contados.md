# Ficha del cliente — fusionar: el singular de «Contados» · SCRUM-1126

**Aprobado por el orquestador por delegación del fundador** el 29-sep-2026 — SCRUM-1126 comentario 17580.

J2 lo leyó en Jira el 30-sep-2026; no llegó transcrito. La delegación está en
`docs/equipo/limites-del-fundador.md` §«Delegación permanente». El número bueno es el 17580: el
17577 que se citó en varios sitios era falso (corregido en el comentario 17648).

## Textos aprobados, literales

Cada elemento de la línea `Contados: {n} presupuestos · {n} trabajos · {n} notas` (firmada en el
comentario 17575, sin cambios) se decide **por separado**. Puede haber 1 presupuesto y 4 trabajos.

| Elemento | Cuándo | Texto aprobado |
|---|---|---|
| presupuestos | `{n}` = 1 | 1 presupuesto |
| trabajos | `{n}` = 1 | 1 trabajo |
| notas | `{n}` = 1 | 1 nota |
| presupuestos | `{n}` ≠ 1 (también 0) | {n} presupuestos |
| trabajos | `{n}` ≠ 1 (también 0) | {n} trabajos |
| notas | `{n}` ≠ 1 (también 0) | {n} notas |

## Dónde se pinta

`FUSION_CLIENTE.contados` en `public/dashboard/js/customerDetailView.js`, en la previsualización de
la fusión.

## Qué cambió y por qué

La firma del 17575 estaba solo en plural: con un único presupuesto la pantalla decía
«1 presupuestos». J2 lo dejó sin pintar en vez de inventarse el singular, y el 17580 lo firmó. Con
`{n}` = 0 se usa el plural («0 presupuestos»), como en el resto del panel.

## Queda sin firmar

Nada en esta ranura.
