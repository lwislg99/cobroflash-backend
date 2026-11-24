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
- **No corrido:** la suite entera (el encargo lo prohíbe por contexto); `tsc -p .` **no corrido** (el cambio es un `.mjs` de `scripts/` y un test; no toca `src/`); `guards:entrada` dio 2 rojos tras el registro: 1294 (mío, la mutación no era un literal completo: arreglado, 16/16 con 1294, 1827 y 237) y 811c/1340, que nombra el merge `8e0d408…` de `main` → `SCRUM-1810.md` (J1), no esta rama — **no** lo he vuelto a correr tras el arreglo; el meta-guard de mutaciones entero (la mutación se pasó a mano, una vez).
- **Mi error:** el encargo decía que a 145k de contexto empujara lo que tuviera; me medí a 143k sin nada escrito, seguí, y la siguiente medida fue 155k. Lo digo aquí y en la entrega.

## SCRUM-1827b · El suelo del trinquete de SCRUM-812 sube de 43 a 44: entra el test de 1827

**Puesto:** J6 (jv-j6ft) · **Rama:** `scrum-1827b-suelo-de-812` · 24-nov-2026 (Madrid)
**Medido contra:** `origin/main` = `3bbce2b4045d2065da480af9c3564843e410e454` · 2026-11-24T13:00:58Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`

Mutaciones: catálogo → `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`

- **El rojo:** el obligatorio del PR #3376 (run 45387498344) cayó en «SCRUM-812 · 🔴 EL TRINQUETE del GUARD: la cobertura auto-declarada NO BAJA» y, por arrastre, en el meta-guard parte 3. Eso lo leyó el orquestador en el log; yo no he leído ese run.
- **Medido en local** (`tsc -p .` con tipos, salida 0; después `node --test` sobre el test de 812, en la punta `1604f47c9a2c00fcae0355d17fc0c2895f51fc2b`, que lleva `origin/main` dentro: 0 commits por detrás): 6 casos, 5 pass, 1 fail, y el que cae dice «LA COBERTURA HA SUBIDO a 44 (el suelo decía 43)». **Subió, no bajó.** El fichero nuevo en la lista es `scrum1827-guard-rama-sin-typescript.test.mjs`: se titula guard y declara sus mutaciones. El diff de 1827 contra `main` toca un solo test (ese), así que la diferencia de conjunto es exactamente él.
- **Qué cambié** (solo `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`, el suelo y nada del mecanismo): `SUELO_GUARD_QUE_DECLARAN` 43 → 44, con su párrafo ⬆️ **44** en la cabecera, y la mutación ④ del catálogo, que cita la constante, de `43→42` a `44→43`. Es la corrección que hizo SCRUM-1801 en `f27071646`; sin ella, «mi ancla ④ muta la CONSTANTE» cae (lo vi caer: «el ancla aparece 1 veces y se esperaban 2»).
- **La mutación ④ (44→43) es exactamente el estado que vi en rojo** antes del cambio; no he corrido el meta-guard de mutaciones.
- **Corrido y en verde**, en una sola tanda: 812, 1827, 1801, 711 (los que nombran `guard-rama-con-numero`), 1415, 1294, 267, 854 y 719 → 94 casos, 94 pass, 0 fail; el recuento por ticket suma 94. `npm run guards:entrada`: en la entrega.
- **No corrido:** la suite entera (el encargo lo prohíbe por tope de contexto) ni los guards de navegador (`guard:lista-trabajos`, `guard:detalle-trabajo-917`), que no son de esta rama.
- **Por qué el fallo pasa por aquí y no se repite en `main`:** el trinquete ES la comprobación, y cazó la subida en el obligatorio. Lo que costó fue una vuelta de CI, porque 812 no está en `guards:entrada` y 1827 no lo corrió antes de empujar.
- **Mi error:** en el párrafo ⬆️ **44** escribí primero que el run 45387498344 «había dado lo mismo», sin haber leído su cifra; el orquestador solo me dio el caso que cayó. Lo corregí antes de commitear.
