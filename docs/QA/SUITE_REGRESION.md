# SUITE DE REGRESIÓN E2E — v1.6 (SCRUM-38 · fixes SCRUM-42/36 · albaranes SCRUM-14 · alineación UI real SCRUM-43/44 · seguridad PDF SCRUM-48 · autoría operario SCRUM-22 · albarán-WA SCRUM-47)

> Guion que Claude Code ejecuta con el **Playwright MCP** contra **STAGING** tras cada
> merge+deploy. Cubre la regresión de PAGOS-FLEX (SCRUM-27/32/34) y los CTAs de invoice
> (SCRUM-35). Los hallazgos se REPORTAN (regla 9), no se arreglan sobre la marcha.
> Prerequisito: seed corrido (`scripts/seed-staging.mjs`) y las 3 env vars `E2E_*` en staging.

## Variables

- `BASE` = URL de staging (p.ej. `https://<staging>.up.railway.app`)
- `QA_EMAIL` = email del merchant seed (default `qa@staging.yaqu`)
- `QA_SECRET` = valor de `E2E_TEST_LOGIN_SECRET` en staging

## 0 · Login de test

1. `POST {BASE}/auth/test-login` con JSON `{ "email": QA_EMAIL, "secret": QA_SECRET }`
   (vía `page.request` o formulario; la cookie `pf_session` queda en el contexto).
   - ✅ ASSERT: respuesta `{ ok: true }` y cookie de sesión presente.
2. Navegar a `{BASE}/dashboard/` → ✅ ASSERT: carga el Home (no redirige a `/login.html`).
3. **(v1.1, SCRUM-36)** Si aparece el modal de onboarding ("Bienvenido a YaQu" — merchant
   recién sembrado), **descartarlo** ("Saltar por ahora" / cerrar) ANTES de capturar
   pantallas. Los asserts DOM no lo necesitan, pero las capturas de evidencia sí.

## 1 · Plan custom 30/40/30 de 100,01 € (SCRUM-27/32/34)

3. Ir a Presupuestos → abrir el presupuesto "Obra QA por hitos (30/40/30)".
4. ✅ ASSERT "Condiciones de pago" muestra el plan: `Anticipo 30% · Hito 1 40% · Hito 2 30%`
   (NUNCA "Sin condiciones específicas").
5. Botón de facturas — generar los 3 tramos SIN tocar el Trabajo (sin marcar Terminado):
   a. ✅ ASSERT botón = `Generar siguiente tramo: Anticipo (30,00 €)` → click.
   b. ✅ ASSERT botón = `Generar siguiente tramo: Hito 1 (40,00 €)` → click.
   c. ✅ ASSERT botón = `Generar siguiente tramo: Hito 2 (30,01 €)` → click.  ← céntimo impar
   d. ✅ ASSERT botón = `Plan de facturación completado` (deshabilitado).
6. ✅ ASSERT: la sección Facturas lista 3 justificantes con importes **30,00 + 40,00 + 30,01**
   (suma EXACTA 100,01 — SCRUM-32). **(v1.4, SCRUM-44)** El estado pendiente NO aparece como
   literal "Pendiente" en esta lista: se infiere de que cada tramo sin cobrar muestra el botón
   **"Marcar como pagada"** — el assert comprueba que los 3 tramos tienen ese botón visible.
   **(v1.1, SCRUM-42)** ✅ ASSERT: los números de documento empiezan por **`J-`** (serie de
   justificante de merchant REAL — el seed quema el id 1; si sale `2026-…` el merchant QA ha
   caído en semántica demo) y **sin watermark "DEMO"** en pantalla.
7. CTAs de invoice (SCRUM-35): en el primer tramo → click **"Marcar como pagada"**.
   **(v1.4, SCRUM-43)** ✅ ASSERT: aparece la confirmación nativa
   `¿Marcar como pagada la factura {número} de {importe}?` con el número del justificante y su
   importe correctos → aceptarla (con el Playwright MCP: `browser_handle_dialog` accept; si se
   cancela, la factura NO cambia de estado).
   **(v1.4, SCRUM-44)** ✅ ASSERT: tras confirmar, el CTA de cabecera pasa a
   **"Ver cobro pendiente"** (quedan tramos sin cobrar; el texto "Ver justificante" del v1.1
   no era el real) — o el tramo se muestra pagado tras recargar el detalle.

## 2 · Preset 50/50 — regresión BYTE A BYTE (deuda del E2E de SCRUM-34)

