# SCRUM-1000 · El arranque automático de sesiones — qué existe, qué faltaba, qué se monta

**Sesión:** jv-j6 · **Carril:** `scripts/` (nuevo, fuera de `scripts/equipo/`) · **Medido contra:**
`origin/main` = `62176956c35ea69eca18ba38567656965907bcf0` · 2026-09-23T08:15:19Z (hora de GitHub)

## El encargo, en una línea

Javier midió cuatro sesiones paradas 8+ horas sin que nadie se enterara y pidió portar el arranque
automático «ya construido y probado en el equipo de Luis» — medido primero, montado después, y
**provocado** antes de darlo por hecho.

## 1 · Lo que existe HOY, medido corriendo (no leyendo)

`scripts/equipo/` es COMPARTIDO por los dos equipos (mismo fichero, mismo repo): lo que tiene el
equipo de Luis lo tiene el de Javier, byte a byte. Tres piezas, con su alcance real:

| pieza | dónde | qué hace | qué NO hace |
|---|---|---|---|
| **A · relanzar el ORQUESTADOR** | `schtasks` (Windows) → `arranque.cmd` → `scripts/equipo/orquestador-arranque.mjs` → `sesion.mjs lanzar <prefijo><orquestador>` | 3×/día releva SOLO el puesto `orquestador` si está MUERTO (sin proceso) | si el orquestador está VIVO y BLOQUEADO (esperando un permiso), `sesion.mjs` contesta `YA-VIVA` y **no lo toca** — lo dice el propio comentario del fichero |
| **B · clasificar cada sesión** | `scripts/equipo/sesion.mjs` (`clasificarAgente`, `sesionesBloqueadas` — SCRUM-1026) | distingue VIVA / MUERTA (dos sondas) / **BLOQUEADA** (`state:'blocked'` o `waitingFor`, con `avisar:true` sobre el umbral `UMBRAL_AVISO_BLOQUEO_MS`) | es **PULL**: solo contesta si alguien ejecuta `sesion.mjs estado`. No hay proceso que la llame solo |
| **C · relanzar los PUESTOS (j1…j6)** | el bucle del propio orquestador (`docs/equipo/orquestador.md` §0, `prompt-tanda-orquestador.md` punto 3) | con `ListAgents`, manda encargo a las libres y lanza las que faltan | depende de que el ORQUESTADOR esté vivo y despierto; usa `ListAgents` (libre/ocupada), no `sesion.mjs estado` — una BLOQUEADA sale «ocupada» y el bucle no la distingue de una que trabaja |

**Piezas A y B YA ESTÁN instaladas en ESTA máquina** (verificado, no asumido):
`C:/Users/Javier Pereira/AppData/Local/yaqu-equipo/config.json` (prefijo `jv-`, puestos
`orquestador,j1…j6`) y las tres tareas (`yaqu-equipo-jv-0825/1330/1835`) existen y están **Listo**
(`schtasks /query`). Confirma y CORRIGE al traspaso del 21-sep (`traspaso-javier.md` §7, «las tres
tareas NO se han ejecutado nunca»): hoy sí corrieron — la de 08:25 ya tiene su próxima cita mañana.

**El hueco real, declarado por su propio autor:** `docs/master/SCRUM-1026.md`, sección «Lo que NO se
ha hecho»: *«Punto 2 — un aviso ACTIVO al orquestador. Este script es PULL… se deja para que el
orquestador decida si la quiere y de qué tamaño.»* **No hay ningún aviso activo construido, en
NINGUNO de los dos equipos** — no es que al equipo de Javier le falte portar algo que Luis ya tiene:
la pieza C (poller + alerta) no existe en ningún sitio. Corrijo aquí la premisa del encargo porque
diverge de lo medido (PASO 0): «ya construido y probado» es cierto para A y B, no para el aviso
activo.

## 2 · Lo montado — `scripts/vigia-sesiones-jv.mjs`

Un poller nuevo, **fuera de `scripts/equipo/`** (no toca nada compartido; solo ejecuta como proceso
aparte la copia YA INSTALADA de `sesion.mjs estado`, sin importarla ni modificarla):

