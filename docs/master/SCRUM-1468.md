# SCRUM-1468 · Un PR es de quien empujó su rama, no de quien lo lleva enlazado

**Medido contra:** `origin/main` = `eb1fdefaf9e660bd706e1fbba31c90f868343ad1` · 2026-10-06T12:51:59Z

A9: comprobación → `tests/scrum1427-traspaso-derivado.test.mjs`

Carril S0 (`scripts/` de verificación, `tests/`, `docs/`). Toca `scripts/traspaso-derivado.mjs` y su test.
No toca `ramasEmpujadas` ni el latido (S5): los importa.

`node scripts/traspaso-derivado.mjs <nombre-de-la-sesión> [--sin-arboles] [--sin-github]`

## El defecto

La línea «PR» del traspaso derivado salía de las entradas `pr-link` de la transcripción. Una entrada así
dice que el PR **aparece** en la sesión, no que la sesión lo tocara. El traspaso derivado de `s0-6oct`
le atribuía el #1681, que es el PR de la rama del checkout compartido.

## Medido antes de construir (6-oct-2026, 299 sesiones con `state.json` legible en esta máquina)

| pregunta | resultado |
|---|---|
| ¿Qué trae una entrada `pr-link`? | 6.527 entradas, todas con las mismas claves: número, repositorio, URL, sesión y hora. **No trae la rama.** |
| ¿Cuántas sesiones llevan enlazado el #1681? | 22 (23 una hora después: la población está viva) |
| ¿Cuántas de ésas empujaron una rama `scrum-1082…`? | **0** |
| ¿Cuándo aparece el enlace? | Nunca al arrancar. En 20 de 22, su primera aparición sigue a una orden con `git push` de OTRA rama, dada desde el checkout compartido. En las otras 2 no supe (una orden de git sin `push` a la vista y una lectura de Jira). |
| ¿A cuántas les encendía `muto` SÓLO un enlace? | **0 de 299** |

**La consecuencia que el ticket traía leída y sin medir no se da.** El ticket temía que una sesión que no
hizo nada contara como «con rastro» por llevar un PR enlazado. Medido en UNA pasada, con la regla vieja y
la nueva sobre las mismas sesiones: los tres cubos salen iguales (270 con rastro · 24 no hicieron nada ·
5 no supe) y **ninguna sesión cambia de cubo**. Tiene su porqué: el enlace del #1681 aparece cuando la
sesión empuja, así que quien lo lleva ya contaba por su orden de empujar.

**La cifra del 2-oct («34 sin traspaso · 10 sin mutar») no cambia por este camino.** El registro de
SCRUM-1427 guarda los recuentos y no los nombres, así que no puedo volver a señalar aquellas 34: lo que
digo es que de las 299 que hay hoy en disco no cambia ninguna, y eso incluye a las de entonces que sigan
ahí. Las 5 sin transcripción son «no supe» con las dos reglas.

## Lo construido

Los PR enlazados se parten en tres, y el informe los imprime por separado:

- **Empujados por esta sesión:** su rama está entre las que la sesión empujó con nombre. Qué empujó lo
  dice `ramasEmpujadas` (`.claude/hooks/latido-cierre.mjs`), la misma función del hook de cierre y del
  latido.
- **Enlazados, no empujados por esta sesión:** salen con su número, rotulados. No se pierden.
- **No supe de quién son:** con el motivo de cada uno.

De qué rama es un PR se le pregunta a GitHub, en una sola llamada y sólo si hace falta: una sesión sin
ninguna orden de empujar no pudo empujar la rama de ningún PR, y sus enlaces van a «enlazados» sin
preguntar a nadie.

`muto` ya no mira los PR: el empujado cuenta por su orden de empujar y el enlazado no es una mutación.

**Sobre las sesiones reales** (418 pares sesión-PR; GitHub dijo la rama de los 333 PR preguntados):
381 empujados · 22 enlazados · 15 «no supe», en 10 sesiones, las quince por una orden de empujar sin
nombre de rama. El #1681: 0 empujados · 19 enlazados · 4 «no supe». Para `s0-6oct`, el caso del ticket:
empujado el #2001, enlazado el #1681.

## La aceptación → dónde se ve