8. Abrir el presupuesto "Trabajo QA 50/50" (200,00 €).
9. ✅ ASSERT "Condiciones de pago" = `50% al aceptar, 50% al finalizar` (texto REAL de
   `getPaymentTermsLabel` en el detalle — v1.1: el v1 traía por error el texto de la preview).
10. ✅ ASSERT botón = `Generar 1ª factura (50%)` → click.
11. ✅ ASSERT botón = `Generar 2ª factura (50% restante)` → click.
12. ✅ ASSERT botón = `Plan de facturación completado` (deshabilitado) y 2 justificantes de 100,00 €.

## 3 · Preset 100% — sin regresión

13. Abrir "Trabajo QA 100%" (150,00 €).
14. ✅ ASSERT "Condiciones de pago" = `Pago 100% al aceptar` (texto REAL del detalle — v1.1).
15. ✅ ASSERT botón = `Generar factura (100%)` → click → ✅ ASSERT `Factura ya generada`
    (deshabilitado) y 1 justificante de 150,00 €.

## 4 · Cero envíos reales (evidencia obligatoria)

16. Logs del servicio staging: los envíos de WhatsApp aparecen como dry-run (wamid `dryrun.*`)
    y NINGUNA llamada a `graph.facebook.com`; sin `RESEND_API_KEY` los emails van a
    buffer/outbox/console. ✅ ASSERT: ni un mensaje real de WhatsApp ni email real.
17. (Si accesible) `/outbox` o log WA-0b como evidencia adjunta al reporte.

## 5 · Albaranes (v1.3, SCRUM-14 — documento NO fiscal)

> Prerequisito: seed con Jobs (el seed crea un Trabajo por quote aceptada desde v1.3).

18. Ir a Trabajos → abrir el Trabajo de "Obra QA por hitos (30/40/30)" → sección **Albaranes**.
19. Click **"+ Nuevo albarán"** → ✅ ASSERT: aparece con número **`ALB-<año>-001`**, estado
    **Borrador**, `v1`. Crear un segundo → ✅ ASSERT `ALB-<año>-002` (correlativo, serie propia
    del merchant, independiente de la serie de facturas/justificantes).
20. **Editar borrador**: "Editar líneas" → añadir línea (concepto/cantidad/unidad, SIN precio)
    → Guardar → ✅ ASSERT **v2** visible. Línea inválida (concepto vacío o cantidad 0) →
    ✅ ASSERT error 400 claro y NO se guarda.
21. **Emitir** → ✅ ASSERT estado **Emitido**; botones ahora [PDF] [Firmar] [Editar líneas].
22. **PDF** → se abre por el endpoint **auth** `GET /admin/albaranes/:id/pdf` (el botón "PDF"
    de la UI ya apunta ahí). ✅ ASSERT: título "ALBARÁN / PARTE DE TRABAJO"; SIN la palabra
    "factura" como título, SIN QR, SIN serie J-, **SIN importes/precios** (solo
    concepto·cantidad·unidad); pie: "Documento no fiscal — no constituye factura…".
22b. **(v1.5, SCRUM-48) Seguridad del PDF:** `GET {BASE}/albaranes/<archivo>.pdf` SIN cookie
    (tanto `ALB-<año>-001.pdf` como `<merchantId>-ALB-<año>-001.pdf`) → ✅ ASSERT **404** y
    content-type ≠ `application/pdf` (el estático público se eliminó; los PDF llevan firma y
    datos personales). El PDF SOLO sale por el endpoint auth del paso 22.
23. **Firmar** (canvas en el móvil del pro) → ✅ ASSERT estado **Firmado** + el PDF regenerado
    incluye el bloque "Conformidad del cliente" con la firma.
24. **Congelado**: en un albarán Firmado → ✅ ASSERT no hay botones de edición en la UI y el
    `PATCH /admin/albaranes/:id` responde **409 `albaran_locked`**.
25. **Foto**: "📷 Añadir foto" en un albarán no firmado → ✅ ASSERT miniatura visible tras
    subir (límites: jpeg/png/webp, ≤5 MB, máx. 10).
26. **Tenancy**: con sesión de OTRO merchant (si la allowlist E2E lo permite),
    `GET /admin/albaranes/:id` del albarán anterior → ✅ ASSERT 404. (Si no hay segundo
    merchant en staging, queda cubierto por `tests/albaran.test.mjs`.)
27. Cero envíos: los albaranes NO envían WhatsApp ni email en V1 → el log WA-0b no crece.
    **(v1.6, SCRUM-47)** OBSOLETO para el albarán FIRMADO: ahora sí se envía por WhatsApp a mano
    desde el §6 (los albaranes borrador/emitido siguen sin enviar nada).

