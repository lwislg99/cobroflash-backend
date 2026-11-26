# SCRUM-1840 · «📲 Confirmar Bizum recibido» solo con el cobro pendiente (ficha del trabajo)

## 25-nov-2026 · S2 · ocultar el botón cuando `estadoDelCobro` ≠ `pending`

**Medido contra:** `origin/main` = `77c000deadc9fa6b80ae97b6b02752e18b2c9392` · 2026-11-25T08:10:37Z
A9: comprobación → `tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs`
Mutaciones: catálogo → `tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs`
**Skill UI:** cargada · ANTES de tocar la vista (la lección del A9 de SCRUM-1808b); checklist AB6 sobre el diff:
cero `style=` nuevos, cero clases nuevas, cero textos nuevos; el cambio solo estrecha la condición de un botón que
ya existía. Capturas antes/después a 390 y 1280, medidas. Contraste, foco y 44 px: sin cambios (el botón que
queda es el mismo `job-toolbar-btn-44`, 44 px de alto medidos).

Rama `scrum-1840-bizum-oculto`, **apilada sobre `scrum-1808b-boton-en-ficha-trabajo` (PR #3414)**: el campo
`estadoDelCobro` del detalle del trabajo lo sirve 1808b, que aún no está en `main`. Mientras #3414 no mergee, el
diff de este PR contra `main` incluye el de 1808b; lo propio de 1840 es el último commit. Encargo del orquestador
(pieza ③, 25-nov-2026; hallazgo de S2 registrado en `docs/master/SCRUM-1808.md`, parte S2). [Escrito por la
sesión, no por Luis.]

**Qué entra.**
- `public/dashboard/js/jobDetailView.js` (S2): la condición del botón pasa de `if (inv.chargeId)` a
  `if (inv.chargeId && inv.estadoDelCobro === 'pending')`. Sin el campo cae CERRADO, como «Cancelar cobro».
  Con otro estado, su POST daba 409 `charge_not_pending` DESPUÉS de los dos toques.
- `tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs` (nuevo, banco de vistas).
- `scripts/capturas-1840-bizum-oculto.mjs` (nuevo, con su fila S2 en `dos-equipos.md` §3 y `carriles.mjs
  generar` → `comprobar` IGUAL) y `docs/master/evidencias/SCRUM-1840/` (8 capturas).

**Literales:** ninguno nuevo. Se busca el que ya existe, «📲 Confirmar Bizum recibido».

**Rojo primero, medido** (resumen del runner, no a ojo): sin el cambio, `ℹ tests 3 · pass 2 · fail 1`. El rojo
es el caso `cancelled` y los dos verdes son el control positivo (`pending` con doble toque hasta el POST) y el
de sin `chargeId`. Con el cambio: **3/3**.

**Mutaciones** (pasada única, guion fuera del árbol): base sin mutar 3/3; las **2** del catálogo **mueren**,
cada una en el caso que declara (la segunda tumba además el de los negativos).

**Regresión dirigida:** los 232 ficheros de `tests/` que leen `jobDetailView`, `renderJobDetailView`, `Bizum` o
`confirm-bizum` → 1960 tests · 1950 pass · **2 fail**. Los dos son de `tests/scrum1726-tanda-firmada-j1.test.mjs`
(D1, fechas de la hoja de disputa, servidor de J1, no carga `public/`). **No son de esta rama:** el ICU 77 de
esta máquina (Node 24.8.0) formatea `3 de octubre de 2026, 0:30` y el test espera `… a las 0:30`. Fallan
igual con `TZ=UTC`.

**Capturas** (`node scripts/capturas-1840-bizum-oculto.mjs`, salida 0): 8 de 8.
- DESPUÉS: con el cobro cancelado el botón no está (390 y 1280); con el pendiente está y cabe (`[75,681,197,44]` a
  390 y `[507,359,197,44]` a 1280). Sin desborde ni errores de consola.
- CONTROL POSITIVO: ANTES el botón está en las dos escenas (0 sin ver).

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| ocultar «📲 Confirmar Bizum recibido» cuando estadoDelCobro ≠ pending | `tests/scrum1840-bizum-solo-con-cobro-pendiente.test.mjs` (cancelled, paid, expired, null, sin campo); `docs/master/evidencias/SCRUM-1840/bizum-cancelado-despues-390.png` |
| pending → sigue (control positivo) | mismo test, CONTROL POSITIVO; `bizum-pendiente-despues-1280.png` |
| CERO texto nuevo | el diff de `jobDetailView.js`: una condición y un comentario |
| mutación al catálogo | `MUTACIONES_QUE_ME_TUMBAN` del test, 2/2 mueren |
| capturas 390+1280 | `docs/master/evidencias/SCRUM-1840/` |
| visto en yaqu.app | NO HECHO → tras el merge (regla 42), S2 |

**Fuera de alcance, visto de paso (no tocado):** en la misma fila, «Marcar como PAGADA» sigue con el cobro
cancelado (`bizum-cancelado-despues-390.png`), pero marcar pagada a mano no depende del cobro y no es este
ticket. La ficha de FACTURA (`invoiceDetailView.js`, J1) ya condiciona su Bizum a la bandera
`appBizumManualEnabled` (SCRUM-402); la del trabajo no mira esa bandera. Se avisa al orquestador y no se toca.

## 26-nov-2026 · S2 · `guard:objetivo-tactil` salía CIEGO: su fixture no traía el cobro `pending`

**Medido contra:** `origin/main` = `f336e00c20b23a7fa11ae491c8cf8bfaa931fd6d` · 2026-11-26T16:46:06Z
A9: comprobación → `scripts/guard-objetivo-tactil.mjs`

**Qué salió mal (A9).** Empujé #3442 sin correr el guard de navegador de la ficha del Trabajo. Run 45623986902, job 139239233028: `guard:objetivo-tactil` CIEGO a 929 y 390 px, «no he medido ningún botón «📲 Confirmar Bizum recibido»». Ese guard tiene el Bizum en `conocidos` (SCRUM-1193): no vigila que el botón salga SIEMPRE, sino que su fixture `DATOS_1172` lo saque a pantalla para medirle los 44 px. Con este ticket el botón exige `estadoDelCobro === 'pending'`, y la fixture no lo traía.

**La cura no toca lo que el guard exige** (regla 41): `conocidos`, `distintosEsperados: 0` y las sondas siguen igual. Solo la fixture declara `estadoDelCobro: 'pending'` junto a `chargeId`, el mismo contrato que sirve el servidor desde 1808b. Así el guard vuelve a medir el botón de cobro, en vez de quitarlo de su lista.

| medida | antes (CI, sobre 4616375b8) | después (local, sobre afe561d9d) |
|---|---|---|
| `guard:objetivo-tactil` · ficha del Trabajo | CIEGO · 2 ciegos (929, 390) | 0 hallazgos · 0 ciegos · suelo 0 cortos |

# APÉNDICE SCRUM-1840 · r42 en vivo (26-nov-2026, S2)

**Medido contra:** `origin/main` = `13e5bb69532b7d56d8d0be4b8386210aa2e5202b` · 2026-11-26T21:26:01Z (relevo de S2; #3442 mergeado a las 17:19Z).

A9: sin fallo que generalice — la medida salió a la primera, con su control positivo.

**Método recibo, escrituras cero.** yaqu.app sirve TODO (nada local: se mide lo desplegado), cuenta +qa. La respuesta del GET `/admin/jobs/1840` se sustituye en el navegador por el trabajo de EJEMPLO de `scripts/capturas-1840-bizum-oculto.mjs`, con su factura en `cancelled` o en `pending`. Toda escritura se intercepta y no sale (la única fue `POST /admin/entorno`); el botón no se pulsa. Guion: `docs/master/evidencias/SCRUM-1840/r42-1840-bizum.mjs` · medida: `r42-1840-medida.json` · fotos `r42-1840-{cancelled,pending}-{390,1280}.png`.

| ancho | cobro | debe verse | «📲 Confirmar Bizum recibido» | caja | lo desplegado lleva `estadoDelCobro === 'pending'` | errores · desborde |
|---|---|---|---|---|---|---|
| 390 | cancelled | no | no está | — | sí | 0 · no |
| 390 | pending (control) | sí | está | `[75,681,197,44]` | sí | 0 · no |
| 1280 | cancelled | no | no está | — | sí | 0 · no |
| 1280 | pending (control) | sí | está | `[507,406,197,44]` | sí | 0 · no |

La fila de acciones de la factura está en los cuatro casos (`hayFila: true`): el «no está» no es una ficha sin pintar.

**Veredicto r42: VERDE.** Lo cierra el orquestador.
