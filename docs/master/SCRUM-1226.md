# SCRUM-1226 · Una firma sube el estado del parte, nunca lo baja

**Medido contra:** `origin/main` = `61a975bb10fee30aad45fdbbc80eb07d6c808908` · 2026-09-29T09:16:39Z

Carril S1 (servidor) · sesión s1-29a · rama `scrum-1226-firma-no-baja-estado`.

## El defecto (hallazgo de S4, s4-28d)

`POST /admin/partes/:id/firmar` y `POST /admin/partes/:id/firmar-tecnico` escribían
`estado: 'firmado'` sin mirar el estado actual. Los candados son por RANURA (SCRUM-653), así que la
segunda firma se acepta después de la primera: un parte en `facturado` con una ranura libre volvía a
`firmado`, y `firmado` no cierra los precios (`puedeEditarPrecios` solo cierra en `facturado`).
Consecuencia: firmar reabría los precios de un parte ya facturado.

## PASO 0 (medido en el árbol, no en el ticket)

- Las dos rutas escribían el estado a pelo (`partes.routes.ts`, `firmar-tecnico` y `firmar`).
- `ESTADOS_PARTE = ['borrador', 'firmado', 'facturado']` y `facturado` es el ÚNICO estado que cierra
  `puedeEditarPrecios`: el estado está previsto (Parte L) y es el que protege los precios, así que la
  bomba tiene mecha aunque hoy nada en `src/` ponga un parte en `facturado`.

## El arreglo

- `estadoTrasFirmar(actual)` en `src/modules/jobs/domain/parteTrabajo.ts`: `borrador` → `firmado`;
  cualquier otro estado se queda como está. Las dos rutas la usan.
- **La firma se guarda igual** (trazo, fecha, nombre): lo que no cambia es el estado.
- **`puedeEditarPrecios` en este camino: no se toca.** Sigue decidiendo por el estado, y como el estado
  ya no baja, un parte facturado sigue con los precios cerrados después de la segunda firma.
- ⚠️ Límite declarado: decide sobre el estado LEÍDO. Quien construya «facturar el parte» y quiera
  cerrar la carrera (facturar entre la lectura y la escritura de una firma) necesita escritura
  condicional o cerrojo. Hoy no hay nada que facture un parte, así que no hay carrera.

## Prueba

`tests/scrum1226-firma-no-baja-el-estado.test.mjs`, con las rutas de verdad y la base doblada
(`_envio-doblado.mjs`, como SCRUM-889b). Mide el VIAJE: firma y después intenta valorar por el
`PATCH` real.

- Rojo antes del arreglo (2/4): «la firma devolvió un parte FACTURADO a «firmado»», en las dos rutas.
- Verde después (4/4). Controles: la primera firma sigue cerrando el borrador; la segunda sobre un
  parte `firmado` lo deja en `firmado` con los precios abiertos.
- Vecinos: los 23 ficheros de test que nombran `parteTrabajo`/`partes.routes` (209: 203 ✔, 6 saltados
  por `QA_DB_TEST`/`LIBRO_PG_URL`, ya saltados antes) + censos 411/627/627b/1185 + 262 (58/58).
