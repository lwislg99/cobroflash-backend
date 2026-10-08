# SCRUM-1509 · El recordatorio de FACTURAS no tiene el mismo defecto que el de presupuestos — medido, sin arreglar nada

**Medido contra:** `origin/main` = `fc639ef96164b56ae99c129b7202c56c66abdaf4` · 2026-10-08T01:20:37Z

A9: comprobación → `docs/master/evidencias/SCRUM-1509b/medir.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA:** no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow. Entran este
registro y `docs/master/evidencias/SCRUM-1509b/` (sonda, guion y su salida). Nada contra producción ni staging:
base falsa en memoria y `WHATSAPP_DRY_RUN=1`.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j2`, SCRUM-1498). Se siguió porque el
encargo es medir. El carril se aplicó a mano y se comprobó: `node scripts/carriles.mjs de
src/modules/billing/domain/invoiceReminder.service.ts` → **J2** (`dos-equipos.md:120`, que lo nombra); control
que distingue: `src/modules/quotes/domain/reminder.service.ts` → **S1** (`:136`).

## 0 · La respuesta corta

| Pregunta | Recordatorio de FACTURAS, medido | Recordatorio de presupuestos (c.18879) |
| --- | --- | --- |
| ① ¿Se escribe el candado aunque el envío se haya bloqueado? | **No.** Bloqueado → 0 candados pedidos → sale al día siguiente | Sí, se escribe siempre |
| ② ¿Se le pasa el cliente, se le evalúa el tope por cliente y día? | **Sí.** El destino pregunta el tope con ese cliente en cada plantilla | No, nunca |
| ③ Con la escritura del candado rota, 30 días | **60** (1 factura) · **90** (2 o más del mismo cliente) · control **2** | 48 de 48 pasadas |

**No es el mismo defecto.** El recordatorio de facturas YA tiene las dos piezas que se le piden a S1 en c.18881
(pasar el cliente, y no cerrar el candado si el envío se bloqueó). Y con las dos puestas **sigue mandando 60**:
el tope es 3 por cliente y día y este cron manda como mucho 2 al día por factura, así que con una factura el
tope se pregunta 60 veces y no bloquea ninguna.

Lo que eso dice del arreglo pedido a S1: las dos piezas hacen lo que prometen (no se pierde ningún recordatorio
legítimo, y el tope pone techo), pero **el techo es «el tope, todos los días», no «uno»**. No sustituyen al
candado.

## 1 · El instrumento y sus controles (corridos antes de cada número)

`sonda-facturas.cjs` carga los módulos compilados y lee todo en el DESTINO: lo que habría ido a Meta (el buzón
de salida del dry-run), el `where` con que `whatsapp.js` pregunta cada tope (lleva `customerId` o no lo lleva) y
las filas que pide escribir. `medir.cjs` corre los controles primero y sale 1 sin medir si alguno no da lo suyo.
Ningún número esperado está escrito a mano: salen del tope leído en `dist` (**3**; comercio **100**) y de las
pasadas. Salida entera: `salida-medir.txt` (22 casos, 22 cuadran).

| Control | Esperado | Salió |
| --- | --- | --- |
| cero: sin pasadas | 0 envíos, 0 preguntas de tope, 0 candados, 0 filas | 0 / 0 / 0 / 0 |
| el instrumento VE un envío al que no se le pregunta el tope por cliente (presupuestos, sólo ejecutado) | 0 preguntas con cliente, 1 de comercio | 0 y 1 |
| la mutación en memoria (quitar el cliente) sustituye lo que dice | 2 de 2, y 0 preguntas con cliente | 2 de 2, 0 |
| EL QUE MANDA: recordatorio legítimo, todo sano | salen 2 (7 d y 14 d), 2 candados escritos | 2 y 2 |
| el guion tiene dientes: corrido con el tope a 1 por entorno | sale 1 | salió 1, con 5 casos y 6 valores que no cuadran |

Reproducido además lo de la antecesora con SU sonda (`SCRUM-1508/sonda.cjs`): 2 / 60 / 2 / 60.

## 2 · Lo medido

**① El candado y el bloqueo** (tope 3):

| Caso | Salen | Candado |
| --- | --- | --- |
| el cliente ya recibió 3 plantillas hoy · 1 pasada | 0, dos bloqueos `customer_daily_cap` | **0 pedidos** |
| el mismo · 3 pasadas | 0, **2**, 0 — sale al día siguiente | 2 escritos |
| el cliente ya recibió 2 hoy · 3 pasadas | 1, 1, 0 | 2 escritos |
| el comercio en su tope de 100 · 2 pasadas | 0, 2 | 2 escritos |
| contrafáctico sin cliente, 3 plantillas hoy | 2 (el tope no se pregunta) | 2 escritos |

