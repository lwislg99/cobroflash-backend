# SCRUM-414 · El guard atado al NOMBRE de la variable, no al hecho

**10-ago-2026, 14:53 CEST (UTC+0200)** · commit `9064d86ee5199e24cef93b350122b7a99b429af0`

Sale de una comprobación de SCRUM-410: se pidió confirmar que `scrum195-url-bd-sin-fuga` seguía
verde y no huérfano. Estaba verde. **Y el rojo de prueba no salió.**

## Lo que fallaba

El guard enunciaba *«ningún script parsea una URL de BD a mano, ni siquiera uno desechable»* y lo
hacía cumplir mirando **el nombre de la variable** (`/db|database|conn|dsn|postgres|pg/i`). Basta
llamarla `u` para salir del radar — y así estaba: **tres scripts parseaban a mano en `main` con el
guard en verde**. Los tres **ya importaban `_db-guard.mjs`**; nadie usaba `parseBDSegura` porque
nada lo exigía.

**Sexta variante del mismo patrón de esta casa:** el guard atado a la FORMA en vez de al HECHO.
Ternario, `||`, objeto indexado, puntuación, número de línea… y ahora el identificador. **Un nombre
de variable no es un hecho: es una costumbre.**

## El hecho, que es lo que se vigila ahora

Lo que filtró una credencial de producción en SCRUM-196 no fue cómo se llamaba nada: fue que
**`new URL()` lanza un error que lleva la cadena entera en `e.input`**, y ese objeto acabó volcado
por el manejador de excepciones no capturadas. La pregunta correcta es *«¿puede alguien llegar a ese
error?»*, y la responde el `try/catch`:

| forma | veredicto |
|---|---|
| `catch {` sin binding | **inalcanzable** — seguro por construcción, hoy y el día que alguien meta un `console.log` |
| `catch (e)` | alcanzable; el primer `console.error(e)` lo publica |
| sin `try` | sube al manejador global, **que vuelca el objeto**. Es lo que pasó |

Se mira **todo** `new URL` de `scripts/`, no solo los que parecen de BD: aquí una URL de petición
también lleva secretos — los `portalToken` viajan en la ruta.

## El censo, con AST y no con grep

La medición previa (regex) contaba **10**. De verdad son **7**: tres de la diferencia estaban en
`_db-guard.mjs` y **una era la línea de un comentario que explica el problema** — la trampa de
autorreferencia de SCRUM-203, esta vez inflando mi propio censo. Corregido antes de usarlo.

| sitio | protección | veredicto |
|---|---|---|
| `_db-guard.mjs:29 / :62 / :101` | catch ciego | exento — es donde vive `parseBDSegura` |
| `backfill-quote-jobid.mjs:46` | catch ciego | parseaba a mano → **convertido** |
| `conciliar-auditoria-fiscal.mjs:100` | catch ciego | parseaba a mano → **convertido** |
| `preflight-schema-drift.mjs:89` | catch ciego | parseaba a mano → **convertido** |
| `guard-contraste.mjs:194` | **sin try** | **violación** → arreglada |

Los tres de BD **no filtraban hoy**: su `catch` era ciego. Pero esa seguridad dependía de que ese
catch siguiera siendo correcto para siempre, en ficheros que edita cualquiera — y esa apuesta ya se
perdió una vez, con una credencial de producción por medio. `guard-contraste` sí era violación:
`new URL(req.url)` sin `try` en un servidor.

**La exención se DERIVA de exportar `parseBDSegura`**, no de un nombre: si el parseo seguro se muda,
la exención se muda con él. Y hay un test aparte de que sus `catch` siguen siendo ciegos — sin eso,
la exención es el agujero.

## El `.gitignore`: la trampa con la víctima más silenciosa

La cabecera de `scrum195` manda poner los desechables de BD en `scripts/tmp-*.mjs` —en `scripts/`,
no en el scratchpad, **para que el censo los vea**— y prometía que ya estaban ignorados por git.
**No lo estaban:** solo existía `tmp/`, que es un directorio.

Quien seguía la convención documentada al pie de la letra **commiteaba su script de base de datos
desechable**, y precisamente la promesa hacía que no lo comprobara. Añadido el patrón, y el guard lo
sostiene **preguntándole a git** (`git check-ignore`), no leyendo el `.gitignore`: que un fichero
diga un patrón y que git lo aplique son dos hechos distintos.

## Rojos, por `$?`

- **El decisivo:** `new URL(u)` con `catch (e)` y nombre inocente → **guard viejo VERDE, guard nuevo
  ROJO** nombrando `scripts/preflight-schema-drift.mjs:181 · catch-con-binding`.
- Quitar `scripts/tmp-*` del `.gitignore` → rojo.
- Patrón demasiado ancho (`scripts/*`) → rojo por el suelo.
- `catch` del parseo seguro con binding → rojo.

## Un fallo mío que cazó el rojo que NO salió

El suelo del `.gitignore` preguntaba por `scripts/backup-dump.mjs`, y **`git check-ignore` omite los
ficheros seguidos por git**: responde «no ignorado» aunque el patrón case (verificado: con
`scripts/*` puesto da status 1, y con `--no-index` da 0). O sea que el suelo **pasaba siempre**.
Corregido con una ruta no seguida, que es la única que responde a los patrones.

## Y una regla de higiene

El test por nombre de `scrum195` pasa a **delegar en la misma derivación** en vez de quedarse al
lado: dos reglas sobre lo mismo, donde la floja da verde, es peor que una — la floja tranquiliza.

Ficheros: `tests/_censo-new-url.mjs` (nuevo) · `tests/scrum414-url-a-mano.test.mjs` (nuevo) ·
`tests/scrum195-url-bd-sin-fuga.test.mjs` · `.gitignore` · `scripts/backfill-quote-jobid.mjs` ·
`scripts/conciliar-auditoria-fiscal.mjs` · `scripts/preflight-schema-drift.mjs` ·
`scripts/guard-contraste.mjs`.
