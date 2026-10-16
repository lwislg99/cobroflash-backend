# SCRUM-1273 · Archivar presupuestos

**Medido contra:** `origin/main` = `fcc889928bd077ecd81776fded32ca83658e7cbb` · 2026-09-29T10:09:43Z

## Paso ② de A5 · el ALTER, escrito y SIN APLICAR (S1, s1-29a)

La medición de S2 (s2-29a) mostró que archivar necesita columna nueva: `model Quote` no tiene
`archivedAt` ni nada parecido, y `status: 'archived'` no vale (estado nuevo en lista cerrada, Parte L;
y desarchivar exigiría recordar el estado anterior).

- Fichero: `docs/sql/scrum-1273-archivar-presupuestos.sql` —
  `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);` (nullable, sin default;
  ninguna fila cambia).
- **Sin `archived_by`:** el «quién» iba a ir a `recordAudit`, que ya guarda el autor. Dos sitios para el
  mismo hecho divergirían. ⚠️ **Desde c.19655 tampoco hay auditoría** (ver «Paso ③»): el quién no queda.
- DDL derivado OFFLINE con `previewMigracion` (control positivo: 31 tablas) contra `origin/main` =
  `223498dc`, con el candidato en el scratchpad. **`prisma/schema.prisma` no se ha tocado** (regla 40).
- Anotado en `docs/MIGRATIONS_PENDING.md` con las tres bases sin marcar. Lo aplica el equipo de Javier.

**El ticket sigue aparcado:** el PR ③ (esquema + código + pantalla) no se construye hasta que la
columna esté en las tres bases.

## La mitad de S2 · la pantalla, contra el contrato firmado (s2-14oct, 14-oct-2026)

**Medido contra:** `origin/main` = `e2be1c9fda3b5ceac853b4d376f5664ac8e4df67` · 2026-10-14T08:26:53Z (`Date:` de GitHub).
**Skill UI:** cargada (`yaqu-premium-ui`).

**Error propio:** escribí mi propia regla para pintar el motivo del servidor («sólo en el 409») y
abrí la tabla de acciones dentro de la vista, sin buscar antes si la casa ya tenía la pieza. La
tenía (`mensajeParaPersona`, y el patrón `destinoAccionTrabajo`), y me lo dijeron los guards, no yo.

A9: comprobación → `tests/scrum1233-mensaje-para-persona.test.mjs`

Firmas y decisiones en SCRUM-1273 comentario 19605 (el orquestador; responde al 19604 de S2). El
reparto: **S1 primero** (esquema + `POST /admin/quotes/:id/archivar|desarchivar` + el filtro de
`GET /admin/quotes`), **S2 después**. Esta mitad se construye contra ese contrato, con un DOBLE del
servidor en el banco, y **su PR se queda en borrador y sin armar hasta que la parte de S1 esté en
`main`**. A esta hora la parte de S1 no está en `main` ni tiene PR.

| qué | dónde |
| --- | --- |
| La fila `btnBorrar` («Borrar») pasa a `btnArchivar` («Archivar»): `overflow` en `draft`, `rejected` y `expired`; `oculta` en el resto. Siguen siendo 13 filas | `quoteActionsRegistry.js` |
| `destinoAccionPresupuesto(id, estado)`: la pregunta «¿en qué destino va esta acción en este estado?» vive junto a la tabla y se expone, como `destinoAccionTrabajo` en `jobActionsRegistry.js`. Falla cerrada (null) con una acción o un estado que no conoce | `quoteActionsRegistry.js` |
| «Archivar» en la cabecera, junto a «⎘ Duplicar» (la ficha no pinta «⋮»). Se ofrece si `destinoAccionPresupuesto('btnArchivar', estado)` no es `oculta` y el presupuesto no está archivado; sin la tabla cargada, no se ofrece | `quotesDetailView.js` |
| `confirm()` con T2; T5/T6 al terminar; el fallo pasa por `mensajeParaPersona` (SCRUM-1233): el `message` del servidor si lo trae (así llega T10 en el 409), y si no, T7/T8 | `quotesDetailView.js` |
| En un archivado (`archivedAt` del detalle), el aviso T3 con «Desarchivar» (T4), en cualquier estado | `quotesDetailView.js` |
| «Archivados» en el selector de estado: se pide con `?archivados=1`, no con `status`; su vacío dice T9 | `quotesListView.js` |
| El viaje entero con las dos pantallas montadas, la tabla contra la pantalla en los seis estados, cancelar, el 409 y los otros fallos | `tests/scrum1273-archivar-presupuesto.test.mjs` |
| Los textos, literales | `docs/microcopy/2026-10-14-SCRUM-1273-archivar-presupuestos.md` |