1. `node <INST>/sesion.mjs estado` → toma `bloqueadas` (con `avisar:true`) y `restos` (MUERTA).
2. Un único issue de GitHub (`[vigía-jv] sesiones muertas o bloqueadas`), reescrito cada pasada,
   **con el mismo patrón que `.github/workflows/vigia-atascados.yml`** para PR: comentario SOLO
   cuando aparece un `id` nuevo (memoria en un `<!-- vigia-sesiones-jv:ids [...] -->` dentro del
   cuerpo, igual que el vigía de PR guarda su estado).
3. La tarea programada que lo dispare **NO la crea esta sesión**: `schtasks /create` es una acción
   de sistema fuera del repo, y crear una nueva sin que nadie la mire es precisamente el tipo de
   acción que se para y se dice (ver «Para ti» al cierre del informe a Javier).

### Por qué no toca `scripts/equipo/`

El encargo lo condicionaba: «si y solo si eso no significa modificar las piezas compartidas». No
hace falta: la pieza C es nueva por definición (no existía nada que modificar), y lo único que toca
de lo compartido es EJECUTAR (no editar) el binario ya instalado de `sesion.mjs`.

## 3 · Provocado, no solo declarado (punto 4 del encargo)

**No se lanzó una sesión de control con `claude --bg`** para fabricar un bloqueo sintético: hacerlo
desde una sesión de fondo arriesga el mismo permiso interactivo sin respuesta que mató a la sesión
J6 anterior (el propio prompt de esta tanda lo señala como la trampa medida de esta máquina). En su
lugar se usó un caso REAL, ya vivo en el sistema en el momento de medir: `jv-j3`, muerta desde
2026-09-22T22:49:02Z y bloqueada (id `34714ba0`), confirmada con
`node sesion.mjs estado` antes de tocar nada.

**Rojo → verde, en orden:**

1. `npm test`-equivalente de las funciones puras (`node --test tests/scrum1000-vigia-sesiones-jv.test.mjs`):
   8/8 verde. Control de mutación manual (A23-8): `queEmpeora` forzado a `empeora:false` → **2 tests
   caen** (confirmado, ver diff restaurado byte a byte con `git status --porcelain` vacío tras
   `git restore`).
2. **Primera pasada real**, contra GitHub de verdad (repo `lwislg99/cobroflash-backend`):
   `ISSUE-CREADO` → **issue #1698**, cuerpo con `jv-j3` como BLOQUEADA y MUERTA.
3. **Segunda pasada**, sin cambios: `SIN-CAMBIOS-A-PEOR` — no duplica el aviso (control de que NO
   spamea).
4. **Control positivo del camino "empeora"**: se vació la marca del issue a mano
   (`gh issue edit --body "..."` sin la marca, simulando memoria vacía) y se corrió una tercera
   vez → `EMPEORA`, con un **comentario real publicado** en #1698 (confirmado leyendo
   `gh issue view 1698 --json comments`).

El issue #1698 queda abierto y es la prueba viva: recoge el estado real de `jv-j3`, no un caso de
laboratorio.

## 4 · Para Javier (acción manual, fuera de lo que esta sesión puede autorizar)

Crear la tarea programada que dispare el poller es una acción de sistema persistente; no la ejecuta
esta sesión. El comando exacto, para pegar tal cual (cada 30 min, ajustable):

```
schtasks /create /sc minute /mo 30 /tn yaqu-vigia-sesiones-jv /tr "node \"C:\Users\Javier Pereira\cobroflash-backend\scripts\vigia-sesiones-jv.mjs\""
```

Y decidir si `jv-j3` (real, muerta desde anoche) se releva ahora — no lo hace esta sesión por A13:
es del orquestador, no de J6.

## 5 · Suite

`npm run build` limpio. La suite COMPLETA con `tests/*.test.mjs` no corrió en esta máquina: el glob
revienta con «Argument list too long» (trampa de entorno ya conocida, no un rojo del cambio). Los
dos ficheros nuevos son ADITIVOS (ningún fichero existente tocado) y su propio test corre limpio en
aislamiento; CI corre la suite completa sobre el PR.
