# SCRUM-1534a · los checks obligatorios avisan con un rojo
**Medido contra:** `origin/main` = `ba521b73339f1e56972c301a372101c8422f5120` · 2026-11-27T12:48:14Z

Versión: 1.2 (SCRUM-1836)

Carril J6 (`scripts/vigia-silencio-de-main.mjs`, fila general de `scripts/`; tests de su ticket). Decisión del
fundador: SCRUM-1534 c.22933; «obligatorio» = los checks que el vigía lee del ruleset, c.22944 (d). Sesión jv-j6gl.

**Medido hoy** (modo rachas, 12:48:13Z, 260 runs, 0 jobs sin leer, 37 s): EXIT=1 por el cron «Vigía del
despliegue / vigia» (2 rojos, 23,5 h sin verde) y 3 SIN-DECLARAR (`meta-guard · parte 1/2/3 de 3`): lo
mismo que c.22940, y es de 1534b. La lista de obligatorios sale de `checksObligatoriosDeReglas` sobre
`rules/branches/main` (`leerDeGitHub`, :931) y hoy son dos: `build + tests (con banco desechable)` y
`guards de navegador (fuera de la tanda)`. Los dos con 0 rojos seguidos hoy: el arreglo no cambia el
veredicto de hoy. **Hallazgo (c.22940):** en la ventana 16 → 27-nov «guards de navegador», obligatorio, tuvo
una racha de **72** rojos en `main` de la que este modo no podía avisar (la línea `!f.obligatorio`, :315).

**Control sobre el fixture de siempre** (1.084 runs; sonda que emula la regla nueva sin tocar código, y la
misma sonda con el código nuevo: salidas idénticas). «build + tests»: 202 ejecuciones, 11 rojos en 10 rachas
(máx. 2, viva al cierre: `e9e71cab`). «guards de navegador»: 160, 70 rojos en 6 rachas (máx. 35). Barrido del
caso ④ con `obligatorios: [build + tests]`: 8 episodios antes, 18 después (los 10 nuevos son las 10 rachas
del obligatorio). Con los dos obligatorios de hoy: 4 antes (navegador desaparece: el defecto), 20 después.
El corte del 28-sep 12:00Z sigue sin avisos.

**Rojo primero:** `tests/scrum1534a-obligatorios-avisan-con-un-rojo.test.mjs` con el código de `main`: 6 casos =
3 ✔ + 3 ✖ (caen (a), (b) y el positivo de (d)). **Arreglo:** umbral por fila, 1 si `obligatorio` y
`UMBRAL_ROJOS_SEGUIDOS` si no; la exclusión `!f.obligatorio` desaparece; el motivo de la fila dice el sha.
Umbrales, `JOBS_DE_MAIN`, fixture, modo por commit y 1498d: sin tocar.

**Casos de `tests/scrum1324-nadie-vigila-el-silencio.test.mjs` que cambian de sentido** (contaban con que el
obligatorio en rojo callaba): «③ EL ROJO, con los datos de entonces» (el cierre avisa también del
obligatorio, 1 rojo vivo); «④ EL POSITIVO, sobre el historial entero» (+10 episodios del obligatorio; el
nombre se queda porque lo cita su catálogo); «⑦ lo que no sabe, lo dice» (el rojo de `bloquea` es aviso);
«⑧ el informe declara su población» (3 ROJO-SOSTENIDO y «AVISO: 3 de 9 jobs»). Su M05 se invierte: era
«el rojo del obligatorio también avisa» y ahora es «vuelve a callar»; cae en ⑦ igual.

**Verdes con población:** 82/82 (0 saltados) en `tests/scrum1534a-*`, `tests/scrum1324*`, `tests/scrum1393*`
y `tests/scrum1498d*`. Mutaciones con `correr` + `aplicarUna` de la casa: base 6/6 y 8/8; mueren las 3 del
catálogo nuevo y las 15 de 1324; `git status` limpio después.
Mutaciones: catálogo → `tests/scrum1534a-obligatorios-avisan-con-un-rojo.test.mjs`
Mutaciones: catálogo → `tests/scrum1324-nadie-vigila-el-silencio.test.mjs`

**NO medido:** la suite ENTERA en local (no me cabía en contexto; la mide el CI, por orden del orquestador);
836d, 237, 976, 700, 824 y 419 (solo 1294, 267, 854 y `guards:entrada`, con su resultado en el comentario
de Jira); qué hace el modo rachas con los SIN-DECLARAR de hoy (1534b); por qué navegador estuvo 72 rojo.

