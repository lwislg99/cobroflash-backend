# SCRUM-674 · Los cinco cambios de schema aprobados, y la microcopy del dictado

**Medido contra:** `origin/main` = `4b3865f8201fe24fe367f45c4f6fba34933a1de0` · 2026-09-02T16:25:07+02:00
**Rama:** `scrum-674-schema-cinco`

**Remedido tras mergear `main`** (`7bdb3a90`, sin conflicto y sin tocar ninguno de mis
ficheros): 4495 tests, **los mismos 7 rojos**. Los 23 tests que trae `main` entran en verde.

| Commit | Qué |
|---|---|
| `a88286baef37772a1031f0dbf61c6a2b8c7c6730` | TAREA 1 · los cuatro cambios de schema que faltaban |
| `f1a7998832af454c0017ffd1f5ee46d6e97f9d57` | TAREA 2 · el aviso de dictado, aprobado y aplicado |
| `3b70b7b3731fd8b89392a3aece19f01207b1e80d` | los dos cableados de `partes_trabajo` que no son territorio del fundador |

---

## 🔴 Lo primero: la premisa era falsa en dos de los cinco

El encargo decía que las cinco tareas habían dejado su bloque de schema en un `.md`
**sin tocar el schema**. Medido, no supuesto: **dos ya estaban aplicados.**

* **SCRUM-650 · `model JobAssignee` YA ESTÁ** en `prisma/schema.prisma`, con sus dos
  relaciones inversas cableadas (`Job.assignees`, `TeamMember.jobAssignments`). Otra sesión
  se adelantó. **No se toca nada.**
* **SCRUM-651 · `AuditAction.trabajo_creado` NO ES SCHEMA.** `AuditLog.action` es un
  `String` en la tabla; `AuditAction` es una **unión de TypeScript** en
  `src/modules/system/audit.service.ts:58` — y `'trabajo_creado'` ya está ahí, en uso desde
  `src/modules/jobs/app/routes/jobs.routes.ts:577`. No había enum que ampliar.

Si esto se hubiera escrito «según el `.md`» sin mirar el árbol, el commit habría intentado
duplicar un modelo que ya existe.

## La discrepancia de `onDelete`, y por qué no hizo falta usarla

El encargo ordenaba: `JobAssignee` lleva `onDelete: Cascade` en **ambas** relaciones, y si
el `.md` decía otra cosa, ganaba la orden. **El `.md` decía otra cosa**: su bloque solo pone
`Cascade` en la relación `job`, y deja `teamMember` sin nada (o sea, RESTRICT).

Pero **el schema real ya está bien**: lleva `Cascade` en las dos, con el motivo de SCRUM-244
escrito al lado. O sea que el `.md` de SCRUM-650 **quedó desactualizado respecto al código**
y hoy documenta una versión peor de la que está en producción. Se reporta; no se arregla aquí
porque el `.md` es registro de otra tanda.

## Lo que se escribió (commit `a88286ba`)

| Ticket | Cambio | Forma |
|---|---|---|
| SCRUM-651 | `Job.tipoIntervencion` | `String?`, sin `@default` |
| SCRUM-652 | `model ParteTrabajo` → tabla `partes_trabajo` | tabla nueva |
| SCRUM-655 | `Quote.revision` | `Int @default(0)` |
| SCRUM-656 | `Quote.ivaModo` | `String?` |
| SCRUM-656 | `Quote.clausulasExcluidas` | `Json?` |
| SCRUM-656 | `Merchant.clausulasPresupuesto` | `Json?` |

**Ningún campo nuevo queda NOT NULL sin default sobre una tabla con filas:** `revision`
lleva `@default(0)`, los otros cuatro son nullables, y `partes_trabajo` nace vacía. **No se
renombró ni se borró nada:** `git diff -w` del commit da **68 inserciones y CERO borrados**.

`prisma format` realineó 16 líneas de modelos ajenos (deriva de espacios que ya estaba). Ese
`git diff -w` es justamente la prueba de que ninguna cambió de significado.

## Verificación, SIN tocar ninguna base

`prisma validate` → **válido**, exit 0. `prisma format` → exit 0. **No se ejecutó `db push`,
ni `migrate`, ni `deploy`.** Con el CLI **del repo (6.18.0)**, nunca `npx`: `npx` se baja
`prisma@latest` cuando falta el local y responde otro binario (SCRUM-385).

