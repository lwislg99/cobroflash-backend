# SCRUM-1038 · «leer el ticket» rellena el alta de gasto

**Fecha:** 25-sep-2026 · **Carril:** S2 (front) · **Pedido por:** el orquestador (relevo, ticket con
la mitad de S1 hecha desde el 22-sep) · **Skill UI:** cargada (`yaqu-premium-ui`)
**Medido contra:** `origin/main` = `607541ed710bec7148670a9b44a35638a745a2ec` · 2026-09-25T13:13:05Z
**Rama:** `scrum-1038-leer-el-ticket-gasto`

## El encargo, medido antes de escribir (PASO 0)

`POST /admin/expenses/leer-ticket` (SCRUM-912) ya lee la foto con IA y devuelve
`{ ok, propuesta, descartados, justificante }` con los MISMOS nombres de campo que
`POST /admin/expenses`. S1 lo confirmó el 22-sep (comentario SCRUM-1038): «no hace falta ningún
ajuste de servidor». `grep -ri "leer-ticket|leerTicket"` sobre todo `public/` daba **0 resultados**
el 25-sep (triage S0, comentario 16936): el botón no existía. Este ticket es 100 % front.

## Lo que se hace

`public/dashboard/js/expensesView.js`, dentro de `openExpenseModal`:

- Un botón `#exp-leer-ticket` junto al selector de foto (`#exp-receipt-section`). Empieza
  **escondido** (`display:none`) y aparece solo cuando se elige una foto (listener de `change` del
  `<input type=file>`); sin foto, no tiene sentido mostrarlo.
- Al pulsarlo: se deshabilita, cambia su texto a «Leyendo…», reduce la foto con la MISMA función
  que ya usa el guardado (`fotoParaGuardar`, SCRUM-947 — así una foto de móvil no revienta el
  límite de 2 MB del `express.json`), y llama a `POST /admin/expenses/leer-ticket`.
