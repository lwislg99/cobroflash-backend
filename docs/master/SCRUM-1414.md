# SCRUM-1414 · Cuánto tiempo pasa el equipo esperando, y a quién

**Medido contra:** `origin/main` = `a096c7faf486e7ca4332c16f95344dc06220bbab` · 2026-10-02T12:10:13Z

A9: comprobación → `tests/scrum1414-espera-del-equipo.test.mjs`

Carril S0 (`scripts/` de verificación, `tests/`, `docs/`). No toca `scripts/equipo/` ni el latido.

## Qué es

`node scripts/espera-del-equipo.mjs [--desde AAAA-MM-DD] [--jobs <carpeta>] [--hueco-min 15] [--larga-min 120]`

Lee `~/.claude/jobs/*/timeline.jsonl` (cuándo se para y cuándo vuelve cada sesión) y la transcripción de
cada una (quién la despertó). Tarda segundos. Sale 0, o 2 si no pudo leer la línea de tiempo de ningún puesto.

| dato | de dónde sale | ¿de fiar? |
|---|---|---|
| cuándo se para y cuándo vuelve | `at` y `state` de la línea de tiempo | sí: estructurado |
| quién la despertó | `origin.kind` y el nombre de la sesión que escribe, en la transcripción | sí: estructurado |
| qué dijo que esperaba | la prosa de su último mensaje | **no: búsqueda por palabras.** Va aparte, con cubo «sin clasificar» |

## Medido: 17-sep → 2-oct-2026

Población: 259 trabajos; 245 son sesiones de un puesto con línea de tiempo. Fuera: 9 que no son puestos
(orquestador, pruebas), 2 sin nombre, 3 puestos sin línea de tiempo. 0 líneas ilegibles, 0 sin transcripción.

| | |
|---|---|
| tiempo vivo (trabajando + esperas de hasta 2 h) | 154,4 h |
| de él, esperando | **10,3 h = 7 %**, en 87 esperas |
| de esa espera, la despertó el orquestador | **8,7 h = 84 %** (73 veces) |
| lo que tarda en despertarla | mediana 1 min · 9 de cada 10 en menos de 22 min |
| el techo, mirando el puesto y no la sesión | **58 %**: 189,9 h de 327,4 h de jornada sin ninguna sesión del puesto trabajando |

**El tiempo parado está entre el 7 % y el 58 %.** No doy una cifra única porque no la hay: el 7 % solo ve
la espera de una sesión a la que se contesta en su sitio; el 58 % cuenta todo lo que un puesto no trabajó
entre su primer y su último trabajo del día (relevos, cuota, noches que caen dentro, huecos).

Por lo que cada sesión DIJO que esperaba (por palabras; orienta, no decide):

| | de la espera | veces |
|---|---|---|
| veredicto de CI | 35 % | 32 |
| el fundador | 28 % | 11 |
| permiso del sistema | 19 % | 29 |
| decisión del orquestador | 8 % | 9 |
| sin clasificar | 6 % | 2 |
| cuota | 4 % | 4 |

Por cómo se paró (estructurado): `blocked` 6,0 h en 25 veces · `done` 4,3 h en 62 veces.

Por puesto, esperando / de ello al orquestador: S0 1,7 / 1,7 h · S1 3,5 / 2,7 h · S2 1,9 / 1,4 h ·
S3 0,6 / 0,4 h · S4 2,3 / 2,3 h · S5 0,2 / 0,2 h.

Por día, los de más espera: 2-oct 19 % · 29-sep 17 % · 22-sep 14 % · 28-sep 13 % · 18-sep 10 %.
**El 1-oct da 6 % y no es representativo:** el equipo se paró en seco a las 16:10 por el límite semanal.

El 2-oct a las 12:10Z había **5 sesiones de puesto paradas y sin volver**, sumando 2,4 h: cuatro decían
esperar un veredicto de CI y una un permiso del sistema.

