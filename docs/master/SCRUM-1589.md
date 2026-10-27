# SCRUM-1589 · PDF del albarán: la firma no pisa el nombre de quien firma

## 23-oct-2026 · S1 · arreglado en `albaranPdf.service.ts` (carril S1); el gemelo de J1, sin tocar

**Medido contra:** `origin/main` = `6c8706daef7399513e69e6872068aa7bed25b760` · 2026-10-23T12:49:25Z

A9: comprobación → `tests/scrum1589-firma-sin-pisar-el-nombre.test.mjs`

**Visto en producción** (build `6c8706dae`): el PDF real del albarán QA #47 (`GET /admin/albaranes/47/pdf`,
cuenta QA). El recuadro de la firma invade la línea «Firmado por: …».

**Causa, medida con pdfkit 0.17.2:**
- La firma se dibuja con `y` explícito y `fit: [180, 70]`. Con `y` explícito, pdfkit **no baja el cursor**
  después de la imagen.
- Después se bajaba con `doc.moveDown(5)`: a 10 pt Helvetica-Bold son **59,5 pt**.
- La caja de la firma mide **70 pt**, así que había **10,5 pt de solape**.
- El pad de firma es de ≤470×190 px (`public/dashboard/js/signaturePad.js`), y con esa proporción la firma
  **siempre** llena los 70 pt de alto. No es un caso raro: le pasa a toda firma real.

**¿Tapa el nombre o lo roza?** Lo **cruza, no lo tapa**. El texto se pinta después de la imagen, así que
queda por encima y se lee. El pad deja el fondo transparente. Pero los 10,5 pt de abajo del trazo (el
15 % de la caja) caen sobre la línea «Firmado por: <nombre>», de 9 pt de alto: el trazo atraviesa el nombre.

**El arreglo:** el cursor se lleva al pie de la caja entera (`arriba + 70`) más un hueco fijo de 4 pt. Se
usa la caja y no el alto real de la imagen porque el pad siempre la llena. Y así el bloque mide lo mismo
con cualquier firma. Sin texto nuevo, sin cambio en lo que se sella: el hash es del contenido, no del PDF.
Los albaranes ya firmados conservan su PDF en disco (`ensureAlbaranPdf`), así que no cambian.

**Prueba:** `tests/scrum1589-firma-sin-pisar-el-nombre.test.mjs` genera el PDF de verdad y mide dónde
pinta pdfkit. Para medir envuelve su prototipo desde fuera, en un proceso hijo. Ni una línea de `src/`
existe para el test.
- Tres firmas: 470×190 (escritorio), 240×190 (móvil estrecho) y 1×1 (el trazo de prueba del #47).
- **ROJO sin el arreglo, 3/3:** «la firma (de 253.9 a 323.9 pt) pisa «Firmado por:», que empieza en 313.4:
  10.5 pt de solape», la misma cifra que la medida a mano.
- **VERDE con el arreglo, 3/3.**
- El test también exige que el nombre no se aleje más de una línea de la firma.

**Salto de página:** el bloque reserva 130 pt (`doc.y + 130`). Medido con el arreglo, de la raya al final
de «Firmado el», con la línea de calidad, ocupa **125,3 pt**: sigue cabiendo.

**⚠️ GEMELO, NO tocado (J1, camino de emisión, regla 40):** `src/modules/invoicing/infra/pdf/pdf.service.ts:1176`,
la firma del presupuesto. Tiene el mismo `doc.moveDown(5)` tras `doc.image(…, { width: 180, height: 70,
fit: [180, 70] })` en `:1175`. **El número que usa S1:** pie de la caja = `arriba + 70`, más **4 pt** de
hueco. Si J1 lo arregla, que use el mismo para que los dos papeles no tengan dos soluciones distintas al
mismo solape.
