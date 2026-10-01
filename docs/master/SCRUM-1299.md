# SCRUM-1299 · el respaldo SMTP de los correos con documento también deja fila

**Medido contra:** `origin/main` = `0e86f5def492e4a7dea3cffaca6704de513db149` · 2026-09-30T22:08:14Z (J4, equipo de Javier)

A9: comprobación → `tests/scrum1299-respaldo-smtp-deja-fila.test.mjs`

**GO del fundador:** Javier, 30-sep-2026, «6-Go», a la pregunta del orquestador (`cobroflash-backend-47`)
«¿GO para que el respaldo SMTP deje fila? (La opción A de J4…) Va en `email.service.ts`, el mismo
fichero que tocó 1243 con tu GO.» Él mismo confirmó que `RESEND_API_KEY` **sí** está puesta en
Railway: lo de abajo es un riesgo, no un incidente abierto.

## Qué pasaba (medido sobre `b6243e1c`)

| Camino | Fila al salir | Fila al fallar |
|---|---|---|
| `sendInvoiceEmail` por Resend (`enviarPorResend`) | sí | sí |
| `sendInvoiceEmail`: fallo del PDF, con Resend (SCRUM-1243) | — | sí |
| `sendInvoiceEmail`: fallo del PDF, SIN Resend | — | **no** (la guarda de 1243) |
| `sendInvoiceEmail` por `SMTP_URL` (`transporter.sendMail` directo) | **no** | **no** |
| `sendQuoteEmail` por `SMTP_URL`, el mismo hueco (el ticket no lo nombraba) | **no** | **no** |
| `enviarCorreo` por SMTP, el emisor genérico | sí | sí |

- **El único lector** es `listarCobrosConCorreo` (`cobros.service.ts`, el aviso de SCRUM-1235), y sólo
  lee factura y justificante. Sin filas, un fallo por SMTP no avisaba nunca.
- **El guard `scrum508` estaba VERDE con el hueco dentro.** Su censo mira las llamadas a
  `enviarCorreo`/`enviarPorResend`, y los dos `transporter.sendMail` directos le eran invisibles: no los
  contaba ni a favor ni en contra. El invariante «los cinco dejan fila» nunca cubrió esa población.
- **La premisa «en producción siempre hay Resend» no la impone el código.** No hay guard de arranque.
  Con la clave vacía, `sendInvoiceEmail` caería al outbox `.eml`, devolvería `ok:true` y
  `marcarCorreoEnviado` lo daría por enviado, sin fila. Hoy la clave está puesta (fundador, 30-sep).

## Qué cambia (`src/modules/messaging/domain/email.service.ts`)

- En los dos respaldos, el `sendMail` va en un `try`. Si hay `SMTP_URL`, un fallo deja
  `registrarEnvio(constanciaDeFallo(e))` y sube la MISMA excepción. Si sale por SMTP, deja
  `registrarEnvio(constanciaDeEnvio(null))`, que es `aceptado_sin_identificador`. Es la misma forma que
  `enviarCorreo` por SMTP. No hay ningún escritor nuevo: todo pasa por `registrarEnvio`.
- `sendQuoteEmail` saca su contexto a una constante `registro`, compartida por Resend y el SMTP, como
  hizo 1243 con la factura.
- **La guarda del `catch` de 1243** pasa de «sólo con Resend» a «con Resend o con SMTP». Su motivo
  era que el respaldo no escribía el «salió» que apaga el aviso. Ahora el SMTP lo escribe y el outbox
  sigue sin escribirlo, así que la guarda se queda para el outbox y sólo para él. Quitarla del todo
  habría dejado, en dev sin transporte, un aviso de fallo que no se apaga nunca.

**Lo que NO entra** (orquestador, 30-sep):

- ⛔ El outbox `.eml` sin transporte. Cambiar lo que devuelve afecta a psp, mercadopago, admin y
  dev.routes, y es otra decisión. El test fija que sigue exactamente igual.
- ⛔ El guard de arranque que exija `RESEND_API_KEY` en producción. Toca el arranque de prod: es STOP.
- ⛔ Ningún texto de usuario.

## La comprobación

**Comportamiento** (`tests/scrum1299-respaldo-smtp-deja-fila.test.mjs`, por el camino real: base,
PDF y `nodemailer.createTransport` doblados; `sendInvoiceEmail`, `sendQuoteEmail`, `enviarPorResend`
y `registrarEnvio` son `dist/` tal cual):

- Rojo antes: 4 de 7 caen con el código de `main`. La factura que sale, la que falla, el PDF sin
  Resend y el presupuesto dejan 0 filas. El suelo y los dos controles siguen verdes.
- Verde después: 7 de 7.
- Controles: con Resend, un fallo de Resend deja UNA fila y no dos, y no monta el SMTP (el control
  de 1243); un envío bueno por Resend, una. El outbox sigue devolviendo `{ eml, smtp:false }`.
- Mutación: si se quita del `dist/` el `registrarEnvio` del éxito de la factura, cae ese caso y
  sólo ese. Restaurado con post-condición de sha256.

**Censo** (`tests/_censo-emisores-con-fila.mjs`, censo C, y dos casos nuevos en
`tests/scrum508-los-cinco-dejan-fila.test.mjs`): cada `<algo>.sendMail(...)` de `src/` tiene que
estar en un `try` cuyo `catch` llama a `registrarEnvio`, y tener otro `registrarEnvio` después y
fuera de todo `catch`.

- Hoy ve 3: `enviarCorreo.ts` y los dos de `email.service.ts`.
- Con el `email.service.ts` de `main` en el árbol, cae y los nombra: `:135` y `:249`, «fallo NO ·
  éxito NO». Restaurado con sha256.
- Tiene su autoprueba, con el mismo token en las dos caras. Distingue con fila de sin fila, sólo el
  `catch`, un registro ANTERIOR al envío (el del PDF de 1243) y un comentario.
- ⚠️ **Límite:** el censo no sigue ramas. Un `return` entre el envío y su registro (el outbox) no lo
  ve. Eso lo mide el comportamiento.
