# SCRUM-1785

## SCRUM-1785 · «Ocultar datos» del presupuesto y el teléfono: qué número sale, de quién es y cómo se rotula

**Puesto:** J1 (jv-j1gm, relevo de jv-j1gj) · **Rama:** `scrum-1785-ocultar-datos-presupuesto` · 21-nov-2026
**Medido contra:** `origin/main` = `db789fd0fb7d604b718529ca1d861e351fc2e756` · 2026-11-21T04:02:48Z (cabecera `Date:` de `gh api -i zen`)
A9: sin fallo que generalice — el PASO 0 casó `gh pr list --search 1785` con el PR #1785 de SCRUM-1116 (número por subcadena), y lo descarté leyendo la rama del resultado; ya lo cubre A10 «Un prefijo no es un nombre, y una subcadena tampoco»
Mutaciones: catálogo → `tests/scrum1785-ocultar-datos-presupuesto.test.mjs`

Lo que pidió el fundador (descripción del ticket): que «ocultar datos» quite el número del PDF y de la vista previa.
Su respuesta a qué número era (c.22271): «El del cliente, creo chequealo y si el que sale es el tuyo que salga
específico whatsapp de la empresa (el nombre de empresa del merchant)».

Sin cambios en `src/` ni en `public/`. `pdf.service.ts` se ha LEÍDO (`generateQuotePdf`, :992-1018), no tocado.

### Qué número sale y dónde (texto extraído, no a ojo)

Instrumentos: `docs/master/evidencias/scrum1785/pdf-telefonos.mjs` (5 PDF reales, 0 ciegos) ·
`docs/master/evidencias/scrum1785/vista-previa-telefonos.mjs` (editor real montado 2 veces) ·
`docs/master/evidencias/scrum1785/vista-previa.mjs` (de jv-j1gj: 4 casillas, 2 fugas). Teléfono del cliente
`600178511`, WhatsApp del comercio `611178522`, nombre comercial `QAComercial1785`, razón social `QARazon1785SL`.

| dónde | «Teléfono» | tel. del CLIENTE | WhatsApp del COMERCIO | rótulo del comercio | nombre del comercio que sale |
|---|---|---|---|---|---|
| PDF | sin ocultar | sí, «Tel: 600178511» | sí | «WhatsApp 611178522» | sólo la razón social («Emisor: QARazon1785SL») |
| PDF | OCULTO | **no** | sí | «WhatsApp 611178522» | sólo la razón social |
| PDF, comercio sin razón social | OCULTO | no | sí | «WhatsApp 611178522» | el comercial («Emisor: QAComercial1785») |
| PDF, comercio sin WhatsApp | OCULTO | no | no (no hay) | — | la razón social |
| vista previa | sin ocultar | sí, «Tel: 600178511» | sí | «WhatsApp 611178522» | los dos: comercial arriba y razón social debajo |
| vista previa | OCULTO | **SÍ — FUGA** | sí | «WhatsApp 611178522» | los dos |

Lectura:
1. **En el PDF el del cliente se oculta bien.** El único número que queda con «Teléfono» oculto es el del
   comercio, en el bloque del emisor. **En la vista previa el del cliente NO se oculta** (y el nombre tampoco):
   ése es el defecto, y es de `quotesView.js`, carril S2.
2. **El rótulo del comercio es siempre «WhatsApp <número>»**, en el PDF y en la vista previa; no hay ningún caso
   con número y sin rótulo (sin WhatsApp no sale ni rótulo ni número). **Ninguno de los dos lleva el nombre de la
   empresa en el rótulo.**
3. **El nombre de empresa que usa el PDF es el FISCAL** (`legalName || name`, `pdf.service.ts:993`): el nombre
   comercial no aparece en el PDF si el comercio tiene razón social. La vista previa enseña los dos.
4. Caso que el PDF no distingue: si el WhatsApp del comercio es el MISMO número que el teléfono del cliente (un
   cliente de prueba con el propio móvil), con «Teléfono» oculto ese número sigue saliendo, como «WhatsApp …».
   Medido (caso E del instrumento); si fue lo que vio el fundador en su cuenta, NO lo he medido.

### Lo que fija el test

`tests/scrum1785-ocultar-datos-presupuesto.test.mjs` (de jv-j1gj, 11 casos) + 1 caso nuevo: con «Teléfono»
oculto, el WhatsApp del comercio SÍ sale y cae en el bloque del emisor (antes de «Cliente:»), y el del cliente
no. El texto del rótulo NO se fija: espera firma. Verde 12/12; con la mutación de catálogo nueva (el builder
quita el WhatsApp del comercio si se oculta el teléfono), 11/12 y cae exactamente ese caso (mutación equivalente
aplicada a `dist/`, no por el meta-guard; `--solo-censo` lista las entradas del fichero).

### PARADO — el rótulo que pide el fundador es texto nuevo (regla 39)

«que salga específico whatsapp de la empresa (el nombre de empresa del merchant)» cambia lo que ve el cliente
en dos sitios. Literal propuesto, para firma:

- PDF (`pdf.service.ts:997-998`, dentro de `generateQuotePdf`): `WhatsApp ${params.merchant.whatsappPhone}` →
  **«WhatsApp de <nombre>: <número>»**
- vista previa (`quotesView.js:3192`, S2): `"WhatsApp " + currentMerchant.whatsappPhone` → el mismo literal.

Preguntas ✅/❌ para el fundador: ① ¿ese literal? ② ¿<nombre> es el **comercial** (`name`, el que enseña la
cabecera de la vista previa) o la **razón social** (`legalName`, la que el PDF pone en «Emisor:»)? ③
`pdf.service.ts` aloja también `generateInvoicePdf` (camino de emisión): el cambio va SOLO en
`generateQuotePdf`; ¿se da por no-STOP (regla 38: no toca la emisión) o se pide GO?

### Para Luis (S2) — `public/dashboard/js/quotesView.js`

Medido por jv-j1gj y re-medido aquí (`vista-previa.mjs`: 2 fugas, sale 1). Arreglo literal, probado por jv-j1gj
sobre una COPIA de `public/` (2 fugas → 0, sale 0), sin texto nuevo:

```diff
@@ quotesView.js:1491 (tras `dfChecks[def.key] = chk;`)
+      chk.addEventListener("change", function () { renderPreview(); scheduleDraftSave(); });
@@ quotesView.js:3217-3226 (renderPreview, bloque Cliente)
-    if (customer) {
-      const cName = document.createElement("div");
-      cName.textContent = customer.name || "Cliente sin nombre";
-      clientBlock.appendChild(cName);
-
-      if (customer.phone) {
+    if (customer) {
+      if (dfChecks.name.checked) {
+        const cName = document.createElement("div");
+        cName.textContent = customer.name || "Cliente sin nombre";
+        clientBlock.appendChild(cName);
+      }
+
+      if (dfChecks.phone.checked && customer.phone) {
```

Y **«Duplicar» pierde la elección** (leído, no corrido, por jv-j1gj): el detalle `/admin/quotes/:id`
(`quoteAdmin.ts`, carril S1) no devuelve `docFields` y el editor no lo aplica desde la plantilla; las casillas
salen todas marcadas en la copia. La única escritura de `docFields` es el alta (`quotesView.js:5944` →
`quotes.routes.ts:207`); no hay ruta que lo edite después.

### No medido

La base (que `quotes.routes.ts:207` guarde `docFields`: leído, no corrido), staging y yaqu.app (fuera del
encargo), qué presupuesto concreto miró el fundador.
