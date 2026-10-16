# SCRUM-1236 — Los textos que afirman algo falso fuera del panel (landing, legales, bot)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:27:28Z

Carril S4 (microcopy) · lo medido del 14 al 15-oct-2026 vive en Jira (c.19745, c.19791, c.19813, c.19822).
Este registro empieza con lo que dejó pendiente c.19822: los 5 PDF que salieron CIEGOS.
A9: sin fallo que generalice — cabecera del registro: lo medido, y su error, van en el tramo de abajo

## 1236 — los PDF de presupuesto, leídos por dentro (S4, s4-16oct)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:27:28Z

Producción servía ese mismo SHA (/version).

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto: sólo se leen PDF servidos.

**La pregunta de c.19822:** los 5 PDF que enlaza el portal del cliente 83 salieron ciegos para `privacidad:92`
(«IP y navegador nunca se exponen públicamente»), porque van comprimidos y en sus bytes no se ve el texto.
**¿Se puede leer su texto?** Sí, y sin dependencias nuevas. Los dos generadores (`pdf.service.ts:335` y `:797`)
usan las fuentes estándar de pdfkit (Helvetica, WinAnsi): basta con inflar cada stream con el `zlib` de node
y leer los operadores `Tj`/`TJ`. Lo hace `docs/master/evidencias/SCRUM-1236/pdf-texto.mjs`.

**Controles, antes de mirar** (`control-salida-16oct.txt`):

| control | lo que se esperaba | lo recibido |
|---|---|---|
| PDF COMPRIMIDO hecho aquí con el pdfkit del repo, con IP, `Mozilla/5.0` y acentos | en los bytes crudos no se ve; el extractor sí | crudo: `Mozilla` no aparece (la ceguera de ayer, reproducida) · extractor: IP, navegador y acentos, los tres |
| PDF REAL con evidencia: albarán #47, firmado (`GET /admin/albaranes/47/pdf`, panel QA) | el certificado se lee | «Certificado de evidencias de la firma», Firmante, Sello temporal, Canal, SHA-256 · 0 IP · 0 navegador |
| su negativo: albarán #46, sin firmar | sin certificado | sin certificado |

**Los 5, por la vía pública** (portal del cliente 83 y `/pay/quote/<token>/pdf`, SIN cookie; los tokens no se
imprimen; `sonda-pdfs-salida-16oct.txt`): 200 `application/pdf` los cinco, 2.085-2.268 B, 1 stream inflado y
0 fallidos cada uno. Cada uno trae texto conocido (su número —#1, #2, #3, #3.1, #5— y «Cliente de pruebas
QA»). **0 IPv4, 0 IPv6, 0 navegador y 0 certificado** en los cinco: ninguno de esos presupuestos está firmado
(c.19813: el único aceptado, el #206, tiene `evidence:null`).

**Veredicto:** los 5 dejan de estar CIEGOS. Leídos, no exponen IP ni navegador. `privacidad:92` sigue
«ni falso ni comprobado», por lo mismo que en c.19822: la superficie que decide (la página pública de un
documento FIRMADO, y el PDF de un presupuesto firmado) espera la regla para firmar en QA.

- **De paso, un fallo del extractor que cazó su propio control:** en el #47 la 1.ª versión contó 3 streams,
  uno «sin inflar». No era del PDF. La regex `stream\n` casaba dentro de `endstream\n` y tomaba como stream
  el hueco entre dos objetos. Ahora salta el `endstream` entero: el #47 da 2 de 2 inflados, y los otros no
  cambian. Sin el control del #47, ese «1 fallido» se habría leído como «hay algo que no se puede leer».
A9: sin fallo que generalice — el falso stream lo cazó el control del #47 antes del veredicto, y el arreglo va en el mismo extractor que lo usa

## 1236b — con la regla para firmar en QA, `/albaran/<firmaToken>` sigue sin alcanzarse (S4, s4-16oct)

**Medido contra:** `origin/main` = `555c65fa91cd12d54d735a40b90e479805b276fa` · 2026-10-16T11:53:07Z

Producción servía `37c52e17d62319300469075474d99399eafd2af1` (/version). Entre las dos sólo está el #2510
(`exports.routes.ts`), que no toca nada de lo leído aquí.

**Skill UI:** no cargada · no se toca ninguna pantalla ni ningún texto.

**La regla llegó** (R25 del orquestador, 16-oct, con el sí del fundador: firmar un parte y un albarán en la
cuenta de QA). **Pero firmar no es lo que faltaba.** Para ver la página pública de un parte firmado hay que
tener su `firmaToken`, y ese token:

| pregunta | lo que hay | dónde |
|---|---|---|
| ¿quién lo crea? | sólo el envío «para firmar» por WhatsApp, justo antes de mandar el mensaje | `albaranWhatsApp.service.ts:133`, la única escritura de `firmaToken` en `src/` |
| ¿lo devuelve el panel? | no. `GET /admin/albaranes/46` y `/47` en yaqu.app (cuenta QA) no traen `firmaToken`, y los dos dicen `enviadoParaFirma:false` | medido hoy, 11:5xZ |
| ¿lo guarda el registro de envíos? | no. La fila de WA-0b guarda teléfono, plantilla, estado y coste, pero no el cuerpo | `whatsappLog.service.ts:42-56` |
| ¿lo enseña el portal del cliente? | no. El portal no lista ni partes ni albaranes | `customerPortal.routes.ts` |

O sea: el enlace sólo existe dentro de un WhatsApp de verdad, y lo lee el móvil del cliente 83, no el equipo.
Mandarlo es una salida a Meta que cuesta dinero y llega a un teléfono real, y R25 no lo cubre: cubre firmar,
no enviar. **No se ha firmado nada.** Firmar es irreversible (R25 ②/③), y una firma en obra no abre la página
remota. Lo único que daría es un PDF con certificado, y eso ya está medido con el #47 (tramo de arriba: 0 IP,
0 navegador). Una firma que no mide nada no cuenta como medida (R25 ⑥).

**Lo que sí se sabe, leído (no medido en producción):** la rama `firmado` de `GET /albaran/:token`
(`albaranPublic.routes.ts:258-263`) pinta la cabecera del negocio, «Este parte de trabajo ya está firmado.» y
el nombre del cliente, y nada de `evidenciaFirma`. El `POST …/firmar` contesta `{ ok, portalUrl? }` o
`{ ok, already }` (`:383`, `:491`). Las dos vías de firma (remota `:437-438`, en obra
`albaranes.routes.ts:1056-1058`) guardan IP y navegador en la evidencia, y el PDF no los imprime
(`albaranPdf.service.ts:414`).

**Veredicto:** `privacidad:92` se queda **DECLARADO no medible en producción por el equipo**. No es falso y
no está comprobado. El PDF firmado está medido; la página pública del firmado está leída, no vista. Para
verla hace falta una de dos, y las dos son del fundador: ① pulsar «Enviar para firmar» en el #46 (cuenta QA)
y abrir el enlace desde el móvil que lo recibe, o ② autorizar que el equipo mande ese WhatsApp y le pase el
enlace. Con el enlace en la mano: se mide la página del #46 emitido, se firma en obra desde el panel (R25,
con el #47 de gemelo ya firmado y el estado anotado antes) y se vuelve a pedir el MISMO enlace, que entonces
cae en la rama `firmado`.
A9: sin fallo que generalice — la premisa «falta la regla de firmar» la dejé escrita yo arriba sin leer de dónde sale el token; se corrige aquí, en el mismo registro
