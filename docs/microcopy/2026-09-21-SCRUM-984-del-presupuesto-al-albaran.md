# SCRUM-984 · del presupuesto aceptado al albarán: dos rótulos en el registro y un botón

**Aprobado por el orquestador por delegación del fundador** el 2026-09-21 — SCRUM-984 comentario 16105.

## Los literales, tal cual se escriben

Registro de acciones del presupuesto (`public/dashboard/js/quoteActionsRegistry.js`, `QUOTE_ACTION_ROTULOS`):

| acción | rótulo | destino en `accepted` | de dónde sale el texto |
|---|---|---|---|
| `btnCobrar` | `Cobrar ahora` | primaria | el que la pantalla ya pinta («💰 Cobrar ahora»), sin emoji en la tabla |
| `btnNuevoAlbaran` | `Nuevo albarán` | secundaria | el firmado en SCRUM-722 (`atajoNuevo.js`, `TEXTOS.albaranes`) |

La pantalla (`quotesDetailView.js`) NO escribe «Nuevo albarán»: lo lee de `atajoNuevo.textoDe('albaranes')`,
su fuente única, igual que el título del modal del buscador de Albaranes. Un renombre allí llega aquí.

## Lo que sale

`btnCrearTrabajo` = `Crear trabajo`, que la tabla declaraba como primaria de `accepted` (aprobado el
17-ago-2026) y la pantalla nunca pintó: el Trabajo ya no nace en un botón sino al aceptar
(`ensureJobForQuote`, desde el 5-jul-2026, commit `cc39cd71`). La opción M (dejarlo y añadir el albarán
al lado) dejaba el registro y la pantalla diciendo cosas distintas; la firmada es la R.
`btnWhatsApp` de `accepted` pasa a «⋮» para quedar en dos secundarias (Descargar PDF y Nuevo albarán).

## Lo que queda SIN firmar, y por eso NO se escribe

El texto para un presupuesto aceptado **sin Trabajo de origen**. El criterio de aceptación del ticket
pedía «el texto aprobado de `decidirAperturaAlbaran`», y no existe uno que diga eso:

- `sin_presupuesto` («Este trabajo no tiene presupuesto…») dice lo contrario (un Trabajo sin presupuesto);
- los dos motivos del buscador (`sin_trabajo`, `trabajo_no_visible`, en `albaranDesdePresupuestoModal.js`)
  siguen con `[PENDIENTE microcopy oficial]`.

Sin texto firmado que explique por qué no se puede, el botón **no se pinta** (canon de SCRUM-823: un
control que no puede explicarse se quita, no se deshabilita). Si el fundador o el orquestador firman un
literal para ese caso, se añade aquí y la pantalla pasa a deshabilitar-y-decir.
