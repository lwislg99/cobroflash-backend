# SCRUM-1259 · ¿Qué tickets siguen ABIERTOS en Jira con su trabajo ya en `main`? — 91 candidatos de 203

**Medido contra:** `origin/main` = `d216084a67b1f42e69b829e5829420562873e528` · 2026-09-28T22:12:24Z

J6 (jv-j6), por encargo del orquestador del equipo de Javier. El 28-sep se repartieron **seis** encargos ya
hechos (1224, 1204, 1223, 1200, 825, 1101). La causa: Jira no se cierra al ritmo al que se entrega, así que su
estado no dice qué queda por hacer.

    node scripts/abierto-con-trabajo-en-main.mjs --jira p1.json p2.json p3.json     # la foto: JSON del MCP
    node scripts/abierto-con-trabajo-en-main.mjs --jira … --ticket 1200              # el detalle de uno

**Sólo LEE**, sin escribir nada en Jira ni en el repo. **Da candidatos para LEERLOS, no para cerrarlos**: cerrar
sigue siendo A13, del orquestador, leyendo el ticket. Tarda ~90 s con 203 abiertos (el motor consulta git ticket
a ticket), y se corre desde un árbol al día con `main`.

## 🔴 Es una CAPA sobre el motor de la casa, y mi PASO 0 se equivocó

**La primera versión traía su propio censo** de ramas, commits y expedientes: funcionaba, tenía sus tests y sus
6 mutaciones, y **era un segundo censo**, que es justo lo que el encargo prohibía. El motor ya existía:

- `tests/_censo-tickets.mjs` · `censarTicket` (SCRUM-388): «¿qué hay en `main` de UN ticket?». Mira commits,
  entrada de máster y ramas, y declara **NO_MEDIBLE** cuando el número está compartido (SCRUM-738: `SCRUM-684.md`
  titulado para 683). Mi versión no tenía esto último.
- `scripts/_rastro-del-ticket.mjs` · `rastroDeLosTickets` (SCRUM-804): cada rama por su nombre entero, `en-main`
  o `viva`.
- `scripts/censo-tablero-vs-arbol.mjs` (SCRUM-738): los enumera, **y dice en su salida que no lee Jira**:
  «se cruza a mano».

Lo encontré tarde, cuando `SCRUM-723` saltó al entrar mi fichero en su censo de referencias móviles: describía
`censo-tablero-vs-arbol.mjs` con mi misma pregunta. **Busqué en `scripts/verificacion-s5/` y no por concepto.**
Es el tropiezo que confiesa la cabecera de SCRUM-738. Mi motor se retiró. Esta capa añade sólo lo que faltaba:

1. **El cruce con Jira**: una foto de los ABIERTOS, con fecha y caducidad.
2. **La trampa ②**: el número en TODO `docs/master/`, no sólo en la entrada propia.
3. **El motivo escrito** para seguir abierto con trabajo dentro.

### Por qué no `enlace:ticket-rama`

Se leyó entero `scripts/verificacion-s5/enlace-ticket-rama.mjs` (SCRUM-637). Mide otra pregunta: si las cuatro
fuentes del ENLACE concuerdan. **No exporta nada** (corre al cargarse y acaba en `process.exit`), es de la S5,
**empareja ramas por NÚMERO** (la trampa ①) y su foto de Jira es del **7-sep**.

## La foto de Jira, y su caducidad

La lee de un fichero que le pasa quien lo corre: el **JSON que guarda el MCP** de Atlassian
(`searchJiraIssuesUsingJql` con `statusCategory != Done`, todas las páginas) o un TSV.

**Con más de 12 h, o sin la última página (`hasNextPage:false`), sale CIEGO (2) sin tocar git**: con una foto
vieja, «abierto» ya no es una afirmación. Medición de hoy: 3 páginas (100 + 100 + 3), la última con
`hasNextPage:false`, tomada a las 22:03:39Z.

## El resultado, sobre 203 abiertos

| veredicto | n | qué es |
| --- | --- | --- |
| 🔴 **CANDIDATO** | **91** | el motor le ve trabajo en main (commits o entrada propia o rama `en-main`) y no hay rama suya viva |
| 🟠 CERRADO EN OTRO | 0 | nada propio, pero otro expediente dice «cerrado aquí» (el caso real, 1200, tiene además lo suyo) |
| 🟡 CON MOTIVO ESCRITO | 31 | trabajo en main, y Jira espera a otro («Acción del fundador», «En revisión»), o el título de su expediente lo declara (BLOQUEADO, PARADO, PASO 0…), o el motor lo da PARCIAL por marcas sin conectar. **Se lista, no se esconde** |
| 🟡 PARCIAL | 7 | trabajo en main y una rama suya VIVA fuera |
| ⚪ EN CURSO | 1 | sólo una rama viva |
| · SIN RASTRO | 73 | nada con su número (≠ «sin hacer», límite ③) |
| NO MEDIBLE / CIEGO | 0 / 0 | |

