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
