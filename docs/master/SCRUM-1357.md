# SCRUM-1357 · El latido: las bloqueadas se leen del registro, y el cementerio de preguntas

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T11:56:53Z

A9: comprobación → `tests/scrum1350-latido.test.mjs`

Carril S5 (`scripts/equipo/latido.mjs` y su test). No toca hooks, ni settings, ni producto. Sigue a
SCRUM-1350, que se cerró partido: lo de engancharlo (`SessionStart`, obligar `cierre`) es SCRUM-1356, de S0.

## Lo que pasó

| Qué | Medido |
|---|---|
| Un lanzamiento que no cuajó | El orquestador lanzó S1 y S3 desde una carpeta nueva. Las dos quedaron pidiendo aprobar un MCP. El lanzador dijo «backgrounded» con su id, `ListAgents` no las listaba, y se las dio por trabajando una hora. Lo delató un mensaje que rebotó |
| El bloqueo no está siempre en `state` | 1-oct 11:53Z, `s3-1octc`: `state=working`, `tempo=blocked`, `needs="approve Entering worktree"` |
| El cementerio | 8 trabajos en `state=blocked`, del 28-sep 14:13Z al 29-sep 18:08Z, cada uno con su pregunta en `needs`. Ninguna contestada. El latido no los veía: SESIONES solo mira 24 h |
| Lo que el lector callaba | `leerSesiones` saltaba con `continue` un `state.json` que no parseaba |
| Parar una sesión borra su pregunta | De 241 `state.json`: 227 en done/failed/stopped, **0 con `needs`**; los 8 `blocked` y 1 `working` lo llevan |

## Lo que entra

| Pieza | Qué hace |
|---|---|
| SESIONES | Bloqueada = `state=blocked` **o** `tempo=blocked` **o** hay `needs`. Si el `state` dice otra cosa, la línea dice en qué campo estaba el bloqueo. La población declara «leído del REGISTRO, no del panel» |
| CEMENTERIO (sección 6) | La pregunta de toda sesión que espera desde hace más de 24 h, con su edad, la más vieja primero |
| Fail-closed | `leerTrabajos` devuelve aparte los `state.json` ilegibles y las carpetas sin `state.json`. Con uno ilegible, CEMENTERIO sale «NO PUDE MIRAR» (salida 2) **y enseña igualmente lo que sí leyó**. SESIONES lo dice en su población |
| El libro | `%LOCALAPPDATA%\yaqu-equipo\cementerio.json`. Cada pasada copia ahí las preguntas que ve. Una pregunta sale del libro solo si la sesión SIGUIÓ (`working`/`done`: se le contestó) o si se marca. Que la paren o borren su carpeta no la saca |
| `latido.mjs contestada <id> <dónde>` | Apunta que la pregunta tiene respuesta y dónde está escrita. Otra pregunta de la misma sesión vuelve a avisar |

## Comprobado

- `tests/scrum1350-latido.test.mjs`: 22 casos (15 de 1350 + 7 nuevos), 22 pasan. Uno contra disco, en un temporal fuera del árbol.
- 12 mutaciones a mano, con la BASE sin mutar verde antes: las 12 caen (tempo no cuenta · needs no cuenta · ilegible saltado · cementerio no ciego · libro corrupto leído como vacío · ciego tapa lo leído · parada = contestada · solo mira hoy · contestada no calla · respuesta vieja contesta pregunta nueva · huérfana del libro no sale · carpeta sin state.json no se nombra). No se declaran en `MUTACIONES_QUE_ME_TUMBAN`: cada una se paga en el CI de todos (SCRUM-935).
- Contra el mundo, 1-oct ~11:57Z: 241 trabajos leídos, 0 ilegibles, 0 carpetas sin `state.json`; CEMENTERIO da las 8 (s0-27c, s4-28d, s4-28e, s4-29a, s3-29b, s3-29c, s5-29e, s4-29c) y SESIONES da `s3-1octc` con «su state dice working: el bloqueo está en tempo».

## Mis errores

1. **Dos mutaciones VIVÍAN en la primera pasada** (`needs` solo como bloqueo; la respuesta vieja contestando a la pregunta nueva). La segunda estaba tapada por una comprobación redundante dos líneas más abajo: el test pasaba por la segunda, no por la que yo creía estar probando. → dos aserciones más; ahora caen.
2. **Escribí «0 de 233» en un comentario antes de contarlo.** Eran 227. → corregido con el recuento delante.
3. **No pude reproducir el caso de origen.** Las dos sesiones del MCP (`s1-1octb`, `s3-1octb`) ya estaban en `stopped` cuando miré, y parar borra `needs`: no sé qué decía su `state.json` mientras esperaban. Lo cubierto es el caso que SÍ medí (`s3-1octc`). Si un lanzamiento que no cuaja no llega a escribir `state.json`, hoy solo saldría como «carpeta sin state.json» en la población, no como alerta.

