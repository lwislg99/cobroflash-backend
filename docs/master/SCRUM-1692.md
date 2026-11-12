# SCRUM-1692 · PILOTO-1 · «Partes por valorar»: la fila abierta se marca

**Medido contra:** `origin/main` = `db202031a449ba21c3cccf32d74afc8ecbda4a33` · 2026-11-11T11:02Z (cabecera `Date:` de GitHub)

A9: comprobación → `tests/scrum1692-parte-abierta-se-marca.test.mjs`

Puesto: S2. Origen: SCRUM-1686 c.21459 (X3), anomalía a. Sin texto nuevo.

## Causa

`public/dashboard/js/parteOficinaView.js` pinta cada parte pendiente como un `<button class="customers-card">`
y, al pulsarlo, abre el detalle debajo. Ninguna fila cambiaba al abrirse: el detalle parecía un duplicado
de una fila cualquiera, y el lector de pantalla no tenía nada que anunciar.

## Arreglo

- **JS:** al pulsar una fila se quita `aria-current` de todas y se pone `aria-current="true"` en la pulsada.
  La clase NO cambia: el banco de SCRUM-1285 y el test de SCRUM-1562c exigen `className === 'customers-card'`.
- **CSS** (`styles.css`, junto a la regla de foco de SCRUM-1562c): `#po-lista > button.customers-card[aria-current="true"]`
  con el **mismo** marcado de selección que ya existe en `.quote-cliente-opcion[aria-pressed="true"]`: borde
  `--brand`, un píxel por dentro (`inset 0 0 0 1px var(--brand)`) y fondo `--brand-tint`. Cero tokens nuevos;
  la forma (el grosor) no depende sólo del color (WCAG 1.4.1). Con el foco encima conserva el anillo `--ring`.
- **Skill UI:** cargada (yaqu-premium-ui). DESIGN.md no define un «estado seleccionado» de card: se reutiliza el
  patrón de selección ya en uso en el panel, no se inventa.

## Rojo → verde

- Rojo (sin el arreglo): 2 de 3 — «la fila abierta no lleva `aria-current="true"`» y «no hay
  `#po-lista > button.customers-card[aria-current="true"]`». La mitad «nada marcado antes de abrir» ya se cumplía.
- Verde: 3/3, y los vecinos (`scrum1562c`, `tecnosel-precios-tras-firmar`, `scrum628`) 35/35.

## Medida en yaqu.app (JS y CSS del worktree servidos sobre prod `db202031a`, cuenta QA, sólo GET)

Sonda `sondas-s2/prod-1692.mjs <out> local <worktree>`; tras merge, `prod-1692.mjs <out> prod - testigo`.

| ancho | antes del clic | después del clic (PT-2026-004) |
|---|---|---|
| 390 | sin `aria-current`, borde `rgb(231,233,227)`, fondo blanco | `aria-current="true"`, borde `rgb(22,163,74)`, fondo `rgb(236,253,245)`, sombra inset 1px verde |
| 1280 | igual | igual |

0 peticiones no-GET, 0 errores de consola.
