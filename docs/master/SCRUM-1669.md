# SCRUM-1669 — PILOTO-1 · el total por fila en GET /admin/albaranes

**Medido contra:** `origin/main` = `358e2a1bbd5a5d8c0868ae6db01a11fe44615604` · 2026-11-11T11:30:17Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1669-total-por-fila-de-albaran` · **Carril:** S1 · albaranes.

A9: comprobación → `tests/scrum1669-total-por-fila-de-albaran.test.mjs`

> Puesto S1 (servidor). Corte exacto en SCRUM-1669 c.21433: `albaranesListado.ts` (interfaz de la fila y mapeo
> de `listarAlbaranesDelMerchant`).

## El arreglo (sin texto nuevo)

- `FilaAlbaranListado.total: number | null`. Lleva la regla del detalle (`albaran.service.ts`:
  `totales: modoValoracion === 'VALORADO' ? calcAlbaranTotales(lineas) : null`): **número** (IVA incluido)
  para VALORADO y **`null`** para SIN_VALORAR. Un 0 diría «vale cero» de algo que solo no tiene precios.
- Cero consultas nuevas: las líneas ya venían en la fila del albarán.

## Rojo primero

`tests/scrum1669-total-por-fila-de-albaran.test.mjs`, sobre `listarAlbaranesDelMerchant` de verdad y con un
lector falso. **Sin** el arreglo: **2 ✖ / 1 ✔** (VALORADO → 86,30, el número del detalle con
`calcAlbaranTotales`; SIN_VALORAR → `null`, con la clave presente; el SUELO en verde). Con el arreglo: 3/3.
Junto a los otros bancos del listado (`scrum301`, `scrum831*`, `scrum304`): 44 ✔ / 0 ✖.

## Pendiente

- La columna en pantalla es de S2 (front). El servidor ya manda el dato.
- Verlo en yaqu.app después del merge: `GET /admin/albaranes` con un albarán VALORADO y uno SIN_VALORAR.

## Mitad S2 · la columna en pantalla (11-nov-2026 ~14:55Z, GitHub · base `origin/main` 412ddc20d)

Rama `scrum-1669b-importe-en-la-lista`. Carril S2 (`albaranesView.js`, `styles.css`).

| aceptación | qué se hace |
|---|---|
| la lista pinta el total de cada albarán valorado, Tinta ≥700 tabular | columna **«Importe»** detrás de «Trabajo»; celda `cell-amount` + `.amount` (Tinta 700, `tabular-nums`); `fmtMoneyEs(f.total, 'EUR')`. `total: null` (SIN_VALORAR) pinta «—», nunca «0,00 €» |
| «Emisión» de un borrador | **«—»** (decisión del orquestador en el encargo de S2 de hoy). Se compara con el PRIMER estado del eje que manda el servidor (`ALBARAN_ESTADOS[0]`), sin literal, como las pestañas; un test ata ese orden |
| tarjeta de móvil | área `amount` en la línea de la fecha (`"date amount"`), sólo en `.table--albaranes`; la rejilla compartida no se toca |

**Texto:** «Importe» = texto firmado **n.º 17** de SCRUM-1656 c.21405 («Rótulo de la columna del importe · «Importe»»),
firma c.21408 ① «Entradas 1-23: aprobadas TAL CUAL están escritas en c.21405.» (alcance c.21411). Ningún otro texto nuevo.

**Tests:** nuevo `tests/scrum1669b-importe-en-la-lista-de-albaranes.test.mjs` (banco de vistas): sobre los ficheros
de `origin/main` da **3 ✖ / 1 ✔** (el ✔ es el ancla del orden de `ALBARAN_ESTADOS`), con el arreglo 4/4. Las dos
fijaciones de cabecera (`scrum301` COPY_APROBADA y `scrum831`) pasan de 7 a 8 columnas citando la firma: más
estrictas, no más flojas. Con los bancos de la lista (301, 304, 831, 1450, 1559g/i/k, 1659, 713c): 73 ✔ / 0 ✖.

**Medido en yaqu.app** (cuenta QA, sólo GET, `sondas-s2/lista-1669.mjs`, JS y CSS de la rama servidos sobre prod,
testigo `SCRUM-1669` en el JS servido): AB260006 = **242,36 €**; las 6 SIN_VALORAR «—»; AB260003 (borrador) Emisión
«—»; peso 700, `tabular-nums`. Página sin desborde horizontal en 320 · 390 · 641 · 769 · 800 · 929 · 1024 · 1280.

⚠️ **Lo que empeora, declarado:** la tabla pide ~77 px más. Scroll DENTRO de su `.table-scroll` (la página, 0):

| ancho | prod hoy | con «Importe» |
|---|---|---|
| 769 | 61 | 138 |
| 800 | 30 | 107 |
| 929 | 0 | **70** («Enviar para firmar» queda medio fuera hasta desplazar) |
| ≥1024, ≤641 | 0 | 0 |

769-899 ya scrolleaba (forma aceptada en SCRUM-1559k). Lo nuevo es 900-1023. Lo probé ocultando «Entrega» también
en 900-1023 y daba 0 a 929, pero el guard de SCRUM-1559k fija que «Entrega» SÓLO se oculta en 769-899 (regla 41: no
se toca el guard), así que **se queda fuera** y va como decisión para el orquestador.
