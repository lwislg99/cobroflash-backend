# SCRUM-1465 · El envío del presupuesto: si el mensaje salió, la ruta dice que salió

**Medido contra:** `origin/main` = `ebd15a90618ea5da432485c048e9b170a221c9b6` · 2026-10-06T12:23:09Z

A9: aviso → cicatriz S1 «La hora de un mensaje o de un ticket se saca de GitHub en el momento de escribirla: calculada desde la última que miré, se adelanta.» — no se pudo comprobar: es una cifra tecleada en un mensaje a otra sesión o en Jira, y ningún guard los lee

Sesión S1 (`s1-6octc`) · rama `scrum-1465-lo-que-salio-salio`. Encargo del orquestador (SCRUM-1443 c.18333):
medir las frases que lee el profesional cuando el envío de un presupuesto no sale. **Este tramo NO
lleva ningún texto.** Lleva el defecto que apareció al medir, que no pide firma.

## El defecto

Enviar un presupuesto son dos pasos: mandar el mensaje y apuntarlo en la base (borrador → enviado, y
la línea del historial). Si el apunte fallaba, la ruta contestaba que el envío no había salido.

| Canal | El mensaje | La ruta contestaba | Dónde |
|---|---|---|---|
| correo | sale 1 | 200 `sent:false`, «No se pudo enviar el email. El presupuesto quedó guardado; puedes reintentarlo.» | `quotesAdmin.routes.ts`, `POST /:id/send-email`: el apunte iba dentro del `try` cuyo `catch` contesta el fallo de envío |
| WhatsApp | sale 1 | 500 `internal_error` | `sendQuote.service.ts`: el `update` lanzaba y llegaba al `catch` de la ruta |

El profesional lee un fallo, reintenta, y el cliente recibe el presupuesto dos veces. **EJECUTADO**
antes de tocar nada, con las sondas de `docs/master/evidencias/SCRUM-1465/` y con el test en rojo.

**Lo que provoca el caso lo fabrico yo:** que la base falle justo después de enviar. No sé cuántas
veces ha ocurrido en producción: nada lo registraba. Lo que está medido es qué contesta la ruta
cuando ocurre.

## El arreglo

En los dos sitios, el apunte va en su propio `try`. Si falla se escribe en el log, con el número del
presupuesto y el estado en que se queda, y la respuesta sigue siendo `sent:true`. Es el contrato que
ya estaba escrito en `src/lib/sendOutcome.ts`: «`sent` es la ÚNICA verdad sobre si la notificación
salió».

Arreglarlo en `sendQuote.service.ts` cubre también a su otro llamador, «Aprobar y enviar» de
mantenimientos (`maintenance.service.ts:509`).

**Lo que el arreglo deja a la vista y hay que saber:** si el apunte falla, el presupuesto sale y se
queda como borrador, sin su línea en el historial. Antes pasaba lo mismo y además se decía que no
había salido. No se reintenta el apunte.

No cambia nada cuando el mensaje NO sale ni cuando la base falla ANTES de enviar: los dos casos
siguen contestando lo de siempre, y el test los tiene como controles.

## Test — `tests/scrum1465-lo-que-salio-salio.test.mjs` (7 casos)

Los handlers de `dist/` por su ruta, con la base doblada (`_envio-doblado.mjs`), el WhatsApp por el
dry-run de la casa y el correo doblado en su módulo. `reqDeSesion` con rol `admin`.

En rojo ANTES de tocar `src/` (BUILD verde): 7 casos, 2 rojos, los dos del defecto. Después, 29
ficheros, **341 de 341**: el nuevo, los 13 que nombran lo tocado y los de casa (`scrum1344`,
`scrum1415`, `scrum126`, `scrum128`, `scrum553`, `scrum1262`, `scrum850`, `scrum850b`, `scrum1294`,
`scrum195`, `scrum406`). **No corrida la tanda entera.**

| Mutante (sobre `dist`; BASE 7/7; comprobado que el fichero cambia y que se restaura idéntico) | Rojos |
|---|---|
| WhatsApp: el apunte que falla vuelve a lanzar | 1, el del WhatsApp |
| correo: el apunte que falla vuelve a lanzar | 1, el del correo |

