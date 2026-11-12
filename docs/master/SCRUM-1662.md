# SCRUM-1662 · TRABAJOS · «Qué hay que hacer» en su campo propio, que el operario SÍ ve (PILOTO-1)

**Medido contra:** `origin/main` = `acac25dbac0dbb870f6dbda9f240df3664326c2d` · 2026-11-12T08:03:59Z (fecha de commit de esa punta, #3069) · **Rama:** `scrum-1662-que-hay-que-hacer` · **Carril:** S1.

A9: comprobación → `tests/scrum1662-que-hay-que-hacer.test.mjs`

## Origen y firma

- **El defecto** (medido el 11-nov en yaqu.app, SCRUM-1674 c.21544): la descripción del alta de un trabajo
  caía en `Job.notes`, que la ficha pinta como «Notas internas · Solo tú las ves» (`textarea#job-notas-internas`).
  La tarea acababa en las notas privadas del jefe.
- **FIRMADO** por el fundador (c.21548, literal de la opción elegida): «Columna nueva — Campo propio con el
  rótulo "Qué hay que hacer" que el operario SÍ ve en su trabajo. […] Las notas internas siguen siendo
  privadas: la promesa "Solo tú las ves" no se rompe.» El rótulo «Qué hay que hacer» queda firmado con esa
  respuesta.
- **A5:** DDL de `node scripts/preview-migracion.mjs` (c.21552): `ALTER TABLE "jobs" ADD COLUMN "que_hay_que_hacer" TEXT;`
  Aplicado y verificado en PRODUCCIÓN y STAGING (c.21553). **La tercera base (`yaqu_dev_javier`) falta por
  confirmar**: la aplica el carril de Javier. **Este PR no se abre hasta esa confirmación** (la rama no se
  empuja: empujar abre el PR solo).

## Qué cambia (servidor; la pantalla es pieza aparte de S2)

- `prisma/schema.prisma` · `Job.queHayQueHacer String? @map("que_hay_que_hacer")`: nullable, sin default. Los
  trabajos anteriores quedan en `null`; **no se copia nada desde `notes`**, que se escribieron como privadas.
- `src/modules/jobs/domain/trabajoDirecto.ts` · `filaDeTrabajoDirecto`: la `descripcion` del alta va a
  `queHayQueHacer`; `notes` ya no se escribe en el alta (nace `null`).
- `src/modules/jobs/app/routes/jobs.routes.ts`:
  - `serializeJob` devuelve `queHayQueHacer` (lista, detalle, respuesta del POST y del PATCH).
  - `PATCH /admin/jobs/:id` acepta `queHayQueHacer`: recorta, tope 2.000 (el del alta), vacío → `null`.
    **No es admin-only**: la regla por campo de SCRUM-120/164 reserva al admin lo que toca dinero o fiscal;
    la tarea es operativa, como `titulo` (SCRUM-317). El operario la lee y la edita en SUS trabajos.

## Comprobación

- **Banco desechable** propio (Postgres 16 portátil, `127.0.0.1:55862`, base `yaqu_1662_test`, esquema de la
  rama con `prisma migrate diff --from-empty` local 6.18.0: 33 tablas, `que_hay_que_hacer` dentro).
- **Rojo primero** (código viejo en `dist`, test nuevo): 2/2 en rojo, cada uno por su causa: la fila no lleva
  `queHayQueHacer`; la tarea cae en `notes`; ni el POST ni el GET la devuelven; el PATCH no la edita; el
  operario no la ve.
- **Verde:** el test nuevo + vecinos con banco (120, 164, 317, 424×2, 427×2, 467, 651, 849, 917d/f/g/i, 992,
  1671, 1674, 1690, 1706) → **127/127, 0 saltos**.
- Declarado en `GATEADOS_DECLARADOS` (SCRUM-419).
- **En yaqu.app:** tras el merge, un alta con descripción en la cuenta QA y `GET /admin/jobs/:id` con
  `queHayQueHacer` lleno y `notes` vacío (regla 42).

## Hallazgo para decidir (NO hecho aquí)

`notes` («Notas internas · Solo tú las ves») **le llega hoy al operario**: `serializeJob` la devuelve a todos
los roles, el `PATCH` se la deja editar (es justo lo que SCRUM-120 escribió el 23-jul: «Técnico ✅: status,
scheduledAt, notes», y lo fija `tests/scrum120-patch-job-roles.test.mjs`), y va en el `DESCRIPTION:` del `.ics`.
El rótulo «Solo tú las ves» llegó DESPUÉS (SCRUM-427/917g, reutilizado de Presupuestos), sin revisar esa
regla. La firma de c.21548 dice que las notas internas siguen privadas. Propuesta enviada al orquestador; no
se cambia sin decisión, porque cambia la regla de SCRUM-120 y su test.
