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


## Tramo 1563e · la foto del 27-oct (S0)

**Medido contra:** `origin/main` = `42c458e192608d71f5e06611976c89f9da3ff297` · producción (`/version`) = el mismo · `Date:` de GitHub 2026-10-27T18:41:25Z

A9: comprobación → `docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs`

Encargo del orquestador (27-oct, SCRUM-1563 c.21195): el fundador volvió a preguntar cómo va la hoja de ruta, si crece el Jira y si estamos cerca de que una empresa lo use. Contestarlo desde la medida, con la columna «de quién depende» como razón de ser, re-midiendo las cifras del propio encargo.

### Qué cambia en el documento

- **§1 contesta las cuatro preguntas del fundador**, en su orden, con una tabla por pregunta.
- **§1b nueva: SIF-1 tramo a tramo** (3 de 8), con quién bloquea cada tramo que falta, medido en el árbol y no en el máster.
- **9 filas pasan a §8:** 3.11, 3.12, 3.13, 5.2, 6.10, 6.11, 7.2, 7.4, 7.5. **17 nuevas:** 1.13-1.15, 2.12-2.14, 3.18-3.20, 5.3, 6.12-6.17, 7.9. Quedan **74**.
- **§1 ③ separa el saldo del equipo de Luis del total**: el total baja (−17 en 24 h) y lo nuestro sube (+5).
- **§4 re-medida** contra Jira; **§5** con su fila nueva y la de la medida 1563d (#2604), que no entró.
- **La medida 1563d (19-oct, 07:50Z) no se mergeó**: #2604 lleva 8 días con `build + tests (con banco desechable)` en rojo. Lo que medía (6.10 y 6.11 hechas, 6.12 nueva) se ha vuelto a comprobar en GitHub (#2595, #2599, #2603: los tres MERGEADOS el 19-oct) y entra aquí. **Con esta, #2604 queda superada**; cerrarla es del orquestador.

### Cómo se midió

- **Jira:** las 74 claves de §2 (más 1390, 1585 y 1594) en una consulta, con su estado y su última actualización. Las 32 que cambiaron desde el 19-oct se leyeron con **dos lectores de sólo lectura en paralelo**, que devolvieron su último comentario, lo que falta y de quién depende. **S0 releyó entero SCRUM-1264**, porque contradecía al encargo (la cita del asesor).
- **`npm run ya-esta`** sobre los 56 tickets abiertos de §2: 36 YA ESTÁ (con trabajo en `main`), 20 NO ESTÁ, 0 NO HE PODIDO MIRAR.
- **Filas sin ticket (2.9, 2.10, 7.8):** búsqueda de texto en Jira desde el 19-oct (`albaran_para_firmar_es`, `trial_expired`, `quote_decision_es`, `planExpiresAt`, `EMAIL_FROM`) y en los commits de `main`. **0 sobre esas filas; control: la misma consulta devuelve 26 tickets de otras cosas.**
- **S1-D en el árbol:** `enviarSobre` se define en `sif.client.ts:355` y ningún otro fichero de `src/` lo importa; `sif.procesador.ts` no tiene llamador; `encolarAltaTrasSellado` sí (`selladoEstado.ts:173`).
- **Saldos de Jira:** las seis consultas de §5 y cuatro más por ventana. **Los dos controles cuadran exactos:** 264 − 151 + 66 = 179 y 99 − 9 + 31 = 121.
- **Dependencias:** el contador sobre §2, con control sobre la versión de `main` (`42c458e1`, la del 19-oct a las 06:43Z), que da lo publicado entonces (66 · 44/29 · 28/12 · 11/4 · 6/2). Y una comparación fila a fila de las dos versiones con el mismo criterio de columnas: **las 29 filas sólo-del-fundador del 19-oct siguen las 29.**

### Lo que el encargo traía y no aguantó la medida

| lo que se afirmó | lo que se midió |
|---|---|
| «este documento no existe» | existe desde el 18-oct (#2564) |
| la cita con el asesor, «fijada el 1-oct para dos semanas» | no hay asesor (c.19623, 14-oct); el fundador lo aplazó hasta la S.L. (c.20088, 20-oct) |
| «S1-D · El envío → El equipo» | carril J1, sin ticket abierto, y el certificado es del fundador |
| «tres de los cuatro que faltan son suyos» | faltan cinco tramos y los cinco necesitan al fundador |
| la auditoría del 19-ago (cola y envío «sin construir») | la cola encola desde el 30-sep; procesador y cliente existen sin enchufar |

**Aguantaron:** SIF-1 3 de 8, «hay 3 aceptados» y el saldo de 24 h (39 · 22 · −17) para el proyecto entero.

### Error propio

- **Escribí a mano las cifras de §1 y §3 (67 filas, 46/24, 10 nuevas) antes de correr el contador**, y estaban mal: eran 74 filas, 50/30 y 17 nuevas. Peor: a partir de esas cifras escribí que lo sólo-del-fundador «bajaba de 29 a 24», que era lo contrario de lo que pasa (las 29 siguen y suma una). Lo cazó el contador antes del commit. Es la tercera vez en este mismo registro que una cuenta a mano sale mal (tramos 1563 y 1563b): el contador se corre ANTES de escribir la frase, no después.

## Tramo 1563f · la foto del 29-oct (S0)

**Medido contra:** `origin/main` = `d12e99784cf3927e13972e1e370ddc19f5d08a19` · producción (`/version`) = el mismo · `Date:` de GitHub 2026-10-29T10:45:24Z (empezado a las 10:20Z sobre `503f0d86`; `main` se movió tres veces durante la medida)

A9: comprobación → `scripts/equipo/ya-esta.mjs`

*(La lección, que el formato de la línea A9 no deja escribir: la fila 4.3 estuvo un mes de más porque su fuente era el último comentario de Jira, escrito seis minutos antes del merge que lo dejaba viejo. `ya-esta` mira `main`, no Jira: es la comprobación, y el paso 3 de §7 del documento ya la manda correr por fila. Hoy, `ya-esta 1292` da «🟢 YA ESTÁ en origin/main · DESDE el 2026-09-30» con #2006 dentro. Si el 27-oct, cuando se corrió sobre 56 tickets a granel, dio lo mismo para 1292: NO CONSTA, porque la salida de aquel día no se guardó.)*

Encargo del orquestador (29-oct): las tres correcciones que dejó la sesión anterior de S0 (4.3 → §8; 2.4 es el chip de S2; 1087, 1088 y 1593 → §8, 1589 y 1608 cerrables tras verlos), y re-medir lo que el orquestador midió por la mañana: producción, CI, 12 PR en conflicto, SCRUM-914, SCRUM-1566, SCRUM-1632 y las etiquetas de 1626-1632.

### Qué cambia en el documento

- **Sale 4.3** (SCRUM-1292, #2006 mergeado el 30-sep) a §8, y **entran a §8** 1087, 1088 y 1593 (no eran fila). **Entra 3.21** (SCRUM-1566, B y C autorizados). Quedan **74**.
- **Corregidas:** 6.3 (no espera una rama: espera dos piezas de S1; la rama de J3 lleva 9 días en conflicto), 2.4 (falta el chip de S2, no verlo), 2.9 y 2.10 (ya con ticket y con un arreglo nuestro esperando GO), 3.18 (1594 entró a las 10:40Z: la fila pasa a sólo JAVIER).
- **§4b nueva: 12 PR en conflicto**, ocho de Javier y cuatro nuestros, dos de ellos de tickets ya Finalizada. Y el obligatorio en rojo de los 23 abiertos.
- **§1** con el saldo de 40 h (−1, y 0 cierres de Javier), la tabla de lo que no aguantó del encargo, y la nota sobre #2606.

### Cómo se midió

- **Producción y `main`:** `yaqu.app/version` a las 10:20Z, 10:39Z y 10:45Z; `git log --first-parent` entre cada par.
- **CI:** `gh api …/actions/runs` (en cola, en marcha, y las 40 últimas por estado) a las 10:2xZ.
- **PR:** `gh pr list --json mergeable` dos veces (la primera dio `UNKNOWN` en 17 de 20: GitHub recalcula tras moverse `main`; la segunda, 12 `CONFLICTING`), y `statusCheckRollup` del obligatorio de cada uno de los 23. El equipo, por la etiqueta del ticket en Jira.
- **Jira:** las seis consultas de §5 y dos por ventana; una consulta de 22 claves con estado y etiquetas; y un lector de sólo lectura con cita literal de c.20085, c.21207, c.21019, c.21031, c.21199, c.21202 y c.17637. **Control:** 179 − 3 + 2 = 178 y 73 + 59 + 46 = 178, exactos.
- **Árbol:** `git grep` de `parseToken` (5 usos, 0 en `src/modules/jobs/`), de `equipment` en `schema.prisma` y `src/` (0; control `model Albaran`), de `enviarSobre` (sólo comentarios fuera del cliente) y `api.js:1448-1458` (el chip).
- **Dependencias:** el contador, con control sobre la versión del 27-oct, que da lo publicado (74 · 50/30 · 26/7 · 21/10 · 6/2).

### De paso

- **#2980 (1628b, de S0) tenía el obligatorio en rojo** a las 10:24Z por `scrum1294` («ancla del 2026-10-29 sin línea A9», en `SCRUM-1628.md:73`); el otro fallo, `scrum976 ④`, era `guards:entrada` cayendo por ese mismo test. Con GO del orquestador: la línea A9 y su lección, `scrum1294` 4/4, `guards:entrada` 170/170 con salida 0 y los 5 de árbol entero 46/46; empujado `2f4889b69f007a1c1bd00487d63d9bb4fd3ab262`.

### Error propio

- Corrí `guards:entrada` con `2>&1` en PowerShell 5.1 y salió «exit 2» con 170/170 en verde: es la trampa conocida de `NativeCommandError`. Lo repetí sin redirigir y dio 0. Un código de salida leído así no vale ni para bien ni para mal.


## SCRUM-1563g · 29-oct-2026 por la tarde: recuento tras 10 PR y la hoja de decisiones del fundador

**Medido contra:** `origin/main` = `eafca9fe1` · producción NO medida en esta pasada · `Date:` de GitHub 2026-10-29T17:50:54Z

A9: sin fallo que generalice — tramo de documento; el recuento lo da el contador, no la mano

- **Recuento de §2:** 74 → **71 filas** · FUNDADOR **48/29** · JAVIER 26/8 · NOSOTROS **19/8** · ASESOR 6/2 (`node docs/master/evidencias/SCRUM-1563/contar-dependencias.mjs docs/producto/ESTADO-DEL-PRODUCTO.md`). Salen a §8 2.12 (1589), 5.3 (1623 y 1626, con la nota «no verificado en pantalla»), 6.14 (1608) y 6.15 (1588). Entra 5.4 (SCRUM-1638, abierto por S0 hoy). Corregidas 2.4 (chip #2986), 2.9 (guías #2985; `parseToken` sigue en 0 en `src/modules/jobs/`), 2.11 (tres servicios, dato del orquestador c.21240), 3.18, 3.21 (la rama compartida SÍ existe, `8f6becbd2`) y 6.16 (queda 1629).
- **Hoja nueva:** `docs/producto/DECISIONES-DEL-FUNDADOR.md`. Las 48 filas del fundador en cuatro partes: A, 3 que puede decidir el orquestador (1.8, 6.12, 3.17) y dos mitades (2.9 b y 1.1, porque `albaranPublic.routes.ts` y `albaranes.routes.ts` están fuera de `RUTAS_FISCALES`, `scripts/puerta-avisador-rojo.mjs`); B, 3 que bloquean hoy (0.1, 2.11, 2.9 a); C, 11 que esperan a la S.L.; D, 31 para la revisión de go-live, en bloque. 3 + 3 + 11 + 31 = 48.
- **Sin medir, y dicho en la cabecera del documento:** §1, §4 y §4b siguen con la medida de las 10:20Z; producción (`/version`) no se leyó.
- **Lectura de S0, no decisión:** que A no le toque al fundador. La columna «depende de» de §2 no se cambió para esas filas; lo decide el orquestador. Para 1.1, antes hay que leer la regla 40 del máster.
- **Jira:** SCRUM-1554 (de `equipo-javier`) sólo recibe un comentario con el enlace; no se pone En curso.

## 29-oct-2026 ~18:10Z (GitHub) · S0 · tramo 1563h: la hoja, para PULSAR

`origin/main` = `5a247020e`. Sobre la rama `scrum-1563g-hoja-decisiones-fundador` (PR aún sin abrir por el bot a las 18:02Z).

- **Parte A** decidida por el orquestador: salen 2.9 b (GO dado; PR #2998 ABIERTO, sin mergear), 1.8 y 6.12 (a SCRUM-1638) y 3.17. **1.1 NO sale:** `albaranes.routes.ts` es camino de emisión (`emitInvoice` en `:1390` y `:1672`), aunque esté fuera de `RUTAS_FISCALES`.
- **Parte B** con pasos: B1 la S.L. (SCRUM-143 c.19619, c.20086, c.20865: no consta firma del notario) · B2 una visita a Meta para los cuatro botones (`docs/WHATSAPP_TEMPLATES.md:52-62`) con la prueba del móvil.
- **2.11 baja a D:** el backend ya manda `YaQu <no-reply@yaqu.app>` (SCRUM-1115 c.19624) y los otros dos sólo escriben a buzones internos (`:335`, `:346`).
- **Simulacro de SCRUM-1605** en D, del fundador.
- **Parte E nueva:** SCRUM-1529, las siete en c.19228 y máster `:403-409`.
- ⚠️ La skill `.claude/skills/yaqu-wa-templates/SKILL.md:20,30,31,33` en `origin/main` sigue diciendo «la URL base termina en `/{{1}}`», contra `docs/WHATSAPP_TEMPLATES.md:52` (corregido en #2985). No la toco: `.claude/*` es del orquestador.

## SCRUM-1563i · 29-oct-2026, 18:12Z-18:20Z (GitHub) · S0: la clase de cada fila, la skill de plantillas y lo que quedó sin medir

**Medido contra:** `origin/main` = `c93f26a76` · producción (`/version`) = `c93f26a765313ce7834ecf276ddc3c09673527cc`, el mismo, leído a las 18:15:28Z (`Date:` de GitHub). Rama `scrum-1563i-etiquetas-hoja`, encima de `scrum-1563g-hoja-decisiones-fundador` (PR #2999, sin mergear) para no reiniciarle el obligatorio.

A9: aviso → A10 «Cero no es «está limpio»: es «no he mirado».» — no se pudo comprobar: `gh pr list --json mergeable` devolvió 20 de 25 PR en `UNKNOWN` (GitHub calcula el estado al pedirlo PR a PR); leído como «sin conflicto» habría dicho 0 donde hay 13. Lo cacé porque la suma no daba 25 con los dos estados que esperaba; no hay guard que lo mire por mí

**1 · La clase de cada fila de `DECISIONES-DEL-FUNDADOR.md`.** Etiquetas de los **47** tickets que nombra la hoja, leídas con `fields: key, summary, status, labels`. **11** `stop-fundador` · **11** `equipo-javier` · **7** `fundador` · **27 sin ninguna de las tres** (20 con alguna + 27 = 47). Cada fila lleva ahora su clase; donde no hay etiqueta, MI LECTURA, marcada. **Partidas en (a)/(b)** las que mezclan dos: 0.3·3.6, 3.1, 3.3·3.4, 3.5 (parte C); 1.1·3.14, 3.9, 3.10, 3.19, 7.6, 7.9 (parte D). **Seis tickets donde Jira y lo medido no casan** (tabla al principio de la hoja): 1115, 1525, 523, 1632, 1390, 913. Candidatas a salir de la lista del fundador, MI LECTURA: 3.2 (870, sólo `equipo-javier`) y 6.4 (1056: el ALTER lo aplica el colaborador). **No se ha cambiado ninguna etiqueta en Jira**: lo decide el orquestador.

**2 · SCRUM-1529:** sale de «no hay nada que preguntarle» y entra como **UNA pregunta en el bloque de go-live**, con las siete citadas: «¿confirmas estas siete?». c.19228 es el orquestador de Javier recogiendo la decisión, no la voz literal del fundador. **No se cierra.**

**3 · La skill `yaqu-wa-templates` contra el repo** (medido en `origin/main` = `c93f26a76`; la skill la tocó por última vez `f6be6854f`):

| dónde | dice | choca con |
|---|---|---|
| `.claude/skills/yaqu-wa-templates/SKILL.md:20` | «**Botón URL dinámica:** la URL base termina en `/{{1}}`» | `docs/WHATSAPP_TEMPLATES.md:52-55` («en WhatsApp Manager el campo URL se escribe SIN `{{1}}`») |
| `SKILL.md:30` | `quote_decision_es` → `/pay/quote/{{1}}` | `WHATSAPP_TEMPLATES.md:61` (`https://yaqu.app/pay/quote/`) |
| `SKILL.md:31` | `payment_request_es` → `/pay/invoice/{{1}}` | `WHATSAPP_TEMPLATES.md:62` |
| `SKILL.md:33` | `payment_confirmation_invoice_es` → `/recibo/{{1}}` | `WHATSAPP_TEMPLATES.md:63` |
| `SKILL.md:27-34` | «**Las 5 plantillas**» | el código tiene **7**: `src/integrations/whatsappTemplates.ts` nombra también `albaran_para_firmar_es` y `albaran_firmado_es`. **Falta justo la de B2**, la del enlace roto |

**El fondo, con la spec delante: los dos caminos piden cosas distintas al ESCRIBIR, y lo mismo al TERMINAR.**
- **API** (`POST /<WABA>/message_templates`): el `url` del botón **se escribe con `{{1}}` al final**: «Supports 1 variable, appended to the end of the URL string», con `example` obligatorio si lleva variable (developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components, leído el 29-oct). **Nosotros no usamos este camino:** `message_templates` aparece **0** veces en `src/` y `scripts/` de `origin/main` (control positivo de la búsqueda: `graph.facebook.com` sí aparece, en `src/integrations/whatsapp.ts`).
- **Editor de WhatsApp Manager** (el que usamos): **Meta no documenta en ninguna página que yo haya encontrado** si el editor añade él el `{{1}}` al elegir «Dinámico». Lo dicen guías de terceros, y la búsqueda del 29-oct no encontró ninguna página de ayuda de Meta. **Lo que sí está medido** es el síntoma: el enlace llegó como `/albaran/%7B%7B1%7D%7D<token>` (SCRUM-1632) y antes `/pay/quote/{{1}}23` (P3-1, `docs/BUGS.md:1172`): **un `{{1}}` literal más la variable**, que es lo que sale si el editor pone el suyo y alguien teclea otro.
- **Lo que vale en los dos caminos es el estado FINAL: un solo `{{1}}`, al final.** Por eso la instrucción segura no es «escríbelo» ni «no lo escribas», sino «**escribe la base acabada en `/`; si el editor no enseña un `{{1}}` al final, ése sí lo pones; al terminar tiene que haber UNO**», y se comprueba en el móvil, no en el panel. Es lo que ya dicen `WHATSAPP_TEMPLATES.md:52-55` y la parte B2 de la hoja. **La skill describe el estado final como si fuera lo que se teclea.** Ése es el origen de la confusión.

**Corrección exacta que haría falta en la skill** (no la aplico: `.claude/**` tiene dueño; la sube el orquestador):

`SKILL.md:20-21`, sustituir por:
```
- **Botón URL dinámica — en WhatsApp Manager el campo URL se escribe SIN `{{1}}`:** «Tipo de URL:
  Dinámico» y la base acabada en `/` (p. ej. `https://yaqu.app/albaran/`). Al terminar tiene que
  quedar UN SOLO `{{1}}`, al final; si hay uno tecleado a mano, ése sobra. (Sólo por API el `url`
  se escribe con `{{1}}`, y aquí no se crean por API.) Se comprueba en el MÓVIL: copiar el enlace
  del botón; si lleva `%7B%7B1%7D%7D`, está mal. Detalle: `docs/WHATSAPP_TEMPLATES.md:52-75`.
  El código envía SOLO el sufijo (el token), no la URL completa.
```
`SKILL.md:27-34`, la tabla: título «**Las 7 plantillas**», la columna «Botón» con la base sin `{{1}}` (`https://yaqu.app/pay/quote/`, `…/pay/invoice/`, `…/recibo/`), y dos filas nuevas, copiadas de `docs/WHATSAPP_TEMPLATES.md` (sus variables NO se dictan aquí: las da esa spec):
```
| `albaran_para_firmar_es` | Utility | (ver WHATSAPP_TEMPLATES.md) | URL "Ver y firmar" → base `https://yaqu.app/albaran/` |
| `albaran_firmado_es` | Utility | (ver WHATSAPP_TEMPLATES.md) | (ver WHATSAPP_TEMPLATES.md) |
```
`yaqu-fase-b/SKILL.md` no repite la regla (0 coincidencias de `URL` o `{{1}}`): no hace falta tocarla.

**4 · Lo que quedó sin medir, cerrado** (`ESTADO-DEL-PRODUCTO.md`): `/version` = `main` · §1 ③: 175 abiertos (178 − 9 + 6, exacto), Javier 59 → **64 sin crear ninguno** (cinco re-etiquetados, NO medido cuáles) · §4: salen cinco Finalizadas (1589, 1594, 1608, 1623, 1626); 1518 ya tiene el chip en `main` · §4b: **13** en conflicto de 25 abiertos (entra #2738, de un ticket Finalizado). **§2 no se ha recontado.**
