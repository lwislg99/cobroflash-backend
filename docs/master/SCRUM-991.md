# SCRUM-991 · La puerta de integridad de sesion.mjs puede quedar cerrada hasta la próxima tanda

**Fecha:** 22-sep-2026 · **Carril:** S5 (documentación operativa, decisión ya tomada el 21-sep en Jira) · **Gate:** ninguno — cero código
**Medido contra:** `origin/main` = `ed63671ce765df1560e44eb24926e5e3887356eb` · 2026-09-22T10:18:21Z

## El defecto

`sesion.mjs` (el lanzador instalado en `%LOCALAPPDATA%\yaqu-equipo\`) tiene una `puertaDeIntegridad`
que se niega si la copia instalada no es byte a byte la de `origin/main`. Correcto por diseño, pero
quien la repone (`arranque.cmd`) solo corre en las tareas programadas del día (08:00/13:05/18:10): un
merge a `scripts/equipo/**` deja la puerta cerrada desde el merge hasta la siguiente tarea — hasta
13 h 49 min en el peor caso, medido por S5 el 21-sep (Jira SCRUM-991).

No había ticket ni norma escrita: cada sesión que topaba con `ALTERADO` lo redescubría sola.

## La decisión, y por qué

El orquestador decidió (Jira, comentario 16148, 21-sep-2026) la **opción 3** de las tres propuestas:
ni instalar una cuarta tarea programada (exige al fundador) ni pedir `schtasks /run` a mano (se olvida
igual) — **escribirlo como paso operativo repetible**: refrescar las 3-4 copias instaladas con
`git show origin/main:<ruta> > <destino>` tras cualquier merge que toque `scripts/equipo/sesion.mjs`,
`orquestador-arranque.mjs`, `uso.mjs` o el prompt de la tanda. El propio orquestador ya lo probó el
21-sep: funciona sin bloqueo del sistema de permisos.

## Lo que se hizo

Documentado en `docs/equipo/orquestador-autonomo.md`, **§5bis.7** (nueva) — no §5ter como decía el
comentario original de Jira: ese número ya está ocupado por «Cierre y arranque por FIN DE USO», un
tema distinto. §5bis.7 sigue la numeración ya usada por 5bis.4/5.6 para asuntos operativos del
lanzador, que es donde un lector que ya está en esa sección lo encontrará.

El bloque de comandos remite a `scripts/equipo/instalar.mjs` (`FICHEROS` + `PROMPT_INSTALADO`) para
las rutas exactas, en vez de copiarlas a mano: si el instalador cambia el mapeo, ese fichero es la
fuente y este documento no puede quedar desincronizado en silencio.

## Lo que NO cubre

* No instala nada nuevo ni toca `schtasks` ni `AppData` — ambos denegados a Claude a propósito (nota
  del propio ticket).
* No modifica `sesion.mjs`, `instalar.mjs` ni ningún script: cero código.
* No decide si algún día conviene el cuarto paso programado (opción 1) — sigue siendo del fundador.

## Ficheros

`docs/equipo/orquestador-autonomo.md` (nueva §5bis.7) · `docs/master/SCRUM-991.md` (nuevo, este fichero).
