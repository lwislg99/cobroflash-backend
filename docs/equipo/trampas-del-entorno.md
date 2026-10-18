# Trampas del entorno — Windows, Git Bash, PowerShell 5.1, gh y git

18-sep-2026 · SCRUM-951b · escrito por la Sesión 0 sobre `origin/main` = `972b51b384e0b21e0265787392eb5c865b98cc4a`

> **Dueña: la Sesión 0.** Vale para los DOS equipos, porque usan la misma máquina tipo (`dos-equipos.md`).
> Hasta hoy todo esto vivía solo en la memoria de UNA máquina, repartido en siete notas: el otro equipo no
> lo tenía. Quien encuentre una trampa nueva la reporta a la S0 (el equipo de Javier, por Jira).

**Lo que tienen en común todas:** no dan error. **Dan un resultado falso que parece bueno**: un cero, un
verde, un «no hay cambios», una hora. Por eso cada una lleva **cómo se comprueba**, y la regla general es la
de A3: antes de creerse un vacío, **el mismo comando buscando algo que SÍ existe** (control positivo).

⚠️ Lo que depende de la máquina (la versión de Git, el `autocrlf`, el desfase del reloj) **se mide en cada
máquina**: que en la de Luis fuera así no dice nada de la de Javier.

## 1 · Git Bash (MSYS)

