# SCRUM-1859 · La cola única pasa a la ficha de la versión en curso, y la línea fija de mantenimiento e instrumentos

**Medido contra:** `origin/main` = `61163dfcf08c715600babc34f114508c1d77057d` · 2026-11-25T15:12:00Z

A9: aviso → A10 «Cero resultados con tu vocabulario no es silencio del documento.» — no se pudo comprobar: ningún guard sabe con qué abreviaturas nombra el máster a una de sus partes; el `grep` del encargo («Parte U», «Sprint Registry», «cola única») no veía «en U» (máster :1840 y :1847, `CLAUDE.md`:71) ni el espejo `.agents/skills/`, y lo cazó ampliarlo antes de escribir

25-nov-2026 · **J4** (sesión `jv-j4ck`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2d`).
Carril a mano: el máster, `CLAUDE.md` y `.claude/` son «de un jefe» (`node scripts/carriles.mjs de`); los
toca este PR porque el cambio lo firma el fundador. Etiquetas leídas en SCRUM-1859: `area-j4`,
`cambio-de-master`, `equipo-javier`, `fundador`, `v1.1`.

## Qué es

**Un cambio de máster firmado por el fundador**, en dos piezas y un solo PR:

1. **La cola única** deja de ser la Parte U y pasa a ser la ficha de la versión en curso, en Jira; la Parte U
   apunta a ella y guarda lo de debajo como histórico. Firma: `SCRUM-1835` c.22775, literal «2-Sí firmo».
2. **Una línea fija de mantenimiento e instrumentos**, fuera de las versiones y con tope. Firma: `SCRUM-1835`
   c.22791, literal «1-Sí firmo». La cifra del tope no la había fijado nadie: va propuesta abajo.

Lo acepta el orquestador del otro equipo en `SCRUM-1835` c.22778 (A1 y A4). La regla de que nada entra a una
versión sin constar en su ficha y que lo cierran los dos orquestadores viene de c.22761 y c.22776.

## Qué cambia, línea a línea

Todo **en sitio**: ni el máster ni `CLAUDE.md` cambian de número de líneas (1.951 y 205). Motivo, medido: hay
315 anclas `YAQU_MASTER.md:<línea>` en el repo, 59 de ellas a líneas por debajo de la 990 (12 fuera de
`docs/master/` y 47 dentro), y `tests/scrum525d-anclas-que-apuntan.test.mjs` caza el ancla que apunta a otra
cosa. Por eso el párrafo nuevo de la Parte U ocupa la línea en blanco que había entre la cabecera y `## U1`.

| fichero:línea | antes | después | ¿estaba en el encargo? |
|---|---|---|---|
| máster :991 | cabecera «(cola única — regla 31)» | «(histórico; la cola única es la ficha de la versión en curso — regla 31)» | sí |
| máster :992 | línea en blanco | el párrafo: cola única, las cuatro fichas, histórico, y la línea fija con su tope | sí |
| máster :248 | regla 31 | se conserva y se le añade «Superada el 25-nov-2026 …», con la forma que ya usa la 33 en la misma línea | sí |
| máster :31 | «obedecer el Sprint Registry (Parte U)» | «obedecer la ficha de la versión en curso … (la Parte U apunta a ella; regla 31)» | sí |
| máster :5 | «Sprint activo: VALIDA-0 (Parte U)» | tachado, y «Cola única: la ficha de la versión en curso» | **no**: es la fuente de `CLAUDE.md`:9 |
| máster :1840 | AA1.1 «localizar el sprint activo en U» | «ir a la ficha de la versión en curso (Jira), a la que apunta U» | **no**: es la fuente de `CLAUDE.md`:37 |
| máster :1847 | AA1.7 «done/evidencias en U» | «done/evidencias en la ficha de la versión en curso, a la que apunta U» | **no**: es la fuente de `CLAUDE.md`:71 y de la skill de cierre |
| `CLAUDE.md`:9, :37, :107 | Parte U como cola | la ficha de la versión en curso | sí |
| `CLAUDE.md`:71 | «done/evidencias en U» | «en la ficha de la versión en curso» | **no**: misma mención, escrita «en U» |
| `.claude/skills/yaqu-sprint/SKILL.md` paso 1 | Parte U, cola única, orden de U | la Parte U apunta a la ficha; nada entra sin constar en ella | sí |
| `.claude/skills/yaqu-release-check/SKILL.md` descripción y paso 4 | done en la Parte U | done en la ficha | sí |
| `.agents/skills/` (las dos) | — | copia exacta de las de `.claude/` | **no**: lo exige `tests/scrum1089b-espejo-skills-agentes.test.mjs` |

Las cuatro filas «no» son consecuencia de las que sí: sin ellas, un derivado diría lo contrario que el máster
del que deriva (regla 35), o el espejo saldría en rojo. Se quitan si el fundador no las quiere.

**Por qué no es una regla nueva:** la cabecera de la Parte I dice «(1-44; cerradas)» y la vigila
`tests/scrum637-un-numero-una-regla.test.mjs`. La línea fija va en la Parte U y la regla 31 la nombra.

## Corrección a la descripción del ticket

La descripción dice «la regla 6 y la regla 31 del máster». La **regla 6 del máster** es «Crons in-process»
(máster :241) y no nombra la Parte U: no se toca. La «regla 6» que hace de la Parte U la cola es la **regla
dura 6 de `CLAUDE.md`** (:107), que sí cambia aquí. Y el encargo decía que la 6 del máster es «Competencia ES»:
eso es el punto 6 de una lista en el máster :73, no una regla.

## El tope de la línea fija · cifra a firmar

**Propuesta: a lo sumo UNA sesión por equipo trabajando en la línea a la vez.**

Motivo: desde el 18-nov-2026, el equipo J ha cerrado **11** tickets con las etiquetas `instrumentos` y
`equipo-javier`, de **69** cerrados con `equipo-javier`: el 16 %. Una sesión de seis puestos es el 17 %. El tope
pone como techo la proporción que ya hay, y se comprueba al repartir.

Medido en Jira el 25-nov-2026 hacia las 15:10Z con
`labels = instrumentos AND labels = equipo-javier AND statusCategory = Done AND resolutiondate >= "2026-11-18"`:
SCRUM-1731, 1773, 1765, 1789, 1801, 1527, 1610, 1827, 1831, 1839 y 1842. Población: 75 tickets llevan las dos
etiquetas en cualquier estado. Control positivo: SCRUM-1731 se resolvió el 18-nov a las 12:16 (+01:00) y sale
en la lista. La fecha límite se calcula en el huso de Jira.

**Sin medir:** cuántas de esas 11 corrieron a la vez, qué puestos las llevaron y si hay piezas de mantenimiento
con otra etiqueta. Si dos o tres corrieron en paralelo, el tope recorta más de lo que dice la proporción.

## Lo que queda citando la Parte U fuera de este PR

| dónde | qué dice | qué se hace |
|---|---|---|
| máster :1785 y :1827 | «la cola única de la Parte U», «cola única U» | sigue siendo cierto, porque U apunta a la ficha; no se toca (no es la Parte U ni la regla 31) |
| máster :1049 | «reordenar SIF-1 (reglas 31 y 6)» | la 6 del máster no trata de eso; ya estaba así y no se toca |
| máster :1862 | la skill: «registry → sprint activo → plan» | sigue siendo cierto (el registry es la Parte U) |
| `docs/equipo/puesto-j1.md`:7 | «(SIF-1, Parte U)» | **de J1**: no lo toca este PR |
| `docs/PENDIENTES_FUNDADOR.md`:18, :21, :247 | la Parte U como cola y como historial | sin dueño en `dos-equipos.md` §3 |
| `docs/RUNBOOKS.md`:775 | «SIF-1 8/8 en la Parte U (sprint registry)» | sin dueño en §3; sigue siendo cierto (el histórico de SIF-1 está allí) |
| `docs/SPRINT_DEMO_READY.md`:13, `docs/BUG_BASH_LANDING.md`:128, `docs/producto/ESTADO-DEL-PRODUCTO.md`:268 | citan la Parte U o una fila suya | sin dueño en §3; documentos de su fecha |
| `docs/historico/` (dos ficheros) | — | históricos: no se tocan |
| `tests/scrum1323-resumen-vs-detalle-sif1.test.mjs` | lee el resumen de SIF-1 de la Parte U | no fija la Parte U como cola; sigue en verde (abajo) |

## Comprobaciones

Sobre el árbol de esta rama, con `dist/` compilado (`tsc -p . --noCheck`; no hay cambios en `src/`):

- `npm run guards:entrada`: 17 guards, 186 tests, 186 pass, 0 fail, 0 skipped. Salida 0.
- Dirigida, 50 ficheros: los 22 `tests/*.test.mjs` que nombran `YAQU_MASTER` (de los 34 ficheros de
  `tests/` y `scripts/` que lo nombran; los otros 12 son scripts y ayudantes, no ficheros de test; no he medido cuáles de ellos importa la dirigida), los
  que leen `CLAUDE.md` o las skills, 237, 976, 700, 1294, 267, 854, 719, 525d, 637, 1089b, 273, 419 y los
  cinco de árbol entero que `guards:entrada` manda correr a mano (195, 414, 694, 710b, 737). Resultado: 547
  tests, 547 pass, 0 fail, 0 skipped. Contando las líneas que EMPIEZAN por `ok` y `not ok`: 547 y 0, que
  suman el total. Las dos apariciones de «# SKIP» del TAP están dentro del nombre de un test de SCRUM-1328,
  no son saltos.
- Rojo primero del espejo: con `.agents/skills/yaqu-sprint/SKILL.md` devuelto a su versión de `HEAD`,
  `tests/scrum1089b-espejo-skills-agentes.test.mjs` da 2 fallos de 5; con la copia, 5 de 5.
- La suite entera NO se ha corrido: el encargo lo prohíbe en esta sesión.
