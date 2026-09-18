# Instalar el equipo de fondo en una máquina NUEVA — guion (SCRUM-951a)

> Para una máquina Windows que **no ha visto nada** del proyecto: la de Javier, o la de Luis si se reinstala.
> Lo ejecuta el Claude de quien instala, paso a paso. Cada paso trae **orden**, **comprobación** (si no da lo
> esperado, se PARA y no se sigue) y **cómo se deshace**. Al final, una **lista de verificación** que el propio
> Claude corre para demostrar que todo funciona.
>
> Los valores concretos del equipo de Luis y la historia de su checkout están en
> `docs/equipo/instalacion-orquestador-autonomo.md`. Cómo conviven los dos equipos (quién es jefe de qué,
> nombres, Jira) lo dice `docs/equipo/dos-equipos.md`, que es de la Sesión 0.
>
> ⚠️ **Nunca se ha instalado todavía en ninguna máquina de verdad.** El 18-sep-2026 la Sesión 5 hizo un
> **ensayo** entero en la máquina de Luis, en una carpeta de prueba y con el prefijo `ensayo-`, sin crear tareas
> ni tocar settings (SCRUM-951d, `docs/master/SCRUM-951.md`). Lo que el ensayo cazó ya está en los pasos 0, 2, 4,
> 7 y en «Desinstalar»; lo que no pudo probar, al final. Si un paso no da lo que dice aquí, se para y se cuenta,
> no se improvisa.

## Variables

Se deciden ANTES de empezar y se escriben aquí, en el chat de quien instala. Ningún script las lleva dentro.

| variable | qué es | cómo se saca |
|---|---|---|
| `REPO` | el clon del repositorio | la carpeta donde se clona (paso 1) |
| `INST` | la instalación, FUERA del repo | `%LOCALAPPDATA%\yaqu-equipo` (en Git Bash: `$LOCALAPPDATA/yaqu-equipo`) |
| `CLAUDE` | el binario de Claude Code, **`claude.exe`** | `"$(npm root -g)/@anthropic-ai/claude-code/bin/claude.exe"` |
| `PREFIJO` | lo que llevan delante los nombres de sesión del equipo | lo aprueba el fundador. Ejemplo en tests y aquí: `jv-` |
| `PUESTOS` | los puestos del equipo, separados por comas | los aprueba el fundador (`dos-equipos.md`) |
| `ORQUESTADOR` | cuál de los puestos es el orquestador | uno de `PUESTOS` |
| `TANDAS` | horas de arranque diario, `HH:MM` separadas por comas | las decide el orquestador de ese equipo |

⚠️ **`claude.exe`, no `claude.cmd`:** sin shell, Node no ejecuta `.cmd`.

Todas las órdenes de esta guía son de **Git Bash**. Las variables se fijan así, al abrirlo (rutas de Windows con
barras normales; los valores de ejemplo son de ejemplo):
```
export REPO='C:/Users/<tu usuario>/yaqu/cobroflash-backend'
export INST="$LOCALAPPDATA/yaqu-equipo"
export CLAUDE="$(npm root -g)/@anthropic-ai/claude-code/bin/claude.exe"
export PREFIJO='jv-' PUESTOS='<puesto1>,<puesto2>,…' ORQUESTADOR='<puesto1>' TANDAS='08:00,13:05,18:10'
```
Un Git Bash nuevo no las recuerda: si se cierra, se vuelven a fijar.

El nombre de cada sesión es `PREFIJO` + puesto (con `PREFIJO=jv-` y el puesto `jefe`, la sesión es `jv-jefe`).
Un equipo sin prefijo se declara con `--sin-prefijo`: vacío y olvidado no se confunden.

---

## 0 · Requisitos

