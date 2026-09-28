# SCRUM-1180 — Quitar una cláusula de cierre en UN presupuesto

**Medido contra:** `origin/main` = `eedd78055f2a1d2f5bdc3446ebf8edc09e5e13c8` · 2026-09-28T15:40:00Z

Carril S1 (servidor) + S2 (pantalla) · rama `scrum-1180-clausulas-por-presupuesto` · medición en el comentario 17358 de Jira.

## Medición (PASO 0)

El servidor ya estaba entero y sin ALTER: la columna `Quote.clausulasExcluidas`, el alta (`quotes.routes.ts:235`), el PDF (`presupuestoParaPdf.ts:162`), el sello (`presupuestoSello.ts`) y la revisión (`revision.ts:187`). El editor solo guarda por `POST /quote/create`, que ya acepta el campo.

Faltaban tres cosas:
1. **SCRUM-1227** (#1894): la lista de cláusulas del negocio no salía en `GET /admin/merchant`, así que el editor no tenía qué casillas pintar.
2. **Trozo S1 (este commit):** que `GET /admin/quotes/:id` devuelva `clausulasExcluidas`. Misma familia que SCRUM-888d y SCRUM-1187: «Duplicar» (`quotesDetailView.js:1308`) arma la copia con el detalle y la sacaba con TODAS las cláusulas.
3. **Trozo S2:** una casilla por cláusula en `quotesView.js`, y `clausulasExcluidas` en «Duplicar».

## Trozo S1

- `getQuoteDetailAdmin` devuelve `clausulasExcluidas`, siempre como array (`[]` = las lleva todas; nunca `null` ni ausente).
- Test `tests/scrum1180-detalle-con-clausulas-excluidas.test.mjs`: 2/2 en rojo contra el `dist` anterior, verde después. Tests relacionados: 479 pasan, 5 saltados (staging).

## Pendiente, en la MISMA ola (decisión del orquestador)

- La pantalla de S2 encima de esta rama (la sesión S2 de hoy pidió relevo antes de empezarla).
- Cuando el front mande `clausulasExcluidas`, S1 mueve «cuerpo · POST /quote/create::clausulasExcluidas» a `retiradas` del censo de SCRUM-1185.
- El texto «Condiciones que lleva este presupuesto» lo firma el orquestador en Jira cuando se vaya a pintar.
