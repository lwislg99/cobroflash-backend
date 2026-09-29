# SCRUM-1180 — Quitar una cláusula de cierre en UN presupuesto

**Medido contra:** `origin/main` = `eedd7805c45f554bc29ccc3204f6dd09f61862e6` · 2026-09-28T15:36:18Z

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

## Mitad de pantalla (S2, `s2-28c`) — construida, SIN empujar

**Medido contra:** `origin/main` = `59012d2309adbd8569fc047bcd880f453ade523a` · 2026-09-28T15:44:08Z

- `quotesView.js`: en «Envío», una casilla por cada cláusula del negocio (`clausulasPresupuesto` de
  `GET /admin/merchant`, SCRUM-1227), marcada por defecto; las desmarcadas viajan como
  `clausulasExcluidas` (sus `id`). Sin cláusulas, el bloque queda oculto y la clave NO viaja. Se
  guarda en el borrador y se restaura; la plantilla de «Duplicar» las trae desmarcadas.
- `quotesDetailView.js` («Duplicar»): copia `clausulasExcluidas` del detalle.
- **Rótulo del bloque SIN pintar** (`TITULO_CLAUSULAS = null`) hasta la firma de «Condiciones que lleva
  este presupuesto» (regla 39). Las casillas llevan el título de cada cláusula: dato del profesional.
- Test del viaje `scrum1180-editor-clausulas-excluidas`: detalle con una quitada → «Duplicar» → la
  casilla sale desmarcada → se quita otra → «Generar» → el cuerpo REAL del POST lleva las dos → y pasa
  por el `CreateQuoteSchema` real (dist) conservándolas. Rojo por mutación (sin la clave en el payload,
  caen 2 de 3). Censos 697/698: 255 → 256 nodos (el envoltorio oculto), declarado con su motivo.
  `_asignacion-bloques-presupuesto`: `clausulasExcluidas` → `clausulasWrap` en `blockDelivery`.
- Espera a que #1894 (SCRUM-1227) entre en `main`; se empuja ENCIMA de la rama de S1.

## La ola, junta (S2, `s2-29a`) — rótulo firmado, cláusula quitada visible, UN push

**Medido contra:** `origin/main` = `510ba6d9f408490c6dcbf2bed0806fd298044627` · 2026-09-29T09:07:49Z

- #1894 (SCRUM-1227) mergeado en `main` (`438d3e71`). Las 3 de S1 (`1204dfa6`, `6557ba77`, `88c81b7f`)
  y las de S2 van en un solo push, porque `88c81b7f` sin la pantalla pone rojo el trinquete de 1185.
- **Rótulo pintado:** «Condiciones que lleva este presupuesto», FIRMADO en SCRUM-1180 c.17380. Las
  cuatro condiciones: ① el alcance es solo este presupuesto (S1, contra el árbol: el alta escribe en
  `Quote`, no toca el negocio); ② sin cláusulas no se pinta ni el bloque ni el rótulo (test);
  ③ «Duplicar» conserva las exclusiones (test del viaje); ④ todas marcadas por defecto viajan como `[]`
  (test).
- **Lo no firmado, aprobado aparte por el orquestador:** la cláusula quitada sale atenuada y tachada
  (`.quote-clausulas .pay-methods-row label:has(input:not(:checked))`). Está acotada al bloque, y la
  fila de métodos de pago no cambia. Medido en un banco con los `tokens.css` + `styles.css` reales en
  chrome-headless. El test fija el acotado. Rojo probado: sin el prefijo `.quote-clausulas`, cae.
- Censo SCRUM-600: entra la ranura del rótulo. `main` ya traía la de 1188, así que quedan 31 posiciones y
  29 textos.
- Los 44 px de `.pay-methods-row` (20,1 px medidos) van APARTE: SCRUM-1265, sin tocar.