**② El cliente:** hoy, 2 preguntas de tope con el cliente 50 y las 2 filas llevan el cliente 50. Sin él
(contrafáctico): 0 preguntas y filas con cliente `null`.

**③ El número, con el candado roto, 30 pasadas diarias:**

| Caso | HOY (con cliente) | Contrafáctico sin cliente | Control sano |
| --- | --- | --- | --- |
| 1 factura | **60** (0 bloqueos) | 60 | 2 |
| 2 facturas del mismo cliente | **90** (30 bloqueos) | 120 | 4 (3 hoy, la cuarta mañana) |
| 3 facturas del mismo cliente | **90** (90 bloqueos) | — | — |
| 2 facturas, rotos candado Y registro de WhatsApp | **120** (el tope se pregunta 120 veces y no ve nada) | — | — |
| 1 factura de 7 días (la edad real del primer aviso) | **53** (7 días a 1, 23 a 2) | — | 2 (día 0 y día 7) |

El «60» sale de una factura de 30 días, que manda el aviso de 7 y el de 14 el mismo día. Con la edad real son 53.

**④ Caminos a los que el tope no se les pregunta** (no son plantilla; el tope cuenta filas `template`):

| Caso | Salen | Tope preguntado |
| --- | --- | --- |
| ventana de 24 h abierta en cada pasada, candado roto | 60 mensajes con botón | 0 |
| factura sin cobro (texto libre), candado roto | 60 en dry-run, **0 filas** | 0 |

## 3 · Tres cosas vistas de paso, sin tocar

1. **Cada bloqueo escribe un aviso en la ficha del cliente** (`wa_send_failed`): 30 en 30 días con 2 facturas y
   el candado roto, 90 con 3. Es el mismo ruido que c.18879 midió en presupuestos.
2. **El envío por ventana pide DOS filas por mensaje** (120 para 60): una la escribe `sendWhatsAppCtaUrl` (sin
   cliente) y otra `sendWhatsAppWindowFirst`. Son `service`, no cuentan en los topes de plantilla. No medí qué
   lee esas filas.
3. **Con el candado roto, el recordatorio se come el cupo del cliente**: con 2 facturas gasta las 3 plantillas
   del día, todos los días. Que eso bloquee OTRA plantilla legítima a ese cliente se deduce; no lo ejecuté.

## 4 · Lo que NO se midió

- Contra Postgres real: nada. Base falsa en memoria; `dist` es `tsc --noCheck`.
- La rama de texto libre fuera de ventana: en dry-run siempre «sale»; Meta la rechazaría. El 60 de esa fila es
  «intentos», no entregas.
- Cada cuánto falla la escritura del candado: sigue sin dato. No se afirma que pase hoy.
- El contrafáctico «sin cliente» es el módulo compilado cargado en memoria con dos sustituciones; ningún fichero
  se modificó.
- No corrí ninguna tanda de tests: no hay cambio de código que probar.
- `prisma generate` escribió en el `node_modules` del checkout compartido (el árbol anidado no tiene el suyo).

## 5 · Salidas, con su coste. Ninguna elegida, ninguna construida

No hay GO para `invoiceReminder`. Lo que la medición deja a la vista:

- Las piezas (a) y (b) de c.18881 **ya están** en facturas: aquí no hay nada que «conectar».
- Lo que queda es el candado solo: se envía, se escribe después, y el fallo de esa escritura se registra en
  consola y nada más. Es la salida A/B de c.18870, no el arreglo de presupuestos.
- Un segundo cinturón posible sin escritura nueva: antes de enviar, mirar si el registro de WhatsApp ya tiene
  una fila de esa factura. Coste: depende del mismo registro (con los dos rotos, 120 de 120) y no cubre el texto
  libre, que no deja fila.

**Error propio:** el primer intento de construir `dist` llamó a `./node_modules/.bin/`, que en un árbol anidado
no existe; falló en alto (127) y no dio ningún número. **Y un segundo:** conté los casos que no cuadran con el tope a 1
sobre una salida recortada con `head` y escribí 3; sin recortar son 5. Es la frase de A10 de la salida recortada,
y la comprobación es el propio guion, que imprime su recuento en la última línea.
