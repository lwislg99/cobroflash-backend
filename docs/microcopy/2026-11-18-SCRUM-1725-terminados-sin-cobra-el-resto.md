# La cabecera «Terminados» de la lista de Trabajos, para quien no ve el cobro (M1)

**Aprobado por el orquestador por delegación del fundador** el 18-nov-2026 — SCRUM-1725 comentario 22052.
La delegación general de firma es de SCRUM-1656, comentario 21978. Propuesto por S4 como M1 en su
propuesta de SCRUM-1725 (12-nov-2026), donde se dejó escrito que cambiarla pedía firma.
**Aplicado en el mismo acto** (regla 30), en el tramo SCRUM-1725e.

## Texto aprobado, literal

| quién mira | antes | ahora |
|---|---|---|
| quien NO ve el estado de cobro (`veEstadoDeCobro` es falso: hoy, todo rol que no sea `admin`) | ✅ Terminados — cobra el resto | ✅ Terminados |
| quien SÍ lo ve (`admin`) | ✅ Terminados — cobra el resto | ✅ Terminados — cobra el resto (no cambia) |

Detrás va, como antes, « · N» con el número de trabajos del grupo; eso es dato, no microcopy.

## Dónde se pinta

`public/dashboard/js/jobsView.js`, `renderJobRows`: el `title` del grupo `terminado`. La pregunta es
`veEstadoDeCobro(window.appUserRole)`, la misma que ya quita de esa cabecera el importe «por cobrar» y
su salvedad (SCRUM-1725, D1).

## Por qué

«— cobra el resto» es una orden sobre el cobro. El operario no ve lo cobrado ni lo que falta
(SCRUM-1707 c.21547) y no puede cobrar desde esta pantalla: la cabecera le pedía algo que no está en
su mano.

## Lo que NO cambia

- La cabecera del admin, ni una letra.
- Los demás rótulos de grupo («🔨 En curso», «📅 Hoy», «📅 Esta semana», «⏳ Sin agendar»,
  «🗓 Más adelante», «🔒 Cerrados»).
- La ficha del Trabajo (`jobDetailView.js`), que es de S2.

## Lo vigila

`tests/scrum1725-lista-operario-sin-cobro.test.mjs`: con rol `tecnico` y con un rol desconocido la
cabecera es «✅ Terminados · N», a secas; con `admin`, de control, «✅ Terminados — cobra el resto · N · …».

## SUPERADO el mismo 18-nov-2026 (SCRUM-1725g)

El fundador pidió la lista PLANA (SCRUM-1725 comentario 22073) y la cabecera «Terminados» dejó de
pintarse para todos los roles (P4, comentario 22076). Este texto ya no sale en pantalla y el test de
«Lo vigila» exige ahora que no haya cabecera de grupo (cambio autorizado en el comentario 22077). El
registro se conserva; la firma de «Estado» tiene el suyo, en esta misma carpeta y con la misma fecha.
