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

# SCRUM-1539b · El arreglo: el negativo y el censo salen de UNA foto del remoto, y la foto lleva el sha de `main`

**Medido contra:** `origin/main` = `becfaf83094b8ddba05043e7850dbf5c6c6635bd` · 2026-10-14T16:15:02Z (`Date:` de GitHub)

A9: comprobación → `tests/scrum1539b-una-sola-foto-del-remoto.test.mjs`

Sesión 5 (equipo de Luis), por encargo del orquestador del 14-oct. Es el punto ② que el tramo de
arriba dejó en propuesta (comentario 19368), construido como se propuso, con una pieza más que digo
abajo. El 128 de `--is-ancestor` NO está aquí: es SCRUM-1541, y va en su propio PR.

## En corto

| aceptación (del ticket) | dónde se ve |
| --- | --- |
| ① Verlo en ROJO primero | el banco de arriba, `evidencias/SCRUM-1539/banco-de-la-carrera.mjs fabricado`, otra vez sobre `becfaf830` y antes de tocar nada: 4 lecturas del remoto, el caso de `:169` cae con el mensaje del incidente («SCRUM-1529 … lo saca DENTRO (entrada en main + 19/19 artefactos …)») |
| ② Arreglarlo en el código del instrumento, nunca aflojando el test | `scripts/censo-regla-42.mjs`: `leerRemoto()` y `censarConMotivo(tickets, { foto })`; `tests/scrum804b-…`: una foto por proceso. Ninguna aserción de `scrum804b` cambia |
| La comprobación permanente | `tests/scrum1539b-una-sola-foto-del-remoto.test.mjs`, dos casos, vistos en ROJO con el código de antes |
| ③ y ④ | hechos en el tramo de arriba; no se repiten |

## Qué cambia

- **`leerRemoto()`** es la única función del censo que ejecuta `ls-remote`. Devuelve la FOTO:
  `{ salida, main, ciego }`, con la salida cruda del remoto y el sha de `origin/main` resuelto en el
  mismo instante. `ramasRemotasConMotivo(foto)` y `censarConMotivo(tickets, { foto })` la aceptan
  hecha; sin ella, la sacan ellas, como antes.
- **El test** saca una foto por proceso (`fotoDelRemoto`) y la reparte entre `derivarNegativo` y los
  tres `censarConMotivo`. Lo compartido es la RESPUESTA del remoto; cada uno la interpreta con su
  expresión, así que la independencia que el fichero declara (cómo se lee) se conserva.
- **La pieza más, que la propuesta no traía:** la foto lleva el sha de `main`, y el
  `--is-ancestor`, el `ls-tree`, el `show` y el `log` van contra ese sha y no contra la ref
  `origin/main`. La propuesta decía que esa ref «no se mueve durante la tanda». En CI es verdad; en
  esta máquina, no: los árboles de trabajo comparten las refs y cualquier `git fetch` de otra sesión
  la mueve. Con la ref, la carrera sólo cambiaba de sitio. **No he medido un caso real de esto**: es
  lectura del mecanismo, y el caso ② del test es el que lo fija.
- `scrum723` cayó dos veces, y las dos con razón. La primera, por el `[rev-parse]` nuevo en el censo
  y en el test: es la foto, y se declaró con su motivo junto a las tres del censo que ya estaban. La
  segunda, por dos cosas mías que nombraban la ref FUERA de los argumentos de git: un valor por
  defecto `'origin/main'` en `arbolDeMain` y `clasificar` (nadie los llama sin el sha: se quitaron), y
  el texto de una ceguera. Se arregló el código; la lista de indirectas no se tocó.

## El rojo y el verde, medidos

| pasada | lecturas del remoto | resultado |
| --- | --- | --- |
| banco `fabricado` sobre `becfaf830` (antes) | 4 | 5 casos, 4 pasan, **1 cae** (`:169`) |
| banco `fabricado` con el arreglo | 1 | 5 de 5 |
| banco `carrera` (remoto de verdad) con el arreglo | 1 | 5 de 5 |
| `scrum1539b` sobre `becfaf830` (el test nuevo copiado a un árbol desechable) | — | **2 de 2 caen**: «ha preguntado al remoto 4 veces» y «el censo ha preguntado al remoto 2 veces teniendo la foto» |
| `scrum1539b` con el arreglo | — | 2 de 2 |
| mutación: el `--is-ancestor` del censo vuelto a la ref `origin/main` | — | el caso ② **cae** |

El caso ① lanza el `scrum804b` REAL, sin tocarlo, con una precarga que fabrica las lecturas (la 1ª
trae una rama viva de SCRUM-1539 con un sha que no está en el almacén; la 2ª ya no la trae) y exige
el testigo: sin él, un sujeto que corrió sin la carrera puesta se leería como verde.

## Lo que NO he medido

- **La duración:** en esta máquina, y hoy, el caso de `:169` tarda unos 40 s **con y sin** el arreglo
  (39,6 s la base, 41,4 s con el arreglo, una pasada de cada; ayer, 5,2 s). La máquina va cargada; no
  es del cambio. En la base la ventana entre la 1ª y la 2ª lectura fue de **26,3 s**, no de 3,2.
- Un `git fetch` real moviendo `origin/main` a mitad del caso (ver arriba).
- Linux. El obligatorio del PR es la primera pasada en Linux.

## Mis errores

1. Mi primer intento de reescribir el test con PowerShell resolvió la ruta relativa contra otro
   directorio y falló sin escribir nada. Lo rehíce con el editor.
2. Para quitar el árbol desechable probé `worktree remove --force` y el hook lo paró, con razón:
   el árbol tenía el test copiado dentro. Lo borré a mano y lo quité sin forzar.
