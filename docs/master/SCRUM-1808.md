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
