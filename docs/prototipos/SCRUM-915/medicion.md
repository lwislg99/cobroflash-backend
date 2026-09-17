# SCRUM-915 · Medición del prototipo v2

Chromium 148 local (puppeteer-core), `file://`, 17-sep-2026, rama `scrum-915b-prototipo-v2`. Recorrido en cada
anchura: elegir «Comunidad Los Olivos» → foco en la línea vacía (desplegable de conceptos) → escribir «grifo» y
elegir del catálogo → cantidad 2 → «✨ Sugerir con IA» (modal) → «Añadir líneas seleccionadas» → Continuar →
Condiciones → «Cambiar» en cobro → «50% al aceptar, 50% al finalizar» → Continuar → (390: «Ver documento») →
«Generar presupuesto» → cerrar → «Justificante» → «Inventario».

| Anchura | Errores | Scroll horizontal | Controles < 44 px | Total con 1 línea | Total final | Filas en el documento | Pasos del justificante | Filas del inventario |
|---|---|---|---|---|---|---|---|---|
| 1280 × 860 | 0 | no (12 estados) | 0 | 157,06 € | 460,65 € | 5 | 3 | 45 |
| 390 × 844 táctil | 0 | no (13 estados) | 0 | 157,06 € | 460,65 € | 5 | 3 | 45 |

- A mano: 2 × 64,90 = 129,80 € + 21 % = 157,06 €. Con las 4 de la IA: base 380,70 € + IVA 79,95 € = 460,65 €.
- La vista previa se construye: 0 → 1 → 5 filas y el total cambia en cada paso del recorrido.
- ⚠️ Pasadas anteriores: «⋯» a 40 px y «Listo»/«Abrir PDF» bajo 44 en móvil (corregidos); el concepto se cortaba a
  390 (la línea pasa a dos filas con rótulos «Cantidad»/«Precio»); y dos fallos del propio script (el triple clic no
  selecciona en un `input number`; un clic caía bajo la barra fija) que se corrigieron en el script, no en el prototipo.
- La cuenta es ILUSTRATIVA: al construir manda la de hoy (887/888).
