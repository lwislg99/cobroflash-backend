# SCRUM-1235 · El correo de la factura que no salió, a la vista del profesional

**Medido contra:** `origin/main` = `ebdb34720e59826865cc8bfbb74563a89660c821` · 2026-09-28T16:35:09Z (J2, `jv-j2`)

GO del fundador y criterio: SCRUM-1235 comentario 17381. Textos: comentario 17384 (firma delegada),
registrados en `docs/microcopy/2026-09-28-SCRUM-1235-correo-que-no-salio.md`.

## 1 · El defecto, medido por el camino real

El envío automático de la factura tras el cobro (`psp.routes.ts`, `mpWebhook.routes.ts`) se traga el
fallo con un `console.error`, y el webhook contesta 200. `enviarPorResend` sí deja la fila
`fallo_envio` en `email_messages`, pero nadie la leía.

Rojo ANTES del cambio, con `tests/scrum1235-el-correo-que-no-salio.test.mjs` (commit 6df07ce4):
el webhook real de `psp.routes`, el `sendInvoiceEmail` real, Resend rechaza (`axios.post` doblado),
`registrarEnvio` real escribe la fila, y `listarCobros` real la devuelve sin nada: **6 casos, 2 pass
(el suelo y la respuesta del webhook), 4 fail con `correoNoSalio: undefined`**.

## 2 · El cambio

- `src/modules/billing/domain/cobros.service.ts`: `listarCobros` lee `email_messages` de los
  documentos de la lista (los de los cobros, por el evento `invoiced`, y las facturas sueltas), filtra
  por `merchantId` (regla 2) y por `kind` de factura/justificante. Cada cobro trae `correoNoSalio`:
  `{ invoiceId, clase }` si el **último** intento de ese documento fue `fallo_envio`, si no `null`.
- `public/dashboard/js/cobrosView.js`: en la celda «Documento», el aviso firmado (`.alert.warning`)
  con «Enviar de nuevo», que llama al `POST /admin/invoices/:id/send-email` que ya existía. Si el
  reintento vuelve con `sent:false`, pinta el `message` del servidor y deja el botón a mano; si sale,
  «✓ Enviado por email».

## 3 · Lo que NO se ha tocado, a propósito

- **La respuesta al proveedor** (criterio ② de 17381): el test fija que el webhook sigue en 200 `paid`
  aunque el correo falle.
- **Los tres `catch`**: no hacía falta. Leer la fila basta para el fallo de Resend, y es el mismo
  `sendInvoiceEmail` en los tres caminos.
- **Pantallas de factura** (`invoiceDetailView.js`, `invoicesAdmin.routes.ts`): son de J1. Sólo se
  llama a su endpoint, no se cambia.
- Ni esquema, ni flags, ni reintentos propios.

## 4 · Huecos declarados (no los tapa este ticket)

1. **`invoice_pdf_unavailable`** (`email.service.ts`) se lanza ANTES de llamar a Resend: ese fallo **no
   deja fila**, y este mecanismo no lo ve. Taparlo exige escribir la fila fuera de `enviarPorResend`:
   ticket aparte.
2. **`rebotado`**: el correo salió y rebotó. «Enviar de nuevo» a la misma dirección no lo arregla;
   fuera de este ticket.
3. **Un reintento sin respuesta** (red caída, plazo vencido) no pinta texto nuevo: el aviso sigue
   siendo cierto y el botón vuelve a estar a mano. No hay literal firmado para ese caso.

## 5 · Verificación

- `tests/scrum1235-el-correo-que-no-salio.test.mjs`: 11 casos, 11 pass tras el cambio.
- Mutaciones con el código quieto: sin pintar el aviso → caen 4 casos de pantalla; sin el chequeo
  `sent:false` → cae el caso del reintento fallido. Árbol restaurado y comprobado con `git diff --quiet`.
- Los cinco literales pasan `constaAprobado()` contra el registro de `docs/microcopy/`.
