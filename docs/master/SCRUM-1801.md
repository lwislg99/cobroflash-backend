# SCRUM-1801 · Una rama `scrum-<dígito>…` sin número para el censo tumba el obligatorio de todos los PR: comprobación en la puerta

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:41:10Z (cabecera `Date:` de `gh api -i zen`)

A9: comprobación → `scripts/guard-rama-con-numero.mjs`

Mutaciones: catálogo → `tests/scrum1801-guard-rama-con-numero.test.mjs`

**Puesto:** J6 (`jv-j6fh`) · **Rama:** `scrum-1801-guard-rama-con-numero` · encargo del orquestador J (`cobroflash-backend-2d`), pieza ① del ticket. Carril J6: el guard nuevo, su test y este registro. `scripts/_numero-de-rama.mjs` y `tests/scrum804-la-rama-viva.test.mjs` NO se tocan (regla 41).

## Qué se construyó

- `scripts/guard-rama-con-numero.mjs`: lee la rama actual (`GITHUB_HEAD_REF`; si no, `GITHUB_REF_NAME`; si no, `git rev-parse --abbrev-ref HEAD`), IMPORTA `numeroDeRama` y sale con 0 verde · 1 ROJO · 2 CIEGO. Siempre imprime su población: `1 rama mirada: <nombre> (de <origen>)`.
- ROJO (código 1) cuando la rama empieza por `scrum-<dígito>` y `numeroDeRama` devuelve `null`, con este mensaje: «tu rama `<nombre>` no tiene número para el censo (scripts/_numero-de-rama.mjs): scrum804 caerá en TODOS los PR. A la 27ª pieza de un ticket, ticket hijo.»
- `tests/scrum1801-guard-rama-con-numero.test.mjs`: 7 casos, que lanzan el guard como proceso con `GITHUB_HEAD_REF` inyectado. Son el rojo primero (sin el guard, `scrum-1787aa-x` entra en `agruparRamas` como `sinNumero` y el filtro de scrum804 la cruza), verde para `scrum-1801-…`, ROJO para `scrum-1787aa-x`, `relevo/sin-numero`, `claude/pr-…` y `main` en verde, CIEGO sin rama, el filtro copiado contra el fuente de scrum804 y la rama de ESTE árbol.

## Lo medido el 24-nov-2026 (y la desviación del encargo, aceptada)

