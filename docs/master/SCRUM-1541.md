# SCRUM-1541 · `--is-ancestor` tiene tres respuestas: un 128 ya no se lee «rama viva», y un clon somero no se mide

**Medido contra:** `origin/main` = `099cfd383764b8cd87ab78e9ef7df8ca57a206a7` · 2026-10-14T16:36:19Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1541-el-128-no-es-un-1.test.mjs`

Sesión 5 (equipo de Luis), por encargo del orquestador del 14-oct. La rama va apilada sobre la de
SCRUM-1539b (`scrum-1539b-una-sola-lectura-del-remoto`), porque las dos tocan las mismas dos
funciones: hasta que 1539b entre, el diff de este PR lleva también el suyo.

## En corto

| aceptación (del ticket) | dónde se ve |
| --- | --- |
| ① Distinguir TRES resultados | `scripts/censo-regla-42.mjs`: `ancestro()` devuelve `SI`, `NO` o `NO_SE_SABE`, cada uno con su porqué; `tests/scrum804b-…`: su propia lectura de los tres códigos |
| ② Decidir qué hace el censo con un «no se puede saber» | **NO DECIDIBLE, con su motivo** (abajo, por qué no «viva») |
| ③ Un guard sobre la dependencia de `fetch-depth: 0` | `scrum804b` cae en un clon somero con «CIEGO · CLON SOMERO … necesita `fetch-depth: 0`», y `scrum1541` ③ lo comprueba en un clon somero hecho a propósito |
| ④ Verlo en ROJO primero, reusando el montaje de jv-j6j | abajo: su `codigos-de-is-ancestor.mjs` en un clon de profundidad 1, y el censo REAL de `main` en ese clon |

## El rojo, antes de tocar nada

Un clon de profundidad 1 del repositorio (`git clone --depth 1`), y en él el guion de jv-j6j
(`evidencias/SCRUM-1539/codigos-de-is-ancestor.mjs`), sin cambiarlo:

| clon | `scrum-N` (105) | todas (166) | controles: ancestro de verdad · sha ausente · sin ref |
| --- | --- | --- | --- |
| profundidad 1 | **128: 105** | 0: 1 (`main`) · 128: 165 | **128** · 128 · 128 |
| completo (este árbol) | 0: 18 · 1: 87 | 0: 20 · 1: 146 | 0 · 128 · 128 |

En el somero, hasta el control «ancestro de verdad» (`origin/main~1`) sale 128: el padre no está.

Y el censo REAL de `main` (`099cfd383`), sobre `scrum-1039-citas-contabilidad`, una de las 18 ramas
mergeadas y sin borrar:

| clon | veredicto |
| --- | --- |
| somero | **FUERA** · «rama viva SIN mergear: scrum-1039-citas-contabilidad» |
| completo | DENTRO · «entrada en main + 5/5 artefactos suyos presentes» |

## Qué cambia

- **`ancestro(sha, main, { somero })`**, en el censo. Salida 0 → `SI`. Clon somero y cualquier otra
  salida → `NO_SE_SABE`: con la historia cortada, ni el 1 ni el 128 prueban nada. Clon completo y 1
  → `NO`. Clon completo, 128 y el sha ausente del almacén → `NO`, **como deducción declarada**: con la
  historia entera de la rama principal, un commit que no está aquí no es suyo. Lo demás →
  `NO_SE_SABE`.
- **La foto de `leerRemoto` lleva `somero`** (`rev-parse --is-shallow-repository`); si no contesta,
  cuenta como somero.
- **`clasificar`**, paso ①bis: una rama de la que no se sabe si está mergeada deja el ticket en NO
  DECIDIBLE, con el motivo. Va detrás de ① (una rama viva SEGURA sigue siendo FUERA) y delante de
  ② (la entrada en main ya no basta para DENTRO si hay una rama en duda).
- **`scrum804b`** lee los tres códigos con su propia orden, no con la del censo: el control sigue
  siendo independiente. Y si el clon es somero no elige negativo: cae con «CIEGO · CLON SOMERO» y
  dice qué arreglar.

## ② Por qué NO DECIDIBLE y no «viva»

El ticket daba las dos como legítimas. «Viva» es FUERA, y FUERA en este censo afirma que hay obra sin
mergear: con la historia cortada, eso es afirmar lo que no se ha visto, y en el clon somero de hoy
habría sacado FUERA los 18 tickets cuya rama está mergeada. NO DECIDIBLE ya cuenta **del lado malo**
(no cierra nada) y además lo dice. Riesgo de esta elección, declarado: en un clon somero el censo deja
de ver las ramas vivas de verdad (salen NO DECIDIBLE en vez de FUERA). Se ve, porque el motivo dice
«clon SOMERO», y el test de la regla 42 no se queda callado: cae.

## ③ El guard de la dependencia, y por qué no lee `ci.yml`

El ticket pedía que algo vigilara `ci.yml:147`. Un guard que leyera esa línea se quedaría corto:
vigilaría UNA forma de cortar la historia (`fetch-depth`) en UN fichero. Lo que se comprueba ahora es
el EFECTO, en el propio job: si el clon es somero, por la causa que sea, `scrum804b` cae y nombra
`fetch-depth: 0`. Y como desde el job completo eso no se puede ver caer, `scrum1541` ③ corre el
`scrum804b` REAL dentro de un clon somero de un remoto sintético y exige ese rojo, con ese texto.

## Rojo y verde del test nuevo

`tests/scrum1541-el-128-no-es-un-1.test.mjs`: un remoto desnudo con `main` (A, B), `scrum-7-mergeada`
en A y `scrum-8-viva` con un commit más; un clon completo y uno de profundidad 1 (en el que A no está).

| caso | con el código de antes (`ab76a1729`, la punta de 1539b) | con el arreglo |
| --- | --- | --- |
| CONTROL: el banco es lo que dice ser | ✔ | ✔ |
| ① clon completo (control de ②) | sus veredictos ✔; cae sólo en el campo nuevo `somero` | ✔ |
| ② clon somero | **✖ «SCRUM-7 sale FUERA en un clon somero (rama viva SIN mergear: scrum-7-mergeada)»** | ✔ |
| ③ `scrum804b` en el clon somero | **✖** cae, pero no por el clon | ✔ |

Guards de entrada, de registro y vecinos (22 ficheros, `scrum723`, `scrum976`, `scrum708`,
`scrum864c`, `scrum1281`, `scrum1520d`, `scrum804b`, `scrum1539b`…): 152 de 152, 0 saltados.
`scrum723` cayó al primer intento por dos textos de mi motivo que decían «main»: se reescribieron.

## Lo que NO he medido

- **Cuántas «vivas» de CI lo son hoy por un 128** (el ticket lo dejaba en inferido). En este árbol,
  0: aquí están traídas todas las ramas y las no mergeadas dan 1. Dentro de un runner, no lo he mirado.
- Si algún otro workflow corre con profundidad somera: no lo he buscado. Este arreglo no depende de
  ello, porque mira el clon y no el workflow.
- `enlace-ticket-rama.mjs` y los otros cinco ejecutores de `--is-ancestor` que clasificó SCRUM-1540 ⑤:
  no están aquí. Éste es el de la regla 42.
- Linux: el obligatorio del PR será la primera pasada.

## Primera pasada del obligatorio (14-oct-2026 16:58Z, PR #2467): ROJO, y era MÍO

Run 38600134843: 11.513 tests, 2 fallos, los dos del trinquete de SCRUM-1349
(`scrum1349-entorno-prestado-solo-baja`). El acusado era mi test nuevo: `censoEn()` lanzaba el
`node` hijo sin `env`, y heredaba FORCE_COLOR/NODE_OPTIONS/NODE_TEST_CONTEXT del runner. No era
`scrum1405c`. Arreglado donde nace (`{ ...process.env }` y se borran las tres, la forma de los bancos de
1102f y 1436): en local, `scrum1349` y `scrum1541` dan 13 de 13. El rojo con el código anterior es ese
log de CI; no lo he repetido en local.
