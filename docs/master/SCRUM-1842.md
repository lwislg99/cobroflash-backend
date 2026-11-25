# SCRUM-1842 · `docs/RUNBOOKS.md` sin dos secciones con el mismo número

**Medido contra:** `origin/main` = `25ddbe90bba5cbf75e6fd125fc8045ad040f0497` · 2026-11-25T02:12:08Z

A9: comprobación → `tests/scrum1842-runbooks-sin-numero-doble.test.mjs`

Mutaciones: catálogo → `tests/scrum1842-runbooks-sin-numero-doble.test.mjs` (volver la disputa a `## R14`)

## Qué se hizo

- `docs/RUNBOOKS.md:176` «Disputa de tarjeta (chargeback)» pasa de R14 a **R28** (primer libre: R1–R27 están todos, medido con `grep -n "^## R[0-9]"`, 28 cabeceras). La de restaurar (`:530`) se queda en R14.
- `scripts/respaldo-programado.mjs:214`: el correo dice ahora `docs/RUNBOOKS.md, §R14 · Restaurar la base de datos desde un backup lógico.` Ningún test lo fijaba byte a byte (`git grep "R14" tests/` solo da los de scrum242).
- Test nuevo: ninguna cabecera `## R<n>` repetida (suelo 20) y la cita del correo casa en número Y título con su cabecera. Rojo con la copia de hoy (diff 0 contra `origin/main`): caen los dos casos («números repetidos sobre 28 cabeceras», «§R14: 2 cabeceras con ese número»); verde tras el cambio.

## Citas de «R14» (`git grep -n R14 -- docs scripts tests src`, 117 líneas, sin imágenes)

| sección | dónde | qué se hizo |
|---|---|---|
| Restaurar (queda R14) | `scripts/respaldo-programado.mjs`, `_backup-codec.mjs`, `backup-dump.mjs`, `backup-restore.mjs` (2), `src/modules/system/domain/avisoPuerta.service.ts`, tests de scrum242, `docs/master/SCRUM-242.md`, `docs/evidencias/scrum242-restauracion.md`, `SCRUM-390.md`, `SCRUM-1554.md` | nada: siguen apuntando bien |
| Disputa (pasa a R28) | `docs/YAQU_MASTER.md:462` y `:1690` | **propuesta a un jefe** (abajo) |
| Disputa (pasa a R28) | `src/` «A21.1 (R14)»: `connectWebhook.routes.ts:17,106`, `stripe.routes.ts` (2), `disputes.service.ts` (2), `invoicesAdmin.routes.ts` (1) | NO tocado: `src/` no es de J6; lo hereda el dueño de pagos |
| Disputa (pasa a R28) | `docs/SPRINT_DEMO_READY_EXT3.md:101,426` · `docs/historico/YAQU_MASTER_v5.3_pre-14jun_con-progreso.md:334,487` | NO tocado: documentos históricos fechados |
| Otra cosa | ~80 líneas «criterio R14» de `docs/master/` (regla de `ERRORES_ASESOR.md`), «R14/V» (`YAQU_MASTER.md:1133`) | no son el runbook |

## Propuesta para el máster (regla 35: la aplica un jefe)

🔴 **El máster dice que R14 ES la disputa** (Parte O, `:462` «R14 · Disputa de tarjeta…» y `:1690` «(runbook R14)»). Seguí el criterio del encargo (renumerar la de menos citas); el precio es que RUNBOOKS y máster divergen hasta que se aplique esto:
- `:462` «**R14 · Disputa de tarjeta**» → «**R28 · Disputa de tarjeta**» · `:1690` «(runbook R14)» → «(runbook R28)» · `:595` «R1-R14» → «R1-R28».
- Si el jefe prefiere que el máster no cambie, la alternativa es la inversa: restaurar a R28 (~20 citas, 1 en `src/`).

## Lo que NO se ha medido

La tanda entera NO (tope de contexto). Corridos: los de la lista del encargo que existen; resultado en el comentario de Jira.

## Mis errores

- Pasé el tope de empuje (125k) sin nada escrito: 111,9k al acabar el arranque, 131k tras clasificar las citas. Lo dije y empujé lo mínimo.

# SCRUM-1842b · se da la vuelta: la disputa vuelve a R14 y la restauración pasa a R28

**Medido contra:** `origin/main` = `4c8986e5b565ba5f0418a3279e49bb0bfb10cdc2` · 2026-11-25T02:19:43Z

A9: comprobación → `tests/scrum1842-runbooks-sin-numero-doble.test.mjs`

Mutaciones: catálogo → `tests/scrum1842-runbooks-sin-numero-doble.test.mjs` (restaurar de vuelta a `## R14`; disputa sin su título)

## Por qué se dio la vuelta

El máster (Parte O, `:462` y `:1690`; también `:1760` «R14 (disputa)») llama R14 a la DISPUTA, y el máster es la única fuente de verdad (regla 35). Decisión del orquestador (encargo de jv-j6gc): se mueve la que el máster NO nombra, la restauración. El criterio anterior («la de menos citas») era del encargo, no de j6gb.

## Qué se hizo

- `docs/RUNBOOKS.md`: `:176` vuelve a `## R14 · Disputa de tarjeta (chargeback)`; `:530` pasa a `## R28 · Restaurar la base de datos desde un backup lógico` (R28 era el que j6gb había usado: libre en cuanto la disputa vuelve).
- Citas de la restauración a R28 (17 líneas, cada una con UNA «R14», medido antes de cambiar): correo de `scripts/respaldo-programado.mjs:214` («§R28 · Restaurar la base de datos desde un backup lógico.»), `scripts/_backup-codec.mjs:25`, `scripts/backup-dump.mjs:31`, `scripts/backup-restore.mjs:192,206`, `tests/scrum242-backup-codec.test.mjs:91`, `tests/scrum242-runbook-no-se-declara-probado.test.mjs` (`TITULO` y `seccionR28`), `docs/master/SCRUM-242.md` (6), `docs/evidencias/scrum242-restauracion.md` (4), `docs/master/SCRUM-390.md:118`, `docs/master/SCRUM-1554.md:430`. Editadas en sitio, sin mover líneas.
- Test: caso nuevo «la sección R14 es la disputa, como la llama el máster» (lee el máster: si deja de decir `**R14 · Disputa de tarjeta`, sale CIEGO). Medido: verde 4/4; con el RUNBOOKS de j6gb (87730a4e) caen 2 de 4; cada mutación del catálogo tumba su caso; árbol restaurado byte a byte.

## Lo que queda fuera

- `src/modules/system/domain/avisoPuerta.service.ts:35` cita «§R14» para la restauración: es `src/`, no se toca. Pasa al dueño (comentario, no texto de usuario).
- Máster: ninguna cita a R14 apunta a la restauración (`:462`, `:1690`, `:1760` disputa; `:1133` y `:1670` otra cosa). Propuesta para un jefe: `:595` «R1-R14» ya no describe los runbooks (llegan a R28).
- Los 7 «A21.1 (R14)» de `src/` y `public/` vuelven a ser correctos: nada que hacer.

## Mis errores

- Crucé 125k (135k medido) sin haber empujado: la lectura de arranque dejó 102k. Empujo con la comprobación dirigida, no con la lista entera del encargo; lo que no corrí, en el comentario de Jira.
