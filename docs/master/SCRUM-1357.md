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
