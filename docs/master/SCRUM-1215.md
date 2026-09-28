# SCRUM-1215 — 77 textos del panel sin revisar (censo 1157), en 5 lotes

## Lote 4 · revisiones del presupuesto (`quoteRevisiones.js`) — S2 (`s2-28c`)

**Medido contra:** `origin/main` = `4583f537880241f948a78c9ee274d1b1a59c59a0` · 2026-09-28T15:28:46Z

Revisión hoja a hoja en Jira, SCRUM-1215 c.17371; GO del orquestador a las dos cosas, en un PR.

- **Las 6 hojas ya estaban firmadas** (4 el 3-sep-2026, addendum «Revisiones del presupuesto» de
  `docs/MICROCOPY_APROBADA_SIN_APLICAR.md`; `crearRevision` y `errorCrear` el 16-sep-2026 en
  SCRUM-688). El censo 1157 las daba `SIN_COMENTARIO` porque toma como cuenta de lo aprobado el
  número más pequeño delante de «textos/rótulos» en la cabecera, y la nota de `ciego` decía
  «dos textos y no uno» → solo aprobaba `titulo` y `vigente`. Se reescribe la nota sin cifra, **no se
  refirma**. Medido con `censarFuente`: 2 → 8 `APROBADO`. Las 6 pasan de `acusadas` a `retiradas` en
  `scripts/_censo-convenio-microcopy-declarados.json`, con su firma citada.
- **`errorCrear` no se pintaba nunca.** `cablearCrearRevision` solo lo usaba con `e.message` vacío, y
  `apiRequest` siempre lanza con mensaje: el profesional leía «API 500: internal_error» o «Failed to
  fetch». Ahora se enseña el mensaje del servidor **solo** si viene en `data.message` (el que escribe
  `RevisionNoCreable` para una persona); todo lo demás cae en `errorCrear`. Sin texto nuevo.
- Test del viaje `tests/scrum1215-revisiones-error-crear.test.mjs`: ficha montada en el banco, clic en
  «Crear revisión», la respuesta pasa por el `apiRequest` REAL (el banco solo pone el `fetch`).
  **Rojo antes** (medido): 500 → `API 500: internal_error`; sin red → `Failed to fetch`. Verde después;
  el 409 con `message` sigue enseñando el del servidor.
- Vecinos en verde: 655c, 688, 988, 1157, 1185 (50/50).
- **NO VERIFICADO en yaqu.app**: la lectura de producción está denegada para S2.
- Pendiente de decidir (orquestador): el botón «Crear revisión» sale también en un presupuesto sin
  `quoteNumber`, que el servidor rechaza con su motivo.
