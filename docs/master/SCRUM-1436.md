# SCRUM-1436 · Dos de los cinco hallazgos: el aviso de disputa ya no afirma una firma que no ha mirado, y «ventana cerrada» ya no se dice de una ventana abierta

**Medido contra:** `origin/main` = `eda7ca55f9e2352b9da916c12f80d39aca5e1595` · 2026-10-07T16:01:39Z

7-oct-2026 · **J2** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por una sesión; no por el fundador. SCRUM-1436 y SCRUM-1477, con sus comentarios, leídos en Jira.]

A9: comprobación → `tests/scrum1436-ventana-abierta-envio-fallido.test.mjs`

**Este tramo es el de los hallazgos 1 y 3.** El hallazgo 2 lo lleva J1 en su rama (`scrum-1436b-…`), con
su anexo propio en este mismo fichero.

**Este registro NO cierra el ticket.** SCRUM-1436 tiene cinco hallazgos y seis líneas de aceptación;
aquí van el hallazgo 3 entero y la mitad del 1. Qué falta, al final.

## Ⓐ Hallazgo 1 · «Tranquilo: tienes el presupuesto FIRMADO»

`src/modules/payments/disputes.service.ts`. Cuando un banco reclama un cobro, el profesional recibe un
WhatsApp. El texto afirmaba la firma SIEMPRE: el código sólo miraba si había factura, y eso para poner
su número.

**El dato existía.** `Invoice.quoteId` → `Quote.signatureUrl`. La casa ya define «firmado» así y no por
`acceptedAt` (`libroRegistro.repo.ts`: «aceptar y firmar no son lo mismo»). «Acepto sin firmar» deja la
firma a `null` (`quotes.routes.ts`).

**La condición** (`presupuestoFirmadoDe`): la frase sale sólo si la factura del cobro apunta a un
presupuesto **de ese negocio** cuya firma **tiene trazo** (`firmaTieneTrazo`, SCRUM-892: una firma
guardada puede ser un lienzo vacío). Es lo mismo que enseña el «Paquete de disputa» al que el aviso
manda: lee `invoice.quote` y pinta su `signatureUrl`. Si la consulta falla, es «no»: el aviso sale
igual, sin la afirmación.

**Divergencia declarada, sobre el mismo campo:** el Libro usa `signatureUrl` no nulo; aquí se pasa por
`firmaTieneTrazo` (SCRUM-892) a propósito, porque el aviso afirma que hay prueba. Confirmado por el
orquestador el 7-oct-2026.

**Sin firma, el aviso es el de siempre MENOS esa oración.** Ni una palabra nueva: qué decirle entonces
es texto que ve el usuario (regla 39). El test lo fija por igualdad de la cadena entera.

**Con firma, el aviso es byte a byte el de antes** (caso ① del test).

**La puerta del comentario 18287, leída:** la frase vive sólo en el `freeText` de `notifyMerchantAlert`
(texto libre). Si el aviso cae a la plantilla `merchant_alert_es` van «ha disputado un cobro» y el
importe con el número: ahí la frase no sale. No hay plantilla de Meta que cambiar.

Límite declarado: un cobro sin factura, o cuya factura no apunta a su presupuesto, sale como «no
firmado» aunque exista un presupuesto firmado por otro camino (`Quote.chargeId`). Ahí el paquete
tampoco lo enseñaría. Cuántos cobros reales están en ese caso: SIN MEDIR (no hay base autorizada).

## Ⓑ Hallazgo 3 · «Tu cliente no ha escrito en 24 h» cuando sí escribió

`src/integrations/whatsapp.ts`, `sendWhatsAppWindowFirst`. Con `sinPlantilla` se llegaba al mismo
`return { reason: 'ventana_cerrada' }` por dos caminos: ventana cerrada (cierto) y ventana ABIERTA con
el envío fallido. `sinPlantilla` es una opción del llamador, no el estado de la ventana.

Ahora la función recuerda si llegó a intentar el envío por ventana (`falloEnVentana`). Si lo intentó y
falló, devuelve el motivo que traiga ese envío (`demo_safe_numbers`, la baja, `not_configured`…) y, si
no trae ninguno, `whatsapp_send_failed`, que ya existía con su frase. Ningún texto nuevo.

**Lo que NO cambia, y está en el test:** con `sinPlantilla` no se manda plantilla en ningún caso
(decisión 3 del fundador, 28-jul-2026, SCRUM-195); con la ventana cerrada el motivo sigue siendo
`ventana_cerrada`; sin la opción se sigue cayendo a plantilla.

