# SCRUM-1563 · El estado del producto, en un documento vivo

Un registro por ticket (SCRUM-273). Quien lo actualice después AÑADE su tramo al final; no reescribe el de otro.

## Tramo 1563 · primera foto (S0)

**Medido contra:** `origin/main` = `bea8415859996e0bda44c7d85011235120ab6ca3` · 2026-10-18T17:13:31Z

A9: aviso → cicatriz S0 «Un comentario que cuenta una escritura se manda DESPUÉS de leer que la escritura entró: mandé en el mismo envío la edición de un ticket y el comentario «pongo las dos etiquetas», y la edición estaba denegada.» — no se pudo comprobar: los permisos y los comentarios de Jira no pasan por ningún test del repositorio

Sesión S0 · rama `scrum-1563-estado-del-producto` · worktree `.claude/worktrees/s0-estado` (fijado a `origin/main` con `git worktree add --detach`). Encargo del orquestador de Luis, a petición del fundador.

### Qué se entrega

- `docs/producto/ESTADO-DEL-PRODUCTO.md`: 63 filas de lo que le falta al producto, en ocho bloques (la empresa · presupuestar · enviar y firmar · facturar · cobrar · que nos paguen · gestionar · salir a vender). Cada fila dice de quién depende, qué la bloquea y de dónde sale.
- `docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs`: cuenta la columna «depende de». Hoy, sobre 63 filas: FUNDADOR aparece en 42 y es el único en 27 · JAVIER 26 / 9 · NOSOTROS 13 / 5 · ASESOR 5 / 2.

### Cómo se midió

| qué | cómo | población |
|---|---|---|
| abiertos por equipo | JQL por id de estado (`status != 10004`), 17:09Z | 273 = 58 de Luis + 164 sólo de Javier + 51 sin etiqueta de equipo (la suma cuadra) |
| cerrados y creados desde el 14-oct | JQL, equipo de Luis + sin etiqueta | 38 cerrados · 9 creados |
| ¿hay trabajo en `main`? | `node scripts/equipo/ya-esta.mjs` sobre 90 números, en `57b0bc82` | salida 0 · su RECUENTO: 90 preguntados · 58 YA ESTÁ · 32 NO ESTÁ · 0 NO HE PODIDO MIRAR |
| qué le falta a cada uno | 4 lectores de SÓLO LECTURA: descripción + último comentario | 65 tickets pedidos, 65 leídos (15 · 15 · 17 · 18) |
| que los lectores no escribieron en Jira | JQL `updated >= "2026-10-18 19:04"` (hora de Madrid) | 0 tickets. **Control positivo:** con `>= 19:02` salen 1563 (mi comentario de las 19:03:05) y 1519 |
| los PR que citaban los lectores como «NO CONSTA» | `gh pr view` | #2048, #2053, #2325, #2370 y #2425: los cinco MERGED (§4 del documento) |

La cadena de §2 se apoya en la sección 2 de la criba del 14-oct (`D:\MILLONARIO\cobroFlash\criba-14oct.md`, fuera del repo) y en SCRUM-1561. Cada fila se volvió a mirar el 18-oct.

### Lo que NO se ha medido

Lo dice §6 del documento: si el WhatsApp de producción está montado, el valor de las variables de Railway, los tickets de Javier y los sin etiqueta que no nombra la tabla, si cada fila cubre la aceptación de su ticket, y 15 tickets sin leer que se nombran allí.

### Dos errores propios

1. **Un comentario en Jira que anunciaba algo que no había pasado.** Al coger el ticket mandé, en el mismo envío, la transición, la edición de etiquetas y el comentario «lo coge S0… pongo las dos etiquetas». La transición y la edición las denegó el permiso de esta sesión, y el comentario salió diciendo que se habían puesto. Lo corregí a los 8 s (c.19950 editado). El ticket sigue en «Tareas por hacer» y sin etiquetas: lo tiene que hacer el orquestador. Va a la cicatriz de S0.
2. **El recuento de dependencias hecho a mano estaba mal**: 28 · 25 · 8 · 6 · 1, cuando eran 27 · 26 · 9 · 5 · 2. Lo cazó el contador antes de publicar, y por eso el contador va en el PR. Es la misma cicatriz del 2-oct-2026 («una suma se recuenta contra su propia lista antes de copiarla»), y esta vez sí tiene comprobación: el script.

