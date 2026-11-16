# SCRUM-1680 · PILOTO-1 · TRABAJOS · la ficha no dejaba terminar ni cerrar, y un trabajo cerrado pedía «Hacer presupuesto»

**Medido contra:** `origin/main` = `8a1acbac51e9bc574c94fdb64128378b75d613c8` · 2026-11-11T10:16:34Z

A9: comprobación → `tests/scrum1680-ficha-terminar-y-cerrar.test.mjs`

**Skill UI:** no cargada · no hay diseño nuevo: dos botones con las clases que ya llevan sus vecinos
(`btn-secondary btn-sm job-toolbar-btn-44`, la de «+ Añadir gasto»; el «⋯» es `overflowMenu`; el
modal es `jobsModal` con `jobCierreSection` entera). Cero CSS, cero tokens.

Puesto: S2. Rama `scrum-1680-ficha-terminar-y-cerrar`. Ficheros tocados (carril S2):
`public/dashboard/js/jobDetailView.js`, `public/dashboard/js/jobActionsRegistry.js`,
`tests/scrum1680-ficha-terminar-y-cerrar.test.mjs`. `jobsView.js` (la lista, S4) y la escalera
`jobNextAction.js` NO se tocan: sólo se leen.

Plan de partida: SCRUM-1680 c.21437 (la S2 anterior, medido en el código).

## Alcance de esta rama: A + B

| punto de la aceptación | qué se hace |
| --- | --- |
| A · un trabajo `en_curso` se puede terminar desde su ficha | «✅ Marcar terminado» en la cabecera, SECUNDARIA (la segunda de la ley, que estaba libre) → `PATCH /admin/jobs/:id {status:'terminado'}` + toast «✅ Trabajo terminado» |
| A · uno `terminado` se puede cerrar desde ella | «Cerrar trabajo» en el «⋯» de la cabecera (acto irreversible, SCRUM-344) → modal «Cerrar trabajo» con `jobCierreSection` ENTERA (título, explicación, aviso de saldo, botón) → `PATCH {status:'cerrado'}` + «🔒 Trabajo cerrado». El modal se cierra antes de pedir |
| B · un trabajo cerrado no ofrece «Hacer presupuesto» | `huecosVisibles` quita el hueco `sin-presupuesto` cuando `job.status === 'cerrado'` |
| B · …ni «Enviar para firmar» | **NO SE HACE, por decisión de producto** (orquestador, encargo a S2 del 11-nov-2026): cerrar un trabajo deja el albarán «así» (texto firmado n.º 4, SCRUM-1656 c.21405/c.21408), pero NO lo vuelve infirmable; la acción sigue disponible. La escalera ya da `null` en cerrado (`jobNextAction.js:143`); la acción que queda es la de la FILA del albarán, y se queda |
| C · «Partes por valorar» enseña el cliente | **FUERA de esta rama**: `parteOficinaView.js` ya pinta `p.clienteNombre`; si en prod no sale, es el servidor → medición de la cola de S1 |

Los puntos 4 y 6 (P2) siguen en SCRUM-1662 y SCRUM-1678 (c.21434).

## Textos (regla 30/39): ninguno nuevo

Todos salen literales de la lista (`jobsView.js`, su «⋯»): «✅ Marcar terminado», «✅ Trabajo terminado»,
«Cerrar trabajo» (título del modal y de la opción), «🔒 Trabajo cerrado»; el cuerpo del modal es
`CIERRE_TEXTOS` vía `jobCierreSection`. El fallo usa el rótulo que ya tenía la primaria de esta
pantalla («No se pudo completar la acción», por `mensajeDeFallo`).

## Por qué así y no por la escalera

Un `kind` nuevo en `jobNextAction` obliga a cablearlo en las DOS pantallas (guard de SCRUM-823) y la
lista es de S4. Además cerrar no puede ser primaria (SCRUM-344). Las dos acciones entran por el
REGISTRO de la cabecera (`jobActionsRegistry.js`), que es la única vía que admite el guard de SCRUM-316;
la ley queda en 1 primaria · 2 secundarias (`btnGasto`, `btnTerminar`) · «⋯» (`btnCerrar`).

## Pruebas

- Rojo primero (`8a1acbac5` sin el arreglo): 3 de 4 en rojo, por el motivo esperado — «Cabecera:
  ["+ Nuevo albarán"]» (no hay terminar), «⋯: []» (no hay cerrar), «el trabajo cerrado sigue pidiendo
  "Hacer presupuesto"». El control (agendado / cerrado sin terminar ni cerrar) pasaba ya.
- Verde con el arreglo: los 104 ficheros que leen la ficha o el registro, 945/945 (1 salto previo).
- Control positivo del buscador de B: el mismo trabajo sin presupuesto, en curso, SÍ enseña «Hacer presupuesto».

## Visto en yaqu.app con la rama servida (prod `8a1acbac5`, cuenta QA, sólo GET)

Sonda `sondas-s2/prod-1680.mjs <arbol|-> <carpeta> simular` (fuera del repo). La cuenta QA tiene 4
trabajos y ninguno en curso ni terminado: esos dos estados se fotografían sobre el trabajo REAL #79
(cerrado) con el estado cambiado SÓLO en la respuesta GET de su ficha — rotulado «simulado» en la salida
y en el nombre de la captura. Testigo: con la rama, el registro servido lleva `btnTerminar`. 0 no-GET, 0 errores.

| estado de #79 | prod a pelo | con la rama |
| --- | --- | --- |
| en curso (simulado) | cabecera: «Enviar para firmar» | + «✅ Marcar terminado» 154×44 (390 y 1280) |
| terminado (simulado) | cabecera: «Enviar para firmar» | + «⋯» 44×44 → «Cerrar trabajo» (hoja inferior a 390) |
| cerrado (real) | «Hacer presupuesto» SÍ | «Hacer presupuesto» NO · «Enviar para firmar» de la fila del albarán SIGUE (decisión) |

Sin desborde horizontal a 390 ni a 1280. Capturas: `docs/master/evidencias/scrum1680/`.

Pendiente tras el merge (regla 42): la misma sonda con `-` contra prod, y cerrar el ticket con C fuera
(cola de S1) declarado.
