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
# SCRUM-951 · El sistema del equipo, montado para dos equipos (Luis y Javier)

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
