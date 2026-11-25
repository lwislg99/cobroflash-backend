# SCRUM-1798 · El guard del detalle del Trabajo (917) se re-ancla a las pestañas de la ficha

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T10:27:43Z (hora de GitHub)

A9: comprobación → `tests/scrum480-fin-de-linea.test.mjs`

Lo que me salió mal: guardé las salidas del guard con la redirección de PowerShell y las copié al repo con sus CR (1.461 entre siete ficheros de evidencia). Lo cazó ese test, en su caso «los ficheros que TOCA ESTA RAMA no llevan ni un CR en disco», antes del push; los pasé a LF y volvió a verde. La comprobación ya existía: no hace falta otra.

Y una segunda, que no cazó ningún test sino el orquestador: escribí que el guard 917 «no corre en ningún workflow» porque buscar su nombre en `.github` no dio nada. Un cero de un `grep` por nombre no es «no está»: el workflow lo deriva de `package.json`. Corregido abajo, en «Lo que este verde NO es».

Puesto S4. El guard es de este carril: `docs/equipo/dos-equipos.md` §3, fila de `scripts/guard-detalle-trabajo-917.mjs` («por el área del ticket que los creó: SCRUM-917»), y `docs/master/SCRUM-1789.md` lo dejó reportado como «es de S4: sólo se reporta». Encargo del orquestador (`cobroflash-backend-41`), puesto 8 de SCRUM-1817.

**La firma del diseño:** acta SCRUM-1656 §44, concretada por S2 en su PASO 0 de hoy. La cito **como me llegó en el encargo**: esta sesión no tiene Jira y no la ha leído en su fuente.

Nada en `src/` ni en `public/`. No cambia ningún texto que vea el usuario.

## Qué pasaba

