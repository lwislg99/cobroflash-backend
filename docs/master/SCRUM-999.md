# SCRUM-999 · el arranque automático comprueba si queda uso antes de lanzar

**Fecha:** 26-sep-2026 13:38Z (GitHub) · **Carril:** S5 · **Medido contra:** `origin/main` =
`ef07945b3adc00de4d6009db3021188d4b8219be` · 2026-09-26T13:38Z (GitHub)

## PASO 0 — lo medido antes de tocar nada

`orquestador-arranque.mjs` llamaba a `sesion.mjs lanzar` sin preguntar antes por la cuota
(`uso.mjs`). `decidirLanzar` (sesion.mjs) sólo mira si hay algo VIVO en el repo, nunca la cuota
de la cuenta: confirmado leyendo el código, sin cambio desde que se abrió el ticket (21-sep).

No se reprodujo por efecto «qué hace la CLI si se lanza con la cuota agotada» lanzando una
sesión de verdad: la cuenta está HOY al 88 % (AVISO, medido con `node scripts/equipo/uso.mjs
leer`) y forzar el agotamiento real para observarlo habría sido exactamente el incidente que
este ticket existe para evitar. En su lugar, la evidencia ya medida sirve de PASO 0: la memoria
`feedback_cierre_y_arranque_por_uso` registra que la tanda del 17-sep murió por límite de uso
**sin ningún aviso previo en el jsonl**, y que el CLI no avisa nunca — la única defensa medida
hasta hoy era «commitear a menudo y mirar el censo de huérfanos». Esa observación no dice qué
pasa al LANZAR con 0 % (nunca se ha medido, porque medirlo exige agotar la cuenta de verdad), y
se deja así, declarado, en vez de fingir una medición que no se hizo.

## Arreglo

`orquestador-arranque.mjs`, después de que `puertas()` verifique la integridad de las copias
instaladas (que ahora incluyen `uso.mjs`, añadido a `COMPROBADOS`), pregunta a `uso.mjs leer`
como proceso aparte —igual que a `sesion.mjs lanzar`: nunca se importa un fichero cuya
integridad decide otro código—. Fail-closed: sólo `VERDE` deja lanzar. `AVISO` y
`NO_PUDE_MIRAR` paran con veredicto `SIN-CUOTA` (exit 1) y quedan en `arranque.log`
(`stdout` de `orquestador-arranque.mjs`, que `arranque.cmd` ya redirige ahí); esta tarea NO
reintenta sola — la tanda siguiente lo intentará de nuevo.

No se tocó `sesion.mjs`: el corte vive SÓLO en el lanzador automático, no en `lanzar` en sí, que
sigue disponible para un jefe u orquestador que decida lanzar a mano con criterio propio.

## Tests

`tests/scrum899b-arranque-de-la-tanda.test.mjs`, 4 nuevos:
- con la cuenta en AVISO (≥85 %) → `SIN-CUOTA`, cero llamadas a `claude`;
- sin lectura vigente (máquina recién instalada) → `SIN-CUOTA` (`NO_PUDE_MIRAR`), cero llamadas;
- con `uso.mjs` ALTERADO → `ALTERADO`, cero llamadas (mismo trato que `sesion.mjs` tocado);
- CONTROL: con la cuenta en VERDE, la misma tanda SÍ lanza.

Verificado a mano el rojo↔verde de las dos mutaciones nuevas (`if (uso.veredicto !== 'VERDE')`
→ `if (false)`, y quitar `uso.mjs` de `COMPROBADOS`): las tres nuevas afirmaciones caen con el
defecto puesto y no con el código de hoy. Declaradas en `MUTACIONES_QUE_ME_TUMBAN`.

**Aislamiento de entorno (SCRUM-1153-shaped):** `uso.mjs leer` SIEMPRE mira
`%LOCALAPPDATA%\yaqu-equipo\uso.json` salvo `--fichero` explícito, que `orquestador-arranque.mjs`
no pasa (en producción quiere el dato REAL de la máquina). Sin aislar `LOCALAPPDATA` en el
banco, los tests habrían leído el `uso.json` de ESTA máquina —hoy AVISO al 88 %— y el veredicto
habría dependido de cuánta cuota le quedara a la cuenta real en el momento de correr: el mismo
defecto de entorno que las cuatro rondas de CI de `#1806` esta misma mañana. Nuevo helper
`tests/_uso-banco.mjs` (`localAppData`, `escribirUso`) para escribir un `uso.json` de fixture
dentro de un `LOCALAPPDATA` aislado por banco; usado también por `scrum951a`.