## La segunda medida: TIEMPO HASTA EL VEREDICTO (no se suma a la de arriba)

Pedida por el orquestador el mismo 2-oct, por este motivo: su cura para la espera de CI es que la sesión
empuje y siga con otra cosa. Con eso el TIEMPO PARADO baja **aunque el CI tarde lo mismo**, así que
mirando solo esa cifra la cura parecería un éxito el primer día por construcción. Esta medida es la que
la cura NO cambia.

`--runs <fichero>` con la salida de `gh run list --limit 300 --json name,event,headSha,headBranch,createdAt,updatedAt,status,conclusion`.

Medido sobre 300 corridas, del 1-oct 18:24Z al 2-oct 12:13Z (53 empujones vistos):

| | |
|---|---|
| de empujón a veredicto | mediana **20 min** · 9 de cada 10 en menos de 26 min · 30 empujones |
| de ello, hasta que la corrida de CI EXISTE | mediana 0 min · 9 de cada 10 en menos de 3 min. ⚠️ No mide la cola (ver «Mis errores», 3) |
| cómo acabó la corrida entera | success 13 · failure 17 |
| fuera de la cifra | 17 corridas canceladas · 5 en curso · 1 empujón sin CI · 1 CI sin su empujón entre las leídas |

Límites: es el final de la corrida ENTERA de CI, con sus jobs informativos, así que es un techo del tiempo
del obligatorio (y «failure 17» no son 17 obligatorios en rojo). 17 canceladas de 53 es mucho y **no he
mirado por qué se cancelan**. La ventana son 18 horas, no la serie de dos semanas de la otra medida.

## El hallazgo

**«La despertó el orquestador» no es «esperaba una decisión del orquestador».** El 84 % de la espera la
cierra él, pero por lo que las sesiones dicen solo el 8 % esperaba una decisión suya; el 35 % esperaba un
veredicto de CI, que les llega por él. El cuello no es que decida despacio (mediana, 1 minuto): es que
todo pasa por él, también lo que no es una decisión.

## Lo que NO se pudo reconstruir (no está en ninguna cifra)

| | |
|---|---|
| sesiones que se pararon y nunca volvieron | 174. No se sabe si esperaban o se las dio por terminadas. Su espera no tiene final y no se suma |
| huecos de más de 15 min entre dos «working» | 25,3 h. No se sabe si trabajaba, dormía la máquina o murió el proceso |
| esperas de más de 2 h | 3, que suman 21,5 h. Apartadas: son noches o paradas, no miden a quien contesta |

Y tres límites del método:

- «Una persona» es quien teclea en esa sesión. No distingue al fundador del prompt de arranque.
- 🔴 **Los dos umbrales (15 min y 120 min) NO ESTÁN VALIDADOS.** Los elegí yo mirando la misma serie que
  miden. Es calibrar sobre una muestra, el error de C5 y de C6 (SCRUM-1372). Está dicho también en la
  cabecera del script. Si hay otra serie, se revisan contra ella.
- Las horas son las del reloj de la máquina, que va unos minutos adelantado respecto a GitHub. No afecta a
  las duraciones.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Población declarada. La salida dice cuántos trabajos miró, cuántos son puestos del equipo y cuántos dejó fuera y por qué, y la ventana (primer y último instante). | `tests/scrum1414-espera-del-equipo.test.mjs` («la medida entera») |
