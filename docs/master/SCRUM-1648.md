# SCRUM-1648 · guard-dangerous falla hacia ABIERTO con las barras invertidas de PowerShell, con un `>` absoluto lanzado desde otro repo y con las rutas MSYS en la regla de junction

**Medido contra:** `origin/main` = `70eefc40cba2eb9636992b733223bf1555c1755f` · 2026-11-02T20:30Z (cabecera `Date:` de GitHub)
A9: sin fallo que generalice — tramo de sólo medida y documentos; los huecos medidos son del guard, y su comprobación va con el arreglo que decida el jefe (`decision-jefe`)

Puesto: S5 (equipo de Luis). **Sólo medida, sin arreglo:** `.claude/hooks/**` es «SIN CERRADURA · un jefe»
(`node scripts/carriles.mjs de .claude/hooks/guard-dangerous.mjs` → `dos-equipos.md:205`). El ticket lo abre S5
por orden de su orquestador, con `decision-jefe` y sin `area-*`. Esta rama sólo lleva documentos: el banco, para
que nadie tenga que repetir la medida.

## El banco: `docs/master/evidencias/scrum1648/`

| fichero | qué es |
|---|---|
| `mide.mjs` | 71 casos: PowerShell y Bash × 5 formas de ruta × 7 familias, más `Remove-Item -Recurse`. Importa `evaluar` del guard de la raíz que se le pase y lo corre contra un banco nuevo (un repo sucio, uno limpio y una carpeta con una junction real hecha con `mklink /J`). El guard sólo PREGUNTA: el guion comprueba que el banco queda intacto. |
| `control-base.mjs` | Separa «las barras» de «desde dónde arranca»: el mismo `>` absoluto con barra normal, lanzado desde el mismo repo, desde otro repo y desde un no-repo. |
| `salida-main.txt` | Corrida contra el guard de `origin/main` (`70eefc40c`): **48 bien · 23 MAL**. |
| `salida-compartido.txt` | Corrida contra el guard del checkout compartido (`e4ea95e5a`): **44 bien · 27 MAL**. Los 4 de más son `cd /d/…`, que arregló SCRUM-1091. |

Uso: `node docs/master/evidencias/scrum1648/mide.mjs <raíz con el guard> <directorio NUEVO para el banco>`.
El guion no borra nada, porque el banco lleva una junction. La limpieza a mano viene en su cabecera.

Resultado de `control-base.mjs` el 2-nov: mismo repo → **BLOQUEA** · otro repo → **deja** · no-repo → **deja**.

## Lo que sale MAL, agrupado