- **Nunca guarda solo** (AC#2): la propuesta se pinta en los campos existentes y el profesional
  revisa y pulsa «Añadir gasto» como siempre. Solo se rellenan los campos que la lectura trae —
  `null` no borra lo que el profesional ya hubiera escrito a mano (AC#4).
- El proveedor solo se engancha si el servidor ya lo emparejó por NIF exacto (`propuesta.providerId`,
  la regla de SCRUM-961b); si no hay proveedor pero sí NIF leído, se escribe el NIF (queda de solo
  lectura hasta elegir proveedor, el mismo comportamiento que tecleado a mano, SCRUM-937b).
- **Lectura vacía** (`propuesta` con TODOS los campos `null`: foto borrosa, sin texto, o que no es
  un ticket) se trata como un fallo: mismo aviso genérico, formulario intacto.
- **El tope de 5 lecturas/día** (`lecturas_agotadas`, AC#3) lleva SU mensaje, distinto de
  cualquier otro fallo del servidor (sin IA configurada, cuota de Google, formato no parseable,
  500, o sin red): «nunca un error técnico», tal como pide el ticket.
- Doble clic / clic repetido mientras lee: no llama dos veces (el botón se deshabilita
  SÍNCRONAMENTE antes del primer `await`, comentario 16241 del ticket).

**Textos nuevos**, firmados por el orquestador por delegación (SCRUM-1038 comentario 16942), ficha
`docs/microcopy/2026-09-25-SCRUM-1038-leer-el-ticket.md`:

> Leer el ticket

> Leyendo…

> Has llegado al máximo de 5 lecturas de ticket hoy. Escribe los datos a mano.

> No hemos podido leer este ticket. Escribe los datos a mano.

## `tests/_banco-vistas.mjs` — dos huecos del mini-DOM, corregidos ahí y no rodeados

El banco compartido no tenía dos piezas que este modal necesita de verdad, la misma familia de
huecos que `prepend`/`classList`/`parentNode` documentan en el propio fichero:

1. **`selectedOptions` de un `<select>`** — no existía; `aplicarNifSegunProveedor` (ya en el
   fichero desde antes de este ticket) revienta en cuanto algo asigna `.value` a un proveedor.
2. **El atributo `style="…"` del marcado no se reflejaba en `.style`** — nacía siempre
   `{ display: '' }`, así que un test no podía leer el estado ESCONDIDO inicial de un botón o de
   `#exp-error` (los dos, del propio marcado de esta pantalla) sin que el producto lo tocara antes
   por JS.

Los dos se corrigieron en `_banco-vistas.mjs`, no rodeados desde el test ni desde la vista.

## Verificado

**DOM (mini-banco, `tests/scrum1038-leer-el-ticket-gasto.test.mjs`):** 15/15 verdes —
botón escondido/visible, lectura completa (los 8 campos + proveedor por NIF + el cuerpo de la
petición), lectura parcial (no borra lo ya escrito), lectura vacía, el tope, cuatro fallos de
servidor distintos + un fallo de red, y el doble clic. Rojo comprobado a mano (A21): quitando la
guarda `if (btnLeerTicket.disabled) return`, el test del doble clic cae («ha llamado 2 veces»);
restaurado, vuelve a los 15/15.

**Navegador real, 390 px** (`docs/master/evidencias/SCRUM-1038/captura.mjs`, chrome-headless-shell,
el mismo patrón que `docs/capturas/scrum-296`): CSS real + `api.js`/`modalHeader.js`/
`expensesView.js` reales, solo `fetch` suplantado, un `File` real seleccionado por
`DataTransfer` y `FileReader` del navegador (sin dobles). Tres capturas en esta misma carpeta:

| fichero | qué muestra |
|---|---|
| `expensesview-boton-visible-390.png` | foto elegida, botón «Leer el ticket» visible |
| `expensesview-lectura-completa-390.png` | los 8 campos + proveedor «Leroy Merlin» + NIF, rellenos |
| `expensesview-tope-390.png` | el aviso del tope, formulario intacto |

**Suite completa:** `npm test` sobre este árbol antes de empujar (resultado en el informe de
entrega de esta sesión).

## Error propio

- El primer intento del comentario HTML dentro de la plantilla del modal llevaba una palabra entre
  acentos graves (`` `change` ``) — el mismo defecto histórico de `exportView.js` que
  `tests/scrum417-descargar-datos-carga.test.mjs` existe para cazar: el backtick cierra el
  template literal de `innerHTML` a medias y el fichero deja de parsear. Lo cazó exactamente ese
  test, en el primer `npm test` de esta rama. Corregido quitando los acentos graves del comentario.
- Los dos huecos del banco (`selectedOptions`, `style`) no se sospechaban al escribir el test: los
  destapó el propio rojo del banco al intentar medir el camino del proveedor y el estado inicial
  del botón. Se corrigieron ahí, con su motivo, en vez de rodearlos con una aserción más floja.

## Lo que NO cubre

- El tope real de Google (cuota del modelo) y el tope propio de 5/día NO se han medido en staging
  con lecturas reales: consumirían cuota real y el permiso de SCRUM-899 la limita a 5 al día para
  todo el proyecto. El dominio (`sanearLectura`, el emparejamiento por NIF) ya lo cubre
  `tests/scrum912-leer-ticket-gasto.test.mjs` y `tests/scrum961b-el-nif-que-no-cuela.test.mjs`, sin
  tocar Google.
- `.btn-secondary.btn-sm` (la clase reutilizada para el botón) mide por debajo de los 44 px de AB6
  — es el hallazgo YA ticketado y explícitamente frenado (SCRUM-786, «decisión del fundador»,
  compartido por 13 sitios de la app): no se toca aquí, por indicación explícita del orquestador de
  no tocar 332/334/786.
- Sin matriz de dispositivos real (solo el ancho simulado de 390 px) ni medidor de contraste AA
  aparte; se reutilizan tokens y clases existentes sin color nuevo.

## Ficheros

- `public/dashboard/js/expensesView.js` — el botón, `aplicarLecturaTicket` y las cuatro constantes.
- `tests/_banco-vistas.mjs` — `selectedOptions` de `<select>` y el reflejo de `style="…"`.
- `tests/scrum1038-leer-el-ticket-gasto.test.mjs` — 15 tests de contrato del DOM.
- `docs/microcopy/2026-09-25-SCRUM-1038-leer-el-ticket.md` — la ficha de los cuatro textos.
- `docs/master/evidencias/SCRUM-1038/captura.mjs` + sus tres PNG — la medición en navegador real.
