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
| `expensesView.js` | 2 (:295, :1015) | S2 |
| `productsView.js` | 1 (:891) | S2 |
| `signaturePad.js` | 1 (:413) | S2 |
| `teamView.js` | 1 (:286) | S2 |
| `tutorial.js` | 1 (:339) | S2 |

Las de S2 son «el resto» de este ticket, que va después de SCRUM-1267 (orden del orquestador).
