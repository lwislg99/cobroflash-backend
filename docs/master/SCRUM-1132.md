# SCRUM-1132 · CLIENTES · la tarjeta de notas de la ficha del cliente (la pantalla que SCRUM-1036 no trajo)

> Lo construye J2 (sesión `jv-j2v`, equipo de Javier) por encargo de su orquestador
> (`cobroflash-backend-62`). El commit `6803e3e9` de S2 (c.17030) no existe en esta máquina: no se usa.

**Medido contra:** `origin/main` = `e2533abc7ae88fd6855245a5d559f77ab7af41e0` · 2026-10-23T03:24:35Z
**Skill UI:** cargada (`yaqu-premium-ui`) antes de escribir la vista. AB6: botón del inventario (`btn-secondary`, no `btn-sm`: 44 px a 390 lo mide el guard), textarea con su nombre accesible (`aria-labelledby` al título), cero `style=` nuevos (las clases van en `styles.css`, bloque `J2:`), estados vacío y error medidos; capturas antes/después a 390, 768 y 1280 en `evidencias/SCRUM-1132/`.
**Microcopy:** los cuatro literales firmados por el fundador en c.19617 (registro: `docs/microcopy/2026-10-14-SCRUM-1132-notas-del-cliente.md`). Ninguno más. ⚠️ Queda sin firmar el respaldo del error sin `message` (ver abajo).
**Carril:** J2 (`customerDetailView.js`). `styles.css` es contenedor de S2: sólo el bloque `J2:`. Producción congelada desde el 20-oct: **no se ha visto en yaqu.app**.

A9: comprobación → `tests/scrum1327-el-veredicto-no-se-decide-a-mano.test.mjs`

## Lo que se hizo

- **La forma es la (B)** de c.19617: la «Nota fija» (`customer.notes`) se queda en la cabecera, donde ya
  estaba, y la tarjeta no la repite (`NOTAS_CLIENTE.conFecha` quita la que el servidor marca `esFija`).
  Mirada la pantalla antes (`antes-390.png`, `antes-1280.png`): a 390 la cabecera la lleva sin empujar
  nada. A 1280 la columna de texto de la cabecera sale estrujada (el nombre en tres líneas), **pero ya en
  `main` y con o sin nota**: lo causa la fila de cinco botones, no la nota. No se toca aquí.
- **La tarjeta** va tras las cifras y antes de «Actividad reciente»: las notas de `GET …/notes` (texto, y
  debajo fecha · autor), «Sin notas» si no hay ninguna con fecha, y el campo con «Añadir nota». El clic
  hace `POST`, vacía el campo y vuelve a pedir la lista (lo que se ve es lo que guardó el servidor).
- **Sólo admin:** las dos rutas son `requireRole('admin')`; al técnico ni se le pinta ni se le piden.
- **El error:** «No se pudo guardar:» + el motivo SÓLO si el servidor lo manda en `message`
  (`mensajeParaPersona`). Hoy eso es el 400 `nota_vacia`, «Escribe algo antes de guardar la nota.», que
  ya está en castellano (medido por la ruta real). En un 404/500/sin red el motivo no existe, y la pieza
  pinta «No se pudo guardar:» a secas: **nunca** `API 500: internal_error` ni `Failed to fetch`.

## Lo que queda (y por qué no se ha empujado)

1. **El texto de respaldo** para el fallo sin `message`. Propuesto «inténtalo de nuevo» (ya en este
   fichero, línea del modal de edición); el orquestador lo lleva al fundador. Hasta entonces se queda
   el literal a secas, que es firmado.
2. **`tests/scrum1560-datos-de-muestra-con-forma.test.mjs` cae en esta rama** («rutas pedidas SIN
   contrato: /admin/customers/:n/notes»): falta la entrada de `/notes` en `CONTRATOS` de
   `scripts/_datos-del-censo.mjs`, carril **S3**. El orquestador se la pide a S3 por Luis (salida (a)).
   El siguiente paso: cuando esa entrada esté en `main` y llegue la firma del respaldo, `git merge
   origin/main` en esta rama, tanda completa, y UN empujón.

