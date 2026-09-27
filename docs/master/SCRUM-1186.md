# SCRUM-1186 · Regresión de SCRUM-1174: los textos del documento se perdían al «Duplicar» y con el borrador

**Medido contra:** `origin/main` = `0a10475c144763982b7b9d535bbaa14718843ee8` · 2026-09-27T17:35:57Z

## Qué pasaba

Desde SCRUM-1174 el editor del presupuesto tiene dónde escribir la cabecera (`docHeaderText`) y las
Observaciones (`docFooterText`). Dos caminos los perdían en silencio:

1. **Duplicar.** `duplicateQuote` (`quotesDetailView.js`) armaba la plantilla con líneas, tramos,
   condiciones y descuento global (SCRUM-926), y no con los dos textos; y el editor tampoco los
   precargaba de la plantilla.
2. **Borrador.** `saveDraft` no los guardaba y `loadDraft` no los restauraba: un F5 con el editor a
   medias los borraba. Además, teclear en ellos no programaba el guardado.

## Qué cambia (solo front)

- `quotesDetailView.js`: la copia lleva `docHeaderText`/`docFooterText` (`?? null`).
- `quotesView.js`: `ponerTextosDelDocumento` pone en los campos ya montados sólo lo que viene (clave
  ausente o `null` = el campo se queda como está); se usa al cargar la plantilla (junto a SCRUM-926) y al
  restaurar el borrador. `saveDraft` guarda `textosDelDocumento` con el lector del componente (si los
  campos no están montados no guarda nada, en vez de guardar vacío). Cada `<textarea>` programa el
  borrador al teclear. Sin nodos nuevos: los trinquetes 697/698 siguen en 255.

## Lo que NO cierra este ticket

`GET /admin/quotes/:id` es una proyección explícita (`src/modules/system/quoteAdmin.ts` ~:229) que
**no devuelve** los dos textos. Hasta que entre **SCRUM-1187** (servidor, carril S1), «Duplicar» seguirá
copiando `null`. El borrador sí queda arreglado entero con esto.

## Tests

- `scrum1186-textos-al-duplicar-y-borrador` (7): montado en el banco, no leyendo el fuente. Contra la rama
  sin el arreglo **5 fallan** (plantilla, teclear→borrador, borrador→campos, y los dos de «Duplicar»); con
  él, 7/7. Controles: una plantilla de catálogo y un borrador viejo no inventan texto.
- Vecinos (todo lo que monta o lee `quotesView.js`/`quotesDetailView.js`/`saveDraft`/la asignación
  de bloques, más 237 y 553): **82 ficheros · 840 · 840 pass · 0 fail**.