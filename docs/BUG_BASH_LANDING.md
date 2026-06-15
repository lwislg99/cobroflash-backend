# V0-5 · Bug-bash de la landing del cliente

> **Qué es:** la prueba de percepción de las dos pantallas que más gente ve (`/pay/quote/:id`
> y `/pay/invoice/:chargeId`). Regla 1 del master: *la landing del cliente es la pantalla nº1;
> bug visible ahí = **P0 de percepción***. Esta checklist es TUYA (V0-5, founder) y se corre
> en **dispositivos reales**, no en localhost ni en el emulador.
>
> **Spec de referencia:** `YAQU_MASTER.md` → **Parte N** (N1 quote · N2 invoice · N3 estados ·
> N4 performance · N5 microcopy). El microcopy es CERRADO (regla 30): si un texto no coincide
> con N5, es bug.
>
> **Dónde se prueba:** `https://yaqu.app` (prod), merchant demo. NO localhost.
>
> **Qué hacer con cada fallo:** anótalo abajo en "Resultados" y pásalo a `docs/BUGS.md` como
> **P0-percepción** (con captura en `docs/evidencias/`). Un fallo de microcopy/diseño cuenta
> como P0 aunque el flujo "funcione".

---

## 0. Matriz de dispositivos (N4) — los 3 obligatorios