## Cómo se mide

- **`npm run guard:notas-en-la-ficha`** (`scripts/guard-notas-en-la-ficha.mjs`): navegador real a 390,
  768 y 1280; vista, `api.js` y `fetch` reales; `/notes` las contesta el **router real** de `dist/` con
  `listarNotas`/`crearNota` reales, y sólo `prisma` va doblado en memoria (filtra por cada campo del
  `where`). Siembra una nota de OTRO comercio con el mismo id de cliente: si aparece, rojo (regla 2).
  Clic real en «Añadir nota» → la nota se escribe con el comercio de la sesión y sale la primera; clic
  con el campo vacío → «No se pudo guardar: Escribe algo antes de guardar la nota.»; un 500 sin
  `message` → empieza por el literal y no enseña la tripa. Los literales los lee del registro de la firma.
- **Rojo primero:** contra la vista de `main`, el guard da 6 hallazgos («la ficha NO tiene tarjeta de
  notas» a los tres anchos, con y sin notas) y el test de la tanda 4 de 5 en rojo (el del técnico es un
  negativo y en `main` pasa igual: allí no hay tarjeta para nadie).
- **Mutación** (`node docs/master/evidencias/SCRUM-1132/mutar.mjs`, desde la raíz): sin lista propia
  (SCRUM-1387), toma las `MUTACIONES_QUE_ME_TUMBAN` del test con el lector del meta-guard. Base verde en
  los dos; **6 de 6** caen en el test (en el caso de su `cae`) y en el guard (salida 1): Nota fija
  repetida, campo que no se vacía, clic sin `POST`, `err.message` pintado, sin la puerta de admin y
  botón `btn-sm`. Restauración comprobada por sha256.
  Fuera del catálogo, porque muta `dist/` y no un fichero del repositorio, se midió UNA vez con un banco
  de la sesión (no comiteado): `listarNotas` sin `merchantId` → el guard sale 1 con «sale la nota de OTRO
  comercio (regla 2)». En el mismo pase, borrar el registro de la firma dio **CIEGO** (2), no verde.
- **`tests/scrum1132-notas-en-la-ficha.test.mjs`** (en `npm test`, banco de vistas, 6 casos): literales =
  registro, la tarjeta con fecha y autor sin la Nota fija, «Sin notas», el clic (manda el texto, vacía el
  campo, pinta la nota; el botón no es `btn-sm`), el técnico sin tarjeta, y el error.
- **Guards de navegador:** `censo:guards-navegador` → **39 · 39 verdes · 0 no verdes** (los 38 de
  antes + éste).
- **Tanda completa** sobre esta rama: **12.184 tests · 11.987 pass · 40 fail · 157 skipped**. Para
  separar los míos se corrieron los **28 ficheros rojos** también en un árbol limpio en la base
  (`e2533abc`): 13 caen igual allí (cliente de Prisma, árbol anidado sin `node_modules`: el banco) y
  **14 sólo aquí**. De esos 14: tres eran la falta de este registro (811c, 854, 976), dos un `new URL`
  en mi guard (195, 414), uno dos salidas a mano del guard (1327), cinco declaraciones que la casa pide
  al nacer una pieza (1185: las dos rutas pasan a `retiradas`; 1215g/i: los seis literales a `porGrupo`;
  1480f: el script a `_sin-fila-declarados.json`; 522 y 548: el guard declarado fuera de la tanda y con
  destino no derivable), uno una negación sin hermano positivo en mi test (237) y **uno que no es mío
  de arreglar** (1560, punto 2 de arriba).
  **Repetida entera tras los arreglos:** **12.185 tests · 12.003 pass · 25 fail · 157 skipped** (suman
  el total). Caen **14 ficheros: los 13 que caen igual en la base, y `scrum1560`**. Ninguno más.

## El fallo propio (A9)