## Tramo 1563b · la foto al día (S0)

**Medido contra:** `origin/main` = `2cc3243ec30c41e27bbe04d0d5647f241c83c28c` · 2026-10-18T18:46:46Z

A9: comprobación → `docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs`

Encargo del orquestador (18-oct, tras la primera foto): actualizar el documento con lo medido hoy, sin copiar sus datos.

### Qué cambia en el documento

- **2 filas pasan a §8 «Hecho»:** 1.10 (SCRUM-1190, cerrado 17:14Z, visto en producción por S2) y 2.1 (el WhatsApp de producción está vivo: Meta contestó `131026` a un envío real, `SCRUM-1236.md:158-162`).
- **5 filas nuevas:** 2.9 (el enlace de firma llega con `{{1}}` dentro), 2.10 (las otras tres plantillas con enlace, sin mirar), 5.2 (`planExpiresAt` al suscribirse), 6.11 (la cabecera de caché del origen de los CSV) y 7.8 (la cuenta demo, 403 `trial_expired`).
- **Corregidas:** 1.5 (la página pública ya está; queda el PDF, J1), 2.2 (el arreglo de 1237 está en `main` desde el 16-oct; falta mirarlo en producción), 2.3 (la mitad (a) de 1558 ya estaba en `main`), 2.7 (queda sólo Facturas, J1), 6.5 (el punto 6 espera al asesor), 1.9 (el punto 3 espera la elección del orquestador).
- **Los números de fila ya no se mueven**, para que la página del fundador siga casando con el fichero.
- §3, §4, §5 y §6 al día; §7 con un paso nuevo (mirar `main` antes de llamar movible a algo).

### Cómo se midió

| qué | comando | resultado |
|---|---|---|
| los tickets de §2, ¿cambió alguno? | JQL `key in (…)` con los 65 de §2 + 1183, 1177, 1503, 1563, 1564 | devuelve **70 de 70**; sólo cambiaron 1503, 1177, 1183, 1564, 1563 y 1190 después de las 17:09Z |
| qué tiene cada ticket en `main` | `git log origin/main --merges --grep=scrum-<n>[a-z]*-` por cada número | control positivo: 1190 sale con #2523 |
| lo que mandamos en el botón de WhatsApp | `git show origin/main:src/integrations/whatsappTemplates.ts` | `urlButton` manda sólo el sufijo (`:130-136`); 4 plantillas con botón de URL dinámica (`:57-68`) |
| los CSV sin sesión | `curl -D -` a los 7 `/admin/exports/*.csv` sin cookie, 18:39:38Z | 7 de 7 **401**, `cf-cache-status: DYNAMIC`. Control: `/` da 200 |
| #2568, #2576, #2578 | `gh pr view` | a las 18:4xZ, los tres ABIERTOS; #2568 con `build + tests (con banco desechable)` en FAILURE (18:05:04Z). Re-mirado a las 18:51Z: #2578 MERGEADO a las 18:49:54Z; y a las 18:5xZ, #2576 MERGEADO a las 18:54:15Z. El documento se corrigió las dos veces; #2568 sigue ABIERTO |
| la versión de producción | `curl https://yaqu.app/version` | `74e60ebe5923e79f63411bbb6be0e0f09ae98393` |
| las seis cuentas de §5 | JQL con `searchResultMode: count` | 271 · 56 · 164 · 51 · 41 · 10; control 56 + 164 + 51 = 271 |
| §3 | el contador | 66 filas · 43/28 · 28/12 · 12/5 · 6/2. Control: sobre la versión de las 17:13Z da lo publicado entonces |

### Lo que el encargo traía y no aguantó la medida

