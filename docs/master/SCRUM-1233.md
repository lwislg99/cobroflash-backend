# SCRUM-1233 — Un solo sitio para «qué le enseño a una persona cuando falla», y un censo que lo vea

**Medido contra:** `origin/main` = `61a975bb10fee30aad45fdbbc80eb07d6c808908` · 2026-09-29T09:22:34Z

Carril S2 (pantallas) · rama `scrum-1233-mensaje-para-persona` · sesión `s2-29a`.

## Premisas del ticket, contra el árbol

- **«No existe un censo AST»: FALSO.** Existe desde SCRUM-644 (`tests/_censo-mensaje-crudo.mjs`). El
  defecto es que estaba EN VERDE con los dos sitios rotos delante: solo reconoce
  `pintor(… .message …)`. No veía la ASIGNACIÓN (`albaranesView.js:190`, `detalle.textContent = …
  err.message`; `albaranesView` tenía techo 0 y pasaba) ni el paso por una VARIABLE (`jobsView.js:397`).
- **«2 sitios rotos»: son más.** Cerrados los puntos ciegos, el censo nuevo ve 19 sitios más (con los
  arreglos de este ticket ya dentro). Casi todos son de otro carril y solo se declaran.
- **Carriles (§11bis):** `jobsView.js` y `albaranDetailView.js` son de S4. Los adopta S4 cuando el helper
  esté en `main` (decisión del orquestador). `cuerpoDelDocumentoSuelto.js:86` ya ERA el helper, pero
  compone el cuerpo de `POST /admin/invoices` (camino de emisión, reglas 38/40): no se toca.

## Lo construido

- `api.js` · `mensajeParaPersona(err, respaldo)`: `data.message` si es una frase no vacía; si no, el
  respaldo. Nunca `err.message`.
- `albaranesView.js`: ya no pinta `err.message` bajo el aviso. Solo añade la frase del servidor si la hay.
- `jobDetailView.js`: seis sitios pasan por el helper, con su mismo texto aprobado como respaldo
  (dirección de la obra, consolidar, guardar albarán, completar entrega, emitir factura, generar líneas;
  este último pintaba `e.message`).
- `quoteRevisiones.js`: la regla de SCRUM-1215 lote 4 pasa al helper, sin cambiar el comportamiento.
- Censo (`_censo-mensaje-crudo.mjs`): `mensajeParaPersona` entra en TRADUCTORES. `crudosOcultosDe` /
  `censoOculto` ven ① la asignación a `textContent`/`innerText`/`innerHTML`/`outerHTML`, ② la variable
  manchada que llega a un pintor o a una asignación y ③ los pintores locales (lista a mano). Las tres
  formas son disjuntas de SCRUM-644, que así conserva su total de 57. Es FAIL-CLOSED: un fichero con
  error de parseo sale CIEGO.
- Trinquete SCRUM-644: `jobDetailView.js` 11 → 9 (anotado).
- Censo SCRUM-601 (`_censo-copy-vs-flag.mjs`): aprende que `mensajeParaPersona(e, R)` es `e.data.message
  || R`. Sin eso, «No se pudo emitir la factura.» salía del censo (161 → 160) sin dejar de pintarse:
  el instrumento perdía vista, y la cifra NO se tocó.

## Tests

- `tests/scrum1233-mensaje-para-persona.test.mjs`: el helper; el VIAJE (lista de albaranes en el banco con
  el `apiRequest` real: un 500 sin mensaje no enseña «API 500», sin red no enseña «Failed to fetch», y la
  frase del servidor sí se enseña); control positivo con los dos sitios rotos de `origin/main`; negativo;
  ciego; el trinquete por fichero (techo total 19) y lo arreglado a cero.
- Rojo probado: con `albaranesView.js` de `origin/main` caen 3 (los dos del viaje y el trinquete).
- Vecinos por nombre de fichero: 1145/1146, 1 saltado (staging). `scrum1093h` da 3 rojos en local
  también SIN esta rama (sobre `src/albaranPdf.service.ts`, que no se toca): lo juzga el CI.

## Techos declarados (29-sep), por carril

| fichero | sitios | carril |
|---|---|---|
| `invoiceDetailView.js` | 3 (:418, :517, :881) | J |
| `settingsView.js` | 3 (:1516, :1609, :1785) | J |
| `customerDetailView.js` | 1 (:982) | J |
| `facturasRecibidasView.js` | 1 (:228) | J |
| `libroRegistroView.js` | 1 (:197) | J |
| `plansView.js` | 2 (:9, :219) | J (pagos), por confirmar |
| `cobrosView.js` | 1 (:116) | J (pagos), por confirmar |
| `jobsView.js` | 1 (:398) | S4 |
| `expensesView.js` | 1 (:295) | S2 · espera firma |
| `signaturePad.js` | 1 (:413) | S2 |
| `tutorial.js` | 1 (:339) | S2 |

Las de S2 son «el resto» de este ticket, que va después de SCRUM-1267 (orden del orquestador).

## El resto en S2 (rama `scrum-1233b-resto-s2`, apilada sobre la del helper)

- `expensesView.js:1015` (guardar el gasto) y `teamView.js:282` (tope de usuarios) pasan al helper con su
  mismo texto aprobado. Techo total: 19 → 16.
- `productsView.js:891` era un FALSO POSITIVO: `codigo` se lee solo en la condición del ternario. El censo
  ya no cuenta lo que solo DECIDE (la condición de un ternario y los lados de `===`/`!==`). Tiene control
  negativo, y un control de que la poda no se lleva las RAMAS del ternario.
- Se quedan declarados, con su motivo:
  - `signaturePad.js:413` es CONTRATO: `onConfirm` lanza un Error cuyo `message` ya es el texto traducido
    (`mensajeDeFalloAlFirmar`, `mensajeDelAlbaran`). Pasarlo por el helper lo borraría. Ojo:
    `parteDetailView.js:993` (S4) mete `r.error.message` crudo en ese contrato.
  - `tutorial.js:339` pinta `r.message` del CUERPO de un 200, que ya es `data.message`.
- **Espera firma:** `expensesView.js:295`. Pinta `Error: ${err.message}` en un `innerHTML` al fallar la
  carga de la lista, y no hay texto aprobado para ese caso. No se pinta nada nuevo hasta la firma.

## 1233c — la carga de la lista de Gastos (S2, s2-29a)

**Medido contra:** `origin/main` = `b1d8845daf38394c33a22814db323394517c091a` · 2026-09-29T09:59:22Z

- `expensesView.js` (`loadExpenses`, antes `:295`): pintaba `Error: ${err.message}` en un `innerHTML`. Ahora pinta `mensajeParaPersona(err, 'No se han podido cargar los gastos. Vuelve a intentarlo.')` por `textContent`. Texto firmado en SCRUM-1233 c.17504.
- Techo del censo: 16 → 15; `expensesView.js` sale de la tabla (techo cero).
- Viaje (lista de Gastos en el banco con el `apiRequest` real): un 500 y sin red pintan el texto firmado; la frase del servidor sale como TEXTO, no como HTML. Rojo probado: con el fichero de main caen 4.