## 6 · Enviar el albarán FIRMADO por WhatsApp (v1.6, SCRUM-47)

> **Precondiciones del paso (hallazgos v1.6):**
> - **El seed NO crea albaranes** → este paso necesita un albarán en estado **Firmado**.
>   Reutiliza el del §5.23, o créalo por API en la misma sesión autenticada:
>   `POST /admin/jobs/:id/albaranes` → `POST /admin/albaranes/:id/emitir` →
>   `POST /admin/albaranes/:id/firmar` (`{ signatureData: <data-URI PNG> }`).
> - **Onboarding wizard tras el reseed:** el merchant QA queda con onboarding incompleto, así
>   que `#onboarding-backdrop` **intercepta los clicks**. Descártalo (§0.3) o elimínalo por JS
>   ANTES de pulsar el botón, o el click del Playwright MCP hará **timeout**.

28. En el detalle del Trabajo, sobre el albarán **Firmado** → ✅ ASSERT las acciones son
    **[PDF] [Enviar por WhatsApp]**. El botón nuevo aparece **SOLO en Firmado** (en Borrador/Emitido
    no). `jobDetailView.js` NO está en el SHELL del SW → llega fresco, sin bump de `CACHE_NAME`.
29. Click **"Enviar por WhatsApp"** → ✅ ASSERT `POST /admin/albaranes/:id/enviar-whatsapp`
    responde **200 `{ ok: true }`** (toast "✓ Albarán enviado por WhatsApp." — efímero; la verdad
    autoritativa es el body + el log WA-0b del paso 30).
30. ✅ ASSERT log WA-0b: fila `type:'template'`, `templateName:'albaran_firmado_es'`,
    `relatedType:'albaran'`, `relatedId:<id>`, `status:'sent'`. **staging corre `WHATSAPP_DRY_RUN=1`**
    → `waMessageId` = `wamid.dryrun.*` y CERO llamada a `graph.facebook.com` (coherente con §4). El
    E2E valida wiring + guards (V0-2/J3/A3.2/J6/J7) + log + UI, **NO** la aceptación real de la
    plantilla por Meta (depende de `albaran_firmado_es` Approved en la WABA de PROD).
31. **Negativos (cubiertos por `tests/scrum47-enviar-albaran-wa.test.mjs`, gateado):** no-firmado
    → 409 `albaran_no_firmado`; cliente sin teléfono → 409 `sin_telefono`; tenancy (merchant ajeno)
    → 404. Desde la UI el botón solo existe en Firmado, así que el 409 no-firmado no es alcanzable
    con el botón.

## 7 · Operarios — autoría en el Trabajo (SCRUM-22)

> Cobertura del read-path de autoría. La verificación automática vive en
> `tests/scrum52-operario.test.mjs` (write-path: operarioId poblado + audit + índice) y
> `tests/scrum22-operario-readpath.test.mjs` (serializer operario:{id,name} + owner null + tenancy),
> ambos en `npm test` (gate `QA_DB_TEST=1`).

31. Contrato en staging (JSON, sin UI): `GET {BASE}/admin/jobs` y `GET {BASE}/admin/jobs/:id`
    → ✅ ASSERT cada Job trae `operarioId` y `operario` (`{id,name}` o `null` para el propietario).
32. Propagación a documentos (SCRUM-22 DONE): en `GET {BASE}/admin/jobs/:id` → ✅ ASSERT cada
    entrada de `albaranes[]` y el objeto `charge` exponen `operario` (misma autoría del Trabajo,
    `{id,name}` o `null`).
33. **(SCRUM-57) Render visible en el detalle:** abrir un Trabajo → ✅ ASSERT en la cabecera un chip
    **"👷 Responsable: {nombre}"** = el nombre del operario si `job.operario` no es null, o el nombre
    del NEGOCIO (vía `/admin/merchant`) si el Trabajo es del propietario (`operario` null). `window.appUserName`
    NO sirve (es el usuario logueado). `jobDetailView.js` NO está en el SHELL del SW → sin bump de `CACHE_NAME`.

## Resultado

- Reportar por paso: ✅/❌ + captura del MCP donde aporte.
- Cualquier ❌ = HALLAZGO → ticket aparte en Jira (regla 9). La suite no arregla nada.
- Nota de estado: los pasos 5-7 alteran la BD staging (tramos emitidos/pagados). Re-ejecutar
  la suite requiere re-sembrar (borrar el merchant QA o usar un `E2E_QA_EMAIL` nuevo) — v2
  podrá automatizar el reset.
