# SCRUM-1259 · ¿Qué tickets siguen ABIERTOS en Jira con su trabajo ya en `main`? — 90 candidatos de 203

**Medido contra:** `origin/main` = `d216084a67b1f42e69b829e5829420562873e528` · 2026-09-28T22:12:24Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier. El 28-sep se repartieron **seis** encargos ya
hechos (1224, 1204, 1223, 1200, 825, 1101). La causa: Jira no se cierra al ritmo al que se entrega, así que su
estado no dice qué queda por hacer.

    node scripts/abierto-con-trabajo-en-main.mjs --jira p1.json p2.json p3.json     # la foto: JSON del MCP
    node scripts/abierto-con-trabajo-en-main.mjs --jira … --ticket 1200              # el detalle de uno

**Sólo LEE**, sin escribir nada en Jira ni en el repo. **Da candidatos para LEERLOS, no para cerrarlos**: cerrar
sigue siendo A13, del orquestador, leyendo el ticket.

## Por qué es un fichero propio y no un veredicto más de `enlace:ticket-rama`

Se leyó entero `scripts/verificacion-s5/enlace-ticket-rama.mjs` (SCRUM-637) antes de escribir nada. Mide otra
pregunta: si las cuatro fuentes del ENLACE concuerdan. Además:

- **No exporta nada**: corre al cargarse y acaba en `process.exit`. Reusarlo obliga a modificarlo, y es de la S5,
  no de J6.
- **Empareja las ramas por NÚMERO** (`numDe`), que es justo la trampa ①.
- **Su foto de Jira** (`docs/verificacion/asuntos-jira.tsv`) es del **7-sep**.

Lo que sí se hereda son sus dos lecciones de git: la autoridad de «qué rama vive» es `ls-remote`, y una rama
mergeada y borrada sólo sobrevive en el asunto de su merge.

## La foto de Jira, y su caducidad

La lee de un fichero que le pasa quien lo corre. Puede ser el **JSON que guarda el MCP** de Atlassian
(`searchJiraIssuesUsingJql` con `statusCategory != Done`, todas las páginas) o un TSV. Imprime la fecha (la de
modificación del fichero, o `--tomada`).

**Con más de 12 h, o sin la última página (`hasNextPage:false`), se declara CIEGO y sale 2 sin tocar git**:
con una foto vieja, «abierto» ya no es una afirmación.

Medición de hoy: 3 páginas (100 + 100 + 3), la última con `hasNextPage:false`, tomada a las 22:03:39Z.

## El resultado, sobre 203 abiertos

| veredicto | n | qué es |
| --- | --- | --- |
| 🔴 **CANDIDATO** | **90** | todo lo que se ve de él está en main (rama por slug, expediente propio o commits `SCRUM-n:`), y no hay rama suya fuera |
| 🟠 CERRADO EN OTRO | 0 | sin nada propio, pero otro expediente dice «cerrado aquí» (ver el control de ②) |
| 🟡 CON MOTIVO ESCRITO | 27 | trabajo en main, y Jira espera a otro (9 «Acción del fundador», 3 «En revisión») o el título de su expediente lo declara (BLOQUEADO, PARADO, PASO 0, «NO se construye»…). **Se lista, no se esconde** |
| 🟡 PARCIAL | 4 | parte en main y una rama suya viva sin mergear |
| ⚪ EN CURSO | 3 | sólo ramas sin mergear |
| · SIN RASTRO | 79 | nada con su número (≠ «sin hacer», límite ③) |
| CIEGO | 0 | tras `git fetch`: sin él salieron 2, dos ramas empujadas después con un sha que el clon no tenía |

Casos conocidos, medidos:

