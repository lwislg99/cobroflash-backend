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

---

# SCRUM-1509c · El tope anti-abuso de plantillas: qué lee, de quién es, y cuándo no protege — medido, sin arreglar nada

**Medido contra:** `origin/main` = `c63a527ebb5b33450e40f0bef5c28e0791ab6ea8` · 2026-10-08T01:35:29Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1509c/contrafactico.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA.** No se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow; entran este
tramo y `docs/master/evidencias/SCRUM-1509c/`. Nada contra producción ni staging. `dist` es `tsc --noCheck` de
`d00c97509`; entre ese commit y el ancla no cambió nada de `src/integrations`, `src/modules/messaging` ni
`src/core/config` (`git diff --stat`, vacío). No se corrió `prisma generate`. El hook de arranque dijo «SIN
IDENTIDAD» (SCRUM-1498); se siguió porque el encargo es medir.

## 0 · La respuesta corta a las tres preguntas

**① Qué lee.** Dos recuentos sobre la tabla del registro de mensajes (`prisma.whatsAppMessage.count`,
`whatsapp.ts:376` y `:392`), y compara cada uno con su tope (100 por comercio y día, 3 por cliente y día, leídos
en `dist`). El `where` literal que llega a la base:

    comercio: {"merchantId":7,"type":"template","createdAt":{"gte":<medianoche local del proceso>},"waMessageId":{"not":null}}
    cliente:  lo mismo más "customerId":50

Las filas que cuenta las escribe el propio envío **después** de que Meta conteste, sin esperarlas, y con el
error tragado dos veces (`whatsappLog.service.ts:32-52` por dentro y `.catch(() => {})` en `whatsapp.ts:469`).

**Por qué una escritura fallida lo desactiva en vez de cerrarlo:** porque no lo desactiva. El tope **se
pregunta** las 20 veces de 20 y la base le contesta `0,0,0,0,0,0,0,0,0,0` (sano: `0,1,2,3,3,3,3,3,3,3`). Para el
tope, «la fila no se escribió» y «no se ha mandado nada» son la misma respuesta. Cuando decide no hay ningún
error que atrapar: el error ocurrió en el envío ANTERIOR, cuando el mensaje ya había salido, y nadie se quedó
con él. Hay una segunda puerta, distinta y declarada: si lo que falla es la LECTURA, el `catch` de
`whatsapp.ts:404-406` deja pasar («Best-effort: si la BD falla, NO se bloquea», `:367`).

**② De quién es.** `whatsapp.ts` y `whatsappLog.service.ts` son de **J2**, por fila que los nombra
(`dos-equipos.md:124`). Los VALORES de los topes viven en `src/core/config/env.ts`, que es de **S1**. Detalle y
controles en §4. No se paró por carril; tampoco se tocó nada.

**③ ¿Es decorativo cuando hace falta? Sí, y más de lo que decía el ticket.** En las 9 condiciones medidas en
que el tope tenía algo que parar: **0 bloqueos sobre 200 envíos.** En las mismas tandas con todo sano bloquea 7
de 10 (por cliente) y 20 de 120 (por comercio). Tres de las nueve son la base fallando (escritura, lectura, las
dos); **cinco son con la base sana** (§2-D). Y en la misma función, unas líneas más arriba (`whatsapp.ts:360`), la comprobación de la
baja hace lo contrario: si su lectura falla, salen **0 de 10** (cierra, SCRUM-1262).

El máster lo llama de otra manera: «tope duro 3 mensajes-iniciados-por-negocio/cliente/día (… `F2-early`).
Violar esto = ban del número = producto muerto» (`docs/YAQU_MASTER.md:320`). El código dice «best-effort».
`F2-early` no lo nombra ningún fichero de `src/` ni de `tests/` (sólo el máster; control con un nombre
inventado: 0).

## 1 · El instrumento y sus controles

`docs/master/evidencias/SCRUM-1509c/medir.cjs <dist>` ejecuta `sendWhatsAppTemplate` de `dist` tal cual y dobla
dos cosas: la base (en memoria, CON estado, que evalúa el `where` que le pidan y lanza si le piden un operador
que no modela) y el transporte de axios (no sale un byte; cada petición hacia Meta se anota y se contesta
dentro). **No usa el modo dry-run**: cuenta peticiones que llegan al transporte, no filas pedidas. Destino del
rango imposible (`34000000077`). 35 casos; 33 llevan esperado derivado de los topes leídos en `dist`; **33
cuadran**; 2 son modelo y van sin esperado. Salida completa: `salida-medir.txt` (57 líneas, sin recortar).

| control, corrido antes de los números | esperado | salió |
| --- | --- | --- |
| A0 cero: ningún envío | 0 peticiones, 0 preguntas, 0 filas | 0 / 0 / 0 |
| A1 positivo: 10 al mismo cliente, todo sano (el instrumento VE el bloqueo) | 3 salen, 7 bloqueadas | 3 y 7 |
| A2 positivo del tope de comercio: 100 filas de otro cliente | bloqueado `daily_cap` | bloqueado |
| A3 su borde: 99 filas | sale | sale |
| el guion con el tope esperado forzado a 1 (no toca el producto) | sale en rojo | salida 1, **3** casos `ROJO` de 33 (contados con `grep -c` sobre el fichero entero; en la salida buena, 0) |
| la sonda de la casa (SCRUM-1508, dry-run), repetida | 3 y 7 · 10 y 0 | 3 y 7 · 10 y 0 |

## 2 · Lo medido

**B · Qué campos deciden** (3 filas prellenadas, 1 envío; se cambia UN campo en las tres):

| se cambia | ¿sigue bloqueando? | o sea |
| --- | --- | --- |
| nada (positivo) | sí | — |
| `waMessageId` a `null` | **no** | lo lee: sin id de Meta la fila no cuenta |
| `type` a `service` | **no** | lo lee |
| `customerId` a otro, o a `null` | **no** | lo lee |
| `merchantId` a otro | **no** | lo lee |
| `createdAt` a ayer 23:59 | **no** | lo lee, por día natural del proceso |
| `createdAt` a hoy 00:00:00.000 | sí | el borde entra |
| `status` a `failed` o a `delivered` | sí | **no lo lee** |
| `templateName`, `relatedType`/`relatedId`, `error` | sí | no los lee |

**C · La base falla** (10 plantillas al mismo cliente el mismo día, salvo donde se dice):

| caso | peticiones a Meta | bloqueos | preguntas al tope | filas escritas | traza en consola |
| --- | --- | --- | --- | --- | --- |
| A1 control sano | 3 | 7 | 20 | 10 de 10 | 0 |
| **C1 falla la ESCRITURA** (el caso del ticket) | **10** | **0** | 20, todas contestan 0 | 0 de 10 | 10 × `recordWaMessage omitido` |
| **C2 falla la LECTURA** | **10** | **0** | 10, todas lanzan | 10 de 10 | 10 × `Error comprobando topes` |
| C3 fallan las dos | **10** | **0** | 10 | 0 de 10 | — |
| C4 contraste: falla la lectura de la BAJA | **0** | 10 (`baja_no_comprobable`) | 0 | — | — |
| C5 los dos topes: 120 envíos a clientes distintos, sano | 100 | 20 (`daily_cap`) | 220 | 120 | — |
| **C6 lo mismo, falla la escritura** | **120** | **0** | 240 | 0 de 120 | — |

El tope de comercio cae por la misma escritura: no es una segunda línea detrás del tope por cliente.

**D · La base va bien y el tope tampoco para:**

| caso | peticiones a Meta | bloqueos | por qué |
| --- | --- | --- | --- |
| **D1** 10 a la vez (`Promise.all`), base sana e instantánea | **10** | 0 | las 10 preguntan antes de que exista ninguna fila |
| **D2** seguidos, la escritura tarda 50 ms y Meta nada | **10** | 0 | la fila anterior aún no está cuando pregunta el siguiente |
| D3 seguidos, escritura instantánea, Meta 30 ms | 3 | 7 | (control: como A1) |
| D4 *[modelo]* escritura 100 ms, Meta 30 ms | 7 | 3 | latencias inventadas |
| D5 *[modelo]* escritura 300 ms, Meta 30 ms | 10 | 0 | latencias inventadas |
| **D6** Meta contesta 200 sin id de mensaje | **10** | 0 | la fila se escribe y no cuenta |
| **D7** Meta no contesta (plazo vencido) | **10** | 0 | el mensaje PUDO salir (`sin_respuesta`, SCRUM-1477); la fila va sin id y no cuenta |
| **D8** Meta contesta 500 | **10** | 0 | igual |
| D9 Meta contesta 400 | 10 | 0 | no salió: no contarlo es lo correcto. No entra en el recuento de ③ |
| D10 5 a las 23:58 y 5 a las 00:01 | 6 | 4 | día natural: 6 en 3 minutos. Es diseño, no entra en ③ |

Los 200 de ③ son C1+C2+C3+C6+D1+D2+D6+D7+D8 = 10+10+10+120+10+10+10+10+10.

**E · A quién no se le pregunta:** sin cliente en la llamada, 10 de 10 y 0 preguntas por cliente; sin comercio,
10 de 10, 0 preguntas y 0 filas.

## 3 · Los contrafácticos (en memoria; no son un arreglo ni una propuesta de código)

`contrafactico.cjs <dist> <variante>` cambia el texto de `dist/integrations/whatsapp.js` al cargarlo en ese
proceso y corre el mismo guion. Exige un número exacto de sustituciones y sale 2 sin medir si no lo encuentra.

| variante | sustituciones | casos que cambian (de 33) | **el caso del ticket, C1** |
| --- | --- | --- | --- |
| `lectura-cerrada`: el `catch` de la lectura bloquea | 1 de 1 | 2: C2 y C3 pasan de 10 a **0** | **sigue en 10 de 10** |
| `escritura-esperada`: se espera la fila del envío que salió | 2 de 2 | 1: D2 pasa de 10 a **3** (y los modelos D4 y D5, a 3) | **sigue en 10 de 10** |