## SCRUM-999b · de paso, SCRUM-1153 (encargo del orquestador, mismo PR)

El censo `scripts/_censo-entorno-prestado.mjs` (mergeado en `main` mientras se trabajaba en
esto) acusó 6 llamadas a un `node` hijo, en ficheros de este mismo carril, que parsean su
`stdout` sin construir el `env` a mano (heredan `process.env` entero, o un `{ ...process.env }`
sin `delete` de `FORCE_COLOR`/`NODE_OPTIONS`/`NODE_TEST_CONTEXT`):

- `tests/scrum899-sesion-lista-blanca.test.mjs`
- `tests/scrum899b-arranque-de-la-tanda.test.mjs` (la llamada nueva de este ticket, antes de
  corregirla, también caía en la misma clase: `SPREAD_SIN_LIMPIAR`)
- `tests/scrum951a-equipo-configurable.test.mjs` (dos llamadas: `correr` y `correrInstalar` —
  la segunda no la ve el censo, que no cruza funciones para seguir el `JSON.parse` de quien la
  llama, pero es el mismo defecto y se corrigió igual)
- `tests/scrum954-vivo-no-es-listado.test.mjs`
- `tests/scrum959b-el-arranque-no-duplica-el-equipo.test.mjs`
- `tests/scrum1007-1011-1026-relevo-lanzar-bloqueo.test.mjs`

Arreglo en las 7 (6+1): `const entornoHijo = { ...process.env }` seguido de los tres `delete`,
igual que el arreglo ya mergeado de SCRUM-938. Cada sitio con su propia copia inline —no se creó
un helper compartido para esto sin preguntar antes, tal y como pidió el orquestador—.
Verificado: `tests/scrum1153-censo-entorno-prestado.test.mjs` sigue en verde (el censo real no
acusa nada nuevo bajo `tests/` y `scripts/` tras el arreglo).

## Lo que NO cubre esta entrada

- No mide qué hace `claude --bg` de verdad con la cuota real a 0: no se forzó el agotamiento de
  la cuenta para observarlo (ver PASO 0). Si algún día se mide por efecto, va aquí, en una
  sección `999c`.
- No toca `SCRUM-996`/`SCRUM-1070` (bajar el suelo de arranque): confirmado por el orquestador
  que esa palanca vive en la cuenta del fundador, no en el repositorio.

## SCRUM-999c · ¿se puede saber hoy que queda poco uso? Medido el 15-oct (Sesión 5)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T15:43:49Z

El arranque automático está APARCADO por el fundador: aquí no se construye nada. Sólo se mide si el dato existe
y por qué vía (encargo del orquestador, después de que el 9-oct cinco sesiones murieran por el límite de uso).

**Sí se puede saber, y el dato está vivo.** La vía es la de SCRUM-899d: el statusLine del usuario
(`node C:/Users/Admin/AppData/Local/yaqu-equipo/uso.mjs escribir`) deja en
`%LOCALAPPDATA%\yaqu-equipo\uso.json` lo que Claude Code le pasa en `rate_limits`, y lo renueva con cada
llamada a la API. Leído a las 15:4xZ: 20 sesiones lo han escrito, cinco de ellas en el último minuto, y
`uso.mjs leer` da `VERDE` con edad 0 min.

**Pero `leer` sólo juzga UNA de las dos ventanas.** El fichero trae las dos:

| ventana | usado | se reinicia |
|---|---|---|
| `five_hour` | 17-19 % | 2026-10-15 20:10Z |
| `seven_day` | **89 %** | 2026-10-15 22:00Z |

`juzgar()` (`uso.mjs`, líneas 115-125) mira sólo `five_hour`. **Control positivo, con dato y no leyendo el
código:** la copia del `uso.json` real con `seven_day.used_percentage` puesto a 100 → `leer --fichero` da
`VERDE`, `uso 19% < 85%`, salida 0. Con la cuenta semanal agotada, el corte de este ticket dejaría lanzar.

**Qué ventana mató las sesiones del 9-oct: NO lo sé.** `uso.json` sólo guarda la última lectura, no el histórico,
y la memoria de aquel día no lo dice.

**Lo que no cubre la vía:**
- Sólo hay dato mientras alguna sesión está viva y hablando con la API. Con el equipo parado, el dato envejece y
  `leer` responde `NO_PUDE_MIRAR` (falla cerrado: bien para lanzar, pero no avisa a nadie).
