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

- `src/modules/billing/domain/cobros.service.ts`: función nueva `listarCobrosConCorreo`, **encima** de
  `listarCobros` (su cuerpo, igual que en `main`: SCRUM-445 fija su `return fundirCobros(...)`). Lee
  `email_messages` de los documentos de la lista (los de los cobros, por el evento `invoiced`, y las
  facturas sueltas), filtra por `merchantId` (regla 2) y por `kind` de factura/justificante. Cada cobro
  trae `correoNoSalio`: `{ invoiceId, clase }` si el **último** intento de ese documento fue
  `fallo_envio`, si no `null`. `GET /admin/cobros` (`cobrosAdmin.routes.ts`) llama a ésta.
  `listarCobros` pierde el `export`: ya sólo la llama su módulo, y el censo de huérfanos (SCRUM-411)
  lo cazó.
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
   → *29-sep-2026:* tapado por **SCRUM-1243** (salvo `invoice_not_found`); ver `docs/master/SCRUM-1243.md`.
2. **`rebotado`**: el correo salió y rebotó. «Enviar de nuevo» a la misma dirección no lo arregla;
   fuera de este ticket.
3. **Un reintento sin respuesta** (red caída, plazo vencido) no pinta texto nuevo: el aviso sigue
   siendo cierto y el botón vuelve a estar a mano. No hay literal firmado para ese caso.

## 5 · Verificación

- `tests/scrum1235-el-correo-que-no-salio.test.mjs`: 12 casos, 12 pass tras el cambio. El de «manda el
  último intento» también va por el camino real: falla, se reenvía con el `sendInvoiceEmail` real y sale
  (se apaga el aviso), y vuelve a fallar (vuelve el aviso).
- Mutaciones con el código quieto: sin pintar el aviso → caen 4 casos de pantalla; sin el chequeo
  `sent:false` → cae el caso del reintento fallido; sin la capa `listarCobrosConCorreo` → caen los 3 del
  servidor. Árbol restaurado cada vez y comprobado con `git diff --quiet`.
- Tanda DIRIGIDA (52 ficheros: cobros, microcopy, correo, huérfanos, 237, 976, 267, 815…): **446 tests ·
  446 pass · 0 fail · 0 skip**. `guards:entrada`: 12 guards, 112 tests, 0 fail.
- Dos rojos de la primera dirigida, arreglados en el CÓDIGO: el censo SCRUM-1157 pedía la firma legible
  encima de los literales, y SCRUM-445 pedía que `listarCobros` siguiera devolviendo
  `fundirCobros({ charges, candidatas, invoiced })` tal cual — de ahí la capa aparte.
- ⚠️ **La tanda completa NO se corrió en local**: el orquestador denegó el turno por memoria de la
  máquina (1,3 GB libres, 28-sep ~16:55Z). La corre el CI del PR.
- Los cinco literales pasan `constaAprobado()` contra el registro de `docs/microcopy/`.

## 6 · SCRUM-1235b · Los dos rojos del CI del PR #1914 (28-sep-2026)

**Medido contra:** `origin/main` = `0afa87cd95645317226f59bc379edae59a7bea44` · 2026-09-28T18:39:10Z (J2, `jv-j2`)

El CI (run 36454899158) dio rojo en dos checks. Diagnosticados antes de tocar nada:

| Check | Qué dijo | Causa | ¿Mío? |
|---|---|---|---|
| `build + tests` · SCRUM-864c ③ | `mkdtempSync` en `tests/scrum1235-…:45` que no se borra nunca | mi test creaba el directorio del PDF y no lo borraba | **sí** → pasa a `temporal()` de `tests/_temporal.mjs` |
| `build + tests` · SCRUM-128 capa a | «llamada a ruta de envío sin comprobar el resultado · `cobrosView.js` (línea 85)» | la línea 85 era **mi comentario JSDoc**, que citaba la ruta literal; el filtro del guard sólo reconoce `//` como comentario. La llamada real (línea 111) sí mira `waSendFailed` | **sí** → el comentario deja de citar la ruta; el guard no se toca (regla 41) |
| `guards de navegador` · `lista-trabajos-917` | «no encuentro «💰 Cobrar el resto» en el terminado con saldo» | **ajeno**: falla IGUAL, con las mismas dos comprobaciones, en el CI de `main` @ `0afa87cd` (run 36457602742, job 109049055105). Mi rama no toca la lista de Trabajos | **no** |

Los dos míos se reprodujeron en local ANTES del arreglo (2 fail) y pasan después. **Error propio:** mi tanda
dirigida de la entrega no incluía `scrum128-*` ni `scrum864*`, y por eso se me escaparon; ahora van dentro:
57 ficheros · **468 tests · 468 pass · 0 fail · 0 skip**, sobre el árbol fusionado con `0afa87cd`.

Hallazgo sobre el guard, sin tocarlo: SCRUM-128 capa a cuenta como CÓDIGO las líneas ` * …` de un
comentario de bloque (`ES_COMENTARIO = /^\s*\/\//`). Hoy eso me dio un rojo falso sobre mi propio
comentario; al revés también podría pasar, porque una mención en un bloque de comentario cuenta como llamada.
