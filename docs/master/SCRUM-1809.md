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

# SCRUM-1809 · 25-nov-2026 — Pieza ①: la fila de §3.3 (HECHA) y el paso de `pr-automatico.yml` (PREPARADO, carril S5)

**Puesto:** S0 · **Rama:** `scrum-1809-candado-workflow` · encargo del orquestador del 25-nov-2026 (cabecera de la mañana).
**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:38:43Z (cabecera `Date:` de `gh api -i zen`)
A9: comprobación → `tests/scrum1480f-un-script-nuevo-no-entra-sin-fila.test.mjs`

**Qué ha cambiado desde la parada del 24-nov.** El primer motivo ya no vale: J6 quitó el `import` de `typescript` del camino del guard (SCRUM-1827, `c5a985691`, en `main`; aviso de J6 en SCRUM-1809 c.22584). El segundo sigue: `node scripts/carriles.mjs de .github/workflows/pr-automatico.yml` → **S5**, y la decisión del orquestador en SCRUM-1809 c.22557 dice que, cuando el guard quedara autónomo, «la pieza del workflow (+ fila §3.3) pasa al encargo de S5». El encargo de hoy se la da a S0. No edito un fichero de otro carril sin una excepción en §3.4: hago la parte que es de S0 y dejo el paso preparado y medido para quien lo tenga en su carril.

## La fila de §3.3 — HECHA

- `docs/equipo/dos-equipos.md` §3.3: una fila `scripts/guard-rama-con-numero.mjs` → **J6**, por el área del ticket que lo crea. SCRUM-1801 lleva `area-j6`: lo leí en Jira hoy (etiquetas `area-j6`, `ci`, `equipo-javier`, `instrumentos`). Sus tres ayudantes (`_numero-de-rama.mjs`, `_censo-reparto.mjs`, `_hallazgos-y-ciegos.mjs`) no entran, porque los importan otros scripts.
- `scripts/_sin-fila-declarados.json`: retirada su entrada de `declarados`, en el mismo commit. `quedan` no cambia (217): el guard es posterior a la foto del 9-oct.
- `.claude/carriles.json` y `.claude/rules/carril-j6.md` se regeneraron con `node scripts/carriles.mjs generar` (89 filas, 216 reglas, 19 excepciones, 2 ficheros escritos), no a mano. `node scripts/carriles.mjs de scripts/guard-rama-con-numero.mjs` → J6, `dos-equipos.md:205`.

**Rojo primero, por mutación.** Quité la fila y dejé la entrada retirada: `tests/scrum1480f-…` sale con código 1 (6 tests, 5 pass, 1 fail) y el fallo nombra justo ese fichero: «1 fichero(s) de scripts/ sin fila en dos-equipos.md §3.3 y sin declarar: scripts/guard-rama-con-numero.mjs». Con la fila puesta otra vez y regenerado, 1480f, 1295 y 1480e salen con código 0.

## El paso de `pr-automatico.yml` — PREPARADO para S5, sin aplicar

El candado actual corre ANTES del checkout (`pr-automatico.yml:123`, y el checkout está en la `:139`). El guard necesita el árbol, así que el paso va detrás de «Traer `main`» (`:142-143`) y antes de «Detectar modo»:

```diff
       - name: Traer `main` (el rango origin/main..HEAD lo necesita)
         run: git fetch --no-tags --prune --no-recurse-submodules origin +refs/heads/main:refs/remotes/origin/main
+
+      # ── 2bis · LA RAMA TIENE NÚMERO PARA EL CENSO (SCRUM-1801) ─────────────────────────
+      # Una rama `scrum-<dígito>…` sin número para `numeroDeRama` pone en rojo scrum804 en el
+      # obligatorio de TODOS los PR. Aquí se dice en su push, antes de abrir el PR. Sin npm ci:
+      # el guard sólo importa `node:` y ficheros hermanos (SCRUM-1827).
+      - name: Candado — la rama tiene número para el censo (SCRUM-1801)
+        run: node scripts/guard-rama-con-numero.mjs
```

⚠️ **MI LECTURA, no medida en el remoto: el paso va SIN el `env: GITHUB_HEAD_REF` del diff de SCRUM-1801.** Los motivos:
- En un `push`, GitHub deja `GITHUB_HEAD_REF` vacío (sólo lo rellena en `pull_request`). Además, la documentación de Actions dice que las variables por defecto `GITHUB_*` no se pueden sobrescribir desde `env:`. Esto lo recuerdo, no lo he vuelto a leer hoy.
- El guard ya cubre el caso: con `GITHUB_HEAD_REF` vacío lee `GITHUB_REF_NAME` (`guard-rama-con-numero.mjs:57-59`), que en un push es el nombre de la rama.
- Con el `env:` también funcionaría: o se ignora, o pone el mismo valor. Quitarlo es para que el YAML no aparente algo que no hace.

**Lo medido, en una carpeta limpia FUERA del repo** (`scripts/*.mjs` copiados, sin `node_modules` en ninguno de los padres, comprobado con `Test-Path`):

| entorno | salida |
|---|---|
| `GITHUB_HEAD_REF=scrum-1809-candado-workflow` | 0 · «verde: el censo la cuenta como SCRUM-1809» |
| `GITHUB_HEAD_REF=scrum-1787aa-x` | 1 · ROJO, nombra la rama |
| `GITHUB_HEAD_REF=` vacío + `GITHUB_REF_NAME=scrum-1787aa-x` (lo que trae un push) | 1 · ROJO, «de GITHUB_REF_NAME» |
| `GITHUB_HEAD_REF=` vacío + `GITHUB_REF_NAME=scrum-1809-candado-workflow` | 0 · verde |

**CIEGO: el YAML no lo ha validado un parser.** En esta máquina no hay ninguno: ni `yaml` ni `js-yaml` en `node_modules`, ni PyYAML. Instalar uno sería una dependencia, y eso lo decide un jefe. Sólo he comprobado que la sangría coincide con la de los pasos de al lado. El primer push que lleve el paso es el que lo juzga, y el control positivo es el PR real siguiente: una rama `scrum-NNNN-…` tiene que salir verde en ese paso.

## Qué corrí

- `node --test` de `scrum1295`, `1480e`, `1480f`, `1801` y `1827`, con TAP a fichero fuera del árbol: 28 de 28 pass. La misma tanda cogió `scrum699`, que entró por el filtro de nombre («carril»), y dio 4 rojos `MODULE_NOT_FOUND ../dist/…`. Es un test de pantallas y este worktree nació sin `dist/`; no tiene nada que ver con este cambio.
- La suite entera no la corrí. El cambio es una tabla, su derivado y una entrada de JSON, y lo juzga el obligatorio del CI.
