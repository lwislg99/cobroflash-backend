# SCRUM-1123 · el vigía avisa de verdad: abre/actualiza un Issue al declarar CONGELADA

**Fecha:** 25-sep-2026 16:38Z (GitHub) · **Carril:** S5 · workflows/vigías
**Medido contra:** `origin/main` = `cab692d54fd183fb737d00365ee5dcdd3d6ea257` · 2026-09-25T16:38:35Z
**Rama:** `scrum-1123-vigia-avisa-de-verdad` · **Worktree:** `wt-s5-1123-vigia-avisa`
**Origen:** encargo directo del orquestador `cobroflash-backend-06` a S5, disparado por el
incidente de SCRUM-1122 (producción 193h congelada, `vigia-despliegue.yml` en FAILURE desde el
24-sep y nadie lo miró en 8 días).

## El defecto

El vigía «avisa» fallando el job programado. GitHub sólo notifica eso a quien tenga activada la
notificación por email de workflows programados en rojo — nadie la tenía. El mecanismo de cálculo
del veredicto CONGELADO ya funciona bien (`_ritmo-de-despliegue.mjs`, ya conectado pese a que su
comentario de cabecera dice «no la llama nadie» — desfasado, no se toca en este ticket); lo que
falta es que el aviso sea VISIBLE sin abrir Actions.

## Por qué GitHub Issue y no Jira (la petición original)

`gh secret list` sobre el repo: sólo `CLAUDE_CODE_OAUTH_TOKEN`, `SCHEMA_CHECK_SECRET`,
`YAQU_BOT_CLIENT_ID`, `YAQU_BOT_PRIVATE_KEY`. Ningún secreto de Jira. Abrir un ticket de Jira desde
el workflow necesitaría `JIRA_BASE_URL` + `JIRA_EMAIL` + `JIRA_API_TOKEN` nuevos — una decisión de
credenciales del fundador (regla de la casa: secretos nunca en el chat, dependencia nueva la
decide él), no algo que se pueda simular. Un GitHub Issue con `GITHUB_TOKEN` (ya concedido, cero
secretos nuevos) cumple el mismo objetivo — visible sin mirar Actions — y queda declarado aquí
como el hueco si se prefiere Jira más adelante.

## El arreglo

`.github/workflows/vigia-despliegue.yml`:

1. `permissions: issues: write` añadido (antes sólo `contents: read`).
2. El paso del vigía (`id: vigia`) captura su propio código de salida en `set +e` / `exit
   "$codigo"` y lo publica como output `salida` — el job sigue saliendo exactamente igual que
   antes (mismo `process.exit` de `vigilante-de-despliegue.mjs`, sin tocar el instrumento).
3. Paso nuevo, `if: always() && steps.vigia.outputs.salida == '1'` (sólo `SALIDA_CANTA`; nunca en
   `2` NO_SUPE_MIRAR — sería tratar «no sé» como «sí», el mismo defecto que el vigía existe para
   no cometer — ni en `0`, que incluye «retrasado pero desplegando», SCRUM-716, que se cierra solo
   a propósito): busca un Issue **abierto** con la marca `<!-- vigia-despliegue:produccion-congelada
   -->` en el cuerpo (`gh api` + `jq contains()`, NUNCA `gh issue list --search` — la búsqueda de
   GitHub tokeniza y no garantiza casar un literal con `<!-- … -->`) y comenta ahí la lectura de
   hoy, o abre uno nuevo si no hay ninguno. Cuerpo construido con **un solo `printf` de una línea
   física** (mismo patrón que `avisador-rojo.yml`) para no romper la indentación del bloque
   `run: |` de YAML con un heredoc multilínea.

## Medido

- **YAML válido**: `js-yaml` (instalado en el worktree con `npm install --no-save js-yaml`, sólo
  para esta comprobación, no queda en el árbol) parsea el fichero completo sin error.
- **Sintaxis bash de los dos pasos tocados**: extraídos con `js-yaml` y pasados por `bash -n` →
  exit 0 los dos.
- **El `printf` del cuerpo**: probado con datos de muestra (renglón de constancia real de
  SCRUM-1122) — sustituye `$RENGLON`/`$RUN_URL`/`$MARCA` correctamente, produce Markdown válido
  con el bloque de código.
