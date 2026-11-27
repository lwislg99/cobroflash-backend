# SCRUM-1857 ① · S2 · «Partes por valorar»: la casilla del precio por unidad, a 44 px de toque

**Medido contra:** `origin/main` = `8e9fefe8bb8bf070f7e26db7866a6cc41a5ac94c` · 2026-11-26T22:03:45Z (relevo de S2 del 26-nov noche; rama `scrum-1857-casillas-tactiles`, con ese `main` mezclado).

A9: sin fallo que generalice — mi sonda dio «toque 0» en la primera vuelta a las casillas que quedaban fuera de la ventana (`elementFromPoint` no ve fuera); la cifra era imposible al lado de la caja de 20 px y se corrigió en la sonda trayendo cada casilla a la vista antes de medirla, que es lo que ya hace `guard:objetivo-tactil` (su `scrollIntoView`).

Mutaciones: catálogo → `tests/scrum1857-casillas-precio-44.test.mjs` (2 en `MUTACIONES_QUE_ME_TUMBAN`, corridas con `mutacionesDeclaradas` + `correr` + `aplicarUna` de `scripts/meta-guard-mutaciones.mjs`: base 2/0 y las 2 mueren en el caso que nombran; árbol restaurado).

**Skill UI:** cargada · antes de tocar la hoja, en esta misma tanda; checklist AB6 abajo.

**El encargo** (orquestador, relevo de S2 del 26-nov): las casillas `INPUT.po-col-precio` de `public/dashboard/js/parteOficinaView.js:204-208`, caja 20 px · toque 21 px a 390/929/1280 → a ≥44 px de toque POR CONTENEDOR, sin rediseño, tokens de DESIGN.md; rojo primero con la medida; capturas 390 + 1280. «Guardar precios» NO se toca (decisión c.22779: conforme con DESIGN.md).

**Qué entra.** Una regla en `public/dashboard/css/styles.css`, dentro del bloque de SCRUM-1699 (`#po-detalle`): `#po-detalle .po-linea > input.po-col-precio { min-height: 44px; }`. Sólo tamaño, sólo esa casilla: ni el `input` global, ni el ancho de la columna (la cabecera casa con la línea, SCRUM-1699), ni color o borde. El JS no cambia. Ningún texto.

**Rojo primero, en navegador** (`docs/master/evidencias/SCRUM-1857/medida-1857-casillas.mjs`; yaqu.app, cuenta +qa, sus partes REALES por valorar abiertos con un clic y sólo GET; ANTES = lo desplegado, DESPUÉS = mi `styles.css` por interceptación; toque = qué elemento recibe el punto, barriendo la vertical y la horizontal del centro, como el árbitro de `guard:objetivo-tactil`). Las tres primeras casillas del parte:

| ancho | ANTES caja · toque (alto) | DESPUÉS caja · toque (alto) | «Guardar precios» (no se toca) | errores · desborde |
|---|---|---|---|---|
| 390 | 80 × 20 · 21 | 80 × 44 · 45 | 324 × 44 → 324 × 44 | 0 · no |
| 929 | 110 × 20 · 21 | 110 × 44 · 45 | 591 × 36 → 591 × 36 | 0 · no |
| 1280 | 110 × 20 · 21 | 110 × 44 · 45 | 918 × 36 → 918 × 36 | 0 · no |

Escrituras: sólo `POST /admin/entorno`, interceptado. Medida: `medida-1857.json`. Fotos `medida-1857-{antes,despues}-{390,929,1280}.png`, con el cliente y la obra TAPADOS antes de fotografiar (el repo es público; las medidas ya estaban tomadas).

**Test** `tests/scrum1857-casillas-precio-44.test.mjs` (2): ① en el banco de vistas, abriendo el parte con su fila, las casillas son hijas de `.po-linea` dentro de `#po-detalle` (el selector las alcanza); ② la regla existe, fuera de todo `@media`, con `min-height:44px` y NADA más, y el `input` global no lleva los 44. Rojo primero sobre el `styles.css` de `origin/main`: ① verde (el marcado no cambia) y ② rojo; con la regla, 2/2.

**AB6 sobre el diff.** Toque ≥ 44 en los tres anchos (45 medido); cero tokens, colores, sombras o textos nuevos; sin desborde lateral; la columna conserva su ancho (80 px a 390, 110 a 929/1280) y la cabecera sigue casando con la línea; foco y contraste, los del `input` de siempre (no se tocan).

**Regresión dirigida:** los 13 ficheros de `tests/` que nombran la vista o sus clases → 86/86; los 122 que leen `styles.css` → 945 tests, 944 pass, 0 fail (1 saltado por su gate). `guards:entrada` verde. La tanda entera la pasa el check obligatorio.