Único llamador con `sinPlantilla`: `sendQuote.service.ts`, que deja pasar los motivos con frase propia
y convierte el resto en `whatsapp_send_failed`. El segundo caso del bloque ② del test lo recorre entero.

## Ⓒ Lo corrido

Todo en local, contra `dist/` construido con `tsc --noCheck` después del último cambio y después de
mezclar `origin/main`. Las filas de abajo se midieron con `e883e586` mezclado; con `eda7ca55` mezclado
se repitieron los dos tests míos (18 casos, 0 caen), el banco de mutaciones (mismo resultado) y
`guards:entrada`. El build bueno es el del CI.

| Qué | Resultado |
|---|---|
| Rojo primero, disputa (contra `main` `12ecc7bb`, antes del arreglo) | 10 casos, 10 caen |
| Rojo primero, ventana (antes del arreglo) | 8 casos, 3 caen (los 3 del defecto); 2 suelos y 3 positivos pasan |
| Los dos tests, después | 18 casos, 0 caen, 0 saltos |
| Los dos míos, sus vecinos (scrum195-loop-adicional, scrum815-disputa, scrum62-albaran-ventana, scrum590-el-movil, scrum180, scrum227) y los guards de suite (scrum237, 976, 409, 419, 850, 850b, los cuatro scrum245, 864c, 267, 1294, 525d, 514), ya con main mezclado | 193 casos, 191 pasan, 2 caen, 0 saltos. Los 2 son de `scrum245-tipo-obliga-declarar` y caen por el árbol: `Cannot find module …\node_modules\typescript\bin\tsc` (este worktree no tiene `node_modules` propio). No los he visto pasar en ningún sitio: los dirá el CI |
| `npm run guards:entrada`, después del registro | 13 guards, 158 casos, 0 caen |
| Mutaciones (`tests/banco-scrum1436/mutar.mjs`, salida en `docs/evidencias/scrum1436/mutaciones.txt`) | 9 mutaciones: 8 caen, 1 viva y equivalente (M5); las 2 bases sin mutar, 0 caídas |
| `tsc --noEmit` completo | 6 errores, ninguno en mis dos ficheros (3 en `app.ts`, 2 en `invoiceNumber.service.ts`, 1 en `merchantAdmin.ts`); NO he mirado si son del árbol o del `node_modules` compartido |

M5 quita la guarda «sin factura o sin presupuesto». Sale viva porque sin ella `invoice.quoteId` sobre
`null` lanza dentro del `try` y el `catch` devuelve lo mismo. Son dos guardas redundantes, no un hueco.

**NO corrido:** la tanda completa (va en el CI). Nada visto en yaqu.app: los dos caminos necesitan una
disputa de Stripe y un fallo de Meta, que no se pueden provocar desde fuera.

## Ⓓ Dos tropiezos míos

1. El banco del test de ventana inyectaba la base en cada caso. `inyectarBase` sólo descarta el sender
   y el envío; el módulo de la ventana seguía contestando con la base del PRIMER caso, y el contador
   de consultas del segundo salía a 0. Lo cazó el suelo del propio test («no se ha consultado la
   ventana»), no yo. Ahora la base se inyecta una vez y lo que cambia es un estado.
2. Le pasé un guion a node por un heredoc de bash, el arnés lo rechazó, y volví a correr el test sin
   haber cambiado nada: salió idéntico. Una operación que no se ejecutó se lee igual que una que no
   arregló nada. Visto por el error del comando anterior.

## Ⓔ Lo que falta, y de quién es

- **Hallazgo 1, los dos textos nuevos** (aceptado sin firma · sin presupuesto), firmados en el
  comentario 18287 (cuenta de Luis) y válidos para este carril por la decisión del comentario 18734.
  Están construidos letra por letra y NO van en esta rama: esperan en `scrum-1436c` a que su ficha de
  `docs/microcopy/` pueda llevar una línea de firma cierta. `tests/scrum726-quien-firma-la-microcopy`
  sólo admite «Aprobado por el fundador» o «por el orquestador por delegación del fundador», y de ese
  comentario no se puede afirmar ninguna de las dos. Lo lleva el orquestador. El commit ⑥ de esta rama
  los traía y el siguiente lo revierte: no están en el árbol.
- **Hallazgo 1, el cobro SIN factura** sigue diciendo «Entra en la factura y pulsa…» sin factura a la
  que entrar. Los dos literales firmados llevan el número de la factura, así que tampoco sirven ahí:
  necesita un texto propio y hoy no hay ninguno firmado. Es lo que le falta a la línea 1 de la
  aceptación («no manda a una factura que no existe»). Lo sube el orquestador.
