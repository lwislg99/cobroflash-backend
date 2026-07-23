# RUNBOOKS — YaQu

> Derivado de `docs/YAQU_MASTER.md` Parte O (única fuente de verdad). Formato fijo:
> **Síntoma → Dónde mirar → Acción → Qué decir al merchant → Prevención.**
> Si un incidente no encaja en ningún runbook: registrarlo en `docs/BUGS.md` y proponer
> el runbook nuevo como cambio de master.

---

## R1 · WhatsApp no llega

- **Síntoma:** el merchant dice que su cliente no recibió el presupuesto/factura por WhatsApp.
- **Dónde mirar:** logs de Railway (errores `[WhatsApp]`); en F2, `WhatsAppMessage.status`.
- **Acción:** código `131026` → el destinatario no tiene WhatsApp: no reintentar.
  `#132000`/`#132001` → bug de variables o de plantilla: **NO reintentar**, abrir issue en
  `docs/BUGS.md` (el guard J7 debería haberlo impedido). Mientras tanto: botón **Copiar enlace**.
- **Qué decir al merchant:** "Ese número no tiene WhatsApp (o el mensaje no salió). Copia el
  enlace del presupuesto y mándaselo por SMS o llámale."
- **Prevención:** validación J7 de variables antes de llamar a Meta; test
  `tests/whatsappTemplates.test.mjs` en verde antes de cada deploy.

## R2 · Plantilla rechazada o pausada por Meta

- **Síntoma:** los envíos de una plantilla empiezan a fallar; Meta la marca rechazada/pausada.
- **Dónde mirar:** WhatsApp Manager (estado de la plantilla) + logs de Railway.
- **Acción:** activar el fallback manual: mensaje completo prearmado para que el pro lo envíe
  desde su WhatsApp personal. Corregir y re-someter la plantilla en Meta (**acción del
  usuario/fundador**, ver `docs/WHATSAPP_TEMPLATES.md`). **No tocar nombres de plantilla en código.**
- **Qué decir al merchant:** "WhatsApp está revisando nuestra plantilla; mientras tanto te
  preparamos el mensaje para que lo mandes tú con un toque."
- **Prevención:** categoría Utility, cero marketing (J6); cambios de plantilla solo vía spec.

## R3 · Pago cobrado pero webhook perdido

- **Síntoma:** el cliente pagó con tarjeta pero el cobro sigue `pending` y la factura impagada.
- **Dónde mirar:** Dashboard de Stripe → buscar la Checkout Session por importe + fecha.
- **Acción:** si en Stripe está `paid`: marcar manualmente cobro + factura como pagados
  (auditado, `paid_via='card'`, anotar el event id de Stripe en la nota).
- **Qué decir al merchant:** "El pago está confirmado en la pasarela; ya lo hemos reflejado.
  No se cobró dos veces."
- **Prevención:** `scripts/reconcile-stripe.mjs` (F2) + idempotencia por `event.id`.

## R4 · Stripe Connect en estado `restricted`

- **Síntoma:** merchant con Connect activo deja de poder cobrar con tarjeta.
- **Dónde mirar:** webhook `account.updated` / Dashboard Stripe del conectado (`connectStatus`).
- **Acción:** banner "Stripe necesita un dato más" + link al onboarding de Connect; la opción
  tarjeta se desactiva sola y la landing vuelve a transferencia/Bizum. Avisar al merchant.
- **Qué decir al merchant:** "Stripe te pide un dato más para seguir procesando tarjetas
  (2 min). Mientras, tus clientes pueden pagarte por Bizum o transferencia."
- **Prevención:** monitorizar `account.updated`; checklist de readiness en Configuración.

## R5 · Bizum confirmado por error

- **Síntoma:** el pro confirmó "Bizum recibido" sin haberlo recibido.
- **Dónde mirar:** charge (`paid_via='bizum_manual'`) y si la factura asociada fue remitida al SIF.
- **Acción:** factura **NO remitida** al SIF → "Deshacer pago" (acción admin, auditada).
  Factura **remitida** → rectificativa **R1** + nueva factura si procede. **Nunca editar la emitida.**
- **Qué decir al merchant:** "Lo hemos deshecho/rectificado; la numeración queda correcta de
  cara a Hacienda. Confirma solo cuando veas el Bizum en tu banco."
