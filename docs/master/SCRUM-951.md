# SCRUM-951 · El equipo de Javier: montar en main todo el sistema del equipo para que trabaje igual en su máquina

Decisión del fundador (transmitida por el orquestador el 18-sep-2026): Javier trabaja **exactamente** como el equipo
de Luis, en su propio ordenador con Windows, su propia cuenta de Claude y su propio orquestador que lanza y releva
sesiones en segundo plano. **Los dos son jefes.** Dos partes: **951a** (Sesión 5, el código y la instalación) y
**951b** (Sesión 0, las normas: `docs/equipo/dos-equipos.md`).

## SCRUM-951a · el equipo sale del config, no del código

**Medido contra:** `origin/main` = `34d06bb4f4e306b11745cf34fbbc85233c5a3299` · 2026-09-18T12:09:26Z

**Rama:** `scrum-951a-equipo-configurable`

### PASO 0 (solo lectura, enviado al orquestador antes de construir)

Lo atado a Luis en `scripts/equipo/` y en la guía, y cómo se vuelve configuración:

| atado a Luis | dónde | ahora |
|---|---|---|
| nombres `orquestador\|sesion-[0-5]` en una regex | `sesion.mjs` | `prefijo` + `puestos` + `orquestador` del `config.json`; el prefijo se DECLARA siempre |
| horas de las tandas (08:00, 13:05, 18:10) en una constante | `instalar.mjs` | `--tandas`; las de Luis viven en su guía |
| carpeta de los traspasos, sin escribir | `instalar.mjs` | `traspasos`, calculada desde `--repo` y comprobada |
| el prompt de la tanda, fijo | `instalar.mjs` | `--prompt` (uno para los dos equipos, decisión de la S0) |
| `D:/MILLONARIO…` y `C:/Users/Admin…` escritos 30 veces | la guía | variables en `docs/equipo/instalacion-maquina-nueva.md` |
| ruta de `gh` | skills y prompts; **ningún script de aquí la usa** | una comprobación de la lista, no config |
| nombre del chat del orquestador | solo documentos | sale del prefijo + puesto |

`uso.mjs` y `huerfanos.mjs` ya eran portables (`%LOCALAPPDATA%` y `--repo`/cwd).

### Tres hallazgos que ya fallaban también en la máquina de Luis

1. **El sistema no se ha instalado nunca**: el 18-sep no existía `C:/Users/Admin/AppData/Local/yaqu-equipo`. El guion
   de instalación no se había ejecutado de principio a fin en ninguna máquina.
2. **A2 · `relevar` no podía funcionar con lo que escribía el instalador**: `config.json` llevaba `{repo, claude}` y no
   `traspasos`, así que la ruta del traspaso salía RELATIVA y el veredicto era siempre `SIN-TRASPASO`. Falla cerrado
   —seguro— pero se lee exactamente igual que «la sesión no ha escrito su traspaso».
3. **A3 · el traspaso del orquestador se buscaba en `project_traspaso.md`**, y el de verdad se llama
   `project_orquestador_traspaso.md`. 🔴 **Y un test lo fijaba**: `tests/scrum899c-relevar-y-contexto.test.mjs`
   afirmaba el nombre erróneo. El defecto estaba sujeto por su propio guard.

### Qué cambia

- **`sesion.mjs`**: `validarEquipo(config)` (prefijo declarado, 0-16 de `[a-z0-9-]`; puestos no vacíos, sin repetir,
  `[a-z0-9-]`; orquestador entre los puestos). La lista blanca es prefijo + puesto, y la CLI pasa SIEMPRE el equipo
  de su config: `EQUIPO_DE_LUIS` solo lo usan las llamadas puras de los tests. La puerta de integridad rechaza un
  config sin `traspasos` o con el equipo inválido (`NO-PUDE-MIRAR`, sin llamar a `claude`). `rutaDelTraspaso`:
  `sesion-N` → `project_sN_traspaso.md`; cualquier otro puesto → `project_<puesto>_traspaso.md`, sin el prefijo
  (la memoria es de cada máquina).
- **`orquestador-arranque.mjs`**: lanza a `prefijo + orquestador` del config, no a `orquestador` escrito en el código.
- **`instalar.mjs`**: argumentos `--prefijo`/`--sin-prefijo` (uno de los dos, obligatorio: PowerShell 5.1 se come un
  `--prefijo ""`), `--puestos`, `--orquestador`, `--tandas`, `--prompt`, `[--traspasos]`. Valida TODO y lee de
  `origin/main` ANTES de escribir nada; copia ya los scripts, `uso.mjs` y el prompt (la instalación sirve desde el
  primer minuto); imprime las órdenes de `schtasks` (con el prefijo en el nombre de la tarea) y la línea del
  `statusLine`. `uso.mjs` pasa a copiarse también en cada tanda.
- **`comprobar-instalacion.mjs`** (nuevo): la lista de verificación del final de la guía, ejecutable. EJECUTA cada
  pieza —la copia instalada de `sesion.mjs` con su puerta, `uso.mjs leer`, el censo de huérfanos, `claude --version`,
  `schtasks /query`— y declara su población. Salida 0/1/2; `NO-PUDE-MIRAR` gana.
- **Guías**: `docs/equipo/instalacion-maquina-nueva.md` (nueva, para una máquina que no ha visto nada, con variables,
  comprobación y deshacer por paso, y la lista final: 7.1 el comando, 7.2 una sesión de prueba que contesta por el
  canal, 7.3 la primera tanda a mano, 7.4 los rojos conocidos de `scrum939b`). `instalacion-orquestador-autonomo.md`
  queda como la guía de la máquina de Luis, con su paso 4 al día.

### Rojo primero

Commit `9af7a31c` (solo tests, contra el código de `origin/main` = `972b51b3`): **26 tests, 13 fallan**, y el
**control del banco sale verde** (la misma instalación con `traspasos` sí actúa), así que los rojos son de la puerta y
no de un banco roto. A3 cae por `'\memoria\project_traspaso.md'` frente a `project_orquestador_traspaso.md`; A2, por un
`config.json` sin `traspasos` y por una copia que con ese config responde `ESTADO` en vez de `NO-PUDE-MIRAR`.

### Mutantes

`docs/master/evidencias/scrum951a/mutar.mjs` hace lo de `meta:mutaciones` para UN fichero: BASE verde o para, cada
`de` una sola vez, exige ver `✖ <cae>`, y restaura comprobando los bytes. Salida entera en
`docs/master/evidencias/scrum951a/salida-mutar.txt`.

- `tests/scrum951a-equipo-configurable.test.mjs`: **11 de 11** caen.
- Re-verificadas las anclas de los tres ficheros del lanzador que este PR toca: `scrum899` **5/5**, `scrum899b`
  **4/4**, `scrum899c` **6/6**. Una ancla de `scrum899` apuntaba a la regex que ya no existe y se movió a la línea
  nueva de la lista blanca.