| síntoma | causa | qué hacer | cómo se comprueba |
|---|---|---|---|
| `git grep -E "/privacidad"` da **0** y el texto existe | MSYS convierte todo argumento que empieza por `/` en una ruta de Windows | `export MSYS_NO_PATHCONV=1`, o anclar con `[/]privacidad` | el mismo comando con algo que sabes que está |
| con `MSYS_NO_PATHCONV=1`, `git commit -F /tmp/msg.txt` falla («could not read log file»), y si iba encadenado, **el push siguiente empuja el commit anterior** | git ya no traduce rutas POSIX | ruta de Windows completa para `-F`; y nunca encadenar un push | tras cada push, `git rev-parse HEAD` = lo que dice `git ls-remote` |
| contar retornos de carro (CR) con `grep -c` cuenta **todas** las líneas aunque no haya ni un CR (medido el 15-sep: 364 «CR» en 364 líneas; node contando bytes, 0) | MSYS se come el CR del patrón y queda un patrón vacío, que casa con todo | contar bytes con node: `contarCR` de `scripts/censo-cuenta-de-control-con-grep.mjs`, que ya existe (no se escribe otra). Lo vigila `tests/scrum766-el-grep-que-cuenta-lineas.test.mjs`, que pone en rojo cualquier receta del árbol que cuente control con `grep` | un fichero fabricado con un CR tiene que dar 1, y uno limpio 0 |
| un heredoc que pasa JS a `node -` llega con `\\` convertido en `\` (también con `<<'EOF'`, y también a un fichero) | MSYS | editar con la herramienta de edición, no con heredoc; o `String.fromCharCode(92)` | el script imprime el regex que va a usar |
| `grep -E '…[^\n]*…'` da **0** sobre líneas que existen | dentro de un corchete de `grep` no hay escapes: `[^\n]` es «ni barra ni n» | usar `.*` | su control positivo también daba 0: por eso hace falta |
| `"$TMPDIR/x.mjs"` escribe en la carpeta de instalación de Git, sin error | `$TMPDIR` está vacío en ese Git Bash | ruta completa del directorio temporal del trabajo | `ls` del fichero donde crees que está |
| `git -C repo worktree add ../wt-N` crea el worktree DENTRO del repo | la ruta relativa se resuelve desde el repo, no desde tu carpeta | ruta ABSOLUTA, y `git worktree list` después; si ya pasó, `git worktree move` | `git worktree list` |
| `gh api -i /zen` falla («invalid API endpoint») y, si tiras el error, da una cabecera vacía | MSYS convierte `/zen` en una ruta | `gh api -i zen`, sin barra | la cabecera `Date:` sale con fecha |

## 2 · PowerShell 5.1

| síntoma | causa | qué hacer |
|---|---|---|
| un comando con `Remove-Item Env:FORCE_COLOR` y, en la misma línea, `/c` o `'\]\('` lo **bloquea el hook** («Remove-Item on system path») | el hook lee esos trozos como una ruta del sistema | `[Environment]::SetEnvironmentVariable('FORCE_COLOR', $null)`, o el regex en un `.mjs` |
| `$m` y `$M` pisan el mismo valor | PowerShell no distingue mayúsculas en las variables | nombres distintos de verdad |
| `[IO.File]::ReadAllText('ruta/relativa')` lee OTRO fichero, y 🔴 `[IO.File]::WriteAllText('ruta/relativa')` **ESCRIBE en otro árbol**: tras un `cd` al worktree, la ruta cae en el checkout compartido desde el que se lanzó la sesión (14-oct-2026: un mutante de prueba cayó allí, y el test del worktree salió verde porque no lo veía) | las APIs de .NET resuelven contra el directorio del PROCESO, no el de PowerShell | rutas ABSOLUTAS (`Resolve-Path`), y después de mutar, `git status` del árbol que se quería tocar Y del compartido |
| 🔴 `[IO.File]::ReadAllBytes('ruta/relativa')` tras un `cd` **lanza**, el array queda vacío y `(@() \| Where-Object {…}).Count` da **0**, que se lee igual que «fichero limpio» (medido el 20-sep-2026 barriendo BOMs) | la misma causa, con peor cara: aquí el error no acaba en un fichero equivocado sino en un recuento vacío | ruta ABSOLUTA y, **al lado de cada recuento, la POBLACIÓN** (`$b.Length`): un 0 sobre 0 bytes no es un hallazgo, es un instrumento que no arrancó |
| `… \| Select-Object -First N` y node no escribe nada | la tubería corta a node antes de que escriba | redirigir a un fichero y leerlo en OTRO comando |
| `>` o `Out-File` escribe UTF-16 o con BOM | valores por defecto de 5.1 | `-Encoding utf8`; y para un mensaje de commit sin BOM: `[IO.File]::WriteAllText($ruta, $texto, (New-Object Text.UTF8Encoding $false))` |
| `ConvertFrom-Json` de un array de un elemento devuelve un objeto | 5.1 desenvuelve arrays | volcar el JSON a fichero y leerlo con node |
| `node -e "…"` con comillas anidadas revienta | el escapado de 5.1 | escribir el script a un `.mjs` |
| 🔴 un `$` dentro de comillas dobles **no llega a node**: PowerShell lo expande antes, y una medición hecha con `node -e "…$…"` sale distinta —y peor— de lo que es, **sin error** | las comillas dobles de 5.1 interpolan `$nombre` y `$(…)` | el script **desde fichero** (`.mjs`), o comillas simples; y comprobar que el texto que llega es el que escribiste |
| `2>&1` sobre un programa nativo pone `$?` en falso aunque saliera 0 | 5.1 envuelve cada línea de error | no redirigir stderr de programas nativos |
| `FORCE_COLOR` vuelve en cada comando | el entorno de la herramienta no persiste entre comandos | borrarlo al principio de CADA comando (A6) |
| 🔴 **una rama empujada VACÍA, que deja un PR fantasma con pinta de trabajo.** `git commit -q -F - @'…'@; git push -u origin HEAD:<rama>`: el commit falla con «error: pathspec '<el mensaje entero>' did not match any file(s) known to git» y no crea nada. El push sale igual, sube la rama apuntando al commit de `main` y dice «* [new branch]» como si todo fuera bien. `pr-automatico.yml` arranca con un PR sin diff (S1, 16-oct-2026 ~12:20Z, `scrum-1558-sin-proveedor-no-es-envio`: el primer push fue `665bcd17`, que era `main`; el bueno, `d7698912`) | en 5.1 un here-string escrito detrás de `-F -` NO entra por stdin: git lo recibe como un argumento más, un pathspec. Y `;` no para en el error | el mensaje a un fichero (con la herramienta de escritura, fuera del árbol: en el tmp del trabajo) y `git commit -F <fichero>`. El push en su PROPIO comando (A4), o al menos `git commit …; if ($?) { git push … }`. **Control:** `git rev-parse HEAD` = `git ls-remote origin refs/heads/<rama>`, y esa punta NO es la de `origin/main`. Reproducido por la S0 el mismo día en un repo desechable: exit 1, el HEAD no se mueve y el fichero se queda en el índice |

## 3 · cmd (`.cmd` de bancos y tareas)

- **`npm` es `npm.cmd`**: sin `call` delante, transfiere el control y el script **muere ahí con exit 0**.
- **ASCII puro.** Un comentario `rem` con acentos corrompió un `.cmd` entero: cmd lee por posición y se comía
  dos caracteres de cada línea. También salió 0. Comprobación: contar bytes > 127 del `.cmd` (tiene que dar 0).
- `set "FORCE_COLOR="` BORRA la variable (no la deja vacía).
- Para el código de salida real: `cmd /v:on /c "… & echo EXIT=!ERRORLEVEL!"`.

## 4 · FORCE_COLOR

El entorno desde el que se lanzan las sesiones trae `FORCE_COLOR` puesto (a `3`) y **lo heredan los hijos**.
Envenenó tres instrumentos (SCRUM-928): daban rojo sobre un árbol sano. Medido: node **no distingue `0` de
ausente**. Se borra en cada comando (A6) y se escribe en la primera línea de cada log si estaba ausente.

## 5 · gh (GitHub CLI)

- **No siempre está en el PATH.** En la máquina de Luis vive en `C:\Program Files\GitHub CLI\gh.exe`. «No está
  en el PATH» no es «no está» (A3): se busca por la ruta completa antes de decir que no hay.
- **`gh api` en un 404 sale con 1 pero escribe el JSON del error por stdout.** `V="$(gh api … || echo X)"`
  se queda con el error Y el respaldo, y una rama borrada parece tener «otra cabeza». → `if ! V="$(gh api …)";
  then V=null; fi`, o para saber si existe una rama: `git ls-remote --exit-code origin refs/heads/X`
  (0 existe · 2 no existe · otro = no se sabe).
- **`gh pr list` tiene tope.** Con `--limit 400` sobre un repo de 1.300 PR se pierden los abiertos VIEJOS y la
  cuenta sale corta sin avisar. → `--limit 2000` y comprobar el número mínimo y máximo de PR traídos.
- **`gh pr diff --name-only` puede enseñar el diff VIEJO** un rato después de que entre la PR de debajo de una
  apilada (14-oct-2026, #2467: 7 ficheros, cuando el diff de verdad tenía 5). → `gh api
  repos/<dueño>/<repo>/compare/main...<rama>` (`ahead_by` y `files`), o `git diff --name-only origin/main...HEAD`.
- **`gh run view --log` no da el log de un job mientras el run sigue vivo.** → `gh api
  --allow-escape-sequences repos/<dueño>/<repo>/actions/jobs/<id>/logs`.
- **Una lista de PR ABIERTOS vacía no distingue «nunca se abrió» de «se abrió y ya entró».** → `--state all`.
- 🔴 **`BLOCKED` no es «atascado».** `mergeStateStatus` escribe la MISMA palabra para tres situaciones
  distintas, y sólo una de ellas pide hacer algo (SCRUM-951f). A S2 le costó dos días no saberlo. Lo
  que las separa es la conclusión del check obligatorio, `build + tests (con banco desechable)`, sobre
  la punta del PR:

  | conclusión del obligatorio | qué es | qué se hace |
  |---|---|---|
  | **vacía** (`QUEUED` o `IN_PROGRESS`), con `mergeable=MERGEABLE` | ① **no ha terminado**. No hay nada atascado: así estaban #2500, #2510 y #2511 a las 11:31Z del 16-oct-2026 (medido por el orquestador), y #2506, #2508, #2511, #2512 y #2513 a las 11:50Z (medido por la S0) | nada. No se relanza ni se empuja |
  | **`FAILURE`** | ② **falló**. Esto sí bloquea | se lee el log y se clasifica antes de culpar al diff. #2505 a las 11:32Z del 16-oct: 1 fallo de 11.634, `1405c ④` con heap OOM, y el diff eran dos `.md`. Se relanza el job cuando GitHub deja: con el run vivo contesta «already running» |
  | **`SUCCESS`** y sigue `BLOCKED` | ③ **el caso raro**: #2449 el 15-oct-2026 a las 15:35Z (medido por el orquestador). **SIGUE SIN EXPLICAR** | se busca la causa con `merge-tree` (abajo), sin dar ninguna por buena antes |

  ⚠️ El vigía tiene la misma confusión. `causaDelAtasco` (`scripts/vigia-atascados.mjs`, carril S5)
  devuelve `ESPERANDO`, «esperando a que pase el check obligatorio», para todo `BLOCKED` sin rojo, y
  eso incluye el caso ③.

  **`mergeStateStatus` no dice POR QUÉ; `git merge-tree` sí.** `git merge-tree --write-tree --name-only
  origin/main <punta del PR>` (git ≥ 2.38; en la máquina de Luis, 2.51) sale con **0** si el merge es
  limpio, y entonces imprime sólo el árbol. Sale con **1** si hay conflicto, y entonces nombra cada
  fichero. Medido el 16-oct-2026: un conflicto fabricado da 1 y nombra `a.txt`; #2512 da 0.

  🔴 **Y la trampa no es sólo de la palabra.** El orquestador cerró el caso ③ con una causa que sólo
  explicaba un suceso POSTERIOR: un conflicto con la rama hermana #2498, que la noche anterior aún no
  estaba en `main`. S2 le contestó «eso no lo explica», y tenía razón. Una causa que encaja con lo
  último que viste no está cerrada hasta que explica también lo primero.
- **Un push hecho con el token de un bot no dispara los checks**, y el auto-merge espera para siempre: se
  empuja con cuenta de persona. Si un PR se queda sin checks, mirar primero las ejecuciones en
  `action_required`.
- **La hora de GitHub**, para A14: cabecera `Date:` de `gh api -i zen`. El reloj de la máquina de Luis iba
  5 min 33 s adelantado el 15-sep; el de otra máquina, a saber: se mide.

## 6 · git

| síntoma | causa | qué hacer |
|---|---|---|
| un control de blobs da verde «por la máquina» | `core.autocrlf=true` está a nivel **system** en la máquina de Luis (en el `gitconfig` de la instalación de Git) | todo `git hash-object` de verificación con `-c core.autocrlf=false`; y en otra máquina, medir con `git config --show-origin core.autocrlf` |
| `git ls-files --eol` cuenta 2 donde hay 11 | un solo CR suelto hace que git clasifique el fichero como binario | leer los blobs (`git cat-file --batch`) y clasificar como texto lo que no tiene ningún NUL (`tests/_censo-eol.mjs`) |
| un fichero «normalizado» vuelve a cambiar en el commit siguiente | `\r\r\n` (doble conversión): el filtro se come un CR por pasada | `.gitattributes` con `text eol=lf` EXPLÍCITO por extensión (SCRUM-480) |
| tras rehacer una rama con `commit-tree` + `update-ref`, `git checkout -- f` deja la versión VIEJA y `M ` en staged | `update-ref` no toca el índice, y `checkout -- f` copia DESDE el índice | `git restore --source=HEAD --staged --worktree -- f`, y comprobar `git hash-object --no-filters f` = `git rev-parse HEAD:f` |
| `origin/main` cambia bajo tus pies en mitad de una medición | los refs son compartidos entre worktrees y otra sesión hace `fetch` | anclar la evidencia al SHA, nunca al nombre de la rama |
| borrar un worktree vacía el `node_modules` de TODAS las sesiones | un junction a un junction: `git worktree remove` recorre la cadena | no encadenar junctions; un junction se quita con `cmd /c rmdir` (solo el enlace), **NUNCA** con `Remove-Item -Recurse`, que borra el destino |
| `git stash pop` saca el trabajo de otra sesión | el almacén de stash es compartido entre worktrees | A15: no se usa `git stash` para apartar trabajo |

## 7 · Windows

- **El Sensor de almacenamiento borra lo de más de 7 días de las carpetas temporales**, también en plena
  sesión y con un servidor encendido (medido el 16-sep: se llevó media instalación portable de Postgres). El
  criterio es la fecha de modificación, y un zip extraído CONSERVA la fecha vieja: el banco recién extraído
  parece viejo. → tras extraer, poner la fecha de modificación de todo a ahora, o el banco fuera de Temp. Antes
  de creerse un rojo del banco, comprobar que sus binarios siguen ahí.
- **Un servidor lanzado desde una tarea en segundo plano muere al terminar la tarea.** → `Start-Process`.
- **Un banco de Postgres compartido entre sesiones se apaga debajo de otra.** Cada auditoría, su propio
  cluster en su directorio temporal y con **su** puerto; al compartido no se le apaga ni se le dejan bases.
  Receta del Postgres portable en `docs/RUNBOOKS.md`.
- **`spawnSync(node --test, …)` con ~800 ficheros no produce salida** (límite de la línea de órdenes) y un
  arnés lo lee como `pass null · fail null`. → lotes de ~120 ficheros, y un proceso sin la línea de resumen
  se declara CIEGO (A3).
- **La suite completa lanzada con la lista de ficheros ya expandida por el shell no corre NADA y dice
  exit 0.** Con ~909 ficheros de test, la línea de órdenes pasa del límite de Windows («nombre de archivo
  demasiado largo»): node no llega a arrancar un solo test, y la tarea en segundo plano termina **con código
  0**. Le pasó a la Sesión 0 y a la Sesión 1 el mismo día (18-sep-2026), y la primera se creyó el 0. → pasarle
  a node el **patrón entre comillas simples**, `'tests/*.test.mjs'`, para que lo expanda node y no el shell
  (así le llega desde `npm test`, porque cmd no expande el patrón). **Cómo se comprueba:** antes de creerse el
  código de salida, el TAP tiene que existir y traer su línea `# tests N`, con N del orden de los tests de la
  última suite buena; sin esa línea no hay suite, hay un instrumento que no arrancó (A21).