- **«Los CSV, CERRADOS por los dos lados (#2568)».** #2568 no ha entrado: está abierto y en rojo. La protección que hay hoy es sólo la regla de Cloudflare, y ésa sí funciona (medido).
- **«1237 ya está».** El arreglo está en `main`, pero el ticket sigue «En curso» y nadie lo ha mirado en producción después del merge: el registro se verificó sirviendo la rama.
- Lo demás del encargo (WhatsApp vivo, enlace roto, demo, `planExpiresAt`, 1190, 1442) casa con lo que hay en el repo y en los traspasos. La demo y lo «visto en producción» por S2 y S4 no los ha repetido S0, y el documento lo dice.

### Dos errores propios

1. **En la primera foto puse como movible «la mitad (a) de 1558», que llevaba dos días en `main`** (#2522, 16-oct). No miré `main` para esa frase. Esa cifra era la que decidía el reparto de mañana. Va al documento como paso 7 de §7.
2. **Volví a contar a mano antes que a máquina:** escribí 64 filas y 44 del fundador; eran 66 y 43. Lo cazó el contador antes de empujar, que es justo para lo que está.

## Tramo 1563c · la foto del 19-oct (S0)

**Medido contra:** `origin/main` = `cd85e34b1e5bfaf561f010f550296bd94b659e75` · 2026-10-19T06:43:12Z

A9: comprobación → `docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs`

Encargo del orquestador (19-oct): poner el documento al día, rehacer la cifra de «lo que podemos mover hoy sin esperar a nadie» y, si da tiempo, volver a medir §4.

### Qué cambia en el documento

- **1 fila pasa a §8 «Hecho»:** 2.2 (SCRUM-1237, cerrado a las 19:06:56Z del 18, visto en producción por S2: tramo 1237b, #2590).
- **1 fila nueva:** 2.11 (SCRUM-1115: dos de los tres programas que mandan correo pueden seguir saliendo como «PresuFácil»). La encontró la nueva medida de §4.
- **Corregidas:** 5.2 (ya tiene ticket, SCRUM-1565, J2, sin rama), 6.11 (#2568: los 5 guards se declararon, el primer intento sobre `6ee2b55` cayó por UN test y el segundo corre desde las 06:35Z), 7.8 (el correo de la demo no llega; el dominio sí tiene MX), 2.10 (las plantillas se dan de alta a mano en Meta).
- **§3 rehecha con una tabla que suma 66:** 62 esperan al fundador, a Javier o al asesor; 1 es nuestra pero espera una firma (2.4); 2 no tienen dueño (2.5, 6.10); **1 se mueve hoy sin nadie (6.11), y ya está en marcha.**
- **§4 re-medida a máquina** (no de memoria), con 14 filas: entran 1564, 1233, 1444, 1115 y 529, y sale 1237.
- §5 con su tercera fila; §6 al día.

### Cómo se midió

| qué | comando | resultado |
|---|---|---|
| ¿cambió algún ticket de §2? | JQL `key in (…62…) AND updated >= "2026-10-18 20:20"` | **0**. Control: sin el filtro de fecha devuelve **62**; el más reciente es 1562 (18-oct 00:12Z) |
| los seis del encargo + 1563/1564/1565 | JQL por clave | 1183 (18:09Z), 1177 (18:11Z), 1237 (19:06Z), 1503 (19:29Z), 1466 (19:30Z) y 1434 (19:31Z), Finalizada. 1564 en «Acción del fundador», sin etiquetas. 1565 «Tareas por hacer», 0 comentarios, creado 19:32Z |
| ¿tiene rama 1565? | `git ls-remote origin` entero, filtrado por `1565` | sólo `refs/pull/1565/head` (un PR antiguo con ese número), ninguna rama `scrum-1565…`. ⚠️ El filtro `git ls-remote origin "refs/heads/*1563*"` da 0 aunque 1563b existió: la rama se borra al mergear, así que **ese filtro no tiene control positivo** y no se usó como prueba |
| las seis cuentas de §5 | JQL con `searchResultMode: count` | 268 · 53 · 165 · 50 · 45 · 10. Control: 53 + 165 + 50 = 268 |
| por qué los cerrados suben +4 y no +5 | historial de SCRUM-1559 | se cerró a las 16:41:10Z del 18, antes de la medida anterior; su «actualizado» de las 19:06Z es posterior |
| #2568 | `gh pr view` + `gh api …/runs/39156812508` + `--log-failed` del intento 1 | `BLOCKED`; intento 1 sobre `6ee2b55` en FAILURE a las 19:39Z: `ℹ fail 1` de `ℹ tests 11862`, **SCRUM-1405c ④**; intento 2 lanzado a las 06:35:17Z, en curso |
| producción | `GET https://yaqu.app/version` | `cd85e34b…`, la punta de `main` |
| los CSV sin sesión | `GET` sin cookie a `quotes.csv` y `jobs.csv` | **401**, `cf-cache-status: DYNAMIC` |
| el enlace roto, visto por el cliente | `GET /albaran/%7B%7B1%7D%7Dtokenfalso0000` y, de control, `/albaran/tokenfalso0000` | los dos **404** «Documento no disponible… pide al profesional que te reenvíe el enlace». Sólo lectura, con un token inventado |
| ¿recibe correo `yaqu.app`? | `Resolve-DnsName yaqu.app -Type MX` (control: `gmail.com`) | `route1/2/3.mx.cloudflare.net` (Cloudflare Email Routing). Las reglas de reenvío no se ven desde aquí |
| §4: ¿qué hay en `main` con el ticket abierto? | `git log origin/main --merges --since=2026-10-11` → número de cada rama `scrum-<n>…` → JQL `status != 10004 AND key in (…)` | **110** tickets con merge, **54** siguen abiertos (lista abajo). Se miró el título del PR de los 22 que tocan una fila o el producto: muchos son sólo `docs/` |
| §3 | el contador | 66 filas · 44/29 · 28/12 · 11/4 · 6/2. Control: sobre la versión de ayer 18:46Z da lo publicado (66 · 43/28 · 28/12 · 12/5 · 6/2) |
| controles táctiles fuera de las filas | `git log 57b0bc82..origin/main -- public/dashboard/js/{productsView,albaranDetailView}.js` | `productsView.js` sin cambios desde la medida de S3; `albaranDetailView.js` cambió con 1206e (#2579) → sus 2 controles, «NO CONSTA» |

### Los 54 tickets abiertos con algún merge en `main` desde el 11-oct

El merge que se apunta es el **último** con su número. **Un merge no es un arreglo:** esta lista es de dónde se eligieron las filas de §4, no una lista de cosas por cerrar.

| ticket | estado (19-oct 06:4xZ) | último PR | fecha |
|---|---|---|---|
| 529 | En curso | #2409 | 2026-10-14 |
| 534 | Acción del fundador | #2425 | 2026-10-14 |
| 911 | Tareas por hacer | #2488 | 2026-10-15 |
| 913 | Tareas por hacer | #2503 | 2026-10-15 |
| 996 | Tareas por hacer | #2507 | 2026-10-16 |
| 999 | Tareas por hacer | #2514 | 2026-10-16 |
| 1016 | En curso | #2444 | 2026-10-14 |
| 1056 | Tareas por hacer | #2401 | 2026-10-13 |
| 1072 | En curso | #2506 | 2026-10-16 |
| 1115 | Tareas por hacer | #2433 | 2026-10-14 |
| 1215 | En curso | #2403 | 2026-10-13 |
| 1233 | En curso | #2588 | 2026-10-18 |
| 1236 | Tareas por hacer | #2576 | 2026-10-18 |
| 1257 | Tareas por hacer | #2439 | 2026-10-14 |
| 1295 | En curso | #2434 | 2026-10-14 |
| 1298 | En curso | #2575 | 2026-10-18 |
| 1300 | Tareas por hacer | #2505 | 2026-10-16 |
| 1331 | En curso | #2371 | 2026-10-13 |
| 1339 | En curso | #2423 | 2026-10-14 |
| 1345 | En curso | #2574 | 2026-10-18 |
| 1356 | Tareas por hacer | #2499 | 2026-10-15 |
| 1387 | Tareas por hacer | #2406 | 2026-10-14 |
| 1404 | En curso | #2412 | 2026-10-14 |
| 1405 | En curso | #2429 | 2026-10-14 |
| 1442 | Tareas por hacer | #2559 | 2026-10-18 |
| 1444 | En curso | #2584 | 2026-10-18 |
| 1490 | Acción del fundador | #2468 | 2026-10-14 |
| 1496 | Tareas por hacer | #2430 | 2026-10-14 |
| 1502 | Tareas por hacer | #2419 | 2026-10-14 |
| 1506 | Tareas por hacer | #2492 | 2026-10-15 |
| 1517 | Tareas por hacer | #2363 | 2026-10-13 |
| 1522 | Tareas por hacer | #2374 | 2026-10-13 |
| 1523 | Tareas por hacer | #2362 | 2026-10-13 |
| 1524 | Tareas por hacer | #2369 | 2026-10-13 |
| 1525 | Tareas por hacer | #2370 | 2026-10-13 |
| 1527 | Tareas por hacer | #2450 | 2026-10-14 |
| 1529 | Tareas por hacer | #2375 | 2026-10-13 |
| 1532 | Tareas por hacer | #2360 | 2026-10-13 |
| 1533 | Tareas por hacer | #2358 | 2026-10-13 |
| 1536 | En curso | #2410 | 2026-10-14 |
| 1537 | Tareas por hacer | #2385 | 2026-10-13 |
| 1538 | Tareas por hacer | #2384 | 2026-10-13 |
| 1543 | Tareas por hacer | #2426 | 2026-10-14 |
| 1546 | Acción del fundador | #2465 | 2026-10-14 |
| 1548 | Tareas por hacer | #2421 | 2026-10-14 |
| 1550 | Tareas por hacer | #2416 | 2026-10-14 |
| 1551 | Tareas por hacer | #2418 | 2026-10-14 |
| 1552 | Tareas por hacer | #2422 | 2026-10-14 |
| 1553 | Tareas por hacer | #2431 | 2026-10-14 |
| 1555 | Acción del fundador | #2456 | 2026-10-14 |
| 1557 | Tareas por hacer | #2484 | 2026-10-15 |
| 1558 | Tareas por hacer | #2522 | 2026-10-16 |
| 1562 | Tareas por hacer | #2566 | 2026-10-18 |
| 1563 | En curso | #2587 | 2026-10-18 |

### Lo que el encargo traía y no aguantó la medida, o hay que matizar

- **«#2568 sigue BLOCKED».** Es cierto, pero no por el rojo de ayer: su obligatorio está **corriendo** (intento 2, lanzado a las 06:35Z). El rojo de las 18:05Z (5 guards) se declaró en `6ee2b55`; el intento 1 sobre ese commit cayó por **un** test que no tiene nada que ver con los 5.
- **«CERRADOS ayer: 1183, 1177, 1237, 1503, 1466 y 1434».** Los seis están cerrados, pero **1183 y 1177 ya estaban en la medida de las 18:4xZ**. Lo nuevo desde entonces son cuatro.
- **«No le llega el correo de `demo@yaqu.app`».** No lo he medido. Lo que sí está medido es que el dominio recibe correo por Cloudflare. Va en el documento como dicho por el orquestador, con mi lectura marcada como lectura.
- Lo demás (1564 puesta y medida, 1565 con su autorización y su uuid, #2588, #2590 y #2591 en `main`, el enlace roto, el 131026, la demo en 403) casa con lo que hay en el repo, en GitHub y en Jira.

### Retoque de las 06:5xZ: #2568 entró mientras se escribía

- El primer empuje de este tramo (`67bf965a`, 06:4xZ) decía «#2568 corriendo». **El intento 2 salió verde a las 06:48:28Z y el bot lo mergeó a las 06:48:54Z** (`fc418648`); `/version` lo servía a las 06:5xZ.
- **Medido por S0 después:** los CSV sin cookie siguen dando 401 **sin** `Cache-Control`, porque el 401 lo pone `requireRole('admin')` (`app.ts:664`) antes del `router.use` que añade `private, no-store`. Control: `/version` devuelve su `no-store`, así que la lectura de la cabecera funciona. **Para ver el arreglo hace falta una descarga con sesión** → la fila 6.11 sigue en §2 con eso como lo único que falta, y sigue siendo lo único movible hoy sin nadie.
- **SCRUM-231 está Finalizada desde el 3-ago**: ningún ticket abierto sigue el VISTO. Va dicho en la fila.

### Error propio

- **Busqué la rama de 1565 con un filtro de `git ls-remote` sin control positivo.** Dio vacío, y el mismo filtro con 1563 también daba vacío, porque la rama de 1563b se borró al mergear. Ese vacío no probaba nada. Lo rehice con la lista entera del remoto, filtrada después. Es la familia de «no pude mirar» igual a «no hay nada».
