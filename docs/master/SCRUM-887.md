# SCRUM-887 · Con descuentos el cliente pagaba más de lo que firmó

**Medido contra:** `origin/main` = `364e7d3a267d8babc49a92244168dc12096ce996` · 2026-09-16T18:13:05Z (tabla y rojo) · suite final tras mergear `origin/main` = `e7f155755446b2a848688cd59ba25c8d9bb9fb26` · 2026-09-16T18:58:50Z
**Rama:** `scrum-887-cobro-descuentos` · **Estado:** PR 1 (caso A) MERGEADO (#1369). PR 2 (B) EN PR
— ROJO (test-first), ver apéndice. Pendientes: PR 3 (bloqueo de C en el editor, literal por
firmar), PR 4 (D2, literal por firmar).

Nace de SCRUM-883 (recorrido del electricista en staging): firma 539,05 €, cobro 628,60 €.

## PASO 0 · la acotación de SCRUM-594 tenía decisión firmada

Los dos tests que afirmaban «la factura ignora el `dto`» (`scrum594…:334`, `scrum600b…:374`)
colgaban de **«DECISIONES CERRADAS · 3-sep-2026 · no reabrir»** (comentario de SCRUM-594): la
propagación del descuento a la factura esperaba a la asesoría. Se paró y se preguntó. Decisión
(SCRUM-887, comentarios **15616** y **15620**, orquestador con delegación expresa del fundador):

| caso | qué | decisión |
|---|---|---|
| A | descuento POR LÍNEA | se aplica en factura y cobro — **este PR** |
| B | descuento GLOBAL, un solo IVA | se aplica como línea negativa del mismo IVA — PR 2 |
| C | descuento GLOBAL, IVA mezclado | la acotación SE MANTIENE; el editor no deja guardarlo — PR 3 |

## La fuente: NO es `pieDePresupuesto` (medido, 40.000 casos)

| | casos | `calcTotal` ≠ pie | hoy: cobro ≠ firmado | con el dto al precio |
|---|---|---|---|---|
| sin descuento | 10.000 | **1.498** | 110 | 110 (máx. 1 cént.) |
| A · un IVA | 10.000 | 2.016 | **9.618** | 116 (máx. 1 cént.) |
| A · IVA mezclado | 10.000 | 3.734 | **9.668** | 126 (máx. 2 cént.) |
| B · global un IVA | 10.000 | 1.950 | **9.449** | — (PR 2) |

`calcTotal` redondea la suma una vez; `calcVatBreakdown` redondea base y cuota por tipo. Hacer
fuente al pie movería céntimos de presupuestos SIN descuento. Decidido (①): **objetivo = total
firmado**, la factura sale de sus líneas con la reconciliación de SCRUM-141, con el `dto` aplicado
al precio antes de entrar. Coste aceptado: 1-2 céntimos en ~1,2 %, la tasa que ya existe sin descuento.

## Qué cambia

Una pieza, `lineasParaFacturar` (`invoiceLines.service.ts`): precio efectivo con `precioConDto`
(la misma función de `calcTotal`) y **sin la clave `dto`** —dejarla invita a aplicarla dos veces—.
Con descuento global devuelve las líneas **tal cual** (B y C no cambian en este PR).
`discountGlobalAmount` es obligatorio: un `select` que no lo cargue lanza, no aplica a ciegas.

Censo por AST de quién convierte `Quote.lines` en factura — **seis caminos + la vista**, todos por la pieza:
C1 aceptación del cliente (`quotes.routes`) · `quotesAdmin` tramo y factura entera · «cobrar el
resto» (`jobs.routes`) · C6 (`lib/invoicing.ts`) · C7 albarán (`albaranes.routes`, casador) ·
`billingPlanView`. Fuera por diseño: recapitulativa y parcial de albarán (precios del albarán).

**NO cambia:** `calcVatBreakdown`, `reconcileToTarget`, el sellado, el PDF de factura, la
numeración (el sello de `scrum291` sigue intacto: ningún hash de emisor tocado), el schema,
ningún documento emitido (regla 29).

## Verificación

- **Rojo primero**, commit `448bc5ac4367ce80d94d6731d8a8ff77d60c0dc6` (empujado antes del
  arreglo): C3 con un IVA firma 589,95 y cobraba **652,78**; muestra A, caso 1897: 22.578,84 → 45.069,70.
- **Arreglo** `8814a78425f717624683a8e8687e59ff922a1dfe`: C3 cobra 589,95 en los planes entero,
  50/50 y 30/70; muestra fija A (semilla 887): peor 1 cént., **18 y 14** de 2.000 distintos
  frente a **18** sin descuento (techos que solo bajan).
- **Positivo:** huella sha256 de 10.000 presupuestos sin descuento × 3 planes (importe, base y
  cuota de 50.000 facturas) congelada con el código anterior — idéntica tras el arreglo.
- **Negativo:** C3 original (IVA mezclado + 25 € global) sigue cobrando 628,60.
- **Mutantes en `src/` real**, cada uno compilado y revertido: albarán sin la pieza → 3 rojos ·
  la pieza conserva `dto` → 1 · aplica con global → 1 (el negativo) · vista con líneas crudas → 3 ·
  un factor 1,0004 sin dto → 4 (entre ellos la huella) · la pieza no aplica nada → 6. Revertido: 39/39.
- **Suite completa con este registro dentro:** 7.113 tests · 7.003 pass · **0 fail** · 110 skipped.

## Suelo y huecos, dichos

- **De extremo a extremo emite UN camino** (albarán → `invoice.create`, banco de SCRUM-290): precio
  10,00 en vez de 12,50 − 20 %, total 36,30. **Los otros cinco no se ejecutaron** por su handler: los
  cubren el test de dominio y el guard AST de procedencia (con control sembrado).
- **No verificado en staging ni en yaqu.app**: toca tras el merge (C3-A aceptado → cobro 589,95).
- Los dobles de Prisma de 141/263/290/597/885 no traían `discountGlobalAmount` (la fila real sí):
  se les añade `null`.
- La factura imprime el **precio unitario neto**, sin fila de descuento. Es lo que llega a sus líneas.
- Una línea con `dto: 100` factura 0: si todas lo están, el portón de SCRUM-246 da 409 (antes se
  cobraba a tarifa). No se relaja nada.

## Para el PR 2 (B), a decidir antes de escribir

- **Albarán (C7) con descuento global:** una factura PARCIAL de albarán tendría que llevarse
  «una parte» del global — eso es un reparto, que es justo lo que la decisión excluye. Propuesta:
  que C7 con global no emita la línea negativa y lo diga, hasta decidirlo.
- El rótulo de la línea negativa: el presupuesto ya enseña **«Descuento global»**
  (`presentacionIva.ts`, fila del pie) → se reutiliza ese literal.

---

# APÉNDICE · PR 2 (B) · con descuento global y un IVA, lo cobrado ≠ lo firmado

**Medido contra:** `origin/main` = `018d18075c4aefb276dd21a47e1ba2186be630ad`
**Rama:** `scrum-887b-descuento-global` · **Estado:** EN PR — ROJO (test-first). El defecto está
documentado y medido; el arreglo del código todavía no está en esta rama.

## Commits (esta sesión, sólo ROJO)

| sha | qué |
|---|---|
| `22adc3e5` | ROJO — caso B (global, un solo IVA): el cobro no coincide con lo firmado en ningún plan, la pieza `lineasParaFacturar` no añade la línea negativa, la vista del plan de cobro no promete lo mismo que se emite, y el albarán (C7) con global emite en vez de rechazar con 409 |

`tests/scrum887b-descuento-global.test.mjs` — la decisión del orquestador (17-sep-2026, tabla de
la cabecera de este fichero, punto B): con global y un solo IVA sale **una línea negativa del
mismo IVA, rotulada «Descuento global»** (el literal que ya pinta el pie del presupuesto) y
reconciliada como el caso A. El caso C (IVA mezclado) se mantiene fuera; su test vive en
`tests/scrum887-*` y no se toca. El albarán (C7) con global **no emite** — es un reparto del
global, justo lo excluido — y lo dice con un código propio (`albaran_con_descuento_global`) y
CERO escrituras antes de rechazar.

## Pendiente (fuera de esta rama)

El arreglo de `lineasParaFacturar` (añadir la línea negativa con global de un solo IVA) y del
handler `POST /:id/convertir-en-factura` (rechazo 409 con descuento global) que pone estos rojos
en verde.
