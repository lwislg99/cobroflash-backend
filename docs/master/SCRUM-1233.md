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
A9: comprobación → `tests/scrum1233e-trabajos-y-parte-sin-tripa.test.mjs`

## 1233f — el techo de `jobsView.js` en el trinquete de SCRUM-644, de 2 a 0 (S4, s4-15oct)

**Medido contra:** `origin/main` = `d09323e92bf1302dd052d1d90ef46a2e4db928bc` · 2026-10-15T16:21:52Z

Apilada sobre la rama de 1233e a propósito: las dos escriben al final de este registro y, en ramas
hermanas, chocarían al mergear. Lo pidió el orquestador (el techo decía 2 y el censo de 644 ya veía 0).

- **Quién sale, uno a uno** (contados el 2-sep sobre `19ea5a4052340cbe9598451c9ede91f2c1a07170`, con el
  instrumento de hoy): `jobsView.js:281` `showToast(… invalid_transition … 'No se pudo guardar: ' + … err.message)`
  y `:361` `showToast('No se pudo generar el cobro: ' + (err?.data?.message || err.message))`.
- **Cuándo y por qué dejaron de contar:** recorrida la cadena de primer padre de `main` (9 commits que
  tocan `jobsView.js` desde entonces), el censo pasa de 2 a 0 en el merge del PR #1134 (SCRUM-727,
  `d1b65eb91b6940246d87d0931188c24fc92ee0d9`, 7-sep). Pasaron por `avisoDeFallo`, que pinta a través de
  una VARIABLE: el censo de 644 no la ve; el de 1233 sí (techo 1), y 1233e lo deja a 0. O sea: el techo 2
  llevaba desde el 7-sep sin nadie debajo, y la tripa siguió en pantalla hasta 1233e.
- El tope de la suma (`total <= 57`) baja a 53: la tabla sumaba 55 desde SCRUM-1233 (`jobDetailView`
  11 → 9 sin bajar el tope) y salen estos 2.
- `jobsView.js` entra en «lo arreglado se queda en cero».
- **Rojo probado:** sembrando `showToast('x: ' + err.message, 'error')` en `jobsView.js` (diff 1/0) caen
  2 de 14 (el trinquete y «se queda en cero»); sin la siembra, 14 de 14.
- **De paso, el rojo de esta rama en el CI (run del 15-oct, 16:55Z):** las dos entradas de hoy (1233e y
  1233f) se empujaron sin su línea `A9:`, y `scrum1294` cayó con 1 fallo de 11.588. Era nuestro, no del
  otro equipo. 1233e la recibió en `5bc0aa25ccbbbcddf10100e593aa0c03f0b1a895`, y aquí se mezcla esa
  rama: el merge dejó aquella línea al FINAL del fichero, o sea, dentro de este tramo y no del suyo, así
  que se ha devuelto a su sitio y este tramo lleva la suya.
A9: comprobación → `tests/scrum644-trinquete-mensaje-crudo.test.mjs`

## 1233g — visto en yaqu.app, y un banco que intercepta producción bloquea el service worker (S4, s4-16oct)

**Medido contra:** `origin/main` = `48fc00f6a90089b0f172b58c49413d889288bec0` · 2026-10-16T11:11:49Z

Producción servía ese mismo SHA (leído en `/version`).

**Skill UI:** no cargada · no se toca ninguna pantalla: sólo se miran, en producción.

**Visto en yaqu.app** (SCRUM-1233 c.19857; banco `docs/master/evidencias/SCRUM-1233/ver1233.mjs`, salida
en `ver1233-salida-16oct.txt`). El fallo se simula en el navegador, y cualquier otra petición que no sea GET se aborta:

| caso | lo que sale | control |
|---|---|---|
| Trabajos #77 · Agendar · 500 sin frase | `No se pudo guardar` | el mismo `err.message` vale `API 500: internal_error` |
| ídem · sin red | `No se pudo guardar` | `err.message` = `Failed to fetch` |
| ídem · 400 con `message` | `No se pudo guardar: <frase>` | el camino del detalle funciona |
| parte #9 · firma del cliente · 400 `firma_invalida` | `No hemos podido registrar la firma`, botón `Reintentar`, el pad no se cierra | el parte sigue `borrador`, releído |
| Albaranes (ya lo hacía bien) · 500 con y sin `message` | aviso sin detalle / con la frase debajo | igual que antes de 1233e |

**Error mío, y repetido:** la 1.ª pasada abrió el contexto sin `serviceWorkers: 'block'`, y tres
`PATCH /admin/jobs/77` con cuerpo `{}` llegaron a producción (~11:10Z). El #77 sigue `pendiente_agendar`,
`scheduledAt: null`, `notes: null`. Su `updatedAt` NO se ha podido medir: ninguna lectura lo expone (lista y
detalle, 0 veces; `/ics` → 409 `not_scheduled`), y no sé si Prisma lo mueve con `data: {}`. La cicatriz S4
del 1-oct ya decía esto, con «sin comprobación». Ahora la tiene:

- `tests/scrum1233g-banco-bloquea-el-sw.test.mjs`, por AST sobre `docs/master/evidencias/` + `scripts/`. Un
  fichero que llama a `.route(` y abre él mismo el contexto contra `yaqu.app` lleva `serviceWorkers: 'block'`.
  Si su contexto lo abre un import del repo, se le aplica lo mismo. Si lo abre un fichero que NO está en git,
  el banco va nombrado en `FUERA_DEL_REPO`. Las dos mitades: uno nuevo cae, y uno de la lista que deja de
  estarlo cae también.