**Dos guards cambian a propósito, porque la conducta cambia:**
- `tests/scrum421-registro-presupuesto.test.mjs` («los trece rótulos»): `btnBorrar: 'Borrar'` →
  `btnArchivar: 'Archivar'`, y un assert más: `btnBorrar` no vuelve a la tabla.
- Censo 1157 (`scripts/_censo-convenio-microcopy-declarados.json`): `btnBorrar` sale de «acusadas» y
  entra en «retiradas» con su motivo. `btnArchivar` lleva la firma en su línea y sale APROBADO como
  firma PROPIA, no de grupo. La CLI: `0 nuevas · 0 que sobran · 34 acusadas · 170 aprobadas por grupo`
  (antes, 35 acusadas). Era la última hoja de SCRUM-1215 en el carril de S2.

**Cinco guards se pusieron en rojo con la primera versión, y se arregló el CÓDIGO, no los guards:**
- `scrum837` (decisión encerrada): la ficha abría `QUOTE_ACTION_REGISTRY` ella misma → la pregunta
  pasa a `destinoAccionPresupuesto`, expuesta junto a la tabla.
- `scrum1233` (un `.message` pintado a mano): leía `err.data.message` con su propia regla → pasa por
  `mensajeParaPersona`, la de la casa. Mi regla («sólo en el 409») era una variante nueva.
- `scrum713c` (estilos escritos desde JS): el aviso llevaba `style.cssText` → `alert info` dentro de
  una `detail-section`, clases que ya existen.
- `scrum1415` (tests de nombre construido): el bucle por estados → `casosEscritos`, nombres literales.
- `scrum514` (texto aprobado sin aplicar): T10 estaba en la ficha de microcopy y lo aplica la ruta
  de S1, no esta pantalla → sale de la sección de literales; se explica en la ficha.

**Rojos de la tanda que NO son de esta rama:** 11, en `scrum222`, `scrum235`, `scrum245`, `scrum252`,
`scrum461`, `scrum733` (el cliente Prisma del `node_modules` compartido va por detrás del esquema: el
`npm run build` local da 5 errores de tipos por eso) y `scrum1321` (el temporal está en otra unidad).
**Base:** los mismos 7 ficheros sobre `origin/main` = `e2be1c9f` sin mis cambios dan los mismos 11 rojos.

**Desviación declarada:** el comentario 19604 decía que también cambiaba `tests/scrum984-…:509-511`.
**No ha hecho falta:** esas líneas cuentan 13 filas y comparan el conjunto de la tabla con el de los
rótulos; con el cambio de nombre en los dos sitios siguen siendo 13 e iguales. El fichero no se toca.

**Control positivo:** dos mutantes, uno en cada pantalla, ponen rojo el viaje: pedir «Archivados» como
`status=archivados`, e invertir el `archivedAt` que la ficha guarda tras el POST.

**Lo que NO prueba, y lo que no hace:**
- **Que la ruta de verdad cumpla el contrato.** El doble lo da por hecho. Eso lo prueban los tests de
  S1 en su PR y el viaje en yaqu.app con la cuenta QA, que queda POR HACER cuando entren las dos mitades.
- **Un POST vencido** (`incierto`, SCRUM-459) no dice «no se pudo»: la ficha se vuelve a leer del
  servidor, que es quien sabe si quedó archivado. No lleva texto nuevo, y no está en el banco.
- **El CSV:** con «Archivados» elegido, el enlace de exportación es el de «Todos los estados»
  (decisión 2: archivar no saca nada del CSV).
- Los textos dicen «presupuesto» también donde el panel dice «cotización» (MX, CO, PE, CL): la firma
  es del literal.
- La marca «Archivado» en el buscador: sin construir, como decidió el comentario 19605.

## La mitad de S2 · el rol (s2-14oct-b, 14-oct-2026)

**Medido contra:** `origin/main` = `05808c319acc9eb6b10ad04d23a4245141c64d6f` · 2026-10-14T16:59:59Z (`Date:` de GitHub), traído a la rama con `git merge`.
**Skill UI:** no cargada · no cambia marcado, clases, estilos ni textos: la ficha deja de crear dos botones que ya existían para quien no es admin.
A9: sin fallo que generalice — el hueco lo encontró esta misma sesión al leer la rama antes de pasarla a lista (c.19728), y el orquestador dio paso en el mensaje de las 16:5xZ.

