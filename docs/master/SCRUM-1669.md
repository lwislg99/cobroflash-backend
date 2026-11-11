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

---

## Tramo b — «Emisión» de un borrador (S1, 11-nov-2026)

**Medido contra:** `origin/main` = `412ddc20d0233162159567d4e7705bf845f71404` · 2026-11-11T14:47:25Z (cabecera `Date:` de `gh api -i zen`) · **Rama:** `scrum-1669b-emision-vacia-en-borrador` · **Carril:** S1 · albaranes.

A9: comprobación → `tests/scrum1669b-emision-vacia-en-borrador.test.mjs`

### ① La decisión

Aceptación 2 del ticket: «decidido y escrito qué enseña "Emisión" para un borrador». S1 lo propuso en
SCRUM-1669 c.21486 (`emisionAt: null` + la raya que ya existe) y el orquestador respondió que sí, el
11-nov por la tarde, en un mensaje a S1: «`emisionAt: null` en el borrador y el «—» que ya existe
(coincide con lo que decidí ayer para esa columna: raya, sin palabra)».

### ② El arreglo (sin texto nuevo)

- `albaranesListado.ts`: `emisionAt: a.estado === 'borrador' ? null : a.createdAt`, y el tipo de la fila
  pasa a `Date | string | null`. Emitido y firmado siguen con `createdAt` (SCRUM-67).
- Pantalla: nada que tocar. `fechaCorta` de `albaranesView.js` ya devuelve `—` para un valor vacío, y
  `emisionAt` no tiene otro consumidor en `public/` ni en `src/`, que lo he buscado con grep.
- La fecha del PDF (`albaran.service.ts:834`) no cambia: un borrador no tiene PDF emitido.

### ③ Medido

- **Rojo primero:** sin el arreglo, 1 ✖ (el borrador salía con `emisionAt: "2026-10-16T12:41:22.412Z"`)
  y 2 ✔ (el suelo, y el control de que emitido y firmado conservan su fecha).
- **Verde:** los 19 ficheros de `tests/` que leen `emisionAt` o el listado (`albaranesListado` /
  `listarAlbaranes`) dan **158 ✔ / 0 ✖ / 0 saltados**.
- En prod, antes del arreglo: AB260003 (borrador, cuenta QA) traía `emisionAt` = su `createdAt`.

### ④ Pendiente

- La columna del importe (aceptación 3) es de S2: el campo es `total`.
- Verlo en yaqu.app después del merge: en `GET /admin/albaranes`, AB260003 con `emisionAt: null`, y la
  lista enseñando «—» en «Emisión» para esa fila, a 390 y a 1280 px.