- **Control negativo del mutador**: una mutación inocua (un comentario) sale **VIVE** y la pasada da «9 de 10» con
  salida 1. El instrumento sabe decir que no.

### La suite con turno cazó tres cosas mías (y las tres las arregla el código, no el guard)

Primera pasada, sobre `926001a4`: 7.707 tests · 7.590 pass · **6 fail** · 111 skip. Tres son los conocidos de
`scrum939b` (ajenos: `gh` existe en esta máquina). Los otros tres eran de este PR:

- **SCRUM-622** — `comprobar-instalacion.mjs` hacía `vu?.motivo || 'VERDE'`: un veredicto que falta se rellenaba con
  «verde». Ahora el código de salida y el veredicto escrito de `uso.mjs` tienen que CUADRAR, o es `FALLA`.
- **SCRUM-824** — tres escrituras del test colgaban de `b.dir`, que el censo de temporales no sabe seguir. Ahora pasan
  por ayudantes de `banco()` que cuelgan de `temporal()`. No se declaró nada en `SIN_PROBAR_CONOCIDOS`.
- **SCRUM-723** — `instalar.mjs` y `comprobar-instalacion.mjs` leen `origin/main` **por diseño** (copian y comparan
  contra la copia oficial, que es la que exige la puerta de `sesion.mjs`). Ese censo existe para declararlos con su
  motivo, como a los bancos de 899; declarados, y el banco de 951a también.

Mutantes re-medidos tras el arreglo: 11 de 11.

### Lo que NO se ha hecho

- **Ninguna instalación real**, ni en la máquina de Luis ni en la de Javier. Todo está probado en bancos (repositorio
  de prueba con `origin/main`, `claude` falso con estado). No se ha llamado al `claude` de verdad desde la S5: el
  clasificador lo frena (`orquestador-autonomo.md` §7).
- 7.2 de la guía (una sesión que contesta por el canal) no se puede automatizar: `SendMessage` no existe fuera de
  Claude Code.
- La memoria que lee el prompt de la tanda y lo que dice sobre Jira son de la S0 (951b).

**Tests declarados:** `tests/scrum951a-equipo-configurable.test.mjs`

## SCRUM-951b · Las normas y `dos-equipos.md`

**Medido contra:** `origin/main` = `e76580b1a4067b95e6b47f93dc43d12cdfa4618b` · 2026-09-18T12:01:39Z
**Rama:** `scrum-951b-normas-dos-equipos` · **Carril:** consultoría (Sesión 0), dueña de `docs/equipo/00-normas-comunes.md` · **Encargo:** orquestador, 18-sep-2026 (paso 1 de 5)
**Solo docs.** Nada de `src/` ni `public/`. El código portable (configuración por instalación, prefijo de equipo) es **SCRUM-951a**, de la Sesión 5.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

### Por qué

El fundador quiere que Javier trabaje EXACTAMENTE como el equipo de Luis: su orquestador, sus puestos, las
mismas normas y la misma automatización. Y decidió (18-sep ~11:50Z) que **los dos son jefes**. El problema,
medido en el paso 1a: gran parte de lo que hace funcionar al equipo vivía **solo en la memoria de una
máquina** (61 notas), que Javier no tiene; y Javier no detecta los fallos de formato ni de proceso que sí
detecta el fundador. Por eso las normas nuevas están escritas como **listas de comprobación, cada casilla
con el caso que la haría fallar**, no como consejos.

### Paso 1a · el censo de la memoria (entregado al orquestador ANTES de escribir, y aprobado)

Población: 62 ficheros = 61 notas + `MEMORY.md`, **leídas 61 de 61**; índice y carpeta casan (61 enlaces,
61 ficheros, 0 huérfanos). Clasificación: **14 universales** → al repo (este PR) · **15 ya estaban en el
repo** · **14 solo de esa máquina** (rutas, ids, traspasos) · **16 obsoletas o superadas** · **2 de proyecto,
no de equipo**. «Ya está en el repo» se comprobó con `git grep` sobre `origin/main`, frase por frase clave,
con control positivo.

### Qué cambia

| fichero | qué |
|---|---|
| `docs/equipo/orquestador.md` | **§0.0 nueva: la lista de comprobación de 10 casillas antes de CADA mensaje a un jefe** (la primera de todas), con un ejemplo que falla y el mismo corregido. **§4bis nueva: cómo entra una idea de un jefe** (6 pasos). §7: comprobar `MICROCOPY_BLOQUEADA` antes de firmar. §0, §10bis.14, §11bis y §12 al día para dos equipos y dos jefes |
| `docs/equipo/00-normas-comunes.md` | cabecera (una dueña para los dos equipos; el de Javier propone por Jira). **A13 reescrita: el ciclo del ticket** (abrir con etiqueta de equipo y de área, coger, soltar, cerrar, limpiar). **A23 nueva: cómo se escribe un guard**, 16 casillas. Añadidos en A1 (agentes en worktree fijado), A3 («no tengo X» se mide; BASE antes que mutantes), A4 (control del sufijo en su propio comando; push aparte tras `ls-remote`; cifra derivada regenerada), A6 (lista de antes de una suite completa; medir el ESTADO tras pulsar), A10 (6 frases), A14 (la hora sale de GitHub), A19 (dos equipos; los jefes), A21 (la familia de la operación que no se ejecutó) |
| `docs/equipo/dos-equipos.md` | **nuevo**: los dos jefes, los puestos de los dos equipos, **el mapa de dueños fichero a fichero sin ningún puesto repetido**, las etiquetas de Jira, cómo se coordinan dos orquestadores que no pueden hablarse, los recursos compartidos y las decisiones pendientes |
| `docs/equipo/trampas-del-entorno.md` | **nuevo**: las trampas de Windows, Git Bash, PowerShell 5.1, cmd, gh y git, que vivían en 7 notas de una sola máquina |
| `docs/equipo/prompt-tanda-orquestador.md` | **neutro**: UN solo prompt para los dos equipos; ya no manda leer memorias que solo existen en una máquina ni dice «asignado a Luis» |
| `docs/equipo/limites-del-fundador.md` | sección nueva «los límites de los DOS JEFES»; no se toca ni una línea de la «Delegación permanente» (la lee el oráculo de SCRUM-861) |

### Decisiones del orquestador que están escritas aquí (18-sep-2026, por el canal)

- Los 12 choques del mapa de ficheros (contenedores comunes con dueño y bloque marcado; A5 igual para los dos
  equipos; RGPD por sujeto; ci.yml y vigías de la S5, guards nuevos de J6, bancos de la S3; una sola dueña de
  las normas; `traspaso-javier.md`).
- A13 «asignado al JEFE del equipo que lo trabaja», no «a quien lo trabaja»: las sesiones no tienen cuenta de
  Jira.
- Los puestos J1-J6 (aprobados por el fundador ~12:30Z), y sus consecuencias en S0, S1 y S2.
- Las etiquetas `equipo-*` y `area-*`, y la metodología de tickets «como departamentos».

