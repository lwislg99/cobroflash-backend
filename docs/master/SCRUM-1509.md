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
