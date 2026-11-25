# SCRUM-1818 · cambiar el plan de un comercio sin tocar Railway (la parte del servidor)

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