| Tiempo esperando, acumulado. Para cada sesión, el tiempo entre que se para (`blocked` o `done`) y vuelve a `working`, sumado. `done` cuenta: una sesión que «acabó» y a la que luego se le contesta estaba esperando. | `tests/scrum1414-espera-del-equipo.test.mjs` («los tramos») |
| Partido por quién la despertó (dato estructurado): el orquestador · otra sesión · una persona · nadie todavía. Y aparte, por lo que la sesión dijo que esperaba (decisión del orquestador · fundador · CI · permiso del sistema · cuota), con un cubo «sin clasificar» que se imprime siempre. | `tests/scrum1414-espera-del-equipo.test.mjs` («quién despierta», «lo que DIJO», «la medida entera») |
| La cifra pedida: qué fracción del tiempo vivo de las sesiones se va esperando, y de eso cuánto es esperando al orquestador. | `docs/master/SCRUM-1414.md` (la primera tabla de «Medido») |
| Fail-closed. Lo que no se puede reconstruir se cuenta aparte y se dice: tramos sin transcripción, huecos largos entre dos `working`, y la cola final de una sesión que se paró y nunca volvió (no se sabe si esperaba o murió). Sale 2 si no pudo leer ninguna línea de tiempo. | `tests/scrum1414-espera-del-equipo.test.mjs` («fail-closed», «un hueco», «sin transcripción») |
| Por día, con el 1-oct marcado como no representativo (parada en seco a las 16:10 por el límite semanal). | `tests/scrum1414-espera-del-equipo.test.mjs` («--desde recorta la ventana») |
| Tests con líneas de tiempo fabricadas, probados en rojo: una espera despertada por el orquestador, una por una persona, una cola sin despertar, un hueco, una línea ilegible. | `tests/scrum1414-espera-del-equipo.test.mjs` · «Probado en rojo», abajo |
| No se duplica el latido. Queda escrito qué parte tendría que vivir como sección del latido (de S5) y qué pide a S5; este ticket no toca `scripts/equipo/`. | `docs/master/SCRUM-1414.md` («Lo que pide a S5») |

## Lo que pide a S5

El latido ya dice quién está bloqueada AHORA. Lo que le falta es el tiempo. La sección «PARADAS HOY Y SIN
VOLVER» de este script es eso mismo con los minutos acumulados; `medir()` está exportada y devuelve
`datos.abiertas`. La petición a S5: que el latido la llame en vez de calcularlo otra vez. No está hecho ni
hablado con S5: lo pasa el orquestador.

## Probado en rojo

Diez mutaciones sobre el script, con la base sin mutar en verde; las diez tumban el test: `done` no cuenta
como espera · el hueco se suma como trabajo · la espera larga cuenta como corta · toda sesión es el
orquestador · no se cuentan los puestos sin transcripción · sin líneas no sale 2 · ilegibles callados · un
despertador de antes de la parada · el solape de dos sesiones contado dos veces · paradas de otros días
como de hoy.

## Mis errores

1. **La primera versión daba una sola cifra, el 7 %, y era un suelo sin decirlo.** Lo vi al leer «174
   sesiones que nunca volvieron» en mi propia salida: el equipo releva con sesión nueva, así que la mayor
   parte de la espera no deja rastro en ninguna sesión. → comprobación: el caso «el techo», con dos sesiones
   del mismo puesto relevándose, que exige espera 0 y puesto parado 30 min.
2. **La foto de hoy no salía.** Las sesiones paradas ahora mismo no han vuelto, así que eran «colas» y no
   contaban: el día que motivó el ticket daba 2 esperas con 5 puestos parados. → comprobación: el caso «las
   paradas de HOY que no han vuelto salen con nombre».
3. **Rotulé «hasta que el CI ARRANCA» lo que era «hasta que la corrida EXISTE»**, y el orquestador leyó
   «mediana 0 min» como «no hay cola» y paró un encargo de S5 con ello. El dato era correcto; el rótulo
   decía más de lo que el campo (`createdAt` de la corrida) sabe: una corrida recién creada puede estar
   en cola sin runner, y ese tiempo va dentro del total. Lo vi al leer su conclusión, no al escribir el
   rótulo; y tenía un indicio propio en contra (el abridor de mis dos ramas estuvo 7 y 9 min en cola).
   → comprobación: no hay test que pueda exigir que una palabra no prometa de más; queda la regla escrita
   en la cabecera del script (un rótulo nombra el dato que se leyó, no lo que se cree que significa) y el
   aviso impreso junto a la cifra, que el test «tiempo hasta el veredicto» exige.