### Medido para escribirlo

- **Por contenido, donde el nombre engañaba:** `envioDelDocumento.ts` lo importan cobros, trabajos y facturas,
  **no** presupuestos → J1, no S1. Todo el RGPD que hay hoy en código (supresión, anonimizado, borrado,
  portabilidad) es **del MERCHANT** (SCRUM-244) → J3; la supresión del cliente final no existe.
  `switchFormaJuridica.js` es «este contacto es empresa o persona» → J2, no un ajuste fiscal.
  **`stripe.routes.ts` es UN webhook para pagos del cliente y para la suscripción a YaQu**: choque nuevo;
  decidido por el orquestador con la propuesta de la S0 (J2 dueño, J3 con su bloque marcado).
- **Jira:** las 14 etiquetas nuevas (`equipo-luis`, `equipo-javier`, `area-s0` … `area-j6`) están en **0**
  tickets; control: la misma consulta con `sesion-J1` da 10. Las etiquetas viejas `sesion-J1`, `sesion-J2`,
  `sesion-L1` … `sesion-L4` están en **22** tickets de agosto con otro significado, y NO se reutilizan.
- **Turno de staging:** es un advisory lock de Postgres (`scripts/_staging-lock.mjs:307`), así que vale entre
  máquinas.
- **Contra casos reales:** el censo de los 80 tickets abiertos que hizo el orquestador (18-sep ~11:58Z) casa
  cada ticket con un área. Sus cuatro huecos quedan escritos: infraestructura → S5 y canal de WhatsApp → J2
  (decididos por el orquestador), el ALTER → Javier como jefe, y la gestoría → pendiente. De ahí sale también
  el «estado desfasado» de A13 (774, 779 y 864 en «Acción del fundador» sin esperarle).
- **Los nombres de fichero que cita `dos-equipos.md` existen** (110 citados, sobre 3.260 del árbol): los únicos
  que no, son los ficheros nuevos y las plantillas (`puesto-jN.md`, `traspaso-javier.md`…), y un nombre falso
  de control sale marcado.
