# SCRUM-1789 · Siete guards de navegador CIEGOS en cada run de CI: causa medida y arreglo en el propio guard

**Medido contra:** `origin/main` = `90e8e3774f86ff6ef393e7f25f0c6bdedb95765e` · 2026-11-23T03:44:00Z

A9: aviso → cicatriz J6 «Lancé cinco guards de navegador encadenados en un bucle sin cronometrar antes uno, y el arnés lo mandó a segundo plano: completar-lleva-al-campo tarda 139 s cuando mide, 0,9 s cuando está ciego» — no se pudo comprobar: ningún hook multiplica pasadas por duración antes de lanzar, y un guard que sale de CIEGO cambia de duración (0,9 s → 139 s)

Carril J6 (sólo `scripts/guard-*.mjs`, que según `node scripts/carriles.mjs de <ruta>` sólo cubre la fila general de `scripts/`: no tienen dueño declarado y nadie los reclama). Nada en `src/` ni en `public/`. Encargo del orquestador J (`cobroflash-backend-2d`), sesión `jv-j6fc`. Ticket abierto por esta sesión (no existía; búsqueda en Jira por «guards de navegador» y «CIEGO» sin duplicado).

## Medición (CI: job 137006356066 del run 44956622872, #3308; en local, antes y después del arreglo)

| guard | qué no encontraba | desde | arreglo (sólo en el guard) | local antes → después |
|---|---|---|---|---|
| `guard:vias-de-cobro` | `renderSettingsView` lanzaba `telefonoConPrefijo is not defined` | `6727eb7e0` (SCRUM-1781b) | banco carga `onboardingView.js` + `prefijosPais.js` en el orden de `index.html` | CIEGO 8 → verde, 0 hallazgos · 0 ciegos |
| `guard:falta-en-otra-pestana` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 12 → mide 12 casos: 1 hallazgo en 1 de 2 pasadas (ver abajo) |
| `guard:completar-lleva-al-campo` | lo mismo («no se pudo censar la pantalla») | `6727eb7e0` | lo mismo | CIEGO → verde: 36 de 36, su mutación interna hace caer 32 de 36 |
| `guard:aviso-bizum` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 4 → verde, 4 casos |
| `guard:modo-en-ajustes` | lo mismo | `6727eb7e0` | lo mismo | CIEGO 4 → verde, 4 casos |
| `guard:marcadores-en-pantalla` | `operarios` × 3 estados: `ReferenceError: telefonoConPrefijo` (`settingsView.js:355`) | `6727eb7e0` | deja de excluir `onboardingView.js` (97 → 98 scripts); el asistente se apaga por el dato (`onboardingCompleted: true` en la respuesta falsa), como en `app.js` | CIEGO 3 → verde: 93 casos, control negativo detectado |
| `guard:objetivo-tactil` | «Marcar como PAGADA» y «📲 Confirmar Bizum recibido» en caja 0×0: la ficha del Trabajo va por pestañas y la factura cae en un panel `hidden` | `3a8f4cb22` (SCRUM-1768) | `preparar: abrirTodasLasPestanas` (quita `hidden` a cada `role="tabpanel"`, por rol y no por clase, igual que `abrirTodosLosPasos`) | 8 ciegos → 4: la ficha mide 22 objetivos (antes 11), 0 cortos; los 4 que quedan son «FUENTE ROTA en /» (3 de 41 caras), sólo en local: estaban ya en mi pasada de antes y no salen en CI |

La causa común de seis: desde SCRUM-1781b, `settingsView.js` llama a `telefonoConPrefijo`, una constante de nivel superior de `onboardingView.js`, y a `window.prefijosPais` (de `prefijosPais.js`). En el panel funciona porque `index.html` carga los dos antes (líneas 272 y 275, frente a 362-364). Los bancos de los guards llevan su propia lista y no los cargaban.

No se ha relajado ningún guard: ninguno ha cambiado su exigencia, sus números ni sus casos. Lo que cambia es lo que se carga o se abre antes de medir, y cada guard sigue saliendo CIEGO si su población se queda vacía.

## Lo que queda (no es de este carril)

- **Hallazgo de pantalla, intermitente (1 de 2 pasadas en local):** `guard:falta-en-otra-pestana`, caso «390px · rojo · NIF vacío, Guardar desde Cobros» → «el aviso queda fuera de la pantalla». Es de la pantalla de Configuración (`public/`): aquí sólo se reporta. Sin medir en CI hasta este PR.
- **`guard:detalle-trabajo-917`** sale ROJO en CI con 42 hallazgos (`0 ciegos`). Es de S4: sólo se reporta.
- **Sin medir:** los siete en el job de CI de este PR. Hasta que corra, el «después» es sólo local. La suite entera tampoco se ha corrido en local antes del empujón (orden del orquestador, por contexto).