Escribí el guard con dos `process.exit` a mano (uno con `2` al no cargar el router y uno con `0` al
final) y un `new URL` sobre la ruta de la petición; luego, al arreglarlo, pasé a `veredictoDe` cuentas
escritas en línea (`hallazgos: []`). Las tres cosas las cazó la tanda, no yo: `scrum1327` las salidas y
las cuentas a mano, `scrum414`/`scrum195` el `new URL`. Ya existe la comprobación; por eso la línea
`A9:` la nombra. Lo mismo con el primer banco de mutación, que traía su lista propia: lo cazó
`scrum1387` en `guards:entrada`, y se rehízo sobre el catálogo. Y la vista usaba `onclick =`, que el
banco de vistas no dispara: el test del clic salió rojo por eso y se pasó a `addEventListener`.

## SCRUM-1132c · las notas, de tarjeta a pestaña «Notas» que se piden al abrirla (J2, 23-oct-2026)

> Lo construye J2 (sesión `jv-j2at`, equipo de Javier) por encargo de su orquestador
> (`cobroflash-backend-62`), sobre la rama de 1132b. Decisión: SCRUM-1132 c.20627.

**Medido contra:** `origin/main` = `6e336715359500c41fb252371934101b46498267` · 2026-10-23T19:45:48Z
**Skill UI:** cargada (`yaqu-premium-ui`) antes de tocar la vista. AB6: la pestaña es la de la casa
(`makeTab`, la misma de «Sitios»), el botón sigue siendo `btn-secondary` (44 px a 320 y 390 lo mide el
guard), el campo se nombra con el rótulo de la pestaña (`aria-label`), cero `style=` nuevos (bloque `J2:`
de `styles.css`), estados vacío y error medidos; capturas a 320, 390 y 1280 en `evidencias/SCRUM-1132/pestana-*.png`.
**Microcopy:** los cuatro de c.19617 y el respaldo «No se pudo guardar: inténtalo de nuevo» de c.20435
(ficha nueva `docs/microcopy/2026-10-23-SCRUM-1132-notas-respaldo.md`). El rótulo de la pestaña es el
literal firmado «Notas». Ningún texto más.
**Carril:** J2 (`customerDetailView.js`). `styles.css` (S2) y `_sin-consumir-declarados.json` (S0) son
contenedores: sólo las líneas de 1132. `scripts/_datos-del-censo.mjs` (S3) **no se toca**.

A9: comprobación → `tests/scrum709-microcopy-por-fichero.test.mjs`

### Lo que se hizo

- La tarjeta que se montaba al pintar la ficha (y pedía `GET /admin/customers/:id/notes` en ese momento)
  pasa a ser la sexta pestaña, «Notas», detrás de «Sitios» y con su misma técnica: sin número, la lista se
  pide en `renderTab('notas')` y cada apertura se numera (`peticionNotas`), así que la respuesta que llega
  tarde no pinta. Sólo admin, como antes: al técnico ni se le pinta ni se le piden (las rutas son
  `requireRole('admin')`). Lo que veía el técnico antes (ni tarjeta ni `/notes`) es lo que ve ahora.
- Sin `message` del servidor (404, 500, sin red), el error dice el respaldo firmado; con motivo, sigue
  «No se pudo guardar:» + el motivo.
- **`scrum1560` sin contrato de S3:** 12/12 en verde sin tocar `_datos-del-censo.mjs`. Control: con la
  carga temprana puesta otra vez (montar las notas al pintar la ficha) cae 11/12 y nombra
  `/admin/customers/:n/notes`. El censo táctil ya no ve las notas: las cubre `guard:notas-en-la-ficha`.
- El guard de navegador abre la ficha, comprueba que **no** se ha pedido `/notes`, pulsa la pestaña y
  mide lo de antes, ahora a 320/390/1280 (antes 390/768/1280).

### Cómo se mide

- `tests/scrum1132-notas-en-la-ficha.test.mjs`: 7/7 (nuevo: «las notas se piden al ABRIR la pestaña»).
- `npm run guard:notas-en-la-ficha`: 0 hallazgos · 0 ciegos en 9 celdas (admin con notas, admin sin
  notas, técnico × 320/390/1280).
