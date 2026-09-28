# SCRUM-1168 · Las puertas de la serie de facturas miran el año del PROCESO; el emisor, el del merchant

**Medido contra:** `origin/main` = `7ba1ad5f2a87e7752894f790a5256b20a65f9ed5` · 2026-09-28T13:48Z (J1, árbol `cobroflash-jv1`)

Reportado por S1 del equipo de Luis (`s1-27a`, censo AST de SCRUM-1093h). Carril J1.

## ① PASO 0 — el defecto existe hoy (corrido, no leído)

`allocateInvoiceNumber` numera con `diaNaturalEn(now, zonaDelMerchant(m))` desde SCRUM-735. Las
cuatro puertas que deciden SOBRE esa serie leían `new Date().getFullYear()` (Railway va en UTC):

| puerta | qué decide |
|---|---|
| `app.ts` · `GET /admin/me` | si se le ofrece al pro el arranque de serie, y si su prefijo sale bloqueado |
| `app.ts` · `POST /admin/onboarding/serie/previa` | la vista previa del próximo número |
| `app.ts` · `POST /admin/onboarding/serie` | declara `invoiceSeriesYear` + `nextInvoiceNumber` (continuidad) |
| `merchantAdmin.ts` · `updateMerchantProfile` | bloquea el cambio de prefijo si la serie del año ya tiene emitidas |

Sonda contra el `allocateInvoiceNumber` REAL con un `tx` falso (regla 38: se observa, no se toca),
proceso en UTC, emitidas `2026-CF-001` y `2026-CF-040`, `invoiceSeriesYear = 2026`:

| zona | instante (UTC) | año puerta | año emisor | ¿ofrece arranque? puerta / emisor | ¿bloquea prefijo? puerta / emisor |
|---|---|---|---|---|---|
| Europe/Madrid | 2026-12-31T23:30Z | 2026 | 2027 (`F270001`) | false / **true** | true / **false** |
| America/Mexico_City | 2027-01-01T02:00Z | 2027 | 2026 (`F260001`) | true / **false** | false / **true** |
| America/Bogota | 2027-01-01T03:00Z | 2027 | 2026 (`F260001`) | true / **false** | false / **true** |
| UTC (control) | 2026-12-31T23:30Z | 2026 | 2026 | false / false | true / true |

En México, a las 20:00 del 31-dic, el alta escribía `invoiceSeriesYear = 2027` con la continuidad
declarada, y el emisor numeraba en 2026: la declaración se perdía en silencio.

## ② Qué se tocó, y qué NO

- `src/core/validation/fiscalInput.ts`: `anioDeLaSerie(merchant, ahora)`, la MISMA expresión que el
  emisor. Vive con las demás puertas de la serie (SCRUM-291/313), que ya declaran no ser camino de
  emisión.
- Las cuatro puertas la usan; sus `select` leen además `timezone`.
- `scripts/_censo-fecha-sin-zona.mjs`: las cuatro identidades pasan de `USO` (NUMERA) a `RETIRADAS`,
  con su motivo (regla 41: mejorar se declara). El censo sigue teniendo acusadas vivas (el SUELO de
  1093h lo exige y pasa).
- **NO se tocó `allocateInvoiceNumber`** ni nada de `invoiceNumber.service.ts` (regla 40). Por eso
  la expresión se escribe dos veces, y un test las compara sobre el emisor real.

## ③ Red — `tests/scrum1168-anio-serie-zona-merchant.test.mjs`

- ① `anioDeLaSerie` = año que escribe el `allocateInvoiceNumber` real, en los tres casos de frontera,
  el control UTC y las zonas nula/vacía/corrupta; más un control de que los casos SÍ cruzan el año.
- ② con el año del proceso las puertas deciden distinto que con el del emisor; con `anioDeLaSerie`,
  igual.
- ③ AST sobre los fuentes reales: las cuatro puertas llaman a `anioDeLaSerie` y no a
  `get(UTC)FullYear()`; con control de que el censo caza la forma del defecto y absuelve la del arreglo.

**En rojo primero:** con `src/app.ts` y `merchantAdmin.ts` de `origin/main` (hash de blob de git igual al
de main, comprobado) caen 6 de 30: los cuatro ③ y los dos trinquetes de 1093h (fila sin clasificar y
RETIRADA resucitada). Con el arreglo, 30/30.

## ④ Hallazgo aparte, NO tocado — las puertas no ven la serie `F`

`numerosDeLaSerie` filtra por `${año}-`, el formato viejo. Desde el corte de SCRUM-780 (7-sep-2026)
las facturas salen `F26NNNN`, y las puertas no las cuentan:

    numerosDeLaSerie(['F260001','F260002','2026-CF-003'], 2026)  →  ["2026-CF-003"]
    debeOfrecerArranqueDeSerie({ invoiceSeriesYear: null, año: 2026, numerosDeLaSerie: numerosDeLaSerie(['F260001'], 2026) })  →  true

Un merchant que ya emitió en formato F sigue viendo la pregunta «¿por qué número vas?», que según
SCRUM-313 no debe ver quien ya emitió. Queda para el orquestador: es otro defecto, y decidir qué hace
la continuidad declarada en la serie F (que hoy se deriva de lo emitido, no de `nextInvoiceNumber`)
es de la serie fiscal.
