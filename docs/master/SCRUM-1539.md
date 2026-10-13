# SCRUM-1539 · La carrera de las dos lecturas del remoto en `scrum804b`: vista en rojo, medida y SIN arreglar

**Medido contra:** `origin/main` = `eebc104d9e955cdd67b31ad2d24a50cc9b849a7b` · 2026-10-13T12:30:13Z

A9: aviso → cicatriz J6 «Crucé el umbral de aviso de contexto sin medirme en el cruce: medí al arrancar y no volví a medir hasta después de un barrido ancho.» — no se pudo comprobar: el contexto lo mide la propia sesión leyendo su jsonl, y ningún hook de este árbol la para al cruzar

Sesión `jv-j6j`, puesto J6. **Este PR sólo trae medición:** el registro, una línea de cicatriz y la
carpeta `docs/master/evidencias/SCRUM-1539/`. No toca `tests/`, `scripts/`, `src/`, ningún guard ni
ningún workflow. El arreglo NO está escrito: `scripts/censo-regla-42.mjs` es un instrumento, no está
medido de qué equipo es, y el orquestador lo dejó en propuesta. El detalle entero vive en Jira,
comentarios 19369 (lo primero que hay que leer) y 19368.

## Lo que se midió

| qué | resultado | con qué |
|---|---|---|
| La carrera, con el test real sin modificar | base: 5 casos, 5 pasan. Quitando entre las dos lecturas la rama del ticket elegido: 4 pasan y cae el de `tests/scrum804b-el-barrido-de-la-42.test.mjs:169`, con el mensaje del incidente | `banco-de-la-carrera.mjs` + `remoto-interpuesto.mjs`; salidas `salida-base.txt`, `salida-carrera.txt`, `salida-fabricada.txt` |
| La ventana entre las dos lecturas | 3.249 y 3.313 ms en local (2 pasadas, 161 ramas). No son los 11 s del ticket: eso era el caso entero. En un runner, sin medir | las mismas salidas |
| El 128 de `merge-base --is-ancestor` leído como «rama viva» | inocuo en el job obligatorio (historia completa); en un clon de profundidad 1, 17 de 17 ramas ya mergeadas dan 128 | `codigos-de-is-ancestor.mjs`, `salida-codigos-de-is-ancestor.txt` |
| El patrón en otros sitios | 1.826 ficheros mirados; 19 nombran `ls-remote`; 7 sitios lo ejecutan contra el remoto de verdad y uno solo es un test de la tanda. El mismo patrón, con consecuencia destructiva, en `scripts/verificacion-s5/ramas-borrables.mjs` (va a SCRUM-1540) | `banco-ramas-borrables.sh`, `salida-banco-ramas-borrables.txt` |
| ¿Se borró ya alguna rama con obra fuera de main? | sólo el techo: 29 PR cerrados sin mergear con la rama borrada y la punta fuera de main, de 2.370 leídos; el último, del 17-sep. Causa sin atribuir | `pr-cerrados-sin-mergear.mjs`, `salida-pr-cerrados-sin-mergear.txt` |

## Aceptación → dónde se ve

| aceptación (del ticket) | dónde se ve |
|---|---|
| ① Verlo en ROJO primero | `docs/master/evidencias/SCRUM-1539/salida-fabricada.txt` y `salida-carrera.txt` |
| ② Arreglarlo en el código del instrumento, nunca aflojando el test | NO HECHO → propuesto en el comentario 19368 de SCRUM-1539; lo decide el orquestador de Javier con el dueño del instrumento |
| ③ Comprobar si hay más de una ventana igual | comentario 19368, apartado ③; `docs/master/evidencias/SCRUM-1539/salida-banco-ramas-borrables.txt` |
| ④ Medir cuántos de los rojos recientes son esto | NO HECHO → no medible con la muestra de SCRUM-1538 (3 rojos de main en una semana, y esta carrera cae sobre runs de PR) |

## Lo que NO se ha medido

La ventana dentro de un runner · cuántas ramas «vivas» de CI lo son por un 128 · la frecuencia de la
carrera (consta una vez) · cuántos de los rojos archivados como intermitentes eran esto ·
`scripts/verificacion-s5/enlace-ticket-rama.mjs` ejecutado (sólo leído) · quién ha lanzado
`ramas-borrables.mjs --ejecutar` y cuándo · la tanda completa (este PR no toca nada que la mueva).

## De paso

Nada arreglado de paso. Los dos hallazgos fuera del ticket (el 128 y `ramas-borrables.mjs`) caen en
ficheros de otro carril: se reportan en Jira y no se tocan.
