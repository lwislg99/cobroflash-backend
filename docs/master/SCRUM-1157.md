# SCRUM-1157 · Censo AST del convenio de microcopy: el texto sin firmar que ningún marcador acusa

**Medido contra:** `origin/main` = `29b492b0c2f246941e5c514d682887c18fd19494` · 2026-09-28T14:18:51Z

28-sep-2026 · **S3** (bancos e instrumentos). Construido sobre el trabajo sin commit que dejó
`s3-27a` en `wt-s3-1157-censo-microcopy` al caerse (exit 4, 14:19:55Z del 27-sep): se leyó
entero, se puso al día con `main` (12 commits) y se re-midió; no se rehízo.

## El defecto
El guard de marcadores (SCRUM-722) busca `[PENDIENTE microcopy oficial]` en lo que se PINTA. En
`settingsView.js` → `QR_COPY`, seis textos sin aprobar llevan el marcador en un COMENTARIO del
fuente, no en el valor: en pantalla sale «Formato», «Negro»… y ningún guard los acusa.

## Qué se construyó
- `scripts/_censo-convenio-microcopy.mjs` — parser de `typescript` sobre los 98 `.js` de
  `public/`. Para cada objeto-registro de copy que usa el convenio (comentarios `APROBADO(S)` /
  `[PENDIENTE microcopy oficial]`), clasifica cada hoja de texto: APROBADO · PENDIENTE ·
  SIN_COMENTARIO. La regla de qué comentario gobierna a qué propiedad está escrita entera en la
  cabecera del script. Identidad = `fichero · Objeto.clave`, nunca la línea (SCRUM-710b).
- `scripts/_censo-convenio-microcopy-declarados.json` — trinquete de dos mitades: `acusadas`
  (con motivo), `retiradas` (la bajada se declara) y `ambiguos` (comentarios que la sonda no sabe
  leer, resueltos por identidad con motivo).
- `tests/scrum1157-censo-convenio-microcopy.test.mjs` — 10 tests. **Corre en el check
  obligatorio** (`tests/*.test.mjs`): bloquea el merge.

## Las dos condiciones del encargo
- **Fail-closed.** Sintaxis rota, comentario ambiguo sin resolver, `...spread` dentro de un objeto
  del censo, dos hojas con la misma identidad y distinta clase, resolución caducada, población
  vacía → `estado: CIEGO`, sin hojas. La CLI sale 2 y **no imprime nada por stdout** (test ④,
  con el control de que SÍ imprime cuando puede mirar).
- **Control positivo real y negativo.** `QR_COPY` copiado literal del 28-sep: los 6 salen
  PENDIENTE y los 2 firmados APROBADO. El negativo se DERIVA del positivo (misma fuente con la
  firma puesta): mismas 8 hojas, cero acusadas. Además, lo que NO debe tomarse por firma:
  «un albarán FIRMADO» (estado), «FIRMADO por el cliente», «aprobado» en minúsculas.

## Medido
- Población: 98 ficheros · 156 comentarios de convención (48 en objetos del censo, **108 FUERA
  DE ALCANCE**) · 34 objetos · 234 hojas → APROBADO 150 · PENDIENTE 7 · SIN_COMENTARIO 77.
  84 acusadas declaradas, 0 nuevas, 0 que sobran. CLI: 2,2 s.
- Rojo sobre el ÁRBOL REAL (no solo en el test): quitar el marcador de `QR_COPY` en
  `settingsView.js` → 6 NUEVAS (pasan a SIN_COMENTARIO), exit 1; restaurado → 0/0, exit 0.
- Test: 10/10. Metaguardas que censan `tests/` y `scripts/` (41 ficheros, 382 tests): verdes.

## Lo que NO resuelve (dicho, no escondido)
- Los 108 comentarios de convención fuera de objetos (texto suelto, `textContent = '…' //
  APROBADO`) se CUENTAN pero el censo no afirma nada de ellos.
- Las 77 SIN_COMENTARIO son de **S4**: contrastarlas con `docs/microcopy/` y, o firmarlas, o
  anotar encima la firma que ya tengan. Cada una que se resuelva sale como SOBRA y se mueve a
  `retiradas` con su referencia.

## 1157b (28-sep-2026) — la regla 1 no funcionaba

Lo midió **S4** al usar el censo: marcó 22 hojas con la forma `k: 'x', // APROBADO` y las 22
salieron SIN_COMENTARIO. Al ponerlas encima (regla 2) salieron APROBADO. El fallo iba en la
dirección segura (acusaba de más), pero la cabecera prometía una forma que el código no leía.

- **Causa:** `getTrailingCommentRanges` se llamaba en el fin del valor, antes de la coma, y deja de
  buscar en cuanto la encuentra. `getLeadingCommentRanges` no coge comentarios de la misma línea.
  Pasaba en los dos sitios: al clasificar la hoja y al decidir si un objeto entra en el censo.
- **Arreglo:** los dos saltan la coma (`trasLaComa`) antes de buscar. La regla 1 de la cabecera
  queda como estaba, y ahora es cierta.
- **Test:** `SCRUM-1157b · regla 1` en `tests/scrum1157-censo-convenio-microcopy.test.mjs`. Sin el
  arreglo, 10 verdes y 1 rojo (`T.a` salía PENDIENTE). Con él, 11 verdes. Cubre también un objeto
  cuyo único convenio va en esa forma, que antes ni entraba en el censo.
- **Mensaje del rojo:** ahora ofrece las dos formas, encima o al final de la misma línea.
- **Cifra en `main`:** 0. Antes y después, las mismas 234 hojas con la misma clase y 84 acusadas.
  Un `git grep` independiente da 0 hojas marcadas así en `public/` de `main` y en las 60 ramas más
  recientes. Las 22 de S4 no están empujadas en ninguna rama; S4 ya las pasó a la regla 2.