Desde SCRUM-1768 (#3268, 20-nov-2026) la ficha del Trabajo va por pestañas: cada sección es un `role="tabpanel"` y sólo la elegida se ve; las demás llevan `hidden`. La tarjeta «El trabajo» no es la que abre por defecto. El bloque F del guard seguía midiéndola sin abrirla: cabeceras de 0 px (F.4) y ningún control visible al abrir una línea (F.7).

Era el instrumento, no la pantalla: con la pestaña abierta, las mismas cabeceras miden 44 px.

## ROJO primero (PASO 0, sin tocar nada)

| cuándo | árbol | resultado | salida | dónde está |
|---|---|---|---|---|
| 20-nov (la BASE, de S2) | `main` `ed601ef49` | 202 de 244 · 42 hallazgos · 0 ciegos | 1 | `evidencias/SCRUM-1798/base-20nov-917-main-ed601ef49.txt` |
| 24-nov, antes de tocar | `main` `8e0d40816` | 202 de 244 · 42 hallazgos (10 F.4 + 32 F.7) · 0 ciegos | 1 | `evidencias/SCRUM-1798/salida-rojo-sin-reanclar-main-8e0d40816.txt` |
| 24-nov, re-anclado | `8e0d40816` + este cambio | **244 de 244 · 0 hallazgos · 0 ciegos** | **0** | `evidencias/SCRUM-1798/salida-verde-reanclado-sobre-8e0d40816.txt` |

Las 10 F.4 del rojo dicen todas lo mismo: «Tipo de trabajo 0 · Nombre y dirección 0 · …». Un 0 no es una cabecera pequeña: es una cabecera sin pintar.

## Qué cambia

Sólo `scripts/guard-detalle-trabajo-917.mjs`, y sólo en el bloque F, antes de la primera medida de cada página:

1. Busca el panel de la tarjeta: `tarjeta.closest('[role="tabpanel"]')`.
2. Busca su pestaña **por identidad**: la única `[role="tab"]` cuyo `aria-controls` es el `id` de ese panel. No lee el rótulo.
3. La **pulsa**. No le quita `hidden` al panel a mano: si la pestaña deja de abrir su panel, el guard tiene que enterarse.

La identidad no es un adorno. Medido hoy: el jefe abre por `ficha-pestana-3 → ficha-panel-3` y el técnico por `ficha-pestana-2 → ficha-panel-2` (no tiene «Lo que falta»). Por posición habría abierto otra sección.

Falla cerrado: si hay panel y no hay exactamente una pestaña que lo gobierne, o se pulsa y el panel sigue oculto, es SUELO («no supe mirar», salida 2), nunca un veredicto sobre una tarjeta a 0 px.

## Qué NO cambia

- Ninguna exigencia, ningún número, ningún caso. Las 244 comprobaciones son las mismas 244.
- El re-anclaje no suma comprobaciones: imprime un rastro por página (`↪ F … antes: oculto, 1ª cabecera 0 px · después: a la vista, 44 px`) que no cuenta en la población.
- Los bloques D y G se miden como antes, sobre la pestaña que abre por defecto.

## Mutantes, en las dos direcciones

Mutaciones: una vez → `docs/master/evidencias/SCRUM-1798/mutar-1798.mjs`

El guard es de navegador y no es un fichero de `node --test`: el catálogo `MUTACIONES_QUE_ME_TUMBAN` sólo lee `tests/*.test.mjs` y no lo puede mutar. Va por el guion, como `evidencias/SCRUM-1787/mutar-1787g.mjs`. El encargo pedía «al catálogo»: no es posible para este guard, y se dice aquí.

El guion corre primero la BASE sin mutar (tiene que salir 0 con 244 de 244) y restaura cada fichero comprobando los bytes. Salida entera en `evidencias/SCRUM-1798/salida-mutar-1798.txt`. Commit del árbol antes de inyectar: `7177a7b91a073ffbb336eb3c785fc7bafc221a4c`.

| dirección | qué se muta | dónde | qué hace el guard | salida |
|---|---|---|---|---|
| 1 · no se volvió ciego | la cabecera baja a `min-height: 30px` DENTRO de la pestaña abierta | `styles.css` | F.4 cae en las 10 páginas y dice el alto que midió: **30**, no 0. 234 de 244, 10 hallazgos | 1 |
| 2 · el clic es lo que mide | se salta el re-anclaje entero | el guard | vuelve la BASE exacta: 202 de 244, 42 hallazgos, las 10 F.4 a 0 px y 32 F.7 | 1 |
| 2 · sin clic no hay veredicto | se quita sólo el clic | el guard | 10 SUELOS «pulsé la pestaña y su panel sigue oculto». 0 hallazgos, 10 ciegos | 2 |
| 2 · pestaña que no gobierna | `aria-controls` apunta a otro id | `jobDetailView.js` | 10 SUELOS «lo gobiernan 0 pestañas». 0 hallazgos, 10 ciegos | 2 |

4 mutaciones · 4 hacen lo que deben · 0 mudas · 0 no aplican. Tras el guion, `git status --porcelain` no enseña ningún fichero del producto ni el guard.

Y en la corrida sin mutar, la misma tarjeta antes y después del clic, en las 10 páginas de F: antes oculta y 0 px; después a la vista y 44 · 44 · 44 · 44 · 44 · 55,4 · 44 · 44 · 44 · 55,4 px.

## Lo que este verde NO es

- **No es el verde del job de guards de navegador.** `guard:lista-trabajos` sale 1 sobre este mismo árbol (medido hoy, 14 s, sin tocarlo): 1 hallazgo, 0 ciegos, en su bloque ⑥ — «Facturas NO trae lo declarado por SCRUM-1562g · el `<th>` sin texto de la columna "Ver detalle": 0 de 1». Es de la lista de Facturas, no de este carril; el orquestador ya lo tiene avisado. Cuando S5 haga obligatorio el job, seguirá rojo por ese hallazgo aunque el 917 esté en 0.
- **El guard 917 SÍ corre en CI, pero no es obligatorio.** El job `guards-visuales` de `.github/workflows/ci.yml` lanza `npm run guards:visuales`, y `scripts/guards-visuales.mjs` saca su lista de los `guard:*` de `package.json` que son de navegador: el 917 está entre ellos. Lo que falta es hacerlo obligatorio (S5). El verde de este registro es el local; el de ese job en este PR, sin ver al escribir esto.
  *(Corregido el 24-nov tras el acuse del orquestador. La primera versión decía «no corre hoy en ningún workflow», deducido de que `git grep detalle-trabajo-917 -- .github` no devolvía nada. Era falso: el workflow no nombra el guard, lo deriva.)*
- **G.2 mide los controles de la pestaña que abre por defecto, no los de toda la ficha:** 11 controles por caso (7 en el caso sin presupuesto). Los de las otras pestañas los mide `guard:objetivo-tactil`, que abre todos los paneles (`abrirTodasLasPestanas`, SCRUM-1789). No se ha tocado: el encargo es el bloque F.
- **`guard:objetivo-tactil` no se ha tocado ni corrido aquí.** Lo dejó verde J6 en `bd8fd4610` (dato del encargo, no medido por mí).

## Lo que se corrió en local además del guard

- `npm run guards:entrada`: 16 guards, 176 casos en verde y **1 en rojo que no es de esta rama** — «SCRUM-1340 · todo PR que cambia public/ declara la skill en su registro», de `tests/scrum811c-skill-ui-declarada.test.mjs`, que acusa al merge `8e0d40816` y al registro de SCRUM-1810. Sale igual en `main` limpio; esta rama no toca `public/`. Puede teñir de rojo el check obligatorio de este PR.
- Los 12 ficheros de test que leen este guard, su veredicto, los fines de línea o este registro (`scrum1294`, `1320`, `1327`, `1336`, `1480e`, `480`, `522`, `548`, `710b`, `850`, `850b`, `1177`): 111 tests, 111 pasan, 0 fallan, 0 saltados.

## Sin medir

- La suite entera en local: este worktree no tiene `dist` y el cliente de Prisma compartido va por detrás.
- El CI de este PR, hasta que corra.

## Evidencias

En `docs/master/evidencias/SCRUM-1798/` (texto; sin BOM):

- `base-20nov-917-main-ed601ef49.txt` — la BASE del 917 del 20-nov.
- `base-20nov-tactil-main.txt`, `base-20nov-tactil-ba0be004c.txt`, `base-20nov-tactil-0b8b9eda5.txt` — las tres salidas de `guard:objetivo-tactil` de la misma BASE (carpeta local `evidencias-s2-20nov-base-guards`, de S2).
- `salida-rojo-sin-reanclar-main-8e0d40816.txt`, `salida-verde-reanclado-sobre-8e0d40816.txt`, `salida-mutar-1798.txt` — lo de hoy.
- `mutar-1798.mjs` — el guion de las cuatro mutaciones.

### Las capturas r42 de SCRUM-1768b (NO van al repo)

Están en la máquina de Luis, en `D:\MILLONARIO\cobroFlash\capturas\SCRUM-1768b\r42\`: 12 PNG (`vivo-ficha-<76|77>-<admin|operario>-<390|1280|1920>.png`, 1,3 MB entre todas) y `vivo.json` (26 KB).

No se suben, y no por el peso: son la ficha de **producción** con la cuenta QA, y `vivo.json` lleva un número de teléfono 24 veces. El repo es público. Va el resumen, sin ese dato:

- Build de producción medido: `cde9d2f04da5567dc45233cd9356ddcbf5f7cb9e`. 12 medidas: fichas 76 y 77 × jefe y operario × 390, 1280 y 1920 px.
- En las 12: desborde horizontal 0, nada fuera de la pantalla, 0 controles por debajo de 44 px.
- Pestañas del jefe: Lo que falta · Partes · Albaranes · El trabajo. Del operario: Partes · Albaranes · El trabajo.
- Abre por defecto: la ficha 77 en «Partes» (los dos roles; su primaria es «+ Nuevo parte»); la 76 en «Lo que falta» para el jefe y en «Partes» para el operario.
- En ninguna de las 12 abre por «El trabajo»: es lo que este guard encontraba cerrado.

## Aceptación → dónde se ve

| aceptación (del encargo) | dónde se ve |
|---|---|
| ① re-anclar F por identidad (`closest('[role=tabpanel]')` → `[role=tab][aria-controls]`); población 244 | `scripts/guard-detalle-trabajo-917.mjs`, bloque «SCRUM-1798 · RE-ANCLAJE A LAS PESTAÑAS» · `evidencias/SCRUM-1798/salida-verde-reanclado-sobre-8e0d40816.txt` |
| ROJO-PRIMERO: la salida sin re-anclar, documentada | `evidencias/SCRUM-1798/salida-rojo-sin-reanclar-main-8e0d40816.txt` |
| ② mutante (a): un summary de menos de 44 px dentro de la pestaña abierta hace caer F.4 | `evidencias/SCRUM-1798/salida-mutar-1798.txt`, primera mutación |
| ② mutante (b): sin el clic mide 0, con el clic mide | misma salida, segunda y tercera mutación, y la línea del clic de la BASE |
| ② mutaciones al catálogo del guard | NO HECHO así → van por guion (`mutar-1798.mjs`): el catálogo no lee guards de navegador. Lo decide el orquestador |
| ③ la BASE del 20-nov al repo, en texto | `evidencias/SCRUM-1798/base-20nov-*.txt` |
| ③ rutas y resumen de las capturas r42 | este registro, «Las capturas r42» |
| ④ guard 917 a 0 con 244 antes del push | `evidencias/SCRUM-1798/salida-verde-reanclado-sobre-8e0d40816.txt` |


## SCRUM-1798b · el job «guards de navegador (fuera de la tanda)» pasa a OBLIGATORIO (S5, 24-nov)

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:03:18Z

A9: sin fallo que generalice — cambio de configuración del repositorio, con el antes y el después leídos de la API.

**Encargo y señal:** el orquestador, 24-nov: «ADELANTE DADO para el ruleset». Él midió que el run de CI de `main`
45441410146 terminó en SUCCESS, y su job «guards de navegador (fuera de la tanda)» también (con el 917 re-anclado
por esta misma ficha y `guard:lista-trabajos` curado por J). Lo he comprobado leyendo los jobs de ese run
(`gh api …/actions/runs/45441410146/jobs`): los 9 en `success`, y ese entre ellos.

**Antes de tocar, comprobé que el job puede ser obligatorio sin dejar ningún PR atascado.** En
`.github/workflows/ci.yml`, `guards-visuales` no tiene `if:` ni `needs:` a nivel de job, y el workflow corre en
todo `pull_request` a `main` sin filtro de rutas. En un PR que solo toca documentación se salta su paso
(`if: steps.alcance.outputs.solo_docs != 'true'`), pero el job termina igual y da su veredicto. Un check obligatorio
que en algún PR no apareciera lo dejaría esperando para siempre. Este aparece en todos.

**Qué se ha tocado:** sólo el ruleset `protect-main` (id 18770370), con
`PUT repos/lwislg99/cobroflash-backend/rulesets/18770370` y un cuerpo que es el de antes más una entrada en
`required_status_checks`. Se usa el mismo `integration_id` (15368, GitHub Actions) que el obligatorio que ya
estaba. `strict_required_status_checks_policy` se queda en `false`. Nada más.

**Diferencia, campo a campo** (las dos respuestas aplanadas y comparadas con un script, no a ojo):

| campo | antes | después |
|---|---|---|
| `/rules/3/parameters/required_status_checks/1/context` | — | `"guards de navegador (fuera de la tanda)"` |
| `/rules/3/parameters/required_status_checks/1/integration_id` | — | `15368` |
| `/updated_at` | `2026-08-10T19:07:43.415+02:00` | `2026-11-24T18:59:10.975+01:00` |

No cambia ningún otro campo.

**ANTES**, literal (`gh api repos/lwislg99/cobroflash-backend/rulesets/18770370`, antes del PUT):

```json
{"id":18770370,"name":"protect-main","target":"branch","source_type":"Repository","source":"lwislg99/cobroflash-backend","enforcement":"active","conditions":{"ref_name":{"exclude":[],"include":["~DEFAULT_BRANCH"]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"required_reviewers":[],"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false,"require_extra_approval_for_unattributed_changes":true,"allowed_merge_methods":["squash","merge"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"build + tests (con banco desechable)","integration_id":15368}]}}],"node_id":"RRS_lACqUmVwb3NpdG9yec4_L-k3zgEeacI","created_at":"2026-07-10T13:31:40.477+02:00","updated_at":"2026-08-10T19:07:43.415+02:00","bypass_actors":[],"current_user_can_bypass":"never","_links":{"self":{"href":"https://api.github.com/repos/lwislg99/cobroflash-backend/rulesets/18770370"},"html":{"href":"https://github.com/lwislg99/cobroflash-backend/rules/18770370"}}}
```

**DESPUÉS**, literal (la misma llamada después del PUT):

```json
{"id":18770370,"name":"protect-main","target":"branch","source_type":"Repository","source":"lwislg99/cobroflash-backend","enforcement":"active","conditions":{"ref_name":{"exclude":[],"include":["~DEFAULT_BRANCH"]}},"rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"pull_request","parameters":{"required_approving_review_count":0,"dismiss_stale_reviews_on_push":false,"required_reviewers":[],"require_code_owner_review":false,"require_last_push_approval":false,"required_review_thread_resolution":false,"require_extra_approval_for_unattributed_changes":true,"allowed_merge_methods":["squash","merge"]}},{"type":"required_status_checks","parameters":{"strict_required_status_checks_policy":false,"do_not_enforce_on_create":false,"required_status_checks":[{"context":"build + tests (con banco desechable)","integration_id":15368},{"context":"guards de navegador (fuera de la tanda)","integration_id":15368}]}}],"node_id":"RRS_lACqUmVwb3NpdG9yec4_L-k3zgEeacI","created_at":"2026-07-10T13:31:40.477+02:00","updated_at":"2026-11-24T18:59:10.975+01:00","bypass_actors":[],"current_user_can_bypass":"never","_links":{"self":{"href":"https://api.github.com/repos/lwislg99/cobroflash-backend/rulesets/18770370"},"html":{"href":"https://github.com/lwislg99/cobroflash-backend/rules/18770370"}}}
```

**A quién afecta hoy** (`gh pr list --state open`, con el último resultado de ese check en cada PR):
de 7 PR abiertos, 5 lo tienen en SUCCESS. **#3277** (`scrum-1005d-pestana-documentos`) lo tiene en FAILURE y
**#2690** (`scrum-962e-censo-tactil-cuatro-averias`) no lo ha corrido nunca. Ninguno de esos dos se puede mergear
hasta que el job salga verde en su rama. En #2690 hace falta además que corra el CI. No he mirado por qué falla
en #3277.

**Cómo se deshace:** el mismo PUT con el cuerpo de ANTES (está literal arriba).

**Antes del push:** guards:entrada salió CIEGO por plazo (90,0–90,4 s contra 90 s, CPU al 100 %, 5 intentos sobre esta rama); los 16 ficheros de su lista pasados con node --test sin plazo: 177/177, 0 fallos, 0 saltados. El presupuesto lo juzga el CI obligatorio. Push decidido por el orquestador (DELEGACIÓN c.21978).

## SCRUM-1798c · el meta-guard VE los guards de navegador y los juzga por su código (S3, 25-nov)

**Medido contra:** `origin/main` = `7592c8c140cbe5ddb1bcc516c8c6af38af90d59d` · 2026-11-25T08:40:18Z

A9: aviso → cicatriz S3 «Di por rojo-primero de SCRUM-1798c un rojo que caía por otra causa: dentro de un fichero de node:test el run() de correr() no ejecuta ficheros, y su hijo tampoco si hereda NODE_TEST_CONTEXT o va por node -e; lo cacé leyendo el motivo de cada fallo, no el recuento.» — no se pudo comprobar: es cómo leo un rojo, y ningún guard sabe si un fallo cae por la razón que su título dice
Mutaciones: catálogo → `tests/scrum1798c-meta-guard-ve-los-guards-de-navegador.test.mjs`

Puesto S3, rama `scrum-1798c-medidor-mutaciones` (nacida de `origin/main` `77c000dea`), por encargo del
orquestador: la parte de SCRUM-1798 que quedaba, y con su merge el orquestador cierra el ticket. El defecto lo
midió J6 en SCRUM-1789c (`docs/master/SCRUM-1789.md`, c.22388); el medidor es de S3 y J6 paró con el diff
propuesto. **Regla 41: se cura el medidor; ningún `scripts/guard-*.mjs` se toca.**

### Qué pasaba (re-medido aquí, no sólo leído)

- **No los veía.** `censoConPoblacion()` lee `tests/*.test.mjs`: sobre `scripts/` daba población 0. Hoy hay 46
  `scripts/guard-*.mjs` y ninguno declara `MUTACIONES_QUE_ME_TUMBAN`.
- **Si los viera, juzgaba mal.** `correr()` usa `run()` de node:test; con un script plano da UN caso con el
  nombre del fichero. Re-medido con una sonda desde un proceso plano: un guard sembrado que sale 1 y otro que sale
  2 dan lo MISMO, `caidos: ['<ruta del fichero>']`, `ERR_TEST_FAILURE`. Una declaración con `cae: '<fichero>'`
  contaba un CIEGO como VIVA; una con `cae: '<texto del hallazgo>'` salía siempre CIEGA en PUERTA 1.

### ¿Hay navegador en el job `meta-mutaciones` de CI? (la medición previa que pedía el encargo)

Leído el workflow y un run real, no supuesto: el job **no instala navegador**, y tampoco `guards-visuales`. Los
dos usan `scripts/_navegador.mjs`, que busca el navegador de la imagen en tiempo de ejecución y pone
`--no-sandbox` sólo con `CI`; no hay ningún paso de workflow propio de uno que le falte al otro. En el run de main
`45548131902` (25-nov 04:38Z), los jobs `meta-guard · parte 1 de 3` y `guards de navegador (fuera de la tanda)`
corrieron en la **misma imagen** (`ubuntu-26.04`, versión `20261116.202.1`), y en ésa el resolutor imprimió
`Edge (Linux) -> /usr/bin/microsoft-edge` y `guard:ficha-de-factura` salió verde en 9,4 s.
**Lo que NO está medido:** un navegador lanzado DESDE el job del meta-guard. Hoy no puede pasar: ninguna
declaración de navegador existe, así que ese job no lanza ninguno. La primera que declare un guard lo medirá en
su PR; si saliera 3 (no arranca), el veredicto es CIEGO, que es lo honrado, no un verde.

### La cura (`scripts/meta-guard-mutaciones.mjs`)

- `esGuardDeNavegador(ruta)`: decide la ruta (`scripts/guard-*.mjs`, relativa o absoluta).
- `censoDeGuardsDeNavegador(dir)`: la **segunda población**, aparte. Su propio suelo
  (`sueloDePoblacionDeNavegador`: cero ficheros es CIEGO, no «no hay»), su propia línea en el rótulo
  (`rotuloDeNavegador`), y sus declaraciones ilegibles caen en el MISMO suelo de SCRUM-757 (`ilegiblesDelCenso`):
  un `de` en plantilla `${…}` sale como ilegible, salida 2 (el dato de S5 en #3419, con su caso en el test).
- `resultadoDeNavegador`: 0 → base verde · 1 → cada línea de la salida es un «caído» (así `cae` es el texto del
  hallazgo) · ≥ 2 o sin código → `ciegoDelGuard`, nunca caído.
- `correr()`: para un guard de navegador, `spawn` del guard (no `spawnSync`: la vigilancia de SCRUM-754 necesita el
  bucle de eventos vivo), con la misma gracia, cierre y `movidos` que la rama de node:test.
- `aplicarUna()`: PUERTA 1 de navegador = «la base salió 0»; tras mutar, `juicioDeNavegador` (pura): CIEGA si no
  midió, VIVA si una línea nombra `cae`, MUDA si salió 0 o si salió 1 sin nombrarlo. Sin ella, el «NO APARECE» de
  `porQueNoCayo` pintaba CIEGA la mutación inocua (medido de punta a punta, abajo, antes de escribirla).
- En el arranque, los suelos y el rótulo del censo miran **sólo `tests/`** (A12: `SUELO_GUARDS`,
  `SUELO_DECLARACIONES` y sus lectores no se mueven); justo antes de repartir por partes, la población de navegador
  se suma a `censo` y a sus totales, para que la parte y `--juntar` comparen lo juzgado con lo repartido.
- **Dos anclas ajenas que mi primer borrador rompía, y que arreglé en MI código, no en sus declaraciones:** la línea
  `  if (!paso(limpia, mut.cae)) {` (scrum745) queda letra por letra, con la rama de navegador delante con un
  `else`; y mi suelo nuevo no copia `  if (poblacion > 0) return null;` (scrum812), que si no casaba dos veces.
  Los guards de texto de SCRUM-1620/1620b piden `parteDelCenso(censo, parte)` y `guardsDelCenso:
  guardsConDeclaracion` literales: se respetan (`let` donde había `const`, con su porqué al lado).

### Rojo primero — `tests/scrum1798c-meta-guard-ve-los-guards-de-navegador.test.mjs`, 13 casos

| medidor | resultado | evidencia |
|---|---|---|
| el de `origin/main` (copia idéntica, comprobada con `git diff --quiet`, en el mismo árbol) | **11 ✖ / 2 ✔** (los 2 ✔ son los controles) | `evidencias/SCRUM-1798/1798c-rojo-medidor-de-main-77c000dea.txt` |
| con la cura | 13/13 ✔ | `evidencias/SCRUM-1798/1798c-verde-con-la-cura.txt` |

El ✖ que es el ticket, literal: «el CIEGO salió como caído con el nombre del fichero: una declaración así sería
VIVA». **Control positivo:** un `scripts/` sembrado fuera del árbol con un guard que declara, otro que no y un
`otro.mjs` que declara pero no es guard → población 2, censo 1, una mutación. Controles en verde en los dos
medidores: el árbol tiene guards de navegador, y la población de `tests/` y sus suelos no se mueven.

`correr()` va en un proceso hijo, escrito en un temporal y sin `NODE_TEST_CONTEXT`: dentro de un fichero de
node:test su `run()` no ejecuta ficheros (aviso «called recursively… skipping»), y por `node -e` tampoco. Mi primer
rojo caía por eso y no por el defecto; es la A9 de arriba.

### Mutaciones — catálogo, juzgadas con `correr` + `aplicarUna` del propio medidor

Las cinco del test, cada una quitando una mitad de la cura: **5 VIVAS** (`evidencias/SCRUM-1798/1798c-mutaciones-del-catalogo.txt`,
guion `1798c-juzgar-una-prueba.mjs`; el medidor queda restaurado). Lo que NO se declara: que `aplicarUna` LLAME a
`juicioDeNavegador`; ejercitarlo desde un test exige mutar el árbol dentro de otro meta-guard. Va medido de punta a punta:

### De punta a punta, con un guard de navegador real (lo que J6 sólo pudo probar fuera del driver)

`evidencias/SCRUM-1798/1798c-punta-a-punta.mjs`, el driver CURADO sobre `scripts/guard-ficha-de-factura.mjs` con las
dos mutaciones de J6 (en local, Edge): **base salida 0 · `.j1-prog { display:none;` → VIVA** («pending · movil → la
línea de progreso no se ve: mide 0 (0×0)») **· la inocua (un espacio más) → MUDA** («salió 0 con la mutación
puesta») · `styles.css` restaurado byte a byte. (Antes de `juicioDeNavegador` la inocua salía CIEGA: así se vio.)

### Lo que se corrió además

- `--solo-censo`: salida 0; rótulo de `tests/` igual que antes (401 declarantes de 1.807 · 1.560 declaraciones) y la
  línea nueva: «censo de navegador · 0 guards DECLARANTES de 46 `scripts/guard-*.mjs` · 0 declaraciones».
- Los 97 tests que nombran el meta-guard, en 4 tramos uno por comando: **713 tests, 707 ✔, 2 ✖, 4 saltados.** Los 2 ✖
  son `scrum1726-tanda-firmada-j1` D1 (zona horaria de la máquina), que en el barrido de SCRUM-1825 cae igual con
  los dos bancos: ajeno. Los 4 saltados, SCRUM-781 gateado por `QA_DB_TEST`/`LIBRO_PG_URL`.
- `scrum812` pidió subir su trinquete (`LA COBERTURA HA SUBIDO a 46`): el test nuevo se titula guard y declara.
  Subido a 46 con su línea fechada, como las cinco anteriores, y su propia mutación re-anclada a 46 → 45.

### Sin medir / pendiente

- Un navegador lanzado desde el job del meta-guard en CI (ver arriba: no puede pasar hasta que un guard declare).
- `scrum836` (ancla única, la criba barata) sigue leyendo sólo `tests/`; una declaración nueva en un
  `scripts/guard-*.mjs` la vería sólo la PUERTA 1b del medidor. Cuando el primero declare, toca extenderlo.
- Ningún guard de navegador declara aún: declarar (p. ej. `guard-ficha-de-factura` con la mutación de J6) es del
  carril del guard, no de éste.

## SCRUM-1798c · apéndice 25-nov tarde — los rojos de #3449 eran MÍOS (S3)

**Medido contra:** `origin/main` = `2a6675c978794595696f87fb1a7ed3e52f904adb` · 2026-11-25T14:48:50Z

Tras el update-branch (`c8ab92808`), el run 45623877773 se puso rojo en cuatro jobs. Medido en sus logs:

| job | qué cayó | causa (de mi rama) | cura |
|---|---|---|---|
| build + tests | `scrum1308` · fuera de `tests/` un fichero se llama como un test | `evidencias/SCRUM-1798/1798c-juzgar-un-test.mjs` casa con `*-test.mjs`, y `node --test` lo ejecutaría | renombrado a `1798c-juzgar-una-prueba.mjs` (y su mención arriba) |
| build + tests | `scrum1349` ×2 · hijo `node` que hereda el entorno | `tests/scrum1798c-…:52` borraba sólo `NODE_TEST_CONTEXT` | borra también `FORCE_COLOR` y `NODE_OPTIONS` |
| build + tests | `scrum622` · el censo de redes benignas sube | `1798c-punta-a-punta.mjs:13`, `limpia.ciegoDelGuard \|\| 'verde'`: sin dato, pinta «verde» | imprime `ciego del guard: … ?? '(ninguno)'`, sin estado benigno por defecto |
| meta-guard parte 2 y «caen cuando deben» | CIEGO: la base de `scrum1349` ya caía sin mutar | la misma de arriba | la misma |

Rojo: el run del CI sobre `c8ab92808`, sin las curas. Verde en local con las curas (antes de mezclar main): los
cuatro ficheros, `scrum1308`, `scrum1349`, `scrum622` y `scrum1798c`, **37/37**. El trinquete de zona, también rojo
en este PR, NO es de esta rama: la pared de 15 min del hijo corta la cola de la tanda, también en ramas ajenas
(medido y entregado al orquestador).

Error propio: empujé con los sueltos del meta-guard en verde, pero sin pasar la tanda entera, y tres guards que ya
existían me cazaron en el CI. El de `scrum1349` es el que habría saltado antes que nadie.

A9: comprobación → `tests/scrum1349-entorno-prestado-solo-baja.test.mjs`