- **El reaper de Claude Code puede matar la tanda entera si va en SEGUNDO PLANO y la sesión está quieta**
  («stopped because the system is running low on memory … while the session was idle»). El umbral **no** es
  la memoria libre: en la misma condición, la tanda que murió nunca bajó de 1.704 MB libres y las que
  sobrevivieron bajaron a 1.201 y a 1.263 MB. Cuál es el umbral no se sabe. → correr la tanda en **PRIMER
  PLANO**, con la herramienta de shell y sin `run_in_background`, con un `timeout` de 600.000. En primer plano
  terminaron 2 de 2, en 4,2 y 4,3 min, una de ellas bajando a 744 MB libres. Con n = 2 no es una garantía.
  ⚠️ **Sólo si no hay otras sesiones trabajando:** una tanda en primer plano que aprieta la memoria podría
  hacer que el reaper mate lo que otra sesión tenga en segundo plano. Esto se deduce del mecanismo; **no está
  medido**. ⚠️ Una orden en primer plano tiene un tope de 10 min: si se agota, no hay veredicto. **Cómo se
  comprueba:** la línea `ℹ tests N` con su recuento. Que la tanda termine sin que la maten no quiere decir que
  esté en verde. No sustituye al CI, que sigue siendo el juez obligatorio. Tampoco autoriza a tocar
  `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP`, que es configuración del equipo de Javier. Medido por J6 el
  28-sep-2026 con seis tandas enteras: `docs/master/SCRUM-1244.md` §⑤. Reportado en SCRUM-1254.

