# «Cobro: todos», la primera opción del desplegable de cobro de la lista de Trabajos

**Aprobado por el orquestador por delegación del fundador** el 18-nov-2026 — SCRUM-1725 comentario 22098.
La delegación general de firma es de SCRUM-1656, comentario 21978. Propuesto por S4 como opción A de la
P1 de la vuelta 3 (filtros), tras la orden del fundador (comentario 22095). Reparto en dos PR: comentario 22103.
**Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1725i.

## Texto aprobado, literal

| dónde | antes | ahora |
|---|---|---|
| filtro de cobro de la lista de Trabajos (solo quien ve el cobro) | cuatro píldoras: «Todos · N», «Pendiente · N», «Parcial · N», «Pagado · N» | un desplegable: **«Cobro: todos (N)»**, «Pendiente (N)», «Parcial (N)», «Pagado (N)» |

«Cobro: todos» está calcado de «Facturación: todos», la primera opción del mismo desplegable en
Albaranes. «Pendiente», «Parcial» y «Pagado» son los de siempre; solo cambia cómo llevan su cuenta
(entre paréntesis, como en Albaranes).

## Lo que NO es texto nuevo

Las pestañas de estado que se estrenan en el mismo tramo no traen ningún literal: «Todos» es el de las
listas hermanas y las otras cinco salen de `jobStatusMeta` (`public/dashboard/js/api.js`): «Sin
agendar», «Agendado», «En curso», «Terminado», «Cerrado». «No hay trabajos con ese filtro.» y
«Ver N cerrados» son los que ya había.

## Pendiente de confirmar

El desplegable lleva `aria-label="Cobro"` (lo oye quien usa lector de pantalla; no se ve). Es el
arranque del literal firmado, igual que Albaranes lleva `aria-label="Facturación"` para «Facturación:
todos». Enviado al orquestador con la entrega para que lo confirme o lo cambie.

## Dónde se pinta

`public/dashboard/js/jobsView.js`, `renderJobsView` (`paint`): `select.jobs-filtro-cobro`.

## Lo vigila

`tests/scrum1725-lista-operario-sin-cobro.test.mjs` (casos «SCRUM-1725i ③» y los tres de «①②/③» del
cobro por rol) y `npm run guard:lista-trabajos-917` (A.2).
