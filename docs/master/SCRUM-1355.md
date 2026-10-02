# SCRUM-1355 · Un presupuesto que nadie ha aceptado no es dinero que le deban al Trabajo

**Medido contra:** `origin/main` = `7a30dbb0e50e1cc4d54949619f7be8d4aac0193f` · 2026-10-01T12:00:00Z

A9: comprobación → `tests/scrum1355-borrador-no-es-deuda.test.mjs`

Sesión S1 (`s1-1oct-b`, relevo de `s1-1oct`) · carril por la fila literal de §11bis de
`docs/equipo/orquestador.md` (`jobs`) · rama `scrum-1355-borrador-no-es-deuda`.

## El defecto

Medido en producción el 1-oct-2026 por la sesión anterior: merchant 46, Trabajo #76 (abierto sin
presupuesto, `totalAceptado` NULL), presupuesto #203 en **borrador**, 121 €, colgado por `Quote.jobId`.
El Trabajo decía que le debían 121 €.

`serializeJob` leía los presupuestos del Trabajo de `quotesDeJob()`, que no filtra por estado, y
`QUOTE_SELECT` **no traía `status`**: el serializador no podía distinguir un borrador. Con
`job.totalAceptado` nulo caía a `quote.total`.

## Una raíz, cinco salidas

| Salida de `GET /admin/jobs` y `/admin/jobs/:id` | Con un borrador, antes | Ahora |
|---|---|---|
| `totalAceptado` | 121 | `null` |
| `estadoCobro` (el chip) | «Pendiente» | `null` (no se pinta) |
| `importeReferencia` | 121 | `null` |
| `remaining` | 121 | `null` |
| `nextStage` / `pendingStagesCount` | el tramo del borrador / 2 | `null` / 0 |

## Arreglo

- `src/modules/jobs/domain/dineroDelTrabajo.ts` (nuevo, puro): el ÚNICO sitio que decide qué presupuestos
  son dinero. Sólo `accepted` (Parte L del máster). Devuelve `totalAceptado`, `restante`, `quoteDelPlan`
  y `aceptados`. Sin estado legible, NO afirma deuda.
- `jobs.routes.ts` · `QUOTE_SELECT` gana `status` (un campo en un `select` que ya viajaba; cero consultas
  nuevas) y `serializeJob` saca las cinco salidas de `dineroDelTrabajo`. `status` es obligatorio en el tipo:
  quitarlo del `select` rompe `tsc`.
- No cambia: el título y la propiedad `quote:` (el documento), lo FACTURADO como segundo eje (SCRUM-363),
  la delegación del detalle en `serializeJob`, y `quotesDeJob`.

Cero texto nuevo, cero esquema, cero camino de emisión.

## Test — `tests/scrum1355-borrador-no-es-deuda.test.mjs` (10 casos)

Criterio importado de `dist` (no copiado) + guard por AST del cableado de `serializeJob`.

Mutantes, todos cazados (BASE 10/10 verde):

| Mutante | Resultado |
|---|---|
| el criterio acepta todo | 5 rojos |
| el criterio no acepta nada (control positivo) | 5 rojos |
| `totalAceptado` vuelve a `quote.total` | rojo (AST) |
| el chip vuelve a `quote.total` | rojo (AST) |
| `importeReferencia` vuelve a `quote.total` | rojo (AST) |
| `buildBillingPlanView(quote, …)` | rojo (AST) |
| `restanteDelTrabajo(todosLosQuotes, …)` | rojo (AST) |
| `QUOTE_SELECT` sin `status` | rojo (AST) |

**Error propio (A9):** la primera pasada dio dos mutantes «vivos». Uno no se había aplicado (sustituí con
CRLF en un fichero LF: una mutación que no se ejecuta se lee como un superviviente). El otro vivía de
verdad: comprobaba `status` por texto y casaba con el `status: true` del `Invoice` anidado. Ahora mira
el primer nivel del literal por AST, con su control de ceguera (`total` tiene que verse).

## Fuera de alcance — reportado, no tocado

- **`POST /admin/jobs/:id/collect-rest`** tampoco filtra por estado: `primeroConTramoPendiente` puede elegir
  un borrador y emitir su tramo. Es camino de emisión (reglas 38/40): STOP, lo decide el fundador.
- `entregaPendiente` toma como eje las líneas del primer presupuesto aunque sea un borrador.
- `Job.totalAceptado` sólo se escribe al crear el Trabajo desde un accept: un adicional aceptado sobre un
  Trabajo directo no lo rellena (cuenta en `remaining`, no en `totalAceptado`).

## Tanda local

9.717 tests · 9 rojos en la primera pasada: 2 míos y arreglados (SCRUM-411: `presupuestoAceptado`
exportado sin consumidor → se le quita el `export`), 1 que pedía este registro (SCRUM-854), y 6 que no
son de la rama: `scrum1093h` ×3 y `scrum1321` (locales conocidos: junction y temporal en otra unidad) y
`scrum1349` ×2 (acusa a `scrum928`/`scrum976`, que esta rama no toca). Los juzga el CI.

---

# SCRUM-1355b · Lo que quedó fuera del repo al cerrar: dos lecciones

**Medido contra:** `origin/main` = `64dc3211d039cedece0cccf9fa3fcaf7d491319d` · 2026-10-01T13:01:52Z

A9: aviso → cicatriz S1 «Contar líneas de un TAP sin anclar el patrón al nombre del test da un recuento inventado.» — no se pudo comprobar: es un recuento hecho a mano en el chat, no pasa por ningún guard

Apéndice de la sesión S1 `s1-1octd`, que releva a la que cerró el ticket. Entra por la rama de
SCRUM-1231 porque la de 1355 ya estaba mergeada (PR #2083) cuando se aprendieron, y empujar a una
rama mergeada la recrea. No cambia nada de lo de arriba.

1. **El recuento inventado.** Al mirar por qué `scrum237` registraba 0 tests en una tanda del CI se
   contaron sus casos buscando `SCRUM-237 · ` en el TAP, sin anclar. Salieron **16**; son **8**: el
   patrón casa con la línea `# Subtest:` y con la `ok` de cada caso. Un número creíble, el doble del
   real. Se cuenta con el patrón anclado al principio (`^ok \d+ - `, `^not ok`).
2. **El hueco del control positivo.** La verificación en yaqu.app (Trabajo #76, merchant 46) vio el
   caso NEGATIVO: el borrador ya no cuenta como deuda. El POSITIVO —un presupuesto aceptado SÍ
   cuenta— **no se vio en producción**: no existe ningún Trabajo con presupuesto aceptado en la cuenta
   QA ni en la demo. Lo cubre solo el test. Se dijo en el cierre (comentario 17894) y el fixture que
   falta es SCRUM-1367. Va también a las cicatrices de S1, con su motivo.
