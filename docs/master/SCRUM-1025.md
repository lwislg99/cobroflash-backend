# SCRUM-1025 · El checklist de «lista para cobrar» culpaba al WhatsApp del MERCHANT cuando lo que bloquea el envío es el del CLIENTE

**Medido contra:** `origin/main` = `1f92f5733359880115b3f76824d38db25bef56e0` · 2026-09-22T08:33:54Z

**Puesto:** J3 · Alta y crecimiento (`jv-j3`, equipo de Javier) · **Rama:** `scrum-1025-1029-checklist-modoemision`

## 1 · El defecto medido (sesión anterior, 21-sep-2026)

Fila «Presupuestos por WhatsApp» del checklist «Tu cuenta, lista para cobrar»
(`public/dashboard/js/settingsView.js:1252-1259`): si falta `merchant.whatsappPhone`, el `koText`
decía **«Añade tu teléfono de WhatsApp para enviar presupuestos»**.

Y el envío de presupuestos al cliente (`src/modules/quotes/domain/sendQuote.service.ts:47`,
`tieneNumeroDeContacto(quote.customer)`) **NUNCA lee `merchant.whatsappPhone`**: solo el teléfono del
CLIENTE. Sin ese campo del merchant, los presupuestos se siguen enviando igual — el profesional lee la
fila en rojo, «arregla» un campo que no estaba bloqueando nada y sigue sin saber qué falla de verdad.

## 2 · Firma y verificación en rojo (esta sesión, 22-sep-2026)

Javier firmó el literal el 22-sep-2026 (delegación del 22-sep-2026 en su orquestador, y este texto
en concreto lo firmó él mismo directamente por ser microcopy de producto, no fiscal):

> «Añade tu teléfono de WhatsApp para que te avisemos cuando un cliente decida»

**Verificado en rojo antes de aplicar:**

- Texto viejo presente y confirmado: `grep` de `Añade tu teléfono de WhatsApp para enviar
  presupuestos` en `settingsView.js` → 1 coincidencia.
- Motivo nuevo confirmado VERDAD, no solo leído: `merchant.whatsappPhone` **sí** es el campo real que
  usan los avisos AL PROFESIONAL —
  - `quotes.routes.ts:246` — aviso de «requiere aprobación» (`normalizePhone(merchant.whatsappPhone)`).
  - `quotes.routes.ts:859` — aviso de aceptado/rechazado (`merchantPhone: quote.merchant?.whatsappPhone`).
  - Y **no** es lo que usa el envío al cliente: `sendQuote.service.ts:47` solo mira
    `quote.customer`, nunca `merchant.whatsappPhone`.

**Control positivo tras aplicar:** `grep -c` del texto viejo = 0, del texto nuevo = 1, `node --check`
sobre `settingsView.js` sin errores de sintaxis.

## 3 · Ámbito

Cambio de 1 línea (`settingsView.js:1257`). Sin tests dedicados a este `koText` (censado antes de
tocar: 0 ficheros de `tests/` lo citan). Rigor proporcional (≤30 líneas): rojo + arreglo + control
positivo, sin el método completo.

## 4 · Ticket

Jira **SCRUM-1025** (`equipo-javier`, `area-j3`).
