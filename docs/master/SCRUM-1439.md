# SCRUM-1439 · El IVA del presupuesto rápido: las mediciones del servidor, y por qué 4 decimales no sirven

**Medido contra:** `origin/main` = `d19852d7844a03cc9b0c93acf6e13220409c07e5` · 2026-10-02T17:16:01Z

A9: aviso → cicatriz S1 «Cuando el código cita un ticket, ese ticket se lee antes de llamar defecto a lo que se ha medido.» — no se pudo comprobar: es el orden en que una sesión lee, y ningún guard mira eso

Sesión S1 (`s1-2octe`) · rama `scrum-1439-sondas-como-evidencia`. **Sólo evidencia: ninguna línea de `src/`
ni de `tests/` cambia.** El detalle está en Jira (comentarios 18219, 18220, 18223 y 18224); aquí va lo
que hace falta para volver a correrlo.

## Las sondas

En `docs/master/evidencias/SCRUM-1439/`. Las tres ejecutan funciones puras de `dist/` y nada más: no
emiten, no numeran, no sellan, no tocan base ni red. Se lanzan con `node <sonda> <árbol con dist/ compilado>`.

| Sonda | Qué ejecuta | Qué contesta |
|---|---|---|
| `sonda-decimales.cjs` | `CreateQuoteSchema`, `calcTotal`, `calcVatBreakdown`, `formatImporteEs` | cuántos decimales admite `price`, en qué unidad va `tax`, y si lo tecleado vuelve |
| `sonda-factura.cjs` | además `resolveBillingPlan`, `distributeStageAmounts`, `lineasParaFacturar`, `stageLinesReconciled`, `grossOfLines`, encadenadas como `quotes.routes.ts` al aceptar | si las facturas de un presupuesto suman lo aceptado |
| `sonda-factura-detalle.cjs` | lo mismo, caso a caso y por banda de importe | el detalle de los casos que no cuadran |

## Lo que salió (2-oct-2026, sobre el `main` de arriba)

**El alta:** `price` admite 4 decimales y rechaza el quinto (no trunca). `tax` es fracción: un 21 se
rechaza con «El IVA fuera de rango (0 a 1)».

**La población del barrido:** 299.901 importes, de 1,00 a 3.000,00 €, cantidad 1, tipo 21 %, precio =
tecleado / 1,21 redondeado a N decimales. No son precios reales de profesionales.

| | 2 decimales | 4 decimales |
|---|---|---|
| Lo tecleado ≠ total del presupuesto | 52.049 | 0 |
| Un tramo: factura ≠ presupuesto | 0 | 2.834, un céntimo |
| Dos tramos: suma de las facturas ≠ presupuesto | 3.808, hasta 2 céntimos | 2.479, un céntimo |
| Dentro de cada factura: base + cuota ≠ su total | 0 | 0 |

**La causa:** `Quote.total` sale de `calcTotal` (redondea el producto) e `Invoice.total` de `grossOfLines`
(base redondeada + cuota redondeada, lo que va a la huella). Con 2 decimales coinciden; con 4, no.
`reconcileToTarget` ya busca un precio que cuadre y en esos casos no lo encuentra.

**Los 4 decimales quedan descartados** (decisión del orquestador, 2-oct-2026): cambian el céntimo de
sitio, del presupuesto a la factura.

**La fila de 2 decimales y dos tramos NO es un defecto:** es el coste que el fundador aceptó en SCRUM-141
(27-jul-2026), escrito en `docs/COMO_FUNCIONA_YAQU.md`.

## Errores propios

- Di «el documento cuadra» tras comprobar sólo que `calcTotal` devolvía lo tecleado; no comprobé que
  base + cuota sumaran el total. Era cierto para 100 y falso en 2.834 importes.
- Di los 2 céntimos de los dos tramos como «vivo hoy» antes de leer SCRUM-141, que el propio código citaba.

## Lo que NO está medido

- El PDF: no se ha generado. Los números son los de las funciones que lo alimentan.
- La emisión de verdad (numeración, sellado, huella): no corre sin base.
- Planes personalizados, descuento de línea y global, varias líneas, tipos mezclados.
- Otros tipos y cantidades, salvo: cantidad 3 al 21 % (2.377 en un tramo, 2.935 en dos) y 10 % a dos tramos (0).
- Que no exista NINGÚN precio para los 2.834: se deduce de que `reconcileToTarget` no lo encuentra en su ventana.