| qué | comprobación | lo esperado |
|---|---|---|
| Windows 10/11 con **Git for Windows** (trae Git Bash) | `git --version` | responde |
| **Node** 20 o más (medido con v24.8.0) | `node --version` | `v20` o más |
| **Claude Code** instalado y con sesión iniciada con la cuenta de quien instala | `"$CLAUDE" --version` | responde (el 18-sep: 2.1.276) |
| **gh** instalado y autenticado | `gh auth status` (o `"C:/Program Files/GitHub CLI/gh.exe" auth status`) | «Logged in» |
| acceso al repositorio `lwislg99/cobroflash-backend` como colaborador | `git ls-remote https://github.com/lwislg99/cobroflash-backend.git HEAD` | una línea con un SHA |
| disco: **1 GB libre** en la unidad del repo, más **0,4 GB** por cada `node_modules` | `df -h /c` (la letra de la unidad del repo, en minúscula: `/d` para D:) | llega en `Avail` (el ensayo: clon + `node_modules` = 564 MB) |

⚠️ En Git Bash, `df -h C:` falla («No such file or directory») y `Get-PSDrive` no existe: es de PowerShell
(medido en el ensayo).

Si algo no llega, se PARA aquí. **Secretos:** las claves de base de datos o de servicios las da el fundador
directamente, fuera del chat y fuera del canal. Nunca se piden ni se pegan en una conversación.

**Deshacer:** no aplica.

---

## 1 · Clonar y preparar el repo

**Orden** (Git Bash):
```
git clone https://github.com/lwislg99/cobroflash-backend.git "$REPO"
cd "$REPO" && npm ci
```

**Comprobación:**
- `git -C "$REPO" rev-parse --verify origin/main` da un SHA;
- `ls "$REPO/scripts/equipo"` lista `sesion.mjs`, `instalar.mjs`, `orquestador-arranque.mjs`, `uso.mjs`,
  `huerfanos.mjs` y `comprobar-instalacion.mjs`.

**Deshacer:** borrar la carpeta `REPO` a mano.

---

## 2 · Abrir Claude Code UNA vez en el repo

Claude Code guarda la memoria (y en ella los traspasos de cada puesto, `project_*_traspaso.md`) en
`~/.claude/projects/<ruta del repo con cada carácter no alfanumérico cambiado por ->/memory`. Esa carpeta la crea
Claude Code, no el instalador.

**Orden:** abrir Claude Code en `REPO` (interactivo, NO en segundo plano) y contestar los DOS diálogos que salgan:

1. **la confianza de carpeta**: aceptar;
2. 🔴 **el servidor MCP del proyecto** (`.mcp.json` declara `playwright`): **decidirlo**, sí o no. Lo decide quien
   manda en la máquina. El equipo de Luis lo tiene APAGADO (`disabledMcpjsonServers: ["playwright"]`).

Después, cerrar.

🔴 **Por qué el segundo diálogo no se puede saltar — medido en el ensayo del 18-sep-2026:** una sesión de fondo
lanzada en un clon nuevo **no llegó a arrancar**. `sesion.mjs estado` la dio `blocked`, y su
`~/.claude/jobs/<id>/state.json` decía `"needs": "approve 1 new project MCP server (playwright) — attach to
respond"`. En segundo plano nadie contesta ese diálogo, así que el orquestador de la primera tanda se quedaría
ahí para siempre. El checkout de Luis no lo sufre porque tiene la decisión en su `.claude/settings.local.json`,
pero como cambio LOCAL sin commitear: `origin/main` no decide nada y **ningún clon lo hereda**. El paso 7.1 lo
comprueba («MCP del proyecto»).

**Comprobación:** la hace el paso 3: si la carpeta no existe, el instalador se niega y dice en su `motivo` la
ruta EXACTA que esperaba. ⚠️ Lo normal es que falte la última parte, `memory`: medido el 18-sep-2026 en
`~/.claude/projects` de la máquina de Luis, las **5 de 5** carpetas de proyecto donde nunca se escribió una memoria
no tienen `memory` (Claude Code crea la del proyecto, no la de la memoria). Se crea a mano con la ruta que imprimió
el instalador, `mkdir -p '<ruta del motivo>'` (en Git Bash vale con las barras invertidas si va entre comillas
simples), y se repite el paso 3. Nunca se inventa otra ruta: es ahí donde cada sesión escribirá su traspaso.

