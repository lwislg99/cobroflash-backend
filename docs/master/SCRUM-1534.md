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