- **Prevención:** doble confirmación en UI ("¿Has recibido X € de Y en tu Bizum?").

## R6 · Transferencia que no llega

- **Síntoma:** cobro por transferencia lleva días en `pending`.
- **Dónde mirar:** nada que arreglar en sistema: `pending` es el estado correcto por diseño.
- **Acción:** los recordatorios 7/14d actúan solos (J6). Botón para reenviar los datos
  (IBAN + referencia) con un toque. **No marcar pagado "por confianza".**
- **Qué decir al merchant:** "El cobro sigue pendiente; le hemos recordado al cliente los
  datos. Márcalo pagado solo cuando lo veas en tu cuenta."
- **Prevención:** referencia única por cobro (`CF-YYYYMMDD-XXXX`) para casarlo en el banco.

## R7 · SIF (AEAT) rechaza registros

- **Síntoma:** `VfSubmission` en `rejected`; la cola acumula intentos.
- **Dónde mirar:** `VfSubmission.lastError` + logs del módulo `fiscal/verifactu`.
- **Acción:** error de **dato de factura** → corregir vía R1 si está emitida. Error
  **estructural** (XSD/firma) → `SIF_ENABLED=false` + avisar al asesor; la emisión local
  sigue y la cola remite al reanudar. Documentar en `docs/VERIFACTU_EVIDENCIAS.md`.
- **Qué decir al merchant:** "Tus facturas siguen emitiéndose con normalidad; la remisión a
  la AEAT se reanuda en cuanto cerremos la incidencia técnica. No tienes que hacer nada."
- **Prevención:** validación contra XSD antes de enviar; retry con backoff; `manual_review`
  a partir de 5 intentos (Parte L).

## R8 · "Abrir PDF" falla

- **Síntoma:** el botón/enlace de PDF devuelve error o un documento vacío.
- **Dónde mirar:** la ruta on-demand regenera el PDF; si re-falla → log de `pdf.service`.
- **Acción:** reintentar por la ruta on-demand (regenera). Si persiste, issue con el id del
  documento. **Nunca enlazar `pdfUrl` crudo** (siempre la ruta que regenera).
- **Qué decir al merchant:** "Vuelve a abrirlo desde el botón del detalle; se regenera al
  momento. Si sigue fallando ya lo tenemos localizado."
- **Prevención:** QA de PDFs por release (quote firmado, factura, R1 negativa, watermark demo).

## R9 · Email no llega

- **Síntoma:** el cliente/merchant no recibe el email (PDF, confirmación...).
- **Dónde mirar:** dashboard de Resend → estado del envío (bounce/spam/etc.).
- **Acción:** bounce → verificar la dirección y reenviar. Problema de dominio → revisar DNS
  de `yaqu.app` (SPF/DKIM).
- **Qué decir al merchant:** "Revisa que el email del cliente esté bien escrito y mira su
  carpeta de spam; te lo reenviamos ya."
- **Prevención:** dominio verificado en Resend; emails transaccionales únicamente.

## R10 · Anular o rectificar una factura

- **Síntoma:** el merchant pide cambiar/borrar una factura emitida.
- **Dónde mirar:** la factura y su estado de remisión al SIF.
- **Acción:** importe/datos erróneos → **rectificativa R1** (serie propia). Duplicado total →
  **anulación** (post-SIF, con su registro de anulación). **Flujo único, sin ediciones ni
  borrados** (regla 29).
- **Qué decir al merchant:** "Una factura emitida no se puede editar (es lo que exige la
  normativa): hacemos una rectificativa que la corrige y queda todo trazado."
- **Prevención:** UI no ofrece editar/borrar emitidas; solo "Rectificar" / "Anular".

## R11 · El merchant pide sus datos o se da de baja

- **Síntoma:** solicitud RGPD de export o baja.
- **Dónde mirar:** módulo `exports`; Parte S4 del master (plazos y anonimización).
- **Acción:** entregar export en CSVs (+ zip de PDFs en F2) + XML RRSIF (post-SIF). Baja:
  clientes con facturas NO se borran → anonimizar según S4.
- **Qué decir al merchant:** "Te llevas todos tus datos en formatos estándar. Las facturas
  emitidas debemos conservarlas el plazo legal, anonimizando lo demás."
- **Prevención:** exports siempre disponibles (RGPD, incluido en todos los planes).

## R12 · Rollback de flags

