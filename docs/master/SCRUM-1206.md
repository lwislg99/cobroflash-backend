# SCRUM-1206 — La ficha no enseña los textos de cabecera y Observaciones guardados

**Medido contra:** `origin/main` = `1716a0f5451c37c35250fb90b07bda2f2bbdc574` · 2026-10-16T12:36:42Z

El ticket es del presupuesto (`quotesDetailView.js`, S2). Este registro empieza con la mitad del ALBARÁN,
que S4 encontró de paso en c.19790: `albaranDetailView.js` tampoco pintaba su cabecera ni sus notas.
A9: sin fallo que generalice — cabecera del registro; lo construido va en el tramo de abajo

## 1206b — la ficha del albarán pinta su cabecera y sus observaciones (S4, s4-16oct)

**Medido contra:** `origin/main` = `1716a0f5451c37c35250fb90b07bda2f2bbdc574` · 2026-10-16T12:36:42Z

Producción servía `0dbc92f240a91fbe9e35fd2d3830c53bb12cddc4` (/version) a esa hora.

**Skill UI:** cargada (`yaqu-premium-ui`, en esta sesión y ANTES de editar). Sin token, clase ni estilo nuevo:
reutiliza `.detail-rail-linea--nota` (SCRUM-982, la nota del cliente en el rail del Trabajo). Carril:
`albaranDetailView.js` → S4 (`node scripts/carriles.mjs de …`, `dos-equipos.md:149`).

**La firma** (orquestador, 16-oct-2026, con delegación del fundador, por `SendMessage` a S4):

- `notas` lleva **«Observaciones»**. No es texto nuevo: el PDF imprime `notas` bajo ese título
  (`albaranPdf.service.ts:332-338`, `TITULO_OBSERVACIONES` de `pdf.service.ts:60`), y `schema.prisma`, junto a
  `docHeaderText`, dice que el pie del albarán es `notas`. La pantalla no copia el literal: lo lee de
  `textoDelDocumento.js` (`TD_TITULO_OBSERVACIONES`), donde ya vive firmado.
- `docHeaderText` va **SIN RÓTULO**, como en el papel (SCRUM-593.md: «en el pdf final que no salga, solo aparece
  el texto sin rótulo»). «Añadir texto en el documento» es el rótulo del FORMULARIO.
- **La pregunta que lo decidía:** ¿lo que enseña la ficha ES el campo Observaciones? Para `notas`, sí. El aviso de
  `jobDetailView.js:3000` («derivarlo de "Observaciones" sería inventar microcopy») habla de la CABECERA, que es
  otro campo, y por eso no lo contradice.

**Lo construido:** en el rail, después de la fila del presupuesto, una fila por texto y en el orden del papel:
la cabecera y después las observaciones. Entran por `textContent` y sin estilo en línea. Sin dato no hay fila:
vacío, sólo espacios o `null` no pintan nada, ni el rótulo.

**No usa `textoDelDocumentoPintado`, a propósito:** pinta un `div` con `pre-line` en línea y sin
`overflow-wrap`. Una URL larga ensancharía el rail en 360 px. La clase del rail ya resuelve las dos cosas y no
tocar `styles.css` (S2, contenedor). La entrada de `_sin-consumir-declarados.json` sigue como está: la conecta
el presupuesto, que es de S2.

**Tests:** `tests/scrum1206b-la-ficha-del-albaran-pinta-sus-textos.test.mjs` (6), con la ficha REAL en el banco
de vistas (`_banco-vistas.mjs`).

| comprobación | resultado |
|---|---|
| con el cambio | 6 de 6 |
| con el `albaranDetailView.js` de `main` | caen 4: los que ven texto. Pasan el SUELO (el literal llega de la pieza) y «sin dato, sin fila» |
| M1 · la cabecera con el rótulo del formulario | caen 2 de 6 |
| M2 · el orden invertido | cae 1 de 6 |
| M3 · sin el «sin dato, sin fila» (sólo `null`) | cae 1 de 6 |

**Tanda entera** (`node --test "tests/*.test.mjs"`, primer plano): 11.690 tests, 14 caídos, clasificados:

- **2 eran míos y los arregla este registro:** `scrum1340` y `scrum854` (una rama que toca `public/` declara su
  registro y su skill).
- **11 son de entorno:** el cliente de Prisma del `node_modules` compartido está por detrás del esquema (le
  falta `activityKind`, de SCRUM-1072). `tsc` cae por lo mismo en `merchantAdmin.ts:147`. Son los de
  SCRUM-235, 237, 461, 733 y 976, y «el SQL del censo de producción». No lo arreglo porque `prisma generate`
  está vetado; el juez es el CI.
- **1 de entorno conocido:** `scrum1321` (el temporal en otra unidad, ya declarado en SCRUM-1150 c.19657).

**🔴 Error mío, cazado por el CI (run 38902849765, 16-oct 12:57Z):** de los 11 «de entorno», UNO no lo era.
`scrum237` (toda negación lleva respaldo) caía por MI test: `!todo.includes('Añadir texto en el documento')` no
tenía un positivo hermano, así que podía estar buscando un texto que no existe en ninguna parte y dar verde
para siempre. Lo metí en la cuenta del cliente de Prisma sin leer su mensaje. Arreglo: el hermano comprueba
que ese texto ES el rótulo que expone la pieza (`TD_TITULO_CABECERA`). Con él, `scrum237` y `scrum976` (que lo
ejecuta dentro de `guards:entrada`) pasan en local: 14/14 y 11/11.
- **Rojo informativo, no mío:** `guard:cls-barra-anuncio` (guards de navegador) mide CLS 0,127 a 360 px en la
  barra de oferta de la LANDING. No toca esta rama (J3).

**No visto en yaqu.app todavía:** se mira cuando entre, sobre el albarán #46 de la cuenta QA (su GET trae la
nota «Albarán de pruebas QA (SCRUM-1268).»), con el #47 de control.
A9: sin fallo que generalice — la firma separó dos campos que el contradato mezclaba, y eso ya queda escrito arriba con su localizador
