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

### Lo que NO se ha hecho

- **Ninguna instalación real**, ni en la máquina de Luis ni en la de Javier. Todo está probado en bancos (repositorio
  de prueba con `origin/main`, `claude` falso con estado). No se ha llamado al `claude` de verdad desde la S5: el
  clasificador lo frena (`orquestador-autonomo.md` §7).
- 7.2 de la guía (una sesión que contesta por el canal) no se puede automatizar: `SendMessage` no existe fuera de
  Claude Code.
- La memoria que lee el prompt de la tanda y lo que dice sobre Jira son de la S0 (951b).

**Tests declarados:** `tests/scrum951a-equipo-configurable.test.mjs`
