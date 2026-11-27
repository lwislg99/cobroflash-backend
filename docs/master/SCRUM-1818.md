# SCRUM-1818 · cambiar el plan de un comercio sin tocar Railway

## SCRUM-1818 · la ruta solo-fundador `PUT /admin/plataforma/merchants/:id/plan` (24-nov-2026)

**Medido contra:** `origin/main` = `31af3ad113e357560db17b8a268147b622be10c0` · 2026-11-24T18:55:26Z
A9: comprobación → `tests/scrum1818-activar-plan-solo-fundador.test.mjs`

Puesto S1, rama `scrum-1818-activar-plan-servidor`. Encargo del orquestador (`orquestador`). Las decisiones las registró él en SCRUM-1656 c.22694.

**El problema.** En el estreno del 20-nov, para activar el plan Equipo del piloto hubo que editar a mano la celda `merchants.plan` en Railway Data. Los valores son estrictos: son las claves de `BY_PLAN` en `src/core/entitlements.ts`. Un nombre mal escrito no da error. `getEntitlements` lo trata como trial, lo avisa sólo en el log desde SCRUM-1342, y la cuenta se queda con 1 usuario.

### Corrección de la premisa del ticket

El ticket dice «en la pantalla de sistema (solo fundador)». **Esa pantalla no existe.** Lo medí en `origin/main` `a7cd8dea5`:

- `public/admin.html` es el «Panel Admin interno» de UN merchant (su perfil, su JSON y un presupuesto rápido). No lista comercios y no es solo-fundador.
- La única pantalla solo-fundador es la tarjeta «Funnel de plataforma · merchants (solo owner)» de `public/dashboard/js/reportsView.js:847-950`. Ya pinta una tabla por comercio con su columna «Plan» (`:936`, `:944`). Sus datos salen de `GET /admin/metrics/platform-funnel` (`src/modules/metrics/app/routes/metrics.routes.ts:61-74`).
- Esa tabla sólo enseña los 15 primeros comercios (`slice(0, 15)`, `:929`).

`reportsView.js` es carril S2. El orquestador decidió (c.22694):

- **①** Opción (a): S1 hace sólo el servidor, y el selector lo pinta S2 en su fichero y en su PR. Sin cruce de carril, porque esta ruta puede mergearse sola aunque nadie la llame todavía.
- **②** El recorte de 15 se quita. Va en la pieza de S2.
- **③** Firmó la microcopy del selector (regla 39, por delegación c.21978). La lleva él al encargo de S2. En esta parte no se pinta ningún texto: el servidor contesta códigos (`forbidden`, `invalid_id`, `plan_desconocido`, `merchant_not_found`, `internal_error`), no frases.

### Qué cambia en `src`

| fichero | cambio |
|---|---|
| `src/modules/system/app/routes/planAdmin.routes.ts` | **nuevo**. `PUT /merchants/:id/plan` y `esPlanConocido` |
| `src/app.ts` | el `import` y una línea de montaje: `mountAdmin(app, '/admin/plataforma', planAdminRouter)` (contenedor S1, marcadas `S1: SCRUM-1818`) |

El orden de la ruta, de arriba abajo:

1. **Rol.** `requireRole('admin')` va en la ruta. Un operario o un rol desconocido recibe 403 sin que se llegue a la base.
2. **Dueño.** `isVerifiedPlatformOwner` sobre el merchant de la SESIÓN (`findUnique` por `req.merchantId`, `select` de `email` e `isPlatformOwner`). Si no lo es, 403. Las dos puertas son las de `platform-funnel`, copiadas (SCRUM-1317 y SCRUM-102).
3. **Id.** Tiene que ser un entero positivo escrito en decimal (`/^[1-9]\d{0,9}$/`). Si no, 400 `invalid_id`.
4. **Plan.** `typeof === 'string'` y `PLANES_CONOCIDOS.includes(valor)`, comparado exacto: sin `trim` y sin pasar a minúsculas. `includes` sobre la lista no casa por herencia, así que `__proto__` y `constructor` no pasan. Si falla, 400 `{ error: 'plan_desconocido', planes: [...PLANES_CONOCIDOS] }`. **No hay caída a trial.**
5. **Comercio.** `findUnique` del comercio objetivo. Si no existe, 404 `merchant_not_found`.
6. **Escritura.** `update({ where: { id }, data: { plan } })`, sólo esa columna. No toca `planExpiresAt`, ni Stripe, ni flags. La oferta Equipo sigue siendo manual (W1).
7. **Log.** `console.info` con el id de quien llama, el id del comercio y el plan de antes y el de después. Sin correos ni nombres. La respuesta es `{ id, plan, antes }`.

