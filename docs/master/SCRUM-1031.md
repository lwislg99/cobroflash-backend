# SCRUM-1031 · CLIENTES — Comprobar en staging los tres fallos de la ficha del cliente

**Puesto: S0 (medición) · 22-sep-2026**

**Medido contra:** `origin/main` = `b8e3f81a61344f5cfa94184be9e31c45c1270cdd` · 2026-09-22T09:42:53+01:00

Medido EN STAGING (merchant QA), no leído. Sonda y hallazgos completos:
`docs/master/evidencias/scrum1031/` (`sonda.mjs`, `limpiar-1031.mjs`, `HALLAZGOS.md`).

## Veredicto

| # | Descripción | Veredicto |
|---|---|---|
| A | `GET /admin/customers/duplicados` capturada por `/:id` | **OCURRE 🔴** |
| B | `PATCH /admin/customers/:id` (NIF desde el Trabajo) sin ruta (solo hay `PUT`) | **OCURRE 🔴** |
| C | Cifras (`stats`) de la ficha truncadas a 20 documentos | **NO OCURRE ✔** — ya arreglado por SCRUM-1035 |

Detalle, comandos y capturas de la petición: `docs/master/evidencias/scrum1031/HALLAZGOS.md`.

## Limpieza

Los datos de prueba (`ZZZ PRUEBA 1031 cliente`, 21 presupuestos) se crearon y se borraron en el
merchant QA Staging. Control final: 0 clientes con ese nombre restantes.

## Sin código de producto

Esta tarea es solo medición (S0, `docs/equipo/sesion-0.md`): no toca `src/` ni `public/`. A y B quedan
para su ticket de arreglo (aceptación del propio SCRUM-1031, punto 2); C se cierra sin acción.