## Propuesta (no se construye aquí)

Que `scripts/guards-visuales.mjs` diga ROJO, y no sólo CIEGO, cuando un mismo guard lleva CIEGO N runs seguidos de `main`. Hoy un CIEGO estable tiene el mismo aspecto un día que al tercero, y estos siete llevaban así desde el 20-nov (1768) y el 21-nov (1781b) sin que nadie lo leyera. Necesita memoria entre runs (artefacto o el Issue del vigía de main): es una decisión de diseño de S5/J6, no un parche.

# SCRUM-1789b

**Medido contra:** `origin/main` = `7b9ff0ef313b2bf919ea12b21a5046c9e3a92ae1` · 2026-11-23T04:11:22Z

A9: sin fallo que generalice — el encargo partía de que el CIEGO «no tumba nada»; medido, la puerta ya sale ≠ 0 con un CIEGO, y lo que lo esconde es el job, que no es obligatorio y está en rojo permanente: eso es una decisión de S5/fundador, no un defecto de esta sesión

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1789/veredicto-con-un-ciego.mjs`

## PASO 0: la premisa no se sostiene, y por eso no se construye nada

El encargo: «hoy el CIEGO no tumba nada; que un guard CIEGO cuente como ROJO del job». Medido:

1. **La puerta YA sale ≠ 0 con un CIEGO.** `scripts/guards-visuales.mjs` suma un fallo por cada guard no verde (línea «CIEGO cuenta como fallo», en `puerta()`) y sale con `veredicto(filas).codigo`. El guion de arriba, con un guard SEMBRADO en CIEGO: sólo ciego → **salida 2** («NO MEDIDO»); ciego + un rojo → **salida 1**, y el detalle lo nombra («Y ADEMÁS 1 guard(s) NO llegaron a medir (guard:sembrado-sin-pagina: CIEGO)»); todo verde → 0. Control negativo: cambiando el esperado del primer caso a 0, el guion sale 1 y dice `MAL`.
2. **El job de CI SÍ lee ese código.** `.github/workflows/ci.yml`, paso «Guards de navegador»: `run: npm run guards:visuales`, sin `continue-on-error`. En el run 44956622872 (#3308) el job «guards de navegador (fuera de la tanda)» acabó en `failure`.
3. **Lo que lo esconde, medido:**
   - **El job no es obligatorio.** Las reglas de la rama `main` (`gh api repos/…/rules/branches/main`, `required_status_checks`) piden UN contexto: «build + tests (con banco desechable)». Positivo: la consulta devuelve ese nombre, así que no es una lista vacía. El propio `ci.yml` lo dice en el comentario del censo táctil: «este job no es obligatorio».
   - **Está en rojo permanente en `main`.** Los 15 últimos runs de `ci.yml` en `main` (del 21-nov 05:40Z al 23-nov 04:08Z): **11 con el job en `failure`, 0 en `success`**, 4 sin ese job (alcance «solo docs» o aún corriendo; no lo distinguí). El rojo fijo es `guard:detalle-trabajo-917` (S4, 42 hallazgos): con él, la salida es 1 tenga o no ciegos, y el rojo de un CIEGO nuevo se lee igual que el de ayer.

Un detector que acierta y publica donde nadie lee: aquí el detector ya publica bien (código y nombre); lo que no lee nadie es el job. Cambiar el runner no lo arreglaría.

## Lo que hace falta, y de quién es (no se toca aquí)

- **Que el job sea obligatorio**, o que su rojo llegue a donde se lea (el avisador de main): reglas de la rama y `.github/workflows/`, **S5 y fundador**. Antes, `guard:detalle-trabajo-917` tiene que estar verde o declarado: si se hace obligatorio hoy, bloquea todos los PR.
- **Distinguir un rojo NUEVO de uno conocido**, que es lo que de verdad faltó con los siete: o una lista de no-verdes declarados con ticket que sólo baja (estilo `_sin-consumir-declarados`), o la propuesta de 1789 (rojo tras N runs seguidos). Una lista así **relaja** el job para 917 (deja de tumbarlo), así que es una decisión, no un arreglo: no la construyo sin que la firme quien decide (regla 41).
- Mientras tanto, la puerta ya no tiene ciegos que esconder: los siete los arregló el tramo de arriba. Sin medir aún en el CI de #3315.

## Población y lo que NO se ha medido

- Guion: 3 casos sobre `veredicto`, la función pura de la que sale el `process.exit` del runner. **No he corrido el runner entero con un guard sembrado en disco**: que `puerta()` sale con `veredicto(filas).codigo` está leído en el código, no ejecutado.
- Historial de `main`: 15 runs, leídos con `gh run view --json jobs`. Los 4 «sin job» no los he abierto.
- No he cambiado código: no hay tanda que correr más allá de los guards del registro.

# SCRUM-1789c

**Medido contra:** `origin/main` = `0b2f6451af74f2142cf27e18c9a4c42fb56c1e65` · 2026-11-23T08:23:19Z

A9: aviso → cicatriz J6 «Pasé una sonda a node por `node -e` desde bash con una barra invertida dentro, y no compiló: la de SCRUM-1252h otra vez, con la cicatriz delante» — no se pudo comprobar: ningún hook de este árbol para un `node -e` que lleva barras invertidas

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1789/navegador-en-el-catalogo.mjs`