Cada mutante tumba sólo su caso.

## Lo medido y NO construido: las frases

Está en el ticket, con la tabla para firmar. En corto, por la ruta real y 9 casos más su control:

- La baja, los dos topes diarios y el rechazo de Meta se alcanzan. El aviso de la cuenta demo sólo
  en el merchant 1.
- En el rechazo de Meta el profesional lee el texto de Meta en inglés o el error de red tal cual.
- «WhatsApp rechazó el envío» sale también cuando no llegamos a mandarlo (sin configurar, o no se
  pudo comprobar la baja).
- Si Meta no contesta a tiempo no sabemos si salió, y la frase dice que no.
- «El presupuesto» va a pelo en dos frases de la ruta, sin la palabra del país.
- Las frases de los topes y de la baja son del diccionario compartido `SEND_FAILURE_MESSAGES`, que
  también leen las facturas (J1): no se toca.

Dos cosas que la ruta NO puede saber, dichas al orquestador antes de construir: que fue el plazo
vencido (lo decide `whatsapp.ts`, de J2, y lo devuelve como una cadena) y que el presupuesto se
acaba de crear (sólo recibe el id).

## Errores propios de la tanda

- **Tres horas puestas a ojo** en dos mensajes al orquestador y en la descripción del ticket
  («12:15Z», «12:35Z», «~12:50Z»), calculadas desde la última cabecera que había mirado. La de
  GitHub decía 12:23Z después de la última. Es la línea `A9` de arriba.
- **Un dato fabricado con forma de real:** en la sonda escribí «timeout of 15000ms exceeded» para el
  caso «Meta no contesta», y así salió en la tabla del ticket. El plazo de `whatsapp.ts:423` es de
  10 s. La sonda de evidencias ya lleva 10000. El hallazgo no cambia; el literal sí.

## Lo que NO está hecho

- Ninguna frase (aceptaciones 1, 2 y 4 del ticket): esperan firma. *(Tres de ellas van en el tramo
  SCRUM-1465b, al final de este registro.)*
- **No visto en yaqu.app.** Que la base falle después de enviar no se puede provocar desde fuera:
  sólo lo cubre el test.
- `sendAlbaranParaFirmarWhatsApp` apunta `enviadoParaFirmaAt` ANTES de enviar
  (`albaranWhatsApp.service.ts:133`). Es el orden contrario y no lo he ejecutado: lo nombro.

---

## SCRUM-1465b (6-oct) · tres frases firmadas del WhatsApp que no sale

**Medido contra:** `origin/main` = `a3a2f3b0de69803c1f16444b72a69f6908a5254e` · 2026-10-06T12:33:04Z

A9: aviso → cicatriz S1 «La hora de un mensaje o de un ticket se saca de GitHub en el momento de escribirla: calculada desde la última que miré, se adelanta.» — no se pudo comprobar: es una cifra tecleada en un mensaje a otra sesión o en Jira, y ningún guard los lee

Sesión S1 (`s1-6octc`) · rama `scrum-1465b-frases-del-envio`, encima de la del tramo anterior.
Firma: comentario 18357 del ticket (orquestador, por la delegación de microcopy). Ficha:
`docs/microcopy/2026-10-06-SCRUM-1465-envio-que-no-sale.md`.

### Lo que cambia en `POST /admin/quotes/:id/send-whatsapp`

| Caso | Antes | Ahora |
|---|---|---|
| Meta dice que no · no contesta a tiempo · no llegamos a mandarlo | «No se pudo enviar por WhatsApp: (texto de Meta, o el error de red, o "WhatsApp rechazó el envío"). El presupuesto quedó guardado; puedes reintentarlo.» | «No sabemos si el WhatsApp ha salido. Pregúntale a tu cliente antes de volver a enviarlo.» |
| Tope diario del negocio | la frase del diccionario | «El WhatsApp no ha salido: has alcanzado el tope diario de mensajes. Vuelve a intentarlo mañana o envía el enlace por email.» |
| El cliente está dado de baja | la frase del diccionario | «El WhatsApp no ha salido: este cliente pidió no recibir tus mensajes por WhatsApp. Envíale el enlace por email o SMS.» |
| Tope diario por cliente · cuenta demo | la frase del diccionario | igual |

