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
