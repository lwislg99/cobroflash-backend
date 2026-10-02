# SCRUM-1424 · `npm run ya-esta -- <n>`: qué hay ya en `main` de un ticket, antes de repartirlo

**Rama:** `scrum-1424-ya-esta` · **Carril:** S5 · **Fecha:** 2-oct-2026
**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:07:37Z

A9: comprobación → `tests/scrum1424-ya-esta.test.mjs`

Carril S5: `scripts/equipo/ya-esta.mjs`, su entrada en `package.json` y un test. Encargo del
orquestador. Sólo lee: no cierra, no transiciona y no escribe en Jira.

## Por qué

El 2-oct-2026 el orquestador encargó cinco veces trabajo que ya estaba hecho. La quinta fue una
medición (la frecuencia de tandas verdes que pierden casos) que estaba en el ticket de una sesión
anterior y en un `.tsv` de `main`, bajo el número de OTRO ticket. Se repartía leyendo el ticket, que
describe la intención, y no el árbol.

## Qué existía, y qué añade esto

| Pieza de la casa | Qué contesta | Por qué no bastaba |
|---|---|---|
| `censarTicket` (`tests/_censo-tickets.mjs`, SCRUM-388) | commits de `main` con el ticket en su asunto; mide si puede medir | lee el registro del DISCO, no de `origin/main` |
| `rastroDeLosTickets` (`scripts/_rastro-del-ticket.mjs`, SCRUM-804) | cada rama del remoto: dentro de `main` o viva | clasifica todas: 6,7 s medidos |
| `scripts/abierto-con-trabajo-en-main.mjs` (SCRUM-1259) | la lista de abiertos con trabajo en `main` | exige una foto de Jira aun con `--ticket` |
| `npm run enlace:ticket-rama` (SCRUM-637) | cuándo rama, commit, registro y Jira discrepan | es un censo de todos, no una pregunta por uno |

`ya-esta.mjs` es una capa: llama a `censarTicket` (commits, nombres de rama y capacidad de medir) y
reutiliza `reMencion`, `RE_CIERRE` y `ticketDeExpediente` de SCRUM-1259. No llama a
`rastroDeLosTickets`: la clase de cada rama del ticket se pregunta a git con el mismo criterio (¿su
punta es alcanzable desde `main`?), porque el motor entero tarda más de lo que se tolera antes de
repartir. `enlace:ticket-rama` tampoco se llama: responde otra pregunta.

Lo que añade: una pregunta por UN ticket, sin foto de Jira; el registro y las evidencias leídos de
`origin/main`, que se trae antes; las fechas; y qué otros registros nombran el ticket.

## Las tres respuestas

| Respuesta | Cuándo | Salida |
|---|---|---|
| YA ESTÁ · DESDE el `<fecha>` | hay registro, evidencias, commits o rama suya DENTRO de `main` | 0 |
| NO ESTÁ | nada con su número en `main` (una rama viva se avisa en la misma línea) | 0 |
| NO HE PODIDO MIRAR | no se pudo traer `origin`, la referencia no resuelve, un motor no pudo medir, o git falló | 2 |

Con un solo motivo de ceguera la respuesta entera es la tercera, aunque se haya visto trabajo.

«Ya está» quiere decir «hay trabajo suyo en `main`», no «está terminado»: lo dice en la segunda
línea. «No está con ese número» no es «sin hacer»: lo dice también, y enseña los registros AJENOS que
lo nombran y las líneas que usan palabra de cierre.

Lo que NO mira, y lo dice en cada salida: los comentarios del ticket en Jira (no tiene credenciales),
y el trabajo hecho bajo otro número que no nombre éste.

## Medido

| Qué | Resultado |
|---|---|
| Test nuevo | 8 tests, 8 pasan, 0 saltados (15,8 s: crea y tira repositorios de juguete) |
| Mutaciones sobre `ya-esta.mjs`, una a una, base verde y fichero restaurado | 11 de 11 ponen el test en rojo |
| `ya-esta 1366` (el caso del día) | NO ESTÁ · «citado en: `docs/master/SCRUM-1380.md`, `docs/master/SCRUM-1339.md`» · 2,3 s |
| `ya-esta 1419` | YA ESTÁ DESDE el 2026-10-02 · registro, 8 evidencias, y su rama viva con 2 commits fuera · 3,5 s |
| `ya-esta 1405` | NO ESTÁ · PERO 1 rama viva con 10 commits fuera · 2,2 s |
| `ya-esta 99999` | NO ESTÁ, salida 0 |
| `ya-esta 1382 --ref origin/no-existe` | NO HE PODIDO MIRAR, salida 2 |

Los tiempos son de reloj con el `git fetch` incluido, una pasada de cada uno.

Las mutaciones: el ciego se colapsa en «no está» · el ciego sale 0 · un fetch fallido no es ciego ·
una referencia que no resuelve no es ciega · una rama viva cuenta como «ya está» · «desde» da la
fecha más nueva · el registro se lee de otro ticket · las evidencias no se miran · el cierre ajeno no
se enseña · calla que no mira Jira · primera ancla en vez de última.

El caso «no puedo mirar» se fabrica en el test cortando el acceso de cuatro maneras: se borra el
remoto del repositorio de juguete, se pide una referencia que no existe, se lanza sobre una carpeta
que no es un repositorio, y se lanza sin número.

## Mi error

La primera tanda de mutaciones dio once rojos, pero uno era falso: mi mutante de «fetch fallido»
dejaba el fichero con un error de sintaxis, y el test caía porque no cargaba, no porque cazara el
defecto. Lo vi porque ese mutante decía «tests 1» y los demás «tests 8». Rehecho como mutante válido:
cae 1 de 8.

## Lo que NO he comprobado

- El check obligatorio de esta rama: sin empujar a la hora del ancla.
- La dirigida entera. Corridos: el test nuevo y `guards:entrada`.
- Un clon superficial de verdad (el de algunos jobs de CI): `censarTicket` declara que no puede medir
  y esto lo convierte en «no he podido mirar», pero ese camino no tiene caso propio en mi test.
- El caso del día sólo queda resuelto a medias: `ya-esta 1366` señala a `SCRUM-1339.md`, que es donde
  estaba la medición, porque ese registro NOMBRA el 1366. Trabajo hecho bajo otro número que no lo
  nombre sigue sin verse.
