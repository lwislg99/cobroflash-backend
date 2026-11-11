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
