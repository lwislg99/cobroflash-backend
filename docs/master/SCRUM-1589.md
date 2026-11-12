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

## SCRUM-1589 · VISTO en yaqu.app (S4, 29-oct-2026)

Medido sobre `origin/main` `bf2549a4fb7caf6b97f9a557e169ab5861552342`; producción en `e9888aa23` (`/version`,
~10:55Z), que contiene el merge de #2731 (`a3c13611e`, comprobado con `merge-base --is-ancestor`). Horas de GitHub.

**Excepción a R25 (`docs/RUNBOOKS.md:887`), autorizada por el orquestador de Luis (cobroflash-backend-52,
SendMessage del 29-oct, opción A).** R25 deja fuera «firmar con el perfil fiscal vacío», y el perfil de QA sigue
vacío (`GET /admin/merchant` → 200 a las 10:44Z: `legalName`, `taxId` y `address` null). Razón, **LEÍDA EN EL
CÓDIGO, NO MEDIDA:** el servidor no lo impide (`albaran.service.ts:681-682` cae a `merchant.name` y
`emisorNif` null) y R26 fila 3 midió que el sobre v:3 CONGELA emisor y NIF, así que rellenar el perfil después
no alteraría lo ya firmado. El perfil NO se ha tocado (ningún `PUT /admin/merchant`). Propuesta, sin aplicar
(el runbook lo decide el orquestador): que R25 diga que el perfil vacío no impide firmar un sobre v:3, y que la
razón que da («entran en el hash») sólo vale para v:1 y v:2.

**Qué se firmó (R25.2 y R25.6).** Cuenta `luisdragonball+qa@gmail.com` (merchant 46), Trabajo #76:

| albarán | creado | emitido | firmado | papel |
|---|---|---|---|---|
| #49 `AB260004` | 11:12Z, borrador | sí | **sí**, `firmadoAt` 2026-10-29T11:14:35.841Z (reloj del servidor), firmante «[QA-1589] Firmante de prueba», «El propio cliente», canal in situ | el que se mide |
| #50 `AB260005` | 11:12Z, borrador | sí | **no** (queda `emitido`) | gemelo sin firmar, control (R25.4) |

La firma es la del PANEL (`POST /admin/albaranes/49/firmar`, botón «Firmar aquí mismo»), con el trazo
DIBUJADO con el ratón en el pad (470×190), no un PNG inyectado. Nada se envió. Por la regla 29, #49 no se edita
ni se borra.

**Lo medido** (`evidencias/SCRUM-1589/1589-visto/medir-pdf-firma.mjs`, sólo GET; salida en `medida.txt`):

| aceptación (c.20505) | dónde se ve |
|---|---|
| el cursor baja al pie de la caja de la firma (arriba + 70) y deja 4 pt; la firma ya no invade «Firmado por:» | PDF de #49: imagen 173,16 × 70 pt de 299,01 a 369,01; techo de «Firmado por:» en 373,01 → **4,00 pt de hueco, no se pisan**. Recorte pintado: `albaran-49-bloque-firma.png` |
| toda firma real llega a los 70 pt | la imagen de #49 sale a 70 pt de alto (el pad llena la caja de alto: 470/190 × 70 = 173,16) |
| (control) | gemelo #50: 0 imágenes y sin «Firmado por» · #47 (firmado el 14-oct, PDF generado hoy): también 4,00 pt |
| en yaqu.app, con un albarán NUEVO firmado en QA | hecho: #49 |

**Límites, dichos:** (1) el pad registró sólo parte del trazo (998 píxeles pintados, filas 8–86 de 190), así que
el recorte no enseña un trazo que toque el pie del pad; el peor caso lo cubre la caja medida, que es la del pad
entero. No se investigó por qué (puede ser cómo lo movió Playwright). (2) El «antes» (10,5 pt de solape) no se
puede ver en producción: lo dio el test de S1 en rojo contra main. (3) El primer cálculo de la sonda tomaba la
imagen y el texto en el mismo sentido de ejes y daba «se pisan 169 pt»; se vio leyendo los operadores crudos y se
corrigió antes de usar ninguna cifra.

A9: comprobación → `docs/master/evidencias/SCRUM-1589/1589-visto/medir-pdf-firma.mjs`
