# SCRUM-1413 · El latido nombra los experimentos que nadie ha leído

**Rama:** `scrum-1413-latido-experimentos-sin-leer` · **Carril:** S5 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `a096c7faf486e7ca4332c16f95344dc06220bbab` · 2026-10-02T12:08:02Z

A9: comprobación → `tests/scrum1413-latido-experimentos-sin-leer.test.mjs`

Carril S5: `scripts/equipo/latido.mjs` y un test. Hijo de SCRUM-1384. Aprobado por el orquestador el
2-oct-2026, que también aceptó el criterio («citado en `main`» en vez de «comentado en Jira»).

## Qué pasaba

El 1-oct-2026 se lanzó el experimento de SCRUM-1384 (rama `exp-1384-informe-truncado`, run
`36873018664`). La sesión se quedó sin cuota antes de leerlo, el ticket estuvo un día sin comentarios
y los artefactos caducaban a los tres días. Lo leyó y lo salvó el equipo de Javier.

Una rama `exp-*` no empieza por `scrum-`: el bot no le abre PR, y nada de lo que vigila los PR la ve.

## El cambio

Sección 8 del latido, EXPERIMENTOS (`seccionExperimentos`, pura; la recogida va en `todo()`):

- Recorre las ramas remotas `exp-*` y sus runs.
- Un run TERMINADO cuyo id no está citado en ningún fichero de `docs/master/` de `origin/main` es
  una alerta: rama, id, cuántos artefactos quedan vivos y cuándo caduca el primero.
- Si sus artefactos ya caducaron sin cita, dice PERDIDO.
- La cita casa por el id entero (`citaElRun`), no por subcadena de otro número.
- Un run que aún corre no se juzga; se cuenta en la población.
- `main` se trae (`git fetch`) antes de buscar la cita. Si no se puede traer, la sección es ciega.

**Por qué «citado en `main`» y no «comentado en su ticket»:** el latido sólo usa `git` y `gh`; no
tiene credenciales de Jira. Y un comentario no salva los datos: puede estar y los artefactos caducar.

Cuándo es ciega (salida 2): no llegan las ramas (o llega una página llena de cien), no llegan los
runs de una rama, no llegan los artefactos de un run, alguna lista trae menos elementos de los que
declara, un artefacto vivo no trae fecha legible, o no se puede buscar en `main`.

## Medido

| Qué | Resultado |
|---|---|
| Test nuevo, solo | 10 tests, 10 pasan, 0 saltados |
| Con `tests/scrum1350-latido.test.mjs` y `tests/scrum1356-latido-enganchado.test.mjs` (antes del décimo caso) | 63 tests, 63 pasan |
| Mutaciones sobre `latido.mjs` (9, una a una, con base sin mutar verde y fichero restaurado) | las 9 ponen el test en rojo |
| Latido entero contra GitHub, 2.ª pasada, 12:02Z | `exp-1384`: 1 run, citado. `exp-1405-force-exit`: 4 runs SIN LEER, caducan el 9-oct. Sección: 5,4 s, 7 llamadas a `gh` |
| Dirigida: selecciona 191 ficheros de 1.208 | NO corrida entera (pasa del tope de 150). Corridos los 21 que nombran o recorren `latido.mjs`: 245 tests, 241 pasan, 4 fallan |

Los 4 fallos son del árbol y no del cambio: tres de `scrum381` porque este árbol no tiene `dist/`
(nombran imports a `../dist/...`), y uno de `scrum775` porque lancé la tanda con `NO_COLOR` puesto
encima de `FORCE_COLOR` y node escribe un aviso por stderr. El juez es el CI.

Las mutaciones: lista de runs cortada, lista de artefactos cortada, rama sin runs, cita ilegible,
cita por subcadena, run corriendo juzgado, citado acusado, caducados contados como vivos, última
caducidad en vez de primera.

**El primer acusado:** `exp-1405-force-exit`, del equipo de Javier. Sus cuatro runs
(`36970275624`, `36971139768`, `36971399803`, `36973388518`) están escritos en su PR #2131, que sigue
abierto; dejarán de salir cuando entre en `main`. Es el comportamiento buscado: escrito en un PR
abierto no es escrito donde no caduca. (Al citarlos aquí, este registro también los dará por leídos
cuando entre; los dos PR dicen lo mismo de ellos.)

## Mi error, y en qué se convirtió

La primera pasada real contra GitHub dijo «4 runs terminados, 0 citados»: faltaba el de `exp-1384`.
La API había devuelto la lista de runs de esa rama VACÍA (total 0), y mi sección lo tomó por «nada
que leer» sin decir nada. La segunda pasada, y cuatro consultas directas seguidas, lo trajeron. Era
el defecto que el ticket persigue, dentro de su arreglo.

Ahora una rama `exp-*` sin ningún run es una alerta con su nombre, la población dice cuántas hay, y
la recogida pide la lista otra vez antes de creérsela vacía. El caso está en el test («una rama
exp-* de la que no llega NINGÚN run se nombra») y su mutación lo pone en rojo.

No sé por qué la API devolvió la lista vacía: lo vi una vez en seis consultas.

## Lo que NO he comprobado

- Los casos PERDIDO y «aún corriendo» sólo están probados en el test: hoy no hay ninguno real.
- El check obligatorio de esta rama: a la hora del ancla, sin empujar.
- No he instalado nada: el latido se corre desde un árbol, y quien lo corra desde uno anterior a este
  PR no tiene la sección.