## 8 · CI: un «build + tests» que agota el tiempo

El log no dice qué fichero se colgó, pero `node --test` **imprime los resultados por orden de fichero**
aunque corra varios a la vez: un fichero lento retiene la salida de todos los de detrás. Así que:

1. bajar el log del job (`gh run view <run> --job <id> --log`);
2. el **primer fichero, en orden alfabético, sin ningún resultado** es el que no terminó;
3. **medir ese mismo tramo en el log de un `main` en verde** (en el #1302: 8 s en main frente a casi 5 min
   sin una línea). Así se distingue un cuelgue de una suite solo más lenta;
4. mirar los otros «build + tests» de la misma franja antes de culpar al diff propio. Un solo run no se llama
   «intermitente».

## 9 · Lo que ya está escrito en otro sitio (no se repite aquí)

- Escribir `\uXXXX` aterriza como el carácter literal: **A22**.
- `npx prisma` se baja OTRO CLI y su vacío miente: `CLAUDE.md` (Comandos) y `scripts/preview-migracion.mjs`.
- Las sesiones de fondo (`claude --bg`) no salen en la barra de VS Code y `--resume` con flags arranca una
  copia: `orquestador-autonomo.md` §5bis.6.
- La memoria de Claude Code va por CARPETA: `instalacion-orquestador-autonomo.md`.

## 10 · El cliente de Prisma COMPARTIDO va por detrás y `tsc` no lo dice

14-oct-2026 · SCRUM-429b · Sesión 5. Medido ese día: el cliente del árbol principal
(`cobroflash-backend/node_modules/.prisma/client`, generado el 1-oct) no tenía `Quote.seriesYear`,
`Quote.archivedAt` ni `WhatsAppMessage.toPhone`, y `npm run build` daba ~23 errores de tipos que no eran
de nadie. `npm run topologia` lo enseña: casi todos los worktrees cuelgan de ese `node_modules`, por
enlace o resolviendo hacia arriba.

| síntoma | causa | qué hacer | cómo se comprueba |
|---|---|---|---|
| `tsc` se queja de campos que SÍ están en `prisma/schema.prisma` | el cliente generado es de OTRO schema (otra rama, u otra sesión que regeneró) | leer el aviso de `prebuild`, que nombra TODAS las diferencias; o `node scripts/_prisma-client-guard.mjs` | el guard nombra los campos; con un cliente al día dice `✔` |
| «hay que matar `node` para regenerar» | en Windows, `prisma generate` no puede sustituir `query_engine-windows.dll.node` mientras un proceso la tenga cargada | **NO matar todos los `node`**: Claude Code también corre en `node`, y matarlos mata las sesiones. Sólo hace falta parar los procesos que tienen esa DLL cargada | la sonda del paso 2, con su control positivo |

### Cómo se regenera sin romper a nadie (lo coordina el orquestador; nunca una sesión por su cuenta)

Escrito el 14-oct-2026. **Ejecutado por primera vez el 15-oct-2026 por el orquestador, con el equipo parado.**
Lo que pasó (lo de los dos primeros puntos lo midió el orquestador; el tercero lo repitió la Sesión 5 a las
15:3xZ desde `s5-14octb`, en `origin/main` = `73e41ab00`):

- **Su primer control positivo FALLÓ, y el fallo era del control, no de la sonda.** El script de prueba estaba en
  `%TEMP%`, y desde ahí `require("@prisma/client")` no resuelve: el `node` nunca cargó el motor, así que no había
  nada que ver. Con el script **dentro del proyecto** el motor se cargó y la sonda lo vio. Un control positivo mal
  colocado dice «la sonda no sirve» cuando la que no sirve es la prueba: antes de dar la sonda por mala, comprobar
  que el control llegó a cargar la DLL.
- **Procesos con la DLL al regenerar: ninguno**, con la sonda ya comprobada.
- **Antes**, desde un árbol al día, el guard nombraba las tres columnas (`Quote.seriesYear`, `Quote.archivedAt`,
  `WhatsAppMessage.toPhone`). **Después**, `✔` (EXIT 0) desde `s5-14octb`, que cuelga del compartido por junction.
- 🔴 **Desde el árbol compartido `cobroflash-backend` el guard SIGUE EN ROJO, y es lo correcto.** Ese árbol va en
  `scrum-1082-flujo-crear-factura-competencia`, con un `schema.prisma` del 17-sep, y el guard dice «el campo
  `Merchant.invoiceStartSeq` está en el cliente generado y NO en schema.prisma» (EXIT 1): el cliente va con `main`
  y el schema de esa rama no. Es la causa (A) del paso 5. **No quiere decir que la regeneración fallara.**
  ⛔ Regenerar desde el compartido **deshace la regeneración para todos**: lo dejaría generado con el schema del
  17-sep. Se mira desde un árbol al día.
