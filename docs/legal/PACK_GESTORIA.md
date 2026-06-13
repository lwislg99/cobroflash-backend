# Pack Gestoría — YaQu y VERI*FACTU (one-pager)

> **PLANTILLA — S1-H (master U1.3).** One-pager para la **gestoría/asesor del profesional**
> que usa YaQu. Placeholders `[…]` y marcas **[VALIDAR ASESOR]**. **No distribuir** hasta
> SIF-1 8/8 ✅ + revisión del asesor (S1-F). Acompaña a la declaración responsable
> (`DECLARACION_RESPONSABLE.md`) y se usa también en inspección (runbook R13).

---

## En una frase

**YaQu es el sistema de facturación (SIF) de tu cliente, y opera en modalidad VERI*FACTU:**
emite cada factura con una huella digital encadenada y la **remite automáticamente a la
AEAT** en el momento. Tú no tienes que instalar nada ni cambiar tu forma de trabajar.

## 1. Modalidad

- **VERI*FACTU (remisión voluntaria).** Cada registro de facturación (alta, rectificativa
  y anulación) se envía a la AEAT en tiempo real a través de su servicio web.
- Al operar en esta modalidad, **no se exige firma electrónica** de los registros: la
  huella SHA-256 encadenada + la remisión autenticada cumplen el requisito (RRSIF).
- Permanencia en la modalidad durante el año natural.

## 2. Qué garantiza el sistema (conformidad)

- Huella **SHA-256 encadenada** de cada factura (art. 12 RRSIF): cualquier alteración u
  omisión es detectable.
- **Inalterabilidad**: una factura emitida no se edita ni borra; las correcciones se hacen
  con **factura rectificativa (R1)** y las anulaciones con su **registro de anulación**.
- Cada factura lleva **código QR de cotejo** y la leyenda «Factura verificable en la sede
  electrónica de la AEAT».
- **Declaración responsable** del productor disponible (art. 13 RRSIF) — adjunta.
- Conforme al **RD 1007/2023** y a la **Orden HAC/1177/2024**. **[VALIDAR ASESOR]**

## 3. Cómo funciona en el día a día de tu cliente

1. El profesional crea el presupuesto y lo envía por WhatsApp.
2. El cliente final lo acepta (y firma) desde el móvil.
3. Al cobrar, YaQu emite la factura, calcula su huella y **la remite a la AEAT**.
4. El profesional y su cliente reciben la factura (PDF con QR) por WhatsApp/email.

## 4. Qué le pides a tu cliente (datos que la factura necesita)

- **Datos fiscales del emisor** (tu cliente): nombre/razón social, **NIF**, domicilio fiscal.
- **Serie de facturación** (YaQu usa series anuales, p. ej. `2026-CF-001`).
- Para **factura completa (F1)**: identificación del destinatario (**NIF del cliente final**).
  Si no se dispone del NIF del destinatario → factura **simplificada (F2)**, válida hasta
  **400 €**. **[VALIDAR ASESOR: política F1/F2 — pregunta B3 del one-pager del asesor]**
- IVA aplicable por línea (YaQu calcula base, cuota y total).

## 5. Qué puedes descargar / pedir (export e inspección — runbook R13)

- **Export XML RRSIF** de los registros (`/admin/exports/verifactu.xml?year=`).
- **Facturas en PDF** (con QR y huella).
- **Declaración responsable** del SIF (versión vigente).
- **Resumen de IVA trimestral** (modelo 303) desde Informes.
- Esta guía de una página.

> En caso de inspección, este conjunto (XML + PDFs + declaración + guía) es el paquete que
> cualquier gestoría reconoce.

## 6. Lo que YaQu NO sustituye

YaQu **no presenta** modelos ante la AEAT ni lleva la contabilidad: es el sistema de
**facturación** que genera y remite los registros, y te da los exports para tu trabajo.
La presentación de impuestos y los libros siguen siendo tuyos. **[VALIDAR ASESOR]**

## 7. Contacto

`[EMAIL SOPORTE/ASESORÍA, ej. gestorias@yaqu.app]` · `[WEB: https://yaqu.app]`
Productor del SIF: `[NOMBRE/RAZÓN SOCIAL]` · NIF `[NIF]`.

---
*Plantilla creada el 13-jun-2026 (S1-H). Acompaña a `DECLARACION_RESPONSABLE.md`.
Datos del productor y políticas F1/F2 pendientes del asesor (`PREGUNTAS_ASESOR.md`).
Distribución solo tras SIF-1 8/8.*
