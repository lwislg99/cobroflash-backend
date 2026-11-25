# SCRUM-1846 · un guard sin `dist/` salía con 1 («hallazgo») en vez de 2 («no supe medir»)

**Medido contra:** `origin/main` = `bdd808ebe9bae708028e8aab87c52bc7b0ee6a28` · 2026-11-25T03:01Z (hora del registro de la sesión; `gh api -i zen` no consultado)

Carril J6 (sin cerradura: `scripts/_hallazgos-y-ciegos.mjs` y los 4 guards tocados).

## Censo (población declarada)

46 `scripts/guard-*.mjs`, grafo de imports relativos (estático, `import()` literal, `require` literal) + `grep` de rutas calculadas a `dist`:

- **Llegan a `dist/` por import literal y morían con 1:** `guard-aviso-bizum`, `guard-firma-con-tramos`, `guard-vias-de-cobro` (estático, fallaba al enlazar) y `guard-objetivo-tactil` (require perezoso en `tests/_banco-vistas.mjs:1357`, S3).
- **Llegan por ruta calculada y ya salían con 2:** `guard-nif-del-gasto`, `guard-notas-en-la-ficha`, `guard-pad-de-firma-cabe` (leídos en el código, no corridos sin `dist/`).
- **De Luis, sin tocar:** `guard-detalle-trabajo-917` (S4) llega por el mismo require del banco y sigue saliendo con 1 → necesita una línea `vigilarArranque();` (el helper ya está).
- **No llegan:** 38. El envoltorio `npm run guards:visuales` (job «guards de navegador») compila antes: en CI no muerde.
- **Control:** el gancho del test lleva su marca y el test exige verla (si no quitó `dist/`, cae); en el caso 3, un error que no es de módulo sigue saliendo con 1 y sin error con 0.

## Arreglo (un sitio)

`vigilarArranque()` en `scripts/_hallazgos-y-ciegos.mjs`: `uncaughtExceptionMonitor` que, SOLO para `ERR_MODULE_NOT_FOUND`/`MODULE_NOT_FOUND`, dice qué faltó, «npm run build» y la línea de veredicto, y sale con 2. Los tres imports estáticos de `dist/` pasan a `await import(…)` después de la llamada. No cambia qué mide ningún guard (regla 41).

**Rojo primero:** con el código de hoy, `guard-aviso-bizum` salió con 1 y el caso 2 nombró los 3 estáticos. Tras el arreglo, verde.

A9: comprobación → `tests/scrum1846-arranque-sin-dist-sale-2.test.mjs`
A9: aviso → cicatriz J6 «Corrí `carriles.mjs de` sobre el test nuevo después de escribirlo, con los guards y el helper ya consultados antes: la cuarta de la familia de SCRUM-1218d» — no se pudo comprobar: ningún hook exige la consulta antes de la primera escritura

Mutaciones: catálogo → `tests/scrum1846-arranque-sin-dist-sale-2.test.mjs`

## Lo medido después (misma sesión, tras el traspaso a 155k; el orquestador subió el tope a 230k)

- **Mutaciones** con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, una por proceso: base 3/3 en verde. Quitar `vigilarArranque();` de `guard-vias-de-cobro` → cae el caso 1. Salir con 1 en el helper → caen el 1 y el 3. `git status` limpio después de cada una.
- **Con `dist/`** (`tsc --noCheck` en este árbol; `node_modules` es enlace al compartido, cliente de Prisma ✔, sin `generate`): los 4 guards, versión de `main` (`git show bdd808ebe…`) frente a la nueva, salida IDÉNTICA. aviso-bizum, firma-con-tramos y vias-de-cobro salen 0; objetivo-tactil sale 2 con 4 ciegos en las dos versiones (es de esta máquina, no de este cambio).
- **Sin `dist/` de verdad** (`mv dist dist.aparte`, restaurado; 7 entradas antes y después): vias-de-cobro sale 2 con «no llegó a arrancar» y «npm run build». Control: `guard-nombres-no-declarados` (no llega a `dist/`) sale 0 con y sin él, salida idéntica.
- **Verdes:** 1846, 237, 976, 700, 1294, 267, 854, 719 → 88/88 en TAP, 0 `not ok`. `npm run guards:entrada` 0. `tsc -p .` con tipos 0 (no toca `src/`). No he corrido la suite entera: el encargo la prohíbe.

## Para Luis (S4)

- `scripts/guard-detalle-trabajo-917.mjs` llega a `dist/` por el `require` perezoso de `tests/_banco-vistas.mjs:1357` y sin `dist/` sigue saliendo con 1. El arreglo es una línea: importar `vigilarArranque` de `./_hallazgos-y-ciegos.mjs` y llamarla al principio del cuerpo. Cuando entre, se añade al `GUARDS` del test.