- Lo lee quien lo pregunta. Hoy nadie lo enseña en el latido ni lo empuja al orquestador.

**Si un día se construye** (lo decide el orquestador; no lo hago): que `juzgar()` dé `AVISO` también con
`seven_day ≥ umbral` y nombre qué ventana es. Es un cambio de pocas líneas, pero `uso.mjs` tiene copia instalada
en `%LOCALAPPDATA%\yaqu-equipo` y la puerta de integridad exige reinstalar.

🔴 **Para hoy, sin construir nada:** la semanal está al 89 % y no se reinicia hasta las 22:00Z.

A9: sin fallo que generalice — medición encargada por el orquestador, sin código tocado; el hueco hallado (`juzgar()` sólo mira `five_hour`) no es un error de esta sesión y queda descrito arriba para que lo decida el orquestador

## 16-oct-2026 · SCRUM-999b · `uso.mjs leer` juzga TAMBIÉN la semanal, y dice cuál muerde

**Medido contra:** `origin/main` = `555c65fa91cd12d54d735a40b90e479805b276fa` · 2026-10-16T11:53:35Z (`Date:` de GitHub)

Encargo del orquestador, que lo volvió a medir hoy: `uso.mjs:75` guardaba `seven_day` y `:115` sólo
juzgaba `five_hour`; `seven_day` no volvía a aparecer en el fichero. Es el hueco descrito arriba el 15-oct.

**Lo que entra:**
- `juzgar()`: el veredicto es el de la ventana que MÁS lleva. Campos nuevos: `muerde` (`'5 h'` o `'semanal'`),
  `cinco_horas` y `semanal` (`{usado, reinicia}` de cada una). `usado` y `reinicia` pasan a ser los de la
  ventana que muerde. El motivo nombra las dos: `muerde la ventana semanal: 5 h 10% · semanal 95% (umbral 85%)`.
- Sin dato de la semanal, o con la semanal ya reiniciada → `NO_PUDE_MIRAR` (salida 2). Con la de 5 h sola no
  se sabe si la cuenta está agotada, y eso no es verde.
- La barra de estado añade `· semana N%` al final (la de 5 h y su hora no cambian de sitio).
- `tests/_uso-banco.mjs` escribía `seven_day: null`; ahora una semanal al 5 % (opción `semanal`). Sin ese
  cambio caían 5 bancos de `scrum899b` — medido: es el rojo que da el arreglo con la fixture vieja.

**Comprobado:**
- Rojo primero: con el `uso.mjs` de `main`, 6 de los tests nuevos caen; con el arreglo, 24/24.
- Los cinco ficheros que tocan `uso.mjs` o su banco (`scrum899d`, `scrum899b`, `scrum951a`, `scrum951d`,
  `scrum824`): 73/73.
- Mutaciones declaradas en `scrum899d`: 8 de 8 cazadas (4 viejas, 4 nuevas). Las dos de `muerde` van una en
  cada sentido: el lector que mira sólo la de 5 h y el que mira sólo la semanal.
- Por efecto, la tanda: `scrum899b` con la semanal al 95 % y la de 5 h al 10 % → `SIN-CUOTA`, `muerde:
  semanal`, cero llamadas a `claude`. Con el lector viejo (`muerde = '5 h'`), ese test cae.
- Control positivo sobre el `uso.json` REAL de la máquina, copiado con una ventana cambiada:
  | copia | `uso.mjs` nuevo | copia instalada (vieja) |
  |---|---|---|
  | semanal 95 % · 5 h 10 % | `AVISO`, `muerde: semanal`, salida 1 | **`VERDE` «uso 10% < 85%», salida 0** |
  | 5 h 95 % · semanal 5 % | `AVISO`, `muerde: 5 h`, salida 1 | `AVISO`, salida 1 |
  | el real, sin tocar (5 h 48 % · semanal 6 %) | `VERDE`, salida 0 | `VERDE`, salida 0 |

**Lo que NO hace:**
- La copia instalada en `%LOCALAPPDATA%\yaqu-equipo\uso.mjs` sigue siendo la vieja hasta que `arranque.cmd`
  la reescriba desde `origin/main` (lo hace en cada tanda) o se copie a mano. Hasta entonces,
  `node C:/Users/Admin/AppData/Local/yaqu-equipo/uso.mjs leer` sigue mirando sólo la de 5 h.
- No guarda histórico: sigue sin saberse qué ventana mató las sesiones del 9-oct.

A9: comprobación → `tests/scrum899d-aviso-de-uso.test.mjs`