| # | Dispositivo | Navegador | Ancho lógico aprox. | Red |
|---|---|---|---|---|
| D1 | **Android gama media** (p. ej. Galaxy A1x / Redmi) | Chrome | ~360–393 px | 4G real (no WiFi) |
| D2 | **iPhone** (SE o estándar) | Safari | 375–390 px | 4G real |
| D3 | **Tablet** (iPad / Android 10") | Safari/Chrome | 768–834 px | WiFi ok |

> El ancho crítico es **390 px y por debajo** (ahí nació P2-5). Si solo puedes forzar uno en
> DevTools además de los reales, usa **390 px** y **360 px**.

**Cómo conseguir enlaces de prueba (demo):** crea un presupuesto demo y úsalo para `/pay/quote`;
acéptalo para generar el cobro y usar `/pay/invoice`. Recuerda que el demo solo envía WhatsApp
a `DEMO_SAFE_NUMBERS`, pero las URLs se pueden abrir directas en cualquier dispositivo.

---

## 1. PRIORITARIO — verificar P2-5 (regresión de la columna Total)

**Contexto:** `BUGS.md` P2-5 cerrado en `e57eed4` (`lines-table` con `table-layout:fixed`,
Total 100/92 px, `tabular-nums`, `nowrap`). **Falta la verificación en dispositivo real (V0-5).**

- [ ] **D1/D2/D3 · `/pay/quote/:id` con líneas de importe largo** (≥ 1.000,00 € y decimales):
      la columna **Total NO se recorta** ("250…", "90.00 E…" = FALLO). El importe se ve entero.
- [ ] La columna **Cant.** no se come el ancho del concepto; el concepto hace wrap, no overflow.
- [ ] Con **3 tiers (Good/Better/Best)** los importes de cada tier tampoco se recortan.
- [ ] Total con **IVA desglosado** (ES) legible y cuadrado (no se sale de la tarjeta).

---

## 2. `/pay/quote/:id` — contra N1

**Header**
- [ ] Logo del negocio (o inicial sobre brand-tint si no hay logo) + **nombre comercial/legal**.
- [ ] "**Presupuesto #N**" correcto + validez si existe.

**Cuerpo**
- [ ] Líneas: SOLO precios de venta. **JAMÁS** aparece coste ni margen (fuga de datos = P0).
- [ ] Tiers GBB si los hay, bien diferenciados y seleccionables en móvil (tap targets ≥ 44 px).
- [ ] **Total con IVA desglosado** (ES) + condiciones de pago en una frase humana
      ("Señal del 50 % al aceptar · resto al terminar") + política de señal si aplica.

**Aceptar (N1 + N5)**
- [ ] Canvas de firma **fluido con el dedo** (sin lag, sin scroll de la página al firmar).
- [ ] Alternativa "**Acepto sin firmar**" (checkbox + nombre tecleado) — texto EXACTO N5.
- [ ] CTA **"Firmar y aceptar"** SIEMPRE **verde de marca** (nunca rojo — regresión P1-1).
- [ ] Tras aceptar: "**¡Presupuesto aceptado y firmado! [Negocio] ya tiene tu confirmación.**"
      (concordancia masculina — regresión P1-4).

**Rechazar**
- [ ] "**No me interesa**" → dropdown de motivo + comentario; el botón de rechazo en rojo.
- [ ] El motivo/comentario reales se guardan (no el genérico "Rechazado desde enlace" — P1-3).

**Duda**
- [ ] "💬 Tengo una duda" abre `wa.me/<tel del PRO>` con texto prerelleno y el **#N correcto**.

---

## 3. `/pay/invoice/:chargeId` — contra N2

- [ ] **Nº de factura aparece UNA sola vez** (regresión P1-2: "CF000006 · CF000006").
- [ ] Selector de método según **matriz W4** por importe:
  - [ ] ≤ 500 € → **Bizum + Tarjeta** como botones, transferencia como enlace.
  - [ ] 500–1.000 € → **Tarjeta** principal, Bizum secundario.
  - [ ] > 1.000 € → **Tarjeta + transferencia** (Bizum oculto).
- [ ] CTA "**Pagar [importe]**" con el importe real (N5).
- [ ] Transferencia: **IBAN + referencia** con botón **Copiar** que funciona en móvil
      ("Copiar IBAN" / "Copiar referencia" — N5) y feedback al copiar.
- [ ] Bizum manual: móvil del pro + importe + concepto **copiables** + "El profesional
      confirmará tu pago".
- [ ] "Pagar con tarjeta" llega a Stripe Checkout **sin 401** (regresión P0-1).

---

## 4. Estados — contra N3 (diseño digno SIEMPRE, jamás JSON crudo)

Abre cada estado y comprueba que NO sale stacktrace ni JSON:
- [ ] **Pagado** → recibo verde, cifra grande, "Descargar factura (PDF)" (o "justificante"
      pre-SIF), fecha/método.
- [ ] **Aceptado ya** → "Ya aceptaste este presupuesto el [fecha]" + siguiente paso.
- [ ] **Rechazado** → "Rechazaste este presupuesto el [fecha]. ¿Has cambiado de opinión?
      Pídele uno nuevo a [Negocio] 👇" + botón WhatsApp (copy oficial N3).
- [ ] **No encontrado** (`/pay/quote/999999`, `/pay/invoice/999999`) → página digna
      "Este enlace no corresponde a ningún documento activo…", nunca texto plano (P1-9).
- [ ] **Error de pago/genérico** → mensaje claro + Reintentar + botón duda. Cero stacktraces.

---

## 5. Percepción transversal (todos los dispositivos)

- [ ] Nada se sale del viewport en horizontal (sin scroll lateral) a 360 / 390 px.
- [ ] Tipografía legible sin zoom; jerarquía clara (DESIGN.md); contraste suficiente al sol.
- [ ] Tap targets ≥ 44 px; nada queda tapado por el notch/barra inferior.
- [ ] Carga **< 1,5 s en 4G** (N4); sin "salto" de layout al cargar el logo (lazy ok).
- [ ] Tono N5: humano, claro, **cero jerga de pasarela** ("transacción", "gateway", "payload").
- [ ] Demo: marca de agua/identidad demo visible donde corresponda (no parece producción real).
- [ ] Idioma 100 % ES en el demo (sin "cotización" suelto — P1-5).

---

## Resultados

| Dispositivo | Pantalla | Hallazgo | Severidad | Captura | → BUGS.md |
|---|---|---|---|---|---|
| | | | | | |

> **Cierre de V0-5:** los 3 dispositivos pasados, P2-5 verificado en real, y todos los fallos
> de percepción o bien resueltos o registrados como P0-percepción en `BUGS.md`. Marca entonces
> V0-5 en `PENDIENTES_FUNDADOR.md` y en la Parte U del master.

*Creado el 15-jun-2026 para V0-5 (VALIDA-0).*