- **Instrumentos que leen estos ficheros (A12):** `scripts/_invocaciones-de-la-tanda.mjs` lee los bloques ```
  de `00-normas-comunes.md` (no se añade ninguno: su población no cambia) y el oráculo de microcopy lee
  `limites-del-fundador.md` («Delegación permanente», sin tocar). Tests que los leen, corridos sobre la rama:
  `scrum861`, `scrum850`, `scrum850b`, `scrum711` → **29 tests · 29 pass · 0 fail**, exit 0. Y los 9 que barren
  `docs/` entero (`scrum233`, `387`, `534b`, `637`, `705`, `753`, `775`, `810b` y el que importa
  `_documentos-a-la-espera.mjs`) → **88 tests · 88 pass · 0 fail · 0 saltados**, exit 0. `npm run guards:entrada`
  → **26 · 26 · 0**, exit 0.
- **Suite COMPLETA, con turno del orquestador**, en `wt-839f` (detached, `node_modules` propio), tras mergear
  `origin/main` = `34d06bb4f4e306b11745cf34fbbc85233c5a3299`: la primera pasada completa dio **7.669 tests ·
  7.554 pass · 4 fail · 111 saltados**. Tres de los fallos son de `scrum939b`, ya conocidos en main. **El cuarto
  era MÍO:** `scrum766` («ningún instrumento ni receta del árbol cuenta control con `grep`») cazó en
  `trampas-del-entorno.md` la receta mala citada LITERAL como ejemplo de trampa. Se arregló el texto (se describe
  sin escribir el comando y se apunta a `contarCR`), no el guard (regla 41). **Pasada final**, sobre
  `8a2ead51d5c5a4a636f60bdb6bef3bc88b4571c2`, 909 ficheros: **7.669 tests · 7.555 pass · 3 fail · 111 saltados**;
  los 3 son los de `scrum939b` (las skills, que este PR no toca).
- Bytes de control (A22) y CR en los 6 ficheros: **0 y 0**.

### Lo que NO se ha hecho, y por qué

- **Ningún guard nuevo.** El PR es solo de docs, como pedía el encargo. Las listas llevan su caso que falla
  escrito, pero **nada las comprueba solo**. Propuesta para después: un comprobador del mensaje al jefe
  (`¿termina en «Para ti»?`, `¿hay jerga en la prosa?`) con sus casos en rojo.
- **SCRUM-243:** su medición del 30-jul (403 lecturas, «196 filtran / 45 sin red») solo existe en la memoria de
  la máquina de Luis; no hay `docs/master/SCRUM-243.md`. **Pendiente**, sin abrir frente (orden del orquestador).
- **Las fichas de los puestos J1-J6** no se escriben aquí: cada puesto escribe la suya en su primera tanda.
- `CLAUDE.md` y `.claude/**` no se tocan (derivados del máster, regla 35).

### Errores propios

- En el primer mensaje de choques di una **población de 327 ficheros sin contarla**. Contada, eran 405. Lo
  corregí en el mensaje siguiente; los choques no cambiaban.
- Escribí «21 tickets» con las etiquetas viejas; contados en Jira eran **22**. Corregido antes del commit.
- Un comando de PowerShell con `'\]\('` lo paró el hook; no se ejecutó nada. Rehecho con un `.mjs`.
- **Mi censo de «qué tests leen estos ficheros» no vio `scrum766`**: busqué por nombre de fichero y por
  `readdirSync` de `docs`, y ese guard barre el árbol por otro camino. Lo cazó la suite completa, que es
  exactamente para lo que la pide la A6.
- **La primera suite no llegó a ejecutarse y la tarea dijo «exit 0»:** pasé 909 ficheros por la línea de
  órdenes y Windows la rechazó por larga. Sin TAP y sin recuentos no hay verde. Relanzada con el glob que
  expande node (`'tests/*.test.mjs'`), igual que `npm test`. Es la familia de la A21, en mi propia mano.

## SCRUM-951d · el ENSAYO de la instalación, antes de que la haga Javier

**Medido contra:** `origin/main` = `d44f4faf0061f2f861ebc4888a2a12a2adacbe41` · 2026-09-18T13:07:33Z

Sesión 5. La guía `docs/equipo/instalacion-maquina-nueva.md` (951a, #1512, merge `d44f4faf`) no se había seguido nunca
en ninguna máquina. Se siguió al pie de la letra, «como Javier», en la de Luis: Git Bash (`bin/bash.exe -l`), clon
NUEVO de GitHub, `claude.exe` real (2.1.276), prefijo `ensayo-`, puestos `jefe,prueba`, una tanda `03:17` que no se
programó. `REPO` e `INST` en el scratch del job, nunca en `%LOCALAPPDATA%\yaqu-equipo` (la real). Sin tareas
programadas, sin tocar settings y UNA sola sesión de prueba. Horas de GitHub salvo donde se diga.

### Paso a paso

| paso | resultado | lo medido |
|---|---|---|
| 0 · requisitos | hizo lo que dice, **menos el disco** | git 2.51, node v24.8.0, claude 2.1.276, `gh auth status` «Logged in», `ls-remote` da SHA. `Get-PSDrive` → «command not found» (es de PowerShell, en una guía «todo Git Bash»); `df -h C:` también falla; `df -h /c` sí |
| 1 · clonar + `npm ci` | hizo lo que dice | 76 s en total, 564 MB. El clon se hizo a las ~12:51Z sobre `b2c82c71` (antes del merge de #1512) y se puso al día con `git pull --ff-only` a `d44f4faf`: mismo `package-lock` |
| 2 · abrir Claude Code una vez | **no se pudo probar aquí** la parte interactiva (sesión de fondo) | se hizo el `mkdir -p` de `memory` con la ruta EXACTA del `motivo` del paso 3. Medido además: 5 de 5 carpetas de proyecto de `~/.claude/projects` sin memorias escritas NO tienen `memory` → el `mkdir` es el camino normal, no la excepción |
| 3 · instalar | hizo lo que dice | antes del paso 2: `NO-INSTALADO` con la ruta de `memory` y **nada escrito** (`ls INST` no existe). Después: `INSTALADO`; las 4 copias, idénticas a `origin/main` por `cmp`; `arranque.cmd` entra en el repo, copia y lanza |
| 4 · statusLine | no se pudo probar aquí (settings) | `uso.mjs leer` dio **0 VERDE** con el `uso.json` de la MÁQUINA (`%LOCALAPPDATA%\yaqu-equipo`), no «2 antes» como dice la guía: `uso.mjs` no guarda junto a `INST` |
| 5 · tareas | no se pudo probar aquí (tareas prohibidas); solo `/query` | `schtasks /query` sin `MSYS_NO_PATHCONV=1` → «Argumento u opción no válido - "D:/Program files D/Git/query"»; con él, «no encuentra» (control positivo: `/query` lista las tareas que existen). «Desinstalar» mandaba `schtasks /delete` sin la variable |
| 6 · permisos | no se pudo probar aquí (settings) | el lanzamiento del 7.2 pasó sin la regla, con los permisos de la sesión que lanzaba: no prueba nada para una máquina nueva |
| 7.1 · comprobar | **dio un verde que no lo era** | «OK · 14 comprobaciones, exit 0», con el «aviso de uso» OK por el `uso.json` de otra instalación… y la sesión del 7.2 se bloqueó igual |
| 7.2 · sesión que contesta | **no lo hizo** | `lanzar ensayo-prueba` → `LANZADA` con `sessionId` completo; `estado` la vio `working` y a los ~75 s `blocked`; el mensaje no llegó; `ListAgents` no la listaba; sin jsonl. Su `~/.claude/jobs/<id>/state.json`: `"needs": "approve 1 new project MCP server (playwright) — attach to respond"`. `parar` → `PARADA`, `stop` 0, `rm` 0, `estado` vacío y su carpeta de job borrada |
| 7.3 · primera tanda | no se pudo probar aquí | arranca al orquestador de verdad (lo dice la propia guía) |

### El hallazgo: un clon nuevo bloquea toda sesión de fondo

`.mcp.json` (en el repo) declara `playwright`. Claude Code pide aprobar cada servidor MCP de proyecto, y en segundo
plano nadie contesta: la sesión se queda `blocked` antes de su primer turno. El checkout de Luis no lo sufre porque
su `.claude/settings.local.json` lleva `disabledMcpjsonServers: ["playwright"]`, pero como **modificación local sin
commitear**: medido con `git show origin/main:.claude/settings.local.json` (solo `permissions`) y
`git diff HEAD -- .claude/settings.local.json` en el checkout. Ningún clon lo hereda. En la máquina de Javier, el
orquestador de la PRIMERA tanda se habría quedado ahí, sin decir nada a nadie.

### Qué cambia

- `scripts/equipo/comprobar-instalacion.mjs`:
  - comprobación nueva **«MCP del proyecto»** (`juzgarMcp`): cada servidor de `.mcp.json` tiene que estar decidido
    —`enabledMcpjsonServers`, `disabledMcpjsonServers` o `enableAllProjectMcpServers`— en los settings del repo, en
    los del usuario o en la entrada del proyecto de `~/.claude.json`. Sin decidir = `FALLA`; un fichero ilegible =
    `NO-PUDE-MIRAR`. Sobre datos reales: el clon del ensayo da **FALLA** y el checkout de Luis, **OK**;
  - **«aviso de uso»** (`juzgarUso`): un VERDE leído de un `uso.json` fuera de `destino` pasa a `AVISO` y dice qué
    fichero leyó. Para `INST` en su sitio no cambia nada;
  - `schtasks` que no llega a arrancar (`status null`) es `NO-PUDE-MIRAR`, no «no está creada».
- `docs/equipo/instalacion-maquina-nueva.md`: los dos diálogos del paso 2 (el MCP, con el porqué medido), `df -h /c`
  en el paso 0, dónde vive `uso.json` (paso 4), qué dice la 7.1 ahora, cómo se ve una sesión bloqueada (7.2),
  `MSYS_NO_PATHCONV=1` en «Desinstalar», y lo que el ensayo NO pudo probar.
- `tests/scrum951d-ensayo-instalacion.test.mjs` (8 tests, funciones puras sobre un temporal: no lee la máquina).
  Mutantes 5 de 5 caen, con base verde (`docs/master/evidencias/scrum951d/salida-mutar.txt`).

### Lo que NO se ha hecho, y por qué

- **No se ha decidido el MCP en el repo.** Commitear `disabledMcpjsonServers: ["playwright"]` en `.claude/` quitaría
  el bloqueo en TODO clon sin que nadie tenga que acordarse, pero `.claude/*` y los settings son del fundador
  (regla 35; normas de esta tanda). Queda propuesto.
- No se ha medido dónde guarda Claude Code la decisión al contestar el diálogo ni si la confianza de carpeta
  bloquea también en fondo (ver «Lo que esta guía NO ha medido»).

### El ensayo, deshecho

Sesión `ensayo-prueba` parada y borrada con la propia puerta. Carpeta del ensayo (`REPO` + `INST`) y la
`memory` creada a mano, borradas. Queda UNA huella que no se tocó a propósito: la entrada de la ruta del clon del
ensayo en `~/.claude.json` (la escribió Claude Code al lanzar la sesión; editar ese fichero con siete sesiones vivas
escribiéndolo es más arriesgado que la entrada, que no apunta a nada).

### Errores propios

- **A22 en mi mano:** escribí `\uFEFF` en una regex de `comprobar-instalacion.mjs` y aterrizó como el carácter BOM
  literal, invisible. Lo cazó un recuento (1 carácter U+FEFF), no la lectura. Rehecho con `charCodeAt(0) === 0xfeff`.
- La primera orden del paso 0 la paró un hook: un here-string de PowerShell con `"C:/Program Files/…"` dentro se
  leyó como un borrado de una ruta de sistema. No se ejecutó nada; rehecho con ficheros `.sh`.
## SCRUM-951c · Las fichas del equipo de Javier

**Medido contra:** `origin/main` = `b2c82c7137c87782242188829442895bc6269ba3` · 2026-09-18T12:46:50Z
**Rama:** `scrum-951c-fichas-javier` · **Carril:** consultoría (Sesión 0, un relevo que no vio 951b), dueña de `00-normas-comunes.md`, `dos-equipos.md` y `trampas-del-entorno.md` · **Encargo:** orquestador, 18-sep-2026
**Solo docs.** El índice de lo que se iba a escribir se entregó al orquestador ANTES de escribirlo, y lo aprobó
(12:52Z) con una corrección: SCRUM-789 y SCRUM-863 son de infraestructura (S5), no de J1.

⏱ Horas de GitHub (cabecera `Date:` de `gh api -i zen`).

### Por qué

Javier tiene que arrancar su equipo **sin haber visto nada**: su Claude no tiene la memoria de la máquina de
Luis ni el historial de este chat. `dos-equipos.md` decía que cada puesto escribiría su ficha en su primera
tanda; un puesto que arranca sin ficha no sabe qué es suyo, qué no toca ni por dónde empieza. Por eso las
escribe la S0, y desde ahí son de cada puesto.

### Qué cambia

| fichero | qué |
|---|---|
| `docs/equipo/puesto-j1.md` … `puesto-j6.md` | **nuevos**: la pregunta del puesto, su área, sus ficheros (con sus bloques en contenedores ajenos), lo que NO toca, sus STOP y **sus primeros tickets medidos en Jira**, con el primero señalado; lo que está En curso en el equipo de Luis va aparte, «no se toca hoy» |
| `docs/equipo/orquestador-javier.md` | **nuevo**: SOLO lo que cambia respecto a `orquestador.md`. Lo primero al arrancar: buscar en Jira `equipo-javier` + `decision-jefe` y presentárselo a Javier, con su suelo (hoy devuelve 1: SCRUM-612); después, etiquetar su zona |
| `docs/equipo/dos-equipos.md` | los nombres del equipo de Javier (`jv-` + `orquestador,j1…j6`, casados con 951a por la S5); quién escribió las fichas y de quién son; fila de `orquestador-javier.md`; ⚠️ **los puestos J1-J6 no son las secciones J1-J7 del máster** |
| `docs/equipo/00-normas-comunes.md` | **A19: la COMPROBACIÓN al entregar** (medir el contexto, decirlo en el informe, >300k → traspaso; >500k a mitad → punto seguro y relevo), con su caso que falla; A8: el informe de entrega dice siempre el contexto |
| `docs/equipo/trampas-del-entorno.md` | §7: la suite con la lista de ficheros expandida por el shell no corre nada y dice exit 0 |
| `docs/equipo/prompt-tanda-orquestador.md` | el paso 1 manda leer la ficha propia del orquestador si su equipo la tiene |

### Medido para escribirlo

- **Nombres:** `scripts/equipo/sesion.mjs` de la rama de 951a (`926001a4`, sin mergear): el equipo sale de
  `config.json` (prefijo + puestos), y `rutaDelTraspaso` quita el prefijo. La S5 confirmó por el canal
  (18-sep) que `jv-` + `orquestador,j1,…,j6` casa con su validación (`[a-z0-9][a-z0-9-]{0,31}`, sin repetir, el
  orquestador entre los puestos).
- **Jira, 18-sep ~12:40Z:** estado de los 42 tickets de la zona de Javier que daba el censo del orquestador
  (11:58Z, sobre `e76580b1`), releídos uno a uno. **3 ya Finalizada** (SCRUM-16, 540 y 891). Quedan **20
  propios** (J1 10 · J2 3 + 893 · J3 2 + 809 y 904 · J5 906 · J6 908; 4 de ellos En curso en el equipo de Luis)
  y **18 de decisión de un jefe** (J1 6 · J2 6 · J3 3 · J4 3), una vez quitados 789 y 863 (infraestructura, S5).
  El «15» del encargo contaba solo los de decisión de jefe; lo confirmó el orquestador.
- **Etiquetas:** `labels = equipo-javier OR labels = decision-jefe OR labels in (area-j1 … area-j6)` devuelve
  **1** ticket, SCRUM-612. Es el suelo que la ficha del orquestador le da a su búsqueda de arranque.
- **Choque de nombres:** en `docs/YAQU_MASTER.md` las secciones `## J1.` … `## J7.` son la Parte J (WhatsApp) y
  «J6» es el anti-spam (regla 28), que `CLAUDE.md` cita como «Anti-spam J6». Por eso el aviso va en
  `dos-equipos.md` y en las fichas de J2 y J6.
- **Rutas citadas en las fichas:** comprobadas en el árbol (`docs/SIF_SPEC_NOTES.md`, las skills,
  `docs/competencia/matriz.md`, `docs/legal/PREGUNTAS_ASESOR.md`, `docs/ERRORES_ASESOR.md`,
  `tests/scrum302-rotulos-completos.test.mjs`, `docs/master/SCRUM-825.md`, `SCRUM-524.md`, `SCRUM-328.md`,
  `docs/SPRINT_DEMO_READY_EXT.md`…). Las que no existen y se nombran a propósito son las que crean otros:
  `afirmaciones-verificadas-javier.md` (J6) y `traspaso-javier.md` (su orquestador), igual que en 951b.
- **Tests que leen docs**, sueltos sobre la rama (TAP a un fichero fuera del árbol): de 20 ficheros, **11
  corrieron: 101 tests · 101 pass · 0 fail**; **9 no arrancaron** porque este worktree no tiene
  `node_modules` (`Cannot find package 'typescript'`). Esos 9 no son rojos: son un instrumento que no arrancó, y
  los cubre la suite completa de abajo.
- **Suite COMPLETA, con turno del orquestador** (13:03Z), en `wt-839f` en detached (`node_modules` propio), sobre
  `877a7d035aa2af06955a9abb150eb954c3eb0cd9` = esta rama con `origin/main` =
  `3b53c92fbc278fbe2c66e0b42300860fa21ed6f2` mergeado (ya con 951a). Memoria medida aparte: 6.522 MB libres. Build
  con salida 0; `FORCE_COLOR` ausente comprobado en el mismo comando; el patrón `'tests/*.test.mjs'` entre comillas
  simples: **7.707 tests · 7.593 pass · 3 fail · 111 saltados**, y el TAP trae su `# tests 7707`. Los 3 son de
  `scrum939b` (las skills, que este PR no toca). Los 9 ficheros de docs que no arrancaron arriba corrieron aquí
  sin un fallo (`scrum387` ×2, `705` ×2, `711`, `753`, `775`, `810b`, `850`, `850b`, comprobados por nombre en el
  TAP). `npm run guards:entrada` → **26 · 26 · 0**, salida 0.
- **El merge de 951a** entró sin conflicto de git, pero dejó `docs/master/SCRUM-951.md` con DOS títulos de primer
  nivel (951a creó el fichero con el suyo; `origin/main` ya los traía así). Se quitó el segundo; las tres
  secciones (951a, 951b, 951c) siguen enteras. Un merge sin conflictos no es un merge correcto (A4).
- **Nombres, contra lo que ya está en `main`:** la guía nueva de 951a (`instalacion-maquina-nueva.md`) deja los
  puestos como variable y usa `jv-jefe` como EJEMPLO de nombre; `dos-equipos.md` fija ahora los valores del
  equipo de Javier (`jv-orquestador`, `jv-j1` … `jv-j6`), y manda la configuración si declara otros.

### Lo que NO se ha hecho, y por qué

- **Ningún ticket tocado en Jira.** Etiquetar la zona de Javier es del orquestador (A13); la ficha de su
  orquestador se lo pone como primer trabajo.
- **La firma de Holded** (cola de la S0, para J5) sigue pendiente: va después de este PR.
- `orquestador.md` y `limites-del-fundador.md` no se tocan: son del orquestador de Luis.

### Errores propios

- El traspaso que heredé ponía «~13:35Z (hora de GitHub)» y GitHub daba 12:35Z: una hora de más. Lo avisé al
  orquestador en la primera línea; la S5 me mandó otra hora igual de adelantada (13:55Z a las ~12:45Z).
- En la ficha de J2 escribí «regla 36» para el coste nuevo, copiándolo del censo; la regla 36 del máster es la
  de plugins y skills de terceros (`limites-del-fundador.md` lo avisa). Corregido a A7 antes del commit.
- Conté «17 más» por etiquetar en la ficha del orquestador; recontados eran **16** (se me había colado SCRUM-328,
  que está En curso en el equipo de Luis y no se re-etiqueta). Corregido antes del commit.

## SCRUM-951e · La nota de navegador

Commit `5330af5203b8adeeaebc75271cd4800bd1a49140`, 18-sep-2026 13:46:10Z (cabecera `Date:` de `gh api -i zen`).
Sesión 5.

- `docs/equipo/instalacion-maquina-nueva.md`: sección «Navegador». Las mediciones usan Edge con `puppeteer-core`
  (`scripts/_navegador.mjs`, lo instala `npm ci`); el MCP `playwright` de `.mcp.json` no hace falta y se deja
  desactivado porque bloquea las sesiones de fondo; la librería Playwright solo para recorrer la competencia
  (J5 / S0), con `npx -y playwright install chromium` y un script del scratchpad; contraseñas nunca al chat ni al repo.
- `docs/equipo/puesto-j5.md`: una línea que remite a esa sección.
- Comprobado antes de escribir: `puppeteer-core` está en `package.json` y `playwright` no; `.mcp.json` declara el
  servidor `playwright` (`@playwright/mcp`).

## SCRUM-951f · `BLOCKED` no es «atascado»: tres casos con una misma palabra (16-oct-2026)

**Medido contra:** `origin/main` = `665bcd17ff7fe0f63959b300bda92cdc6bf448c7` · 2026-10-16T12:09:57Z

Puesto S0. **Encargo del orquestador de Luis:** escribir en `trampas-del-entorno.md` lo que él midió ese día. `BLOCKED`, con `mergeable=MERGEABLE` y el obligatorio con la conclusión vacía, es un obligatorio que no ha terminado. El caso raro, el de #2449 (obligatorio verde y `BLOCKED`), sigue sin explicar. Y además va su propia corrección: cerró ese caso con una causa que sólo explicaba un suceso posterior.

| Qué | Dónde |
|---|---|
| La trampa, con sus tres casos, la receta de `merge-tree` y la corrección del orquestador | `docs/equipo/trampas-del-entorno.md` §5 |
| La lección, en una línea | `docs/equipo/00-normas-siempre.md` A10 |

**Medido por la S0 para escribirla:**

| PR | `mergeStateStatus` | `mergeable` | obligatorio | caso |
|---|---|---|---|---|
| #2506, #2508, #2511, #2512, #2513 (11:50Z) | `BLOCKED` | `MERGEABLE` | `QUEUED` / `IN_PROGRESS`, conclusión vacía | ① no ha terminado |
| #2505 (11:50Z) | `BLOCKED` | `MERGEABLE` | `FAILURE` (11:32:34Z) | ② falló: 1 de 11.634, `SCRUM-1405c · ④`, con `FATAL ERROR: Reached heap limit` en el mismo log; el diff son 2 `.md` |
| #2510 (11:50Z) | `UNSTABLE` | `MERGEABLE` | `SUCCESS` | ni ①, ni ②, ni ③: el obligatorio está verde y quedan checks informativos en curso. Entró en `main` minutos después |

El caso ③ no se pudo volver a medir. `statusCheckRollup` de #2449 ya sólo trae el último run (verde, de 11:09Z a 11:21Z del 16-oct), y el PR entró a las 11:23:03Z. **El dato de las 15:35Z del 15-oct es del orquestador, no mío.**

**`merge-tree`, con sus dos controles:** en un repositorio desechable, un conflicto fabricado en `a.txt` da exit **1** y nombra `a.txt`. `origin/main` contra la punta de #2512 da exit **0** y sólo el árbol. Con `git version 2.51.0.windows.1`.

**De quién es lo que no se toca aquí:** `causaDelAtasco` (`scripts/vigia-atascados.mjs`) devuelve `ESPERANDO` para todo `BLOCKED` sin rojo, y eso incluye el caso ③. El fichero es de S5 (`dos-equipos.md` §3, la fila de los 16 scripts del bucle PR → CI): se nombra y se le pasa al orquestador.

**Error propio.** Mi primer filtro buscaba el obligatorio por el nombre exacto `build + tests` y dio **n=0 en los siete PR**. Eso se leía igual que «el obligatorio no ha arrancado» en todos. El nombre real es `build + tests (con banco desechable)`, y salió al listar los checks de un PR: el control positivo que tendría que haber ido primero.

A9: aviso → A10 «Una causa que encaja con lo último que viste no está cerrada hasta que explica también lo primero.» — no se pudo comprobar: cerrar una causa es un juicio, no un comando; lo que sí se puede es nombrar el caso que no explica, y eso va en la tabla de §5

## SCRUM-951g · Una rama empujada VACÍA: `-F -` con here-string en PowerShell 5.1 (16-oct-2026)

**Medido contra:** `origin/main` = `0dbc92f240a91fbe9e35fd2d3830c53bb12cddc4` · 2026-10-16T12:35:09Z

Puesto S0. **La trampa la midió y la mandó S1** por `SendMessage`, a las ~12:20Z, por indicación del orquestador. Su caso fue `scrum-1558-sin-proveedor-no-es-envio`: el primer push dejó la rama en `665bcd17`, la punta de `main`, y el bueno llegó después, `d7698912`. La S0 la escribe en `trampas-del-entorno.md` §2 (PowerShell 5.1).

| Qué | Dónde |
|---|---|
| Síntoma, causa, cura y control | `docs/equipo/trampas-del-entorno.md` §2, la última fila |

**PASO 0, reproducido por la S0 antes de escribirla.** En un repositorio desechable, con un fichero nuevo en el índice, `git commit -q -F - @'<salto>mensaje de prueba<salto>'@` da `error: pathspec 'mensaje de prueba' did not match any file(s) known to git` y **exit 1**. El HEAD no cambia y el fichero se queda en el índice (`A  b.txt`). El push encadenado no lo reproduje: con el commit fallido no hay nada que enseñar, y el resto del mecanismo (`;` no para) ya está en §1 y en A4.

A9: aviso → A10 «Una operación que no se ejecutó se lee exactamente igual que un éxito.» — no se pudo comprobar: el commit y el push los escribe cada sesión en su shell, y no hay hook de la casa que vea un `;` entre los dos

## SCRUM-951h · Staging corre con `NODE_ENV=production`: una prueba allí vale como prueba de PRODUCCIÓN (17-oct-2026)

**Medido contra:** `origin/main` = `78a1af2506c053c460eeca9b458026060cf83829` · 2026-10-17T19:34:54Z

Puesto S0. **La trampa la midió S1** (~12:50Z del 16-oct) y la S0 la repitió antes de escribirla. Quedó commiteada el 16-oct y sin empujar a propósito: 951g y 951h escriben al final de este mismo registro, y se esperó a que #2525 (951g) entrase en `main` (12:59:23Z del 16-oct). La rama se ha mezclado con `main` (A15) antes de añadir este tramo.

| Qué | Dónde |
|---|---|
| Qué cambia en staging por correr como producción, lo que eso implica (un arranque abortado allí es el fallo de SCRUM-1122, R22) y la sonda por GET | `docs/equipo/trampas-del-entorno.md` §12 |

**La sonda, y por qué discrimina.** `GET /outbox`, sin barra final y sin seguir redirecciones. El estático sólo se monta fuera de producción (`src/app.ts:187`) y el directorio se crea siempre (`src/core/storage/dirs.ts:23`), así que **301 = desarrollo · 404 = producción**. Control positivo, de S1: la app de `dist/` en local da 301 con `NODE_ENV=development` y 404 con `production`.

| Cuándo | staging (`yaqu-staging-production.up.railway.app`) | `yaqu.app` | versión en `/health` | quién |
|---|---|---|---|---|
| 16-oct ~12:50Z | 404 | 404 | `665bcd17` | S1 |
| 16-oct ~12:55Z | 404 | 404 | `0dbc92f2` | S0 |
| 17-oct 19:34Z | 404 | 404 | `78a1af25` (= el ancla) | S0 |

**No medido:** qué variables tiene staging (Resend, SMTP, `LOG_MAGIC_LINKS`). Ninguna sesión las puede leer, y §12 lo dice.

A9: sin fallo que generalice — el tramo escribe una medición de S1; lo que tenía de error (empujar antes de que entrase 951g y chocar en este fichero) se evitó esperando, y la regla de esperar ya es A15

## SCRUM-951i · El encabezado de un tramo del registro: dos requisitos, dos guards, y `guards:entrada` sólo mira uno (17-oct-2026)

**Medido contra:** `origin/main` = `78a1af2506c053c460eeca9b458026060cf83829` · 2026-10-17T19:39:05Z

Puesto S0. **Encargo del orquestador:** escribir la trampa que el 16-oct tumbó a S4 y a S3 con `scrum267` (la premisa era cierta sólo a medias: ver «Corrección» abajo): cuál es la forma exacta, qué tres fallos da y qué significa cada uno. Y con la lectura dentro: cuando dos personas se equivocan igual el mismo día, falta una herramienta. Rama apilada sobre `scrum-951h-staging-es-produccion`, porque las dos escriben al final de este registro y de `trampas-del-entorno.md`.

| Qué | Dónde |
|---|---|
| Los dos requisitos y sus dos guards (el ancla, `scrum267`; la línea `A9:`, `scrum1294`); la forma del ancla, el comando que la genera y sus cuatro motivos; los tres rojos de un ancla mala; que nadie genera la A9 y que `guards:entrada` no la mira; cómo se cuentan los defectos | `docs/equipo/trampas-del-entorno.md` §13 |
| La lección, en una línea | `docs/equipo/00-normas-siempre.md` A10 |

**PASO 0: la herramienta ya existía.** `scripts/equipo/ancla.mjs` es de SCRUM-1152 (26-sep), y el mensaje del propio rojo de `scrum267` lo nombra. El orquestador le había pedido a S5 «un comando que la genere». Se lo dije por `SendMessage` antes de escribir nada, y lo cambió: S5 hace que `ancla.mjs` se use solo, no construye otro.

**Reproducido antes de escribirla.** En `s0-829c`, una entrada temporal `docs/master/SCRUM-99991.md` y sólo `node --test tests/scrum267-ancla-de-medicion.test.mjs`. Borrada después: `git status` limpio.

| entrada temporal | pasa / falla | el primer rojo dice |
|---|---|---|
| el ancla de `ancla.mjs` (control positivo) | 14 / 0 | — |
| la forma de S3, la de `d062c61a` antes de `6ff67998` | 11 / 3 | `no declara «Medido contra»` |
| la forma de S4 (`= producción =` delante del sha) | 11 / 3 | `el ancla no tiene la forma esperada` |

En los dos casos los tres rojos son los mismos: «declara contra qué main…», «LAS EXENTAS SON EXACTAMENTE ÉSTAS» y «los números CUADRAN». `spec` los imprime dos veces, así que salen seis líneas por un solo error.

**Corrección: el rojo de #2528 NO era el ancla.** La primera versión de este tramo (`e4126577`) decía que «los seis fallos de #2528 eran uno» de `scrum267`. Lo tomé de la premisa del encargo. Lo afinó S3 midiendo el último job, y lo comprobé en el log: el run `38905690014` (sobre `6ff67998`) tiene `scrum267` en verde, y lo que cae es `SCRUM-1294` con `docs/master/SCRUM-1559.md:5 · ancla del 2026-10-16 sin línea «A9:»`. El ancla de S3 la arregló `6ff67998` antes de que terminara ningún CI. El run anterior, sobre `d062c61a`, quedó cancelado. Según S3 y el orquestador, la A9 también tumbó a S2 en #2521. No lo he visto en un log: el CI rojo de #2521 que miré (`38901732782`) era de un guard de navegador.

**La otra mitad, medida.** Una entrada temporal con el ancla buena y sin línea `A9:`:

| comando | resultado |
|---|---|
| `node --test` de `scrum1294` + `scrum267` | 17 / 1: cae `SCRUM-1294` y `SCRUM-267` pasa entero |
| `npm run guards:entrada` | «✓ 14 guards de entrada en verde… La entrada puede empujarse», exit 0 |

`scripts/guards-entrada.mjs` no incluye `scrum1294`. El comando que existe para no enterarse por el CI da luz verde a lo que el CI rechaza, y ésa es la mitad que cayó dos veces. No lo toco: se le pasó por `SendMessage` a S5, que tiene la otra mitad por encargo del orquestador. Lo arregló en #2538 (SCRUM-1152b, abierto a las ~20Z): `scrum1294` entra en `guards:entrada` (15 guards) y la plantilla del registro trae la línea `A9:`. La §13 no afirma que esté en `main`: le dice a quien la lea cómo saber si su árbol lo trae (15 guards o 14).

**Corrección a una cifra.** El orquestador propuso apuntar «divide entre seis». No lo he escrito así porque no es cierto con dos entradas mal: caen los mismos tres tests y salen las mismas seis líneas. El número de defectos es el de entradas que lista el primer rojo de cada guard.

**No medido.** La línea exacta de S4: lo cazó antes del CI y no está en el historial. La reproduje con la forma que describió el orquestador.

A9: aviso → A10 «Cuando dos personas distintas se equivocan igual el mismo día, no falta cuidado: falta una herramienta, o que la que ya existe sea el camino por defecto.» — no se pudo comprobar: el ancla mala la caza `scrum267`, y la A9 que falta, `scrum1294`; lo que ningún guard ve es si el ancla se escribió a mano. Hacer de `ancla.mjs` el camino por defecto y meter `scrum1294` en `guards:entrada` es de S5
A9: aviso → cicatriz S0 «Expliqué un rojo de CI con la premisa del encargo sin leer qué test había caído» — no se pudo comprobar: leer el nombre del test antes de explicar un rojo es una conducta, y ningún guard ve la explicación que se escribe sin leerlo

## SCRUM-951j · Un banco que busca un nodo por su clase EXACTA se queda CIEGO si le añades otra clase (18-oct-2026)

**Medido contra:** `origin/main` = `214283d7958a13b0280e2b64ac041856ad275cf2` · 2026-10-18T18:55:56Z

A9: comprobación → `tests/scrum1562c-partes-oficina-con-teclado.test.mjs`

Trampa §14 de `docs/equipo/trampas-del-entorno.md`. La reportó la S2 tras el rojo de #2560 y llevaba en el traspaso de la S0 desde la tarde del 18-oct, sin escribir. Se escribe con lo medido, no con lo recordado.

| qué | dónde se mide | resultado |
|---|---|---|
| el cambio que la disparó | `git show a92f741e -- public/dashboard/js/parteOficinaView.js` | `fila.className = 'customers-card parte-oficina-fila'` |
| cómo localiza el banco | `tests/scrum1285-guardado-en-vuelo.test.mjs:90` | `n.className === 'customers-card'`, igualdad exacta |
| el rojo | run `39084375339` (sobre `f096b8f2`), `gh run view --log-failed` | los 4 casos de «oficina» de SCRUM-1285, con `🔴 CIEGO: no sale el parte en la lista` |
| el arreglo | commit `0a103940`; `styles.css:2487-2488` en `main` | la fila vuelve a `customers-card` a secas; el CSS cuelga de `#po-lista > button.customers-card` |
| el verde | run `39147335140` (sobre `0a103940`) | ninguna línea roja en el obligatorio |
| cuántos bancos tienen la forma | `git grep -c "className === '" origin/main -- tests/` sobre `74e60ebe` | 49 apariciones en 26 ficheros, sin clasificar; control: sale `scrum1285:90` |

**No medido por S0:** la mutación de la clase doble. La hizo la S2 (`0a103940`) y la confirma el log del CI; repetirla es tocar `public/`.

La comprobación de la línea A9 es el test de la S2, que exige la clase exacta y cae en su propio fichero si alguien vuelve a añadir una segunda.
## SCRUM-951k · `FATAL ERROR: Reached heap limit` en el log de la tanda es de un test que lo hace a propósito (18-oct-2026)

**Medido contra:** `origin/main` = `214283d7958a13b0280e2b64ac041856ad275cf2` · 2026-10-18T18:59:35Z

Puesto S5. **Encargo del orquestador:** medir el «OOM» que tumbó el #2568 (el arreglo del `Cache-Control` de los CSV). Medido, no hay ningún OOM. Después, por decisión suya, la trampa entra en `trampas-del-entorno.md` para que la próxima sesión que lea ese log no muerda igual.

| Qué | Dónde |
|---|---|
| El síntoma, la causa, cómo se distingue en 30 s, la regla del resumen final y el caso del #2568 | `docs/equipo/trampas-del-entorno.md` §15 |

**Medido** en la run `39151663342`, intento 1, job `117746392988`:

| pregunta | respuesta |
|---|---|
| ¿Quién escribe el FATAL de las 17:57:27Z? | `tests/scrum1525b-el-respaldo-por-correo.test.mjs`, el test del hijo que «muere por MEMORIA». Lanza un hijo con `--max-old-space-size=24`, y `lanzarVolcado` copia su stderr en el del padre. La línea siguiente del log es su ✔ |
| ¿Sale también en verde? | Sí: run `38524399363` (`main`, 14-oct-2026), con `ℹ fail 0` y la misma línea |
| ¿Murió la tanda? | No. Cerró a las 18:04:52Z con `tests 11826 · pass 11718 · fail 19 · skipped 89` |
| ¿Cabe la tanda en el runner? | El job del trinquete de la misma run (`117746393184`) la corrió entera dos veces y salió `success` |
| ¿Qué la tumbó? | 19 rojos, todos del diff del PR. El `SCRUM-231.md` del PR le dio ancla a una entrada que el censo tenía sin ella: caen `scrum267`, `scrum859` y `scrum976`④. El test nuevo cae en dos censos: `scrum1344`⑦ (un router de /admin sin req de sesión) y `scrum1415` (un `test()` con nombre construido). El CIEGO del meta-guard en `scrum859` tiene la misma causa |

Los arreglos del PR los lleva S1, que es la dueña de la rama. El `eco:false` en `lanzarVolcado`, que quitaría el ruido del log, lo lleva el orquestador a J6. No he tocado ninguno de los dos.

A9: aviso → cicatriz S0 «Expliqué un rojo de CI con la premisa del encargo sin leer qué test había caído» — no se pudo comprobar: el encargo traía la causa («OOM») y ningún guard ve que una explicación se apoya en una línea del log y no en el resumen ni en los nombres de los tests caídos; por eso la regla va escrita en `trampas-del-entorno.md` §15