A9: aviso → cicatriz J6 «Medí 121k al acabar Jira y leí enteros el vigía por rangos y el test de 1324 sin medirme entre lecturas» — no se pudo comprobar: el aviso de 200k lo dio un hook del orquestador que no vive en el repositorio, y ningún hook de este árbol mide una lectura antes de traerla

# SCRUM-1534b · fixture actual, trece jobs y los tres umbrales por la derivación
**Medido contra:** `origin/main` = `eafe4fda2087456bf617f10818222afa251d19e1` · 2026-11-27T14:02:05Z

Versión: 1.2 (SCRUM-1836)

Carril J6 (`scripts/vigia-silencio-de-main.mjs`, fila general de `scripts/`; test y fixture de su ticket).
Decisión del fundador: SCRUM-1534 c.22933; partición y respuestas del orquestador: c.22944 (a, b, c). Sesión
jv-j6gm. Ningún workflow tocado.

**La ventana** (guion de la casa, `docs/master/evidencias/SCRUM-1324/recoger.mjs <dir> 2026-11-16` y
`reducir.mjs`; recogida de 13:50:05Z a 13:55:17Z, hora de GitHub): 2.180 runs leídos, 0 ciegos; 1.476 son
reactivos y quedan fuera; **704 runs** de 5 workflows en el fixture, del `2026-11-16T00:27:27Z` (`37947dc1`) al
`2026-11-27T13:44:37Z` (`eafe4fda`). CI: 314 runs = 153 con algún job + 161 sustituidos con 0 jobs.
c.22940 midió 692 a las 12:03Z: es la misma ventana, 1 h 47 min más larga. El fixture de 1324 (1.084 runs)
queda byte a byte (`cmp`) en `docs/master/evidencias/SCRUM-1534/historial-main-viejo.jsonl`.

**Tabla por job** (los 13 nombres salen de la cabecera del fixture; `JOBS_DE_MAIN` coincide como conjunto, caso ①):

| job | unidad | runs | ejecutadas | rojas | racha máx. | hueco máx. (runs) | horas máx. entre runs |
|---|---|---|---|---|---|---|---|
| CI / build + tests (obligatorio) | runs | 314 | 151 | 7 | 2 | 11 | — |
| CI / guards de navegador (obligatorio) | runs | 314 | 151 | 77 | 72 | 11 | — |
| CI / meta-guard · los guards caen cuando deben | runs | 314 | 152 | 3 | 3 | 11 | — |
| CI / meta-guard · parte 1 de 3 | runs | 314 | 152 | 0 | 0 | 11 | — |
| CI / meta-guard · parte 2 de 3 | runs | 314 | 152 | 0 | 0 | 11 | — |
| CI / meta-guard · parte 3 de 3 | runs | 314 | 152 | 3 | 3 | 11 | — |
| CI / trinquete | runs | 314 | 152 | 15 | 10 | 11 | — |
| CI / vigía del despliegue (informativo) | runs | 314 | 153 | 1 | 1 | 11 | — |
| CI / constancia del ALTER (informativo) | runs | 314 | 153 | 1 | 1 | 11 | — |
| Conflicto de registro / resolver | runs | 314 | 286 | 0 | 0 | 6 | — |
| Vigía de PR atascados / vigilar | horas | 32 | 32 | 1 | 1 | — | 12,5 |
| Vigía del despliegue / vigia | horas | 33 | 33 | 4 | 2 | — | 12,3 |
| Vigía de main / vigilar | horas | 11 | 11 | 0 | 0 | — | 27,6 |

**Los tres umbrales, por la derivación del propio vigía** (constantes y fixture en el mismo commit, `3b269d3d9`):

| constante | antes | ahora | de dónde sale |
|---|---|---|---|
| `UMBRAL_ROJOS_SEGUIDOS` | 5 | **2** | `umbralDeRojos`: peor job build + tests, 3 rojos de 147 fuera de sus rachas de 2 (p = 2,0 %), 0,16 avisos falsos al mes con N=2; la derivación empieza en 2 |
| `UMBRAL_RUNS_SIN_EJECUTAR` | 22 | **12** | `umbralDeRunsSinEjecutar`: hueco máximo de 11 runs (build + tests), más uno |
| `UMBRAL_HORAS_DE_CRON` | 10 | **28** | `umbralDeHorasDeCron`: 27,6 h entre dos runs del cron diario «Vigía de main / vigilar» (desde el 22-nov 14:39:08Z) |

Control: la misma derivación sobre la copia del fixture viejo, con sus 9 jobs, sigue dando 5 / 22 / 10 (caso ②).

