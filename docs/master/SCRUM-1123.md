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
- 🔴 **Un fallo real que este mismo trabajo encontró y corrigió**: los pasos `run:` de Actions
  llevan `-e -o pipefail`; sin guardas, un `jq`/`node` que fallara habría abortado el paso ANTES de
  llegar al `if`/`else` que reporta el motivo — el mismo defecto de fondo («abortar en vez de
  decidir») que esta pieza entera existe para no cometer, escondido un nivel más abajo. Añadidos
  `|| true` en los tres puntos que pueden fallar, con su motivo en el comentario.

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
