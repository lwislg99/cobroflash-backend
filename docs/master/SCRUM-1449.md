# SCRUM-1449 · Pago con Mercado Pago: cuándo sale cada frase, medido ejecutando la ruta

**Medido contra:** `origin/main` = `28166620c923253a3c2c350f415894e6fc2ed1f4` · 2026-10-07T16:43:17Z (hora de GitHub)

A9: sin fallo que generalice — es una medición sin código; el fallo de la sesión (no medir el contexto a tiempo) va en la entrega y no depende de este ticket

Sesión J1 (`jv-j1`, 7-oct), por encargo del orquestador de Javier. El ticket es del área J2 y J2 no
tiene sesión hoy. **Sólo se mide: no se ha tocado `src/` ni se ha escrito ningún texto.**

## Qué se hizo

`docs/master/evidencias/SCRUM-1449/medir-1449.mjs` ejecuta las rutas reales de `dist/`
(`payMp.routes`, `mpWebhook.routes`) con la base doblada, Mercado Pago doblado y el WhatsApp en
dry-run, e imprime lo que contestan. Su salida de hoy está al lado, en `medido-2026-10-07.txt`.
Población: 4 situaciones del enlace de pago, 4 estados de la página de resultado y 12 combinaciones
de contacto del cliente con lo que dice Mercado Pago.

## Lo que salió

### 1 · «Mercado Pago no está configurado para este merchant.» no depende del negocio

| situación | contesta | lo que lee el cliente |
|---|---|---|
| la plataforma no tiene token de Mercado Pago | 503, texto plano | «Mercado Pago no está configurado para este merchant.» |
| la plataforma lo tiene | redirige al pago | — |
| la plataforma lo tiene y Mercado Pago no contesta | 502, texto plano | «Error al conectar con Mercado Pago. Inténtalo de nuevo.» |

La ruta lee `charge.merchant.mpAccessToken` y, si no hay, el token de la plataforma. Pero
`mpAccessToken` no es una columna de `prisma/schema.prisma` (buscado por nombre: cero apariciones;
control: `whatsappPhone` sí aparece), así que en una fila real nunca viene. **Lo único que decide el
503 es la configuración de la plataforma**, igual para todos los negocios. La frase le dice al
cliente que el problema es «de este merchant», y no lo es.

**No medido:** si producción tiene ese token puesto. Es una clave y no se mira. Si lo tiene, el 503
no sale nunca; si no lo tiene, sale siempre.

### 2 · A esa ruta no lleva ningún enlace del producto

`/pay/mp/<token>` sólo se construye en `charges.routes.ts` (`paymp_url`, en la respuesta de
`POST /charges`), y nadie lee ese campo: buscado `paymp_url` y `/pay/mp/` en `src/` y `public/`,
sólo aparecen ahí, en la propia ruta y en las URLs de retorno de Mercado Pago. Ninguna página de
pago ni ningún mensaje ofrece ese enlace. Es lectura por búsqueda, no una navegación en yaqu.app.

O sea: hoy un cliente sólo llega a estas tres frases si alguien le da la dirección a mano.

### 3 · «Te notificaremos pronto» se cumple en 3 de 12

La frase sale siempre que el cobro sigue pendiente al volver de Mercado Pago. Lo que el cliente
recibe después:

| contacto del cliente | pago aprobado | pago rechazado | sigue pendiente |
|---|---|---|---|
| teléfono y correo | 1 WhatsApp y 1 correo | nada | nada |
| sólo teléfono | 1 WhatsApp | nada | nada |
| sólo correo | 1 correo | nada | nada |
| ni teléfono ni correo | nada | nada | nada |

El ticket ya decía que sin teléfono ni correo no hay aviso. Lo que añade la medición: **si el pago
se rechaza no se avisa a nadie, tenga el contacto que tenga.** El correo, además, depende de que la
factura automática y su correo estén encendidos en la plataforma (aquí lo estaban).

### 4 · De paso: la página de resultado pinta el importe en crudo al cliente

En los cuatro estados sale «1419.87 EUR». Es el formato que SCRUM-931 retiró de lo que lee el
cliente, y no está entre los once sitios de SCRUM-1436 (hallazgo 4). Fichero del carril J2.

## Los textos: ya están firmados, no hay nada que redactar

El comentario 18285 de este ticket (cuenta de Luis, 6-oct-2026) firma los tres. La decisión del
fundador en SCRUM-1436, comentario 18734, dice que una firma de cualquiera de los dos jefes vale
para los dos carriles. La etiqueta `sin-firma` del ticket estaba caducada.

Contra lo medido:

- **«Ahora mismo no se puede pagar con Mercado Pago. Contacta con el profesional.»** No nombra al
  negocio como causa, que es lo que la medición pide. Su cierre es, letra por letra, el de la frase
  de cobro vencido de la misma página.
- **El 502 se queda como está**, dentro de la página de la casa.
- **«Tu pago está siendo procesado.»** El recorte se sostiene: la promesa que quita falla en 9 de 12.

## Lo que NO lleva

- Ningún cambio de código. Construirlo es del carril J2, y el propio 18285 pone el límite: si hay
  que cambiar cómo se decide el 503 o el 502, es flujo de cobro y se para.
- Nada visto en yaqu.app, ni si el token de la plataforma existe en producción.
- El aviso al cliente cuando el pago se rechaza: es una decisión de producto, no un texto.
