# SCRUM-1189 · El «Tipo de intervención» del parte no se guardaba

**Medido contra:** `origin/main` = `494c0a7165d4b3e39e9b4b39d50616e32616a710` · 2026-09-27T17:50:58Z

Se arregla dentro del PR-C de SCRUM-1175 (rama `scrum-1175-parte-datos-plegados`), por decisión del orquestador:
mismo fichero y mismo control. Detalle, arreglo y test en `docs/master/SCRUM-1175.md`, apartado
«PR-C · Los datos del parte, plegados al final (+ SCRUM-1189…)».

- Defecto: `parteDetailView.js` `pintarTipo` pintaba los radios `name="parte-tipo"` editables y ningún oyente los escuchaba.
- Arreglo (solo front): `change` → `PATCH /admin/partes/:id { tipo }` por `guardarCampo`.
- Test: `tests/scrum1175c-datos-del-parte-plegados.test.mjs`: marcar → guardar → recargar → sale marcado.
- Fuera: que el alta mande `tipo` (no tiene selector); `cuerpo · POST /admin/partes::tipo` sigue declarada en el trinquete de 1185.

## Apéndice (S4) · el viaje contra la RUTA de verdad — `scrum1189b`

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:50:59Z

El arreglo de #1855 ya estaba en `main` y en yaqu.app (`<meta name="yaqu-build">` = 82cb31c8). Faltaba
medirlo por la puerta de verdad: `scrum1175c` contesta el PATCH con un servidor FALSO que acepta
cualquier `tipo`, así que un radio con el `value` mal escrito pasaría en verde y en producción sería
un 400 `tipo_invalido` (la vista repinta y el tipo se pierde otra vez).

- Test: `tests/scrum1189b-tipo-contra-la-ruta-real.test.mjs` — la vista real (`vm`) contra
  `dist/…/partes.routes.js` (base doblada por `_envio-doblado.mjs`). Por CADA radio pintado: el cuerpo
  que manda la vista es `{ tipo }`, la ruta contesta 200, la fila lo guarda y al reabrir sale marcado.
- Controles: parte sin tipo → guardar la obra no manda `tipo` y la fila sigue en null · la vista SIN el
  oyente deja el tipo en null (el banco sabe fallar) · la ruta rechaza `reparacion` · firmado =
  radios deshabilitados.
- Medido contra la vista de ANTES del arreglo (0a10475c): 4 ✔ / 3 ✖ (los dos del viaje y el control
  del oyente, que no lo encuentra). Contra la de hoy: 7/7.
- Sin cambios de código: solo el test. No hay texto nuevo.
