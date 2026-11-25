# SCRUM-1849

**Medido contra:** `origin/main` = `9c4ea478777694eb68b731d02773311343b3e01f` · 2026-11-25T03:17:44Z

**Skill UI:** cargada

A9: aviso → cicatriz J1 «Crucé los 200k (202.793) sin medirme entre Jira (132.763) y el primer rojo; avisó el hook del orquestador, y cargué la skill `yaqu-premium-ui` después del Edit del CSS, no antes (SCRUM-1849, jv-j1ku)» — no se pudo comprobar: medirse tras cada tanda no lo ve ningún guard

**Qué (J1, AB6):** la lista de Facturas (`public/dashboard/js/invoicesView.js`) a 44 px de toque, por contenedor, en un bloque J1 NUEVO de `styles.css` (`/* J1: SCRUM-1849 … */`, tras el de 1756j; lejos del de 1843, PR #3426). Sólo tamaño: sin JS, sin texto, sin tocar `.input`, `.btn-primary` ni `.btn-sm` globales. Ancla: la tarjeta que contiene `.j1-fac-lista` (`:has`), clase que sólo escribe esta lista. Especificidad (0,4,0) o más: gana a `.btn.btn-sm` (0,2,0).

**Regla:** SCRUM-1845 c.22728 (fundador, «2-Ok si es lo que ha dicho Luis sí», sobre `DESIGN.md:171`): un `.btn-sm` que no es la primaria se queda; una primaria pequeña y lo demás bajo 44, se cura.

## Antes → después (toque en px, árbitro `__areaDeToque`, 390 · 929 · 1280)

| elemento | clase | ¿primaria? | antes | después |
|---|---|---|---|---|
| «Nueva factura» | `BUTTON.btn-primary` | sí | 45 · 37 · 37 | 45 · 45 · 45 |
| buscador | `INPUT.input` | — | 35 · 35 · 35 | 45 · 45 · 45 |
| estado | `SELECT.input` | — | 37 · 37 · 37 | 45 · 45 · 45 |
| desde / hasta | `INPUT.input` ×2 | — | 37 · 37 · 37 | 45 · 45 · 45 |
| casilla de cabecera | `INPUT#inv-check-all` | — | oculta · 14 · 14 | oculta · 46 · 46 (caja 13, no crece) |
| casilla de fila | `INPUT.inv-row-check` | — | oculta · 14 · 14 | oculta · 46 · 46 (caja 13, no crece) |
| «✓ Marcar como pagadas» (lote) | `BUTTON.btn-primary.btn-sm` | sí, del lote | 30,6 · 30,8 · 30,8 | 44,6 · 44,8 · 44,8 |
| fecha de cobro (lote) | `INPUT.input` | — | 36 · 36,6 · 36,6 | 44 · 44,6 · 44,6 |
| «Crear un presupuesto» (vacío) | `BUTTON.btn-primary.btn-sm` | sí, del estado vacío | 30,6 · 30,9 · 30,9 | 44,6 · 44,9 · 44,9 |
| «⬇ CSV» | `A.btn-secondary.btn-sm` | no → EXENTO | 31 · 31 · 31 | 31 · 31 · 31 |
| «Ver detalle» ×2 | `BUTTON.btn-ghost.btn-sm` | no → EXENTO | 44,6 · 30,8 · 30,8 | igual |
| «Cancelar» (lote) | `BUTTON.btn-ghost.btn-sm` | no → EXENTO | 30,6 · 30,8 · 30,8 | igual |

El censo de 1845 cuenta 10; la descripción del ticket enumera 9: el 10.º es la casilla de cabecera. Las dos primarias pequeñas del lote y del vacío nacen ocultas y el censo no las vio: van por la misma regla (A13), y se dice. La casilla de cabecera medía 40 con `inset:-16px` porque `.table-scroll` recorta su `::before` por arriba: lleva 10 arriba y 22 abajo (mismos 45).

**Exentos (c.22728):** «⬇ CSV», «Ver detalle» y «Cancelar» no son la primaria de su pantalla (lo son «Nueva factura», «Marcar como pagadas» en el lote y «Crear un presupuesto» en el vacío). El test comprueba que siguen por debajo de 36 en escritorio.

**Prueba:** `tests/scrum1849-lista-facturas-44.test.mjs` — ① navegador, la vista real en tres estados (lista, fila marcada, vacía) a 390/929/1280, con botón sembrado de 30 px como control; ② el bloque cuelga del ancla, sólo tamaño, ningún selector a un `.btn-sm` exento. Visto en ROJO antes de la cura (campo a 35 px; bloque inexistente) y en VERDE después (2/2). Capturas: `docs/master/evidencias/SCRUM-1849/` (antes-/despues- · lista 390 y 1280, lote 1280).

**Guard táctil:** `scripts/guard-objetivo-tactil.mjs` NO cubre `renderInvoicesView`: no hay sobrante que endurecer y no se añade cobertura (fuera de alcance). Salida 2 en local: 0 hallazgos y 4 ciegos, los cuatro «FUENTE ROTA en /» (la landing, que no enlaza `dashboard/css/styles.css`); no re-medido sin mi cambio.

**Visto de paso, no tocado (no es tamaño):** el texto de «Cancelar» en la barra oscura del lote sale blanco sobre fondo claro (captura `antes-lote-1280.png`): contraste a revisar.