---

## 🔴 EL HALLAZGO: la tabla de SCRUM-652 no puede entrar sola

**La suite en la base está VERDE ENTERA: 4472 tests, 0 fallos.** Con el schema escrito se
ponen **7 en rojo** (6 guards, uno de ellos con dos casos), todos por lo mismo: `partes_trabajo` es una tabla **multi-tenant nueva**,
y hay listas derivadas del schema que no la conocen. La población de modelos con `merchantId`
pasa de **22 a 23**.

Dos se cierran aquí porque no son territorio del fundador (commit `3b70b7b3`):

* **SCRUM-241** · `partes_trabajo` entra en `TABLES` de `scripts/backup-dump.mjs`.
* **SCRUM-172** · `parteTrabajo` entra en `MODELOS_POR_MERCHANT` (`tests/_merchant-fixture.mjs`).
  Es **columna suelta** —`merchant_id`, `job_id` y `customer_id` sin ninguna FK—, del grupo
  **MUDO**: `merchant.delete` «tiene éxito» dejando los partes huérfanos.

**Los otros cuatro NO se tocan: son condición de parada de CLAUDE.md («datos de clientes,
export/borrado»).** Necesitan GO del fundador:

| Guard | Qué pide | Por qué es parada |
|---|---|---|
| **SCRUM-192** | `parteTrabajo` en el ORDEN de borrado de merchant | es el camino de supresión RGPD |
| **SCRUM-314** (×2) | `parteTrabajo` en el barrido demo | borra datos |
| **SCRUM-498** (×2) | doce frases del árbol dicen «22» y ya son 23 | una de ellas está en `portabilidadCompleta.ts`, el camino de EXPORT |
| **SCRUM-461** | regenerar `docs/sql/deriva-prod.sql` | es el DDL que se aplica a producción |
| **SCRUM-222** | lo mismo por otra vía: el SQL del censo de producción queda desfasado | ídem |

Las doce frases viejas, nombradas por el guard: `src/app.ts:673` ·
`src/modules/exports/domain/portabilidadCompleta.ts:29` ·
`src/modules/system/domain/barridoDemo.ts:6` y `:70` · `tests/_censo-merchant-de-la-url.mjs:8` ·
`tests/scrum244-cobertura-portabilidad.test.mjs:91` ·
`tests/scrum272-criterio-referencial.test.mjs:7` y `:95` ·
`tests/scrum314-wipedemo-derivado.test.mjs:6`, `:119` y `:128` ·
`tests/scrum440-tenencia-supresion.test.mjs:18`.

**Esto no es un defecto de los guards: es lo que existen para decir.** El bloque aprobado en
`docs/master/SCRUM-652.md` describe la tabla, y no menciona ninguna de estas seis ataduras.

---

## TAREA 2 · el aviso del dictado (commit `f1a79988`)

`voiceInput.js:51` queda literal, sin corchete:
`El dictado necesita conexión — escribe el trabajo y listo`. Anotado **en el mismo acto** en
`docs/MICROCOPY_APROBADA_SIN_APLICAR.md` como **APLICADA**, con fecha y con su ancla propia.

`voiceInput.js` **sale del censo** de `tests/scrum402-marcador-no-se-pinta.test.mjs`: la
entrada se **borra**, no se pone a 0 (precedente SCRUM-424/405). Lo tenía dicho el propio
censo: «Sale del censo el commit que apruebe el texto».

**El test del marcador no se borró, se actualizó al hecho.** Vigilaba que el aviso saliera
marcado *porque el texto no estaba firmado*; al firmarse, borrarlo habría roto la única
atadura entre lo que se pinta y lo que se aprobó. Ahora vigila dos cosas más fuertes: que el
aviso sea **literalmente** el texto aprobado, y que ese texto **conste** en el `.md`.

**Probados en rojo antes de darlos por buenos.** (1) Raya larga cambiada por coma → rojo, y
el mensaje nombra los dos textos. (2) Línea retirada del `.md` con el código intacto → rojo,
que es exactamente el fallo contra el que avisó el fundador. Revertidos, verde: 9/9 y 7/7.

**Medido de paso:** quedan **44 marcas vivas** en `public/` + `src/` con este árbol. El «13»
de la cabecera del `.md` no se toca: está anclado a `a241b6e4`, es otra foto y sigue siendo
cierta para su base.
