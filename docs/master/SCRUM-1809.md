# SCRUM-1809 · Candado de nombre de rama en el remoto, y las dos filas de §3.4 de SCRUM-1779

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T09:48:54Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum1295-carriles.test.mjs`

**Puesto:** S0 · **Rama:** `scrum-1809-candado-y-carriles` · encargo del orquestador (`cobroflash-backend-41`), en dos piezas. La ② se refiere también a SCRUM-1779.

## Pieza ② · las dos excepciones de §3.4 para J1 (SCRUM-1779) — HECHA

Dos filas al final de la tabla §3.4 de `docs/equipo/dos-equipos.md`, detrás de la de `scripts/guard-pad-de-firma-cabe.mjs`, copiadas literales del encargo:

- `src/modules/jobs/app/routes/albaranes.routes.ts` → J1, solo `POST /:id/facturar-parcial` y `POST /:id/convertir-en-factura`. Nombra las dos rutas porque la ④ se aceptó en SCRUM-1779 c.22391. Firma del fundador: c.22290. El resto del fichero sigue siendo de S1.
- `public/dashboard/js/jobDetailView.js` → J1, solo el toast tras `facturar-parcial`. Firma: c.22290. El resto sigue siendo de S2.

`.claude/carriles.json` se regeneró con `node scripts/carriles.mjs generar` (no se editó a mano): 86 filas de §3, 213 reglas, **19 excepciones**, 1 fichero escrito. `node scripts/carriles.mjs de <ruta>` devuelve las dos excepciones para J1 (líneas 277 y 278 de `dos-equipos.md`).

## Pieza ① · el guard de nombre de rama en `pr-automatico.yml` — PARADA, sin tocar

El encargo decía que parara si añadir el paso pedía más que un paso y una fila. Pide más, por dos motivos:

1. **El guard no arranca sin `node_modules`.** `scripts/guard-rama-con-numero.mjs` importa `scripts/_puerta-de-entrada.mjs`, y ese fichero hace `import ts from 'typescript'` arriba del todo (línea 59). `pr-automatico.yml` no tiene ni `setup-node` ni `npm ci`. Lo medí en una carpeta limpia fuera del repo, con solo `scripts/*.mjs` y `package.json`: sale con `ERR_MODULE_NOT_FOUND: Cannot find package 'typescript'` y código 1. Si se añadiera el paso tal cual, saldría rojo en **todos** los push `scrum-*`, y en el mismo job por delante del paso que abre el PR. Es decir, dejaría de abrir el PR de todas las ramas.
   ⚠️ Dentro del árbol, la misma prueba sale en verde, y no vale como prueba: Node resuelve `typescript` subiendo hasta el `node_modules` del checkout compartido. Un worktree sin `node_modules` no demuestra nada.
2. **El fichero no es de S0.** `node scripts/carriles.mjs de .github/workflows/pr-automatico.yml` → **S5** (patrón `.github/workflows/**`). Hace falta una excepción en §3.4 o que lo haga S5.

Opciones para el orquestador (sin elegir ninguna):
- (a) `actions/setup-node` + `npm ci` en `pr-automatico.yml`. Supone unos minutos más en cada push y que el job dependa de la red de npm.
- (b) Que J6 quite el `import` estático de `typescript` del camino del guard: un `ejecutadoDirectamente` sin AST, o un `import()` dinámico. Así el paso se queda en un paso sin instalar nada. Es fichero de J6/S0 y no toca ningún guard en rojo.
- (c) Correrlo en `ci.yml`, que ya hace `npm ci`. Pero eso no avisa en el push antes del PR: avisa en el PR, que es lo que ya pasa hoy con scrum804.

La fila de `scripts/guard-rama-con-numero.mjs` en §3.3 tampoco se ha añadido. Va con la pieza ①, cuando se decida, para que no quede una fila que anuncia un paso que no existe.

## Qué corrí

- `node --test --test-force-exit tests/scrum1295-carriles.test.mjs`: 8 tests, 8 pass, 0 fail, 0 skipped.
- La suite entera no la corrí: el cambio es una tabla de papel y su derivado. Lo decide el obligatorio del CI.
