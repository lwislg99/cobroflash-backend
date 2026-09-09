# Afirmaciones del orquestador, pasadas por la Sesión 0

La regla: **todo lo que el orquestador escriba como HECHO sobre el código pasa por la Sesión 0
antes, o se escribe como PREGUNTA.**

Este fichero es el mecanismo, no el buen propósito. Sin él la regla es una intención; con él, cada
afirmación deja rastro y la siguiente se puede comprobar con un comando que ya está escrito.

## Cómo se usa

1. El orquestador va a escribir algo como hecho sobre el código → lo manda a la Sesión 0.
2. La Sesión 0 lo mide y añade una fila: **lo que se afirmó · lo que se midió · el comando exacto**.
3. Si no hay comando que lo mida, no es un hecho: es una pregunta, y se escribe como pregunta.

⚠️ La tercera columna es la que hace que esto valga. Una fila sin comando reproducible es una
opinión con dos columnas de adorno. Y el comando se escribe **entero y pegable**, no descrito.

⚠️ Y los números caducan. La columna del medio dice lo que se midió **el día que se midió**; el
comando es lo que permite volver a preguntarlo hoy. Cuando los dos discrepan, no es que la fila
esté mal: es que el árbol se movió, y ése es justo el dato.

## Las nueve que ya conocemos

Sembradas el 8-sep-2026 sobre `origin/main` = `da5ac06a`. Las marcadas **[re-medido hoy]** se han
vuelto a correr al escribir esta tabla; las marcadas **[del registro]** se conservan con su comando
pero **no** se han vuelto a medir — y eso se dice en vez de callarlo.

| lo que se afirmó | lo que se midió | comando exacto |
| --- | --- | --- |
| «171 llamadas a git» | **71**. Se contaba TEXTO, no llamadas. **[re-medido hoy: 201]** — el número está vivo y crece; lo que no cambia es que hay que contar llamadas, no menciones | `node --input-type=module -e "const {censarReferenciaMovil}=await import('./tests/_censo-referencia-movil.mjs'); const c=censarReferenciaMovil(process.cwd()); console.log(c.llamadas)"` |
| «cuatro sitios del atajo N» | **seis**. **[re-medido hoy: 6]** | `node scripts/verificacion-s5/kbd-en-botones-de-crear.mjs` |
| «el NIF se imprime en el PDF» | **no se imprime**. **[del registro]** — hoy `pdf.service.ts` nombra `taxId` 8 veces, pero son declaraciones de tipo y el flag `docFields.taxId`: **nombrarlo no es imprimirlo**, y eso se decide leyendo el texto del PDF generado, no el fuente | `node --test tests/scrum604-desglose-en-el-pdf.test.mjs` (usa `tests/_texto-del-pdf.mjs`, que lee el TEXTO real del PDF y no su tamaño en bytes) |
| «SCRUM-724: hay que decidir los 44 px» | **el ticket no existía**: ya estaba decidido en SCRUM-352. **[del registro]** | `git log --oneline --grep="SCRUM-724" origin/main` y `ls tests/ \| grep 352` |
| «SCRUM-822: main está rojo» | **main estaba verde**: 5909 tests, 0 fail, `exit 0` — más 48/48 del banco `LIBRO_PG_URL` que CI sí corre. El 404 que se vio era real, pero **de un worktree con un punto en la ruta** (`.claude/worktrees/…`), no de la landing | `git checkout --detach origin/main && npm run build && node --test --test-force-exit tests/*.test.mjs` |
| «la tabla ocupa 730 px» | **978**. **[del registro]** — una caja CSS no es lo que ocupa: hay que medir el DOM ejecutado | `node scripts/censo-objetivo-tactil-panel.mjs` (mide sobre el navegador, no sobre la hoja de estilos) |
| «faltan los objetivos táctiles» | **ya estaban hechos** (SCRUM-720d). **[del registro]** — hoy el guard declara 15 excepciones con su motivo, que es distinto de «faltan» | `grep -c "sel: 'BUTTON" scripts/guard-objetivo-tactil.mjs` y `npm run guard:objetivo-tactil` |
| «el auto-merge falla por el conflicto» | **fallaba por permisos**. **[del registro]** — no se puede medir desde aquí: hace falta el log del workflow | `gh run list --workflow=pr-automatico.yml` — ⚠️ **`gh` NO está instalado en este entorno**, así que esta fila queda declarada como NO verificable localmente |
| «Jira no funciona en Visual» | **sí funciona**. **[re-medido hoy]** — el MCP de Atlassian ha contestado en esta misma sesión sobre `cloudId 30938fdf-…` | consulta JQL por el MCP de Atlassian; sin MCP, `docs/equipo/00-normas-comunes.md` no promete otra vía |

