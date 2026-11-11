# SCRUM-1696 · PILOTO-1 · La hoja de alta del albarán deja de llamarlo «parte»

**Medido contra:** `origin/main` = `573579309bd10241ace849bd44f9b20030d4beab` · 2026-11-11T15:40Z

**Skill UI:** cargada (`yaqu-premium-ui`; AB6: sin componente, clase, token ni estilo nuevos. Cambia un
rótulo y se quitan dos párrafos de ayuda con sus `style.cssText`)

A9: comprobación → `tests/scrum1696-hoja-albaran-no-es-parte.test.mjs`

## Origen y firma

T3 de la ③ de SCRUM-1686 (Jira c.21459; registro `docs/master/SCRUM-1686.md` §SCRUM-1686b), confusión ①
del fundador: la palabra «parte» nombraba a los dos documentos. La casilla y la frase de la hoja de alta
del ALBARÁN, y la frase que hay bajo la barra de Documentos de la ficha, hablaban del albarán con el nombre
del otro documento.

**Textos FIRMADOS:** tanda N1-N13, SCRUM-1686 c.21470. Firma del fundador «si firmo» en c.21471 (~12:05
local; alcance: los trece TAL CUAL, incluido el QUITAR de N8).

- **N8:** QUITAR «El parte sigue sin ser una factura.» de la ficha del trabajo y de la hoja de «Nuevo
  albarán».
- **N12:** «Incluir precios en el albarán» sustituye a «Incluir precios en el parte».

## Qué cambia

`public/dashboard/js/jobDetailView.js` (carril S2):

- Bajo la barra de Documentos: fuera el `<p>` con «El parte sigue sin ser una factura.» (N8).
- `buildAlbEditor`, la casilla de precios: el rótulo pasa a «Incluir precios en el albarán» (N12) y se quita
  el `<p>` de ayuda que llevaba debajo (N8). La casilla está en el mismo sitio y sigue gobernando lo mismo,
  `modoValoracion` `VALORADO` / `SIN_VALORAR`.

## Guards re-anclados (no se aflojan)

Cuatro piezas buscaban el literal viejo. Si se dejaban como estaban, después del cambio habrían pasado
**sin medir nada**: un trinquete con una sola mitad.

| pieza | antes | ahora |
|---|---|---|
| `tests/scrum319-…` | UNA «Incluir precios en el parte», dentro de `buildAlbEditor` | UNA «Incluir precios en el albarán», dentro de `buildAlbEditor` (misma exigencia; nota de re-anclaje en el test) |
| `tests/scrum817-…` | ninguna casilla de precios en la ficha al cargar (literal viejo); la del código, en `buildAlbEditor` | busca el viejo **o** el nuevo (`(parte\|albarán)`), así que es más estricto; la del código, con el literal nuevo |
| `scripts/guard-detalle-trabajo-917.mjs` (F.6 y `preciosEn`) | literal viejo | `(parte\|albarán)` |
| `tests/scrum601-…` `VEREDICTO_AL_MEDIR` | aPelo 162 | **160**: salen los dos literales de N8; nada pasa a ①/② |
| `tests/scrum713c-…` `TECHO` | 328 | **326**: salen los dos `style.cssText` de esos párrafos |

Las dos cifras derivadas las dio el propio guard sobre `573579309` + la rama. ⚠️ Si otra rama que toque esos
censos (por ejemplo, #3068 de SCRUM-1669c) entra antes, las cifras **se regeneran** al fusionar, no se suman
de memoria.

## Pruebas

- **Rojo primero** sobre `573579309`: el test nuevo falla 4 de 5 por el motivo exacto (el control positivo
  pasa).
- **Rojo cruzado:** con la vista de `main` y los tests de la rama, caen los 8 tests (1696 ①-④, 319, 817, 601
  y 713c). Con la vista de la rama, 30/30 en verde.
- **Vecinos:** los 84 ficheros de `tests/` que leen `jobDetailView.js`: 784 tests, 781 pasan, 1 se salta.
  Los 2 que fallaban eran las dos cifras de arriba; ya están apretadas.
- El guard de navegador `guard-detalle-trabajo-917.mjs` no lo he corrido en local. Lo corre el CI
  («guards de navegador»).

## Pendiente

- **Captura antes/después y verificación en yaqu.app** tras el merge (regla 42): ficha de un trabajo con
  albaranes (sin la frase) y hoja «+ Nuevo albarán» (rótulo nuevo, sin la frase), a 390 y 1280, con la
  cuenta QA y sólo GET. No la he hecho antes del PR: el relevo de S2 se hace por contexto (corte de 120k).