| caso | lo que se sabía | lo que sale |
| --- | --- | --- |
| 1194, 1214 | hechos (el orquestador los cierra) | CANDIDATO ✅ |
| 1218, 1244 | sus PR (#1935, #1936) mergeados a las 21:39 y 21:45Z | CANDIDATO ✅ |
| 1200 | hecho, y además «cerrado aquí» en `SCRUM-1216.md` §⑦ | CANDIDATO, y la línea `SCRUM-1216.md:131 «## ⑦ SCRUM-1200, cerrado aquí»` ✅ |
| 825 | hecho, y en Jira «Acción del fundador» | CON MOTIVO ESCRITO: se ve, pero no en rojo |
| 1101 | hecho bajo SCRUM-1097 sin nombrar el 1101 | SIN RASTRO: el límite ③, real |
| **1179, 1215, 1232, 1016** | **abiertos a propósito, con trabajo parcial en main** | **PARCIAL, NO marcados** ✅ (el control que pidió el orquestador) |
| 1063-1077 | «BLOQUEADO, motivo medido» | CON MOTIVO ESCRITO ✅ |

## Las tres trampas del encargo

- **① Por slug completo.** Cada rama se juzga por su nombre entero. Una sola rama suya sin mergear hace PARCIAL
  al ticket, aunque tenga otras dentro.
- **② El número en TODO `docs/master/`**, separando la línea que dice cierre («cerrado aquí», «arreglado en»,
  «hecho bajo», «lo cubre»…) de la que sólo cita. En toda la población salen **3 líneas**: una es el caso
  real (`SCRUM-1216.md:131` para 1200) y **dos son ruido sabido**. `SCRUM-1119.md:48` trae una frase de cierre
  sobre otro ticket de la misma fila, y `SCRUM-1200.md:11` cita «SCRUM-1200, cerrado aquí» nombrando a 1216,
  así que se le apunta a 1216. Por eso es un cribado para leer. La frontera es de letra
  Unicode: con `\b`, «sólo cubre» casaba con «lo cubre» (`SCRUM-1092.md:69`).
- **③ 🔴 NO RESUELTA, declarada.** Que el defecto esté arreglado sin rama, commit ni expediente con su número.
  1101 es el caso real. Para eso sigue haciendo falta el PASO 0 por CONTENIDO.

## Discriminadores probados

- **Palabras de «pendiente» en el CUERPO del expediente: DESCARTADO.** 95 de 112 candidatos las tienen, porque
  todo expediente habla de lo que queda.
- **El ESTADO de Jira que espera a otro y el TÍTULO del expediente: ADOPTADOS.** Apartan 27 de 117. Falso
  negativo conocido: `SCRUM-323` («PASO 0: el mapa — y el bloqueo del ticket ya está resuelto») se aparta por
  «PASO 0» aunque diga resuelto.

## Límites declarados

- **Un ticket por partes (A18)** con la primera en main y las demás sin empezar sale CANDIDATO: no se distingue.
  Por eso un candidato se LEE antes de cerrar.
- **Una rama abandonada sin mergear** deja al ticket en PARCIAL y lo aparta del rojo: el error va en la otra
  dirección (esconde un candidato).
- Sólo ve commits cuyo asunto EMPIEZA por `SCRUM-n`, y ramas `scrum-n…`. Lo que entre con otro nombre es ③.

## Visto en rojo

Con el instrumento commiteado (`4a503e45`, el mismo que se empuja salvo este registro) y restaurado con `git restore --source=HEAD` tras cada mutación,
`tests/scrum1259-abierto-con-trabajo-en-main.test.mjs` (10 casos fabricados) cae en las **6**:

| mutación | cae |
| --- | --- |
| M1 · sin la regla PARCIAL (trampa ①) | ① |
| M2 · sin mirar los expedientes AJENOS (trampa ②) | ② |
| M3 · sin el «abierto con motivo» | el control del abierto legítimo |
| M4 · sin exigir la última página | la foto |
| M5 · sin la caducidad | la foto vieja |
| M6 · la frontera vuelve a `\b` | «sólo cubre» |
