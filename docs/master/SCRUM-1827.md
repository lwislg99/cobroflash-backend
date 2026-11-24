# SCRUM-1827 · `guard-rama-con-numero.mjs` arranca sin `node_modules` (para el candado de `pr-automatico.yml`, SCRUM-1809)

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T11:34:30Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum1827-guard-rama-sin-typescript.test.mjs`

Mutaciones: catálogo → `tests/scrum1827-guard-rama-sin-typescript.test.mjs`

**Puesto:** J6 (`jv-j6fn`) · **Rama:** `scrum-1827-guard-rama-sin-typescript` · encargo del orquestador J (`cobroflash-backend-2d`). Carril J6: el guard (SCRUM-1801, `area-j6`), su test y este registro. `scripts/_puerta-de-entrada.mjs` y `scripts/_numero-de-rama.mjs` NO se tocan: `carriles.mjs de` los da «SIN CERRADURA», sólo la fila general de `scripts/`.

## La cadena, medida

Imports estáticos desde el guard: 5 ficheros (`guard-rama-con-numero`, `_numero-de-rama`, `_censo-reparto`, `_puerta-de-entrada`, `_hallazgos-y-ciegos`). Especificadores que no son `node:` ni relativos: **uno**, `typescript`, y sólo desde `_puerta-de-entrada.mjs` L59, que lo carga para su censo de puertas frágiles, no para `ejecutadoDirectamente` (`realpath` a los dos lados, sin AST). El guard sólo usaba la puerta.

## Reproducción en limpio (`C:\Users\Public\tmp-jv-j6fn\limpio\scripts\`, los 5 ficheros copiados)

- Ningún `node_modules` en esa carpeta ni en sus padres; `node -e "require.resolve('typescript')"` allí: salida 1, `Cannot find module 'typescript'`. Control positivo: desde el repo resuelve.
- **Código de hoy** (`NODE_PATH=` vacío, `GITHUB_HEAD_REF=…`): `scrum-1801-x` → salida 1, `ERR_MODULE_NOT_FOUND` · `Cannot find package 'typescript'`; `scrum-1787aa-x` → lo mismo. Verde y rojo, indistinguibles.
- **Con el arreglo:** `scrum-1801-x` → salida 0, «1 rama mirada: scrum-1801-x (de GITHUB_HEAD_REF) · verde: el censo la cuenta como SCRUM-1801.» · `scrum-1787aa-x` → salida 1, «ROJO: tu rama `scrum-1787aa-x` no tiene número…».

## Qué se cambió

El guard ya no importa `_puerta-de-entrada.mjs`: lleva su propia puerta, `esPrincipal`, con el mismo mecanismo de SCRUM-765. Son dos anclas de una comprobación (A10), así que el test las ata **por comportamiento** sobre seis pares (mismo fichero, otro fichero, sin `argv[1]`, vacío, URL `data:`, fichero que no existe): si divergen, rojo. Es el mismo arreglo que 1801 hizo con el filtro de scrum804.

El test (`tests/scrum1827-guard-rama-sin-typescript.test.mjs`) deriva la cadena del fuente (no la escribe a mano), la copia a un `mkdtemp` de `os.tmpdir()`, comprueba que allí `typescript` NO resuelve (si resuelve: CIEGO, el ensayo no mide) y lanza el guard sin `NODE_PATH`. Una cadena mal derivada falla cerrada (`ERR_MODULE_NOT_FOUND`).

**Rojo primero:** con el guard de hoy, el fichero cae entero (0/1: no exporta `esPrincipal`). **Mutación del catálogo** sobre `c5a9856912b6c74c1d90c20855b854b52f599bbf` («vuelve el import estático» de `_puerta-de-entrada.mjs`): `git diff --numstat` = `1 0`; caen «en limpio, VERDE para `scrum-1801-x`» y «en limpio, ROJO…», con `ERR_MODULE_NOT_FOUND` en la salida; árbol restaurado, `git status --porcelain` vacío.

## Para Luis (S0) · el paso de `pr-automatico.yml` (SCRUM-1809) — solo propuesto, sin cambios desde `docs/master/SCRUM-1801.md`

```diff
+      - name: Candado — la rama tiene número para el censo (SCRUM-1801)
+        env:
+          GITHUB_HEAD_REF: ${{ github.ref_name }}
+        run: node scripts/guard-rama-con-numero.mjs
```

**Ya arranca sin `node_modules`** (este ticket): no hace falta `npm ci` ni `setup-node` para este paso, sólo el `actions/checkout` que el job ya tiene. Probado en Windows con Node v24.18.0; el runner `ubuntu-latest` trae su propio Node, que **no he probado** (el guard sólo usa `node:child_process`, `node:fs`, `node:url` e imports relativos).

## Qué corrí y qué no

- **En verde:** el test nuevo (4/4) y el de 1801 (7/7) juntos: 11/11. En una tanda, 1327, 1480f, 711, 976, 237, 1415, 1294, 267, 854, 719, 1801 y 1827: 126 tests, 124 pass y 2 rojos **antes** de escribir este registro (854 ② pide registro a una rama que toca código; 976 ④ corre `guards:entrada`, que contiene 854). Tras el registro, ver la entrega.
- **No corrido:** la suite entera (el encargo lo prohíbe por contexto); `tsc -p .` no aplica a un `.mjs` de `scripts/`, pero se corrió igual (ver la entrega); el meta-guard de mutaciones entero (la mutación se pasó a mano, una vez).
- **Mi error:** el encargo decía que a 145k de contexto empujara lo que tuviera; me medí a 143k sin nada escrito, seguí, y la siguiente medida fue 155k. Lo digo aquí y en la entrega.
