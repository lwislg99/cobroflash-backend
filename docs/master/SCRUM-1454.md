# SCRUM-1454 · `ya-esta` deja de contar como suyo el commit de OTRO ticket, y admite varios a la vez

**Rama:** `scrum-1454-ya-esta-commit-ajeno` · **Carril:** S5 · **Fecha:** 6-oct-2026
**Medido contra:** `origin/main` = `39af736efc8ccf7d2966063561421855b3e4c4e9` · 2026-10-06T11:24:31Z (hora de GitHub)

A9: comprobación → `tests/scrum1424-ya-esta.test.mjs` (los cuatro casos `SCRUM-1454`)

Carril S5: `scripts/equipo/ya-esta.mjs` y su test. No toca ningún workflow ni `censarTicket`.
GO del orquestador el 6-oct-2026 (~11:20Z); pedido antes dos veces (2-oct) sin respuesta.

## Qué pasaba

### 1 · Un YA ESTÁ falso

`node scripts/equipo/ya-esta.mjs 1434` contestaba **🟢 YA ESTÁ · DESDE el 2026-10-02**. SCRUM-1434 está
en «Tareas por hacer»: sin registro, sin evidencias, sin rama. Lo único que contaba como suyo:

```
da3798df 2026-10-02 SCRUM-1123c: el censo rescatado y su desmentido viajan juntos; linea A9 y el ticket abierto (SCRUM-1434)
```

Es un commit de **SCRUM-1123** que nombra 1434 porque lo ABRE. `censarTicket` (SCRUM-388) acepta
cualquier mención en el asunto —y para su uso vale—; `ya-esta` la contaba como trabajo propio.

### 2 · Cuarenta respuestas vacías

El mismo día el orquestador preguntó por 40 tickets con un bucle suyo y `2>/dev/null`, desde el
checkout compartido, donde el fichero no existe. Node gritaba `Cannot find module` por el stderr; el
bucle lo tiraba; salieron 40 vacíos y se leyeron como «el instrumento está ciego».

El comando admitía UN ticket. Quien pregunta por muchos escribe su propia tubería, y es en esa tubería
donde «no he podido mirar» se pierde.

## Qué cambia

| Antes | Ahora |
|---|---|
| Suyo = cualquier commit de `main` que lo nombre en el asunto | Suyo = el commit cuyo asunto lo lleva **el primero**. `duenoDelAsunto` devuelve el primer `SCRUM-<n>` del asunto |
| El commit ajeno no se distinguía | Sale aparte: `🟠 lo citan · 1 commit(s) de OTRO ticket … (es de SCRUM-1123)`. No cuenta para el veredicto |
| Un ticket por llamada | Varios: `npm run ya-esta -- 1419 1424 1434`. `origin` se trae UNA vez |
| — | Con varios, última línea `RECUENTO · N preguntado(s) · a YA ESTÁ · b NO ESTÁ · c NO HE PODIDO MIRAR` |
| — | Si UNO no se pudo mirar, la salida es 2 |
| — | Un argumento que no es un número no se salta: es un NO HE PODIDO MIRAR más |
| Un fallo no previsto: lo que node quisiera decir | `uncaughtException` y `unhandledRejection` contestan por stdout con NO HE PODIDO MIRAR y salen 2 |

Qué sigue siendo propio, comprobado en el test con asuntos reales: `SCRUM-1434: …`, la letra de fase
(`SCRUM-684b: …`), el merge de su rama (`Merge pull request #2148 from …/scrum-1419-…`,
`Merge remote-tracking branch 'origin/main' into scrum-1424-…`) y la convención vieja
`feat(x): … (SCRUM-7)` cuando es el único ticket del asunto.

Hacia dónde se equivoca: con dos tickets en un asunto, el segundo es una referencia. Si un commit
hiciera trabajo de los dos, el segundo saldría como «lo citan» y no como suyo: falla hacia «falta
trabajo», no hacia «ya está».

## Lo que NO se puede defender desde dentro

Si `scripts/equipo/ya-esta.mjs` **no existe** en el árbol desde el que se lanza, el guion no llega a
correr: habla node, por el stderr, y sale 1. Eso fue exactamente lo del 6-oct y ningún cambio en este
fichero lo alcanza. Lo que sí queda cubierto es el caso vecino —el guion existe y le falta un motor que
importa—: contesta NO HE PODIDO MIRAR por stdout y sale 2 (test «sin sus motores», lanzado con el stderr
tirado). Lo otro lo evita no escribir el bucle: por eso el modo de varios.

## Medido después

`node scripts/equipo/ya-esta.mjs 1434 1123 1419 1424 1453`, contra `39af736e`:

| Ticket | Antes | Ahora |
|---|---|---|
| 1434 | YA ESTÁ (falso) | NO ESTÁ · «lo citan: da3798df (es de SCRUM-1123)» |
| 1123 | YA ESTÁ | YA ESTÁ (el mismo commit, ahora sólo de su dueño) |
| 1419, 1424, 1453 | YA ESTÁ | YA ESTÁ |

`RECUENTO · 5 preguntado(s) · 4 YA ESTÁ · 1 NO ESTÁ · 0 NO HE PODIDO MIRAR`, salida 0.

## Tests

`node --test tests/scrum1424-ya-esta.test.mjs` → 12 de 12 (los 8 de SCRUM-1424 sin tocar lo que
afirman, más 4 nuevos).

El rojo, por el caso exacto: antes del cambio el comando real decía YA ESTÁ para 1434 (arriba). Y por
mutación, con la base sin mutar en 12/12 primero:

| Mutación | Caen |
|---|---|
| M1 · todo commit que lo nombra es suyo (lo de antes) | 3 |
| M2 · con varios, un ciego no manda en la salida | 3 |
| M3 · sin recuento | 2 |
| M4 · lo que no es número se salta callado | 1 |
| M5 · el reventón de un motor no se atrapa | 1 |
| M6 · el commit ajeno no se enseña | 2 |

Seis de seis mueren.

## Lo que sigue sin mirar

- Jira. Lo dice en cada respuesta.
- Trabajo hecho bajo otro número que no nombra éste.
- Ramas `wip-*` (punto 5 de SCRUM-1424, sin cambios aquí).
- Los commits que citan el ticket sólo en el CUERPO: el censo no los trae, ni como propios ni como ajenos.