El motivo (`error`) y el `detail` de la respuesta no cambian. Lo que contestó Meta sigue en `detail`,
y `whatsapp.ts` lo deja en el log y en la fila del mensaje: no se pierde, deja de leerlo la persona.

### La desviación de SCRUM-126, declarada

SCRUM-126 unificó en `SEND_FAILURE_MESSAGES` «un mensaje humano ÚNICO por motivo» para los nueve
envíos del panel. Desde hoy la baja y el tope del negocio se leen de otra forma en un presupuesto
que en una factura o un albarán. Es a propósito y lo aceptó el orquestador (c.18357): lo que el
profesional tiene que hacer no es lo mismo en cada documento. `src/lib/sendOutcome.ts` no se ha
tocado (`git diff` vacío) y `tests/scrum126-send-outcome.test.mjs` tampoco.

**La versión de la FACTURA debería recibir el mismo trato, y es de J1:** `daily_cap` y
`customer_daily_cap` dicen «envíalo por email», un pronombre que apunta al documento. Lo nombro; no
lo toco.

### Lo firmado que NO se ha construido, y por qué

- **El tope por cliente.** La frase firmada dice «WhatsApp no deja mandarle más». El límite es de
  YaQu: `config.WA_CUSTOMER_DAILY_CAP`, 3 al día por defecto, aplicado en `whatsapp.ts` bajo el
  comentario «J6: tope duro … por CLIENTE y día». Se queda con la frase de hoy hasta nueva firma.
- **El correo que no sale.** La frase firmada dice «El email no ha salido. Vuelve a enviarlo.».
  `enviarPorResend` contesta lo mismo si el proveedor dice que no que si no contesta en 15 s, y en
  el segundo caso el correo puede haber salido. Leído, no ejecutado. Se queda como estaba.

Los dos están dichos al orquestador y escritos en la ficha.

### Una rama que no se alcanza y queda imprecisa

`ventana_cerrada` no tiene caso propio en la ruta y caería en «No sabemos si…», cuando ahí se sabe
que no se mandó. No se alcanza desde esta ruta: nadie le pasa `sinPlantilla`. Antes caía en «WhatsApp
rechazó el envío», que tampoco era cierto.

### Test — `tests/scrum1465b-las-frases-del-envio.test.mjs` (9 casos)

Por la ruta de `dist/`. La baja y los topes pasan por los guards de verdad de `whatsapp.ts`; lo que
contesta Meta se dobla con la forma que devuelve su `catch`. Un caso repite las tres frases con un
negocio de México y exige que sean las mismas y que no nombren el documento.

En rojo ANTES de tocar `src/`: 9 casos, 6 rojos; verdes el suelo y los dos controles. Después, 33
ficheros, **386 de 386**. **No corrida la tanda entera.**

| Mutante (sobre `dist`; BASE 9/9; comprobado que cambia y que se restaura idéntico) | Rojos |
|---|---|
| la baja vuelve a la frase del diccionario | 2 |
| el tope del negocio vuelve a la frase del diccionario | 2 |
| el texto de Meta vuelve a la frase | 4 |
| el motivo de Meta se pierde (sin `detail`) | 1 |

### Error propio

Después de confesar arriba las horas puestas a ojo, en el siguiente mensaje al orquestador escribí
«12:31Z (mirada ahora)» sin haberla mirado: eran las 12:28:40Z. La cicatriz ya estaba escrita y no
bastó, que es lo que dice A9 de apuntar.

### Lo que NO está hecho

- **No visto en yaqu.app.** La baja se puede mirar con la cuenta QA marcando la casilla de un cliente
  de prueba; los topes y Meta no se pueden provocar a mano.
- El ticket para J2 (que `whatsapp.ts` devuelva con nombre «sin respuesta de Meta»): pedido por el
  orquestador en el c.18357, sin abrir al escribir esto.