**Dos declaraciones, que no son decisiones mías y conviene mirar:**
1. **Con 28 h, el aviso que el vigía daba hoy deja de salir.** A las 12:48Z (1534a) avisaba del cron «Vigía del
   despliegue / vigia» (2 rojos, 23,5 h sin verde, umbral 10 h). A las 13:57:33Z, con la lista y los umbrales
   nuevos: 290 runs, 0 jobs sin leer, 13 jobs, **0 avisos, 0 SIN-DECLARAR, EXIT=0**; ese cron sale ROJO-RECIENTE
   (2 rojos, 24,7 h sin verde). El umbral de horas es UNO para los tres cron y lo fija el diario: un cron de
   2-3 h que deje de llegar tarda 28 h en avisar. Es lo que c.22944 (c) aceptó con el número delante; un umbral
   por job sería otro diseño, y no está hecho.
2. **`JOBS_DEL_CI` deja fuera las tres partes del meta-guard** (`PARTES_DEL_META_GUARD`). Esa lista se derivaba de
   `JOBS_DE_MAIN` y es la que el modo por commit (SCRUM-1393) exige presente en cada run: con las partes dentro
   habría pasado de 6 a 9 jobs exigidos, y el encargo prohíbe tocar ese modo. Sigue en 6.

**Arreglo que la lista nueva arrastra:** `leerDeGitHub` pedía los 30 últimos runs de cada workflow de cron y
filtraba por evento; «Vigía de main» corre sobre todo por `workflow_run` (314 de sus runs en la ventana, contra
11 de cron). Ahora pide además sus runs `event=schedule` y deduplica por id. NO medido: qué habría dicho sin
ese cambio (no lo corrí sin él); la lectura de hoy da «30 ejecuciones de 30 runs» para ese cron.

**Lo reescrito de `tests/scrum1324-nadie-vigila-el-silencio.test.mjs`** (8/8, 0 saltados, sobre 704 runs): los
obligatorios pasan a ser los dos de hoy. «① el censo» (704 runs, 5 workflows, 13 jobs, primer y último run);
«② los tres umbrales no se eligen» (2 / 12 / 28 y el control 5 / 22 / 10 sobre la copia); «③ EL ROJO, con los
datos de entonces» (el trinquete del 24-nov: verde a las 03:29:00Z, primer rojo `3c6c651f` 03:29:35Z, avisa con
el segundo `d47f8d5c` 06:38:51Z, diez hasta las 15:36:55Z; navegador y sus 72; el obligatorio con un run
sustituido en medio, `0735f843` y `77c000de`; al cierre, 0 avisos); «④ EL POSITIVO, sobre el historial entero»
(958 instantes, 12 episodios: 5 del obligatorio, 3 de navegador, meta-guard y su parte 3, trinquete dos veces);
«⑤ EL SILENCIO» (corte el 26-nov 12:00Z; 12 filas intactas; 10 jobs de push callan); «⑥ el cron va en HORAS»
(el rojo sostenido se mira sobre datos reales en un instante POSTERIOR al cierre, y el «uno solo no» pasado de
horas es construido: en la ventana ningún cron pasó de 28 h en rojo; el test lo dice); «⑧ el informe» (2 avisos
de 13 jobs el 24-nov 06:38:51Z). Los nombres de ③ y ④ se quedan como estaban porque los cita el catálogo. Las
mutaciones M01 a M04 cambian de número (2→1, 2→3, 12→13, 28→29).

**Verdes con población:** `tests/scrum1324-nadie-vigila-el-silencio.test.mjs` 8/8.

**NO medido:** las mutaciones con `aplicarUna` (mi piloto dio la base CIEGA por una ruta mal pasada, 0 de 1
aplicadas, y paré por contexto: las juzga el meta-guard del CI, y hasta entonces M01-M04 y M15 son números
sin medir); los guards 1294, 267, 854, 237, 976, 700, 824, 419, 836d, `scrum1393*`, `scrum1498d*`,
`scrum1534a*` y `guards:entrada`; la suite entera (la mide el obligatorio); si `scrum737` cuenta las cifras de
los comentarios nuevos. Primer empujón (`9cbf51cb7`) sin este registro, por orden del orquestador a 211k.

A9: aviso → cicatriz J6 «Medí 127k al acabar Jira y crucé 175k y 200k leyendo el test de 1324 entero y sondeando el fixture, sin nada empujado» — no se pudo comprobar: el aviso de 200k lo dio un hook del orquestador que no vive en el repositorio, y ningún hook de este árbol lee el usage de la sesión entre dos lecturas
