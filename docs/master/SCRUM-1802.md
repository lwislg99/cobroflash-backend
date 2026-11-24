# SCRUM-1802 · Ficha de la factura: el día sin cero a la izquierda («5 dic 2026», no «05 dic 2026»)

**Medido contra:** `origin/main` = `f8dc0244675d00709b896101b97c89bd22468923` · 2026-11-24T02:49:45Z (cabecera `Date:` de `gh api -i zen`)

**Skill UI:** cargada

A9: comprobación → `tests/scrum1802-ficha-dia-sin-cero.test.mjs`

Mutaciones: catálogo → `tests/scrum1802-ficha-dia-sin-cero.test.mjs`

Encargo del orquestador J a jv-j1ja (J1). Hijo de SCRUM-1787 (letras agotadas). Decisión del fundador: SCRUM-1787 c.22491 («1-Sí»), citada en la descripción de SCRUM-1802. El PDF (1787x) y la página de pago (1787y) ya escribían el día sin cero; la ficha seguía con `day: '2-digit'`. Ningún texto nuevo: sólo cambia cómo se escribe el día. Nada en `src/` ni en `prisma/`.

## Qué había al empezar

- `public/dashboard/js/invoiceDetailView.js` (carril J1, `node scripts/carriles.mjs de`): tres `toLocaleDateString` con `day: '2-digit'` — `:200` (fecha del bloque de cobro, `paidAt`), `:239` (fecha corta de los pasos Emitida / Cobrada) y `:315` (fila «Vence el», `dueDate`).
- PASO 0: sin commits `SCRUM-1802` en `origin/main`, sin ramas `scrum-1802*` en el remoto, sin `docs/master/SCRUM-1802*.md`; el único PR que casa con «1802» es el #1802 (otro ticket, por número).

## Qué se construyó

- Los tres pasan a `day: 'numeric'`. Otras pantallas (`quotesDetailView.js`, `jobDetailView.js`…) no están en la decisión y no se tocan.
- `tests/scrum1802-ficha-dia-sin-cero.test.mjs`, sobre la ficha MONTADA en el banco de vistas (`renderInvoiceDetailView`), fechas a mediodía UTC para que la zona de la máquina no las mueva de día.

| qué | esperado | visto |
|---|---|---|
| ① «Vence el» con `dueDate` 2026-12-05 | `5 dic 2026` | antes del arreglo: `05 dic 2026` (rojo); después: `5 dic 2026` |
| ② control: «Vence el» con 2026-12-10 | `10 dic 2026` | `10 dic 2026` antes y después |
| ③ fecha del cobro (`paidAt` 2026-12-06) | `6 dic 2026` | antes: `06 dic 2026` (rojo); después: `6 dic 2026` |
| ③ pasos Emitida / Cobrada (5 y 6-dic) | `5 dic`, `6 dic` | después: `5 dic`, `6 dic`; control 10 / 11-dic: `10 dic`, `11 dic` |
| mutación: «Vence el» vuelve a `2-digit` | tumba ① | VIVA: cae ① y sólo ① (`'05 dic 2026'`), 0 colaterales; `git status` después: sólo mis dos cambios |
| captura 1280 y 390, fila «Vence el» | `5 dic 2026` | `5 dic 2026` en las dos, mirada |

## Cómo se ve

- Mutación por `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`, con la pasada limpia delante (3 de 3 en verde).
- Capturas: `docs/master/evidencias/SCRUM-1802/1802-despues-vence-el-escritorio.png` y `…-movil.png`, hechas con `docs/master/evidencias/SCRUM-1802/guion/capturas-1802.js` (código del árbol servido por `docs/master/evidencias/SCRUM-1787/guion/servidor-estatico.mjs 5802`, datos de EJEMPLO, nada sale de 127.0.0.1). El guion lee además el texto: escritorio y móvil, `Vence el` = `5 dic 2026`, cobro = `6 dic 2026`, pasos = `5 dic`, `6 dic`.
- En la misma captura, la fila «Pagada» dice `6/12/2026, 13:00:00`: es `toLocaleString`, no lleva `2-digit` y no está en la decisión; no se toca.
- Dirigida: los 36 tests que nombran `invoiceDetailView` más 1787m, 1415, 1294, 267, 854, 719 y el nuevo (1787e y 601 ya están entre los 36): 42 ficheros, 347 tests. Antes de comitear este registro, 346 pass y 1 fail = scrum854 ②, que lo pedía.

## NO hecho / NO visto

- yaqu.app: no visto. Se ve tras el merge y el despliegue, en una factura con vencimiento de día menor que 10.
- Nada contra staging ni producción.