## Casos nuevos

Primer caso real del filtro: **dos sesiones escribieron dos hechos incompatibles y hubo que medir
cuál era.** Y el tercero es mío, que es lo que hace que esto valga para todos.

| lo que se afirmó | lo que se midió | comando exacto |
| --- | --- | --- |
| **S0:** «`revert-1192-…` ya no existe en el remoto, sólo queda su ref local; en un clon nuevo no pasaría» · **S3:** «main está rojo por esa rama REMOTA» | **Gana S0.** La rama NO está en el remoto: `ls-remote` devuelve vacío (control: ve 103 refs). Era una ref local obsoleta, y tras `git fetch --prune` **SCRUM-753 pasa a verde**. ⚠️ Declarado: el `for-each-ref` sale vacío hoy porque yo mismo pruné en el turno anterior — la prueba es `ls-remote`, que ya daba 0 ayer con la ref local presente | `git ls-remote --heads origin \| grep revert-1192` · `git for-each-ref refs/remotes/origin/ \| grep revert-1192` · `git fetch --prune origin && node --test tests/scrum753-censo-de-alcanzabilidad.test.mjs` |
| «main está verde en CI» (mi primera lectura del listado de Actions) | **ROJO.** El listado se leyó mal; la página del run dice `Failure` y «build + tests (con banco desechable)» sale con `exit code 1`. Run #2140 sobre `da5ac06a`. 🔒 Gana la fuente detallada sobre el resumen | `https://github.com/lwislg99/cobroflash-backend/actions/runs/34210697350` — ⚠️ los LOGS no son visibles sin `gh`, así que la causa no se lee de CI: se sostiene reproduciéndola |
| «el tapón de los 22 PR son 22 problemas» | **Es UNO, y es mío.** Sobre el mismo `da5ac06a`, en local y con las refs ya podadas, falla **sólo `scrum804-la-rama-viva`** (3 de 8), por la barrida de 456 ramas que ejecuté: su control enumerado busca la rama de SCRUM-821 —que borré, y con razón: su trabajo está en main por el PR #1167— y sus dos suelos codifican «558 ramas» y «464 dentro de main» | `git checkout --detach origin/main && node --test tests/scrum804-la-rama-viva.test.mjs` |
| **El fundador**, en el prompt de arranque del orquestador (9-sep-2026): «lee `YAQU_MASTER.md`», situándolo en la RAÍZ del repositorio | **No está en la raíz, y no ha estado nunca.** Vive en `docs/YAQU_MASTER.md`, 1.882 líneas. No es que se moviera: sobre la ruta de raíz, `git log --all` no devuelve **ni un commit** en ninguna rama. Lo reconoce él mismo — *«lo escribí mal en tu prompt, sin leerlo»* — y queda como **error nº 16**. 🔒 Es el primero que no es del asesor, y por eso importa: **la regla no mira quién escribe. Una ruta citada de memoria es una afirmación sobre el código**, la escriba quien la escriba | `for f in YAQU_MASTER.md docs/YAQU_MASTER.md; do test -f "$f" && echo "OK $f" \|\| echo "FALTA $f"; done` → `FALTA YAQU_MASTER.md` / `OK docs/YAQU_MASTER.md`. **Con su control positivo**, porque un vacío solo no distingue «no existe» de «el comando no mira donde debe»: `git log --all --oneline -- 'YAQU_MASTER.md' \| wc -l` da **0** frente a `git log --all --oneline -- 'docs/YAQU_MASTER.md' \| wc -l`, que da **273** (medido 9-sep-2026 sobre `origin/main` = `af3c50d8`, worktree `wt-jefe`) |