Es la única ruta de /admin que escribe en un merchant que no es el de la sesión. No filtra por `req.merchantId` porque su trabajo es justo ése (regla 2). Por eso las dos puertas van antes de leer nada del comercio objetivo.

**Declaración de la ruta (una exigencia que cambia: se la he dicho al orquestador por su nombre).** El encargo decía «declarado en adminRouteDeclarations». No hace falta ninguna entrada en esa lista. `adminRouteDeclarations.ts` declara las rutas que el OPERARIO conserva (`TECNICO_ALLOWED`) y las que quedan pendientes. Una ruta de admin queda declarada con su `requireRole`, que es lo que lee la red de SCRUM-55. `platform-funnel` tampoco tiene entrada. Lo medí: si le quito el `requireRole` a esta ruta en el `dist`, `tests/scrum55-admin-fail-closed.test.mjs` se pone en rojo él solo y la nombra (`PUT /admin/plataforma/merchants/:p/plan`).

### El test

El test es puro. Usa el router real de `dist/` con `prisma` doblado, con el mecanismo de scrum1317. El doble responde `merchant.findUnique` según el id. Si la ruta toca otro modelo u otro método de `merchant`, el doble lanza en vez de contestar nada. 23 tests:

- **La puerta.** Merchant normal con rol admin → 403 y ninguna escritura. Correo de OWNER_EMAILS sin la marca en la base → 403. Operario, también el de la cuenta dueña → 403 antes de tocar la base. Rol desconocido → 403.
- **El camino bueno, que hace de control de los 403.** El fundador activa «equipo» → 200, con una sola escritura, en el comercio de la URL y con `data` exactamente `{ plan: 'equipo' }`. Queda la línea de log y no lleva `@`. Los cuatro planes de `PLANES_CONOCIDOS` se aceptan, y si la lista cambia el test lo avisa: la microcopy de S2 enumera los cuatro.
- **El typo.** 11 casos: `Equipo`, `equipo `, ` pro`, `empresa`, `''`, `__proto__`, `constructor`, `1`, `null`, `['equipo']` y sin campo. Todos dan 400 `plan_desconocido` con la lista y ninguna escritura.
- **El comercio.** Inexistente → 404. Id `abc`, `1.5`, `0`, `-3` y `077x` → 400 `invalid_id`.

**Rojo primero.** Con el test escrito y sin la ruta, el `dist` no tenía el módulo y el test salía en rojo (`Cannot find module …planAdmin.routes.js`). Con la ruta y `npm run build`: 23 de 23.

Mutaciones: `tests/scrum1818-activar-plan-solo-fundador.test.mjs` — 8 mutantes sobre el `dist` compilado, 8 rojos, con `dist` restaurado y comprobado por hash:

| mutante | resultado |
|---|---|
| M1 sin `requireRole` | ROJO: 2 de este test (operario, rol desconocido) y 1 de la red SCRUM-55, que también cae sola |
| M2 sin la puerta de dueño | ROJO, 2: el merchant normal y el correo sin marca |
| M3 `trim` + minúsculas antes de comparar | ROJO, 3: `Equipo`, `equipo ` y ` pro` |
| M4 `includes(String(valor))` sin `typeof` | ROJO, 1: `['equipo']` |
| M5 escribe también `planExpiresAt: null` | ROJO, 2: `data` no es sólo `{ plan }` |
| M6 sin el 404 | ROJO, 1 |
| M7 el plan desconocido cae a `'trial'` | ROJO, 11: los once typos |
| M8 escribe en el merchant de la sesión | ROJO, 1: el `where` |