**Deshacer:** si se creó `memory` a mano y aún está vacía, borrarla; si ya tiene ficheros, no se toca (son la
memoria del equipo). La decisión del MCP se deshace en el mismo sitio donde quedó guardada.

---

## 3 · Instalar

**Orden** (desde `REPO`; con prefijo, o `--sin-prefijo` en su lugar):
```
node scripts/equipo/instalar.mjs --destino "$INST" --repo "$REPO" --claude "$CLAUDE" \
  --prefijo "$PREFIJO" --puestos "$PUESTOS" --orquestador "$ORQUESTADOR" --tandas "$TANDAS" \
  --prompt docs/equipo/prompt-tanda-orquestador.md
```
El prompt de la tanda es UNO para los dos equipos (decisión de la Sesión 0, 18-sep-2026).
`--traspasos <carpeta>` solo si la memoria no está donde la calcula el instalador.

**Comprobación:**
- la salida es `"veredicto": "INSTALADO"`, con el `config` escrito, las órdenes de `schtasks` y la línea del
  `statusLine` (se usan en los pasos 4 y 5, tal cual);
- en `INST` están `config.json`, `arranque.cmd`, `sesion.mjs`, `orquestador-arranque.mjs`, `uso.mjs` y
  `prompt-tanda.md`, copiados de `origin/main` (no del árbol de trabajo);
- si dice `NO-INSTALADO`, se lee el `motivo` y **no se escribió nada**: el instalador valida todo antes.

**Deshacer:** borrar a mano la carpeta `INST`.

---

## 4 · El aviso de uso en la barra de estado

Lo pone **quien manda en la máquina** en su `~/.claude/settings.json` (tocar settings no lo hace una sesión sin
su autorización expresa en ese chat). La línea exacta es la que imprimió el paso 3 en `settings`:
```
"statusLine": { "type": "command", "command": "node <INST con barras normales>/uso.mjs escribir" }
```
Sin `refreshInterval`: no aporta lecturas nuevas.

⚠️ `uso.mjs` guarda su lectura SIEMPRE en `%LOCALAPPDATA%\yaqu-equipo\uso.json`, esté donde esté `INST`. Con `INST` en
su sitio (la variable de arriba) es la misma carpeta; con `INST` en otro sitio, la lectura es de la máquina, no de
esa instalación (medido en el ensayo: VERDE con el `uso.json` de Luis). La salida de `leer` dice en `fichero` cuál leyó.

**Comprobación:** `node "$INST/uso.mjs" leer` sale con **2** antes —si ninguna otra sesión de la máquina escribe ya
en ese `uso.json`—; tras un turno en una sesión **interactiva**, con **0** (verde) o **1** (aviso, desde el 85 %), y
`usado` coincide con lo que dice `/usage`.

**Deshacer:** quitar la línea de `statusLine`.

---

## 5 · Las tareas diarias

Crear tareas programadas necesita la **autorización expresa** de quien manda en la máquina. **Orden:** las que
imprimió el paso 3 en `schtasks`, una por hora, desde Git Bash (sin `MSYS_NO_PATHCONV=1`, Git Bash convierte
`/create` en una ruta y falla — medido). El nombre de cada tarea lleva el prefijo: `yaqu-equipo-<PREFIJO>HHMM`.

⚠️ Una tarea creada así corre solo con el PC encendido y la sesión de Windows iniciada: si no, esa tanda no hay.

**Comprobación:** `MSYS_NO_PATHCONV=1 schtasks /query /tn yaqu-equipo-<PREFIJO>HHMM` muestra la tarea, «Diariamente»,
a su hora.

**Deshacer:** `MSYS_NO_PATHCONV=1 schtasks /delete /tn yaqu-equipo-<PREFIJO>HHMM /f`, y `/query` dice que no la encuentra.

---

## 6 · Permisos y límite de uso

