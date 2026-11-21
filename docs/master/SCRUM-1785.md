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

### PENDIENTE DE FIRMA — el rótulo del WhatsApp del comercio (regla 39; lo lleva el orquestador al fundador)

«que salga específico whatsapp de la empresa (el nombre de empresa del merchant)» cambia lo que ve el cliente
en dos sitios. Literal propuesto, para firma:

- PDF (`pdf.service.ts:997-998`, dentro de `generateQuotePdf`): `WhatsApp ${params.merchant.whatsappPhone}` →
  **«WhatsApp de <nombre>: <número>»**
- vista previa (`quotesView.js:3192`, S2): `"WhatsApp " + currentMerchant.whatsappPhone` → el mismo literal.

Preguntas ✅/❌ para el fundador: ① ¿ese literal? ② ¿<nombre> es el **comercial** (`name`, el que enseña la
cabecera de la vista previa) o la **razón social** (`legalName`, la que el PDF pone en «Emisor:»)? ③
`pdf.service.ts` aloja también `generateInvoicePdf` (camino de emisión): el cambio va SOLO en
`generateQuotePdf`; ¿se da por no-STOP (regla 38: no toca la emisión) o se pide GO? **Pregunta abierta.** Lo
único medido: `tests/scrum523d-version-del-sif.test.mjs` no nombra `pdf.service.ts` (grep de `pdf` en ese
fichero: 0), así que su frontera no dice nada de este fichero; qué otra frontera lo cubra, no lo he medido.

### Tanda

Dirigida (11 ficheros: el mío, 836, 700, 710b, 719, 1294, 267, 273, 525d, 854, 622): 133/133. `npm run
guards:entrada`: 170/170. Suite entera por tramos: **7 de 15 corridos**, parada por orden del orquestador
(los tramos 8-15, NO corridos). En el 3, `scrum1289b` 2 rojos por `EPERM … open 'C:\Users\Javier'` (la ruta con
espacio de esta máquina; la rama no toca ese test ni `scripts/`). En el 5, `scrum1415` cayó por DOS `test()`
con nombre construido en mi fichero (heredados del commit de jv-j1gj): arreglado en el test (nombres
literales), 1785 + 1415 = 18/18.

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

# SCRUM-1785b · PDF del presupuesto: «WhatsApp de <nombre comercial>: <número>» (firma c.22281)

**Medido contra:** `origin/main` = `beb63b0dde9597565244c26c66e0e78b7240a765` · 2026-11-21T04:29:30Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «Comiteé en mi árbol a mitad de la suite entera que un subagente corría sobre él: la huella del árbol partió la tanda en dos y el resumen salió CIEGO» — no se pudo comprobar: lo que una sesión hace en su árbol mientras corre su propia tanda no pasa por ningún guard del repositorio
Mutaciones: catálogo → `tests/scrum1785b-whatsapp-con-nombre-comercial.test.mjs`

Sesión jv-j1gq (J1). **Supera el «rótulo PENDIENTE DE FIRMA» del tramo anterior:** el fundador firmó en
SCRUM-1785 c.22281, literal «El nombre comercial sí».

- **Cambio:** `src/modules/invoicing/infra/pdf/pdf.service.ts`, dentro de `generateQuotePdf` (la línea vieja
  era la 998 de main, «WhatsApp ${whatsappPhone}»). Con nombre comercial (`Merchant.name`, recortado) pinta
  `WhatsApp de <nombre comercial>: <número>`. «Emisor:» no cambia (`legalName || name`). `generateInvoicePdf`
  no se toca: el literal sale una sola vez en el fichero y después de la cabecera de `generateQuotePdf`.
- **Huellas congeladas:** `scrum603b` (cuerpo de `generateInvoicePdf`), `scrum723` (su ámbito) y `scrum523d`
  en verde con el cambio: no cae en ninguna frontera congelada, no se ha recongelado nada.
- **Sin nombre comercial — PARA FIRMA APARTE.** Medido con
  `docs/master/evidencias/scrum1785/sin-nombre-comercial.mjs` (4 casos, 0 ciegos): con `name` vacío o sólo
  espacios sale el rótulo de siempre, «WhatsApp 34000178522» (no cae a la razón social); sin `name` ni
  `legalName`, «Emisor: —» y el mismo «WhatsApp <número>». No se inventa texto: queda como estaba hasta que
  se firme. `Merchant.name` es obligatorio en el esquema y el alta rechaza un nombre vacío
  (`auth.routes.ts:45`, `name_required`); si «Ajustes» deja vaciarlo, NO medido.
