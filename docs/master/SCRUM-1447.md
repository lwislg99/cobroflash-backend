# SCRUM-1447 · El tipo redondeado a entero: medido junto a SCRUM-1446 y SCRUM-1448

**Medido contra:** `origin/main` = `a65a8c756c0363ec5ea6f4f0b1e811ba17a909c0` · 2026-10-07T23:34:34Z (hora de GitHub)

A9: comprobación → `tests/scrum1446-los-tres-importes-del-pdf.test.mjs`

La medición entera está en `docs/master/SCRUM-1446.md`, §3. Aquí, sólo el resultado:

- De los 7 tipos que admite el servidor, uno sale con un tipo que no es el suyo: el 7,5 %, como «8%».
- Dos tipos fundidos en una fila: 0 de los 21 pares de tipos admitidos.
- El redondeo no está sólo en el rótulo del PDF de la factura. Con una línea al 7,5 %, el pie del
  presupuesto calcula la cuota al 8 % (8,00 sobre 100,00, con Total 107,50), el desglose del registro
  de facturación lleva `TipoImpositivo` 8 con cuota 7.50, y el descuento global se descuenta con el
  impuesto al 8 %.
- No se ha arreglado nada: es camino de emisión y texto de un documento fiscal.
- No medido: cuántas líneas guardadas llevan un 7,5 %.
