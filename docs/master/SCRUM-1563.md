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