Ramas remotas: 153 (18 en main, 135 vivas, 0 sin clasificar). 837 expedientes de `docs/master/`.

| caso | lo que se sabía | lo que sale |
| --- | --- | --- |
| 1194, 1214 | hechos (el orquestador los cierra) | CANDIDATO ✅ |
| 1218, 1244 | sus PR (#1935, #1936) mergeados a las 21:39 y 21:45Z | CANDIDATO ✅ |
| 1200 | hecho, y además «cerrado aquí» en `SCRUM-1216.md` §⑦ | CANDIDATO, con la línea `SCRUM-1216.md:131 «## ⑦ SCRUM-1200, cerrado aquí»` ✅ |
| 825 | hecho, en «Acción del fundador», y con una rama nueva empujada a las 22:14Z (`scrum-825-retirar-generador-j`) | PARCIAL ✅ |
| 1101 | hecho bajo SCRUM-1097 sin nombrar el 1101 | SIN RASTRO: el límite ③, real |
| **1179, 1215, 1232, 1016** | **abiertos a propósito, con trabajo parcial en main** | **PARCIAL, NO marcados** ✅ (el control que pidió el orquestador) |
| 1063-1077 | «BLOQUEADO, motivo medido» | CON MOTIVO ESCRITO ✅ |

**Dos sondas, un desacuerdo, y el desacuerdo era el dato.** Mi primera versión (`ls-remote` a las 22:12Z) no
veía `scrum-825-retirar-generador-j`; el motor sí. La rama se empujó a las 22:14:18Z. Al repetir, las dos coinciden.

## Las tres trampas del encargo

- **① Por slug completo**: la da el motor de 804, rama a rama. Una sola viva hace PARCIAL al ticket.
- **② El número en TODO `docs/master/`**, separando la línea que dice cierre («cerrado aquí», «arreglado en»,
  «hecho bajo», «lo cubre»…) de la que sólo cita. En toda la población salen **3 líneas**: una es el caso real
  (`SCRUM-1216.md:131`, para 1200) y **dos son ruido sabido**. `SCRUM-1119.md:48` trae una frase de cierre sobre
  otro ticket de la misma fila, y `SCRUM-1200.md:11` cita «SCRUM-1200, cerrado aquí» nombrando a 1216, así que
  se le apunta a 1216. Por eso es un cribado para leer. La frontera es de letra Unicode: con `\b`, «sólo cubre»
  casaba con «lo cubre» (`SCRUM-1092.md:69`).
- **③ 🔴 NO RESUELTA, declarada.** Que el defecto esté arreglado sin rama, commit ni expediente con su número.
  1101 es el caso real. Para eso sigue haciendo falta el PASO 0 por CONTENIDO.

## Discriminadores probados

- **Palabras de «pendiente» en el CUERPO del expediente: DESCARTADO.** 95 de 112 candidatos las tienen, porque
  todo expediente habla de lo que queda.
- **El ESTADO de Jira que espera a otro y el TÍTULO del expediente: ADOPTADOS.** Falso negativo conocido:
  `SCRUM-323` («PASO 0: el mapa — y el bloqueo del ticket ya está resuelto») se aparta por «PASO 0» aunque diga
  resuelto.

## Límites declarados

- **Un ticket por partes (A18)** con la primera en main y las demás sin empezar sale CANDIDATO: no se distingue.
  Por eso un candidato se LEE antes de cerrar.
- **Una rama abandonada que sigue viva** deja al ticket en PARCIAL y lo aparta del rojo: el error va en la otra
  dirección (esconde un candidato).
- `docs/master/` se lee **del árbol donde se corre**, como hace `censarTicket`: un árbol viejo ve expedientes viejos.

## Visto en rojo

Con la capa commiteada (`db5b9664`) y restaurada con `git restore --source=HEAD` tras cada mutación,
`tests/scrum1259-abierto-con-trabajo-en-main.test.mjs` (10 casos fabricados con la forma que devuelve el motor)
cae en las **7**:

| mutación | cae |
| --- | --- |
| M1 · sin la regla PARCIAL (trampa ①) | ① |
| M2 · sin mirar los expedientes AJENOS (trampa ②) | ② |
| M3 · sin el «abierto con motivo» | el control del abierto legítimo, y el de las marcas del motor |
| M4 · sin exigir la última página | la foto |
| M5 · sin la caducidad | la foto vieja |
| M6 · la frontera vuelve a `\b` | «sólo cubre» |
| M7 · no respetar el NO_MEDIBLE del motor | el del número compartido |