| aceptación (literal) | dónde se ve |
|---|---|
| Un PR sale en la línea «PR» sólo si la sesión **empujó su rama** (o lo abrió). Con la función que ya existe para eso, `ramasEmpujadas` (`.claude/hooks/latido-cierre.mjs`, SCRUM-1356), la misma que usa el latido desde SCRUM-1378: sin un tercer lector. | `tests/scrum1427-traspaso-derivado.test.mjs` («control positivo: la que SÍ empujó su rama») — ver la nota 1 |
| Los PR que la transcripción sólo **enlaza** no se pierden: salen aparte, rotulados como «enlazados, no empujados por esta sesión», con su número. | el mismo fichero («un PR sólo ENLAZADO no se le atribuye») |
| **Rojo primero:** una transcripción fabricada con el `pr-link` del arranque y ningún empujón → hoy lo atribuye; después, no. **Control positivo:** una que sí empujó su rama sigue saliendo. | «Probado en rojo», abajo |
| `muto` no se enciende por un PR sólo enlazado. Se ve en el mismo test, con la sesión que no hizo nada. | el mismo fichero («un PR sólo ENLAZADO no se le atribuye»: el cubo es «no hizo nada que mute») |
| Si no se puede decidir qué rama empujó (un `git push` sin nombre de rama: límite conocido de `ramasEmpujadas`), se dice «no supe de quién es», no se atribuye. | el mismo fichero («si no se puede decidir qué rama empujó») |
| Re-medida la cifra del 2-oct con el script corregido, y dicho si cambia: «34 sin traspaso · 10 sin mutar» antes, y lo que salga después, con su fecha. | «Medido antes de construir», arriba — ver la nota 2 |

**Nota 1 · dos desviaciones, declaradas.** (a) «O lo abrió» no se construye: los PR los abre el bot al
empujar (A24), así que una sesión no abre ninguno; queda «empujó su rama». (b) «Sin un tercer lector» se
cumple para QUÉ EMPUJÓ la sesión, pero no bastaba: un `pr-link` no trae la rama, y para casar un PR con
una rama empujada hay que saber de qué rama es. Eso se le pregunta a GitHub (`ramasDeGithub`). Si no
contesta, o se pasa `--sin-github`, a quien empujó no se le atribuye ningún PR: se dice «no supe».

**Nota 2.** La cifra se re-midió sobre las sesiones que hay hoy, no sobre la lista de las 34, que no
quedó guardada. No cambia ninguna.

## Probado en rojo

**Rojo primero**, con los tests escritos y el script sin arreglar: 13 tests, 9 pasan y 4 caen, y el
primero cae por lo buscado («CON RASTRO» donde se esperaba «NO HIZO NADA QUE MUTE»).

**Nueve mutaciones**, con la base sin mutar en verde (13 de 13) y cada una comprobada como aplicada
(`git diff --numstat` da `1 1`) y revertida con `git restore --source=HEAD`. Mueren las nueve: `muto`
vuelve a encenderse con un enlace · quien no empujó nada se lleva el PR · atribuye sin mirar las ramas ·
sin saber la rama, lo atribuye · sin saber la rama, lo da por ajeno · un push sin nombre ya no deja la
duda · GitHub que no contesta se lee como mapa vacío · una respuesta sin repositorio se lee como mapa
vacío · el enlazado se pierde en vez de salir aparte.

## Lo que NO ve, dicho

- **Una orden de empujar «sin nombre de rama» es lo que `ramasEmpujadas` no sabe leer**, y eso incluye
  órdenes que sólo nombran `push` sin empujar nada. Medido: 40 de las 211 sesiones con alguna orden de
  empujar tienen al menos una así. No miré cuántas de esas órdenes empujaban de verdad. El error cae del
  lado seguro: más «no supe», nunca un PR atribuido de más.
- **Un PR sin enlace en la transcripción no sale**, aunque la sesión empujara su rama. La rama sí sale, en
  «ramas que empujó con nombre».
- Sin red no hay respuesta de GitHub: todo PR de una sesión que empujó sale como «no supe».

## Mis errores

1. **Comparé dos pasadas sobre una población viva.** La medición de antes dio 268 con rastro y 25 sin
   mutar; la de después, 270 y 24. No era el arreglo: entre las dos habían trabajado sesiones vivas y
   había nacido una. → Repetido con la regla vieja y la nueva en la MISMA pasada: 0 cambios.
2. **Una mutación sobrevivió a la primera tanda:** una respuesta de GitHub sin el repositorio se leía
   igual devolviendo un mapa vacío que devolviendo «no pude preguntar». → comprobación: el caso de la
   respuesta con sólo errores, en el test de `ramasDeGithub`.
3. **Metí una lectura de la plataforma para encontrar `gh`** y el tope de SCRUM-702 (ficheros que leen
   una señal del entorno: 20) saltó a 21. No lo cazó `guards:entrada`, que salió verde: lo cazó correr los
   117 tests que enumeran `scripts/`, `tests/` o `docs/master/`. → Quitada la lectura: se prueba la ruta y,
   si no existe, se usa el `gh` del PATH. El tope sigue en 20.
4. **El ticket describe mal el mecanismo, y lo abrió este puesto:** dice que el enlace entra por arrancar
   en el checkout compartido. Medido, no aparece al arrancar sino tras un `git push`. El defecto que
   describe es cierto; su explicación, no.
