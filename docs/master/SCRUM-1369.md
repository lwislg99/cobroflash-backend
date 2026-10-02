# SCRUM-1369 · Un presupuesto sin aceptar no deja líneas «sin entregar»

**Medido contra:** `origin/main` = `5d7aaebc41d71d24102a4852c1de04059d9ac559` · 2026-10-02T11:24:06Z

A9: comprobación → `tests/scrum1344-arnes-de-prueba-con-rol.test.mjs`

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

**Error propio (A9):** el primer empujón (`5319d86a`) salió ROJO en el obligatorio, con `# fail 1`: el
test armaba el `req` escribiendo `userRole` a mano, y SCRUM-1344 exige `reqDeSesion`. No corrí ese guard
en local: elegí los tests «que nombran lo tocado», y un guard que censa `tests/` no nombra nada. Lo
cazó el CI, que es la comprobación que ya existía. Corregido el test, no el guard.

## Lo que NO está hecho

- **No visto en yaqu.app**: hay que esperar al despliegue y abrir `#jobs-detail/76` con la cuenta QA.
- El caso positivo (aceptado con líneas pendientes) **no se puede ver en producción**: no hay Trabajo
  con presupuesto aceptado en la cuenta QA (SCRUM-1367). Sólo por test.
- El doble de la base no evalúa el `where`: el filtro por `merchantId` no lo prueba este fichero.
- La lista de Trabajos no lleva `entregaPendiente`; sólo se ha tocado el detalle.

---

## Segunda tanda (2-oct) · un borrador no desplaza a un aceptado

**Medido contra:** `origin/main` = `643e9a65a5756b9729c9f8d4b911ea0c536988b3` · 2026-10-02T13:07:57Z

A9: sin fallo que generalice — el cambio es una línea sobre una función ya probada por la ruta, y los dos mutantes se aplicaron y cayeron a la primera

Sesión S1 (relevo de `s1-2octa`) · rama `scrum-1369b-eje-es-lo-aceptado`.

**La decisión que quedaba abierta, contestada** por el orquestador del equipo en mensaje entre sesiones
(2-oct; **no es una firma del fundador**, y se dice): «un borrador no desplaza a un aceptado: el eje es
lo que el cliente ha ACEPTADO; sin aceptado no hay eje, y eso se dice, no se rellena».

| Presupuestos del Trabajo | Primera tanda | **Ahora** |
|---|---|---|
| borrador + aceptado | `sin_eje` | `calculado`, contra las líneas del ACEPTADO |
| borrador + aceptado + aceptado | `sin_eje` | no calculable, `hay_adicionales` (C6, igual que sin el borrador) |
| ninguno aceptado | `sin_eje` | `sin_eje` (sin conteo y sin total: ni un cero) |
| aceptado + borrador | `calculado` | igual |

**El arreglo:** `presupuestosQueSeEntregan` devuelve los aceptados en su orden (`lista.filter(presupuestoAceptado)`).
Ni `entregaDelTrabajo` ni la ruta se tocan.

⚠️ **Lo que deja distinto, dicho:** `quoteDelPlan` de `dineroDelTrabajo.ts` (dinero) sigue exigiendo que el
aceptado sea el PRIMERO de la lista. Con borrador + aceptado, la entrega ya tiene eje y el plan de cobro
no. No se ha tocado: es dinero y es otro ticket (SCRUM-1370 está al lado).

**Test** — el mismo fichero, ahora 8 casos. Corridos con `scrum423`, `scrum411` y `scrum1344`: 76 de 76.

| Mutante (sobre `dist`, aplicación comprobada) | Resultado (BASE 8/8) |
|---|---|
| lo de la primera tanda (el original sólo si está aceptado) | 3 rojos |
| no filtra | 6 rojos |

**No hecho:** no visto en yaqu.app, y no se puede ver: la cuenta QA no tiene ningún Trabajo con un
presupuesto aceptado (SCRUM-1367). `npm run tanda:dirigida` no se corrió; el juez es el CI.
