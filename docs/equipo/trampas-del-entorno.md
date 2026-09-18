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
| `[IO.File]::ReadAllText('ruta/relativa')` lee OTRO fichero | las APIs de .NET resuelven contra el directorio del PROCESO, no el de PowerShell | rutas ABSOLUTAS (`Resolve-Path`) |
| `… \| Select-Object -First N` y node no escribe nada | la tubería corta a node antes de que escriba | redirigir a un fichero y leerlo en OTRO comando |
| `>` o `Out-File` escribe UTF-16 o con BOM | valores por defecto de 5.1 | `-Encoding utf8`; y para un mensaje de commit sin BOM: `[IO.File]::WriteAllText($ruta, $texto, (New-Object Text.UTF8Encoding $false))` |
| `ConvertFrom-Json` de un array de un elemento devuelve un objeto | 5.1 desenvuelve arrays | volcar el JSON a fichero y leerlo con node |
| `node -e "…"` con comillas anidadas revienta | el escapado de 5.1 | escribir el script a un `.mjs` |
| `2>&1` sobre un programa nativo pone `$?` en falso aunque saliera 0 | 5.1 envuelve cada línea de error | no redirigir stderr de programas nativos |
| `FORCE_COLOR` vuelve en cada comando | el entorno de la herramienta no persiste entre comandos | borrarlo al principio de CADA comando (A6) |

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
- **Una lista de PR ABIERTOS vacía no distingue «nunca se abrió» de «se abrió y ya entró».** → `--state all`.
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