**Qué pasaba.** La ficha ofrecía «Archivar» y «Desarchivar» mirando sólo el ESTADO. Las dos rutas de S1 son
`requireRole('admin')` (`quotesAdmin.routes.ts:994` y `:1027` en `scrum-1273-archivar-presupuestos`), y a otro
rol le contestan 403 `{error:'forbidden', required_role:'admin'}`, sin `message`. Así que un Técnico habría leído
el respaldo «No se pudo archivar el presupuesto. Inténtalo de nuevo.», y reintentar no le serviría de nada.

**Qué cambia.** Los dos botones salen sólo con `window.appUserRole === 'admin'`, la misma comparación que hace
`requireRole`. En la ficha conviven también `!== 'tecnico' && !== 'operario'`; no la uso, porque no es la de la
ruta. El aviso «Presupuesto archivado. No sale en tu lista de presupuestos.» lo sigue viendo cualquier rol, porque
para él también es cierto. Sin texto nuevo (aprobado así por el orquestador).

**Verificado, ejecutando.**
- `tests/scrum1273-archivar-presupuesto.test.mjs`: tres casos nuevos (`tecnico`, `operario` y el CONTROL `admin`
  con el mismo servidor): **16 de 16**.
- **Control positivo**, con la ficha de la punta anterior (`aa73f807`) puesta con `git restore --source=HEAD`:
  caen EXACTAMENTE los dos de rol (14 de 16), y el control de admin pasa.
  ✗ El primer intento de control, escrito con `git show | Set-Content`, hizo caer los 16: PowerShell 5.1 estropea
  los acentos. Era el instrumento, no el código. No cuenta.
- 30 ficheros de `tests/` que nombran `quotesDetailView` o `archivar`: 281 de 281. La suite completa NO, en
  local (1.112 MB libres). La corre el CI.

**Abierto, y no es de esta pantalla:** `GET /admin/quotes?archivados=1` no exige rol, así que un Técnico SÍ ve
la lista de archivados. Si eso tiene que ser sólo de admin, es servidor y lo lleva S1 (lo pasa el orquestador).

**No se puede ver en yaqu.app por el camino de un rol:** `test-login` sólo abre propietarios. Visto en el banco.

