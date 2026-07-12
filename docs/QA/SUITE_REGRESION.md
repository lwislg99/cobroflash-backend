# SUITE DE REGRESIÓN E2E — v1 (SCRUM-38)

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
   (suma EXACTA 100,01 — SCRUM-32) y estado Pendiente.
7. CTAs de invoice (SCRUM-35): en el primer tramo → click **"Marcar como pagada"** (confirmar
   el importe tal cual en el prompt) → ✅ ASSERT el CTA de cabecera pasa a **"Ver justificante"**
   (o el tramo se muestra pagado tras recargar el detalle).

## 2 · Preset 50/50 — regresión BYTE A BYTE (deuda del E2E de SCRUM-34)

8. Abrir el presupuesto "Trabajo QA 50/50" (200,00 €).
9. ✅ ASSERT "Condiciones de pago" = `50% al aceptar, 50% al finalizar el trabajo.` (texto preset).
10. ✅ ASSERT botón = `Generar 1ª factura (50%)` → click.
11. ✅ ASSERT botón = `Generar 2ª factura (50% restante)` → click.
12. ✅ ASSERT botón = `Plan de facturación completado` (deshabilitado) y 2 justificantes de 100,00 €.

## 3 · Preset 100% — sin regresión

13. Abrir "Trabajo QA 100%" (150,00 €).
14. ✅ ASSERT "Condiciones de pago" = `Pago 100% al aceptar el presupuesto.`
15. ✅ ASSERT botón = `Generar factura (100%)` → click → ✅ ASSERT `Factura ya generada`
    (deshabilitado) y 1 justificante de 150,00 €.

## 4 · Cero envíos reales (evidencia obligatoria)

16. Logs del servicio staging: los envíos de WhatsApp aparecen como dry-run (wamid `dryrun.*`)
    y NINGUNA llamada a `graph.facebook.com`; sin `RESEND_API_KEY` los emails van a
    buffer/outbox/console. ✅ ASSERT: ni un mensaje real de WhatsApp ni email real.
17. (Si accesible) `/outbox` o log WA-0b como evidencia adjunta al reporte.

## Resultado

- Reportar por paso: ✅/❌ + captura del MCP donde aporte.
- Cualquier ❌ = HALLAZGO → ticket aparte en Jira (regla 9). La suite no arregla nada.
- Nota de estado: los pasos 5-7 alteran la BD staging (tramos emitidos/pagados). Re-ejecutar
  la suite requiere re-sembrar (borrar el merchant QA o usar un `E2E_QA_EMAIL` nuevo) — v2
  podrá automatizar el reset.
