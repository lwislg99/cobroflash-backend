# SCRUM-1863 · El error de «Cancelar cobro», VISIBLE a 390 en la ficha del trabajo

**Medido contra:** `origin/main` = `92df30d4d9c469d74f842ec596ea0a865ae6cebe` · 2026-11-25T13:07:55Z

**Skill UI:** cargada (`yaqu-premium-ui`) ANTES de tocar `public/`. Repaso AB6: `.alert.error` del inventario AB3 (el mismo
componente que pintaba `setStatus` y que usa T3 de SCRUM-1834), clase `job-doc-row__aviso` de la propia fila (la que ya llevan
la banda de SCRUM-885 y la zona del selector de SCRUM-1804), sin `style=`, `role="alert"`; ningún control nuevo (nada de dianas que
medir); ningún texto nuevo.

A9: comprobación → `docs/master/evidencias/SCRUM-1863/r42-1808b-v2.mjs`
(mi fallo, cazado antes de entregar: la primera pasada de la sonda de la r42 buscaba «Cancelar cobro» solo dentro de
`#view-container`, y el «⋯» de la fila se abre como HOJA INFERIOR fuera de él; salió «no está» en los cuatro casos. Lo vi porque la
captura enseñaba el botón. La sonda busca ahora en `body` y lleva un caso de control —sin cobro `pending`, el botón NO está— que
distingue «no lo veo» de «no está». Segundo fallo, también mío: la primera versión del test buscaba la fila por el número de la
factura y salía CIEGO —el banco no da `textContent` a lo que nace de un `innerHTML`—; el «rojo primero» de esa versión era un CIEGO,
no un rojo. Ahora la fila se busca subiendo desde sus acciones, con control positivo.)

Puesto S2 (frontend), rama `scrum-1863-aviso-cancelar-cobro-390` (base `92df30d4d`). Encargo del orquestador (25-nov, tarde): el
hallazgo de la r42 en vivo de SCRUM-1808b, aceptado y abierto como SCRUM-1863 (SCRUM-1808 c.22781).

## El defecto

«Cancelar cobro» vive en el «⋯» de la fila de la factura, abajo de la ficha del trabajo. Sus tres errores (`charge_not_pending`,
`document_already_paid` y el genérico) iban a la **barra de estado de arriba** (`setStatus`). En vivo, en yaqu.app, a 390 y tras
el 409 `document_already_paid` (POST interceptado: no llegó a producción), el aviso estaba en el DOM, byte a byte, pero en
`top −100 px` con `scrollY 592`: la pantalla enseñaba la fila de la factura y ningún aviso
(`evidencias/SCRUM-1863/antes-r42-1808b-pagado-tras409-390.png`). A 1280 sí se veía (`top 280`).

## La cura, y por qué esa

**El error se pinta DENTRO de la fila de su factura, delante de sus acciones**: espejo de T3 (SCRUM-1834), que resolvió lo mismo
para «Marcar como PAGADA». Los avisos de una fila viven en la fila (la banda de envío de SCRUM-885 y la zona del selector de
SCRUM-1804 ya lo hacen así). El nodo nace con el primer fallo; un segundo fallo lo REESCRIBE (nunca dos apilados) y volver a
pulsar lo esconde mientras se intenta. Tras pintarlo, `scrollIntoView({ block: 'nearest' })`: la hoja inferior se ha cerrado y la
fila ya está en pantalla, así que no mueve nada si ya se ve (sin animación: nada que respetar en `prefers-reduced-motion`).
**No** desplazo hasta la barra de arriba: alejaría al usuario de la factura sobre la que acaba de actuar.

- `public/dashboard/js/jobDetailView.js`: `p.alert.error.job-doc-row__aviso` (`#cancelar-cobro-inv-<id>-error`, `role="alert"`)
  insertado con `acts.parentNode.insertBefore(…, acts)`. Antes, `setStatus('error', …)`.
- **Los textos NO cambian** (firmados: SCRUM-1532 c.22430 / c.22455; el del 409, SCRUM-1800 c.22496 ①). La condición del botón,
  la confirmación, el POST y el `refresh()` tras cancelar, tampoco.

## Rojo primero

`tests/scrum1863-aviso-cancelar-cobro-junto-a-la-fila.test.mjs`, banco de vistas. Para cada uno de los tres errores: el literal
sale UNA vez, dentro de la `.job-doc-row` de la factura, `role=alert`, `.alert.error`, visible; el botón vuelve a estar
habilitado. Y dos fallos seguidos dejan UN solo aviso, el del segundo. Control positivo del instrumento: «Marcar como PAGADA»,
buscado desde el `body`, está en la fila; el `body` no.

- Sobre `92df30d4d` sin la cura: **2 rojos de 2** — «con charge_not_pending el aviso NO está en la fila de la factura» y «la fila
  apila 0 avisos tras dos fallos».
- Con la cura: 2/2, y junto a `scrum1808b` (6) y `scrum1834` (5): **13/13**.

Mutaciones: catálogo → `tests/scrum1863-aviso-cancelar-cobro-junto-a-la-fila.test.mjs` (tres, en `MUTACIONES_QUE_ME_TUMBAN`;
corridas el 25-nov sobre la base verde: quitar el `insertBefore` → 2 fail, quitar el `role` → 2 fail, `if (true)` en vez de
reutilizar el nodo → 1 fail; las tres tumban el caso que declaran).

## Pendiente

- **r42 en vivo tras el merge** (regla 42): la misma sonda (`evidencias/SCRUM-1863/r42-1808b-v2.mjs`), caso `pagado` a 390:
  el aviso tiene que salir con `enPantalla: true`. Lo hace S2.
