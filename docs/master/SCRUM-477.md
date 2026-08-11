# SCRUM-477 · Los cuatro avisos que se tragaban su fallo

**Fecha:** 11-ago-2026 · **Carril:** infraestructura de envío · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `a224d363d2020336e97bc6478a17c45c08eaffca` · 2026-08-11T22:33:59+01:00

**Paso 0:** `docs/master/SCRUM-477.md` no existía en `main` ni en ninguna rama remota (listado
completo de 225, y búsqueda por CONTENIDO de `traga-mudo`, `nombresDeEmisor` y `resultadoSinDestino`
sobre todas las puntas: solo `main` y mis dos ramas de SCRUM-475). Verificado que SCRUM-475 entró y
que su censo sigue dando **17 · 31 · 4** cruzando ficheros.

> Continuación directa de SCRUM-475. Los cuatro mudos que aquella dejó nombrados son este encargo.

## 1 · 🔴 Lo primero: el criterio que faltaba, y por qué el censo miraba a otro lado

El censo de SCRUM-475 clasificaba por **«¿qué pasa si la llamada LANZA?»**: ¿hay `catch`?,
¿contesta?, ¿loguea? Correcto para `sendMerchantPaymentEmail`, que lanza. Pero `enviarCorreo` **no
lanza nunca** —captura dentro y devuelve `{ enviado:false, constancia }`—, así que para sus
llamadores esa pregunta no significa nada: salían `sube`, que se lee como «alguien se entera».

No era un fallo del análisis: **medía otra cosa**. Un fallo puede caerse por dos canales y el censo
vigilaba uno.

| Canal | El fallo viaja como | Se pierde si |
| --- | --- | --- |
| `lanza` | EXCEPCIÓN | un `catch` se la come |
| `devuelve` | VALOR | nadie mira lo que devolvió |

**Se deriva, no se lista** (`canalDeFallo()`), y **se propaga**: los tres emisores del ticket tienen
`throw = 0` en su propio cuerpo y lanzan a través de un `sendEmail` local. Medirlo solo en el cuerpo
propio los habría clasificado mal a los tres.

**Ante la duda, `devuelve`**: un `throw` dentro del `try` de la propia función no sale de ella, así
que no cuenta. Equivocarse hacia `devuelve` da un falso positivo —alguien mira un sitio que estaba
bien—; equivocarse hacia `lanza` esconde un fallo. El error barato va donde alguien lo ve.

### 🔴 Y un segundo criterio que hizo falta: `.catch(() => {})` NO es «mirar el resultado»

`seAprovechaElValor` (censo A) contesta «¿se aprovecha la EXPRESIÓN?». Con él,
`sendMerchantPaymentEmail(...).catch(() => {})` salía **`mira-resultado`** —hay un `.catch` colgado—
que es exactamente lo contrario de lo que pasa. `seUsaElResultado` atraviesa los eslabones de
promesa y pregunta por el VALOR: `.catch`/`.finally` no lo reciben nunca; un `.then(r => …)` con
parámetro sí.

## 2 · El recuento, y por qué me lo creo

| | mudos / pierden el fallo |
| --- | --- |
| SCRUM-475, criterio incompleto (solo excepción) | **4** |
| SCRUM-477, criterio completo (los dos canales) | **12** |
| Tras arreglar los cuatro del encargo | **8**, nombrados uno a uno |

**El trinquete SUBE.** Los ocho que quedan son de otros carriles —el arranque de los crons, el
enlace mágico de acceso, el primer pago de Stripe— y quedan escritos con nombre y línea en
`tests/scrum477-avisos-con-constancia.test.mjs`. No se arreglan aquí (regla 37), y el del enlace
mágico además toca la respuesta que ve un usuario sin sesión, que es decisión de producto (regla 30).

Me lo creo por tres cosas, no por el número:

1. **El detector se autoprueba** sobre fuente sintético antes de contar nada (heredado de la fase 2).
2. **Hay test de que la propagación cruza ficheros** — el fallo que cegó el censo la vez anterior.
3. **Un cero falla declarándose ciego**: probado cegando el censo a propósito, sale *«EL CENSO ESTÁ
   CIEGO: encuentra 0 llamadas a los avisos del profesional y son CUATRO»*, no un verde.

## 3 · 🔴 Corrección a SCRUM-475: «mudo» era demasiado fuerte

Al leer los cuatro para arreglarlos apareció que el emisor **sí escribía** una línea:

```
console.error('[merchantNotifications] Error enviando email pago:', e?.message)
```

Así que el fallo dejaba rastro. Pero ese rastro tenía dos agujeros, y son los que este ticket cierra:

* **No decía PARA QUIÉN era.** «Error enviando email pago: no se pudo enviar el email
  (fallo_envio)». Con eso no se sabe a qué profesional no se le avisó, ni se puede reintentar. Un
  rastro que no identifica el caso no es constancia: es ruido.
* **No cubría el otro canal.** `sendEmail` DEVUELVE —sin lanzar— cuando no hay destinatario válido.
  Ahí no hay excepción, el `.catch` no se dispara, y el valor devuelto se tiraba: **ese caso no
  dejaba absolutamente nada.**

Y había un tercero que destapó el compilador: `sendTechQuoteApprovedEmail` empezaba con
`if (!techEmail) return;` — sin correo del técnico no se mandaba nada **y no quedaba rastro de que
no se mandó**. Al volverse obligatorio el tipo de retorno, TypeScript lo señaló.

