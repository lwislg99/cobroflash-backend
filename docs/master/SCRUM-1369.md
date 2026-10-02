# SCRUM-1369 · Un presupuesto sin aceptar no deja líneas «sin entregar»

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:24:06Z

A9: sin fallo que generalice — el arreglo y el test salieron a la primera y los tres mutantes se aplicaron de verdad (el mutador comprueba que el fichero cambia antes de contar)

Sesión S1 (relevo de `s1-1octe`) · carril: `src/modules/jobs/**` · rama `scrum-1369-entrega-solo-de-lo-aceptado`.

## El defecto

La ficha del Trabajo #76 (cuenta QA; el #203 es un borrador) decía «1 línea del presupuesto sin
entregar». `entregaDelTrabajo` tomaba como eje el primer presupuesto del Trabajo sin mirar su estado.

## PASO 0 — qué pasa con «original en borrador + adicional aceptado»

| | Antes | Filtrando la lista a secas | **Lo construido** |
|---|---|---|---|
| Eje | el borrador | el ADICIONAL (el eje cambia de presupuesto) | ninguno |
| Salida | `calculable:false`, `hay_adicionales` | un número, medido contra el adicional | `sin_eje` |

Filtrar la lista a secas mueve el eje al adicional, que es lo que el ticket manda parar y decir. No se
ha hecho. Se ha copiado la forma de `quoteDelPlan` en `dineroDelTrabajo.ts`: el eje es el ORIGINAL
sólo si está aceptado; si no, no hay eje. En ese caso la pantalla no afirmaba un número antes y no lo
afirma ahora.

**Decisión que queda para un jefe, dicha:** si en un Trabajo directo el primer presupuesto ACEPTADO
debería ser el eje aunque delante haya un borrador. Hoy no lo es.

## El arreglo

- `src/modules/jobs/domain/entregaDelTrabajo.ts`: función nueva `presupuestosQueSeEntregan` (el
  original si está aceptado + los adicionales aceptados). Usa `presupuestoAceptado`, el criterio de
  SCRUM-1355; no se escribe otro. `entregaDelTrabajo` NO se toca (sus tests le pasan presupuestos sin
  `status`).
- `src/modules/jobs/app/routes/jobs.routes.ts`, `serializeJobDetail`: la llamada pasa por la función.

**Segundo cambio de conducta, más allá del caso medido:** un adicional en BORRADOR sobre un original
aceptado ya no cuenta como «hay adicionales». Antes apagaba el cálculo; ahora la ficha cuenta las
líneas del original. Un adicional ACEPTADO lo sigue apagando, como en C6.

## Test — `tests/scrum1369-entrega-solo-de-lo-aceptado.test.mjs` (6 casos)

Entra por la ruta real (`GET /:id` de `dist/…/jobs.routes.js`) con la base doblada.

| Mutante (sobre `dist`, aplicación comprobada) | Resultado (BASE 6/6) |
|---|---|
| la ruta no filtra | 4 rojos |
| el criterio acepta todo | 5 rojos |
| los adicionales no se filtran | 2 rojos |

## Lo que NO está hecho

- **No visto en yaqu.app**: hay que esperar al despliegue y abrir `#jobs-detail/76` con la cuenta QA.
- El caso positivo (aceptado con líneas pendientes) **no se puede ver en producción**: no hay Trabajo
  con presupuesto aceptado en la cuenta QA (SCRUM-1367). Sólo por test.
- El doble de la base no evalúa el `where`: el filtro por `merchantId` no lo prueba este fichero.
- La lista de Trabajos no lleva `entregaPendiente`; sólo se ha tocado el detalle.
