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
