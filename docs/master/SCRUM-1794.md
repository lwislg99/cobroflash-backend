# SCRUM-1794b · La tabla de líneas y el desglose de la factura, como función pura exportada de J2 (para el correo de S1)

**Medido contra:** `origin/main` = `42cae61092ba69761d6d7bba0504abe6baee1e52` · 2026-11-24T01:51:41Z

A9: comprobación → `tests/scrum1794b-detalle-de-la-factura-exportado.test.mjs`

Mutaciones: catálogo → `tests/scrum1794b-detalle-de-la-factura-exportado.test.mjs`

Carril J2 (`src/modules/billing/**`, `docs/equipo/dos-equipos.md:120`; el fichero nuevo lo dio `node scripts/carriles.mjs de --nueva`). Encargo del orquestador J (`cobroflash-backend-2d`), 24-nov-2026, sesión `jv-j2eh`. Decisión: SCRUM-1794 c.22461 (punto 3), sobre la medición de jv-j2eg en c.22459. Nada en `src/modules/messaging/**` (S1), `public/` ni `prisma/`. Ningún texto nuevo.

## Qué se hizo

- `detalleDeLaFactura` sale de `payInvoice.routes.ts` (donde vivía sin exportar desde SCRUM-1787h) a **`src/modules/billing/app/routes/detalleDeLaFactura.ts`**, exportada y pura (no lee base, reloj ni entorno). Sigue importando `pieDePresupuesto` de `presentacionIva.ts` (S1), sin copiarlo.
- Firma: `export function detalleDeLaFactura(invoice: FacturaConLineas | null, importeDelCobro: number | null, currency: string): string`, con `export type FacturaConLineas = { total: unknown; lines: unknown }`.
- La regla «sólo si cuadra» va DENTRO: devuelve `''` si no hay líneas, si base + IVA (con descuentos) no es el `total` de la factura, o si `importeDelCobro` es un número distinto del total. El único cambio de firma es que `importeDelCobro` admite `null`: quien no tiene cobro que comparar (el correo) pasa `null` y sólo se aplica la primera condición. La página de pago sigue pasando `Number(charge.amount)`.
- `payInvoice.routes.ts` la importa y la llama en la misma línea de antes.

## Cómo se comprobó

- **Caracterización antes de tocar:** el oro se capturó de la ruta real `GET /pay/invoice/:token` sin extraer, con tres facturas (3 líneas que cuadran; las mismas con total 250, que no cuadra → `''`; una con descuento de línea `dto` 10 %). Con ese oro, ① salió verde sobre la página SIN extraer (2/2).
- **Después:** el mismo test, 5/5: ① la página devuelve el oro; ② la función devuelve el oro con el importe del cobro, y con `null`; ③ la página pinta lo que devuelve la función (doble en `require.cache`, como 1787u).
- **Mutaciones**, pasadas por `aplicarUna` de `scripts/meta-guard-mutaciones.mjs` con su base limpia: 2 de 2 vivas. «La página vuelve a pintar en línea» tumba ③; «la función ignora que no cuadra» tumba ② (y, de rebote, ① y el otro ②).
- **Dirigida** (24 ficheros: este, 1787h, 1787q, 1787u, 1723, 1647, 1773, 836, 700, 710b, 719, 1157, 1215, 1415, 810, 1294, 267, 273, 525d, 854, 1387, 745, 237, 976): ver la entrega en Jira. `tsc -p .` con tipos: salida 0.
- **La suite entera NO se corrió en local** (orden del encargo): la corre el check obligatorio.

## Para S1 (el correo)

- El HTML lleva clases (`lines-table`, `totals-block`, `totals-row`) y ningún `style=`, por la CSP de la página de pago. En el correo hay que poner los estilos que use `renderEmailLayout`: eso es de S1.
- Medido, no cambiado: el importe de cada línea es cantidad × precio SIN el descuento de línea (la caldera con `dto` 10 % sale «200,00 €» en su fila y el descuento va en el desglose). Es lo que ya pintaba la página; el oro lo fija.

## Relevo (jv-j2ei): el obligatorio cayó con scrum553

El obligatorio de #3343 cayó con 1 caso: `tests/scrum553-etiquetas-pegadas.test.mjs`, «22 (el tope es 20)». Los dos nuevos eran los extractores de `trozoDeLaPagina` en el test de esta rama, con el `>` pegado (`<div class="amount-wrap">` y `<div class="methods-label">`): una clase o un `id` añadidos a esas etiquetas los habrían dejado ciegos. Reproducido en local (22) → quitado el `>` de los dos, mismo índice de corte → scrum553 16/16 y este test 5/5. El tope no se tocó (regla 41). Es la misma causa que la línea de J2 del 2026-11-12: scrum553 no estaba en la dirigida de 24 ficheros.

A9: comprobación → `tests/scrum553-etiquetas-pegadas.test.mjs`

## Lo que me salió mal (A9)

Copié el oro a mano desde la salida JSON y perdí el U+00A0 que `formatMoneyEs` pone antes de «€»; luego, al escaparlo con `sed`, GNU sed leyó `\u` como «mayúscula siguiente» y escribió `00a0`. Los dos los cazó la propia comparación con la página en ①, antes de extraer nada. Lo corregí con node contando sustituciones (11 = 3 + 2 celdas y 2 + 4 filas del desglose) y el oro quedó escrito con ` ` visible.
