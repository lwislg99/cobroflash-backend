# SCRUM-1436 · Dos de los cinco hallazgos: el aviso de disputa ya no afirma una firma que no ha mirado, y «ventana cerrada» ya no se dice de una ventana abierta

**Medido contra:** `origin/main` = `e883e586d11298ca09d58cd3fa89937b7b0549bd` · 2026-10-07T15:52:25Z

7-oct-2026 · **J2** (puesto J2, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`).
[Escrito por una sesión; no por el fundador. SCRUM-1436 y SCRUM-1477, con sus comentarios, leídos en Jira.]

A9: comprobación → `tests/scrum1436-ventana-abierta-envio-fallido.test.mjs`

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
mezclar `origin/main` `e883e586`. El build bueno es el del CI.

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

- **Hallazgo 1, los dos textos nuevos** (aceptado sin firma · sin presupuesto). El comentario 18287
  (cuenta de Luis, 6-oct) los da por firmados. NO construidos: si esa firma vale para un texto del
  carril de Javier lo decide el orquestador de Javier.
- **Hallazgo 1, el aviso sin factura** sigue diciendo «Entra en la factura y pulsa…» sin factura a la
  que entrar. No tocado: arreglarlo es quitar o cambiar una instrucción, y va con los textos de arriba.
- **Hallazgos 2, 4 y 5:** no cogidos aquí.
- **SCRUM-1477** (los siete `catch` de `whatsapp.ts` no distinguen «Meta dijo que no» de «Meta no
  contestó») es OTRO trabajo y no se ha tocado. La ficha del encargo le puso ese número al hallazgo 3.
