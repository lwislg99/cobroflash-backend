# SCRUM-999 · el arranque automático comprueba si queda uso antes de lanzar

**Fecha:** 26-sep-2026 13:38Z (GitHub) · **Carril:** S5 · **Medido contra:** `origin/main` =
`ef07945b3adc00de4d6009db3021188d4b8219be`.

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