- **La consulta de dedupe (`gh api … -q 'jq contains(...)'`) EJERCIDA de verdad** contra el repo
  real (lectura, sin credenciales nuevas: usa el `gh` ya autenticado de esta máquina) →
  `EXISTENTE=[]` sobre el estado real (no hay ningún Issue con esa marca hoy). Es el control
  positivo que falta: confirma que la sintaxis y el filtro corren de verdad contra la API real, no
  sólo que "debería funcionar".
- **NO se ha podido probar la rama "SÍ hay un Issue abierto" ni "se crea uno nuevo"**: crear un
  Issue de prueba en el repo real es una escritura visible para terceros y el modo automático de
  esta sesión la bloqueó (clasificador de auto-mode, "External System Writes"). Queda sin ejercer
  end-to-end esa mitad — se puede comprobar en cuanto el vigía cante de verdad la próxima vez, o
  pidiendo GO explícito para el control con limpieza (crear → verificar → cerrar).

## Lo que NO se ha hecho

- ⛔ No se ha tocado `_vigilante-de-despliegue.mjs` ni `_ritmo-de-despliegue.mjs`: el veredicto y
  sus códigos de salida son exactamente los mismos.
- ⛔ No se ha añadido ningún secreto ni dependencia nueva.
- ⛔ No se ha creado el Issue de prueba real (bloqueado por auto-mode; ver arriba).
- ⛔ No se ha tocado SCRUM-1122 (el ticket de la incidencia concreta, con los pasos para el
  fundador) ni el `docs/sql/` pendiente de aplicar.

## SCRUM-1123b (seguimiento, 26-sep-2026) · la decisión sale del YAML y se prueba contra dobles

**Medido contra:** `origin/main` = `c5dd40fbd61f275c736f535d0afb2b4cdf6a5808` · 2026-09-26T12:52:32Z
**Rama:** `scrum-1123-verificado-servidor-falso` · **Worktree:** `wt-s5-1123-servidor-falso`
**Origen:** el orquestador pidió, tras SCRUM-1123b arriba, "ejercitar el camino de notificación
contra un servidor falso" (mismo espíritu que `tests/scrum1127-sif-client.test.mjs`) y declarar por
escrito lo que quede sin medir — sin crear el Issue de prueba real (eso queda para el fundador).

### Medido primero: el "experimento natural" NO sirve

