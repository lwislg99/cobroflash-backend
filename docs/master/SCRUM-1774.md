# SCRUM-1774 · «Bizum disponible» con una sola respuesta: las rutas del panel no veían el override por comercio

## SCRUM-1774a

**Medido contra:** `origin/main` = `37076a391924becc91cbe4fe1a0c40c06ed16635` · 2026-11-19T18:19:17Z (hora de GitHub; sesión J2 `jv-j2da`, por encargo del orquestador `cobroflash-backend-c7`)

A9: comprobación → `tests/scrum1774a-bizum-override-en-admin.test.mjs`
Mutaciones: catálogo → tests/scrum1774a-bizum-override-en-admin.test.mjs

**Origen.** SCRUM-1732 c.22174 (jv-j2d8). Ese hallazgo estaba **leído en el código, no visto en pantalla** (lo dice el propio comentario); el encargo lo llamaba «medido en staging». Lo que se midió en staging fue que el override del comercio 2 da ON con `isFlagEnabled`; la discrepancia de las rutas se mide aquí, por primera vez, ejecutándolas.

**Qué pasaba.** Las tres rutas llaman a la MISMA función, `isFlagEnabled('BIZUM_MANUAL_ENABLED', { merchant })` (`src/core/flags.ts`, merchant > país > env). No había lógica duplicada que unificar: el defecto era **qué comercio le llegaba**. `confirm-bizum` (`chargesAdmin.routes.ts`) pide `flags` en su `select`; `GET /admin/connect/status` (`connect.routes.ts`) no lo pedía, la función recibía un comercio sin override y contestaba el global.

**Rojo primero** (contra el `dist/` de `main` 37076a391, sin el arreglo): `tests/scrum1774a-bizum-override-en-admin.test.mjs` → 6 casos, 4 pasan y 2 caen: ① (`/admin/connect/status` con override ON y global OFF da `bizumEnabled: false`) y ⑥ (las dos rutas discrepan). Positivo ④ en verde ya antes: `confirm-bizum` con override ON pasa la puerta del flag. Controles ② y ③ (override false, sin override) en verde.

**Cómo prueba.** Ruta MONTADA: los routers reales de `dist/` sobre express, sesión de `reqDeSesion` (`tests/_arnes-de-router.mjs`, SCRUM-1344), no el handler sacado de `route.stack`. El doble de prisma devuelve **sólo lo que pide el `select`**, como Prisma: la fila tiene `flags`, y lo que el test mide es si la ruta la pide. `axios` (el post-pago encadenado de `confirm-bizum`) se sustituye en `require.cache`: no sale ninguna petición. El global se fija a `false` en el propio test.

**El cambio.** `flags: true` en el `select` de `GET /admin/connect/status`. La columna no sale en la respuesta (lo comprueba ①). Build con tipos (`tsc -p .`): salida 0.

**Mutaciones** (catálogo del test, `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, base limpia 6/6): quitar `flags: true` del `select` → VIVA (cae ① y ⑥); volver a leer el global (`isFlagEnabled('BIZUM_MANUAL_ENABLED')` sin comercio) → VIVA (cae ① y ⑥). Árbol restaurado después (`git diff --stat`: sólo el arreglo).

**NO HECHO — fuera de carril (`src/app.ts` es contenedor de S1: `node scripts/carriles.mjs de src/app.ts` → S1).** El mismo defecto, sin arreglar:
- `GET /admin/me` · `src/app.ts:484` (`bizumManualEnabled`) y `src/app.ts:495` (`bizumSinTelefono` → `flagBizum`): el comercio se arma como `{ id, country }`, sin `flags`.
- `GET /admin/merchant` · `src/app.ts:751` (`viasDeCobro` → `flagBizum`): igual, `{ id, country }`, aunque la fila leída SÍ trae `flags` (lo usa unas líneas antes para `publicProfileEnabled`).
El arreglo en los tres es pasar `flags` al comercio (como en `app.ts:745-747`). Lo hace S1 o se declara la excepción de carril.

**Lo que no generaliza todavía.** El fallo de fondo es «pasar a `isFlagEnabled` un comercio sin `flags`», y puede repetirse en cualquiera de sus 42 llamadas (`grep -rn "isFlagEnabled(" src/`, 19-nov). El test de aquí sólo lo impide en esta ruta. Hacer `flags` obligatorio en el tipo de `FlagContext` lo convertiría en error de compilación, pero `src/core/flags.ts` es de S1.