1. **`\` sin comillas en PowerShell.** El tokenizador la trata como escape POSIX (`guard-dangerous.mjs:186`), y
   `cd D:\a\b` queda como `D:ab`. Deja pasar `> rastreado.txt` tras el `cd`, `> X:\…\rastreado.txt`,
   `git worktree remove X:\…` con una junction dentro y `rm -r X:\…`. Además bloquea el `git switch -c` legítimo
   en un árbol limpio. En Bash la `\` sin comillas la lee igual el propio bash: no es defecto del guard.
2. **`>` absoluto desde OTRO repo.** `check-ignore` corre con el cwd de la sesión (`:476`); git da 128 y el guard
   lo trata como fuera de jurisdicción. Falla con cualquier forma de ruta, también con barra normal.
3. **MSYS en la regla 7.** El filtro `!t.startsWith('/')` (`:621`) descarta `/d/…` y no mira la junction.
4. **`Remove-Item -Recurse`** no entra en la regla 7.
5. **`Set-Location X` no cuenta como `cd`** (`cwdDelComando`, `:457`: sólo mira `programa === 'cd'`). Visto EN VIVO
   al abrir esta rama, no en el banco: `Set-Location D:/…/wt-s5-2nov-medir; git switch -c …` se bloqueó listando
   los cambios del checkout compartido (`M LICENSE`, `M package.json`…), no los del worktree, que estaba limpio
   (`git status --porcelain` → 0 líneas). Aquí falla CERRADO, pero sobre el árbol equivocado: por la misma vía, un
   `Set-Location X; git reset --hard` miraría el árbol de la sesión y no el de X. **No está en los 71: se añade
   al banco cuando se construya el arreglo.**

## Lo que sigue bloqueado (ver `salida-main.txt`)

Con barra normal, entre comillas o con MSYS y `cd`, en las dos herramientas: `switch -c` en sucio,
`reset --hard` en sucio, `>` relativo tras el `cd`. Y `worktree remove`/`rm -r` con junction, con barra normal o
con comillas.

## Lo que NO he hecho

No he tocado el guard ni ningún test. No he medido `Set-Location` dentro del banco (punto 5, visto una vez en
vivo). La tanda completa no la he corrido: esta rama sólo añade `docs/`.

## SCRUM-1648b · las cinco curas, con el banco a 0 MAL de 72
**Medido contra:** `origin/main` = `ba521b73339f1e56972c301a372101c8422f5120` · 2026-11-27T12:38Z (cabecera `Date:` de GitHub)
Versión: 1.2 (SCRUM-1836)
A9: comprobación → `docs/master/evidencias/scrum1648/mide.mjs`
Mutaciones: catálogo → `tests/scrum1648b-guard-dangerous-powershell-y-cwd.test.mjs`

Puesto: J6 (sesión jv-j6gj). Lo asigna Javier en SCRUM-1648 c.22932; `.claude/hooks/**` sigue «SIN CERRADURA · un jefe».

**El banco, antes y después** (`mide.mjs`, en un directorio desechable del TEMP, forma corta 8.3):

| guard | casos | MAL |
|---|---|---|
| `origin/main` del 2-nov (`salida-main.txt`, S5) | 71 | 23 |
| el de hoy antes de tocar (ya con SCRUM-1792 y 1831) | 71 | 19 |
| con las cinco curas (`salida-1648b.txt`) | 72 | 0 |

`compara.mjs salida-main.txt salida-1648b.txt`: los 42 casos que bloqueaban siguen bloqueando, **0 aflojados**, 1
destrabado (el `switch -c` legítimo de PowerShell con `\` sin comillas) y 1 caso nuevo, el 72 (`Set-Location`).
`control-base.mjs`: mismo repo, otro repo y no-repo → BLOQUEA los tres (antes: sólo el primero).

**Corrección declarada al instrumento de la S5** (decisión del orquestador J, 27-nov): en las cinco filas de Bash
con `D:\…` sin comillas el banco esperaba lo mismo que en PowerShell, y la descripción del ticket dice que ahí la
`\` «no es un defecto del guard». Con el banco sin tocar salían 5 MAL de 72, exactamente esas cinco. Su «debe»
pasa a ser el de la lectura de bash (`D:ab` no existe): cuatro «deja» y un BLOQUEA (el `cd` a una carpeta que no
existe no deja comprobar el árbol). Cada fila lo dice en su columna de motivo. La S5 puede discutirlo en el ticket.

**Las curas** (`.claude/hooks/guard-dangerous.mjs`, cada una con su comentario `SCRUM-1648b`):

1. `\` literal cuando `tool_name` es `PowerShell`; en Bash sigue siendo escape.
2. `check-ignore` se pregunta desde la carpeta del fichero Y desde la de la sesión: basta que una diga «existe y no
   se ignora». El `status` de la regla 6 pregunta cada ruta absoluta en su repo; `git clean` con ruta absoluta
   pregunta además allí. La forma MSYS de un `>` se traduce antes de mirar el disco.
3. MSYS en la regla 7: ya lo curó SCRUM-1792; aquí sólo se ata (el caso (f) pasaba con el guard de hoy).
4. `Remove-Item -Recurse` y sus alias (`ri`, `del`, `erase`, `rd`, `rmdir`) entran en la regla 7.
5. `Set-Location`, `sl` y `chdir` cuentan como `cd`, también con `-Path`.

**Lo que se destraba además del `switch -c`**, fuera del banco: `git checkout -- <ruta absoluta de OTRO repo>`
antes se bloqueaba siempre («no se pudo comprobar») y ahora se pregunta en ese repo: para si está sucio, deja si
está limpio. Es la cura 2 tal como la pide el ticket; lo ata el caso «regla 6 con ruta absoluta» del test.

**Rojo primero:** el test nuevo, 19 casos, contra el guard de `origin/main`: caen 16 y pasan 3 (el banco, el
control de Bash y la familia MSYS). Con el arreglo, 19 de 19. Las cuatro mutaciones del catálogo tumban el caso
que nombran (base 19/19; caen 10, 4, 2 y 4), medidas con una sonda propia de una pasada, no con `aplicarUna`.

**Verdes con población:** el test nuevo con scrum1091, 1792, 1831, 454, 176, 237, 976, 419, 824 y 854 →
159 casos, 0 fallos tras un arreglo (scrum824 cayó a la primera: las carpetas del banco se creaban en un bucle
que su censo no sigue); con 700, 836d y 267 → 54 de 54.

**Mis errores:** corrí el banco bajo una ruta con espacios y dio 35 MAL de 71, que no era el guard: sin comillas,
esa ruta son varias palabras. `mide.mjs` ahora PARA (salida 3) si la ruta lleva espacios. Parcheé el test con un
guion pasado por heredoc y se comió las barras invertidas (lo cazó `node --check`). Y crucé 175k y 200k de
contexto sin nada empujado.

**Lo NO medido:** la tanda entera en local (no cabía en contexto; la mide el CI). El hook por stdin: el test
llama a `evaluar()` con los sentinels falsos, porque por el CLI un caso que bloquea gastaría un
`.claude/allow-destructivo` de verdad. La versión del hook que corre en el checkout compartido, que no es de esta
rama. PowerShell con acento grave como escape. Una cita por número de línea se mueve:
`tests/scrum774-arbol-de-otra-sesion.test.mjs:16` nombra `guard-dangerous.mjs:479`, en un comentario.

### CI del primer empujón (bb0ed7930): rojo de scrum702 y de los casos (a) y (d) en Linux, arreglado en el test
**Medido contra:** `origin/main` = `36ac74f2d15fdbeb918bf90873815cfc4c02629f` · 2026-11-27T13:11Z (cabecera `Date:` de GitHub) · relevo jv-j6gn
A9: comprobación → `docs/master/evidencias/scrum1648/host-linux.mjs`

El run 46000711974 (PR #3495) dio 3 rojos de 14.784, los tres de este test en `ubuntu-latest` (SCRUM-1648 c.22949).

**Causa, medida:** en bash `Z:\x\arbol` es `Z:xarbol`, una ruta relativa a la UNIDAD Z:. `path.win32.resolve('Q:/base',
'Z:xarbol')` la completa con la carpeta actual de Z: (`process.env['=Z:']` o `process.cwd()`). En Windows ese cwd es de
otra unidad y node lo descarta (`Z:\xarbol`); en Linux empieza por `/` y lo usa entero
(`Z:\home\runner\work\…\xarbol`). Los casos (a) control y (d) fijaban el valor de Windows. El hook no cambia: en uso
real corre en win32, y ahí ésa es la semántica de Windows.

**Reproducido en Windows, sin Linux:** `docs/master/evidencias/scrum1648/host-linux.mjs` es una precarga que pone el
cwd del runner. Con el test de `bb0ed7930`, el grupo determinista da 2 de 8 en rojo con los mismos valores que el CI;
con el arreglo, 8 de 8. La precarga imprime lo que resuelve: es su control positivo. Simulando además
`process.platform = 'linux'`, los 5 casos del grupo ③ salen saltados, cada uno con su motivo literal.

**Qué cambió en el test:** (a) control asevera la palabra que deja el shell (`Z:xarbol`, fija), que la consulta es una
`Z:\…\xarbol` y que ninguna consulta es la ruta que lee PowerShell; (d) en Bash asevera que no es `Z:\x\repo`, que es
de Z: y que acaba en `xrepo`. Ningún caso cambia de nombre, así que las 4 `cae:` del catálogo siguen valiendo. El hook
no se ha tocado: `git hash-object .claude/hooks/guard-dangerous.mjs` = `77d2e6c6b7c05a3885632b9654d86be0ae4d5158`
antes y después.

**scrum702, tope 24 → 25** en el mismo commit y con su línea: el test lee `process.platform` sólo para saltar sus 5
casos de extremo a extremo (junction, letra de unidad y PowerShell sólo existen en win32). Lo ordena el orquestador J
en c.22949. El 1792b tuvo firma del fundador (c.22646); éste no la tiene.

**Mutaciones con `aplicarUna`:** `docs/master/evidencias/SCRUM-1123f/arnes-mutaciones.mjs`, que usa las mismas
funciones que el bucle de `scripts/meta-guard-mutaciones.mjs`. Base: 19 pasan · 0 caen. **4 de 4 VIVAS.** Después, el
hook con la misma huella y el árbol limpio.

**Verdes con población (Windows):** test + 702, 29 de 29. Los guards del encargo (1648b, 1091, 1792, 1831, 702, 1294,
267, 854, 237, 976, 700, 824 y 419): 118 de 118, 0 saltados. 836: 17 de 17 con `dist/` compilado (`tsc --noCheck`);
sin `dist/` daba 1 rojo por anclas de `dist/…/pdf.service.js`, que no son de esta rama. `npm run guards:entrada`: 17 guards, 186 tests, verde; y los 5 de árbol entero que nombra (SCRUM-1560): 38 de 38.

**Lo NO medido:** la tanda entera en local (con 157k de contexto no cabía antes del tope de 175k para empujar: la mide
el CI); el obligatorio de este empujón, al escribir esto; Linux de verdad (la precarga simula el cwd, no el sistema).
