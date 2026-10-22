# SCRUM-1575 · El preview de migraciones pasa por el guard de destino antes de conectar

**Medido contra:** `origin/main` = `63ad68347c0c6df7f22bcc5900f0eb8fa369b8e7` · 2026-10-22T09:54:41Z (hora de GitHub, cabecera `Date:`)
A9: comprobación → `tests/scrum1575-preview-por-destino.test.mjs`

22-oct-2026 · **J5** (sesión `jv-j5r`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-5f`).
[Escrito por la sesión, no por Javier. Leído en Jira: SCRUM-1575 entero, descripción y 0 comentarios.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD» (SCRUM-1498); se siguió, como manda la ficha
del día. Etiquetas: `area-j5`, `equipo-javier`, `calidad`, `instrumentos`. Los dos ficheros tocados salen
sin cerradura (fila general `scripts/**`, según el ticket); el test y este registro son nuevos.

## PASO 0

- `git log origin/main --grep=1575` → solo aciertos del PR #1575 (SCRUM-985/236), otra cosa.
  `ls-remote 'refs/heads/scrum-1575*'` → 0. `docs/master/SCRUM-1575.md` → no existía.
- `scripts/preview-migracion.mjs` en `8ad167195` y en `f02e48be2`: 10.355 B, sin `_clave-vs-destino`.
  Lo encontró jv-j5n (SCRUM-1569 c.20212) y lo confirmó jv-j4k.

## 🔴 El diseño del ticket estaba mal, y el del orquestador también

El ticket (y el encargo) pedían `exigirDestinoCorrecto('DATABASE_URL', …)` **más**
`comprobarCredencialDeProduccion`. Antes de construirlo pasé las dos funciones puras con URLs fabricadas,
sin conectar a nada, sobre la clave `DATABASE_URL`:

| URL fabricada (host/base)            | `comprobarClaveVsDestino` (383) | `comprobarCredencialDeProduccion` (418) |
|--------------------------------------|---------------------------------|-----------------------------------------|
| `autorack.proxy.rlwy.net/railway`    | `cuadra`                        | `produccion_en_arbol`                   |
| `acela.proxy.rlwy.net/yaqu_dev_javier` | `no_cuadra`                   | `cuadra`                                |
| `acela.proxy.rlwy.net/railway`       | `no_cuadra`                     | `cuadra`                                |
| `127.0.0.1/nada`                     | `no_cuadra`                     | `destino_no_reconocido`                 |

Por qué: en `DESTINOS_ESPERADOS`, `DATABASE_URL` **promete PRODUCCIÓN**, así que la de 383 solo aprueba
producción y la de 418 solo la rechaza. Si se ponen las dos, el preview **se niega siempre**, también contra
dev, y eso contradice el propio criterio de aceptación («una de dev → sigue»). `aplicar-sql-dev.mjs` sí
puede usar la de 383 porque su clave es `DATABASE_URL_DEV`, que promete una base que no es producción.

Se lo mandé al orquestador antes de escribir código, y lo aprobó por mensaje: solo la de 418, sobre la
MISMA url que recibe el hijo.

## Lo que cambia

`scripts/preview-migracion.mjs`:
- `urlDelHijo(env)`: una sola función para la URL que comprueba el guard y la que recibe el hijo de Prisma
  (`ejecutorLocal`). Así no pueden ser dos URLs distintas.
- `destinoDelPreview({ desde, env, worktree })`: con `--desde` → `offline`, no se pide URL. Sin `--desde`
  y sin `DATABASE_URL` → `sin_url`, se niega. Con URL → `comprobarCredencialDeProduccion('DATABASE_URL', …)`,
  y todo lo que no sea `cuadra` se niega con el motivo del guard (producción, destino sin declarar o URL
  ilegible).
- En el arranque, **lo primero, antes de lanzar Prisma**: si `destino.ok` es falso → `stderr` + salida 1.

Con esto vuelve a ser verdad la frase de `CLAUDE.md` («desde SCRUM-418 el guard lo hace cumplir por
DESTINO») para el preview, que es justo el guard de 418. La frase no se ha tocado: es de un jefe.

## Rojo, verde y mutaciones (local, `node --test` del fichero; ningún caso conecta con nada)

- **Rojo:** con el script de `origin/main` (10.355 B) el test cae al importar (`does not provide an export
  named 'URL_QUE_NO_LLEVA_A_NADA'`). Es un rojo débil, porque cae antes de los casos. El que demuestra que
  la llamada está montada es la mutación A.
- **Verde:** 5 tests, 5 pass, 0 fail.
- **Mutación A** (anular la negativa del arranque, con la función intacta): 4 pass + 1 fail = 5. Cae el test
  del proceso hijo.
- **Mutación B** (`destinoDelPreview` deja de negarse ante la credencial): 3 pass + 2 fail = 5.
- Después de cada mutación el árbol vuelve exacto al commit (`git diff HEAD` = 0 B).
- Vecinos (`scrum1575`, `scrum385`, `scrum418`, `scrum383`, `scrum1526`, `scrum237`, `scrum976`): 68 tests,
  65 pass, 3 fail. Los 3 son de `scrum385` y caen porque **este árbol no tiene `node_modules`** («no hay CLI
  de Prisma en node_modules»), no por el cambio. En CI se corren con el CLI.

## Lo que NO se ha medido

- El proceso hijo, en local, se negó antes de lanzar Prisma. Bajo la mutación A cayó porque falta el CLI;
  **en CI, con el CLI, intentaría conectar al loopback `127.0.0.1:1`**, y eso no lo he visto aquí. La URL de
  producción fabricada NO se pasa nunca al hijo, a propósito: sin el guard intentaría conectar con ella.
- `--desde` ejecutado de verdad, con el CLI: no aquí (sin `node_modules`). Lo cubre `scrum385` en CI; mi
  test lo cubre en la función pura.
- No se ha barrido qué otros scripts conectan con `DATABASE_URL` sin pasar por el guard: el encargo era
  el preview.
- El obligatorio de esta rama: se lee después del empujón y va en la entrega y en Jira, no aquí.
- Visto en yaqu.app: NO HECHO → no hay pantalla; es un script de desarrollo.

## Errores propios

- La ficha pide medir el contexto dos veces, al acabar el arranque y al acabar Jira. Leí Jira lo primero,
  así que solo hay un punto: **119.751** al terminar las dos.
- Para traer el script viejo y ver el rojo, choqué tres veces con `guard-dangerous` (un `>` que truncaba,
  y dos `git checkout --` con cambios sin commitear, uno de ellos encadenado al commit en el mismo comando).
  La vía limpia fue un commit de trabajo local y un `git stash push -m` con etiqueta, soltado por su sha.
  No usé `.claude/allow-destructivo`.