- **Síntoma:** una feature recién activada causa un incidente.
- **Dónde mirar:** tabla de flags (Parte P) — cada flag tiene rollback seguro documentado.
- **Acción:** orden fijo: **apagar flag → verificar flujo legacy → comunicar**.
  `WHATSAPP_TEMPLATES_ENABLED` global solo se toca en incidente grave con Meta.
- **Qué decir al merchant:** "Hemos desactivado temporalmente esa función; todo lo demás
  sigue funcionando con normalidad."
- **Prevención:** cambios de flag global = stop condition (OK del fundador) + auditados.

## R13 · "Mi cliente tiene una inspección"

- **Síntoma:** un merchant (o su gestoría) pide documentación para una inspección de Hacienda.
- **Dónde mirar:** módulo exports (XML RRSIF) + facturas PDF + declaración responsable vigente.
- **Acción:** entregar: export XML RRSIF + facturas en PDF + declaración responsable +
  guía de 1 página del pack gestoría (S1-H).
- **Qué decir al merchant:** "Aquí tienes el paquete completo que entiende cualquier gestoría:
  registros oficiales, facturas y nuestra declaración responsable."
- **Prevención:** pack gestoría preparado y versionado por release (S1-E/S1-H).

## R16 · Fijar `INTERNAL_API_SECRET` a mano (más de una réplica)

- **Síntoma:** hay más de una réplica de la API detrás del balanceador — un self-call
  interno (webhooks de pago → `/webhooks/psp`, `invoiceWhatsApp` → `/charges`) podría
  aterrizar en una réplica con un secreto aleatorio distinto (`internalAuth.ts`
  genera uno **por proceso** si la env var no está puesta) y fallar con 404.
- **Dónde mirar:** `src/core/http/internalAuth.ts` — el guard solo exige
  `.length >= 16` **caracteres** si se fija a mano, no entropía real. El fallback
  automático sin la env var sí genera 256 bits reales (`crypto.randomBytes(32)`).
- **Acción:** fijar `INTERNAL_API_SECRET` en Railway (mismo valor en TODAS las
  réplicas) generándolo así, nunca a mano con una frase:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
  Una frase legible de 16-20 caracteres pasa el check de longitud pero tiene
  muchísima menos entropía que el fallback automático — no la uses.
- **Prevención:** mientras haya una sola réplica, no fijar esta variable — el
  fallback aleatorio por-proceso ya es más fuerte que cualquier valor manual.

## R14 · Disputa de tarjeta (chargeback)

- **Síntoma:** webhook `charge.dispute.created` (Connect; los direct charges caen en la
  cuenta del MERCHANT).
- **Dónde mirar:** Dashboard Stripe de la cuenta conectada + el documento asociado al charge.
- **Acción:** aviso al pro por WA/BO + **paquete de evidencia en 1 clic**: presupuesto firmado,
  evidencia de aceptación (timestamp/IP/user-agent), factura y mensajes de entrega.
- **Qué decir al merchant:** "Tienes la firma digital del cliente y toda la traza: adjuntamos
  el paquete de evidencia a la disputa. Las firmas ganan disputas."
- **Prevención:** firma/aceptación con evidencia SIEMPRE antes de cobrar — y úsese como
  argumento de venta.

## R15 · Pago parcial o sobrepago (V4/V5 — A21.2, nada automático en F1)
**Señal:** al marcar una factura como pagada, el importe recibido NO coincide con el total
(el BO lo pregunta siempre); o el banco muestra un abono distinto al esperado.
1. NO la marques pagada. Al meter el importe real, el BO la deja **pendiente** y anota el
   evento en la ficha del cliente (⚠️ importe distinto — parcial o sobrepago).
2. **Parcial (V4):** habla con el cliente — o llega el resto (la factura sigue pendiente y
   los recordatorios siguen su curso) o pactáis ajustar: rectificativa R1 + factura nueva
   por el importe real (R10). JAMÁS "pagada" sin estar completa: el justificante miente.
3. **Sobrepago (V5):** devuelve la diferencia por el MISMO canal por el que llegó
   (transferencia/Bizum), guarda el resguardo, anota la devolución en las notas del
   cliente y ENTONCES márcala pagada con el importe exacto del total.
4. Entidad Refund automática = F2: no existe a propósito. Todo movimiento de vuelta es
   manual y con resguardo.