| **Yo mismo**, 9-sep-2026, en el mismo mensaje: «acabo de contar **1.318 ramas remotas**» (para sostener que la población del guard de SCRUM-833 crece sola) y, tres párrafos después, «me salieron **139 y luego 135**, así que ese número no te lo doy como bueno» | **108 ramas remotas vivas.** Ninguno de mis dos números contaba ramas: `git branch -r` mezcla tres poblaciones distintas y en este árbol da 1.322 = **110** refs de `origin` + **1.212** bajo `refs/remotes/pr/*`, que son **cabezas de pull request, no ramas** (heredadas por refs compartidos: el refspec de `origin` es solo `refs/heads/*`, así que las puso otra sesión). Además tenía **2 refs rancias** que el servidor ya no sirve. 🔒 **El error no es el número: es que cuestioné el que usé como DATO y no el que usé como ARGUMENTO.** Un número que sostiene una conclusión merece más escrutinio que uno que solo se reporta, no menos. Coincide con la Sesión 0 (~98-104) en cuanto se pregunta al servidor en vez de a mis refs | **Al servidor, que es la única fuente autoritativa:** `git ls-remote --heads origin \| wc -l` → **108**. Las tres poblaciones, separadas y nombradas: `git for-each-ref refs/remotes/origin/ \| wc -l` (110, mis refs, incluye rancias) · `git for-each-ref refs/remotes/pr/ \| wc -l` (1.212, cabezas de PR) · `git for-each-ref refs/heads/ \| wc -l` (613, locales). Control de refs rancias: `comm -13 <(git ls-remote --heads origin \| sed 's\|.*refs/heads/\|\|' \| sort) <(git for-each-ref --format='%(refname:short)' refs/remotes/origin/ \| sed 's\|^origin/\|\|' \| sort)` |
| **El traspaso del 9-sep** (y yo repitiéndolo sin medirlo): «Queda SCRUM-833 (`scrum637:164`) **a 4 ramas de caer**, con la misma forma» | **Ya está desactivado y en `main`.** El commit `4911488d` («scrum637 deja de medir el envase») es ancestro de `origin/main`. El umbral vivía en la línea **104**, no en la 164, y hoy ahí solo queda su lápida: *«AQUÍ HABÍA `inst.ramas.length > 50`»*, sustituido por `merges.length > 0`, que no caduca. El propio comentario da la cifra real del margen que hubo — **«con 97 refs vivas quedaban 47 de margen»**, no 4. El ticket sigue **En curso** en Jira con su rama dentro de main: es el caso espejo de la regla 42 | `git merge-base --is-ancestor 4911488d origin/main && echo MERGEADO` · `sed -n '104,108p' tests/scrum637-la-rama-que-nadie-mira.test.mjs` · barrido de la familia entera: `grep -rnE "ramas(\.length)? ?[<>]=? ?[0-9]+" tests/*.test.mjs` (medido 9-sep-2026 sobre `af3c50d8`) |

## Lo que estas nueve tienen en común

Ninguna es una mentira: **todas empiezan en una observación real**. Lo que falla es el paso
siguiente — convertirla en diagnóstico y escribirla como hecho sin el comando que la sostenga.

Cinco de las nueve se habrían cazado en dos minutos con un comando de una línea. Ése es el coste
de la regla, y por eso la regla es barata.

> 🔒 Contar texto no es contar cosas · una caja CSS no es lo que ocupa · nombrar algo no es
> imprimirlo · un rojo en tu árbol no es un rojo en main.
