# SCRUM-1147 · El resumen del trimestre toma sus cifras de IVA del servidor

**Medido contra:** `origin/main` = `9d66dd2585e25c307d3f4f1f469223b2e91c179b` · 2026-09-26T12:20:00Z
**Rama:** `scrum-1147-resumen-trimestre-del-servidor`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`).

## PASO 0

- `reports/resumen-trimestre` (SCRUM-1048): 0 llamadas en `public/`. Informes calculaba el resumen
  con `/vat` + `/libros/recibidas.json` + `/pl`, sumando la cuota soportada en el navegador.
- Home no pinta cifras fiscales: solo decide si enseñar el aviso (SCRUM-1075).

## Medición antes de cambiar nada

- **IVA soportado deducible — corrido:** 2000 lotes aleatorios de gastos (base/tipo/cuota nulos o
  no; deducible true/false/null) por los dos caminos: `construirLibroRecibidas` →
  `filasLibroRecibidas` → fórmula literal de la pantalla, contra `construirResumenTrimestre`.
  **0 diferencias.** Control: suma de cuotas del servidor 890.741 €, no vacía.
- **IVA repercutido — leído:** `/vat` y el endpoint leen el mismo libro (`leerLibroRegistro`) con
  el mismo rango, y las entradas por tipo ya vienen en céntimos (`calcVatBreakdown`).
- **NO cuadra — la nota firmada de SCRUM-1049** («N gastos… no los has marcado como IVA
  deducible»): el endpoint no trae ese N; `noDeducible + sinClasificar` es distinto en 1718 de
  2000 lotes. Por decisión del orquestador (opción A) la nota y los avisos siguen leyendo
  `recibidas.json`, SOLO para contar. El conteo exacto va a SCRUM-1151 (S1).

## Qué se construyó

- `reportsView.js` (`loadResumenTrimestre`): repercutido, soportado deducible, diferencia y
  facturas sin desglose salen de `/admin/reports/resumen-trimestre`. La pantalla ya no suma ni
  resta ninguna cifra de IVA. «Gastos del trimestre» sigue saliendo de `/pl` (no es IVA y el
  resumen no lo trae); el formato de moneda, de `pl.currency`.
- Bloque nuevo **«Diferencia (repercutido − soportado)»**, firmado por el orquestador por
  delegación del fundador (regla 39, 26-sep-2026): nombra la operación, no su significado fiscal.
  Sin «a pagar / a compensar / a devolver» (reglas 7/24); negativa, se pinta tal cual.
- `homeView.js`: el aviso pregunta al resumen (`invoiceCount`, `expenseCount`) + `/pl`; deja de
  pedir `/vat` y `recibidas.json`. Son los mismos conteos por construcción (`libro.miradas` y
  `gastos.length` sobre la misma consulta).

## Tests

- Nuevo `tests/scrum1147-resumen-del-servidor.test.mjs` (banco de vistas, servidor y
  `recibidas.json` DISCREPANDO a propósito): 4/4 verde; **4/4 rojo** con las pantallas de main.
- `scrum1049` y `scrum1075`: se actualiza SOLO el fixture (sirven la ruta nueva con los mismos
  valores); ninguna aserción cambia de valor. 1049 cayó 2/… con la pantalla nueva y el fixture
  viejo porque el banco no servía la ruta, no por una cifra distinta.