- **Qué propone el guard, según QUÉ COPIA corre** (medido por la Sesión 0 el 16-oct-2026 ~11:10Z, `origin/main` =
  `48fc00f6a`). Desde #2501 (SCRUM-429d, merge `6a79dc15`, 15-oct 17:54Z) el guard de `main` ya no manda
  regenerar «en los dos casos»: con el `node_modules` propio, `npm run prisma:generate`; con el compartido, **«NO
  regeneres… Avisa al orquestador»**, y lo mismo `_prisma-sync.mjs`. Lo ata
  `tests/scrum429d-causa-b-no-regeneres.test.mjs`. **Pero un árbol corre SU copia del script, no la de `main`:** el
  compartido `cobroflash-backend` sigue en `scrum-1082-…`, 3185 commits por detrás, y su guard sigue diciendo
  «Arreglo, en los dos casos: npm run prisma:generate (desde ESTE worktree)» (EXIT 1, el mismo día). Con la copia
  de `main` y el mismo directorio de trabajo da `✔`, porque lee el `schema.prisma` de su propio árbol. Así que el
  ⛔ de arriba no lo ha resuelto #2501: desde el compartido, el consejo sigue siendo el viejo hasta que ese árbol se
  mueva, y nadie lo mueve (CLAUDE.md: «va miles de commits por detrás»).

1. **Cuándo.** Con el equipo parado o avisado: regenerar le cambia el cliente a TODOS los árboles que cuelgan
   de él. `npm run topologia` dice quiénes son.
2. **Qué procesos tienen la DLL cargada** (PowerShell, desde cualquier sitio):
   `Get-Process node | Where-Object { $_.Modules.FileName -match 'query_engine' } | Select-Object Id, StartTime`
   · **Control positivo antes de creerse un vacío:** lanzar un `node` que cree un `PrismaClient` y llame a
   `$connect()` (aunque falle la conexión) y comprobar que la sonda lo ve. Medido el 14-oct: lo vio; y de 14
   `node` vivos, ninguno tenía la DLL cargada.
   · Si sale alguno: es un servidor de desarrollo o una tanda de tests. Se para ESE PID, con su dueño avisado.
   El resto no se toca.
3. **Desde un worktree al día con `origin/main`, que cuelgue del `node_modules` compartido** (no desde el árbol
   principal: va en otra rama y su `schema.prisma` es viejo, y regenerar ahí deja el cliente viejo otra vez):
   `node node_modules/prisma/build/index.js generate`. ⛔ Nunca `npx prisma` (SCRUM-385).
4. **Antes**, apuntar lo que dice `node scripts/_prisma-client-guard.mjs` (las diferencias, con su nombre).
   **Después**, el mismo comando tiene que dar `✔` desde ese worktree, y desde otro que cuelgue del mismo
   `node_modules`. Y `npm run build` sin el aviso amarillo.
5. Que el cliente vaya con `main` no quiere decir que vaya con TU rama: una rama que añade columnas sigue
   viéndolas como «faltan». Eso es la causa (A) de `_prisma-client-guard.mjs`, y para ella no hay cliente
   compartido que valga.

## 11 · Una marca huérfana VIEJA en `.cache/`: el remedio que propone `guards:entrada` revertía el fichero

15-oct-2026 · SCRUM-1178 (de paso) · Sesión 3. Los instrumentos que mutan el árbol (`meta-guard-mutaciones`,
`censo-mudez`) dejan una marca en `.cache/<herramienta>/` con la copia del fichero ORIGINAL (SCRUM-808).
`.cache/` no viaja con git y una marca huérfana puede quedarse semanas en un worktree. Hasta SCRUM-1178,
`restaurarDesdeMarca` escribía esa copia **siempre que los bytes difirieran**. Medido en `wt-s3-1293`: una
marca del 1-oct sobre `homeView.js` (75.033 B) frente al `main` de ese día (85.825 B). El remedio que
`guards:entrada` imprime (`node scripts/meta-guard-mutaciones.mjs --solo-censo`) habría quitado ~10 KB de
`main` del árbol **sin un solo error**: no fallaba, obedecía. No se lanzó porque se miró la copia antes.

| síntoma | causa | qué hacer | cómo se comprueba |
|---|---|---|---|
| `guards:entrada` dice «HAY UNA MUTACIÓN PUESTA» en un fichero que no has mutado | marca huérfana de una pasada muerta hace días; desde entonces el fichero cambió (merge, trabajo) | desde SCRUM-1178 la marca apunta la huella de cada mutación que escribe, y el remedio **sólo** devuelve lo que es exactamente una de ellas. Lo demás sale «NO lo piso» (salida 3) y el aviso dice «NO es una mutación». Si lo de ahora es lo bueno, **se borra la marca**, nunca se copia encima | `tests/scrum1178b-la-marca-no-revierte.test.mjs` (el rojo sembrado) |
| una marca de ANTES del 15-oct (sin `mutaciones` en su `en-vuelo.json`) | no sabe qué escribió | fail-closed: no escribe nunca. Se mira a mano: `git diff` del fichero contra la copia `pieza-N.bin` | el caso ② del mismo test |

⛔ **Nunca se «arregla» una marca copiando `pieza-N.bin` encima del fichero a mano.** Es exactamente el defecto.

### La otra cara: con la máquina cargada, `guards:entrada` sale CIEGO, y un ciego no es un verde

18-oct-2026 · SCRUM-1345b (medido de paso en SCRUM-1158d) · Sesión 3. `guards:entrada` corta a su runner a
los 90 s (`TECHO_MS`) y, si se pasa sin que haya caído nada, sale **2**: «0 hallazgos · 1 ciego». Está hecho
así a propósito (SCRUM-1345: cuánto tarda lo decide la carga de la máquina, no la lista). La trampa no está
en el comando: está en **leer ese 2 como «no ha salido nada rojo» y empujar.** El 18-oct, en
`wt-s3-18oct-d`, sobre la misma entrada, salió dos veces seguidas CIEGO a los 90,0 s. Una hora antes, en otro
árbol, había dado verde en 75 s. **Corriendo sus 15 ficheros sin plazo: 170 de 170.**

| síntoma | causa | qué hacer | cómo se comprueba |
|---|---|---|---|
| `⟦veredicto⟧ 0 hallazgos · 1 ciego → salida 2` y `15 guards · 90.0 s · plazo 90 s` | otras sesiones ocupan los núcleos; la lista no cambió | **no empujar con eso.** Las marcas de mutación y los ficheros que faltan YA se miraron (es lo primero que hace `main()`, antes de correr nada); lo que falta es correr los tests sin plazo, con la lista que exporta el propio script (abajo) | el resumen del runner: `ℹ tests N` con N > 0 y `ℹ fail 0`. Sin esa línea, el runner no terminó |

