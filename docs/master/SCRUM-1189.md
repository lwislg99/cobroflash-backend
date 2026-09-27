# SCRUM-1189 · El «Tipo de intervención» del parte no se guardaba

**Medido contra:** `origin/main` = `494c0a7165d4b3e39e9b4b39d50616e32616a710` · 2026-09-27T17:50:58Z

Se arregla dentro del PR-C de SCRUM-1175 (rama `scrum-1175-parte-datos-plegados`), por decisión del orquestador:
mismo fichero y mismo control. Detalle, arreglo y test en `docs/master/SCRUM-1175.md`, apartado
«PR-C · Los datos del parte, plegados al final (+ SCRUM-1189…)».

- Defecto: `parteDetailView.js` `pintarTipo` pintaba los radios `name="parte-tipo"` editables y ningún oyente los escuchaba.
- Arreglo (solo front): `change` → `PATCH /admin/partes/:id { tipo }` por `guardarCampo`.
- Test: `tests/scrum1175c-datos-del-parte-plegados.test.mjs`: marcar → guardar → recargar → sale marcado.
- Fuera: que el alta mande `tipo` (no tiene selector); `cuerpo · POST /admin/partes::tipo` sigue declarada en el trinquete de 1185.