## 4 · Qué entra

| Pieza | Dónde |
| --- | --- |
| El vocabulario y el registro | `avisoConstancia.ts` — núcleo PURO + un envoltorio |
| Los tres emisores DEVUELVEN el resultado | `merchantNotifications.ts` (antes lo tragaban) |
| Los cuatro llamadores lo pasan por `conConstancia` | psp · quotes · quotesAdmin · whatsappIncoming |
| El criterio de canal y el de resultado | `tests/_censo-correo.mjs` |

### 🔴 Lo que `conConstancia` NO hace, y es su propiedad más importante

**No se espera y no devuelve promesa.** Un aviso que no sale **no puede tumbar la operación que lo
dispara**: el cobro se registra y el presupuesto se acepta aunque el correo reviente. El `catch` de
las rutas nunca sobró — sobraba que estuviera **vacío**. Hay test que lo fija, y comprueba que
`conConstancia` devuelve `undefined` justamente para que nadie pueda ponerle un `await`.

### El guard de la fase 1 NO se ha relajado

`scrum475-un-solo-emisor.test.mjs` **exige** que `merchantNotifications` siga teniendo
`if (!r.enviado) throw new Error`. Se intentó quitar ese `throw` para simplificar el modelo y **el
guard lo impidió**: se dejó como estaba y se arregló el censo, que era quien medía mal. **7/7 verde.**

## 5 · 🔴 El verde falso que me salió por el camino, y cómo se cazó

Al envolver los cuatro avisos, el censo los marcó `avisa` — y era mentira. Había subido hasta el
`try` de la ruta, que sí contesta… **pero ese `try` no captura nada de esto**: la llamada no se
espera, así que el rechazo de la promesa llega cuando el bloque ya terminó. El veredicto era bueno
**por un motivo que no existe**.

La regla que lo arregla es general y no cuesta nada: **un `try` solo ve la excepción de lo que se
espera con `await`**. Sin ella, cualquier `fire-and-forget` dentro de una ruta con `try/catch`
habría salido «bien atendido» para siempre.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 EL TEST QUE DECIDE** | un «te han pagado» que falla deja rastro, con QUÉ aviso, POR QUÉ y PARA QUIÉN | ✅ |
| **🔴 EL OTRO CANAL** | un fallo DEVUELTO sin excepción también deja rastro — el que se perdía entero | ✅ |
| **CONTROL POSITIVO** | un aviso que SÍ sale no escribe nada: el caso feliz no paga peaje | ✅ |
| **🔴 CONTROL NEGATIVO** | un aviso que revienta **no tumba** el cobro ni la aceptación | ✅ |
| **🔴 SUELO** | si el censo no ve los cuatro, **falla declarándose ciego** | ✅ |
| **Identidad** | el destinatario va enmascarado **y estable**: dos avisos del mismo se cruzan | ✅ |
| **Fase 1** | `scrum475-un-solo-emisor.test.mjs` · **7/7**, sin tocar | ✅ |

### Los rojos por el mecanismo — probados

| Mutación | Cae diciendo |
| --- | --- |
| se vuelve a poner un `.catch(() => {})` | *«HAY AVISOS AL PROFESIONAL QUE PIERDEN SU FALLO: quotes.routes.ts:298 sendMerchantQuoteAcceptedEmail [traga-mudo]»* (+ el trinquete, 9≠8) |
| se ciega el censo (propagación intra-fichero) | *«EL CENSO ESTÁ CIEGO: encuentra 0 llamadas a los avisos del profesional y son CUATRO»* |

## 7 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas de diff) · el emisor único `enviarCorreo.ts` (**cero líneas**) ·
el guard de la fase 1 · la semántica de `throw` de los emisores · el embudo de WhatsApp · el
contenido de ningún correo · el camino de emisión fiscal.

## 8 · Huecos declarados

* **La constancia es un log, no una fila.** Misma frontera que SCRUM-475 fase 1 y fase 2: la tabla
  `EmailMessage` está PREPARADA Y SIN APLICAR en `docs/master/SCRUM-475.md` y
  `prisma/schema.prisma` es del fundador. El día que exista, `registroDeAviso()` **es exactamente la
  fila** que hay que escribir — por eso el núcleo es puro y devuelve un objeto, no una cadena.
* **Ocho sitios siguen perdiendo el fallo**, nombrados en el trinquete. Otro carril.
* **Al profesional no se le DICE nada todavía.** Esta fase deja constancia; avisarle es lo
  siguiente y su texto lo aprueba el asesor (regla 30). Propuesta abajo, **sin implementar**.
* **No verificado en `yaqu.app`**: no se ha provocado un fallo de correo real.
* **Hallazgo de otro carril (regla 37), reportado y NO arreglado:** `quotes.routes.ts:183` tiene
  `notifyMerchantAlert(...).catch(() => {})` — el mismo defecto en el canal de **WhatsApp**, que
  este ticket tiene prohibido tocar. Merece su ticket.

### PROPUESTA de microcopy — PARA, no se implementa

Para cuando el asesor la vea. Lo difícil: decirle al profesional que un aviso no le llegó sin que
parezca que el cobro o la aceptación fallaron —que sí ocurrieron—.

> *«No hemos podido enviarte el correo de aviso. El cobro está registrado igualmente.»*

Queda **sin implementar** hasta que se apruebe.