Lo hace **quien manda en la máquina**:
- la regla permanente `Bash(node <INST con barras normales>/sesion.mjs *)` — la ÚNICA puerta para lanzar o parar
  sesiones; nunca `claude` a pelo. ⚠️ La regla va con el nombre de la herramienta de shell que usa Claude Code en esa
  máquina: si es PowerShell (lo es en la de Luis), `PowerShell(node <INST con barras normales>/sesion.mjs *)`. Sin
  ella, el clasificador de permisos frena el lanzamiento («Create Unsafe Agents», medido el 17-sep) y el 7.2 no pasa;
- `/config` → **`autoContinueAtUsageLimit` encendido**: si queda apagado, una sesión de fondo que llega al límite se
  queda en un diálogo, bloqueada.

**Comprobación:** el JSON de settings es válido y la regla está una vez.

**Deshacer:** quitar la regla.

---

## 7 · Lista de verificación final — la corre el propio Claude

### 7.1 · Lo mecánico, con un comando

```
node scripts/equipo/comprobar-instalacion.mjs --destino "$INST"
```

Ejecuta cada pieza y dice qué vio: el config y el equipo, `claude --version`, `origin/main`, que cada copia sea
idéntica a `origin/main`, `arranque.cmd`, la carpeta de los traspasos, **la copia instalada de `sesion.mjs`
ejecutando su propia puerta** (`estado`), el aviso de uso, **los servidores MCP del proyecto**, el censo de
huérfanos, las tareas programadas y `gh`. Termina con la población («N comprobaciones», 15 en el ensayo) y sale con
**0** si no hay ninguna `FALLA` ni `NO-PUDE-MIRAR`.

`FALLA · MCP del proyecto` es el segundo diálogo del paso 2 sin contestar: se vuelve al paso 2. En el ensayo, la
lista de ANTES de esta comprobación salió «OK · 14 comprobaciones» y la primera sesión de fondo se bloqueó igual.

Un `AVISO` no bloquea, pero se lee: «tareas sin crear» es el paso 5; «aviso de uso sin lectura» es el paso 4 sin
un turno interactivo todavía; «el uso.json que lee no es de esta instalación» es `INST` fuera de su sitio (paso 4);
«huérfanos» es trabajo sin empujar en algún worktree.

### 7.2 · Lo que un script no puede: una sesión que CONTESTA por el canal

Necesita la regla del paso 6. El nombre de este chat lo dice `ListAgents` en su primera línea («This session is …»).

1. Escribir en un fichero el prompt de prueba: «Eres una sesión de prueba de la instalación. Manda por SendMessage a
   `<nombre de este chat>` una sola línea: "prueba de instalación: te oigo", y termina.»
2. `node "$INST/sesion.mjs" lanzar <PREFIJO><un puesto> <fichero>` → `"veredicto": "LANZADA"` con un `sessionId`
   completo.
3. **En unos 2 minutos llega su mensaje** por el canal, y `ListAgents` la lista con ese nombre. Si no llega, se mira
   `node "$INST/sesion.mjs" estado`: si sale como `blocked`, está esperando algo que nadie va a contestar, y **qué**
   lo dice el campo `needs` de `~/.claude/jobs/<id>/state.json` (el `id` de 8 caracteres de `estado`). ⚠️ Medido en
   el ensayo: una sesión bloqueada antes de su primer turno **no sale en `ListAgents`** y no tiene jsonl; `estado`
   es lo único que la ve.
4. `node "$INST/sesion.mjs" parar <PREFIJO><ese puesto>` → `"veredicto": "PARADA"`, y `node "$INST/sesion.mjs" estado`
   ya no la lista.

**Deshacer:** es el punto 4. Si el 2 falló a medias, `estado` dice si quedó algo vivo y `parar` lo quita.

### 7.3 · La primera tanda, a mano

`cmd //c "<INST con barras invertidas>\arranque.cmd"` → la última línea de `INST/arranque.log` es JSON con
`"tanda": {"veredicto": "LANZADA", "nombre": "<PREFIJO><ORQUESTADOR>", …}`. Si dice `ALTERADO`, `DESDE-UN-ARBOL` o
`NO-PUDE-MIRAR`, se para y se lee el motivo: la puerta ha hecho su trabajo.