El orquestador comprobó, ANTES de mandarme a tocar nada, si los 4 fallos del vigía entre el 24 y el
25-sep (22:46, 02:10, 09:09, 14:49) habían dejado algún Issue — habría sido la prueba en vivo del
mecanismo. **No sirve como prueba**: los 4 fallos son ANTERIORES al merge de PR #1777 (25-sep
17:02:50Z), y desde entonces el vigía está en success. Cero Issues de despliegue en el repo (solo
#1241 y #1698, ninguno de este vigía). La ausencia de Issue no confirma ni descarta el mecanismo.

### Por qué NO es un servidor HTTP falso hablando con `gh`

`gh` no tiene un endpoint configurable hacia un host arbitrario sin asumir GitHub Enterprise
(`GH_HOST` cambia la FORMA de la URL, `/api/v3/...`), así que un servidor falso ahí probaría una
forma de llamada que la ejecución real no usa — no sería una prueba más fiel, sería otra cosa. Esta
casa ya tiene el patrón correcto para este problema exacto (GH API vía `gh` CLI + dedupe por
marcador): `scripts/puerta-avisador-rojo.mjs` (SCRUM-834/853), que saca la DECISIÓN a un módulo
puro —JSON en, JSON fuera, cero red— y deja el `gh api`/`gh pr comment` real, fino, en el YAML.
Es la misma idea que un servidor falso para un cliente HTTP propio (SCRUM-1127): ejercitar el
código que TOMA LA DECISIÓN contra entradas fabricadas, en vez de confiar en que "debería funcionar".

### Qué se construyó

- `scripts/vigia-despliegue-aviso.mjs` (nuevo): `componerCuerpo` (el cuerpo del aviso, texto puro),
  `elegirIssueExistente` (dedupe por substring exacto de la marca en un cuerpo, ignorando PRs —la
  API de Issues los incluye— y `body: null`) y `decidirAviso` (junta las dos; sin `marca` no decide
  nada, fail-closed). CLI: lee `VIGIA_ISSUES_JSON`/`VIGIA_MARCA`/`VIGIA_RENGLON`/`VIGIA_RUN_URL` del
  entorno, imprime el JSON de la decisión, sale 0 si decidió y 1 si no pudo (`no-se-sabe`).
- `.github/workflows/vigia-despliegue.yml`: el paso de aviso ahora hace `gh api` para traer los
  Issues abiertos EN CRUDO, llama al script para decidir, y usa `jq` sobre su salida para el
  `gh issue create`/`comment` real. Ni el permiso (`issues: write`), ni la condición
  (`salida == '1'`), ni el patrón de dedupe cambian — se saca la lógica, no se rediseña.
- 🔴 **La clase de fallo que esto encontró, no un detalle de bash.** Los pasos `run:` de Actions
  llevan `-e -o pipefail`, así que si `jq` o `node` fallaban, el paso ABORTABA ANTES de poder decir
  por qué. Es la MISMA avería que ha dominado la tanda de hoy —«no pude mirar» indistinguible de
  «no hay nada»— pero en su forma más cruel: **el mecanismo de AVISO enmudecido por el propio fallo
  del que tenía que avisar.** Es hermano literal de SCRUM-1112 (el guard de acreditación del equipo
  de Javier se colgaba 1h46 en silencio porque imprimía todo al final): en los dos casos, el
  instrumento que existe para hablar cuando algo va mal es el primero en callarse cuando algo va
  mal. Arreglado con `|| true` en los tres puntos que pueden fallar (nunca relajando el `exit 1`
  final: el job sigue en rojo igual, lo único que cambia es que ahora SÍ llega a decir el motivo).
  **Pendiente, sin tiempo hoy para comprobarlo**: si otros workflows de este repo (`avisador-rojo.yml`,
  `pr-automatico.yml`, `zona-roja.yml`) tienen el mismo punto ciego — si tres de ellos no pueden
  reportar su propio fallo, eso es un ticket en sí, y no se ha medido todavía.

### Verificado

- 14 tests nuevos (`tests/scrum1123-vigia-despliegue-aviso.test.mjs`): `componerCuerpo` (constancia
  + URL + marca, en orden; sin renglón no inventa uno), `elegirIssueExistente` (substring dentro de
  cuerpo largo, PR no cuenta, `body:null` no revienta, elige el primero que casa) y `decidirAviso`
  (crear vs. comentar, fail-closed sin marca) — y el CLI real, como SUBPROCESO (`spawnSync`, no un
  `import`): issues vacío → crea; Issue con la marca → comenta ESE número; `VIGIA_ISSUES_JSON`
  ilegible → exit 1; sin `VIGIA_MARCA` → exit 1. **14/14 pass.**
- Los tests que YA leían este workflow (`scrum716b`, `scrum716c`, `scrum677b`, `scrum387`,
  `scrum834`) siguen en verde: 91/91 sobre el conjunto.
- `npm run guards:entrada`: 112/112. `npm run build`: limpio.
- Sin `js-yaml` esta vez (no queda instalado en ningún árbol): la revisión de la sintaxis bash fue
  manual, línea a línea, más las pruebas end-to-end del CLI real como subproceso.

### Lo que SIGUE sin medir, dicho sin rodeos (lo que pidió el orquestador)

- **Que `api.github.com` acepte de verdad** el `gh api .../issues`, `gh issue create` y
  `gh issue comment` reales con el `GITHUB_TOKEN` de la ejecución. Ningún test de esta casa mide
  eso para el mecanismo hermano (`avisador-rojo.yml`) tampoco — no es un hueco nuevo de este
  ticket, es el mismo hueco que ya se acepta ahí.
- **El Issue de prueba real** (crear uno, verlo aparecer, comentarlo, cerrarlo) sigue sin hacerse.
  No lo hace esta sesión (el clasificador de auto-mode ya lo negó una vez) ni lo hace el
  orquestador en su lugar: queda en la lista del fundador, como se acordó.
- La próxima vez que el vigía cante DE VERDAD en producción será la primera comprobación end-to-end
  real de los dos caminos (crear y comentar) desde que existe este mecanismo.

## SCRUM-1123c (seguimiento, 28-sep-2026) · entorno neutralizado en el test + censo del punto ciego pendiente

**Medido contra:** `origin/main` = `cfc5e676f9c9f51c675b65c81dc8eb2136ecc70c` · 2026-09-28T14:08:55Z
**Rama:** `scrum-1123c-vigia-neutraliza-ruido` · **Worktree:** `wt-s5-999-cuota-antes-de-lanzar`
**Origen:** S1, corriendo de nuevo el censo AST de SCRUM-1153 sobre el árbol de hoy, encontró dos
ocurrencias NUEVAS del patrón «spawnea un `node` hijo + parsea su `stdout` + entorno no neutralizado»
en este mismo fichero de test, que no existían cuando SCRUM-1153 hizo su barrido (26-sep). El
orquestador me las pasó por ser de mi carril. Aparte, sigue pendiente desde SCRUM-1123b (línea 122-124
arriba) el censo de si OTROS workflows tienen el mismo punto ciego de `-e -o pipefail`.

### El arreglo del entorno (`tests/scrum1123-vigia-despliegue-aviso.test.mjs:95` y `:131`)

`correrCli()` (línea 95, usada por 2 tests) y el test FAIL-CLOSED "sin `VIGIA_MARCA`" (línea 131)
construían el `env` del hijo con `{ ...process.env, ... }` sin neutralizar `FORCE_COLOR`,
`NODE_OPTIONS` ni `NODE_TEST_CONTEXT` — el mismo patrón que SCRUM-938/899/899b/951a/954/959b/
1007-1011-1026 ya tenían arreglado. Aplicado el mismo `delete` × 3 en los dos sitios.

🔴 **PASO 0, dicho tal cual salió — no encontré víctima HOY para ESTE caso concreto.** Antes de
tocar nada probé el script real (`scripts/vigia-despliegue-aviso.mjs`) con `FORCE_COLOR=1`,
`NODE_TEST_CONTEXT=child-process` y, importante, con el `NODE_OPTIONS` REAL que `ci.yml` usa
(`--test-reporter=spec … --test-reporter=tap …`, línea 257 de `ci.yml`): el `stdout` del CLI salió
limpio en los tres casos, `JSON.parse` no revienta, exit 0. La única falla que sí reproduje fue
distinta y externa al fichero: correr `node --test tests/….mjs` con `NODE_TEST_CONTEXT` YA puesto en
el proceso PADRE hace que el propio runner de `node --test` se detecte "recursivo" y salte el
fichero entero con exit 0 (`(node:…) Warning: node:test run() is being called recursively… skipping
running files.`) — eso es una propiedad de cómo invoqué la prueba desde mi shell, no del código de
este fichero. Aplico el arreglo de todos modos porque es barato, consistente con el resto de la casa,
y cierra el hueco estático que el censo señala — pero lo declaro como refuerzo preventivo, no como
bug confirmado con víctima, para no inflar el hallazgo. 14/14 tests siguen en verde tras el cambio.

### El censo pendiente: ¿cuántos workflows no pueden reportar su propio fallo?

Mirado `.github/workflows/*.yml` entero (8 ficheros) buscando el patrón exacto que costó los 8 días
de SCRUM-1122: una tubería (`cmd | jq`/`cmd | node`/`cmd | grep`) dentro de un `run:` (que lleva
`-e -o pipefail` por defecto) SIN `|| true` ni `if ! X="$(...)"` que la proteja, de forma que un
fallo a mitad de tubería ABORTA el paso antes de llegar a la rama que explica por qué.

**Tres instancias reales, en tres ficheros distintos** (umbral que el orquestador fijó para abrir
ticket):

1. **`vigia-despliegue.yml:214`** (el propio fichero que SCRUM-1123b arregló) — la rama `comentar`
   del aviso (`printf '%s' "$DECISION" | jq -r '.cuerpo' | gh issue comment …`) NO lleva el mismo
   `|| true`/manejo explícito que sí tiene la rama `crear` dos líneas más abajo (219-220, con
   `&& echo … || { echo "::error::…"; exit 1; }`). Si `gh issue comment` falla, este paso aborta sin
   el `::error::` ni la línea de `$GITHUB_STEP_SUMMARY` que el resto del fichero sí escribe siempre.
   Asimetría dentro del MISMO arreglo, no algo nuevo por fuera.
2. **`vigia-atascados.yml:208`** — `NUM="$(gh issue create --title "$TITULO" --body-file cuerpo.md |
   grep -oE '[0-9]+$')"` sin guardar. Contrasta con el resto del mismo fichero (líneas 172-177,
   188-192), que SÍ usa `if ! X="$(...)"; then echo "::error::…"; echo "- **…**" >> …; exit 1; fi`
   en cada lectura de riesgo. Esta es la única escritura sin ese patrón.
3. **`zona-roja.yml:113-115`** — `ID=$(gh api … --jq '…' 2>/dev/null | head -1)` sin guardar. Es el
   más grave de los tres: este workflow existe para **nunca bloquear un PR** (`exit 0` explícito al
   final, comentario "Pase lo que pase: verde. Si sale rojo, no es un aviso."), y precisamente esta
   línea sin proteger es la única forma en que el paso PUEDE morir con `-e` antes de llegar a ese
   `exit 0` — el propio diseño "no bloqueante" queda roto por el único punto sin guardar.

**Revisados y limpios** (ya usan `if ! X="$(...)"` o el patrón `if <pipe>; then… else…fi` exento de
`-e` a propósito, con comentario que lo explica): `avisador-rojo.yml`, `claude.yml`,
`pr-automatico.yml` (línea 393-396 tiene el comentario más explícito de la casa sobre por qué:
"los comandos que son condición de un `if` están exentos de `-e`"), `conflicto-de-registro.yml`
(el único pipe sin `if !`, línea 164, va envuelto en `try/catch` dentro del propio `node -pe`, así
que no puede tirar el pipe — no cuenta). `ci.yml` ya tiene su propio arreglo de la misma familia
documentado en `CLAUDE.md`/SCRUM-850 (TAP a fichero, leído en un segundo comando) y no se ha vuelto
a mirar aquí.

No abro ticket yo: lo dejo aquí con las tres líneas exactas para que el orquestador lo abra con
nombre propio, como dijo.

### Verificado

- `node --test --test-force-exit tests/scrum1123-vigia-despliegue-aviso.test.mjs` → 14/14 pass.
- Censo de workflows: lectura completa de los 8 ficheros de `.github/workflows/`, sin herramienta
  nueva — grep dirigido + lectura de cada `run:` señalado, con el código de alrededor.

## SCRUM-1123c · rescate y re-medición (2-oct-2026)

**Medido contra:** `origin/main` = `7d8a3ec970669bab0265fdb1a100abcda6c2c76f` · 2026-10-02T13:31:59Z (cabecera `Date:` de GitHub)
**Rama:** `scrum-1123c-censo-workflows-y-su-desmentido` (viajó aparcada como `wip-s5-1123c-censo-workflows` hasta que el orquestador autorizó abrir PR) · **Worktree:** `wt-s5-1123c`

A9: aviso → A10 «Antes de llamar mecanismo a lo que has visto, di sobre cuántos elementos lo mediste: un instante no es un régimen.» — no se pudo comprobar: el censo del 28-sep afirmó «`-e -o pipefail` por defecto» sobre CERO corridas leídas (lo copió de un comentario del YAML); qué opciones pone Actions sólo está en el log de una corrida, y ningún test del árbol puede leerlo

**De dónde sale el tramo de arriba.** `s5-27a` murió sin traspaso y dejó la sección «SCRUM-1123c
(seguimiento, 28-sep-2026)» SIN COMITEAR en `wt-s5-999-cuota-antes-de-lanzar`. Lo encontró S0 barriendo
sesiones muertas. Está copiado TAL CUAL (74 líneas, `git diff` del árbol muerto aplicado sobre `main`),
sin corregir nada dentro: lo que hoy ya no se sostiene se dice aquí abajo, no se reescribe allí.

- **El arreglo del test que describe NO viaja en este commit:** ya está en `main`
  (`tests/scrum1123-vigia-despliegue-aviso.test.mjs:97` y `:131`), entró por otro camino.
- **El ticket que pedía («que el orquestador lo abra con nombre propio») no se abrió nunca:** ningún
  registro de `docs/master/` recoge este censo (buscado por la frase y por las tres líneas).

### 🔴 La premisa del censo es FALSA, y lo que cambia

El censo —y el comentario de `vigia-despliegue.yml:204-207`— dicen que los `run:` de Actions «llevan
`-e -o pipefail` por defecto». **Medido en el log de una corrida real de cada uno de los tres
workflows: `shell: /usr/bin/bash -e {0}`.** `-e` sí; `pipefail` NO (ése sólo lo pone Actions cuando el
paso declara `shell: bash`, y ninguno de los tres lo declara). Corridas leídas: `zona-roja`
35366350410 · `vigia-atascados` 36987638530 · `vigia-despliegue` 36979669018.

Consecuencia: **sin `pipefail`, en una tubería sólo cuenta el ÚLTIMO comando.** Las tres líneas siguen
vivas, pero no por la razón escrita, y no pesan lo mismo.

### Las tres, contra `main` de hoy

| # | Dónde (hoy) | ¿Sigue igual? | Qué pasa de verdad si falla | Peso |
|---|---|---|---|---|
| 1 | `vigia-despliegue.yml:214` | Sí, misma línea | Si falla `gh issue comment` (el último), el paso aborta ROJO sin `::error::` ni línea en el resumen. Si falla el `jq` de en medio, **no aborta**: `gh` recibe un cuerpo vacío. | Bajo: sale rojo, sólo falta el porqué |
| 2 | `vigia-atascados.yml:220` (era `:208`; la movió SCRUM-1270) | Sí, mismo texto | Si `gh issue create` falla, `grep` no casa, sale 1 y el paso aborta ROJO sin `::error::`. Nunca verde en falso. | Bajo: igual que el 1 |
| 3 | `zona-roja.yml:113-115` | Sí, misma línea | El paso hace `set -uo pipefail` y **cree** no llevar `-e` (comentario de la línea 71: «`set -e` NO»). Lo lleva: lo pone Actions al invocar. Si `gh api` falla, la asignación sale ≠0 y el paso MUERE antes del `exit 0` de la línea 128. | **Alto: el workflow que «no puede salir rojo» puede** |

**Mecanismo probado en local, cada uno con su control** (bash 5.2, mismas opciones que el log):
- 2 · `bash -e -c 'NUM="$(false | grep -oE "[0-9]+$")"; echo …'` → exit 1, no imprime. Control con
  entrada buena → imprime `#12`, exit 0.
- 3 · `bash -e -c 'set -uo pipefail; ID=$(false | head -1); echo LLEGA; exit 0'` → **exit 1, no llega**.
  Control con `gh` bueno → llega, exit 0. Control SIN `-e` (lo que el fichero cree tener) → llega, exit 0.
  La diferencia entre «llega» y «no llega» es exactamente el `-e` que el comentario niega.

### Lo que NO he podido mirar

- **¿Ha habido víctima?** `zona-roja` tiene **6 corridas con conclusión `failure`** en su historia
  (6-ago · 16-sep ×4 · 17-sep), en un workflow cuyo contrato es no salir nunca rojo. La línea 113 ya
  existía en esas fechas (comprobado en `9ff07948`). **Pero GitHub ya no guarda ni sus jobs ni su log**
  (`jobs.total_count = 0`, «log not found»): no sé en qué paso murieron. Puede ser esta línea o no.
  En las últimas 500 corridas: 484 `success`, 16 `cancelled`, 0 `failure`.
- `vigia-atascados`: 115 de 115 `success`. `vigia-despliegue`: 5 `failure` de 167, sin atribuir (un rojo
  suyo es también su señal legítima de «producción congelada»).
- `ci.yml` no se ha mirado (es del fundador).

### Lo que este censo NO es

No es la familia de «`main` rojo y nadie lo vio» del 2-oct. Aquello es un rojo que nadie RECIBE; esto
es un paso que muere sin DECIR por qué (1 y 2) o que sale rojo cuando prometió no hacerlo (3). Medido
el mismo día: de las 12 últimas corridas de `ci.yml` por push a `main`, 4 `failure` y 8 `cancelled`;
el obligatorio `build + tests` sólo cayó en una, `643e9a65` (13:02Z) — las rojas de 11:59Z, 12:18Z y
12:40Z fueron de jobs informativos (meta-guard, trinquete) con el obligatorio en verde.

### Qué queda

Nada arreglado aquí: sólo registro. Los tres ficheros son workflows; el arreglo (un `if !` en cada
línea, y en `zona-roja` un `set +e` explícito o corregir el comentario) es ticket aparte y lo abre el
orquestador si lo quiere.

**Abierto el 2-oct-2026: SCRUM-1434, sólo para `zona-roja.yml`** (la 3). Las otras dos (1 y 2) van
dentro de ese ticket como nota, no como tarea: les falta el `::error::`, nunca salen verdes en falso.
El ticket no autoriza a tocar ningún workflow: son del fundador. Las tres líneas, releídas ese día
contra `origin/main` = `10828add`, siguen en el mismo sitio y con el mismo texto.

## SCRUM-1123d · el latido dice el ÚLTIMO VEREDICTO del vigía de despliegue (la condición para cerrar)

**Rama:** `scrum-1123d-latido-dice-el-veredicto` · **Carril:** S5 · **Fecha:** 7-oct-2026
**Medido contra:** `origin/main` = `5f1bb361ae5b6b0d720b28b54c624f5d8483ff3b` · 2026-10-07T15:07:04Z (hora de GitHub)

A9: comprobación → `tests/scrum1123d-latido-dice-el-veredicto.test.mjs`

**Por qué.** El orquestador decidió cerrar este ticket como «cerrado, rama de aviso NO ejercida en vivo» (Jira,
c.18656), con una condición de reapertura: el primer CONGELADO real que no deje Issue. Y puso una condición para
cerrar: que esa condición se pueda VER. La pregunta era si la sección VIGÍA del latido dice el último veredicto
del vigía de despliegue. La respuesta, mirado `main`: no. `latido.mjs` leía un solo workflow,
`vigia-atascados.yml`; `vigia-despliegue.yml` no aparecía en el fichero.

### Lo medido antes de escribir (GitHub, 7-oct-2026, dos pasadas: hacia las 08:00Z y poco antes de las 15:07Z)

| qué | medido |
|---|---|
| corridas de `vigia-despliegue.yml` leídas | 190, del 2-sep al 7-oct 14:49Z: 185 `success`, 5 `failure` |
| la conclusión de la corrida | NO distingue CONGELADA (salida 1) de «no supe mirar» (salida 2): las dos son `failure` |
| lo que sí lo distingue: los pasos del job | con `success`, el paso de aviso sale `skipped`; en la del 30-sep (36684679677, salida 2) el paso que mira sale `failure` y el de aviso `skipped`. El de aviso sólo corre con salida 1 (`if: always() && steps.vigia.outputs.salida == '1'`) |
| las cuatro `failure` del 24/25-sep | anteriores a #1777: no tienen paso de aviso. No se pueden leer con esta regla, y la función lo dice (ciega), no lo adivina |
| huecos entre corridas (cron cada 2 h) | 189 huecos: mediana 4,7 h · p90 6,8 h · máximo 8,7 h. El tope de 12 h queda por encima de todo |
| veces que ha cantado CONGELADA desde #1777 | 0. La rama «abre o comenta el Issue» sigue sin ejecutarse nunca |

### Qué cambia

| Sitio | Antes | Ahora |
|---|---|---|
| `scripts/equipo/latido.mjs` · `veredictoDelVigiaDeDespliegue` | (no existía) | lee la última corrida terminada y dice una de cinco cosas (abajo) |
| `scripts/equipo/latido.mjs` · `seccionVigia` | PR atascados | lo mismo, con el veredicto del despliegue DELANTE. La ceguera de una mitad ciega la sección pero no tapa lo que leyó la otra |
| `scripts/equipo/latido.mjs` · recogida | 4 llamadas a `gh` en el tramo | 1 más siempre (las corridas); 1 más si la última cayó (sus pasos); 1 más si cantó (los Issues abiertos) |
| `tests/scrum1123d-latido-dice-el-veredicto.test.mjs` | — | 8 tests; uno ata los dos nombres de paso, la condición del aviso y la marca al YAML |

Lo que dice, y cuándo:

| última corrida | pasos | dice | ¿alerta? |
|---|---|---|---|
| `success` | (no se piden) | `veredicto NO CANTÓ (salida 0: producción al día, o retrasada pero desplegando)` | no |
| `failure` | mira `failure`, aviso `skipped` | `NO SUPO MIRAR (salida 2)` · «que no haya aviso NO es que producción esté al día» | sí |
| `failure` | aviso corrió, hay Issue abierto con la marca tocado después de la corrida | `CANTÓ PRODUCCIÓN CONGELADA · su aviso es el Issue #N` | sí |
| `failure` | aviso corrió y no hay Issue con la marca · o el paso de aviso cayó · o el Issue no se ha tocado desde antes | `CANTÓ PRODUCCIÓN CONGELADA y NO CONSTA SU AVISO … ESTO REABRE SCRUM-1123` | sí |
| más de 12 h sin corrida terminada | — | `NO CORRE desde hace N h … su veredicto es de ENTONCES` (delante del veredicto) | sí |
| no llegan las corridas · no llegan los pasos · falta un paso por su nombre · cantó y no llegan los Issues | — | sección CIEGA (salida 2), nunca verde | — |

Qué Issue lleva la marca se decide con `elegirIssueExistente` de `scripts/vigia-despliegue-aviso.mjs`, la misma
función que usa el workflow: no hay un segundo criterio.

### Visto en vivo

`node scripts/equipo/latido.mjs` desde el árbol de la rama, el 7-oct minutos antes de las 15:07Z (hora de GitHub):

    🔴 VIGÍA · vigía de DESPLIEGUE: última corrida hace 0.4 h, veredicto NO CANTÓ (salida 0: producción al día, o retrasada pero desplegando) · última pasada del vigía hace 5.8 h (success) · issue #1241 · 46 comentarios, …

(El 🔴 es de dos avisos de PR atascados sin leer, no del despliegue.) El tramo «vigía» tardó 5,2 s con 4 llamadas.

Y la función sola contra corridas REALES, tomando cada una como si fuera la última (sonda fuera de git):

| corrida | dice |
|---|---|
| 37639986153 · 7-oct 14:49Z · `success` | NO CANTÓ, sin alerta |
| 36684679677 · 30-sep 07:36Z · `failure` | NO SUPO MIRAR (salida 2), con alerta y el enlace a la corrida |
| las cuatro del 24/25-sep · `failure` | CIEGA: «entre sus 9 pasos no está "Avisar de verdad si el vigía cantó (Issue de GitHub)"» |

### Visto en rojo

Sobre `tests/scrum1123d-latido-dice-el-veredicto.test.mjs`. Base: 8 tests, 8 pasan. Cada mutación toca una línea
y se restaura después (`git status` al final: sólo los dos ficheros de la rama).

| Mutación | Caen |
|---|---|
| `latido.mjs`: `skipped` se lee como «cantó» | 2 |
| `latido.mjs`: nunca dice que falta el aviso (`if (falta)` → `if (false)`) | 2 |
| `latido.mjs`: un Issue con la marca basta aunque nadie lo haya tocado | 1 |
| `latido.mjs`: un paso de aviso caído cuenta como aviso | 1 |
| `latido.mjs`: `failure` sin pasos legibles se da por «no cantó» | 1 |
| `latido.mjs`: la sección no pregunta por el despliegue | 1 |
| `latido.mjs`: el tope de 12 h no se aplica | 1 |
| `vigia-despliegue.yml`: el paso de aviso cambia de nombre | 1 |
| `vigia-despliegue.yml`: el aviso corre también con salida 2 | 1 |
| `vigia-despliegue.yml`: la marca cambia | 1 |

### Lo que esto NO es

- **No ejerce la rama de aviso.** Sigue sin haberse visto abrir ni comentar un Issue. Lo que cambia es que, el
  día que cante, el latido dirá si el Issue está o no. Las ramas CONGELADA de la función sólo se han visto contra
  dobles: en GitHub no hay ninguna corrida con salida 1 posterior a #1777.
- **El latido corre cuando alguien lo corre.** No convierte al vigía en un aviso que llega solo.
- **`NO CANTÓ` no separa «al día» de «retrasada pero desplegando».** Las dos son salida 0; separarlas pide leer el
  log de la corrida, y la sección DESPLIEGUE del latido ya mide eso por su lado.
- **Una salida distinta de 0, 1 y 2** (el guion reventando con salida 1, por ejemplo) se leería como CONGELADA,
  igual que la lee el propio workflow.
