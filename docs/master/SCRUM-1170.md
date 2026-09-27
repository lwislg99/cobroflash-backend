# SCRUM-1170 · En modo justificante, la ficha del presupuesto no enseña una sección «Facturas» vacía

**Medido contra:** `origin/main` = `29f43a406b0e3663b6227dc6a26bad3ea0e0fa9f` · 2026-09-27T16:26:19Z
**Rama:** `scrum-1170-seccion-facturas-modo-recibo`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). Abierto por S2 a partir de la captura de SCRUM-1169.

## El defecto

La sección «Facturas» de la ficha del presupuesto (`quotesDetailView.js`) se montaba siempre. Desde
SCRUM-1160 su botón «Generar factura» no se pinta en modo justificante, así que en ese modo, y sin
facturas, la sección solo decía «No hay facturas generadas.», hablando de un documento que la regla 24
no deja emitir.

## El arreglo

La sección solo se añade a la página si `window.facturaFiscalDisponible()` (`fiscal`/`demo`) **o** si el
presupuesto YA tiene facturas. Con el modo desconocido o ausente no se monta: falla cerrado. Sin texto
nuevo. El botón y la nota de SCRUM-1160 se siguen colgando de la sección como antes; si la sección no
está en la página, tampoco están ellos, que es lo que ya pasaba en ese modo.

## Tests — rojo antes, verde después

`tests/scrum1170-seccion-facturas-modo-recibo.test.mjs` (6 tests), ficha montada entera en el banco.
Contra `quotesDetailView.js` de `origin/main`: **3 fallan y 3 pasan (6)**. Fallan `receipt`, `null` y
`undefined`, que enseñan la sección. Pasan los controles: `fiscal`, `demo`, y `receipt` con una factura
existente. Cada test del modo justificante exige que la sección «Conceptos» esté: si la ficha no se
pintara, saldría CIEGO y no verde. Con el cambio: 6/6. Los de 1160, 601 y 984 siguen en verde (54/54
juntos).

## En navegador real, a 390 px

Producto real en Edge (`scripts/_banco-lista.mjs`). `receipt`: sin sección «Facturas», 0 errores.
`fiscal`: con ella, 0 errores. Capturas: `docs/master/evidencias/scrum1170/scrum1170-ficha-receipt-390.png`
y `…-fiscal-390.png`. Esta rama sale de main **sin** SCRUM-1169, por eso la línea de tiempo de la
captura aún enseña «Facturada · Cobrada». Son datos de prueba, **no yaqu.app**.

⚠️ **Fixture con la forma del servidor.** La captura de SCRUM-1169 enseñaba «MARGEN undefined%» porque
su fixture servía `[]` en `/admin/expenses/margin/1`, y el servidor devuelve un objeto con `marginPct`
siempre numérico (`expenses.service.ts:512`). Aquí esa ruta devuelve la forma real y el margen sale
«100 %». **Un fixture con la forma equivocada fabrica defectos fantasma en las capturas.**
