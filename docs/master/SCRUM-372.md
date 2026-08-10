# SCRUM-372 · Un dato, un nombre

**Medido contra:** `origin/main` = `3f9585c29af64ed5b326cd89ccd10cd4f83c4c31` · 2026-08-10T11:43:52+02:00
**Rama:** `scrum-372-un-dato-un-nombre`

---

## El defecto

`estadoCobroAlbaran(...)` devuelve **un** derivado de tres valores —`sin_facturar` · `parcial` ·
`facturado`— y se serializaba con **dos nombres** según por qué endpoint entraras:

| nombre | productores |
|---|---|
| `estadoFacturacion` | `albaranes.routes.ts:575` (detalle del albarán) |
| `estadoCobro` | `albaranes.routes.ts:975` · `jobs.routes.ts:336` · `albaranesListado.ts:185` |

Copiar el contexto de una vista a otra daba `undefined`, y **`undefined !== 'facturado'` es TRUE**:
la fila ofrecía «facturar» sobre albaranes ya facturados del todo, sin error y sin que nada se
pusiera rojo. Un botón que solo puede fallar, sobre el documento que cierra el cobro.

## 🔴 La medición añade una segunda cara que el ticket no nombraba

`estadoCobro` **ya nombraba otro dato**: el cobro del TRABAJO —`Pagado` · `Parcial` · `Pendiente`,
de `estadoCobroFor`— con otro juego de valores. Y los dos convivían **en el mismo fichero**,
`jobDetailView.js`, a 300 líneas uno del otro (`job.estadoCobro` en :562, `alb.estadoCobro` en
:245).

Por eso la unificación va hacia `estadoFacturacion` y **no al revés: el otro nombre estaba
ocupado.** Es el defecto hermano de SCRUM-398 —un nombre para dos datos— y este ticket cierra los
dos lados a la vez. El nombre elegido además describe lo que el valor dice: `sin_facturar` ·
`parcial` · `facturado` es facturación, no cobro.

Censo con suelo: 252 ficheros barridos (`src` + `public`), comentarios excluidos.
Antes: 7 usos de `estadoFacturacion`, 26 de `estadoCobro` (de los cuales 12 eran del albarán).
Después: 19 y 14 — y los 14 restantes son **todos** del Trabajo.

---

## Qué cambia

**Backend (3 productores):** `albaranes.routes.ts:975` · `jobs.routes.ts:336` ·
`albaranesListado.ts` (campo del interfaz, el productor y el contador).
El detalle del albarán ya estaba bien y **no se toca**.

**Frontend (2 vistas):** `albaranesView.js` (filtro, clase y chip) · `jobDetailView.js` (contexto
de la fila y los dos badges).

**Fixtures:** `scrum170` · `scrum301` · `scrum304`.

### Fuera de alcance, y dicho

`porCobro` · `EJES_ALBARAN.cobro` · `cobroActivo` son el nombre del **eje de la pestaña**, no el del
dato. Renombrarlos arrastraría los chips de filtro sin arreglar nada de lo que este ticket
describe. Queda anotado en el código donde se cruzan.

---

## El guard

`tests/scrum372-un-dato-un-nombre.test.mjs`, derivado por AST —un `grep` casaría con los
comentarios que explican la prohibición—, con suelo en el censo y en el detector:

1. **Un solo nombre.** Toda propiedad cuyo valor sea una llamada a `estadoCobroAlbaran` tiene que
   llamarse igual. Cubre **las dos formas**: directa (`nombre: estadoCobroAlbaran(...)`) y con
   variable intermedia (`const x = estadoCobroAlbaran(...)` + shorthand), que es como estaba
   escrito el detalle. Sin la segunda, el censo perdería un productor de cuatro.
2. **El nombre retirado no vuelve por el lado del albarán.** El dashboard no puede leer
   `alb.estadoCobro`. Se prohíbe **la lectura sobre un albarán, no el token**: `job.estadoCobro`
   sigue siendo legítimo, y hay control negativo que lo comprueba — un rojo por código ajeno es un
   rojo que alguien silencia.
3. **Hermanos positivos** (SCRUM-237) en las dos negaciones: el detector reconoce un nombre
   disidente y reconoce la lectura prohibida teniéndolos delante.
4. **El residuo, declarado**: un nombre único quita el vector conocido, no la clase entera.

El guard preexistente de **SCRUM-304 se conserva con su intención intacta**: no vigilaba el nombre
viejo, vigilaba que quien LEE la fila y quien SIRVE el endpoint usen el mismo. Un rename a medias
—backend sí, front no— reabre exactamente el `undefined`. Ese es el rojo 5.

---

## Los cinco rojos

| # | inyección | resultado |
|---|---|---|
| 1 | un productor inventa su propio nombre (`jobs.routes.ts`) | rojo por su motivo |
| 2 | la forma con **variable intermedia** (`albaranes.routes.ts`) | rojo por su motivo |
| 3 | el dashboard vuelve a leer `alb.estadoCobro` | rojo por su motivo |
| 4 | se borra la advertencia de lo que el renombre NO arregla | rojo por su motivo |
| 5 | rename **a medias**: backend sí, front no | rojo, y lo caza el guard de SCRUM-304 |

⚠️ **El rojo 2 no valía a la primera.** Renombraba solo la `const`, y eso rompe el shorthand de
abajo: lo cazaba el compilador **antes** que el guard, así que la rama «variable intermedia» del
detector no llegaba a ejercitarse. La primera hipótesis correcta es «caso mal elegido», no «guard
de sobra». Rehecho renombrando los dos, el fichero compila y el rojo es del guard.

El arnés comprueba **cada** sustitución por separado: «una se aplicó» y «se aplicaron las dos» no
pueden dar el mismo resultado, o el rojo mediría un fichero a medio inyectar.

---

## Lo que este ticket NO arregla, declarado

Un nombre único quita el vector conocido, **no la clase entera**: leer un campo que el objeto no
trae sigue dando `undefined`, y `undefined !== 'facturado'` sigue siendo TRUE. Queda escrito en
`jobDetailView.js` y tiene test propio, para que no dependa de que alguien lo recuerde.

Mismo criterio que el hueco de SCRUM-401: **se declara, no se disimula.**

---

## Verificación

- Suite completa: **2412 tests, 0 fallos**, 73 skipped.
- Los 5 rojos salen por su motivo, con recompilación entre inyecciones.
- La corrección se comiteó **antes** de inyectar el primer rojo.
- `git diff --diff-filter=D --name-only origin/main...HEAD` vacío.