- `node docs/master/evidencias/SCRUM-1132/mutar.mjs`: base verde, **8 de 8** caen en el test Y en el guard
  (dos nuevas: el respaldo, y las notas pedidas al pintar la ficha), restaurado por sha256.
- `scrum698`: 11/11, no salta. Muestra de guards de suite (los 16 del encargo + 1560, 1132, microcopia y
  registro: 42 ficheros, 401 casos): 400 pasan y 1 cae, mío (abajo), arreglado y vuelto a correr.
- Suite entera local: NO CORRIDA (ahorro de contexto, orden del orquestador); el obligatorio hace de suite.
- yaqu.app: NO HECHO todavía → se mira tras el merge.

### El fallo propio (A9)

La ficha de microcopy del 14-oct nombraba la nueva por su fichero, y eso es un índice a mano: lo cazó
`scrum709` en la muestra local, antes de empujar. Ya existe la comprobación; por eso la línea `A9:` la
nombra. Dos más que no generalizan aquí: volví a pasar un guion a node con un heredoc de bash y reventó en
alto (ya está dos veces en las cicatrices de J2), y crucé los 200k de contexto sin medirme entre el arranque
(140k) y el banco de mutación (229k), y avisé en ese momento, no al cruzar.

## SCRUM-1132d · el test de las notas dependía de la zona de la máquina (J2, 23-oct-2026)

> Lo hace J2 (sesión `jv-j2aw`, equipo de Javier) con el GO de su orquestador (`cobroflash-backend-62`),
> SCRUM-1132 c.20649, que responde a c.20648.

**Medido contra:** `origin/main` = `b6dd5d1a8d64abd0bf835141e8d9bac6d5d2055f` · 2026-10-23T20:21:54Z

A9: comprobación → `scripts/trinquete-de-zona.mjs`

### Lo que se hizo

El job «trinquete · ningún test nuevo mide la zona de la máquina» cayó en #2772 por
`tests/scrum1132-notas-en-la-ficha.test.mjs`, caso «la pestaña pinta las notas con fecha y autor…»: exige
`/oct 2026/` en una nota fechada `2026-10-01T09:30:00Z`, y en `Pacific/Midway` (UTC−11) eso es el 30 de
septiembre. El producto está bien: pinta la hora local del profesional. Se cambia SÓLO el dato del test a
`2026-10-15T12:00:00Z` (15-oct 01:00 en UTC−11, 16-oct 02:00 en UTC+14). La aserción no cambia: sigue
exigiendo octubre. Fijar la zona del caso no era posible sin tocar la vista, que formatea en la zona del
navegador.

### Cómo se mide

Cada zona en un proceso hijo con `TZ` en su entorno (no delante de `node` en Git Bash: no llega). Control
positivo en cada pasada: el hijo imprime su desfase y cómo ve `2026-10-01T09:30:00Z` (−840 / 23:30 en
Kiritimati, 660 / 30-sep 22:30 en Midway, 0 en UTC).

| zona | antes (fecha del 1) | después (fecha del 15) |
|---|---|---|
| Pacific/Kiritimati | 7 de 7 | 7 de 7 |
| Pacific/Midway | 6 de 7, cae el caso 3 | 7 de 7 |
| UTC | 7 de 7 | 7 de 7 |

`scripts/guard-notas-en-la-ficha.mjs` lleva la misma fecha, pero no comprueba el mes y no está en la
población del trinquete (sólo `tests/`): no se toca, fuera de lo autorizado.

### El fallo propio (A9)

Primero quise medir con `medirEnZona` del propio trinquete, sobre este único fichero: devolvió
`veredictos: {}` en las tres zonas, también con el rojo puesto, y no averigüé por qué. Era ciego, no verde,
y no lo usé para nada. El fallo de 1132c no es de esta sesión. Lo cazó el trinquete, que ya existe, y por eso
la línea `A9:` lo nombra; lo que no hace es pararlo antes del merge, porque el job no es obligatorio.
