# SCRUM-1706 · PILOTO-1 · El operario abre el trabajo que le asignaron

**Medido contra:** `origin/main` = `b3a03b5ac7ef17c7d77571fa50f95406f844bd8c` · 2026-11-11T18:13:36Z
**Rama:** `scrum-1706-operario-abre-su-trabajo` · **Carril:** S1.

A9: comprobación → `tests/scrum1706-operario-abre-su-trabajo.test.mjs`

## Origen

El fundador entró como OPERARIO real (miembro 30, cuenta QA) y al abrir SU trabajo asignado (#77) la ficha dijo
«No pudimos cargar el trabajo». La lista sí lo enseñaba. Encargo del orquestador a S1 (11-nov-2026): medir por
código y con un test por rol contra el banco; la verificación final en prod la hace el fundador con su pantalla.

## Causa (medida)

`GET /admin/jobs` filtra al técnico por los TRES ejes de pertenencia (autoría `operarioId`, asignación
`assignedUserId` y la tabla `assignees`; SCRUM-467 + SCRUM-650). Las cinco puertas de `/admin/jobs/:id`
(`GET /:id`, `GET /:id/gastos`, `PATCH /:id`, `GET /:id/ics`, `POST /:id/albaranes`) miraban SOLO
`operarioId`. Un trabajo ASIGNADO al operario —que es como le llega el trabajo— se listaba y se le negaba con
404. El front (`jobDetailView.js:698`) convierte ese 404 en «No pudimos cargar el trabajo».

## Arreglo

`jobs.routes.ts`: el `if (seesOnlyOwnJobs(...) && job.operarioId !== req.teamMemberId)` de las cinco puertas se
queda LITERAL (lo vigilan `tenancy-permisos` —catálogo de mutaciones— y `scrum370`); dentro, solo cuando no es
el autor, `asignadoAlTecnico()` lee los dueños con `SELECT_DUENOS` y decide con `esSuyoElTrabajo`
(`accesoAlTrabajo.ts`, la fuente única de los tres ejes). Lectura y escritura de este recurso siguen mirando lo
mismo, ahora igual que la lista. Sin esquema, sin texto de usuario.

La decisión se toma en código y no con un `where` delegado en la base: la primera versión usaba
`whereSuyoElTrabajo` en el `findFirst`, y `scrum1390b` (cuyo doble de Prisma no interpreta el `OR`) la cazó
dando 200 al técnico ajeno. El guard no se tocó (regla 41): se cambió el código.

## Medida

- Test nuevo contra banco desechable (`LIBRO_PG_URL`, loopback `*_test`): en `main` **rojo, 10 fallos** (las
  cinco puertas × asignado por campo y por tabla, todas 404); con el arreglo **1/1 verde**. Dentro lleva los
  dos controles: el trabajo AJENO sigue en 404 en las cinco puertas, y el de autor sigue en 200.
- Vecinos con banco (467, 849, 147, 1403, tenancy-permisos, 370, 606, 992, 1390*, 411*, 1674): **98/98**.
- Se salta sin banco (gateado como 1674).

## Fuera de alcance (anotado)

- Contar las visitas del parte en el servidor (`visitaN`/`visitaM` en el GET del parte) para que la pantalla del
  parte no pida `/admin/jobs/:id`: es SCRUM-1697, otra rama.
- La verificación en yaqu.app con la sesión del operario la hace el fundador (S1 no tiene esa sesión).
