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

## 1233d — el helper también entiende el texto aprobado que lanza el PANEL (S2, s2-29c)

**Medido contra:** `origin/main` = `82cb31c81e3fa7357819af7370a4fcf53bff6682` · 2026-09-29T15:58:12Z

**La regresión (la encontró el equipo de Javier):** desde 1233b, en Gastos, una foto que no se puede abrir
enseñaba «Error al guardar.» en vez del texto firmado de SCRUM-947. `expensesView.js:1023` pasó a
`mensajeParaPersona(err, 'Error al guardar.')`, y el helper solo leía `err.data.message`;
`fotoParaGuardar` lanza `AVISO_FOTO_NO_SE_ABRE` como `Error` LOCAL, así que caía al respaldo.

**El arreglo va en el helper, no en el sitio:**
- `errorParaPersona(texto)` (api.js): el `Error` que lanza el panel cuando lo que tiene que leer la persona es un
  texto YA aprobado. `err.message` sigue siendo ese texto (el `===` de `expensesView.js:904` no cambia).
- `mensajeParaPersona` honra esa marca (`textoAprobado`) después de `data.message`. Un `Error` local SIN
  marca («Failed to fetch», un TypeError) sigue cayendo al respaldo: leer `err.message` a secas NO era el arreglo.
- `fotoParaGuardar`: sus 3 `throw` pasan a `errorParaPersona(AVISO_FOTO_NO_SE_ABRE)`. Sin texto nuevo.

**Barrido de los llamadores (AST del `try` de cada `catch`, y lo que llama por dentro):**

| Llamador | Carril | ¿Error local con texto aprobado? |
| --- | --- | --- |
| `expensesView.js:1023` (guardar) | S2 | **SÍ** (`fotoParaGuardar`): arreglado |
| `expensesView.js:302` (carga) | S2 | no (solo `apiRequest`) |
| `albaranesView.js:191` | S2 | no (`pintarError` de la carga) |
| `jobDetailView.js` 1146 · 1675 · 2781 · 3407 | S2 | no (solo `apiRequest`) |
| `jobDetailView.js:3047` / `:3152` (`onGuardar` / `onEntregarYFirmar`) | S2 | no: `crearAlbaran` es `apiRequest`, y los fallos de emitir/enviar se tragan con su aviso |
| `quoteRevisiones.js:206` | S2 | no (solo `api(...)`) |
| `teamView.js:282` | J3 | no (solo `apiRequest`); no tocado |

**Tests:** `tests/scrum1233d-texto-aprobado-local.test.mjs`. ① helper: la marca se honra; `err.message` sin marca,
no; `data.message` sigue ganando. ② VIAJE: modal de alta de Gastos en el banco, foto que no abre por ninguna de
las dos vías de `abrirFoto`, clic en «Añadir gasto», se LEE `#exp-error`, y el gasto no sale hacia el servidor.
Controles: un 500 sin frase → «Error al guardar.»; una frase del servidor → la suya.
**Rojo probado:** con `api.js` y `expensesView.js` de main caen 2 de 4; el del viaje pinta exactamente «Error al guardar.».

## 1233e — los dos sitios de S4: la lista de Trabajos y la firma del parte (S4, s4-15oct)

**Medido contra:** `origin/main` = `73e41ab00f727fae5c6c8f1715d6eb6749133502` · 2026-10-15T16:10:09Z

**Skill UI:** no cargada · no cambia nada visual: solo qué texto, ya aprobado, sale en un aviso que ya existía.

- `jobsView.js` · `avisoDeFallo(prefijo, err)` (antes `:397`), el único punto por el que la lista de
  Trabajos enseña un fallo (guardar el estado, asignar técnicos ×2, generar el cobro). Caía a
  `err.message`: medido con el `apiRequest` real, un 500 sin frase pintaba
  «No se pudo guardar: API 500: internal_error». Ahora `mensajeParaPersona(err, '')`: sin frase del
  servidor, el prefijo solo. Los prefijos son los literales que ya usaba la pantalla; ningún texto nuevo.
- `parteDetailView.js` (antes `:1276`), el aviso que esta misma tabla dejó a S4 (c.17504): el rechazo
  de la firma que no es `parte_vacio` subía `r.error.message` crudo al contrato del pad. Ahora
  `mensajeDelAlbaran(r.error)`, lo mismo que el albarán ante el mismo rechazo (`albaranDetailView.js`,
  `mensajeDeFalloAlFirmar(resultado.error)`): «No hemos podido registrar la firma», con la frase del
  servidor entre paréntesis si la mandó. `parte_vacio` sigue con su texto propio.
- Trinquete: `jobsView.js` 1 → 0 y sale de la tabla; total 14 → 13. El censo, ejecutado con el módulo
  de esta rama: sobre `origin/main` ve `jobsView.js:398` (control positivo) y sobre la rama, 0; 96
  ficheros mirados en los dos.
- No tocado: lo aparcado de `[PENDIENTE…]` (c.17568, permisos). El techo de `jobsView.js` en el trinquete
  de SCRUM-644 dice 2 y el censo de 644 ya veía 0 ANTES de este cambio (medido sobre `origin/main`);
  es techo, no igualdad, y no lo muevo sin saber cuándo bajó.
- **SCRUM-1340 (`scrum811c`), la lista de heredadas encoge 4:** los merges #1952, #1954, #1961 y #1979
  (los de 1233, 1233b, 1233c y 1233d) pasaban a «DECLARA» en cuanto esta entrada 1233e declara la skill,
  porque el motor junta las entradas por FICHERO de registro y los cuatro escribieron en este mismo
  `SCRUM-1233.md`. El guard cae hasta que se quitan («la lista encoge diciéndolo, no en silencio») y se
  quitan, cada uno con su línea comentada y el motivo. No relaja nada: esos cuatro pasaban antes por la
  lista y pasan ahora por «DECLARA». ⚠️ Lo que sí queda dicho: **no la declararon ellos**; cualquier
  registro con una heredada dentro que reciba una entrada nueva de interfaz hará lo mismo.

**Tests:** `tests/scrum1233e-trabajos-y-parte-sin-tripa.test.mjs` (6). Trabajos: un 500 y sin red dan el
prefijo solo, con control de que el error de `api.js` SÍ lleva la tripa (si no la llevara, el test no
probaría nada); la frase del servidor sale detrás del prefijo (control, pasa en los dos lados). Parte, en
el banco del almacén con `firmarParte` real: 400 `firma_invalida` sin frase → el texto del albarán; con
frase → el molde con paréntesis; `parte_vacio` → su texto (control, pasa en los dos lados).
**Rojo probado:** con las dos vistas de `origin/main` (diff 4/5 y 1/5) caen 5 de 19: los cuatro de
1233e que no son control y el trinquete. Vecinos: 65 ficheros que nombran estas vistas o los censos,
600/600, 0 saltados. Suite completa NO corrida: 1.804 MB libres, por debajo del umbral (A6).
