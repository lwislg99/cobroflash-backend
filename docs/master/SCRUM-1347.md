# SCRUM-1347b · 26-oct-2026 · Las filas 3 y 4 de S1, medidas por la ruta montada, y la nota de la fila 1 propuesta para firma

**Medido contra:** `origin/main` = `6d5bf76c5bf02142e762ca2ddd3d2ae2b92f9a3e` · 2026-10-26T22:57:23Z (al empujar, `main` = `31d0bbae3`: 3 commits más, ninguno toca `src/` ni `docs/YAQU_MASTER.md`)
**Rama:** `scrum-1347b-filas-3-4` · **Puesto:** J4 (sesión `jv-j4al`; el hook de arranque dijo «SIN IDENTIDAD», SCRUM-1498) · **Solo docs:** no toca `src/`, `public/`, `docs/YAQU_MASTER.md`, el camino de emisión, el esquema ni ninguna base.

A9: aviso → cicatriz J4 «en la sonda de las filas 3 y 4 de S1 salieron NO-MONTADA para el admin cinco rutas cuyo manejador sí corría: su 404 propio tenía el mismo cuerpo que el 404 global, y casi lo llevo como un positivo flojo» — no se pudo comprobar: la sonda es de un solo ticket y nada obliga a la siguiente a no fiarse de un 404 con el mismo cuerpo que el global

