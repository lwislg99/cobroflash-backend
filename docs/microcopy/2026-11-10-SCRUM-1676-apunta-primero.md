# Qué va antes de firmar un parte vacío

**Aprobado por el fundador** el 10-nov-2026 — SCRUM-1656 comentario 21408 (tanda única de PILOTO-1, SCRUM-1656 c.21405, entrada 7).
La rectificación posterior (SCRUM-1656 c.21411) solo deja sin efecto lo que c.21408 decía del máster y del flag de invitados; las entradas 1-23 siguen firmadas tal cual.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

> Apunta primero lo que has hecho: al firmar ya no se puede cambiar.

## Dónde se pinta

`public/dashboard/js/parteDetailView.js` — clave `TEXTOS.apuntaPrimero`, en la sección de firmas
del parte (`data-parte-apunta-primero`), encima de las dos cajas de firma, **solo** cuando:

- no ha firmado nadie, **y**
- el parte no tiene ninguna línea (la misma pregunta que `puedeFirmarse` en `parteTrabajo.ts`).

En ese caso ocupa el sitio de «Con la primera firma, lo apuntado queda fijo.» (SCRUM-653
comentario 17354): dice lo mismo y además qué hacer. Con una línea vuelve el de SCRUM-653.

## Qué cambió

Con el parte vacío, «Firmar aquí mismo» era el único botón verde de la pantalla (SCRUM-1676,
medido en SCRUM-1658). Ahora, mientras no hay líneas, pierde el verde y queda como secundario;
el texto de arriba dice qué va antes.
