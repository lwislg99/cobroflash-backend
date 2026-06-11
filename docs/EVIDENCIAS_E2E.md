# EVIDENCIAS E2E — VALIDA-0 · V0-1

> Entregable de **V0-1** (master U1.1): verificación end-to-end en **yaqu.app** (producción)
> con evidencias. Parte automatizada ejecutada el **11 jun 2026** con el merchant demo
> (id=1, regla 8). La parte humana (móvil real, WhatsApp a número real, pago tarjeta TEST,
> screen-record) tiene su checklist abajo — **V0-1 no cierra sin ella**.

## 1. Resumen

| Resultado | Detalle |
|---|---|
| ✅ 9 pasos automatizados verificados en prod | login → cliente → quote → landing → firma/aceptación → factura demo → PDF → landings de pago → estados negativos |
| 🐛 3 bugs encontrados y **arreglados** (commit por fix) | P1-8 facturas sin líneas · P1-9 not-found indigno · P2-4 microcopy N5 |
| 📝 4 hallazgos registrados (no bloqueantes del código) | P2-5 recorte 390px (→V0-5) · P3-5 Meta allowed-list · P3-6 email del demo · estado `rejected` sin copy oficial |
| ⏳ Parte humana pendiente | ver §5 |

## 2. Evidencias automatizadas (11 jun 2026, contra https://yaqu.app)

| # | Paso | Resultado | Evidencia |
|---|---|---|---|
| 1 | Login demo (magic link de un solo uso, autorizado por el fundador; sesión revocada al acabar) | ✅ `/admin/me` → merchantId=1 "Electricista prueba", ES, pro, owner | log de sesión |
| 2 | Crear cliente de prueba (teléfono estructuralmente inválido `34000000000`, sin riesgo de spam) | ✅ Customer id=4 con `waOptOut=false` → **columna J3 viva en prod** | respuesta API |
| 3 | Crear quote (2 líneas, IVA 21%, FULL_UPFRONT) | ✅ Quote id=28, total 411,40 € (340 + 21% exacto) | respuesta API |
| 4 | Envío WhatsApp | ⚠️ Meta **#131030** (app en modo restringido → P3-5). Manejo correcto: 200 `ok:false` + mensaje claro (P3-2 ✅), quote conservada en `draft` | respuesta API |
| 5 | Landing pública `/pay/quote/28` (viewport móvil 390px) | ✅ 200: identidad "Demo ES S.L.", líneas, total héroe 411,40 EUR, validez, chip "Pago completo al aceptar", canvas de firma + "Acepto sin firmar" (N5 tras `e80a825`) | `evidencias/v01-pay-quote-28-movil.png` |
| 6 | Aceptación pública (sin firma, con comentario) | ✅ quote→`accepted` con evidencia (acceptedAt, decisionChannel, comentario persistido) + factura creada | respuesta API |
| 7 | Factura demo + PDF | ✅ id=11 `2026-CF-001` y (2ª pasada) id=12 `2026-CF-002` — serie anual correlativa; `demo=true` en API (pantalla); PDF con **watermark "DEMO — no válida fiscalmente"**, desglose IVA (base 350,00 / IVA 73,50 / total 423,50) y VeriFactu (QR + huella con cuota real) | `evidencias/v01-factura-2026-CF-001-demo.pdf` · `v01-factura-2026-CF-002-con-lineas.pdf` |
| 8 | Charge + landing de cobro `/pay/invoice/5` | ✅ charge id=5 creado pese al fallo de WA; landing 200 con CTA "Pagar" (tarjeta; sin IBAN configurado no ofrece transferencia, coherente con M) | `evidencias/v01-pay-invoice-5-movil.png` |
| 9 | Estados negativos (N3) | ✅ tras `0408155`: `/pay/quote/999999` y `/pay/invoice/999999` → **404 con página digna** y copy oficial ("Este enlace no corresponde a ningún documento activo.") | body verificado en prod |

## 3. Bugs encontrados por este E2E y CERRADOS (uno a uno, commit por fix)

1. **P1-8** · La factura creada desde la aceptación pública nacía **sin `lines`** → PDF sin
   desglose de IVA y huella VeriFactu con cuota 0,00; además usaba el total pre-tier.
   Fix `59ce535`; verificado con `2026-CF-002` (desglose + cuota 73,50 reales).
2. **P1-9** · Quote inexistente mostraba el **formulario de firma vacío** (200) y los 404 de
   cobro/recibo eran texto plano. Fix `0408155` (`core/http/publicNotFound.ts` + guards);
   verificado en prod.
3. **P2-4** · Microcopy fuera de N5 ("Acepto sin dibujar firma"). Fix `e80a825`
   ("Acepto sin firmar"); verificado en prod.

## 4. Hallazgos registrados (BUGS.md)

- **P3-5 (usuario, Meta):** la app de WhatsApp está en **modo restringido** (#131030) —
  ningún cliente fuera de la lista de prueba recibe mensajes. Para el E2E móvil: añade tu
  número a la lista de permitidos o pasa la app a producción.
- **P3-6 (decisión):** el email del merchant demo en prod es `luislaragranado@gmail.com`,
  la regla 8 dice `demo@yaqu.app`.
- **P2-5 (→V0-5):** a 390px la columna Total de la tabla de líneas se recorta.
- **Pendiente de copy oficial:** quote en estado `rejected` aún renderiza el formulario de
  aceptar (N3 no define ese estado → propuesta de master).

## 5. Parte HUMANA pendiente (V0-1 no cierra sin esto)

Guion para el screen-record desde el móvil (sin un solo fallo, según U1.1):

- [ ] **Prerrequisito:** tu número en la lista de permitidos de Meta (o app en producción) — P3-5.
- [ ] Crear quote desde el móvil (Quick Quote <30 s) a un cliente con TU número.
- [ ] WhatsApp llega con plantilla correcta (vars + botón "Ver presupuesto").
- [ ] Abrir landing desde el WhatsApp → firmar (canvas) → aceptar.
- [ ] WhatsApp `payment_request_es` llega con botón "Pagar ahora".
- [ ] Pagar con **tarjeta TEST** (4242 4242 4242 4242) en Stripe Checkout.
- [ ] BD: `charge.paid` + `invoice.paid` + `paidAt` + `paid_via='card'` (verificar en dashboard).
- [ ] Email Resend con la factura PDF adjunta llega al email del cliente.
- [ ] WhatsApp de confirmación con el **nº de factura real**.
- [ ] "Abrir PDF" desde el detalle regenera y abre el PDF (con watermark si demo).
- [ ] Capturas de cada paso + screen-record completo → añadir aquí.

---
*Generado durante la verificación automatizada del 11 jun 2026 (sesión demo revocada al
terminar; cliente de prueba id=4 y facturas demo 2026-CF-001/002 quedan como datos demo).*