La lista se saca del script (`GUARDS` y `FUERA_DE_LA_LISTA` son `export`, y `main()` sólo corre si se
lanza el fichero), así que no se copia a mano ni envejece. En PowerShell, desde la raíz del árbol, probado
el 18-oct sobre `06c6289d` (20 ficheros, 208 de 208, 51 s):

```powershell
$f = node --input-type=module -e "const m = await import('./scripts/guards-entrada.mjs'); console.log([...new Set([...m.GUARDS.map((g) => g.fichero), ...m.FUERA_DE_LA_LISTA])].join('\n'))"
$f.Count          # control: tiene que ser > 0 ANTES de seguir
node --test --test-force-exit @f
```

- ⚠️ **Si `$f` sale vacío, `node --test` sin ficheros corre TODA la carpeta `tests/`.** Tarda minutos y sus
  rojos no son los de la entrada. Por eso se mira `$f.Count` antes.
- Lleva también los de árbol entero (`FUERA_DE_LA_LISTA`), que `guards:entrada` sólo nombra al final: son
  los que tumbaron seis PR el 17-oct con el comando en verde (SCRUM-1152c).
- No es el CI: la tanda completa corre muchos más. Es el control previo, ahora con un veredicto.
- Bash no está probado: en esta máquina no hay Git Bash.

## 12 · Staging corre con `NODE_ENV=production` y se comporta COMO producción

**Una prueba en staging NO pasa por los caminos de desarrollo.** Todo lo que el código condiciona a
`NODE_ENV` (11 ficheros de `src/` el 16-oct-2026) va allí igual que en `yaqu.app`. Y no hay nada que
lo avise: una prueba que en local tomaba el camino de desarrollo pasa en staging por el de
producción, sin error, y su verde no dice nada del camino que se quería probar (SCRUM-951h; lo midió
la S1).

