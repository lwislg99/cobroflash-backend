# SCRUM-1169 · En modo justificante, la línea de tiempo del presupuesto no promete «Facturada · Cobrada»

**Medido contra:** `origin/main` = `81a5e95fd0ba47e2324583780541be98f15ef978` · 2026-09-27T16:18:24Z
**Rama:** `scrum-1169-linea-tiempo-modo-recibo`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). Abierto por S2 (relevo de SCRUM-1160, punto 3).

## El defecto

`buildStatusTimeline` (`quotesDetailView.js`) pintaba siempre cinco pasos: Creada → Enviada → Aceptada →
Facturada → Cobrada. En modo justificante (regla 24: ni documento ni cobro por YaQu) los dos últimos se
quedaban para siempre en «pendiente». Es el mismo patrón que SCRUM-1160 y SCRUM-1165.

## El arreglo

Los pasos «Facturada» y «Cobrada» solo se añaden si `window.facturaFiscalDisponible()` (`fiscal`/`demo`,
la comprobación de la casa) **o** si el presupuesto YA tiene facturas: se oculta lo que no va a ocurrir,
no lo que ya ocurrió. Con el modo desconocido o ausente se ocultan: falla cerrado. No hay texto nuevo.

## Tests — rojo antes, verde después

`tests/scrum1169-linea-tiempo-modo-recibo.test.mjs` (6 tests), ficha montada entera en el banco.
Contra `quotesDetailView.js` de `origin/main`: **3 fallan y 3 pasan (6)**. Fallan los de `receipt`, `null`
y `undefined`, porque la línea trae los 5 pasos. Pasan los controles: `fiscal`, `demo`, y `receipt` con
una factura ya existente. Con el cambio: 6/6. Cada test del modo justificante comprueba además que
«Creada» y «Aceptada» estén: si la línea no se pintara, saldría CIEGO y no verde.

## En navegador real, a 390 px

Producto real en Edge (`scripts/_banco-lista.mjs`, que carga los scripts del índice y solo dobla
`apiRequest`), porque el serializador del banco pierde los estilos puestos por JS (SCRUM-1158) y esta
línea se pinta con ellos:
- `receipt`: «Creada», «Enviada», «Aceptada»; sin «Facturada» ni «Cobrada»; 0 errores.
- `fiscal`: los cinco; 0 errores.

Capturas: `docs/master/evidencias/scrum1169/scrum1169-linea-receipt-390.png` y `…-fiscal-390.png`. Son
del producto con datos de prueba, **no de yaqu.app**; eso queda pendiente tras el despliegue.

## Visto en la misma captura, fuera de este ticket (se pasa al orquestador)

- En `receipt`, la ficha sigue teniendo la sección **«FACTURAS · No hay facturas generadas.»**: la misma
  familia (habla de un documento que el modo no deja emitir).
- **«MARGEN · undefined%»** en «Gastos y margen». Puede venir del fixture (la ruta de gastos devuelve
  `[]`); no está medido contra datos reales.