- **Hallazgos 2, 4 y 5:** no cogidos aquí.
- **SCRUM-1477** (los siete `catch` de `whatsapp.ts` no distinguen «Meta dijo que no» de «Meta no
  contestó») es OTRO trabajo y no se ha tocado. La ficha del encargo le puso ese número al hallazgo 3.
# SCRUM-1436b · El recordatorio manual nombra el documento por su número

> Este tramo es **SCRUM-1436b**: sólo la parte de J1 del hallazgo 2 del ticket. Los hallazgos 1 y 3
> son de J2 y van en su propia rama, con su propio tramo en este fichero. Por eso hay dos tramos.

**Medido contra:** `origin/main` = `12ecc7bb3bad377e729a01b09fd755f978e125b9` · 2026-10-07T15:47:30Z

A9: comprobación → `tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`

Sesión J1 (`jv-j1`, 7-oct) · rama `scrum-1436b-el-recordatorio-nombra-por-el-numero`. Encargo del
orquestador de Javier, sobre lo que midió el equipo de Luis en SCRUM-1436.

## El defecto

`POST /admin/invoices/:id/send-reminder` manda al cliente, cuando el documento no tiene cobro, un
texto libre. Ese texto decía «el pago de la factura *N*» escrito a mano, también para un `J-…`, que
es un justificante y no una factura (reglas 24 y 26).

Visto ejecutando la ruta real de `dist/` (base doblada, WhatsApp en dry-run), antes de tocar nada:

    J-2026-0007 → «…tienes pendiente el pago de la factura *J-2026-0007* por *419,87 €*…»
    F260007     → «…tienes pendiente el pago de la factura *F260007* por *419,87 €*…»

## El arreglo

Una línea, en `src/modules/system/app/routes/invoicesAdmin.routes.ts`: la palabra la decide
`isReceiptNumber(invoice.number)`. Es el criterio que ya usan los otros dos emisores del mismo
documento (`invoiceWhatsApp.service.ts` y `invoiceReminder.service.ts`); el fichero ya lo importaba.
No hay criterio nuevo.

La forma es la acordada en el comentario 18287 del ticket: el artículo va dentro de la etiqueta,
«de la factura» / «del justificante». Ese comentario lo escribió la cuenta de Luis; aquí se cita
como la forma acordada, no como firma del fundador. Para una factura la frase no cambia ni una
letra, y el test lo comprueba entera.

No se ha tocado el camino de emisión: el cambio está dentro del handler del recordatorio y no
mueve ninguna línea del fichero (1 insertada, 1 borrada).

## El test

`tests/scrum1436b-el-recordatorio-nombra-por-el-numero.test.mjs`, 5 casos, por la ruta real:

| caso | antes del arreglo | después |
|---|---|---|
| SUELO: sin cobro sale un texto libre | pasa | pasa |
| 🔴 un `J-…` se llama «justificante» y no «factura» | **cae** | pasa |
| ✅ una factura dice «factura», con la frase entera de siempre | pasa | pasa |
| la palabra coincide con `isReceiptNumber` sobre 7 números (3 justificantes, 4 facturas) | **cae** | pasa |
| CONTROL: con cobro sigue yendo por la plantilla | pasa | pasa |

Antes: 5 casos, 3 pasan, 2 caen. Después: 5 casos, 5 pasan, 0 caen.

## Mi error

El positivo cayó la primera vez sobre el código SIN tocar. El importe lleva un espacio de no
separación (U+00A0) y yo lo había escrito en el test como un espacio normal: dos cadenas que en
pantalla son iguales. Lo delató que un caso que tenía que pasar cayera, no leerlo. Ahora el test
saca el importe del helper de la casa (`formatMoneyEs`) y comprueba su forma antes de usarlo.

## Lo que NO lleva

- **El camino con cobro.** Ahí el recordatorio va por la plantilla `payment_request_es`, cuyo texto
  es de Meta. No se ha mirado qué palabra lleva esa plantilla para un justificante.
- **El recordatorio automático** (`invoiceReminder.service.ts`, «el pago del factura»): es de J2.
- **La otra rama del hallazgo 2:** el recordatorio manual con cobro manda siempre la plantilla, sin
  probar antes la ventana abierta. No se ha tocado.
- **No se ha visto en yaqu.app.** Pide una sesión con un justificante sin cobro y un cliente con
  teléfono.
- **Tipos:** el build local es `--noCheck`. Los tipos los comprueba el CI.