**Qué cambia, en concreto:** la cookie va con `Secure` (`authMiddleware.ts`, `isProd`) · no se montan
`/dev` ni `/outbox` (`app.ts`) · el arranque aborta si hay deriva de esquema (`schemaDrift.ts`) · salen
los avisos de secretos de webhook que falten · `receipt.routes.ts` pierde sus avisos de desarrollo ·
Mercado Pago usa el checkout real y no el de sandbox (`mercadopago.ts`, `isProd`) · y desde
SCRUM-1558a (#2522), si allí no hay Resend, el correo del presupuesto contesta «no salió» en vez de
escribir un `.eml`.

**Lo que eso implica, y no estaba escrito en ningún sitio:** una prueba hecha en staging vale como
prueba de PRODUCCIÓN, para bien y para mal. **Un fallo de arranque allí por deriva de esquema es el
mismo fallo que congeló producción en SCRUM-1122** (`docs/RUNBOOKS.md` R22). Si staging no arranca,
no es «cosa de staging»: es lo que pasará en `yaqu.app` con el mismo `main`.

**Cómo se comprueba, sólo con GET:** `/outbox`, sin la barra final y sin seguir redirecciones. El
estático sólo se monta fuera de producción (`if (config.NODE_ENV !== 'production') app.use('/outbox', …)`
en `app.ts`), y el directorio existe siempre (`mkdirSync(outboxDir)` en `dirs.ts`). Así que **301 →
`/outbox/` = desarrollo · 404 = producción.** Control positivo de S1: la app de `dist/` en local da 301
con `NODE_ENV=development` y 404 con `production`. Medido el 16-oct-2026: staging
(`yaqu-staging-production.up.railway.app`) da **404** y `yaqu.app` da **404**, los dos con la versión
`0dbc92f2` en `/health` (repetido por la S0; S1 lo había medido sobre `665bcd17`). Vuelto a medir el
17-oct-2026 a las 19:34Z: los dos dan **404**, con la versión `78a1af25`.

⚠️ **No medido:** qué variables tiene staging (Resend, SMTP, `LOG_MAGIC_LINKS`). Ninguna sesión las
puede leer.

## 13 · El encabezado de un tramo del registro: DOS requisitos, DOS guards, y la herramienta sólo cubre uno

17-oct-2026 · SCRUM-951i · Sesión 0. El 16-oct, el encabezado del registro tumbó a varias sesiones, y
**no siempre por lo mismo**. Cada tramo de `docs/master/SCRUM-N.md` necesita dos cosas, y cada una la vigila
un guard distinto:

| requisito | guard | lo genera alguien | a quién tumbó el 16-oct |
|---|---|---|---|
| ① el **ancla**: `**Medido contra:**` con sha de 40 y hora con huso | `tests/scrum267-ancla-de-medicion.test.mjs` | **sí**: `node scripts/equipo/ancla.mjs` | a S4, que lo cazó antes del CI (con «= producción =» delante del sha). S3 lo arregló en `6ff67998` antes de que terminara ningún CI |
| ② **debajo del ancla, en el mismo tramo, al menos una línea `A9: …`** | `tests/scrum1294-a9-leccion-en-a10.test.mjs` | **NO: nadie** | a S3 en el CI de #2528 (`SCRUM-1559.md:5 · ancla del 2026-10-16 sin línea «A9:»`, run `38905690014`). Según S3 y el orquestador, también a S2 en #2521. Eso no lo he visto en un log: el CI rojo de #2521 que miré (`38901732782`) era de un guard de navegador |

🔴 **Quien lee «falta el ancla» cuando lo que falta es la A9 pierde la tarde.** El nombre del test que cae
dice cuál de los dos es: `SCRUM-267 · …` es el ancla y `SCRUM-1294 · …` es la A9.

### ① El ancla

**La forma exacta.** Una línea, en el encabezado de la entrada (y en cada apéndice: el guard mira entrada a
entrada, no el fichero):

    **Medido contra:** `origin/main` = `<sha de 40>` · <ISO-8601 con huso, `Z` o `±HH:MM`>

**No se teclea: se genera.** `git fetch origin` y después `node scripts/equipo/ancla.mjs`, que existe desde
el 26-sep (SCRUM-1152). Toma el sha de `origin/main` y la hora de la cabecera `Date:` de `gh api -i zen`
(nunca la del reloj de la máquina), y si no puede leer alguno de los dos sale con 2 sin imprimir nada.
Antes de empujar, `npm run guards:entrada` corre los 14 guards de la entrada en ~75 s, sin compilar.

| lo que se escribió | lo que dice el primer rojo | qué hacer |
|---|---|---|
| todo el dato, pero en otra forma («**Cabecera.** 2026-10-16 12:36:53Z · medido sobre `origin/main` `ce054fb4…`»: el caso de S3) | `no declara «Medido contra»` | la etiqueta es literal: `**Medido contra:**`. El dato estaba bien; sólo hay que darle la forma |
| la etiqueta, pero otra cosa entre `origin/main` y el sha (`= producción =`: el caso de S4) | `el ancla no tiene la forma esperada: "<la línea>"` | entre la etiqueta y el sha sólo va `` `origin/main` = `` |
| el sha corto | `el sha está ABREVIADO` | 40 posiciones: un sha de 7 aparece en varias ramas |
| la fecha sin hora | `falta la HORA` | hora con huso. ⚠️ La del commit NO vale: es cuándo se escribió, no cuándo se midió |

**Los tres rojos son UN error.** Con una sola entrada mal, caen tres tests del mismo fichero:

1. **«toda entrada NUEVA del registro declara contra qué main se midió, y cuándo».** El único que diagnostica:
   nombra el fichero, la entrada, la línea y el motivo de la tabla de arriba. **Se lee éste y sólo éste.**
2. **«LAS EXENTAS SON EXACTAMENTE ÉSTAS».** Es un eco: tu entrada no tiene ancla y no está en la lista de
   exentas. ⛔ **No se arregla añadiéndola a la lista**: está cerrada desde el 19-ago-2026 por decisión del
   fundador, y una entrada nueva siempre se puede medir.
3. **«los números CUADRAN».** Otro eco: hay una entrada acusada y el guard espera cero.

Se arregla el ancla y caen los tres a la vez. Y el reporter `spec` imprime cada fallo **dos veces**, una en su
sitio y otra bajo `✖ failing tests:`. Por eso un ancla mala son **seis líneas rojas** de `SCRUM-267`.

⚠️ **Lo que NO vale: «divide entre seis».** Con dos entradas mal siguen cayendo los mismos tres tests, y salen
las mismas seis líneas. El número de defectos es el **número de entradas que lista el rojo 1**, no el de líneas.

**Medido el 17-oct-2026 a las 19:3xZ** en `s0-829c`, con `origin/main` = `78a1af25`, metiendo y quitando una
entrada temporal en `docs/master/` y corriendo sólo `scrum267`:

| entrada temporal | pasa / falla | los rojos |
|---|---|---|
| el ancla que imprime `ancla.mjs` (control positivo) | 14 / 0 | ninguno |
| la forma de S3 | 11 / 3 | los tres de arriba; el 1 dice `no declara «Medido contra»` |
| la forma de S4 | 11 / 3 | los tres de arriba; el 1 dice `el ancla no tiene la forma esperada` |

⚠️ **No medido:** la línea exacta de S4. La cazó antes del CI y no está en el historial; se reprodujo con la
forma que describió el orquestador.

### ② La línea `A9:`, debajo del ancla

Cada ancla abre un tramo, y el tramo necesita **al menos una línea** que empiece por `A9: `, en uno de los
cuatro formatos de A9 (`00-normas-siempre.md`). Si no, cae **un solo test**:
«SCRUM-1294 · todo registro desde el corte lleva su línea A9, y lo que dice se cumple». Con `spec`, eso son
**dos líneas rojas**. El mensaje nombra fichero y línea del ancla: `…SCRUM-N.md:<línea> · ancla del <fecha> sin
línea «A9:»`.

El mismo test cae también si la línea existe pero no se cumple:
- el formato es inventado;
- una `comprobación →` apunta a un fichero que no existe;
- un `aviso → A10 «…»` cita una frase que no está **literal** en A10 (si la frase es nueva, se añade a A10 en
  el mismo PR);
- un `aviso` o un `sin fallo que generalice` no lleva motivo.

**Esta mitad no la genera nadie.** `ancla.mjs` imprime el ancla y nada más. La A9 se escribe a mano porque
dice qué fallo se generaliza y cómo, y eso lo decide quien escribe, no un comando.

🔴 **Y `npm run guards:entrada` NO la mira.** Sus 14 guards no incluyen `scrum1294` (`scripts/guards-entrada.mjs`).
Medido el 17-oct-2026 con una entrada temporal con el ancla buena y sin línea `A9:`:
- `node --test` de `scrum1294` + `scrum267` da **17 / 1**: cae `SCRUM-1294` y `SCRUM-267` pasa entero.
- `npm run guards:entrada`, sobre esa misma entrada, da **«✓ 14 guards de entrada en verde… La entrada puede
  empujarse»**, con exit 0.

El comando que existe para no enterarse por el CI da luz verde a lo que el CI rechaza. **El arreglo es de S5:
#2538 (SCRUM-1152b)** mete `scrum1294` en `guards:entrada`, que pasa a 15 guards, y pone la línea `A9:` en la
plantilla de `docs/master/README.md`. Estaba abierto el 17-oct a las ~20Z. Se mira si tu árbol lo trae: si
`npm run guards:entrada` dice **15** guards, ya la mira; si dice 14, la A9 se comprueba aparte con
`node --test tests/scrum1294-a9-leccion-en-a10.test.mjs` (segundos, sin compilar).

### Cómo se cuenta

**El número de defectos es el de entradas que nombra el rojo, no el de líneas rojas.** Con dos entradas mal
caen los mismos tests y salen las mismas líneas: ni «divide entre seis» ni «divide entre dos». Se lee el
primer rojo de cada guard y se cuentan los ficheros que lista.

🔵 **La lectura.** Cuando dos personas distintas se equivocan igual el mismo día, no falta cuidado: falta una
herramienta. Aquí, para la mitad ① **ya existía**: la línea de S4 no puede salir de `ancla.mjs`, así que se
escribió a mano. Lo que falta ahí es que el comando sea el camino por defecto, y el orquestador se lo ha
encargado a S5 (17-oct). Para la mitad ② **no existe ninguna herramienta**, el comando de antes del push no la
miraba hasta #2538, y es la que cayó dos veces.

## 14 · Un banco que busca un nodo por su clase EXACTA se queda CIEGO si le añades otra clase

18-oct-2026 · SCRUM-951j · Sesión 0, con lo que midió la S2 en #2560 (SCRUM-1562c).

**El caso.** Para que la fila de «Partes por valorar» se abriera con teclado, la S2 la convirtió en un botón
y le añadió una segunda clase: `fila.className = 'customers-card parte-oficina-fila'` (commit `a92f741e`). La
pantalla funcionaba. Pero el banco de SCRUM-1285 (`tests/scrum1285-guardado-en-vuelo.test.mjs:90`) localiza
esa fila así:

    todos(v.contenedor).find((n) => n.className === 'customers-card' && …)

Es una **igualdad exacta** sobre la cadena entera. Con dos clases, `'customers-card parte-oficina-fila'` ya no
es `'customers-card'`: el banco no encuentra la fila, y **los cuatro casos de «oficina»** caen en su propia
guarda, `🔴 CIEGO: no sale el parte en la lista`. Run `39084375339` del CI, sobre `f096b8f2`: los cuatro, con ese
mensaje.

🔴 **Quien lee ese rojo como «he roto el guardado en vuelo» busca el defecto donde no está.** El producto no
había cambiado de conducta: lo que cambió es que el instrumento dejó de ver. El test lo dice en la primera
palabra del mensaje, **CIEGO**, y ésa es la que hay que leer antes que el nombre del caso.

**Cómo se arregló, y por qué así** (commit `0a103940`, regla 41: se arregla el código, no el guard): la fila
vuelve a llevar sólo `customers-card`, y su estilo de botón cuelga de un selector que no necesita la clase
nueva, `#po-lista > button.customers-card` (`public/dashboard/css/styles.css:2487-2488`). Y el test propio de
la S2 (`tests/scrum1562c-partes-oficina-con-teclado.test.mjs`) exige ahora la clase exacta, para que el mismo
error caiga en su fichero y no en el de otro. Run `39147335140`, sobre `0a103940`: el obligatorio ya no tiene
ningún rojo.

**Cómo se evita, antes de empujar** (lo dijo la S2 en su traspaso): si cambias la clase o la etiqueta de un
elemento de `public/`, busca esa clase en `tests/` y corre esos ficheros.

    git grep -n "<la clase>" -- tests/

**Cuántos bancos tienen esta forma.** El 18-oct-2026, sobre `origin/main` = `74e60ebe`: **49 apariciones de
`className === '` en 26 ficheros de `tests/`** (`git grep -c "className === '" -- tests/`). La búsqueda encuentra
`scrum1285:90`, que es el caso conocido, así que no está ciega. ⚠️ **No están clasificadas:** no todas
localizan un nodo, y no se ha mirado cuáles llevan una guarda que diga CIEGO y cuáles fallarían de otra forma.
La forma que no se rompe al añadir una clase, `classList.contains(…)`, sale en 6 ficheros.

⚠️ **No medido por S0:** la mutación (volver a poner las dos clases y correr el banco). La hizo la S2 en
`0a103940` («mutación con clase doble: caen los 4 del CI + el mío») y la confirma el log del CI de arriba; S0
no la ha repetido, porque es un cambio en `public/`.

## 15 · `FATAL ERROR: Reached heap limit` en el log de la tanda NO es un OOM de la tanda

18-oct-2026 · SCRUM-951k · Sesión 5.

**El síntoma.** En el log del job `build + tests` aparece, a media tanda:

    FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
    ----- Native stack trace -----

con unas cuarenta líneas de pila nativa. Parece que el runner se ha quedado sin memoria. **No es así: sale en
TODAS las tandas, también en las verdes.**

**La causa.** Lo imprime un test que funciona bien:
`tests/scrum1525b-el-respaldo-por-correo.test.mjs`, «un hijo que muere por MEMORIA (sin pasar por su catch) se
ve desde fuera y acaba en correo». Ese test lanza un hijo con `--max-old-space-size=24` y lo mata **a
propósito**. `lanzarVolcado` (`scripts/respaldo-programado.mjs`) copia el stderr del hijo en el del padre,
también a propósito, porque en Railway es lo que queda guardado. Las líneas de GC del volcado marcan 22-28 MB:
es el tope de 24 MB del hijo, no el del runner. **La línea siguiente del log es el ✔ de ese test.**

**Cómo se distingue, en 30 segundos.** Se busca la misma línea en una run VERDE de `main`:

    gh run list -b main -w ci.yml -s success -L 1          # el id de la run
    gh api "repos/<dueño>/<repo>/actions/runs/<id>/jobs"    # el id del job «build + tests»
    gh api --allow-escape-sequences "repos/<dueño>/<repo>/actions/jobs/<job>/logs" | grep "FATAL ERROR"

La contraprueba ya medida es la run **38524399363** (`main`, 14-oct-2026, `ℹ fail 0`). Trae la misma
`FATAL ERROR` y el ✔ de `scrum1525b` justo debajo. ⚠️ Sin `--allow-escape-sequences`, `gh api` no escribe el
log, sale sin nada y no da ningún error.

🔴 **Lo que vale para todo: el resumen final de la tanda manda sobre cualquier línea alarmante del cuerpo.**
Ese resumen es el bloque `ℹ tests / ℹ pass / ℹ fail / ℹ skipped`, y debajo va `✖ failing tests:` con los
nombres. Si llegó, la tanda no murió, y los rojos son los de esa lista. Un OOM de verdad de la tanda se ve de
otra manera: el job se corta **sin** ese bloque, o hay un fichero que se queda sin resultados (§8).

**El caso que lo destapó.** El 18-oct-2026, en el #2568 (`scrum-231b-exports-sin-cache-compartida`, run
**39151663342**, job 117746392988), el FATAL salió a las 17:57:27Z. Se leyó como un OOM y se relanzó la run.
Pero la tanda siguió viva **7 minutos más** y cerró con su resumen: `tests 11826 · pass 11718 · fail 19 ·
skipped 89`. Los 19 rojos eran del propio diff (los censos de `scrum267`, `scrum859`, `scrum976`, `scrum1344` y
`scrum1415`), y el relanzamiento sólo los habría repetido. Había además un dato a la vista que ya descartaba el
OOM: **el job del trinquete de esa misma run corrió la tanda entera dos veces**, en el mismo tipo de runner, y
salió en verde.

⚠️ **No medido:** cuánta memoria pide la tanda en el pico, porque el log no lo dice. Tampoco hacía falta: no
hubo ningún OOM de la tanda que medir.