# SCRUM-1846b · los dos rojos del PR #3432: el suelo de scrum812 y una discrepancia de scrum493 sin clase

**Medido contra:** `origin/main` = `c83ebdbea13a426c2a3e3b5655fca37567d62300` · 2026-11-25T03:50Z (cabecera `Date:` de `gh api -i zen`, tomada justo después de la medida main/rama; la rama es `fa029a9ded2263f08c909704155774acb8fd03aa`, que lleva dentro `e28f3582ec13e3c6102245a33bab02e4e7fa2370`)

Relevo de jv-j6gg (J6). GO de la vía B en SCRUM-1846 c.22744 (precisión de c.22740 ②).

## Rojo 1 · `tests/scrum812-el-rotulo-declara-su-poblacion.test.mjs`

- Antes: 5/6, cae «EL TRINQUETE del GUARD»: «LA COBERTURA HA SUBIDO a 45 (el suelo decía 44)», con `scrum1846-arranque-sin-dist-sale-2.test.mjs` en la lista. Es endurecer: lo pide el propio guard.
- `SUELO_GUARD_QUE_DECLARAN` 44 → 45 en las dos anclas (la constante y la mutación ④), re-anclado con fecha y sha en su comentario. Después: 6/6.

## Rojo 2 · `tests/scrum493-dos-instrumentos.test.mjs` · «toda discrepancia está CLASIFICADA»

Medida con el MISMO comparador sobre dos raíces (`comparar(raiz)`): un árbol temporal en `c83ebdbea…` (fuera del repo, ya quitado) y esta rama.

| | corpus | acuerdan | discrepan | por clase |
|---|---|---|---|---|
| main | 800 | 616 | 184 | IMPORT_DINAMICO 2 · LLAMADA_INTRA_MODULO 181 · REEXPORT 1 |
| rama | 800 | 615 | 185 | lo mismo + OTRO 1 |

Diferencia de CONJUNTOS: 0 solo en main; 1 solo en la rama, `OTRO avisoBizumSinTelefono.ts:64 hayQueAvisar (①=NO ②=NO_SE)`. La trae esta rama.

- **Mecanismo (la hipótesis de partida era otra):** en main, ② ya decía `hayQueAvisar` = NO_ALCANZABLE. El guard nunca llegó a ese nombre: su comentario dice que no lo importa a propósito. En la rama dice NO_SE porque `tests/_alcance-desde-entradas.mjs:125-127` vuelve opaco el módulo entero ante CUALQUIER `import()`, también desde las entradas `scripts/*.mjs`. ② ve el `await import` y hace lo que su diseño dice. El que no lo veía era el clasificador del comparador: `ataduraOpaca` buscaba imports dinámicos solo en `src/`, menos población que ②, y la fila caía en OTRO.
- **Descartado, probado y revertido:** que ② lea `const { x } = await import()` como import con nombre. `hayQueAvisar` vuelve a NO_ALCANZABLE, pero `sendQuoteEmail` se carga con la misma forma (`quotesAdmin.routes.ts:828`): pasa a `OTRO ①=NO ②=SI` y se van las tres filas IMPORT_DINAMICO/REEXPORT fijadas a mano. scrum493 se queda en 4/8. Para eso habría que cambiar lo que el guard fija (regla 41).
- **Arreglo (vía B):** `ataduraOpaca` recorre `src/` + `entradasDeComando`, la misma población sobre la que ② se vuelve opaco. Controles: sobre main, 184 = 184 con 0 diferencias de conjunto; sobre la rama cambia UNA fila, `hayQueAvisar`, de OTRO a IMPORT_DINAMICO. scrum493 8/8.
- **Mutación** con `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` (pasada limpia 8/8): devolver el clasificador a solo `src/` tumba «toda discrepancia está CLASIFICADA» → VIVA. `git status` limpio después.

Mutaciones: catálogo → `tests/scrum493-dos-instrumentos.test.mjs`

- **Verdes:** 1846, 493, 812, 700, 719, 854, 237, 976 y 419 → 92/92 en TAP, 0 `not ok`, 0 saltados (719 sin cambios: no hizo falta `--escribir`). 1294, 267, `npm run guards:entrada` y `tsc -p .` con tipos, después de escribir este tramo: sus cifras van en la entrega. No he corrido la suite entera: el encargo la prohíbe.

- **Error mío:** encadené un `git checkout --` para revertir el experimento detrás de una medición, en el mismo comando. El hook paró los dos y revertí con el editor.

A9: comprobación → `tests/scrum493-dos-instrumentos.test.mjs`
A9: comprobación → `.claude/hooks/guard-dangerous.sh`