⚠️ **Esto arranca al orquestador DE VERDAD**, con el prompt de la tanda: se pondrá a leer, medir y repartir. Se hace
cuando el equipo deba empezar a trabajar, no como prueba suelta.

**Deshacer:** `node "$INST/sesion.mjs" parar <PREFIJO><ORQUESTADOR>` → `"veredicto": "PARADA"`.

### 7.4 · Rojos conocidos de la suite en local

`tests/scrum939b-trinquete-de-las-skills.test.mjs` da **3 rojos** en cualquier Windows con `gh` en su ruta por
defecto (declara falsa una ruta que en esa máquina existe). En CI sale verde. Hasta que se arregle (comentario en
SCRUM-939), esos 3 se declaran como conocidos en el informe de la suite; cualquier otro rojo es de verdad.

---

## Desinstalar entero

En orden inverso, y cada paso con su comprobación:

1. parar las sesiones del equipo: `node "$INST/sesion.mjs" estado` y `parar` para cada una → `estado` sin ninguna;
2. deshacer el 6 y el 4 en `~/.claude/settings.json` (quien manda en la máquina);
3. deshacer el 5: `MSYS_NO_PATHCONV=1 schtasks /delete /tn <tarea> /f` de cada tarea → `/query` (también con
   `MSYS_NO_PATHCONV=1`) no la encuentra. Sin esa variable, Git Bash convierte `/delete` y `/query` en rutas
   (medido en el ensayo: «Argumento u opción no válido - "D:/Program files D/Git/query"»);
4. deshacer el 3: borrar a mano la carpeta `INST` → ya no existe.

La memoria del proyecto (`~/.claude/projects/…/memory`) y el clon (`REPO`) **no** se borran al desinstalar: tienen
los traspasos y el trabajo sin empujar. Antes de tocar el clon, `node scripts/equipo/huerfanos.mjs` desde `REPO`.

## Después de instalar

El Claude de cada sesión lee lo suyo desde `origin/main`: `CLAUDE.md`, `docs/equipo/00-normas-comunes.md`, su ficha y
`docs/equipo/dos-equipos.md` (cómo trabajan los dos equipos a la vez). Esta guía solo deja la máquina lista.

## Lo que esta guía NO ha medido

El ensayo del 18-sep-2026 (SCRUM-951d) corrió los pasos 0, 1, 3, 7.1 y 7.2 de verdad, con el `claude.exe` real y un
clon nuevo, en la máquina de Luis. Lo que NO pudo probar:

- **El paso 2 interactivo**: el ensayo corría en segundo plano. Se hizo la mitad que no es interactiva (el `mkdir`
  de `memory`); los dos diálogos, no. Por eso no está medido **dónde guarda Claude Code la decisión del MCP** al
  contestar el diálogo (en el checkout de Luis está en `.claude/settings.local.json`, que va en el repo: si es ahí,
  el clon queda con ese fichero modificado y el censo de huérfanos puede avisar por él), ni si la **confianza de
  carpeta** bloquea también a una sesión de fondo (la del ensayo se paró antes, en el MCP).
- **Los pasos 4, 5 y 6**: tocan settings y tareas programadas, que el ensayo tenía prohibidos. Del 5 solo se midió
  `/query`. Tampoco si el lanzamiento necesita la regla del 6: en el ensayo pasó sin ella, pero con los permisos
  de la sesión que lo lanzaba, que no son los de una máquina nueva.
- **El 7.2 completo**: la sesión de prueba no llegó a mandar su mensaje (el bloqueo del paso 2). Sí se midieron
  `lanzar` (`LANZADA` con `sessionId`), `estado` (la vio, primero `working` y luego `blocked`) y `parar` (`PARADA`,
  `stop` y `rm` con 0, y `estado` vacío después).
- **El 7.3**: arranca al orquestador de verdad con el prompt de la tanda.
- Si las sesiones de fondo ejecutan el `statusLine` (según la documentación, solo las interactivas).
