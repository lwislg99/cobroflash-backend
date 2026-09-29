# SCRUM-1271 · «X entregados sin facturar» contaba el albarán entero tras una parcial

**Medido contra:** `origin/main` = `223498dc3e1bfb71ac406d245684d6549ba2c19b` · 2026-09-29T10:06:16Z

Una ola, un solo push: S1 (servidor, s1-29a) + S2 (pantalla, s2-29a). Hallazgo de S2 (SCRUM-1215 c.17505).

## El defecto

`huecosDeCobro` (`jobCobroHuecos.js`) sumaba `totales.total` de todo albarán firmado con
`facturado === false`, y `facturado` es `invoiceId != null`. `POST /admin/albaranes/:id/facturar-parcial`
escribe el libro `AlbaranLineaFacturada` y **no** pone `invoiceId`, así que tras facturar una parte
—o todo, en parciales— la ficha seguía pidiendo facturar el albarán entero.

## Servidor (S1)

- `src/modules/jobs/domain/importePendienteAlbaran.ts` (nuevo): `importePendienteDeFacturar` — `null`
  sin valorar, `0` facturado entero (`invoiceId`), y si no `calcAlbaranTotales` sobre las líneas
  ORIGINALES con la cantidad pendiente: la misma aritmética que `totales.total` (sin parciales da
  exactamente el total).
- `jobs.routes.ts` (`serializeJobDetail`): el campo por albarán, del MISMO libro ya leído. Sin
  consultas nuevas.
- **No se toca** `facturar-parcial` ni `albaranFacturacion.ts` (valida la emisión, regla 40): el
  cálculo vive en un módulo aparte, solo de lectura.

## Pantalla (S2)

`jobCobroHuecos.js`: suma `importePendienteDeFacturar` cuando es número, salta los `facturado`; si el
campo no llega, cae a `totales.total` (el comportamiento de antes).

## Prueba

- `tests/scrum1271-importe-pendiente-de-facturar.test.mjs` (S1): por la RUTA de verdad
  (`GET /admin/jobs/:id`, base doblada), con el libro en la forma que escribe `facturar-parcial`.
  Sin parciales = `totales.total` (1.000 €); parcial de 637 € → 363 €; todo en parciales → 0;
  `invoiceId` → 0; SIN_VALORAR → `null`. Rojo antes: el campo no existía.
- `tests/scrum1271-pendiente-tras-parcial.test.mjs` (S2): el viaje de la ficha.
- Vecinos del servidor: 64 ficheros, 557 tests: 552 ✔, 5 saltados por base (`QA_DB_TEST`,
  `SERIE_PG_URL`, `TRAMOS_PG_URL`).

**No verificado en yaqu.app:** la cuenta QA no tiene albaranes (SCRUM-1215 c.17493).

## Apéndice S2 (s2-29a) — la ola, junta

**Medido contra:** `origin/main` = `223498dc3e1bfb71ac406d245684d6549ba2c19b` · 2026-09-29T10:08:39Z

- Merge de `ec69801d` (S1) + `8ec845b6` (S2): limpio. `origin/main` ya estaba dentro.
- Rojo de la mitad de S2 probado por mutación: con el `jobCobroHuecos.js` de `main`, caen los dos casos de la parcial (400,00 € y el hueco que debe desaparecer).
- Juntas y con el dist recompilado: vecinos (`jobCobroHuecos`, `jobDetailView`, `importePendienteAlbaran`, `jobs.routes`, 1185, 1271 y 1272), 1017/1021 y 0 fallos. Los 4 saltados son de staging o de Postgres desechable (QA_DB_TEST, SERIE_PG_URL, TRAMOS_PG_URL).
- **NO VERIFICADO en yaqu.app:** la cuenta QA no tiene albaranes. Va a la lista de verificación en pantalla cuando exista `sembrar-qa.mjs`.