**Al traer `main` con la mitad de S1 dentro (#2448, ~17:10Z):** un conflicto, uno solo. Las dos mitades habían
creado la MISMA ficha de microcopy (`docs/microcopy/2026-10-14-SCRUM-1273-archivar-presupuestos.md`): S1 con T10
y S2 con T1–T9. Ahora es una ficha con los diez, y ningún literal ha cambiado. Después del merge: 235 ficheros de
`tests/`, 2.378 casos, 0 fallos, 6 saltos (cada uno con su motivo de banco). Y el control de rol, otra vez con la
ficha de `aa73f807`, sigue cayendo en exactamente los 2 casos: la ruta no hace lo que hace la pantalla.

**El PR #2449 se quedó BLOCKED con todo en verde (s2-15oct, 15-oct-2026 15:42Z, `Date:` de GitHub).** Medido en
la punta `55f3491b`: el único obligatorio del ruleset `protect-main`, «build + tests (con banco desechable)», dio
`success` (job 116001990037, 14-oct 17:45:07Z). Ruleset no estricto, sin cambios desde agosto, 0 revisiones
exigidas. Los 8 commits llevan autor. El último push fue de una persona y no del bot. `merge-tree` contra `main`
`73e41ab0` da 0 conflictos. Aun así, `mergeStateStatus=BLOCKED`, y el orquestador lo vio seguir igual con el
auto-merge desarmado. **Desatascado con un push nuevo, este mismo commit. La causa del BLOCKED NO se identificó.**
No era el caso del push del bot, que ya está descartado. Si con esto entra, sabremos que un push lo cura, no por qué.
## Paso ③ · la parte de S1: esquema, las dos rutas y el filtro de la lista (S1, 14-oct-2026)

**Medido contra:** `origin/main` = `3c25452545a3b7092fb284df8a57b4f203f7a8a8` · 2026-10-14T08:27:28Z
A9: comprobación → `tests/scrum1273-archivar-presupuestos.test.mjs`

Carril S1 · árbol `s1-1273` · rama `scrum-1273-archivar-presupuestos`. Contrato del orquestador en SCRUM-1273 c.19605 (decisiones 1, 2 y 3 aprobadas; T10 firmado). La pantalla es de S2, en otro PR.

**El esquema.** `archivedAt DateTime? @map("archived_at")` en `model Quote`. `node scripts/preview-migracion.mjs --desde <schema de main>` (control positivo: 33 tablas) da exactamente el ALTER del paso ②: `ALTER TABLE "quotes" ADD COLUMN "archived_at" TIMESTAMP(3);`, aditivo. Que esté en las tres bases lo dice `docs/MIGRATIONS_PENDING.md`; **no lo he medido en ninguna** (ningún árbol tiene claves de BD, y no consulto producción). Lo mide el job «constancia del ALTER» del PR, que **es informativo y NO impide el merge**: por eso el PR se queda en borrador y sin auto-merge hasta que alguien lea ese job (decisión del orquestador, 14-oct).

**Lo construido:**

| pieza | dónde | conducta |
|---|---|---|
| `POST /admin/quotes/:id/archivar` | `quotesAdmin.routes.ts` | `requireRole('admin')` (el mismo criterio que `/tags`). Lee por `id` y `req.merchantId`; si no es archivable, 409 `no_archivable` con T10. Escribe SÓLO `archivedAt`, con el estado leído en el `where` (patrón 1276). Archivar dos veces no mueve la fecha. Sin auditoría (c.19655). |
| `POST /admin/quotes/:id/desarchivar` | ídem | vuelve a NULL; sobre uno no archivado no escribe. Sin auditoría (c.19655). |
| qué se puede archivar | `src/modules/quotes/domain/archivado.ts` | `draft`, `rejected`, `expired` (c.17511), **salvo un `draft` cuyo cobro está pagado o pendiente**: la lista lo pinta «pagado»/«pendiente», y archivarlo contradiría T10 y escondería dinero. Con el cobro caducado la lista dice «caducado» y se archiva. |
| la lista | `listQuotesAdmin` + `GET /admin/quotes` | sin el parámetro, fuera los archivados; `?archivados=1`, sólo ésos. El otro llamador (`GET /admin/albaranes/presupuestos`) NO filtra, por la decisión 2. La fila lleva `archivedAt`. |
| el detalle | `getQuoteDetailAdmin` | devuelve `archivedAt`. |
| decidir desarchiva (decisión 1) | `quotes.routes.ts` (aceptar y rechazar del cliente) y `quoteAdmin.ts` (`acceptQuoteAdmin`, `rejectQuoteAdmin`) | `archivedAt: null` en el mismo `update` que cambia el estado. Si la decisión no entra (409), no se toca. |

**Dos decisiones mías, declaradas para que se confirmen:**
- ~~**`AuditAction` gana dos acciones** (`presupuesto_archivado`, `presupuesto_desarchivado`).~~ **RETIRADO (c.19655):** el orquestador decidió NO ampliar `AuditAction` (unión cerrada, ampliarla es cambio de máster, SCRUM-651) y cambió su propio contrato de c.19605. Archivar y desarchivar **no escriben auditoría**: hoy **no queda registro de quién archivó**, y queda dicho aquí. No se usa una acción parecida de las que ya existen. Los tests lo fijan (`auditorias.length === 0`).
- **Sólo admin.** Abrírselo al técnico es quitar un gate. **Aprobado en c.19655** (un Técnico recibe 403).
- **Un borrador con el cobro pagado o pendiente no se archiva.** **Aprobado en c.19655.**

**Camino de emisión:** en `POST /quote/:token/decision` la línea va en el `update` de la decisión, que está ANTES de `crearFacturaEmitida` (línea 637 del fichero de `main`) y DESPUÉS de sellar la evidencia de la firma (que se arma con el presupuesto leído, sin esta columna). No se toca nada de la emisión.

**Verificado, ejecutando:** `tests/scrum1273-archivar-presupuestos.test.mjs` (11) y `tests/scrum1273-decidir-desarchiva.test.mjs` (3), por la ruta real con base doblada. Control positivo por mutación sobre `dist`: quitar el estado del `where` tumba sólo el test de la carrera; quitar el filtro, sólo el de la lista; quitar `archivedAt: null` de la decisión del cliente, sus dos; el de `quoteAdmin`, el suyo.

**NO hecho:** la decisión por el BOT de WhatsApp (`whatsappIncoming.routes.ts:485` y `:554`, aceptar y rechazar) NO desarchiva: es el canal de J2 y no lo toco. Un cliente que acepte un archivado por el botón de WhatsApp lo deja aceptado y fuera de la lista. Lo dice el ticket.