## Lo que NO hace

- El libro solo conserva lo que alguna pasada del latido llegó a VER. Una sesión que se bloquea y se para entre dos pasadas pierde su pregunta igual que antes. Lo cierra que el latido corra solo: SCRUM-1356.
- No cruza con el panel: no dice «el panel no la ve», dice lo que hay en el registro.
- No decide si una pregunta está contestada: `s4-28d` lleva dos preguntas en un `needs` y solo una tiene respuesta (SCRUM-1353, comentario 17881). Marcarla es de quien contestó.

---

## 13-oct-2026 · SCRUM-1357b · PARADOS: las bloqueadas se cuentan por SESIÓN, cruzando el panel con el registro

**Medido contra:** `origin/main` = `cf0a4cb7eb8613d394f98bc3134ba9a89896839c` · 2026-10-13T13:54:59Z

A9: comprobación → `tests/scrum1357b-parados.test.mjs`

Carril S5 (`scripts/equipo/parados.mjs`, su test y su línea de `package.json`). No toca el latido, ni
`sesion.mjs`, ni hooks, ni producto.

### Lo que pasó

El 13-oct-2026 el panel tenía 37 sesiones y 31 BLOQUEADAS, siete de ese día, paradas entre 12 y 70
minutos (cifras del orquestador, no recontadas por mí: cuando miré ya había parado 26). Su vigía decía
«nadie parado» y con eso le dijo tres veces al fundador «los seis trabajando». El fundador lo vio antes,
en su panel. La causa que da el orquestador: aquel vigía miraba UN PUESTO, cogía SU SESIÓN MÁS RECIENTE
y, si estaba viva, daba el puesto por bueno.

