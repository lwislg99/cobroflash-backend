# SCRUM-1563 · El estado del producto, en un documento vivo

Un registro por ticket (SCRUM-273). Quien lo actualice después AÑADE su tramo al final; no reescribe el de otro.

## Tramo 1563 · primera foto (S0)

**Medido contra:** `origin/main` = `bea8415859996e0bda44c7d85011235120ab6ca3` · 2026-10-18T17:13:31Z

A9: aviso → cicatriz S0 «Un comentario que cuenta una escritura se manda DESPUÉS de leer que la escritura entró.» — no se pudo comprobar: los permisos y los comentarios de Jira no pasan por ningún test del repositorio

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
