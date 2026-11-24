# SCRUM-1808 · la clave de auditoría `cobro_cancelado`

## Parte S1 · 24-nov-2026 · S1 (encargo SCRUM-1817 pieza ②) · la unión cerrada gana `cobro_cancelado`

**Medido contra:** `origin/main` = `8e0d408168865aab0c7862d7c004cf864450aa71` · 2026-11-24T10:13Z
(Ancla añadida por el orquestador el 24-nov al reparar el PR #3373: el guard scrum267 la exigía y S1 estaba aparcada; la base y la hora son las que S1 declaró en su entrega. Aviso del hueco: SCRUM-1532 c.22579/c.22588.)
A9: comprobación → `tests/scrum1808-cobro-cancelado-en-la-union.test.mjs`

Rama `scrum-1808-cobro-cancelado-s1`, desde `origin/main` `8e0d40816` (Merge #3365). Antes de crearla,
`git ls-remote origin` completo: ninguna rama `scrum-1808*` en el remoto. Decisión que se aplica: SCRUM-1532
c.22435 (clave interna aprobada; el encargo la cita, el texto del comentario no lo he leído yo).
[Escrito por la sesión, no por Luis.]

**Qué entra.**
- `src/modules/system/audit.service.ts`: `| 'cobro_cancelado'` al final de la unión `AuditAction`, con su
  `APROBADO · SCRUM-1532 comentario 22435`. **No** va en `ACCIONES_BLOQUEANTES`: esa lista también es cerrada y
  c.22435 no la amplía, así que la clave entra por la puerta fire-safe (`recordAudit`).
- `tests/scrum1808-cobro-cancelado-en-la-union.test.mjs` (nuevo): censo por AST (no grep) de la unión y de la
  lista bloqueante, con control positivo. ① la clave está, una vez; ② no es bloqueante.

**Rojo primero, medido.** Sobre `8e0d40816` sin el cambio: ① cae con la unión de 24 claves leída por el censo
(sin `cobro_cancelado`) — el run medido mostró ese fallo; el resumen de los otros dos no lo leí. Con el cambio: `tsc` limpio (ningún `Record<AuditAction,…>`
ni `switch` exhaustivo se rompe) y los 3 casos en verde.

**Lo que NO entra, a propósito.**
- La fila en `POST /admin/charges/:id/cancel` (`chargesAdmin.routes.ts`, carril J2): es 1532c.
- El botón de la ficha (`jobDetailView.js`): S2, después.

**🔴 El cable trampa de J2 cae, y está escrito para eso.** `tests/scrum1532b-cancelar-cobro.test.mjs:267`
(«FALTA DECLARADA: sin fila de auditoría hasta que exista la clave `cobro_cancelado` (→ 1532c)») afirma que la
clave NO existe. Con este commit pasa a rojo: dirigida local de 6 ficheros de auditoría, 30 tests, **29 pasan,
1 cae, y es ése**. Su propio comentario dice «El día que la clave exista, cae: es la señal para 1532c». El fichero
es de J2 (el test de un ticket es del puesto del ticket, `dos-equipos.md:171`) y no lo toco. Consecuencia: este
PR no pasa el check obligatorio solo; entra cuando 1532c (J2) convierta ese caso en la exigencia de la fila,
encima de esta rama o junto a ella. Avisado al orquestador antes de empujar.

**Decisión del orquestador (cobroflash-backend-41, delegación c.21978), 24-nov-2026: opción (a), empujar tal
cual.** El PR NACE ROJO A PROPÓSITO: el centinela `tests/scrum1532b-cancelar-cobro.test.mjs:267` de J2 cae
hasta que J2 apile 1532c ENCIMA de esta rama (precedente: #3335, decisión c.22443). Descartado que S1 invierta
el caso de J2 (sería tocar su test sin su firma) y descartado esperar (la clave es lo que desbloquea 1532c).

## Parte S2 · SCRUM-1808b · 24-nov-2026 · S2 · «Cancelar cobro» en la ficha del trabajo

**Medido contra:** `origin/main` = `db0a6c04541c258eda6499e1088cf16db9f1836b` · 2026-11-24T18:13:08Z
A9: comprobación → `tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs`
A9: comprobación → `tests/scrum811c-skill-ui-declarada.test.mjs`
Mutaciones: catálogo → `tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs`
**Skill UI:** cargada · DESPUÉS de escribir el cambio, no antes (lo cazó `scrum811c`); con ella repasé el diff con
el checklist AB6: cero `style=` nuevos, solo inventario AB3 (`mkBtn` con `job-toolbar-btn-44`, el «⋯» de
`overflowMenu`, la pill `status-pill-draft`), cero textos nuevos, botón deshabilitado durante el POST, errores por
`setStatus`, capturas antes/después medidas a 390 y 1280 (alto de toque 51 px a 390 y 44 px a 1280).

Rama `scrum-1808b-boton-en-ficha-trabajo` (creada por la sesión anterior de S2 sobre `ef1e95e26`; avanzada por
fast-forward a `84e87de4d` y mergeada con `origin/main` `db0a6c045` antes del push). Encargo del orquestador
(decisión (a), SCRUM-1808 c.22680; precedente del cruce SCRUM-1804 c.22550/22551). [Escrito por la sesión, no por Luis.]

**Por qué hacía falta el servidor.** `GET /admin/jobs/:id` no servía el estado del cobro de cada factura (solo
consultaba los cobros `paid`, para `envioDocumento`), y cancelar no desvincula el `chargeId`: la ficha no tenía
cómo saber si ofrecer el botón.

**AUTORIZACIÓN NOMINAL (literal, recibida por SendMessage del orquestador el 24-nov-2026):**

«AUTORIZACIÓN NOMINAL · 24-nov-2026 · cruce S2→S1 (decisión (a), SCRUM-1808 c.22680; precedente c.22550/22551) — src/modules/jobs/app/routes/jobs.routes.ts, serializeJobDetail, sobre base 84e87de4d: 8 líneas añadidas y 4 quitadas, SIN esquema, SIN texto, SIN import nuevo — L757-759 comentario + renombre cobrosPagados→cobrosDelTrabajo · L763 where del charge.findMany sin status:'paid' (merchantId se queda, regla 2) · L764 select + status:true · L771 pagados derivado por filter (envioDocumento idéntico) · L772 Map estadoDeCobro · L800-802 comentario + estadoDelCobro por factura (mismo nombre/dato que invoicesAdmin.routes.ts:304/339; null sin chargeId). El test exige los 16 campos previos intactos y lines ausente. Rojo-primero visto: 6/7 antes, 8/8 después; 5/5 mutaciones mueren sobre base verde; regresión 1460 tests 0 fail. Si el merge de origin/main mueve números de línea, lo autorizado es ESTE contenido; los números finales se re-declaran en el registro. — firma del orquestador, c.21978»

**Números finales tras el merge de `origin/main`:** los mismos (hunks `-757 +757,3` · `-761,2 +763,2` ·
`-769 +771,2` · `-796,0 +800,3` contra el merge-base).

**Qué entra.**
- `src/modules/jobs/app/routes/jobs.routes.ts` (S1, cruce autorizado arriba): `estadoDelCobro` por factura,
  aditivo, de la MISMA consulta `charge.findMany` (sin filtro de `status`, con `merchantId`).
- `public/dashboard/js/jobDetailView.js` (S2): en la fila de cada factura NO pagada, «Cancelar cobro» en el «⋯»
  (`addSecondary`) solo con `inv.chargeId && inv.estadoDelCobro === 'pending' && !inv.paidAt` (sin el campo,
  cerrado). `window.confirm` con el literal firmado → `POST /admin/charges/:id/cancel` → `refresh()`. Errores:
  los tres literales de la ficha de factura (SCRUM-1532d, J1, `invoiceDetailView.js:849-856`), nunca el texto
  del servidor (SCRUM-644). Con el cobro `cancelled`, la pill neutra «Cobro cancelado» (`status-pill-draft`) en la
  meta de la fila, espejo de SCRUM-1532e. **Técnico:** el botón entra en la lista de dinero BLOQUEADA (patrón
  SCRUM-89: se ve deshabilitado; la ruta ya es `requireRole('admin')`). Sub-decisión del orquestador, 24-nov: OK.
- `tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs` (nuevo): ① el serializador con doble de prisma
  (patrón SCRUM-1804 ③; `where` evaluado, con un cobro de otro negocio para la regla 2); ② la ficha en el banco
  de vistas.
- `scripts/capturas-cancelar-cobro-trabajo.mjs` (nuevo, con su fila S2 en `dos-equipos.md` §3 y `carriles.mjs
  generar`) y `docs/master/evidencias/SCRUM-1808b/` (8 capturas).

**Literales** (cero textos nuevos; todos firmados): «Cancelar cobro» · «¿Cancelar este cobro? El cliente ya no
podrá pagarlo con este enlace.» (SCRUM-1532 c.22430) · «Cobro cancelado» (c.22455) · «Este cobro ya no está
pendiente.» · «Este documento ya consta como pagado: su cobro no se puede cancelar.» (SCRUM-1800 c.22496 ①) ·
«Error actualizando estado: inténtalo de nuevo».

**Rojo primero, medido.** Sobre `84e87de4d` sin el código: 8 tests, **7 rojos y 1 verde** (el verde es el de
`envioDocumento`, que es una regresión y tenía que pasar). Con el código: **8/8**. ⚠️ La nominal de arriba dice
«6/7 antes»: es la cifra que yo le mandé al orquestador, contada a ojo sobre la salida y mal. La medida es la del
resumen del runner (`ℹ tests 8 · pass 1 · fail 7`); el contenido autorizado no cambia.

**Mutaciones** (pasada única, guion fuera del árbol; las de `.ts` sobre su `dist/` compilado): base sin mutar
8/8; las **5** del catálogo **mueren**, cada una en el caso que declara.

**Regresión dirigida:** los 175 ficheros de `tests/` que leen `jobDetailView`, `jobs.routes`,
`renderJobDetailView` o `charge.findMany` → 1460 tests · 1446 pass · **0 fail** · 14 skip (gateados).

**Capturas** (`node scripts/capturas-cancelar-cobro-trabajo.mjs`, salida 0): 8 de 8. DESPUÉS: «Cancelar cobro»
visible y cabe a 390 (`[8,785,374,51]`) y a 1280; «Cobro cancelado» visible y cabe a 390 y 1280; sin desborde,
sin errores de consola. CONTROL POSITIVO: en ANTES ninguno de los dos aparece (0 de 4).

| aceptación (literal del encargo) | dónde se ve |
|---|---|
| campo ADITIVO `estadoDelCobro` por factura, mismo nombre/dato que GET /admin/invoices/:id | `tests/scrum1808b-cancelar-cobro-en-ficha-trabajo.test.mjs` ① |
| botón solo con estadoDelCobro==='pending' && !paidAt (cae CERRADO sin el campo) | mismo test, ② NEGATIVOS + control positivo |
| confirmación literal · POST /admin/charges/:id/cancel · repintado | mismo test, ② primer caso; `docs/master/evidencias/SCRUM-1808b/menu-pendiente-despues-390.png` |
| etiqueta «Cobro cancelado» | mismo test, ②; `cobro-cancelado-despues-1280.png` |
| errores con los literales de la ficha (patrón 1532d) | mismo test, ② errores |
| capturas 390+1280 | `docs/master/evidencias/SCRUM-1808b/` |
| visto en yaqu.app | NO HECHO → tras el merge (regla 42), S2 |

**🔴 Hallazgo de paso (S2, NO arreglado aquí, avisado al orquestador):** con el cobro `cancelled`, la fila de la
factura sigue ofreciendo «📲 Confirmar Bizum recibido» (se ve en `cobro-cancelado-despues-1280.png`); ya pasaba
antes de esta rama. Su POST respondería 409 `charge_not_pending` y la ficha diría «Este cobro ya no está
pendiente.». Ocultarlo es cambiar qué ofrece la ficha: decisión aparte.