- **Población:** `git ls-remote --heads origin` = 192 refs; sin `main`, 191. **68 no tienen número** para `numeroDeRama`. 54 de ellas son `claude/pr-*`, las que crea el workflow `@claude`; el resto, `aparcado-…`, `espera/scrum-…`, `exp-…` y otras. Con esas 68 en el remoto, scrum804 está en verde: su suelo solo cruza los nombres que casan `/^scrum-\d/i` (el filtro de `soloEnGit`).
- **Desviación:** el encargo pedía rojo también para `relevo/sin-numero`. Con rojo para TODA rama sin número, el test caería en cada PR de `@claude` sin que nada estuviera roto. El guard pone rojo solo a la población que tumba scrum804. Lo aceptó el orquestador por mensaje, el 24-nov. `agruparRamas` (`scripts/_censo-reparto.mjs`) solo excluye `main`: no hay más exclusiones del censo que copiar.
- **Dos anclas:** el filtro `/^scrum-\d/i` está escrito en el guard (`FILTRO_DE_SCRUM804`) y en scrum804, que no lo exporta y no se toca. El caso «el filtro copiado sigue siendo el de scrum804» lee el fuente de scrum804 y cae si cambia.
- **Rojo real, sin inyectar:** en un repo de prueba creado con `git init -b scrum-1787aa-x`, el guard sale 1 con el mensaje entero. En esta rama sale 0: «el censo la cuenta como SCRUM-1801».
- **Mutación** (catálogo, `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, sobre el commit `8269f1b9f39ccb48bb787408a12efc9e11b8b225`): `const n = numeroDeRama(limpio);` → `const n = limpio.length;` da VIVA. Cae «ROJO para `scrum-1787aa-x`», más dos colaterales: el control positivo y `relevo/…`. Después, `git status --porcelain` vacío.

## Para J3 · la línea que mete el guard en `npm run guards:entrada` (NO escrita: `scripts/guards-entrada.mjs` es de J3)

`GUARDS` enumera ficheros de `tests/`, así que lo que se registra es el test. Este es el diff propuesto, al final de `GUARDS`, detrás de la entrada de scrum1294:

```diff
+  // SCRUM-1801 · la rama desde la que vas a empujar tiene número para el censo; si no, scrum804 cae en
+  // TODOS los PR (24-nov-2026, `scrum-1787aa-…`). Sin `dist` ni base, ~2 s (siete hijos de node).
+  { fichero: 'tests/scrum1801-guard-rama-con-numero.test.mjs',
+    porque: 'una rama `scrum-<dígito>…` sin número para `numeroDeRama` tumba scrum804 en todos los PR' },
```

Antes de aceptarla, J3 mide el techo con `tests/scrum976-guards-entrada-con-techo.test.mjs` (los siete hijos de este test suman ~2 s en esta máquina).

Hecho por jv-j3cs en `9a8fa2fe13d73dfbb8003de5a29c735283c66765`; techo medido: 19,7 s de 90 (con 16 guards, 177 tests; antes de la entrada, scrum976 ④ dio 17,0 s de 90 con 15). Negativo: `GITHUB_HEAD_REF=scrum-1787aa-x npm run guards:entrada` sale 1 y nombra la rama. `censo:mudez -- --escribir`: 0 medidos de 143; el test de 1801 no menciona el filtro de comentarios, así que no entra en su población y `tests/_veredicto-mudez.json` no cambia. `MINIMO` sigue en 15: subirlo no estaba en el encargo.

A9: sin fallo que generalice — relevo de una línea ya escrita por J6; el techo se midió antes de aceptarla y cupo

## Para Luis (S0) · ② y la fila del script nuevo — solo propuesto

**② `.github/workflows/pr-automatico.yml`**: un paso detrás del «Candado — solo ramas scrum-», con la rama por `env` como el candado:

```diff
+      - name: Candado — la rama tiene número para el censo (SCRUM-1801)
+        env:
+          GITHUB_HEAD_REF: ${{ github.ref_name }}
+        run: node scripts/guard-rama-con-numero.mjs
```

Esto supone un `actions/checkout` antes del paso. Si el candado actual corre sin checkout, va después del checkout del job.

**Fila de `docs/equipo/dos-equipos.md` §3** (S0): `scripts/guard-rama-con-numero.mjs` → **J6**, por el área del ticket que lo crea (SCRUM-1801, `area-j6`). Hoy solo lo cubre la fila general de `scripts/` (lo dice `node scripts/carriles.mjs de --nueva`).

## Qué no corrí

- **Corrido y en verde:** el test nuevo (7/7); `npm run guards:entrada` (15 guards, salida 0, entre ellos 237, 267, 273, 723 y 1294); en una sola tanda, 1415, 854, 976, 1185, 411, 1387, 804 y los cinco de árbol entero que nombra guards:entrada (195, 414, 694, 710b y 737): 116 tests, 116 pass, 0 skipped. `tsc -p . --noEmit` con tipos: salida 0.
- **scrum723 lo cazó en la primera versión:** el guard comparaba con los literales de la rama principal y de la cabeza suelta en un fichero que llama a git. Se cambió el código, no la lista: la exclusión la decide `agruparRamas` y la cabeza suelta, `git symbolic-ref -q`. La mutación se volvió a pasar sobre `d003590126bbc8cac0abfa4478b1e0f13d24312d`: VIVA, y el árbol quedó limpio.
- **No corrido:** la suite ENTERA y 719 (`npm run censo:mudez -- --escribir`). El tope de contexto del encargo (170k) no los admitía, y se avisó al orquestador antes de empujar.

## Corrección del 24-nov-2026 · mutación ④ de SCRUM-812 seguía citando 42

Al subir `SUELO_GUARD_QUE_DECLARAN` a 43 (`2e928584a`) no se movió la copia que la mutación ④ lleva en `MUTACIONES_QUE_ME_TUMBAN` (`de: …= 42;`). El ancla ya no existía, el test «mi ancla ④ muta la CONSTANTE» cayó en la pasada limpia y el meta-guard salió MUDO (run 45321217533, parte 1). Arreglo: la copia pasa a `43 → 42`. El suelo no baja y no se toca ningún guard. No corrido en local; lo decide el CI.

A9: comprobación → `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`

## Relevo del 24-nov-2026 (jv-j6fi) · los cuatro rojos del obligatorio de #3352 eran censos de guards que el guard nuevo no había pasado

Punta de partida `f27071646d85e42607f68a147f87de88a537d8c7`; hora `Tue, 24 Nov 2026 06:31:50 GMT` (cabecera `Date:` de `gh api -i zen`). Ningún guard se afloja (regla 41): cada uno se cumple por la salida que él mismo nombra.

- **SCRUM-1327** («ningún `scripts/guard-*.mjs` sale a mano»): el guard salía con `process.exit(v.salida)`. Ahora la salida la decide `veredictoDe({ hallazgos, ciegos })` de `scripts/_hallazgos-y-ciegos.mjs`, y sus tres códigos son los de la casa re-exportados (`SALIDA_ROJO = SALIDA_HALLAZGO`, `SALIDA_CIEGO = SALIDA_NO_SUPE_MEDIR`). `comoSale` (de `tests/_salidas-de-guard.mjs`) sobre el fuente viejo: 1 salida a mano (línea 88); sobre el nuevo: 0 a mano, 1 por veredicto.
- **SCRUM-1480f** (script nuevo sin fila en §3.3): declarado en `scripts/_sin-fila-declarados.json`, salida 2 del test («lo crea el equipo de Javier, que no edita esa tabla; la S0 le da fila después»). Ese JSON es contenedor de S0 donde cualquier puesto añade SOLO su bloque. La fila propuesta sigue en «Para Luis», arriba.
- **SCRUM-711** (los dos casos: «ningún guard deja de correr» y «el cero se juzga con la misma función»): el censo sólo lee `package.json` y los workflows, así que una ruta en un test no le basta. Se declara en `DECLARADOS` de `tests/scrum711-guards-sin-sitio.test.mjs`, la salida que nombra su propio mensaje («si corre por otro camino, decláralo en DECLARADOS con una prueba comprobable»), con la prueba comprobada en el caso «las pruebas de las declaraciones siguen siendo ciertas»: el test de 1801 contiene la ruta del guard y el `spawnSync` que lo lanza, fuera de comentarios, y lo cubre el patrón de la tanda. No va en `pretest`: con la cabeza suelta y sin variables de GitHub sale CIEGO (2) y tumbaría `npm test` en los worktrees de medición fijados a `origin/main`. Sin tocar workflows.

**Corrido y en verde (local):** 1327, 1480f, 711 y 1801 en una tanda: 36 tests, 36 pass, 0 skipped. En otra: 1294, 1320, 1415, 237, 267, 719, 723, 804 (la rama viva), 812, 854 y 976: 120 tests, 120 pass, 0 skipped. `tsc -p .` con tipos: salida 0. Control negativo: `GITHUB_HEAD_REF=scrum-1787aa-x node scripts/guard-rama-con-numero.mjs` sale 1 y nombra la rama; con `scrum-1801-guard-rama-con-numero` sale 0. **No corrido:** la suite ENTERA (el encargo lo prohíbe por contexto); 719 salió verde sin regenerar `censo:mudez`.

A9: comprobación → `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`