**Ninguna de las dos toca el 10 de 10 que abrió el ticket.** La tercera salida del enunciado («que el tope
falle CERRADO: si no se puede comprobar, no se envía») cierra la lectura rota, no la escritura rota: con la
escritura rota el tope SÍ se puede comprobar, y contesta cero. Y ninguna toca D1 (a la vez), D6, D7 ni D8. Lo
que haría falta para C1 —saber, antes de enviar, que el envío anterior no dejó fila— no existe en el código y
no se ha construido ni simulado aquí.

## 4 · De quién es cada fichero (`node scripts/carriles.mjs de <ruta>`)

| ruta | dice | por |
| --- | --- | --- |
| `src/integrations/whatsapp.ts` (decide y pide la escritura) | **J2** | `dos-equipos.md:124`, fila que lo nombra |
| `src/modules/messaging/domain/whatsappLog.service.ts` (escribe y traga) | **J2** | `:124`, fila que lo nombra |
| `src/core/config/env.ts` (los valores 3 y 100) | **S1** | `:136`, patrón `src/core/**` |
| control, se sabe de J2: `billing/domain/invoiceReminder.service.ts` | J2 | `:120` |
| control, se sabe de S1: `modules/system/audit.service.ts` | S1 | `:136` |
| control, se sabe de S1: `quotes/domain/reminder.service.ts` | S1 | `:136` |
| control, ruta que no existe: `src/no/existe/inventado-zz.ts` | S1 | `:136`, patrón `src/**` |
| `prisma/schema.prisma` | nadie lo reclama | regla 40: se lee |

Lo que enseña el control de la ruta inventada: «S1» es también lo que la herramienta dice de cualquier cosa
bajo `src/` que nadie nombre, así que un «S1» es más débil que un «J2». Los dos «J2» de arriba salen de una fila
que nombra el fichero.

## 5 · Vistas de paso, sin tocar

1. **A 4 de las 10 llamadas de fuera no se les pregunta el tope por cliente.** Censo por AST
   (`censo-llamadas.cjs`; 320 ficheros, 266.254 nodos; control con un nombre inventado: 0 llamadas): 11 llamadas
   a los dos envíos que pueden mandar plantilla, una interna de `whatsapp.ts`. Las 11 pasan comercio. 4 no pasan
   `log`: `whatsappNotifications.ts:35` (confirmación de pago, al cliente), `:171` (aviso al profesional, que no
   es un cliente), `reminder.service.ts:47` (la de c.18870) e `invoicesAdmin.routes.ts:766` (recordatorio manual
   de cobro). El instrumento las da por «esparcido» porque no ve dentro de `...build…()`; que eso es «no» sale de
   leer las cuatro y de que `whatsappTemplates.ts` no contiene ningún `log:` (0). **Es lectura, no ejecución**,
   salvo presupuestos (c.18879).
2. Un envío bloqueado deja una fila `failed` sin id (C4: 10 de 10): no cuenta en ningún tope.
3. Ningún fichero de `tests/` nombra la traza «Error comprobando topes» (0; en `src/`, 1). Cuatro nombran los
   topes (`scrum116`, `scrum126`, `scrum1465b`, `scrum1478`): **no leí sus cuerpos**, sólo que los nombran.

## 6 · Lo que NO se midió

- **Postgres real.** En particular, cómo falla Prisma de verdad: aquí la escritura «lanza» al momento; una base
  colgada que no contesta no se ha probado, y en ese caso la lectura del tope se quedaría esperando.
- **Cada cuánto falla esa escritura o esa lectura: no hay dato.** No se afirma que pase hoy.
- Si algún llamador real manda a la vez o en ráfaga al mismo cliente (D1, D2): medida la propiedad, no su uso.
- Las latencias de D4 y D5 son inventadas. La zona horaria del proceso en producción (D10; en esta máquina la
  medianoche local son las 23:00Z).
- `sendWhatsAppWindowFirst` no se ejecutó aquí (sí en c.18886).
- Ninguna tanda de tests completa: no hay cambio de código. Sí los de registro (§7).

## 7 · Errores propios

- La primera pasada de `contrafactico.cjs` no enseñó su línea de control («N sustituciones de N»): la escribía
  con `console.log`, que `medir.cjs` ya había silenciado. Lo delató que el filtro de la salida no la trajera
  mientras los resultados sí habían cambiado. Ahora va por `stdout` directo, y se repitieron las dos variantes
  (1 de 1 y 2 de 2 a la vista). La comprobación es el propio guion, que sale 2 con «CIEGO» si no sustituye.
- El censo de llamadas no sabe decir si un `...build…()` trae `log`; lo imprime como «esparcido» y sigue
  haciéndolo. La cifra «4 de 10» lleva una lectura mía encima y está dicho en §5.
- Corregí dos frases de este registro pasando el texto a `node -e` por bash: la consola ejecutó lo que iba
  entre acentos graves y dejó un paréntesis vacío en el fichero. Lo delataron los «command not found» y el
  recuento de sustituciones (0 y 1); arreglado con la herramienta de edición. Es la línea del 1-oct de las
  cicatrices de J2, por tercera vez, y sigue sin comprobación posible desde el repositorio.

Reproducir: `tsc --noCheck`, `node docs/master/evidencias/SCRUM-1509c/medir.cjs dist`, y
`node docs/master/evidencias/SCRUM-1509c/contrafactico.cjs dist lectura-cerrada` (o `escritura-esperada`).

---

# SCRUM-1509e · La ruta manual del recordatorio de factura: quién puede llamarla y cuántas veces — medido, sin arreglar nada

**Medido contra:** `origin/main` = `8518dc7a16164530863d657cb0f2f817a4691d78` · 2026-10-08T02:08:30Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1509e/medir.cjs`

J1 (relevo, sesión `jv-j1`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`, Jira
c.18910). **Es EJECUCIÓN y LECTURA.** No se ha tocado ningún fichero de `src/`, test, plantilla, texto ni
workflow; entran este tramo y `docs/master/evidencias/SCRUM-1509e/`. Nada contra producción ni staging. `dist`
es `tsc --noCheck` del mismo commit del ancla. No se corrió `prisma generate`. El hook de arranque dijo «SIN
IDENTIDAD» (SCRUM-1498); se siguió porque el encargo es medir.

Son las dos cosas que c.18907 declaró sin medir: qué autenticación hay delante de
`POST /admin/invoices/:id/send-reminder` (`src/modules/system/app/routes/invoicesAdmin.routes.ts:732`; la
llamada a la plantilla está en `:766`) y si hay límite de peticiones.

## 0 · La respuesta corta

**Quién puede llamarla: sólo una sesión iniciada del propio comercio con rol `admin`** — el titular o un
miembro del equipo con ese rol — **y sólo sobre una factura de ese comercio.** Un tercero sin sesión no llega:
401 y 0 plantillas, por las cuatro vías probadas. Es el pie del propio comercio en el acelerador.

**Cuántas veces: no hay límite de peticiones.** 120 seguidas del titular sobre la misma factura dan 0
respuestas 429 y **100 plantillas al mismo cliente el mismo día**; las 20 restantes las para el tope de
COMERCIO (100, leído en `dist`), que es el único techo. Con el tope por cliente (3) saldrían 3. Al destino se le
pregunta el tope de comercio 120 veces y el de cliente 0.

**Dos matices que mueven «sólo el comercio», y el segundo no está medido:**

1. La ruta no mira el plan: un titular con la prueba vencida manda igual (A10: 200 y 1 plantilla).
2. **Ser «comercio» no pide nada más que un correo.** `POST /auth/register` es público (leído: `auth.routes.ts:33`,
   con límite de 5 por 15 min por IP y correo). **No ejecuté** si una cuenta recién creada llega a tener una
   factura con cobro y un cliente con teléfono, que es lo que hace falta para que la ruta mande plantilla (sin
   cobro va a texto libre). Si llega, cualquiera con un correo tiene 100 plantillas al día por cuenta, desde el
   número de la casa, a los teléfonos que él escriba. Eso ya no es de esta ruta: es del alta.

## 1 · La cadena, leída de la pila de la app cargada

No del texto de `app.ts`: de `app.router.stack` con `dist/app.js` cargado (102 capas). Casan 8 con la ruta; una
ruta inventada casa 6 (control). Las 2 que sólo ve esta zona:

| capa | qué es | dónde está en el fuente |
| --- | --- | --- |
| 45 | `requireAuth`, montada en `/admin` | `src/app.ts:377` |
| 50 | el router de facturas, montado en `/admin/invoices` **sin nada interpuesto** | `src/app.ts:572` |
| dentro | la ruta: `requireRole(admin)` y el manejador, en ese orden | `invoicesAdmin.routes.ts:732` |

Las 6 comunes: la cabecera de `Referrer-Policy`, los dos lectores de cuerpo, `jsonError`, el estático y el 404
final. En el router de facturas no casa ninguna capa que no sea la ruta (0). **Ninguna de las 8 es un limitador.**

`requireAuth` (`src/core/http/authMiddleware.ts`) sólo lee la cookie `pf_session`. El comercio y el rol salen de
la fila de sesión, no de la petición. La cookie se pone `HttpOnly; SameSite=Lax` y `Secure` en producción, 30
días (leído en `setCookie`, no ejecutado).

## 2 · Lo medido (18 casos, 18 cuadran; salida entera en `evidencias/SCRUM-1509e/salida-medir.txt`)