- **Segundo error mío, en el mismo ticket:** el primer censo, por regex, dio «5 de 7 bancos sin bloquear».
  Era falso, porque contaba `yaqu.app` dentro de COMENTARIOS. Por AST, esas 5 sondas (1188e, 1227, 1231b,
  1482b, 917i) no abren contexto: lo abre `sondas-s2/comun.mjs`, fuera del repo, y ése SÍ bloquea (medido,
  su línea 15). Van en `FUERA_DEL_REPO`. Que dependan de un fichero que no está en git es de S2: reportado
  al orquestador, no tocado.
- **Rojo probado**, sobre `470b63668c573220a12a023abef75e657c6db11c` y deshecho cada vez (`git status` vacío):
  ① quitar el `serviceWorkers: 'block'` del `newContext` de `ver1233.mjs` (diff 1/1; el de su comentario
  se queda) → cae y lo nombra. ② sembrar una sonda que importa `./no-existe.mjs` → cae «fuera del repo» y
  la nombra. ③ subir junto a 917i un `comun.mjs` que bloquea → cae «sácalo de FUERA_DEL_REPO». ④ el mismo
  `comun.mjs` sin bloquear → cae «NO bloquea» con 917i. Población del verde: 895 ficheros, 8 llaman a
  `.route(` (bloquea 3 · fuera del repo 5).
A9: comprobación → `tests/scrum1233g-banco-bloquea-el-sw.test.mjs`

## 1233h — «Copiar enlace» copiaba la PORTADA cuando la factura aún no tenía cobro (S2, s2-18oct)

**Medido contra:** `origin/main` = `2cc3243ec30c41e27bbe04d0d5647f241c83c28c` · 2026-10-18T18:48:22Z

**Skill UI:** cargada · cambia un componente compartido (`waFallbackBar`, api.js) y una línea de la ficha del Trabajo; ningún texto nuevo.

**El defecto, medido antes de tocar nada.** La barra de fallo de WhatsApp de la ficha del Trabajo
(`jobDetailView.js:1475`) recibía `link: token ? origin + '/pay/invoice/' + token : location.origin`. Sin
`payToken` —la factura aún no tiene cobro— el botón «📋 Copiar enlace» copiaba `https://yaqu.app` y decía
«✓ Enlace copiado — mándaselo por SMS». Sonda `sondas-s2/enlace-falso.mjs` (fuera del repo, arnés
`comun.mjs` con el service worker bloqueado): código SERVIDO por yaqu.app (build `74e60ebe5`), el GET del
trabajo #77 completado con UNA factura de mentira (QA no tiene facturas) y el POST de reenvío CONTESTADO
por la sonda. Nada salió a producción (`noGet` = sólo ese POST, «contestada por la sonda»).

| caso (respuesta del reenvío, la forma real de `invoicesAdmin.routes.ts:645-690`) | lo que copia |
|---|---|
| CONTROL · con token · 200 `sent:false`, `pay_token` | `https://yaqu.app/pay/invoice/tokSONDA123` |
| cliente sin teléfono · 400 `customer_missing_phone` (el cobro no llega a crearse) | `https://yaqu.app` |
| cobro no creado · 200 `sent:false`, `pay_token: null` | `https://yaqu.app` |
| error de red · 500 | `https://yaqu.app` |

**La forma, y por qué ésta.** Sin enlace, la barra NO pinta «Copiar enlace»; «Enviar por email» y
«Reintentar WhatsApp» se quedan. Quien llama pasa `null`, nunca la portada. Un enlace falso con forma de
bueno es peor que no ofrecer copiar nada. Descartadas: ① un botón deshabilitado con su motivo → pide un
texto nuevo (regla 39); ② crear el cobro para que haya enlace → es backend y dinero (S1, STOP).
⚠️ **Choca con la letra de A20.5** (`docs/SPRINT_DEMO_READY_EXT3.md:417`, «SIEMPRE … Copiar enlace»),
que daba por hecho que había enlace. Con enlace, las tres salidas siguen; sin él, quedan dos. Declarado
aquí y al orquestador.

**El gemelo es de J1:** `invoiceDetailView.js:405` y `:421`, la misma rama a `location.origin`
(para-javier §25.4). Con este cambio, su arreglo es cambiar `: location.origin` por `: null` en esas dos
líneas, y bajar a 0 el techo de `invoiceDetailView.js` en el test. No lo toco: no es mi fichero.

**Test** `tests/scrum1233h-copiar-enlace-sin-enlace.test.mjs`: ① ejecuta la `waFallbackBar` REAL, recortada
de api.js, sobre un DOM mínimo — con control positivo (con enlace, el botón existe y copia ESE enlace) y sin
enlace (`null`, `undefined`, `''`) no hay botón y los otros dos sí. ② censo por fichero de `location.origin`
pasado a pelo como enlace, sobre código sin comentarios, con techo y sus dos mitades (J1: 2).
**Rojos sembrados** y deshechos (diff limpio después): `if (link)` → `if (true)` cae ①×3 (el control sigue
verde: la mutación es la que es); volver a `: location.origin` en jobDetailView cae ②. Tanda de los 159
ficheros que leen `api.js` o `jobDetailView.js`: los mismos 403 rojos en rama y en `main` limpio, nombre a
nombre (el worktree no tiene `dist`); la rama sólo suma estos 6 en verde. La tanda completa la da el CI.
A9: comprobación → `tests/scrum1233h-copiar-enlace-sin-enlace.test.mjs`