El registro de la fila 1 ya aplicada (14-oct-2026, PR #2432) vive en `docs/master/SCRUM-1016.md`, apartado «3 · SCRUM-1347». Este fichero empieza con la medición que faltaba.

## Encargo

Del orquestador (`cobroflash-backend-8b`), 26-oct: SOLO MEDIR Y PROPONER. ① Las filas 3 y 4 de S1, ejecutando los manejadores reales con rol `tecnico` por la ruta montada, con el admin de positivo. ② El literal de la nota que pide el ticket, para firma del fundador. Viene del veredicto del auditor (`docs/master/evidencias/SCRUM-1496f/salida/veredicto-lote-N01.md:13`): ② «espera el literal firmado de la nota», y `SCRUM-1016.md:751`: «Las filas 3 y 4 no se midieron contra el código».

## Las filas (`docs/YAQU_MASTER.md`, igual a `6d5bf76c5` y a `31d0bbae3`)

- `:672` `| Marcar pagado / deshacer | ✅ | ❌ |`
- `:673` `| Configuración, datos fiscales, Connect, flags · billing/plan · equipo · exports | ✅ | ❌ |`

## Cómo se midió

`docs/master/evidencias/SCRUM-1347b/filas-3-4.mjs`, sobre el banco de la casa `tests/_banco-camino-real.mjs`: la app real de `dist/app.js` (compilado con `tsc --noCheck` en este árbol) por HTTP, con `requireAuth` y `requireRole`, y Prisma doblado. Cada ruta, con sesión de Técnico y con la del propietario (admin). Red cortada fuera de 127.0.0.1 (0 intentos de salir) y no arranca con credenciales en el entorno.

- Población: las 192 rutas `/admin` montadas, enumeradas como `tests/scrum55-admin-fail-closed.test.mjs`, más 2 sembradas. **El reparto de rutas a cada fila es mío**: la fila nombra capacidades, no rutas.
- Positivo sembrado: una ruta de mentira con `requireRole('admin')` sale CIERRA para el Técnico y LLEGA para el admin; otra sin gate sale LLEGA y escribe. Con `--sin-sembrar` la sonda dice CIEGO y sale 2 (`filas-3-4.sin-sembrar.salida.txt`).
- Salida entera: `docs/master/evidencias/SCRUM-1347b/filas-3-4.salida.txt`.

## Lo medido

| fila | rutas que deciden | Técnico | admin (positivo) |
|---|---|---|---|
| 3 · Marcar pagado / deshacer | `PUT /admin/invoices/:id/status`, `POST /admin/invoices/bulk-paid`, `POST /admin/charges/:id/confirm-bizum` | 3 de 3: 403 del gate, 0 escrituras | 3 de 3 llegan a su manejador |
| 4 · Configuración, datos fiscales | `PUT /admin/merchant`, `POST /admin/onboarding/{complete,serie,serie/previa}`, `GET /admin/merchant/public-profile-qr` | 5 de 5: 403 | 5 de 5 llegan |
| 4 · Connect | 4 rutas `/admin/connect/*` | 4 de 4: 403 | 4 de 4 llegan |
| 4 · flags | **ninguna ruta montada** | — | — |
| 4 · billing/plan | 4 rutas `/admin/billing/*` | 4 de 4: 403 | 4 de 4 llegan |
| 4 · equipo | 5 rutas `/admin/team*` | 5 de 5: 403 | 5 de 5 llegan |
| 4 · exports | 11 rutas `/admin/exports/*` | 11 de 11: 403 | 11 de 11 llegan; `fees.csv` le da 403 al admin también (sólo cuentas owner, `exports.routes.ts:456`) |

**Total: 32 rutas que deciden, 0 llegan al Técnico.** Las vecinas, que no deciden la fila, también cierran: 3 de cobro (`payment-anomaly`, `garantia`, `garantia/liberar`) y 10 de libros e informes.

Ver la configuración (`GET /admin/merchant`): el Técnico recibe 200 con el perfil reducido de `src/app.ts:680-702`, y le llegan **0 de 4** marcas fiscales y bancarias (NIF, IBAN, Bizum, serie) y no le llega el flag sembrado; al admin le llegan las 4.

**Las filas 3 y 4 se cumplen para el Técnico.** Hay un hallazgo en la columna del admin, abajo.

## Hallazgo · «flags» ✅ para el admin no lo hace la app

- Ninguna de las 192 rutas `/admin` lleva «flag» en el camino.
- `PUT /admin/merchant` del admin con `{name, flags}` en el cuerpo escribe el nombre (control) y **no escribe `flags`**.
- En `src/`, la única escritura de `Merchant.flags` es `cambiarFlagFiscal` (`src/modules/system/domain/flagFiscal.service.ts:136`), y su único llamador es `scripts/cambiar-flag-fiscal.mjs`. Barrido: `grep -rn -E "flags\s*:" src` filtrando escrituras; el positivo es esa misma línea `:136`.

El ❌ del Técnico se cumple; el ✅ del admin para flags lo hace un script, no la app. No lo arreglo: es texto del máster y pide firma. Va como pregunta P2 en el comentario de Jira.

## La nota de la fila 1

Según `SCRUM-1016.md:749`, la nota no se escribió porque el ticket no daba su literal. Los literales propuestos y dónde iría cada uno están en el comentario de entrega de SCRUM-1347, para que los firme el fundador. `docs/YAQU_MASTER.md` → `node scripts/carriles.mjs de` dice «SIN CERRADURA · un jefe» (`docs/equipo/dos-equipos.md:202`). No lo he tocado.

## Lo que NO se midió

- Contra Prisma de verdad: el doble no aplica el `where`. Aquí no importa, porque el 403 sale del gate antes de cualquier consulta, pero tampoco se ha visto.
- En pantalla: se midió por API. No he mirado qué botones pinta el panel al Técnico.
- Rutas fuera de `/admin` (webhooks, `/pay/*`, `/dev/*`): no son de la tabla S1, y no las he medido.
- Suite entera en local: NO CORRIDA (lo pidió el encargo). Los guards dirigidos están en la entrega.

## De paso: mi fallo

En la primera pasada, cinco rutas salieron NO-MONTADA para el admin (`confirm-bizum`, `garantia`, `team/:id`…). Pero stderr enseñaba sus manejadores corriendo (`member_not_found`): su 404 tiene el mismo cuerpo que el 404 global. La sonda ahora apunta las consultas del doble, y sólo llama NO-MONTADA a lo que no consulta nada. En la segunda pasada, el positivo flojo es 0.

# APÉNDICE · 26-oct-2026 · SCRUM-1347c · Las filas 1 y 4 de S1 llevan los literales firmados

**Medido contra:** `origin/main` = `7a86ed067d597d9c3bcb5d8ca6756796efbec453` · 2026-10-26T23:13:53Z
**Rama:** `scrum-1347c-master-filas` (lleva dentro, por merge, la rama `scrum-1347b-filas-3-4` de PR #2906, por orden del orquestador: los dos tramos van en este fichero) · **Puesto:** J4 (sesión `jv-j4am`; el hook de arranque dijo «SIN IDENTIDAD», SCRUM-1498) · **Carril:** `node scripts/carriles.mjs de docs/YAQU_MASTER.md` → «SIN CERRADURA · un jefe» (`docs/equipo/dos-equipos.md:202`); lo encarga el orquestador `cobroflash-backend-8b`.

A9: sin fallo que generalice — el cambio son dos celdas copiadas de la firma; se cotejaron con `git diff -U0` contra el comentario de Jira y con `git diff --numstat` (2 y 2 en el máster, nada más), y no hubo tropiezo que convertir en comprobación.

## La firma

SCRUM-1347 c.20965 (orquestador J, por cuestionario al fundador): **P1-A** y **P2-A** de los propuestos en c.20962 (tramo 1347b, arriba).

## Lo aplicado

- `docs/YAQU_MASTER.md:670`, fila 1: la nota va en la propia celda del Técnico, con el literal de P1-A.
- `docs/YAQU_MASTER.md:673`, fila 4: «flags» dice cómo se cambian, con el literal de P2-A.

Ninguna línea se mueve: el máster tiene las mismas líneas que en `7a86ed067`, y `git diff --numstat` da `2 2` sólo para ese fichero. Las citas `YAQU_MASTER.md:670` del repo (`SCRUM-1016.md:743`, `SCRUM-1554.md:168` y `:246`) siguen apuntando a la misma fila; son historia y dicen lo que había cuando se escribieron.

## Lo que NO se hizo

- No se ha tocado ninguna otra fila ni ningún gate del código.
- Suite entera en local: NO CORRIDA (lo pidió el encargo). Los guards dirigidos y el obligatorio de CI van en la entrega.