| caso | respuesta | plantillas |
| --- | --- | --- |
| K+ el titular, su factura (POSITIVO obligatorio) | 200 enviado | 1 |
| K0 el titular, una factura que no existe (CERO) | 404 | 0 |
| A1 sin credencial | 401 `not_authenticated` | 0 |
| A2 la credencial del titular por otra vía (Bearer, cabecera, query, cuerpo) | 401 `not_authenticated` | 0 |
| A3 cookie de nadie · A4 sesión caducada · A5 enlace sin canjear · A6 miembro suspendido | 401 `session_expired` | 0 |
| A7 miembro con rol `tecnico` | 403 | 0 |
| A8 el titular de OTRO comercio sobre esta factura | 404 | 0 |
| A9 miembro con rol `admin` | 200 enviado | 1 |
| A10 titular con la prueba vencida | 200 enviado | 1 |
| A11 con `Origin` y `Referer` de otro sitio · A12 como la manda un formulario | 200 enviado | 1 |
| A13 por GET | 404 | 0 |
| **R1 el titular, 120 seguidas, misma factura** | **100 enviadas, 20 `daily_cap`, 0 de 429** | **100** |
| R+ POSITIVO del contador de 429: `/auth/login`, 7 seguidas, mismo correo | 5 pasan, **2 de 429** | 0 |
| R0 CERO del contador de 429: `/auth/login`, 7 correos distintos | 7 pasan, 0 de 429 | 0 |

En R1 la factura recibe 2 marcas de fecha y luego ninguna: desde la tercera pulsación no queda escrito nada en
ella que diga que se ha reclamado otra vez (coincide con lo que c.18907 vio con 10).

**A11 y A12 dicen que el servidor no mira de dónde viene la petición.** Lo único que impide que otra web la
dispare con la sesión del comercio es el `SameSite=Lax` de la cookie, que lo aplica el navegador. No hay
navegador en esta medición: está leído, no ejecutado.

**El rojo:** con `--comercio-esperado 1` el guion sale 1 con R1 en rojo (1 de 18;
`salida-rojo-comercio-esperado-1.txt`). Los casos A no los vi en rojo uno a uno: su contraste es K+, que con la
misma petición y otra cookie sí manda.

## 3 · Lo que NO se midió

- **La app desplegada.** Todo es `dist` local con la base en memoria; delante de producción hay un proxy
  (Cloudflare, Railway) que podría limitar por su cuenta y aquí no se ve. `NODE_ENV` era `development`.
- Postgres real y peticiones A LA VEZ: las 120 van una detrás de otra. La carrera entre contar y escribir es de
  c.18894, no de aquí.
- El alta de punta a punta (matiz 2 de §0), ni si el comercio demo tiene alguna entrada pública.
- Un navegador de verdad para `SameSite`, y si algún subdominio de `yaqu.app` sirve contenido de terceros.
- Las otras 17 rutas del mismo router, y `resend-whatsapp` (`:645`), que manda por otra función.
- La base en memoria contestó sin modelarlo a `merchant.findUnique` y `teamMember.findUnique` (12 veces cada
  una, todas de `/auth/login`).
- Ninguna tanda de tests completa: no hay cambio de código.

## 4 · Errores propios

- Busqué el fichero donde el encargo lo nombraba de memoria (`src/modules/invoicing/`); no está ahí, está en
  `src/modules/system/app/routes/`. Lo dijo el `wc` con su error, no un cero. Sin comprobación que generalice.
- La corrida salió verde entera a la primera. No me fié hasta verla caer con el tope forzado; aun así sólo vi
  en rojo R1 (dicho en §2).

Reproducir: `tsc --noCheck` y `node docs/master/evidencias/SCRUM-1509e/medir.cjs dist`.
# SCRUM-1509d · Los cuatro llamadores a los que no se les pregunta el tope por cliente — EJECUTADOS, sin arreglar nada

**Medido contra:** `origin/main` = `fae0553295d655d5579e3a1fc1c93b6f468c0149` · 2026-10-08T01:51:08Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1509d/medir.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA:** no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow. Entran este
tramo y `docs/master/evidencias/SCRUM-1509d/` (guion y sus dos salidas). Nada contra producción ni staging: base
en memoria y transporte doblado. No se corrió `prisma generate`; `dist` con `tsc --noCheck`.

