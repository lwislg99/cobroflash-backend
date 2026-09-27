# SCRUM-1163 · Un cliente con solo MÓVIL puede recibir el presupuesto por WhatsApp (parte de pantalla)

**Medido contra:** `origin/main` = `63e33e92c5c7f1f535513e7a52b7126707a34247` · 2026-09-27T16:49:07Z
**Rama:** `scrum-1163-whatsapp-cliente-solo-movil`.
**Sesión:** S2 (front). **Skill UI:** cargada (`yaqu-premium-ui`). La parte de servidor es SCRUM-1166 (S1, ya en main).

## PASO 0 (medido el 27-sep-2026, solo lectura)

- **El envío ya sabía resolver el número:** `sendQuote.service.ts:47/53` usa `tieneNumeroDeContacto` y
  `canalDeWhatsApp` (`src/core/contacto/canalDeWhatsApp.ts`: primero el móvil y, si no hay, el fijo).
  `src/integrations/whatsapp.ts` no hace falta tocarlo: solo se ha leído (regla 1).
- **El que no lo sabía era el detalle:** `quoteAdmin.ts` solo mandaba `phone`. Así que la premisa
  «solo habilitar el botón» no bastaba: hacía falta el dato. Se partió en dos. SCRUM-1166 (servidor)
  añade `customer.tieneNumeroDeContacto`, calculado con la misma función que usa el envío (el móvil
  no viaja, a propósito). Este ticket es la pantalla.

## El arreglo

`quotesDetailView.js`: el botón «📤 Enviar por WhatsApp» / «↻ Reenviar» se habilita con
`customer.tieneNumeroDeContacto`. La pantalla no decide por su cuenta. Si el dato no llega (un servidor
anterior a 1166), se queda el criterio de siempre (`phone`), que es exactamente el comportamiento de
hoy. El texto «El cliente no tiene teléfono de WhatsApp configurado.» no cambia: solo sale cuando no
hay ningún número, y entonces es verdad. **Ningún envío nuevo:** el botón es el mismo, pulsado a mano
(regla 28).

## Tests — contrato de la aceptación, rojo antes y verde después

`tests/scrum1163-whatsapp-cliente-solo-movil.test.mjs` (3 tests), ficha en borrador montada en el
banco, con los tres clientes de la aceptación tal y como los manda el servidor desde 1166:

| Cliente | Contra main | Con el cambio |
|---|---|---|
| solo móvil (`phone: null`, `tieneNumeroDeContacto: true`) | 🔴 FALLA: botón desactivado con el mensaje falso | habilitado |
| solo fijo | pasa (control positivo) | habilitado |
| ninguno | pasa (control negativo) | desactivado con su mensaje |

**Contra main: 1 falla y 2 pasan (3). Con el cambio: 3/3.** Junto con 1160, 1166 y 601: 30/30.

**Tanda completa** (con el TURNO del orquestador, 27-sep ~16:40Z), sobre `33c5e458` (rama con main
`0af96be9` mergeado): **8.586 tests · 8.450 pass · 2 fail · 134 skip**. Los dos fallos son AJENOS:
- `scrum804b` falla bajo carga y **pasa solo** (10/10 en el mismo árbol).
- `scrum910d` cae por `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c`:
  la caída de libuv en Windows, no una aserción del test. Cae igual corrido solo.

Después entró en main SCRUM-1170, que toca `quotesDetailView.js` en otro trozo: merge de main (sin
conflicto) y otra vez los tests de ese fichero y sus vecinos (1163, 1169, 1170, 1160, 1166, 601):
**42/42**. La tanda completa no se repitió: el merge solo trae 1170, que ya pasó su CI en main.

No hay captura: no cambia nada visible salvo el estado del botón, y ese estado lo mide el test.

## Visto al medir, fuera de este ticket (se pasa al orquestador)

- `invoiceDetailView.js:370`: la ficha de la **factura** decide con `invoice.customer.phone`. Es el
  mismo defecto, en una pantalla de Javier (J).
- `jobRailBlocks.js:49`: en la ficha del **Trabajo**, el bloque Cliente pinta «📞» y «💬 WhatsApp» solo
  desde `customer.phone`. Un cliente con solo móvil sale sin ninguno de los dos. Hace falta que el
  servidor mande el número al que llamar, y eso es otra decisión: aquí el número sí se pinta.