Dos cosas en este tramo: ① la rama de 1789b (#3318) estaba en conflicto con `main` y se ha unido con `git merge origin/main`, sin tocar ningún tramo; ② la medición de por qué el catálogo de mutaciones no llega a los guards de navegador, con el cambio propuesto. **El cambio no se ha hecho:** `node scripts/carriles.mjs de scripts/meta-guard-mutaciones.mjs` → **S3** (`dos-equipos.md:177`). El encargo decía que, si el driver es de S3 o S5, se para con el diff propuesto.

## ① #3318 unido

`git merge origin/main` sin conflictos en texto: los tramos `# SCRUM-1789` y `# SCRUM-1789b` quedan en ese orden, con su línea en blanco, y ninguno cambia. En verde en local: scrum1294, 267, 273, 525d y 854 (38 de 38, 0 `not ok`) y `npm run guards:entrada` (15 guards, salida 0).

## ② Qué le falta al catálogo para un guard de navegador

Medido con el guion de arriba, que importa `correr()` y `cayo()` del propio meta-guard (no los copia):

1. **No los ve.** `censoConPoblacion()` lee `tests/` y filtra `.test.mjs`. Con `scripts/` da **población 0 y censo 0**. Con `tests/` da población 1752 y 355 declarantes, que es el control positivo. Los 45 `scripts/guard-*.mjs` no entran en la población, y ninguno declara `MUTACIONES_QUE_ME_TUMBAN` (0 de 45).
2. **Si los viera, juzgaría mal.** `correr()` usa `run()` de `node:test`. Sobre un script que no es de `node:test`, eso da **UN caso con el nombre del fichero**, y lo que imprime no llega:
   - salida 1 (hallazgo) → `caidos: ["…guard-rojo.mjs"]`;
   - salida 2 (CIEGO) → `caidos: ["…guard-ciego.mjs"]`.

   En los dos casos el error es `ERR_TEST_FAILURE`, «test failed». **Son indistinguibles.** Una declaración con `cae: '<nombre del fichero>'` contaría un CIEGO como VIVA: un verde falso. Y con `cae: '<texto del hallazgo>'` saldría siempre CIEGO en la PUERTA 1, porque `paso(limpia, cae)` busca ese texto en la pasada limpia y no está.
3. **La base es otra cosa.** En un test, la base es «el caso `cae` pasó». En un guard de navegador es «el guard salió 0». La salida 1 quiere decir que ha visto algo, y la salida ≥ 2 que no supo medir: lo que aquí es un CIEGO, no un caído.

## La propuesta: mínima, en el driver y no en los guards

El juicio, tal cual, está en el guion (`esGuardDeNavegador`, `resultadoDeNavegador`, `juicioDeNavegador`). En `scripts/meta-guard-mutaciones.mjs`:

```diff
+// SCRUM-1789c · un guard de navegador NO es un fichero de node:test: su veredicto es su CÓDIGO.
+export const esGuardDeNavegador = (g) => /^scripts[\\/]guard-[^\\/]+\.mjs$/.test(g);
+export function resultadoDeNavegador({ status, stdout = '', stderr = '' }) {
+  const lineas = `${stdout}\n${stderr}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
+  const vacio = { pasados: [], caidos: [], saltados: [], errores: {} };
+  if (status === 0) return { ...vacio, codigo: 0, pasados: ['(salida 0)'] };
+  if (status === 1) return { ...vacio, codigo: 1, caidos: lineas };   // cada línea, un «caído»
+  return { ...vacio, codigo: status, ciegoDelGuard: `salió ${status ?? 'sin código'}: NO SUPO MEDIR` };
+}
 export async function correr(guard, propias = null) {
   …   // la vigilancia de SCRUM-754 se abre igual
+  if (esGuardDeNavegador(guard)) {
+    const r = spawnSync(process.execPath, [path.join(RAIZ, guard)], { cwd: RAIZ, encoding: 'utf8', timeout: TIMEOUT_MS });
+    return { ...resultadoDeNavegador(r), movidos: /* el mismo cierre de vigia que tras run() */ };
+  }
   const flujo = run({ … });
 export async function aplicarUna(mut, guard, limpia) {
+  const nav = esGuardDeNavegador(guard);
   …
-  if (!paso(limpia, mut.cae)) {
+  if (nav ? limpia.codigo !== 0 : !paso(limpia, mut.cae)) {   // base: el guard sale 0
   …
-  const absGuard = path.isAbsolute(guard) ? guard : path.join(DIR_TESTS, guard);
+  const absGuard = path.isAbsolute(guard) ? guard : path.join(nav ? RAIZ : DIR_TESTS, guard);
   …
     const tras = await correr(guard, propias);
+    if (nav && tras.ciegoDelGuard) return { ok: false, ciego: tras.ciegoDelGuard };   // (el finally restaura)
     // de aquí en adelante, `cayo(tras, mut.cae)` busca el texto del hallazgo en las líneas: igual que hoy
+export function censoDeGuardsDeNavegador(dir = path.join(RAIZ, 'scripts')) {
+  return fs.readdirSync(dir).filter((f) => /^guard-.*\.mjs$/.test(f)).flatMap((f) => {
+    const { buenas, incompletas } = lecturaDeDeclaraciones(fs.readFileSync(path.join(dir, f), 'utf8'), f);
+    return buenas.length || incompletas.length ? [{ guard: `scripts/${f}`, mutaciones: buenas, incompletas }] : [];
+  });
+}
   // en el arranque: enJuego = parteDelCenso([...censo, ...censoDeGuardsDeNavegador()], parte)
```

Y el contrato no cambia. El guard declara en su fichero `export const MUTACIONES_QUE_ME_TUMBAN = [{ fichero: 'public/…', de, a, cae: '<texto de la línea del hallazgo>' }]`, y el meta-guard lo lee por AST, así que no ejecuta el guard al leerlo.

**Lo que S3 tiene que decidir (A12: cambia una población que otros miden):**

- La población de `tests/` **no se toca**. Los guards de navegador van como segunda población, con su propia línea en el rótulo, para que `SUELO_GUARDS` y `SUELO_DECLARACIONES` y los que los miden no se muevan: scrum745, 753, 757, 765, 812, 836, `_catalogo-obligatorio.mjs` y `censo-guards-gateados.mjs`, que leen `censoConPoblacion`/`censoDeDeclaraciones`.
- `scrum836` (ancla única) tendría que leer también `scripts/guard-*.mjs`. Si no, la criba barata no llega a la declaración nueva y la ve sólo la PUERTA 1b.
- **El job `meta-mutaciones` de CI no instala navegador**, igual que el de `guards-visuales`, que usa el Chrome del runner vía `_navegador.mjs`. **No sé si en ese job lo encuentra: no lo he medido.** Si no lo encuentra, la base sale 3 y la declaración queda CIEGA, que es lo honrado, pero el job se pondría en rojo por ella.
- Coste: una pasada de `guard-ficha-de-factura` tarda **13 s** en local, así que base + 1 mutación son unos 26 s por declaración, dentro de los 30 min de la parte.

## Rojo primero, sobre el guard real (fuera del driver)

`node docs/master/evidencias/SCRUM-1789/navegador-en-el-catalogo.mjs` → salida 0, en 53 s:

| caso | salida del guard | veredicto | esperado |
|---|---|---|---|
| hoy: `correr()` con un sembrado que sale 1 y otro que sale 2 | 1 · 2 | un caído con el nombre del fichero en los dos: indistinguibles | indistinguibles |
| base sin mutar | 0 | — | 0 |
| declarada: `.j1-prog { display:flex;` → `display:none;` | 1 | **VIVO** («pending · movil → la línea de progreso no se ve: mide 0 (0×0)») | VIVO |
| inocua: un espacio más en la misma regla | 0 | **MUDO** | MUDO |
| sembrado que sale 2 | 2 | **CIEGO** | CIEGO |

Control negativo del guion: con una copia, fuera del árbol, que espera VIVO en el caso inocuo, sale **1** y marca ese caso con ✖. Después de cada pasada `git status` sólo enseña el guion nuevo: `public/` vuelve a quedar igual byte a byte, y el guion lo comprueba.

## Sin medir

- El cambio en el driver **no está hecho**: es de S3. Lo que está probado es el juicio, fuera del driver y con `cayo()` del propio driver. La vigilancia de SCRUM-754, la marca de SCRUM-808 y el reparto por partes **no se han ejercitado** con un guard de navegador.
- `guard-ficha-de-factura.mjs` **no declara** su mutación. Declararla hoy no sirve de nada (el censo no la lee). Además, se toca el guard, y el encargo lo pedía sólo si el driver era de este carril.
- No sé si el job de CI del meta-guard encuentra Chrome.
- La suite entera no se ha corrido. En este tramo no cambia ningún fichero de `src/`, `public/`, `scripts/` ni `tests/`: sólo `docs/`.