Lo que NO pude mirar: ese vigía (`vigia2.mjs`). No está en `origin/main` ni lo encontré en disco
(`~/.claude/jobs`, el perfil a 7 niveles, `D:\` a 4). La causa la tomo del encargo; lo que sí he medido
es que el caso que describe existía, y es el de abajo.

El latido (SCRUM-1350 · 1357) ya enseñaba las bloqueadas de hoy, una por una, en su sección SESIONES.
Lo que falló no fue que faltara el detector: es que tarda minutos y habla con GitHub, y en mitad de un
turno se miró otra cosa más rápida. Por eso esto es un instrumento aparte y de un segundo, no una sección más.

### Lo que entra

`node scripts/equipo/parados.mjs` (o `npm run parados`) · `--json` · `--jobs <carpeta>`.

| | |
|---|---|
| unidad | la SESIÓN. El puesto sólo agrupa la salida |
| fuentes | el PANEL (`claude agents --json`) y el REGISTRO (`~/.claude/jobs/<id>/state.json`), cruzados por id |
| bloqueada | lo dice CUALQUIERA de las dos: panel `state=blocked` o `waitingFor`; registro `state`, `tempo` o `needs` |
| por cada una | puesto, nombre, id, parada desde cuándo, hace cuánto, si tiene proceso, quién lo dice y la pregunta (`needs`) entera |
| desde cuándo | del `timeline.jsonl`; si el bloqueo no dejó evento, del `updatedAt`, y se rotula como tal |
| por puesto | trabajando · bloqueadas · acabadas · restos · no sé. Un puesto sin nadie trabajando lo dice |
| salida | 0 nadie · 1 hay bloqueadas · 2 NO PUDE MIRAR algo (gana al 1) |

Se llama, no se copia: `leerTrabajos`, `espera`, `preguntaDe`, `puestoDe` (latido); `clasificarAgente`,
`ESTADOS_TERMINALES` (`sesion.mjs`); `leerLinea`, `tramosDe` (`scripts/espera-del-equipo.mjs`).

**NO PUDE MIRAR (salida 2), nunca «ninguna»:** el panel no contesta, sale con error, no es JSON o no es
una lista · no existe la carpeta de trabajos · una sesión del panel sin `state.json` legible · una que
el panel da por `working` sin proceso y sin haber terminado · un `state` que no se conoce · una sesión
`working` en el registro que el panel no lista. Con algo sin mirar, un cero no se escribe con las
palabras del verde.

### Contra el mundo

Primera pasada, 13-oct 13:43Z del reloj de la máquina (va unos 6 min por delante de GitHub: medido
13:50:34 contra `Date: 13:44:40`). 18 entradas en el panel, 16 de fondo; 394 trabajos en el registro,
0 ilegibles. Tarda 1 s. Salida 1:

| puesto | sesión | parada | espera |
|---|---|---|---|
| S3 | s3-13octc | 97 min | «approve Entering worktree» (el panel: permission prompt) |
| S0 | s0-13octc | 84 min | «Dar relevo del carril y decidir: 1434 (¿fundador?) y los 11 de 32 sin etiqueta» |
| S4 | s4-13octc | 82 min | «Los cinco hallazgos de la página van a S1: ¿los repartes tú?» |
| S2 | s2-13octc | 64 min | «GO en SCRUM-1215 para cambiar SIN_APROBAR_DIRECCION_OBRA de 4 a 0; levantar el relevo de S2» |
| sin puesto | 883375c0 | 4 min | «send a prompt to start» |
| sin puesto | 3cdc6018 | 2 min | «send a prompt to start» |

Las cuatro primeras son el caso del encargo: S0, S2, S3 y S4 tenían cada uno su sesión `…13octd`
trabajando y la `…13octc` bloqueada debajo. Las dos últimas eran dos lanzamientos sin nombre y sin
prompt, de minutos antes, que nadie había visto. Y cuatro restos que el panel daba por `working`
(sesion-5, s1-21, s1-27a, s3-28b: sin proceso, terminados según su registro) no contaron como trabajando.

### La aceptación → dónde se ve

| lo pedido (literal del encargo) | dónde se ve |
|---|---|
| «cuántas sesiones están `blocked`, de qué puesto, desde cuándo y con qué pregunta dentro (`needs` del `state.json`)» | `tests/scrum1357b-parados.test.mjs` («EL CASO DEL 13-OCT», «se cuenta por SESIÓN», «paradaDesde») |
| «leyendo lo mismo que el panel: `claude agents --json`» | «leerPanel», «de punta a punta» (el doble exige que le pidan `agents --json`) |
| «fabrica el caso —un puesto con una sesión viva y otra bloqueada— y comprueba que el instrumento lo CAZA» | «EL CASO DEL 13-OCT», y «de punta a punta» con el guion de verdad |
| «que diga lo que NO pudo mirar. Si `claude agents --json` no contesta, eso no es "nadie parado"» | «el panel NO CONTESTA», «sin REGISTRO», «una bloqueada del panel sin state.json», «`working` sin proceso», «de punta a punta» (tres paneles rotos) |

### Probado en rojo

21 casos, 21 pasan. 16 mutaciones sobre `parados.mjs`, con la BASE sin mutar en verde antes y después;
las 16 tumban el test: la sesión más reciente de cada puesto y las demás no se miran (el defecto del
13-oct: caen 3) · un panel que no contesta se lee como vacío · sin registro no es «no pude mirar» · el
bloqueo sólo en `state` · `waitingFor` no cuenta · `working` es trabajando con o sin proceso · sesión
sin `state.json` no ciega · «no sé si trabaja» no ciega · lo que el panel no lista no se busca · una
lista tapa el «no pude mirar» · con algo sin mirar el titular es el del verde · «parada desde» ignora
la línea de tiempo · `leerPanel` devuelve lista vacía con código distinto de 0 · con salida que no es
JSON · sin poder lanzar · las de más de 24 h de fuera del panel entran en la tabla. No se declaran en
`MUTACIONES_QUE_ME_TUMBAN` (SCRUM-935).

### Mis errores

1. **La primera versión marcaba «0 ⚠️ NADIE» en la fila «sin puesto».** Las sesiones sin puesto no
   forman uno. Lo vi en la primera pasada contra el mundo. → comprobación: el caso «una sesión que no es
   de ningún puesto».
2. **Con el panel sin leer y ninguna bloqueada en el registro, la segunda línea decía «De lo que SÍ
   pude leer: ninguna sesión bloqueada».** Las palabras del verde debajo de un «no pude mirar». Lo vi al
   escribir el test, antes de correrlo. → comprobación: «el panel NO CONTESTA» exige que esas palabras
   no salgan.
3. **Una edición mía se comió un espacio de la tabla** y dos casos cayeron por ello. El test lo cazó.

### Lo que NO hace

- No sabe si una pregunta YA SE CONTESTÓ. Una bloqueada a la que se respondió relanzando su puesto sigue
  saliendo hasta que alguien la para. Y parar una sesión borra su `needs` del registro (13-oct: 131
  trabajos `stopped`, ninguno lo conserva): quien quiera guardarla pasa antes el latido, que la copia a
  su libro.
- No corre solo. Dice lo que hay cuando alguien lo lanza. Que el orquestador lo lance en cada turno
  es una línea de `docs/equipo/orquestador.md`, que es suyo: va propuesta en la entrega, no hecha.
- Fuera del panel sólo mira las últimas 24 h; lo más viejo lo cuenta y lo manda al cementerio del latido.
- Las sesiones interactivas (el orquestador, el fundador) no son trabajos: las cuenta y no las mira.
- Si el panel se cuelga, espera 60 s y lo dice; no mata al proceso que dejó colgado.
