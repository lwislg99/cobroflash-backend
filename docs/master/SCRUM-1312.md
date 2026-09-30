# SCRUM-1312 · el recibo ya no pinta en producción un botón que hace POST a `/dev`

**Medido contra:** `origin/main` = `1dbc9c24c89a4baa9af903fe036489282fac134b` · 2026-10-01T00:31:30+01:00 (J4, equipo de Javier)

A9: comprobación → `tests/scrum1312-boton-email-recibo-gateado.test.mjs`

**Decisión del fundador:** Jira SCRUM-1312, comentario 17667 (recogido por el orquestador del equipo
de Javier, `cobroflash-backend-47`). Literal: **Javier, 1-oct-2026: «1-Ok ve a por la A».**

> **(a)** El botón **no se pinta en producción**, con la misma condición de entorno que SCRUM-807 puso
> al `saved` y SCRUM-1309 al `sent`.

Descartada con su motivo la **(b)** (construir el envío real al cliente final): es un envío nuevo, y
ningún envío automático nuevo entra sin la tabla del anti-spam J6 (regla 28). No se hace aquí.

## Qué pasaba

En `src/modules/billing/app/routes/receipt.routes.ts`, `emailBlock` pintaba al cliente final, con el
recibo pagado, PDF real y cliente con email, un formulario «Enviar … por email» con `action` a
`/dev/email-invoice/…`. `/dev` no se monta en producción (`src/app.ts`), así que el botón daba 404.
Visto al lado arreglando SCRUM-1309 y reportado sin tocarlo (A7).

## Qué cambia

- `emailBlock` añade `config.NODE_ENV !== 'production'`: la tercera vez la MISMA condición
  (`saved` de 807, `sent` de 1309). Sin helper ni segunda forma.
- El bloque entero (formulario + «Se enviará a: …») deja de pintarse; ese «Se enviará a» describe el
  botón y sin él no tiene sujeto. **Ningún texto cambia** (regla 39).
- No se toca `/dev/email-invoice` ni su ruta.

## Cómo se comprobó

Test de comportamiento con la ruta real y dobles en `require.cache` (harness de scrum1309), sin BD ni
red; recibo pagado con factura con PDF y cliente con email. Cada caso exige antes ver el enlace al PDF
(si no, el botón faltaría por otro motivo y el verde sería CIEGO).

- 🔴 **Rojo primero:** antes del arreglo cayó el caso de producción con su mensaje; los otros dos, verdes.
- ✅ Positivo: fuera de producción el botón sí está.
- ⛔ Control: `sent` y `saved` igual que los dejaron 1309 y 807, sobre el recibo pagado.
- Tanda dirigida: 1312, 1309, 807, 910, 910d, 893, 74, 237, 976, 391 → 46 tests, 45 pass, 0 fail,
  1 skip (scrum74, gateado por `QA_DB_TEST`). La tanda completa la corre CI (orden del orquestador:
  máquina justa de memoria).
