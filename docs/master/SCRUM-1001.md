# SCRUM-1001 · La página del cliente promete un pago que luego no está

**Medido contra:** `origin/main` = `29e80483a14be1432463dc1ceb68b421cec20641` · 2026-09-21T18:10:26Z (cabecera `Date:` de `gh api -i zen`)
**Rama:** `scrum-1001-sin-pago-linea-firmada` · **Carril:** S1 · **Literal FIRMADO por Javier (jefe) el 21-sep-2026**, tal cual, sin reescribir.

## Paso 0
`GET /quote/:token` (`quoteDecisionLanding.routes.ts`) enseña la píldora «Señal del 50 %…» y, tras aceptar, la pantalla «¡Presupuesto aceptado!» solo ofrece «Compartir por WhatsApp»: no hay ningún botón de pagar en ese estado (modo `receipt`, ES real con `INVOICING_ES_ENABLED` OFF). Corrido con la ruta real y `prisma.quote.findUnique` doblado.

## Lo que cambia
- Tras aceptar, **solo si `getEmissionMode(merchant) === 'receipt'`**: «El profesional te enviará la factura y las instrucciones de pago por su cuenta.»
- `loadQuote`: el `select` del merchant suma `id`, `email` y `flags` (sin ellos el demo no se reconoce y el interruptor por negocio no se lee). No se renderizan.
- Con botón (fiscal, demo, no-ES) no se toca nada. Sin `schema`, sin ningún otro estado ni canal.

## Límite de la firma
Un literal, una pantalla, un estado. **No** va en «Ya aceptaste este presupuesto» (GET persistente), ni en el correo, ni en WhatsApp, ni en el panel.

## El juez: `tests/scrum1001-sin-pago-la-pagina-lo-dice.test.mjs` (sin banco)
Handler real con req/res mínimos: SUELO (la página se monta), ES real → el literal exactamente una vez, demo y MX → sin él. Mutaciones (3, todas en rojo; restaurado, verde): siempre, nunca, literal alterado.