El guion de los mutantes no se queda en git. Vivía en el temporal de la sesión.

**Otros guards de rutas, en verde:** `scrum55-admin-fail-closed`, `scrum158-montajes-admin-muestreados`, `scrum168-zona-roja`, `scrum1338-la-barra-del-operario-contra-los-gates` y `scrum128-send-endpoints-fail-closed`. Dan 31 pass. `tenancy-permisos` sale con 2 SKIP que declaran su motivo (`sin QA_DB_TEST=1 ni LIBRO_PG_URL`).

### Lo que esto NO hace

- No pinta nada. El selector, la confirmación y quitar el recorte de 15 son la pieza de S2, con la microcopy firmada en c.22694.
- No toca Stripe, ni el cobro, ni `planExpiresAt`, ni el esquema.
- No lo he verificado en yaqu.app: la ruta no tiene llamante hasta que entre la pieza de S2, y la verificación en producción va con esa pieza.
- `docs/RUNBOOKS.md:940` sigue describiendo cómo comprobar `plan = equipo` leyendo `platform-funnel`. Eso sigue siendo cierto y no lo he tocado.

## SCRUM-1818 · relevo de mañana: se empuja lo que dejó la S1 de anoche (25-nov-2026)

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T07:59:49Z
A9: sin fallo que generalice — el trabajo de anoche estaba commiteado y completo; sólo faltaba empujarlo, y eso lo cortó el límite de uso, no un error del método.

Puesto S1, relevo (la S1 de anoche murió por límite de uso). Forense del árbol `.claude/worktrees/s1-1818-plan`: rama `scrum-1818-activar-plan-servidor`, tres commits encima de `main` (`35594b0fa`, el merge `7bb77f411` y `c875d8462`), `git status --short` vacío, y en `origin` ninguna rama `scrum-1818*` (`git ls-remote --heads`). O sea, todo estaba commiteado y nada empujado.

Lo he revisado contra el diseño de SCRUM-1656 c.22694 y se queda tal cual: la puerta espejo de `platform-funnel`, la clave exacta de `PLANES_CONOCIDOS` sin `trim`, 400 `plan_desconocido` con la lista, 404, el `update` sólo de `{ plan }` y el log sin correos. Lo único que no se hace como lo decía el encargo es la entrada en `adminRouteDeclarations.ts`, y el tramo de arriba explica por qué: ese fichero declara lo que el OPERARIO conserva (`TECNICO_ALLOWED`) y lo pendiente (`PENDIENTE_CLASIFICAR`, con tope 0). Una ruta sólo-admin queda declarada con su `requireRole('admin')`, igual que `platform-funnel`, que tampoco tiene entrada. La mutación M1 lo demuestra: sin el `requireRole`, la red de SCRUM-55 cae sola y nombra la ruta.

**Lo que he hecho hoy:** fusionar `origin/main` (merge, no rebase), `npm run build` y volver a correr. El test de la pieza, junto a `scrum55`, `scrum158`, `scrum168`, `scrum1338`, `scrum128` y los tres guards de siembra que tumbaron el PR #3417 esta noche (`scrum262`, `scrum409` y `scrum1415`): 74 de 74, 0 fallos, 0 saltos. Después, la tanda entera en local (`node --test "tests/*.test.mjs"`, TAP a fichero fuera del árbol): 14.519 tests, 14.329 pass, **5 fail** y 185 skipped. Ninguno de los cinco toca este diff:

| test | por qué cae aquí |
|---|---|
| `scrum811c` · SCRUM-1340 y `scrum976` ④ | el rojo que ya tiene `main` en `77c000d` (CI run `45548131902`): el merge #3438 sin `**Skill UI:**` en SCRUM-1852.md. Lo cura el orquestador en `scrum-1852b-skill-ui` |
| `scrum1726` D1, los dos casos | el formato de fecha del ICU del Node de esta máquina (`3 de octubre de 2026, 0:30`, cuando lo esperado es `… a las 0:30`). En el CI de `main` sale verde |
| `scrum351` control negativo | 29 `node_modules` de OTROS árboles de esta máquina son enlaces rotos (`ENOENT`), los que quedaron al liberar disco el 24-nov. Es la máquina, no el repo; en CI sale verde |

