# SCRUM-1047 · El beneficio y los gastos del panel separan «con IVA» y «sin IVA» (servidor)

**Medido contra:** `origin/main` = `171be5dc33df669bd52ad3ae8bd65cc0c95de9e9` · 2026-09-22T08:33:09Z (hora de GitHub, cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1047-beneficio-sobre-la-base`

## Depende de SCRUM-1037 (letra d) — YA MEDIDO, no bloquea

El ticket dice «el caso de gastos sin base (letra d de SCRUM-1037) lo decide ese ticket; aquí solo
se aplica su resultado». S0 lo midió en staging hoy (comentario de SCRUM-1037, 22-sep 10:00):
**un gasto sin `baseAmount` YA está tratado** en `libroRecibidas.ts` — se EXCLUYE del libro y se
cuenta aparte en `sinClasificar`/`sinClasificarImporte`. Ese es el resultado que se aplica aquí,
tal cual, sin inventar una segunda decisión: un gasto sin `baseAmount` se excluye de la base y se
declara en `expensesSinClasificar`.

## Lo que hace

- `src/modules/reports/domain/beneficioBaseImponible.ts` (nuevo, PURO): `calcularBeneficioSobreLaBase`
  recibe las MISMAS listas de facturas pagadas y gastos que ya arma `/pl`, y calcula:
  - `revenueBase`/`expensesBase` — sin IVA. La base de cada factura sale de `calcVatBreakdown`
    (`vat.service.ts`), la MISMA primitiva que usan el 303, el XML RRSIF y la huella VeriFactu —
    no una segunda lectura del IVA. La de cada gasto es `baseAmount`, tal cual.
  - `revenueWithVat`/`expensesWithVat` — con IVA. Son las cifras que YA se enseñaban
    (`invoice.total` y `expense.amount`, éste el TOTAL con IVA desde SCRUM-324): no cambian.
  - `profitBase` = `revenueBase - expensesBase`. El beneficio se calcula sobre la base, como pide
    la aceptación 1; el rótulo que lo diga en pantalla lo pone S2 (sin claims fiscales, regla 7).
  - `revenueSinDesglose`/`expensesSinClasificar` — lo que NO se pudo llevar a la base, con su
    recuento y su dinero. Nunca se sustituye por el total ni por cero (misma familia de decisión
    que `sinNumero`/`excluded` en `/vat` y `sinClasificar` en `libroRecibidas.ts`).
- `reports.routes.ts` (`GET /admin/reports/pl`): añade `lines` al `select` de facturas y
  `baseAmount` al de gastos (los dos ya existían en el schema; nada de ALTER), y siete campos
  NUEVOS a `totals`. **Los campos de siempre —`revenue`, `expenses`, `profit`, `maintenance`— NO
  cambian**: la pantalla actual sigue leyendo lo mismo; la nueva (S2) lee los campos nuevos.
- **Solo cálculo**: no se toca ninguna factura, ningún libro, ningún XML — se leen datos que ya
  existían con las mismas primitivas que ya los leían en otro sitio.

## El juez: `tests/scrum1047-beneficio-sobre-la-base.test.mjs`

9 tests, SIN base (función pura), corren en cada `npm test`:

1. **El caso del ticket, a mano**: factura base 1.000/IVA 210 (total 1.210) + gasto base 300/IVA
   63 (amount 363) → `profitBase = 700`, `revenueWithVat = 1210`, `expensesWithVat = 363`.
2. El «con IVA» sigue sumando TODO (una factura sin desglose no se cae de esa cifra).
3. Factura sin líneas → excluida de la base, declarada, NUNCA sustituida por el total.
4. Líneas vacías cuentan igual que ninguna línea.
5. Gasto sin `baseAmount` → excluido, declarado, nunca sustituido por `amount` ni por 0.
6. Gasto con `baseAmount: 0` declarado expresamente SÍ entra (0 ≠ null).
7. Vacío → todo a cero, sin lanzar.
8. Varios tipos de IVA en la misma factura: la base suma todos.
9. Céntimos enteros: `0.10 + 0.20` no se rompe por coma flotante.

`npm run build` limpio. `guards:entrada` 95/95. `scrum348` (tenencia) en verde. `scrum389`
(gateado) sigue saltando igual que antes (sin `LIBRO_PG_URL`) — no se tocó ese camino.

## Declarado, sin arreglar aquí

- La pantalla que enseñe estos campos (S2) y su microcopy firmado.
- SCRUM-1037 letra a (retención que no se guarda) y letra b (JUST en el libro): fuera de alcance
  de este ticket, con su propio destino (BUGS.md / J1) según el comentario de S0.
- Ningún cambio a `libroRecibidas.ts` ni a `/vat`: se REUTILIZAN, no se tocan.

## Errores propios

Ninguno de construcción. Al diseñar el módulo se comprobó primero si `Invoice` guarda IVA
desglosado en columnas propias (no lo hace: solo `lines` JSON) y si `Expense.amount` es
ambiguo con/sin IVA (lo era hasta SCRUM-324, que lo fijó como «con IVA» — leído en
`expenses.service.ts` antes de asumir nada), para no inventar una tercera convención donde ya
había dos decisiones tomadas.