- **Test:** `tests/scrum1785b-whatsapp-con-nombre-comercial.test.mjs`, rojo primero (2 de 4 caían: el literal
  y el control del fuente), verde 4/4 tras el cambio. Mutación de catálogo (volver a «WhatsApp <número>»)
  aplicada con `aplicarUna`: VIVA, 1 de 1.
- **Tanda dirigida:** 62 ficheros (los del encargo + los 40 que llaman a `generateQuotePdf`) · 539 casos ·
  532 pasan · 0 caen · 7 saltados (gateados por base).
- **scrum262 (rojo del obligatorio de #3289, run 44865506732):** los dos tests de 1785 sembraban el teléfono
  del cliente `600178511`, un móvil de rango real; el 1785b lo copió de la base sin correr `scrum262`. Pasan al
  rango imposible: cliente `34000178511`, comercio `34000178522`, también en las cuatro sondas de
  `docs/master/evidencias/scrum1785/` (la tabla del tramo anterior cita los números de entonces). `scrum262`
  suelto: antes 6/7 (caía «todo teléfono sembrado está en el rango imposible»), después 7/7.
- De paso: la primera pasada de la sonda del caso sin nombre buscaba «la línea» del WhatsApp y el lector de PDF
  junta el texto sin saltos; lo vi leyendo la salida y corté entre etiquetas vecinas.
- **Suite entera en local: INCOMPLETA.** La corrió un subagente: tramos 1–10 de 15. El 11 lo mató el arnés por
  memoria baja y 12–15 no se lanzaron; `--resumen 15` salió CIEGO. Además comiteé el arreglo de `scrum262` en
  este árbol a mitad de la tanda, y la huella del árbol la partió en dos (1–7 contra el árbol viejo, 8–10 contra
  el nuevo). Caen 2 casos de `tests/scrum1289b-reporters-como-argumentos.test.mjs` (tramo 3; sueltos, igual): el
  hijo muere con EPERM al abrir `C:\Users\Javier`, la ruta TEMP con espacio de esta máquina; no lo toca este
  cambio. Por orden del orquestador J se empuja una vez y la tanda completa la corre el obligatorio. El
  `scrum262` lo cazó el obligatorio de #3289 (`tests/scrum262-telefonos-de-prueba.test.mjs`).
- **No medido:** base, staging, yaqu.app; la vista previa (`quotesView.js`, S2) sigue con «WhatsApp <número>».

# SCRUM-1785c · PDF del presupuesto, comercio sin nombre comercial: «WhatsApp de <razón social>: <número>» (firma c.22328)

**Medido contra:** `origin/main` = `c4981dc8f072ab1cbbfc5ab8872b95c81c4cb339` · 2026-11-21T20:40:12Z (cabecera `Date:` de `gh api -i zen`)
A9: aviso → cicatriz J1 «Lancé la suite con la TEMP de la máquina, que lleva un espacio, aunque el encargo pedía TEMP sin espacios: cayó `scrum1289b`; y la ruta corta 8.3 (`JAVIER~1`) tampoco vale, porque tumba `scrum1298b`; las dos pasan con una carpeta real sin espacios» — no se pudo comprobar: la TEMP con la que una sesión lanza la suite no pasa por ningún guard del repositorio
Mutaciones: catálogo → `tests/scrum1785b-whatsapp-con-nombre-comercial.test.mjs`

Sesión jv-j1hf (J1). **Supera el «Sin nombre comercial — PARA FIRMA APARTE» del tramo 1785b:** el fundador firmó en
SCRUM-1785 c.22328, respuesta literal «2-Sí» a «¿Usamos ahí la razón social, "WhatsApp de <razón social>: <número>"?».

- **Cambio:** `src/modules/invoicing/infra/pdf/pdf.service.ts`, dentro de `generateQuotePdf` (la misma línea que
  cambió 1785b). El rótulo toma `nombreDelRotulo` = nombre comercial (`Merchant.name`, recortado) o, si está vacío o
  en blanco, la razón social (`legalName`, recortada). Con alguno de los dos: `WhatsApp de <nombre>: <número>`; sin
  ninguno: `WhatsApp <número>`, como antes. «Emisor:» no cambia. `generateInvoicePdf` no se toca: el literal
  `WhatsApp de ${` sigue saliendo una sola vez en el fichero, después de la cabecera de `generateQuotePdf` (caso ④
  del test).
- **Test:** `tests/scrum1785b-whatsapp-con-nombre-comercial.test.mjs`, ampliado con tres casos 1785c sobre el texto
  extraído del PDF real: sin nombre comercial → literal nuevo; nombre comercial sólo espacios → razón social; sin
  ninguno → «WhatsApp <número>». El caso «con nombre comercial» es el primero del fichero (1785b), sin tocar.
  Rojo primero: 7 casos, 5 pasan, 2 caen (los dos que piden la razón social; el de «sin ninguno» ya pasaba, es el
  comportamiento de siempre). Verde 7/7 tras el cambio.
- **Mutaciones (`aplicarUna`, catálogo del test):** base 7 pasan · 0 caen. ① volver a «WhatsApp <número>»: VIVA
  (+3 colaterales). ② quitar la vuelta a la razón social (`nombreDelRotulo = nombreComercial`): VIVA (+1). El ancla
  `de` de la mutación de 1785b se ha reescrito a `${nombreDelRotulo}` porque la variable cambió de nombre; sigue
  tumbando el mismo caso. Árbol restaurado tras las dos (src y dist con el arreglo, comprobado con `grep`).
- **Huellas congeladas:** `scrum603b`, `scrum723` y `scrum523d` en verde con el cambio; nada recongelado.
- **Tanda dirigida** (24 ficheros: `scrum1785*`, 262, 603b, 723, 523d, 1157/1215*/1415, 836, 719, 1294, 267, 273,
  525d, 854): 204 casos · 203 pasan · 1 cae (`scrum854` ②, este tramo aún no escrito) · 0 saltados. Con el tramo
  escrito, más los 5 de árbol entero (195, 414, 694, 710b, 737): 242/242. Tipos: `tsc -p . --noEmit` salida 0.
- **Main se movió dos veces mientras medía; se trajo con `git merge origin/main`, sin conflictos:** ① a `c27b1dc2`
  (1787d/1787f, con columnas nuevas: el cliente compartido ya regenerado tumbaba `scrum461` en mi árbol viejo);
  sobre ese árbol fusionado, dirigida + 5 de árbol entero + `scrum1787d` + `scrum461`: 259/259, y **suite entera
  por tramos: VERDE, 15 de 15, 1743 ficheros · 14.085 tests · 13.900 pasan · 0 caen** (el resto, saltados).
  ② a `c4981dc8` (#3305, 1786f1, que también toca `generateQuotePdf`): tras ese merge se repitió sólo la dirigida,
  no la suite entera: los 24 + 5 de árbol entero + `scrum1787d` + `scrum1786f1` + `scrum461`, 263 casos, 262 pasan
  y 1 cae (`scrum1294`: mi A9 citaba un trozo de la cicatriz y pide la frase entera; corregido, los 6 del registro
  43/43); `guards:entrada` 15 en verde; tipos `tsc -p . --noEmit` salida 0.
- **La TEMP de la suite (fallo mío):** los tramos 1–3 de la primera pasada corrieron con la TEMP de la máquina, que
  lleva un espacio, y cayeron 2 casos de `scrum1289b` (lo mismo que midió 1785b). Con la ruta corta 8.3
  (`C:\Users\JAVIER~1\…`) pasa `scrum1289b` pero caen 2 de `scrum1298b` (compara la ruta con la que devuelve git,
  que es la larga). Con una carpeta real sin espacios (`C:\Users\Public\tmp-jv-j1hf`) pasan los dos; la pasada
  entera que vale es la de esa TEMP.
- La sonda `docs/master/evidencias/scrum1785/sin-nombre-comercial.mjs` describe lo que pintaba el PDF ANTES de esta
  firma (rótulo sin nombre con `name` vacío); no se reescribe: es la medición de partida de 1785b.
- **No medido:** base, staging, yaqu.app (si «Ajustes» deja vaciar el nombre comercial sigue sin medir); la vista
  previa (`quotesView.js`, S2) no entra en esta firma.