El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j2`, SCRUM-1498). Se siguió porque el
encargo es medir. La medición se hizo con `dist` de `c1bad3c34`; entre ese commit y `fae055329` no cambia ningún
fichero de `src/` (`git diff --stat` vacío sobre `src`), sólo el registro y las evidencias del tramo «c».

## 0 · La respuesta corta

Lo que c.18894 dijo LEÍDO queda EJECUTADO: de las llamadas que cada uno de los cuatro hace llegar a
`sendWhatsAppTemplate`, **0 llevan cliente** (40 de 40 sin cliente), y al destino **no se le pregunta el tope
por cliente ni una vez** (0 preguntas; con cliente en la llamada, el mismo instrumento cuenta 10).

Diez veces al mismo cliente el mismo día, todo sano, tope por cliente leído en `dist` = **3**:

| llamador | plantillas que salen HOY | con el tope por cliente | de quién es |
| --- | --- | --- | --- |
| `whatsappNotifications.ts:35` · `sendPaymentConfirmation` | **10** | 3 (7 bloqueadas) | J2 |
| `whatsappNotifications.ts:171` · `notifyMerchantAlert` | **10** | **10**: no hay cliente que ponerle | J2 |
| `reminder.service.ts:47` · el cron de presupuestos, una pasada | **10** | 3 (7 bloqueadas) | S1 |
| `invoicesAdmin.routes.ts:766` · `POST /admin/invoices/:id/send-reminder` | **10** | 3 (7 bloqueadas) | J1 |

Los cuatro no son la misma cosa:

1. **`:35` no lo llama nadie.** 0 llamadores en `src/`, `tests/`, `public/` y `scripts/` (el hermano
   `sendPaymentConfirmationInvoice` sale en 4 ficheros con la misma búsqueda), y está declarado como export sin
   consumir en `scripts/_sin-consumir-declarados.json:43` (SCRUM-1185, carril J2). El 10 es de la función
   ejecutada a mano: **en el producto, hoy, por ahí salen 0**. Además su firma no recibe cliente: no tiene qué pasar.
2. **`:171` no manda a un cliente: manda al profesional.** No hay cliente cuyo tope preguntar, así que «con el
   tope por cliente» sigue en 10. Lo que sí se le pregunta es el tope de COMERCIO, y **se lo come**: 120 avisos
   con la ventana cerrada → 100 plantillas y 20 bloqueadas; y con el cupo gastado en avisos al profesional, una
   plantilla a un cliente ya no sale (`daily_cap`). Con la ventana abierta, 10 avisos gastan 0 plantillas.
3. **`:47` y `:766` son los dos que mandan a un cliente sin preguntar.** El caso verosímil: el cliente ya recibió
   hoy sus 3 plantillas por caminos que sí cuentan, y llega una más — **hoy sale (1), con el tope no (0)**, por
   el cron y por la ruta.

## 1 · El instrumento y sus controles

`medir.cjs` ejecuta el LLAMADOR de `dist` (la función exportada, el cron, o la ruta montada en un express y
pedida por HTTP), no `sendWhatsAppTemplate` a pelo. Dobla la base (en memoria, con estado) y el transporte de
axios, y cuenta peticiones por tipo; no usa dry-run. Una envoltura sobre el export ve cada llamada que llega: en
la pasada HOY sólo mira si trae cliente; en la pasada CON TOPE le pone, en memoria, el cliente dueño de ese
teléfono. **Esa segunda pasada no es un arreglo ni una propuesta de código.** Los esperados salen del tope leído
en `dist`. 22 casos, 22 cuadran (`salida-medir.txt`).

| control | esperado | salió |
| --- | --- | --- |
| CERO: los cuatro sin nada que mandar | 0 plantillas, 0 llamadas, 0 preguntas | 0 / 0 / 0 (y el cron sí leyó: 1 lectura) |
| POSITIVO obligatorio: la misma envoltura, con cliente en la llamada | 3 y 7 bloqueadas | 3 y 7 |
| POSITIVO con un llamador real del mismo fichero que sí pasa cliente (`:105`) | 3 y 7 | 3 y 7 |
| POSITIVO del tope de comercio (100 filas de otro cliente, 1 envío) | bloqueado | bloqueado |
| CERO de la envoltura: CON TOPE, 10 presupuestos de 10 clientes | 10, 0 bloqueadas | 10 y 0 |
| la ruta con rol `tecnico` | 403, 0 llamadas | 403 y 0 |
| la ruta sin cobro (va por texto) | 0 plantillas, 1 de otro tipo | 0 y 1 |
| el guion con el tope esperado forzado a 1 | rojo | salida 1, 5 casos en rojo de 22 (0 en la buena) |
| el guion con un esperado sobre una clave que no existe | rojo | salida 1, K0 en rojo |

El guion sale 2 («GUION MUDO») si los positivos no ven ningún bloqueo, si el total de plantillas es 0 o si la
envoltura no se pudo poner.

## 2 · De quién es cada uno (`node scripts/carriles.mjs de <ruta>`)

| fichero | dice | por |
| --- | --- | --- |
| `src/integrations/whatsappNotifications.ts` | **J2** | `dos-equipos.md:124`, fila que nombra el fichero |
| `src/modules/system/app/routes/invoicesAdmin.routes.ts` | **J1** | `dos-equipos.md:118`, fila que nombra el fichero |
| `src/modules/quotes/domain/reminder.service.ts` | **S1** | `dos-equipos.md:136`, patrón `src/**` |
| control: `src/modules/quotes/domain/no-existe-sonda-1509d.ts` | S1 | el mismo patrón `src/**` |
| control: `no-existe-sonda-1509d/x.ts` (fuera de `src/`) | «sin fila en §3: nadie lo reclama» | — |

El J2 y el J1 vienen de filas que nombran el fichero. El S1 del recordatorio viene del cajón `src/**` (una ruta
inventada al lado da lo mismo), así que la herramienta sola no lo prueba; lo que lo sostiene es el texto de esa
fila 136, que enumera «quotes» entre «todo lo demás de `src/`», y que ningún otro renglón de `dos-equipos.md`
nombra `reminder.service` (0 apariciones). Está pedido a S1 en c.18881 y aquí no se ha tocado.

**La ruta `:766` es de J1, no de J2.** No hay ticket abierto por esto desde aquí.

## 3 · Vistas de paso, sin tocar

- El cron marca el presupuesto como recordado **siempre**: en la pasada CON TOPE quedan marcados 10 de 10 con 3
  plantillas fuera. Poner el cliente sin tocar el candado deja 7 recordatorios perdidos para siempre (es la
  segunda pieza ya pedida a S1 en c.18881; aquí sale con número).
- La ruta `:766` ya sabe contar el bloqueo: en la pasada CON TOPE contesta 200 con `sent:false` y el motivo
  `customer_daily_cap` 7 de 7 veces. Su rama de texto (factura sin cobro) sí pasa el cliente.
- Diez pulsaciones seguidas sobre la misma factura salen las 10: la ruta escribe `reminder7SentAt`, luego
  `reminder14SentAt`, y a partir de la tercera no escribe nada y sigue enviando.

## 4 · Lo que NO se midió

- **Cuántas veces pasa de verdad.** Si un cliente llega a tener 10 presupuestos pendientes en una pasada, o si
  alguien pulsa 10 veces: medida la propiedad, no su uso. El caso de «3 ya hoy y una más» es el verosímil, y
  tampoco tiene dato de frecuencia.
- La autenticación y lo que `app.ts` monte delante de `/admin/invoices` (incluido cualquier límite de
  peticiones): el rol y el comercio los pone el guion. La puerta de rol de la propia ruta sí se ejercitó.
- Los 10 sitios que llaman a `notifyMerchantAlert` no se ejecutaron uno a uno: se ejecutó la función.
- Postgres real, envíos a la vez, y los fallos de escritura o lectura (eso es el tramo «c»).
- La base en memoria contestó sin modelarlo, con un valor neutro, a `customerEvent.create` (8 veces: los 8
  bloqueos del cron). Nada más quedó sin modelar.
- Ninguna tanda de tests completa en local: sólo los de registro y `scrum124`. La completa es la de CI (§5).

## 5 · Errores propios

- En la primera versión del guion, el control de cero llevaba un esperado sobre una clave que el resumen no
  tiene (`undefined === undefined`): cuadraba sin mirar nada. Lo vi al releer la salida. Ahora un esperado sobre
  una clave inexistente sale rojo, y se ve con `--clave-fantasma` (salida 1).
- La primera pasada salió verde entera a la primera. No me fié hasta verla en rojo con el tope forzado a 1.

- **El primer obligatorio de este PR salió ROJO, y era mío** (1 de 11.074: `scrum124`, regla 28). `medir.cjs`
  escribía el host de Meta para comprobar que nada salía a otro sitio, y ese test cuenta como «habla con Meta»
  a cualquier `.cjs` del repositorio que lo nombre. Había escrito «no hay cambio de código» y por eso no corrí
  más que los de registro: un guion de evidencias ES código para los tests que barren el árbol. Arreglado en el
  guion, no en el test: ya no nombra el host, lo lee del módulo compilado que habla con Meta. `scrum124` verde
  en local (43 de 43 con los de registro); el rojo lo vi en CI.
- Ese arreglo lo metí pasando una expresión regular por la consola y se comió las barras invertidas: los dos
  guiones dejaron de arrancar. Lo delató el recuento de líneas «cuadra» (0 en los cuatro ficheros de salida),
  no el código de salida, que era 1 igual que en la pasada roja a propósito. Corregido con la herramienta de
  edición. Es la cicatriz de J2 del 1-oct otra vez.

Reproducir: `tsc --noCheck` y `node docs/master/evidencias/SCRUM-1509d/medir.cjs dist` (rojo a propósito:
`--tope-esperado 1` o `--clave-fantasma`).

## 6 · Segunda parte: los avisos al profesional (`notifyMerchantAlert`), sitio por sitio

Encargo del orquestador tras leer §0: si los avisos al profesional se pueden comer el cupo de plantillas del
cliente final. Guion: `avisos.cjs` (20 casos, 20 cuadran; `salida-avisos.txt`). Ejecuta las RUTAS de `dist` por
HTTP —el webhook de entrantes con su firma, y la página pública de Bizum— con la base en memoria y el
transporte doblado.

### 6.1 · ¿Comparten contador? Con el de COMERCIO, sí. Con el del CLIENTE, no.

| pregunta | medido |
| --- | --- |
| ¿La plantilla de un aviso al profesional cuenta en el tope de comercio (100 al día)? | **Sí.** Tras 10 avisos, la pregunta de comercio contesta 10 |
| ¿Cuenta en el tope de algún cliente (3 al día)? | **No.** Tras esos 10 avisos, la pregunta del cliente contesta 0 |
| ¿Puede un aviso dejar sin plantilla a un cliente? | **Sí, por el de comercio:** 120 textos de un cliente → 100 plantillas al profesional y 20 bloqueadas; después, una plantilla a un cliente del mismo comercio no sale (`daily_cap`, la pregunta contesta 100, 0 peticiones) |
| ¿Y al revés? | **Sí:** con 100 plantillas a clientes hoy, el aviso al profesional no sale (0 plantillas) |
| ¿Y si el profesional tiene su ventana de 24 h abierta? | **No hay riesgo:** los mismos 120 avisos salen por texto, gastan 0 plantillas, y la plantilla al cliente sale |

Las dos preguntas leen la misma tabla con el mismo `where` (comercio, tipo plantilla, de hoy, con id de mensaje);
la del cliente añade `customerId`. La fila de un aviso se escribe sin cliente: por eso entra en una y no en la otra.

**El riesgo existe y está acotado:** hace falta que en un día salgan 100 plantillas de aviso, y sólo salen como
plantilla si el profesional no ha escrito al número en las últimas 24 h. No toca el tope por cliente.

### 6.2 · Los 10 sitios

Censo: 321 ficheros `.ts` en `src/`; 10 llamadas de fuera del módulo (más el atajo `notifyMerchantPaid`); la
misma búsqueda con un nombre que no existe da 0; fuera de `src/` (tests, scripts, public), 0.

| sitio | lo dispara | quién lo provoca | avisos si se repite 10 veces | cómo se sabe |
| --- | --- | --- | --- | --- |
| `whatsappIncoming.routes.ts:409` | un cliente con albarán en 30 días y sin presupuesto pendiente escribe un texto | **un tercero (el cliente)** | **10** (uno por mensaje; la misma entrega repetida, 1) | EJECUTADO |
| `whatsappIncoming.routes.ts:297` | un cliente escribe BAJA o STOP | **un tercero (el cliente)** | **10** (aunque ya esté de baja) | EJECUTADO |
| `botFlow.service.ts:688` | segundo texto fuera de menú | un tercero (el cliente) | 1 (el bot calla 24 h) | EJECUTADO, con el flag del bot en ON |
| `botFlow.service.ts:631` | «hablar con una persona» | un tercero (el cliente) | 1 (el bot calla 24 h); con el flag en OFF, 0 | EJECUTADO |
| `botFlow.service.ts:495` | el cliente termina de pedir un presupuesto al bot | un tercero (el cliente) | uno por solicitud completada | LEÍDO |
| `payBizum.routes.ts:198` | el cliente pulsa «ya he pagado» en la página pública | un tercero (el cliente) | 1 por cobro | EJECUTADO |
| `psp.routes.ts:346` | webhook de pago confirmado | un tercero (la pasarela) | 1 por cobro: si ya está pagado vuelve antes (`:44`) | LEÍDO |
| `mpWebhook.routes.ts:241` | webhook de Mercado Pago aprobado | un tercero (la pasarela) | 1 por cobro: sólo si no estaba pagado (`:104`) | LEÍDO |
| `disputes.service.ts:183` | webhook de disputa de Stripe | un tercero (el banco) | 1 por disputa: deduplica por id (`:153`) | LEÍDO |
| `quotes.routes.ts:761` | el cliente acepta o rechaza un presupuesto | un tercero (el cliente) | 1 por decisión: la escritura lleva el estado en el `where` | LEÍDO |

**Ninguno de los diez lo dispara el comercio: los diez los provoca un tercero.** Ocho llevan un freno propio (uno
por cobro, por disputa, por decisión, o el silencio de 24 h del bot). **Dos no lo llevan: `:409` y `:297`, uno
por cada mensaje que el cliente escriba.** Los tres del bot dependen de `BOT_INBOUND_ENABLED`, que en el código
está en OFF.

### 6.3 · Un día verosímil

**No se puede medir: no hay comercios con clientes reales** (memoria del equipo, 28-sep y 1-oct). Lo que el
código da son los multiplicadores de arriba: avisos del día = pagos + decisiones de presupuesto + «ya he pagado»
de Bizum + disputas + **cada texto** de un cliente con albarán reciente y sin presupuesto pendiente + **cada
BAJA**. Con un comercio de, digamos, 5 pagos, 5 decisiones y 5 mensajes sueltos, son 15, muy lejos de 100; esa
cifra es un supuesto mío, no una medición. Lo que sí está medido es qué hace falta para llegar a 100: **un solo
cliente escribiendo 100 mensajes** (o BAJA 100 veces) con la ventana del profesional cerrada.

### 6.4 · Controles de esta parte

| control | esperado | salió |
| --- | --- | --- |
| CERO: entrante con la firma mala | 401, 0 avisos | 401 y 0 |
| CERO: número que no es cliente de nadie | 0 avisos | 0 |
| CERO: cliente sin albarán reciente | 0 avisos | 0 (y 1 respuesta al cliente: la ruta corrió) |
| POSITIVO obligatorio: cliente con albarán escribe una vez | 1 aviso, 1 plantilla al profesional | 1 y 1 |
| CERO del contador: 120 avisos con la ventana abierta | 0 plantillas, y la del cliente sale | 0, y sale |
| CERO de Bizum: token que no existe | 404, 0 avisos | 404 y 0 |
| el guion esperando una repetición menos | rojo | salida 1, 3 casos en rojo de 20 (0 en la buena) |

Un manejador que revienta daría «0 avisos» igual que uno que no avisa: el guion cuenta sus trazas de error y
un caso con alguna no vale. Salieron 0.

### 6.5 · Lo que NO se midió de esta parte

- **Cinco de los diez sitios están LEÍDOS, no ejecutados** (los dos webhooks de pago, la disputa, la decisión
  del presupuesto y la solicitud por el bot). El «1 por cobro» de los dos webhooks de pago es una lectura seguida
  de una escritura: **dos entregas a la vez no las he probado.**
- Si delante del webhook de entrantes hay algún límite de peticiones en `app.ts`: aquí se montó la ruta sola.
- Si Meta limita cuántos mensajes puede mandar un mismo usuario en un día. Fuera del repositorio.
- El valor de `BOT_INBOUND_ENABLED` en producción. En el código, OFF.
- Cuántos profesionales tienen la ventana cerrada. Sin dato; es lo que decide si un aviso es plantilla o texto.
- La comprobación de que nada sale a un host que no es Meta no la he visto en rojo.
- La base en memoria contestó sin modelarlo a `customerEvent.create` (2 veces). Nada más.

Reproducir: `node docs/master/evidencias/SCRUM-1509d/avisos.cjs dist` (rojo a propósito: `--esperado-menos-uno`).

---

# SCRUM-1509f · Los dos avisos sin freno: qué límite de peticiones hay delante del webhook de entrantes — medido, sin arreglar nada

**Medido contra:** `origin/main` = `453d3a5130dc2c01996b1a794b14262212f241a5` · 2026-10-08T02:18:41Z (hora de GitHub)

A9: comprobación → `docs/master/evidencias/SCRUM-1509f/limite.cjs`

J2 (relevo, sesión `jv-j2`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-90`). **Es
EJECUCIÓN y LECTURA:** no se ha tocado ningún fichero de `src/`, test, plantilla, texto ni workflow. Entran este
tramo y `docs/master/evidencias/SCRUM-1509f/` (guion y sus dos salidas). Nada contra producción ni staging: base
en memoria y transporte doblado. No se corrió `prisma generate`; `dist` con `tsc --noCheck` de `179c248b4`, y
entre ese commit y `453d3a513` no cambia ningún fichero de `src/` (0 en `git diff --name-only` sobre `src`).

El hook de arranque dijo «SIN IDENTIDAD… no construyas» (no reconoce `jv-j2`, SCRUM-1498). Se siguió porque el
encargo es medir.

## 0 · La respuesta corta

**Delante del webhook de entrantes no hay ningún límite de peticiones en la aplicación. El riesgo está ABIERTO.**

| pregunta | medido |
| --- | --- |
| ¿Hay un limitador delante de `POST /webhooks/whatsapp`? | **No.** De las 102 capas de la app cargada casan 7; 6 las ve cualquier petición y la séptima es el router del webhook, cuya ruta tiene **1 mano** (el manejador). La ruta de login, leída igual, tiene 2: la de más es su limitador |
| ¿Contesta 429 alguna vez? | **No.** 120 peticiones firmadas seguidas: 0 respuestas 429. El mismo contador ve 2 de 7 en `/auth/login` |
| ¿Quién puede hacerlo correr? | **Sólo quien firma con el secreto de la app.** 120 peticiones con la firma mala: 401 las 120, 0 avisos, 0 respuestas al cliente. Tampoco ahí hay 429 |
| `:409` · un cliente con albarán escribe 120 textos, ventana del profesional cerrada | **120 avisos, 100 plantillas al profesional y 20 bloqueadas** por el tope de comercio. Nada lo para antes |
| `:297` · un cliente que YA está de baja escribe BAJA 120 veces | **120 avisos, 100 plantillas y 20 bloqueadas.** Y 120 respuestas de texto al cliente dado de baja |
| ¿Y con la ventana del profesional abierta? | 120 avisos por texto, **0 plantillas** |

**Lo único que hay entre un cliente que escribe y el aviso al profesional** es, por este orden: la firma (quita a
un tercero que llame por HTTP, no al cliente que escribe por WhatsApp), el descarte de la misma entrega repetida
(medido en el tramo «d»: 10 reintentos, 1 aviso) y el tope de comercio de 100 al día, que es el techo y a la vez
el daño: gastado en avisos, ese día el comercio no manda una plantilla más a ningún cliente (tramo «d», C2).

**Quién puede provocarlo.** Para `:409`, un cliente al que se le mandó un albarán por plantilla en los últimos 30
días y que no tiene presupuesto en `sent`. **Para `:297`, cualquier número que conste como cliente de algún
comercio**, tenga o no albarán, esté o no de baja, con el bot en ON o en OFF. Es la puerta más ancha de las dos.

## 1 · `:297`, mirado aparte (regla 28)

El máster pide el aviso al profesional en la baja (J3: «`customer.waOptOut=true` + bloqueo de envíos […] + aviso
al pro»). Lo que el código hace es darlo **en cada mensaje de baja, no en cada baja**:

| caso | avisos | plantillas al profesional | textos al cliente |
| --- | --- | --- | --- |
| primera BAJA de un cliente que no estaba de baja | 1 | 1 | 1 |
| un cliente YA de baja escribe BAJA 10 veces | **10** | **10** | **10** |
| lo mismo con `stop`, `Baja.`, `STOP!`, `baja` | 10 | 10 | 10 |
| el mismo número es cliente de DOS comercios, BAJA 10 veces | **20** (uno por comercio y mensaje) | 20 | 10 |
| CERO: 10 textos que no son la orden («quiero la baja») | 0 | 0 | 10 |
| CERO: BAJA de un número que no es cliente de nadie | 0 | 0 | — |
| CERO de plantillas: BAJA 10 veces con la ventana abierta | 10 | 0 | 10 |

La ruta no lee `waOptOut` antes de avisar: busca al cliente por teléfono, reescribe la baja y avisa
(`whatsappIncoming.routes.ts:271-305`). El texto que recibe el cliente es una respuesta a quien acaba de escribir,
dentro de su propia ventana. La tabla J6 del máster limita los mensajes al cliente; **de los avisos al profesional
no dice nada**, y el único contador que los ve es el de comercio. Coste por plantilla en el máster: unos 0,023 €,
o sea un techo de unos 2,30 € por comercio y día; el daño medible no es el dinero, es el cupo.

## 2 · Lo que apareció midiendo: el tope de comercio no aguanta un lote

| caso | peticiones | avisos | plantillas | bloqueadas |
| --- | --- | --- | --- | --- |
| L1 · 120 peticiones de 1 mensaje, una detrás de otra | 120 | 120 | **100** | 20 |
| L2 · **una** petición con 120 mensajes dentro | 1 | 120 | **120** | **0** |
| L3 · 120 peticiones de 1 mensaje lanzadas a la vez | 120 | 120 | 100 | 20 |

En L2 salen **120 plantillas con el tope en 100**. El webhook recorre los mensajes de la petición y lanza cada uno
sin esperar al anterior (`:146`); el tope se pregunta antes de enviar (`whatsapp.ts:376`) y la fila que cuenta se
escribe después. Los 120 preguntan con el contador a 0.

**Esto es una observación sobre una base EN MEMORIA, sin esperado previo.** No dice qué pasa en Postgres ni si el
proveedor agrupa de verdad varios mensajes de un usuario en una petición. Dice que **un límite por petición no
bastaría**: la unidad que dispara el aviso es el mensaje. Y L3 no prueba que las peticiones simultáneas sean
seguras: aquí la base contesta al instante.

## 3 · El instrumento y sus controles

Se carga la APP ENTERA de `dist/app.js` (pila real, con su lector de cuerpo y su verificación de firma) y se le
pide por HTTP. 18 casos, 18 cuadran. Total de la corrida buena: 652 avisos contados y 2 respuestas 429.

| control | esperado | salió |
| --- | --- | --- |
| POSITIVO del contador de 429: `/auth/login`, 7 veces, mismo correo | 2 de 429 | 2 |
| CERO del contador de 429: `/auth/login`, 7 correos | 0 | 0 |
| POSITIVO de la lectura de la pila: la ruta de login | 2 manos | 2 |
| CERO de la lectura de la pila: una ruta inventada | sólo las capas comunes | 6, las mismas |
| CERO: 120 entrantes con la firma mala | 401 las 120, 0 avisos | 401x120 y 0 |
| CERO: número que no es cliente de nadie (texto y BAJA) | 0 avisos | 0 y 0 |
| POSITIVO obligatorio: cliente con albarán escribe una vez | 1 aviso, 1 plantilla | 1 y 1 |
| el guion esperando una repetición menos | rojo | salida 1, 7 casos en rojo de 18 (0 en la buena) |

El guion sale 2 si alguno de sus cinco positivos da 0. Un manejador que revienta se cuenta por sus trazas: 0.

## 4 · Lo que NO se midió

- **Lo que el proveedor ponga de su lado.** Si limita cuántos mensajes puede escribir un usuario a una empresa en
  un día, y si agrupa mensajes en una petición. Una búsqueda en fuentes secundarias no encontró ningún tope de
  entrantes documentado (los límites publicados son de conversaciones iniciadas por la empresa); **la
  documentación primaria no la he leído**, así que queda sin juzgar, no en «no hay».
- **La app desplegada.** Un proxy delante de producción (Cloudflare, Railway) podría limitar por IP; las
  peticiones del proveedor llegan de sus propias direcciones. Aquí es `dist` local con `NODE_ENV=development`.
- Postgres real. L2 y L3 dependen del orden en que la base contesta.
- Cuántos profesionales tienen la ventana cerrada, que es lo que convierte el aviso en plantilla. Sin dato.
- Si un tercero puede hacerse cliente de un comercio por su cuenta (el formulario público, el bot). No mirado.
- El bot en ON para `:409`: sólo se ejecutó con el flag en OFF, que es su valor en el código.
- La base en memoria contestó sin modelarlo a `teamMember.findUnique` (12 veces, todas de `/auth/login`).
- Ninguna tanda completa: no hay cambio de código. Los de registro, abajo.

## 5 · Errores propios

- En L2 no supe escribir el esperado antes de correrlo; salió 120 y lo dejé como observación, no como caso que
  cuadra. Su fila de «cuadra» comprueba sólo los avisos y la respuesta HTTP.
- La primera compilación la lancé con un `tsc` que en un árbol anidado no existe; lo dijo la salida 127, no un cero.

Reproducir: `tsc --noCheck` y `node docs/master/evidencias/SCRUM-1509f/limite.cjs dist` (rojo a propósito:
`--esperado-menos-uno`).

# SCRUM-1509g · El tope BLOQUEA cuando no se puede comprobar — construido (sólo la parte firmada)

**Medido contra:** `origin/main` = `3fadf8eba46be56c209e5eb491cbeab155bc2314` · 2026-10-20T10:36:51Z (hora de GitHub al escribir: 2026-10-20T10:45:09Z)
A9: comprobación → `tests/scrum1509g-el-tope-bloquea.test.mjs`

J2 (sesión `jv-j2a`, equipo de Javier), por encargo del orquestador `cobroflash-backend-09`.

**La decisión** está en SCRUM-1509 c.19620 (14-oct-2026). Literal del fundador: «Ok que el tope bloquee». Aquí se
construye **sólo** la primera de sus dos partes.

## 0 · PASO 0: qué estaba hecho y qué seguía vivo

- `main` tenía cinco tramos de medición de 1509 (b, c, d, e, f) y **ningún arreglo**.
- **SCRUM-1513 ya había cerrado la carrera** (#2325, 8-oct, antes de la firma). La pregunta y la fila van juntas bajo
  un cerrojo por comercio (`reservarPlantilla`). Por eso C1 de 1509c («falla la escritura, el tope cuenta 0») ya no es
  como se midió: ahora la escritura es parte de la reserva.
- **Lo que seguía vivo** era el `catch` de `whatsapp.ts:415-416`: «Error comprobando topes A3.2 (no se bloquea)». Si la
  reserva lanzaba, la plantilla salía. 1513d lo dejó escrito («si la base no contesta, la reserva LANZA: qué se hace
  entonces lo decide quien llama»), y `SCRUM-1496.md:475` lo apunta como lo firmado: «que el tope BLOQUEE cuando no
  puede comprobar (`whatsapp.ts:382`, `:414`)».

## 1 · El arreglo (`src/integrations/whatsapp.ts`, carril J2)

- Si `reservarPlantilla` lanza, la plantilla **no sale**: `logFailure` y `{ ok: false, reason: 'tope_no_comprobable' }`.
- **El motivo es propio** (`MOTIVO_TOPE_NO_COMPROBABLE`). No es `daily_cap` ni `customer_daily_cap`, porque no se sabe
  si el tope está alcanzado.
- **Sin texto nuevo (regla 39).** El motivo no está en `SEND_FAILURE_MESSAGES`, igual que `baja_no_comprobable`
  (SCRUM-1262, `whatsapp.ts:199-206`), así que la ruta lo lleva a la frase que ya da para la baja sin comprobar. El
  test lo compara letra a letra.

## 2 · El rojo primero, por la ruta real

`tests/scrum1509g-el-tope-bloquea.test.mjs` usa el banco de scrum1478: el handler real de
`POST /admin/invoices/:id/send-reminder` (`dist`), la base doblada y el dry-run de la casa, contando lo que llega al
buzón. Diez recordatorios seguidos con la base rota:

| caso | `whatsapp.ts` de `main` | con el arreglo |
|---|---|---|
| suelo: base sana, 1 recordatorio | 1 sale | 1 sale |
| suelo: tope del negocio alcanzado | 0, `daily_cap` | 0, `daily_cap` |
| falla la LECTURA del tope (`whatsAppMessage.count`) | **10 de 10** | 0 |
| falla la ESCRITURA de la reserva (`whatsAppMessage.create`) | **10 de 10** | 0 |
| falla el CERROJO del comercio (`$executeRaw`, con control de que se pidió las 10 veces) | **10 de 10** | 0 |
| el cuerpo que ve la pantalla, frente al de la baja sin comprobar | — (no existe el motivo) | idéntico |

## 3 · Tres tests que cambian, y por qué ninguno se debilita

- **`scrum1262` y `scrum590`:** sus dobles caseros devolvían `undefined` para todo lo que empieza por `$`, también
  `$transaction`. La reserva lanzaba un `TypeError` y el «no se bloquea» lo tapaba: **esos bancos no ejercitaban el
  tope**, y su verde dependía de la puerta que esto cierra. Al arreglarlo cayeron 6 casos: 1262 ③ (×2) y 590 (×4).
  Ahora el doble ejecuta el callback de la transacción, como Prisma. Las aserciones no se han tocado.
  Resultado: 41 de 41.
- **`scrum529:140`:** decía «el tope es best-effort: sale igual», que es justo lo que el fundador revocó. Se reescribe
  para lo decidido (no sale, motivo `tope_no_comprobable`, nada al proveedor), y se conserva lo que fija el 529: la
  fila que queda lleva el número. Resultado: 12 de 12.

## 4 · Lo corrido

- La tanda dirigida: los 42 ficheros que nombran el envío de plantillas o el tope, más scrum836, scrum745 y
  scrum1508. **375 tests: 365 pasan, 2 caen y 8 se saltan.**
- Los 2 que caen son `SCRUM-245 · el fixture que OMITE el merchant NO compila` y su control. Compilan contra el
  cliente de Prisma del checkout compartido, que está desfasado, y ya caían en la tanda entera de este árbol de esta
  mañana, antes de cualquier cambio de este tramo. Manda el CI.

## 5 · Lo que NO se ha construido, y por qué

- **El límite delante de `POST /webhooks/whatsapp`.** Está firmado que va, pero **no hay número ni comportamiento
  decididos**: cuántos mensajes, por quién (número, cliente o comercio), en qué ventana, y qué se hace con lo que
  sobra (descartar en silencio, contestar algo al cliente, avisar). Elegir cualquiera de esas cosas es inventar un
  límite de canal (reglas 27 y 30). Medido en 1509f: hoy no hay ninguno, y 120 mensajes de un cliente producen 120
  avisos y 100 plantillas.
- **La salida A–E del recordatorio de facturas:** sin elegir (c.19620 lo dice expresamente).
- **Los cuatro llamadores que no pasan cliente** (1509d) siguen sin tope por cliente. Lo de aquí sólo cierra la puerta
  de «no se pudo comprobar».
- **Visto de paso, en mi carril y sin tocar:** con el arreglo, en `registrarEnviado` el camino que hace
  `recordWaMessage` al salir (`reservaId === null` con comercio) ya no se alcanza, porque con comercio o hay reserva o
  no se envía. Sin comercio, `registrarEnviado` vuelve antes. Era lo único que ejercitaba el antiguo 529 `:140`. No se
  quita en este PR por si algún censo de escritores lo cuenta. Queda nombrado aquí.

## 6 · Errores propios

- **El primer test tenía un caso ciego.** «Falla la transacción entera» rompía `$transaction` en `respuestas`, y el
  doble de `_envio-doblado.mjs` la ejecuta siempre sin mirar `respuestas`. Ese caso no rompía nada: su «10 de 10» de
  antes del arreglo salía por un motivo equivocado. Lo delató que siguiera en 10 con el arreglo puesto. Se cambió por
  el cerrojo, con un control que cuenta que se pidió, y se vio caer contra `main` por el motivo bueno.
- Escribí el test primero en la rama de 1456c. Lo pasé a esta antes de comitear nada.

# SCRUM-1509h · El límite de mensajes ENTRANTES: 20 por número y hora, descartados en silencio y contados

**Medido contra:** `origin/main` = `fe65a8b7fca8b1e42448c8134e26d880d96b9ba7` · 2026-10-21T12:18:48Z (hora de GitHub al escribir)
A9: comprobación → `tests/scrum1509h-veinte-entrantes-por-hora.test.mjs`

J2 (sesión `jv-j2n`, equipo de Javier), por encargo del orquestador `cobroflash-backend-5f`. Carril J2: los dos
ficheros de `src/` caen bajo `src/modules/whatsappBot/**` (`dos-equipos.md:124`, medido con `scripts/carriles.mjs`).

**La decisión** está en SCRUM-1509 c.20141 (21-oct-2026). Literal del fundador: «ok vamos con tu recomendación», a
«20 mensajes por número de teléfono y hora, descartando el exceso en silencio pero contándolo». Es la segunda parte
de c.19620 («y el límite va también delante del webhook de entrantes»); la primera es SCRUM-1509g.

## 0 · PASO 0

Sin rama `scrum-1509h*` en el remoto ni commit 1509h en `main`. El registro de 1509g decía «el límite del webhook
queda sin construir (sin número decidido)»; el defecto se volvió a ver HOY corriendo (§2), no leyendo.

## 1 · Lo construido

- `src/modules/whatsappBot/domain/limiteDeEntrantes.ts` (nuevo): `admitirEntrante(from)` —ventana DESLIZANTE de
  60 min por número normalizado, `ENTRANTES_POR_HORA = 20`— y `descartesDeEntrantes()`, el recuento desde el arranque.
- `whatsappIncoming.routes.ts`: una llamada por MENSAJE (no por petición), después del descarte de duplicados (un
  reintento de Meta no gasta cupo) y antes de todo lo demás. El mensaje descartado no se registra, no se marca como
  leído, no contesta al cliente y no avisa al profesional. Deja UNA traza por descarte en el log:
  `[WA in] DESCARTADO por el límite de 20 entrantes por número y hora: from=<enmascarado> · descartes desde el arranque: <n>`.
- Ningún texto nuevo al cliente, ningún aviso nuevo al profesional, nada de plantillas ni de Meta, ni esquema.
  Los estados de entrega (`statuses`) no pasan por el límite: no son mensajes del cliente.

**Dónde se cuenta, y qué pierde.** En memoria del proceso, porque contarlo en la base sería columna o tabla nueva
(regla 40, orden A5) y nadie la ha decidido. Pierde: **al reiniciar**, las ventanas y el contador vuelven a cero;
**con más de una instancia**, cada una contaría lo suyo (no he medido cuántas corre Railway). Lo que dura es la traza
del log, una por descarte, con el total corrido. La lectura del contador no tiene pantalla ni ruta: sólo el log.

**Un efecto de paso, deducido y no medido:** el mensaje descartado tampoco renueva la ventana de 24 h
(`recordInboundWaMessage`). Como los 20 admitidos de esa misma hora sí la renovaron, el registro puede ir como mucho
una hora por detrás de la ventana real: en el peor caso un envío iría por plantilla cuando podía ir por texto. Es el
lado conservador.

## 2 · El rojo primero, por la ruta real

`tests/scrum1509h-veinte-entrantes-por-hora.test.mjs` pide a la APP ENTERA (`dist/app.js`) por HTTP, con la firma
de Meta; base en memoria con estado (la de `evidencias/SCRUM-1509f/limite.cjs`) y WhatsApp en dry-run (un proceso de
test sin él lo bloquea, SCRUM-180). Cada cliente en su comercio, para que el tope de 100 plantillas no mezcle casos.

Contra el `dist` de `main` sin tocar (`evidencias/SCRUM-1509h/rojo-sobre-main.txt`): **8 casos, 3 pasan y 5 caen.**
El caso de 1509f salió `{"avisos":120,"alProfesional":120,"entrantesRegistrados":120,"descartes":0}`: los 120.
Con el límite: **8 de 8**. Lo que miden:

| caso | `main` | con el límite |
|---|---|---|
| el módulo existe y su constante es la firmada (20, 1 h) | cae | pasa |
| POSITIVO: 1 mensaje → 1 aviso, 1 registro, 0 descartes | pasa | pasa |
| 120 textos, uno por petición → 20 avisos, 20 acuses al cliente, 100 descartes y 100 trazas | 120 / 0 | 20 / 100 |
| una petición con 120 mensajes dentro → 20 | 120 | 20 |
| 30 reintentos de UNA entrega gastan 1; pasa el 20.º y cae el 21.º | el 21.º pasa | cae |
| con un número en su límite, otro cliente sigue entrando | pasa | pasa |
| 120 peticiones con la firma mala no gastan cupo | pasa | pasa |
| un minuto antes de cumplirse la hora sigue fuera; un minuto después entra | entra | fuera / entra |

El rojo de `evidencias/SCRUM-1509h/rojo-sobre-main.txt` es el test en su versión final contra un `dist` cuya ruta se
emitió desde `origin/main` y sin el módulo nuevo (el guion que lo hizo no está comiteado: es de un solo uso).

**Qué pieza trabaja.** El test declara cuatro `MUTACIONES_QUE_ME_TUMBAN` (contrato de SCRUM-745; las corre la red de
la casa). `evidencias/SCRUM-1509h/mutar.mjs` las LEE de ahí (sin lista propia, SCRUM-1387), compila cada una con el
compilador del proyecto, la escribe sólo en su `.js` de `dist/` y lo devuelve a sus bytes (sha256). Salida en
`salida-mutar.txt`: base sin mutar verde (0 de 8); la ruta no pregunta al límite, 4 de 8 caen; `<` a `<=`, 4; la
hora no caduca, 1; el descarte no se cuenta, 4. **En las cuatro cae el caso que la declara.**

**Dos tests de fuera que tocó este cambio, y por qué ninguno se debilita:**
- `tests/scrum1326-vale-pregunta-una-vez.test.mjs` escribía sus 16 casos desde UN solo número, más de 20 mensajes
  en un proceso: con el límite, 10 casos cayeron (visto). Ahora cada conversación escribe desde su número, y la
  aserción «la pregunta sale hacia quien escribió» compara con el número de ESA conversación. 16 de 16.
- `scrum411` (exports que nadie consume): mi primera versión exportaba la ventana sólo para el test. Ya no se
  exporta; el test usa la hora firmada.

⚠️ `evidencias/SCRUM-1509f/limite.cjs` describe el `main` de antes: corrido sobre el `dist` nuevo, sus esperados de
120 avisos ya no cuadrarán. Es la foto del defecto, no un test; no lo he tocado ni corrido sobre el `dist` nuevo.

## 3 · Lo corrido, y lo que NO

33 ficheros (el nuevo, los de registro, los guards de entrada y los 13 que piden el webhook de entrantes):
**300 casos · 298 pasan · 0 caen · 2 saltados** (gateados por base: `scrum50`, `webhooks-idempotencia`). Tipos:
`tsc --noEmit` da 17 errores, ninguno en estos ficheros (el cliente de Prisma compartido no trae `archivedAt`).
La tanda completa y el obligatorio, en la entrega de Jira. **No medido:** Postgres
real; el proxy de producción; cuántas instancias corre Railway; si Meta limita de su lado; mensajes que llegan A LA
VEZ en peticiones distintas (aquí el contador es síncrono dentro de un proceso, así que no hay carrera entre
`admitir` y `contar`, pero no lo he ejecutado en paralelo); la rama CIEGA de `mutar.mjs` no la he visto saltar.

## 4 · Errores propios

- Escribí en el test, sin ejecutarlo, que «al cliente no se le contesta nada» por los 120. El rojo dijo otra cosa:
  la ruta YA contesta un acuse por cada mensaje admitido. Corregido el esperado a 20 acuses (los admitidos), no 0.
- Mi primer banco doblaba axios en vez de usar el dry-run, y el guard de SCRUM-180 bloqueó cada envío en silencio:
  el positivo dio «1 aviso, 0 salidas al profesional». Lo cazó el POSITIVO, no el rojo.
- Mi primer `mutar.mjs` traía su propia lista: `scrum1387` (vía `guards:entrada`) lo tumbó. Rehecho sobre la
  declaración del test.
- La ficha del encargo pedía `docs/master/SCRUM-1509h.md`; A8 manda anexar al fichero del número, y en el árbol hay
  0 ficheros `SCRUM-<n><letra>.md`. Anexado aquí.

---

# SCRUM-1509i · El rojo de #2633: la suite del bot escribía 26 entrantes desde un número, y el límite se comía el 21.º

**Medido contra:** `origin/main` = `3c60a7fd0147eb56d36f5089ecc9c70e2dcbd2ee` · 2026-10-21T13:14:08Z (hora de GitHub al escribir)
A9: aviso → A10 «Un test gateado que se salta en local es un test que no corriste: su verde no habla de él.» — no se pudo comprobar: sin banco el salto es lo querido, y lo único que lo corre es el CI con `LIBRO_PG_URL`, después del empujón

J2 (sesión `jv-j2o`, equipo de Javier), relevo de `jv-j2n` por encargo del orquestador `cobroflash-backend-5f`. Sobre la
rama de #2633 (`scrum-1509h-veinte-por-hora` @ `5bc9a9a15`), con `origin/main` fusionado (A4). Ni `src/` ni el 20 se
tocan: el 20 es firma del fundador (c.20141) y el arreglo es del TEST.

## 0 · El rojo, confirmado en el log

Run 39600073687, job 119222039233, log de 1.984.677 B (`--allow-escape-sequences`): **12.007 tests, 1 cae**, A8.4
(`tests/bot-suite.test.mjs:81`), `NoMedido` «26 mensaje(s) en el buzon». Una sola traza `[WA in] DESCARTADO … from=34••••••005`.
Ojo al leer el log: el enmascarado deja 3 cifras, así que las 60 líneas `[WA in] from=34••••••005` mezclan procesos y
números (la suite del bot es `34600000005` en un banco virgen; `scrum1509h` y `scrum1326` escriben otros que acaban igual).

Contados los `post` de la suite (el duplicado del paso 5 no gasta cupo): el 21.º admitido es `reparación urgente (suite
loc)` del paso 8h, la línea 318 del stack. **Reproducido en local, idéntico**: banco PGlite desechable en
`127.0.0.1:55432/yaqu_libro_test` (esquema de `migrate diff --from-empty`, sin tocar ninguna base), mismo `NoMedido`
tras el paso 8g, y una sonda `--require` sobre `admitirEntrante` (sin tocar `src` ni `dist`): **21 llamadas desde
`34600000002`, 1 rechazo**.

## 1 · Quién más se pasa de 20 (población, no sólo el que cayó)

Los 14 ficheros de `tests/` que hablan con el webhook de entrantes (`webhooks/whatsapp`, la ruta o el sobre de Meta;
buscar por `messaging_product`/`whatsapp_business_account` no añade ninguno, y el runner gateado sólo corre
`tests/*.test.mjs`). Con la sonda: el máximo por número y proceso de los que corren sin base es 9 (`scrum1322`);
`scrum1326` usa 55 números con 2 como mucho; `scrum1509h` llega a 120 a propósito (es el **control positivo**: 100
rechazos). Los gateados, leídos: `scrum50` manda 3, `webhooks-idempotencia` es el webhook de PSP (0). **Sólo
`bot-suite` pasaba de 20.**

## 2 · El arreglo

- `tests/bot-suite.test.mjs`: tres conversaciones, tres clientes del merchant — pasos 1-7 desde `cliente` (7
  entrantes), 8-8h desde `segundoCliente` (16), 9-11 desde `tercerCliente` (3). Medido con la sonda: 3 números,
  máximo 16, 0 rechazos.
- Los tres asertos del aviso al profesional (8f, 9, 11) pasan de `m.to !== TEST_PHONE` a `m.to === PRO_PHONE`: con
  varios clientes, un mensaje tardío al cliente ANTERIOR también es «distinto de TEST_PHONE», y el aserto pasaría sin
  que el pro recibiera nada. La contraprueba de limpieza cuenta `botSession` de los tres clientes, no sólo del último.
- `post()` cuenta wamids distintos por número y, si una conversación va a pasar de `ENTRANTES_POR_HORA` (leído de
  `dist`, no copiado), falla CON NOMBRE en el sitio, en vez de un `NoMedido` de buzón veinte pasos más abajo.
- `tests/_merchant-fixture.mjs`: `telefonosDe` gana `segundoCliente` (`34605…`) y `tercerCliente` (`34606…`), de la
  misma fuente (SCRUM-180) y alcanzados por el barrido por phone (`Object.values`). 34602-34604 no: otras suites
  los usan con sufijo del reloj; 34605-34609 no aparecen en `tests/`, `scripts/`, `src/` ni `docs/QA`.

**Qué pieza trabaja**: quitando las dos líneas que cambian de cliente, la suite cae en el entrante n.º 21 con el
mensaje de `post()` («el entrante n.º 21 desde 34600000004 …»), tras el paso 8g, como en CI. Copia mutada borrada;
árbol limpio después.

## 3 · Lo corrido

- Contra el banco PGlite: `bot-suite`, `scrum50`, `a55-window-quote`, `merchant-fixture`: **16 casos · 16 pasan · 0
  caen · 0 saltados**. La suite: 14 pasos, «SUITE OK — 33 mensajes simulados, 0 llamadas a Meta», limpieza a 0.
- Sin base: los 14 del webhook + `merchant-fixture`, `scrum681`, `scrum419`, `scrum172`, `scrum495`, `scrum498`,
  `scrum113`, `scrum1415`, `scrum237*`, `scrum976*`: **202 · 199 pasan · 0 caen · 3 saltados** (los gateados). Suma cuadra.

**No medido:** Postgres real (PGlite es una sola sesión: hizo falta `pgbouncer=true` y `connection_limit=1`, así que
no prueba nada de concurrencia); la tanda completa en local; los otros 80 ficheros que usan `withMerchant` contra un
banco (el cambio sólo añade dos teléfonos al `deleteMany` por phone); que el barrido por phone, y no el de
`merchantId`, sea el que borra las sesiones de los clientes nuevos. El obligatorio, en la entrega de Jira.

## 4 · Errores propios

- Dejé un commit «wip» debajo de un merge con `main`; sin empujar, lo rehice con `reset --keep` y `cherry-pick -n`.
- Mi primera sonda no arrancó (la ruta con espacio partía `NODE_OPTIONS`) y mi primer banco cayó por SSL y por
  sentencias preparadas con nombre: ninguno de los dos dio un número falso, los tres fallaron en alto.

# SCRUM-1509j · El recordatorio de FACTURAS no reenvía si no puede guardar su candado (A), y una alarma ante lectores nuevos de la auditoría (E)

**Medido contra:** `origin/main` = `37311b671db107cc48a31fc359104fe36525ad2e` · 2026-10-23T10:56:12Z (hora de GitHub al escribir: 2026-10-23T11:06:38Z)
A9: comprobación → `tests/scrum1509j-recordatorio-de-facturas-no-reenvia.test.mjs`

Sesión `jv-j1aj` (puesto J1, equipo de Javier). **Carril J2 a mano** (`invoiceReminder.service.ts` → J2, `dos-equipos.md:120`), por encargo del orquestador `cobroflash-backend-62`, que lo confirmó por mensaje. Decisión del fundador: **«A + E»** (SCRUM-1508 c.20470, transcrita en SCRUM-1509 c.20471). Regla 28: es un FRENO a un envío que ya existe; en el camino sano sale lo mismo, al mismo cliente y el mismo día.

## 0 · PASO 0

`git log origin/main --grep=1509`: 1509b–i en main, ninguno toca `invoiceReminder.service.ts` (1509b lo midió sin tocarlo). Ninguna rama `scrum-1509*` viva en el remoto. El defecto, corrido hoy (abajo): **60 envíos en 30 pasadas** con el candado roto, lo mismo que midió J2 el 8-oct (c.18886).

## 1 · El arreglo (A) — `src/modules/billing/domain/invoiceReminder.service.ts`

Antes: enviar, y DESPUÉS escribir `reminder7SentAt` / `reminder14SentAt` con el error tragado. Si esa escritura fallaba, la factura seguía «sin recordar» y el cron diario la volvía a mandar.

Ahora el candado se **reserva antes de enviar** (`updateMany` condicionado a que siga a `null`, que además impide que dos pasadas a la vez manden el mismo aviso). Los tres caminos de fallo:

| camino | qué pasa | caso del test |
|---|---|---|
| ① la reserva no se puede escribir | no se envía; la pasada siguiente lo intenta | `CAMINO ①` y `EL ROJO DE 1509b` |
| ② el envío falla | la reserva se libera y mañana se reintenta (SCRUM-116 intacto) | `CAMINO ②` |
| ③ el envío falla y liberar también | el candado se queda puesto: ese aviso **no se reintenta**, y el log lo dice | `CAMINO ③` |

⚠️ El ③ es el coste aceptado de «si no puede anotar, se para»: un aviso legítimo se pierde si fallan seguidos el envío y la escritura que lo devolvería. Y un proceso que muere entre la reserva y el envío también lo pierde. No hay dato de cada cuánto pasa ninguno de los dos.

## 2 · El rojo primero y el verde (base falsa en memoria, WhatsApp en dry-run, 30 pasadas)

| caso | `main` | con el arreglo |
|---|---|---|
| CONTROL · todo sano | 2 | 2 |
| candado roto siempre | **60** | **0** |
| la reserva falla UNA vez | **4** | 2 |
| el envío falla una vez | 2 | 2 |
| el envío falla y liberar también | **2** | 1 |

Test: `tests/scrum1509j-recordatorio-de-facturas-no-reenvia.test.mjs` — `main` 2 de 5 pasan; con el arreglo 5 de 5. **Qué pieza trabaja:** declara 3 `MUTACIONES_QUE_ME_TUMBAN` y `docs/master/evidencias/SCRUM-1509j/mutar.mjs` las aplica (recompila `dist`, corre, restaura byte a byte): base 5/5, las tres CAZADAS, final 5/5 (`salida-mutar.txt`). La rama CIEGA del guion no la he visto saltar.

## 3 · La alarma (E) — `tests/scrum1509j-lectores-de-la-auditoria.test.mjs`

AST de TypeScript sobre los `.ts` de `src/`: un lector es `<cliente>.auditLog.<lectura>(…)` o un texto que nombre la tabla `audit_log`. Los lectores de hoy son exactamente los 3 de SCRUM-1508 (2 en `solicitudesPendientes`, 1 en `reintentarSelladosPendientes`), y la lista es el conjunto exacto: cae si aparece uno nuevo y si uno conocido desaparece. Controles: POSITIVO sembrado (4 formas, las 4 vistas), CERO (escritura, otra tabla, un campo homónimo: 0), población declarada en el mensaje del rojo. Dos mutaciones, vistas caer a mano: quitar `count` tumba el positivo; bajar a 0 un lector conocido tumba la alarma.

**Límite:** lo que no vea el AST (un `prisma[variable]` con el nombre del modelo en otra variable) no lo caza. No toca `audit.service.ts` (S1).

## 4 · Lo que NO se hace aquí

El recordatorio de PRESUPUESTOS (`reminder.service.ts`) es de S1 (c.18881): no tocado. La misma forma de A para ése es de S1: queda para el equipo de Luis, sin ticket abierto por esta sesión (lo decide el orquestador). Ninguna plantilla, ningún texto, nada de esquema.

## 5 · Lo que NO se midió

Postgres real (base en memoria). Cada cuánto falla la escritura del candado: sin dato. `tsc --noEmit`: 17 errores, ninguno en este fichero (cliente de Prisma compartido). Verificación en yaqu.app: no se puede ver un candado que falla en producción; no lo he intentado.

## 6 · Errores propios

* Mi banco salió a 0 en el control dos veces antes de medir nada: la baja de WhatsApp (el doble devolvía al cliente como «de baja») y el cerrojo del tope de 1509g (`$executeRaw`). Lo cazó el CONTROL, que ahora dice en su rojo lo que contestó el módulo.
* Hice la lectura de Jira antes que la de arranque, y me medí después de cada una (149.555 y ~160.700); crucé 200k a ~238k y lo avisé en ese momento.

## 7 · El obligatorio de #2723 cayó en 3 casos, los 3 míos (relevo jv-j1am, 2026-10-23T11:31Z de GitHub)

Job 120382897336 (12.252 casos, 3 fail, 0 «TANDA SIN VEREDICTO»): `scrum262` (el test sembraba dos móviles ordinarios), `scrum702` (el test leía `NODE_ENV`: 21 ficheros sobre un tope de 20) y `scrum878` (las dos escrituras del candado usaban un nombre de campo calculado, `[campo]`, que el censo de la regla 29 no clasifica). Arreglado el código, ningún guard tocado (regla 41): teléfonos con `telefonoDePrueba(n)`, el test ya no fija `NODE_ENV` (no lo necesitaba), y cada candado se escribe con su nombre literal — mismo `where`, mismo `data`, por rama. Rojo con las versiones de `61385935`: 3 de 28 caen, exactamente esos tres; con el arreglo 36/36 (los tres guards y los dos tests de 1509j). Mutaciones de 1509j otra vez: base 5/5, las 3 cazadas, final 5/5. **El error es mío de origen (jv-j1aj, mismo puesto): empujé sin correr esos tres guards, y ninguno nombra el fichero.**
A9: comprobación → `tests/scrum262-telefonos-de-prueba.test.mjs`
A9: comprobación → `tests/scrum702-suelo-misma-poblacion.test.mjs`
A9: comprobación → `tests/scrum878-poblacion-del-guard-29.test.mjs`