## Parte S2 · SCRUM-1818b · 25-nov-2026 · S2 · selector de plan en el funnel de plataforma

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:29:35Z
A9: comprobación → `tests/scrum1818b-selector-de-plan.test.mjs`
Mutaciones: catálogo → `tests/scrum1818b-selector-de-plan.test.mjs`
**Skill UI:** cargada · ANTES de tocar la vista. Checklist AB6 sobre el diff: inventario AB3 (`select.input`,
`btn-secondary btn-sm`, `showToast`), cero `style=` nuevos en JS (la celda «Plan» conserva el suyo; el control se
monta por DOM). Una regla nueva en `styles.css` (bloque S2 `.funnel-plan`): selector y botón a 44 px de toque,
juntos y envolviendo si no caben. Botón deshabilitado hasta elegir un plan DISTINTO y durante el PUT. Capturas
antes/después medidas a 390 y 1280.

Rama `scrum-1818b-selector-plan`, desde `origin/main`. Encargo del orquestador (pieza ④, 25-nov-2026). El
servidor lo hace S1 en paralelo (rama `scrum-1818-activar-plan-servidor`, sin mergear). Esta parte NO depende de
su merge para construirse, pero SÍ para la prueba de punta a punta. ⚠️ Esa rama de S1 también crea ESTE
fichero: quien mergee el segundo junta las dos partes (add/add, sin solapes). [Escrito por la sesión, no por Luis.]

**Contrato consumido** (leído en la rama de S1, `src/modules/system/app/routes/planAdmin.routes.ts`, punta
`247eb29ac`, sin tocarla): `PUT /admin/plataforma/merchants/:id/plan` con `{ plan }` → 200 `{ id, plan, antes }`
· 400 `invalid_id` / `plan_desconocido` · 403 `forbidden` · 404 `merchant_not_found` · 500. La puerta de
fundador vive en el servidor. El id de cada comercio ya viaja en `GET /admin/metrics/platform-funnel`
(`metrics.service.ts`, `rows[].id`).

**Qué entra.**
- `public/dashboard/js/reportsView.js` (S2), tarjeta «Funnel de plataforma»:
  - se quita el `slice(0, 15)`: salen TODOS los comercios;
  - la celda «Plan» de cada fila lleva un `select` con los cuatro valores literales y «Cambiar plan»;
  - `window.confirm` con el literal firmado → `PUT` → `showToast` de éxito o del error que toque, nunca el
    texto del servidor (SCRUM-644);
  - con «Cancelar» en la confirmación, o con fallo, el selector vuelve al plan actual.
- `public/dashboard/css/styles.css` (contenedor S2): bloque `.funnel-plan`.
- `tests/scrum1818b-selector-de-plan.test.mjs` (nuevo, banco de vistas).
- `scripts/capturas-1818b-selector-plan.mjs` (nuevo, con su fila S2 en `dos-equipos.md` §3 y `carriles.mjs
  generar` → `comprobar` IGUAL) y `docs/master/evidencias/SCRUM-1818b/` (8 capturas).

**Literales** (SCRUM-1656 c.22694, byte a byte; cero textos más):
- opciones: `trial` · `pro` · `founding` · `equipo`;
- aria-label: «Plan de {nombre}»;
- botón: «Cambiar plan»;
- confirmación: «¿Cambiar el plan de {nombre} de {actual} a {nuevo}? Solo cambia el plan dentro de YaQu: no toca
  Stripe ni cobra nada.»;
- éxito: «Plan de {nombre}: {nuevo}.»;
- 400: «Ese plan no existe. Los que hay: trial, pro, founding, equipo.»;
- 403: «Solo la cuenta del fundador puede cambiar planes.»;
- 404: «Ese comercio ya no existe.»;
- otro: «No se pudo cambiar el plan. Inténtalo otra vez.»

