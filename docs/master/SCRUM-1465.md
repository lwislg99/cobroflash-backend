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

- Ninguna frase (aceptaciones 1, 2 y 4 del ticket): esperan firma.
- **No visto en yaqu.app.** Que la base falle después de enviar no se puede provocar desde fuera:
  sólo lo cubre el test.
- `sendAlbaranParaFirmarWhatsApp` apunta `enviadoParaFirmaAt` ANTES de enviar
  (`albaranWhatsApp.service.ts:133`). Es el orden contrario y no lo he ejecutado: lo nombro.
