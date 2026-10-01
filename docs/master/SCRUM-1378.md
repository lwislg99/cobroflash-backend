# SCRUM-1378 · En el latido, un PR es de quien lo EMPUJÓ, no de quien lo cita

**Rama:** `scrum-1378-latido-pr-de-quien-empujo` · **Carril:** S5 (s5-1octd) · **Fecha:** 1-oct-2026
**Medido contra:** `origin/main` = `31688d6b550ea0bbc1b99b381fdf857b821bdec9` · 2026-10-01T13:45:00Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5. Sólo `scripts/equipo/latido.mjs` y su test.

## Qué pasaba

La sección SESIONES decía «ya NO trabaja y su PR #N sigue rojo: nadie vuelve» cruzando cada sesión con
los PR de `children` de su `state.json`. Lo midió la S0 el 1-oct: `children` son los PR que la sesión
**cita**, no los que abrió — el #1681 sale en cuatro sesiones que no lo abrieron. El latido podía
señalar a una sesión por un PR que sólo había mencionado.

Quien reparte lee el latido cada turno y actúa sobre él. Un aviso que señala al que no es se deja de
leer entero, y con él se pierden los buenos.

## El cambio

- **Un PR es de la sesión que empujó su rama**, leído de los `git push` de su transcript. Con la
  función `ramasEmpujadas` del hook de cierre de la S0 (`.claude/hooks/latido-cierre.mjs`, SCRUM-1356),
  importada: no hay un segundo lector de «qué empujó».
- `children` deja de leerse. `leerTrabajos` ya no devuelve `prs`.
- El cruce es por **rama** (la del PR abierto contra las que empujó cada sesión), no por número.
- **Si nadie leído empujó la rama** de un PR con problema, no se acusa a nadie: la población dice
  «N PR con problema y NO SUPE DE QUIÉN SON (#…)».
- **Si el transcript de una sesión no se deja leer**, la sección sale «NO PUDE MIRAR» nombrándola
  (salida 2). No es «no empujó nada». Lo que sí se pudo atribuir sigue saliendo debajo.
- **Una sesión que no llegó a escribir un turno** (sin ruta de transcript en su registro y sin jsonl
  con su id en ninguna carpeta) se cuenta aparte y no ciega: sin un turno no hay `git push`.
- **El relevo no hereda la culpa.** Si una de las sesiones que empujó la rama sigue trabajando, no se
  avisa. Si empujaron dos y las dos pararon, sale UNA línea que nombra a las dos.

## Medido contra las sesiones reales (1-oct-2026)

| Qué | Antes (`origin/main`, 13:33Z) | Con el cambio (13:44Z) |
|---|---|---|
| Sesiones leídas | 27 de 24 h, por `children` | 28 de 24 h: 26 por su transcript, 2 sin turno (`s3-1octb`, `s1-1octb`) |
| Avisos de «nadie vuelve» | 4 | 4, cada uno con la rama que esa sesión empujó |
| PR con problema sin dueña conocida | no se decía | 4 (#2072, #2054, #2051, #2049), dicho en la población |
| Tiempo del tramo | 0,0 s | 0,3-0,4 s (lee ~58 MB de transcripts) |

No he encontrado en la pasada de hoy una acusación falsa concreta que el cambio retire: las cuatro de
antes coincidían con quien empujó. El caso que lo motiva (#1681 en cuatro sesiones) es de la S0 y ya
no estaba abierto; aquí queda cubierto por el test, no por una pasada real.

## Comprobado

| Qué | Resultado |
|---|---|
| Dirigida `tests/scrum1350-latido.test.mjs` + `tests/scrum1356-latido-enganchado.test.mjs` | 51 tests, 51 pasan, 0 saltados |
| Sólo cita el PR (`children`) y no lo empujó | no sale |
| Lo empujó y ya no trabaja | sale, con su rama |
| Nadie leído empujó la rama | cero avisos, «NO SUPE DE QUIÉN SON (#10)» |
| Un transcript ilegible | sección ciega, salida 2, con el nombre |
| Empujaron dos y una sigue trabajando | no sale; con las dos paradas, una línea con las dos |
| El latido real desde el árbol | salida 1, sección SESIONES con población y cuatro avisos |

## Lo que NO cubre, y límites

- **Hereda los límites de `ramasEmpujadas`**: un `git push` sin nombre de rama, o con la rama en una
  variable, no deja rastro. Ese PR cae en «no supe de quién es», no en una sesión equivocada.
- **Sólo sesiones con actividad en 24 h.** Un PR rojo de hace tres días no tiene dueña conocida para
  esta sección: lo dice. Los cuatro de hoy son de ese tipo (7-10 h o más, de sesiones ya fuera de la
  ventana o que empujaron sin nombrar la rama; no he distinguido cuál de las dos).
- Una sesión que empuja la rama de OTRA para traerle `main` queda como una de las que la empujó. Es
  lo que hizo; no lo he tratado aparte.
- «No llegó a escribir un turno» se deduce de que no hay jsonl con su id en ninguna carpeta de
  proyecto. Si alguien borra transcripts a mano, esa sesión se contaría ahí y no como ciega.

## Dependencia

Importa de `.claude/hooks/latido-cierre.mjs`, que entra con #2097 (SCRUM-1356). Esta rama se empuja
con #2097 ya en `main`; si se empujara antes, el import no resuelve y cae toda la tanda del fichero.

## Mis errores

1. Escribí los tests con un número de ticket supuesto (1373) antes de abrirlo; el real es 1378 y el
   1373 era de otra sesión. Lo corregí antes del primer commit. La referencia se lee, no se deduce.
2. La primera versión cegaba la sección entera por dos sesiones que nunca arrancaron: habría salido
   «NO PUDE MIRAR» en cada pasada durante 24 h cada vez que un lanzamiento no cuaja. Lo vi al correrlo
   contra el registro real, no en los tests.