**Rojo primero, medido** (resumen del runner): sin el código, `ℹ tests 5 · pass 0 · fail 5`. El primer rojo
lleva su CIEGO: el comercio 1 sí se ve y el 20 no, así que el rojo es el tope y no una tarjeta sin pintar. Con
el código: **5/5**.

**Mutaciones** (pasada única, guion fuera del árbol): base 5/5; las **4** del catálogo **mueren** (tope de 15 ·
confirmación saltada · PUT con el plan viejo · literal del 403 borrado).

**Regresión dirigida:** 705 ficheros de `tests/` que leen `reportsView`, `styles.css`, `public/dashboard/js`,
`apiRequest(`, trinquetes o microcopy, en lotes de 250 (la lista entera no cabe en una línea de órdenes de
Windows): 6340 tests · 6308 pass · 27 skip · **5 fail, ninguno de esta rama**:
- `scrum1340` (en `scrum811c`): el registro de SCRUM-1852 en `main`, que cura el orquestador (#3440);
- `scrum1199` ×2: este worktree no tiene `node_modules` propio y `createRequire` no encuentra `express`;
- `scrum498`: el cliente de Prisma COMPARTIDO no casa con el esquema (`_prisma-client-guard.mjs` en rojo:
  columnas de `Invoice` «falta en el cliente»). Lo coordina el orquestador, §10; esta rama no toca esquema;
- `scrum763`: `dist/` compilado en otra rama; tras recompilar, verde.

**Capturas** (`node scripts/capturas-1818b-selector-plan.mjs`, salida 0): 8 de 8, con 20 comercios.
- DESPUÉS: 20 filas; selector y botón de 44 px, dentro de la ventana, también en la última fila. A 390 se apilan
  (`[142,346,103,44]` / `[142,396,106,44]`); a 1280 van en línea (`[594,424,103,44]` / `[703,424,106,44]`). Sin
  desborde de página (la tabla conserva su scroll horizontal) ni errores de consola.
- CONTROL POSITIVO: ANTES hay 15 filas y ningún selector.

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| quitar el slice(0,15) | `tests/scrum1818b-selector-de-plan.test.mjs`, primer caso; `ultima-fila-despues-1280.png` |
| selector de plan por comercio + botón | mismo test, primer y segundo caso; `primera-fila-despues-390.png` |
| microcopy firmada byte a byte | mismo test, casos 2-5 (opciones, aria-label, confirmación, éxito, 400/403/404/otro) |
| skill yaqu-premium-ui antes de tocar la vista | la línea **Skill UI** de arriba |
| prueba de punta a punta con el servidor de S1 | NO HECHO → depende del merge de la rama de S1; después, en yaqu.app (regla 42) |

## SCRUM-1818 · el registro entrelazado, juntado a mano (27-nov-2026)

**Medido contra:** `origin/main` = `cbd15f1f0f60781a282b9179b11e6db9ecc14d2e` · 2026-11-27T10:15:49Z
A9: sin fallo que generalice — el aviso «quien mergee el segundo junta las dos partes» de la Parte S2 estaba escrito y no se cumplió al traer main; lo cazó `tests/scrum1572-registro-creado-por-dos-ramas.test.mjs` en el CI (run `45971147342`, artefacto `tanda-tap` leído fuera del árbol, único `not ok` de la tanda).

Puesto S1, relevo 2. Este fichero lo crean las dos ramas (`scrum-1818-activar-plan-servidor` y `scrum-1818b-selector-plan`, ya en main en `f1c6f6366`), y la unión de git (`merge=union`) los pegó en los merges `ec9053b28` y `c4e244328`: uno detrás de otro, con el segundo título `#` a mitad de fichero y sin línea en blanco entre las dos partes. Aquí van juntadas: primero las dos partes del servidor (24 y 25-nov), luego la Parte S2 tal cual está en main, sin cambiar una palabra de ninguna; sólo el título queda uno (el de main). Contenido: el de `e6f2079cf` (rama) más el de `f1c6f6366` (main), verificado por diff.