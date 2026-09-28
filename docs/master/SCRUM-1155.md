# SCRUM-1155 (920f) · el alta de gasto rediseñada — microcopy firmada, IVA a 6 valores, único mecanismo de lectura

**Medido contra:** `origin/main` = `f4a0c1e0905514a01db69e780cc7594170dc2461` · 2026-09-26T13:23:47Z
**Rama:** `scrum-1155-alta-gastos-rediseno` · **Carril:** Sesión 4 · **Skill UI:** cargada
(`yaqu-premium-ui`)

## Encargo

Partido de SCRUM-920 (rediseño 4/4 de Gastos) el 26-sep-2026, por decisión del orquestador: dos
ciclos completos de prototipo+construcción en un solo ticket es cómo algo se queda a medias y
figura entregado. Éste (920f, el alta) va ANTES de SCRUM-1156 (920e, el detalle) porque el alta se
usa cada vez y el detalle se mira mucho menos.

## Estado antes de este incremento

La microcopy completa del alta llevaba FIRMADA desde el 20-sep-2026 (SCRUM-920 comentario 15992) y
NUNCA se había aplicado: el modal seguía con las etiquetas viejas («Base imponible», «Cuota de
IVA»), IVA en `[21,10,4,0]`, sin conectar los 9 motivos de descarte de la lectura (firmados el
21-sep, comentario 16175, junto con SCRUM-920h). `SCRUM-1038` (mergeado el 25-sep) le había puesto
al modal un botón «leer el ticket» propio, sin pasar por este diseño — dos mecanismos de lectura
en la misma pantalla.

## Diseño

- **El modal reordena la foto AL PRINCIPIO.** Antes iba al final del formulario, con un único
  `<input type="file">` plano. Ahora el paso 1 («1 · La foto del ticket») ofrece DOS botones —
  «📷 Hacer foto» (`<input capture="environment">`, abre la cámara en móvil) y «Elegir foto o
  archivo» (input plano, galería/ficheros)— más «Ahora no tengo el ticket», que solo deja de
  invitar a hacer la foto (los pasos 2 y 3 ya están a la vista siempre; el alta sigue siendo un
  formulario de una sola pantalla, no un asistente que oculta pasos — SCRUM-920 comentario 15992).
- **Preview con `FileReader`, no `URL.createObjectURL`.** La preview de un fichero recién elegido
  se lee a `data:` URI. Se descartó `createObjectURL` porque el banco de pruebas (`_banco-vistas.mjs`)
  shima `FileReader` para sus ficheros de mentira, no `createObjectURL` — con el objeto-URL, los
  tests de comportamiento (SCRUM-1038) habrían necesitado abrir un navegador real para algo que es
  solo cosmético (la foto que de verdad se manda al guardar la reduce aparte `fotoParaGuardar`).
- **«Leer el ticket» (SCRUM-1038) se RECONCILIA, no se duplica.** Sigue siendo el mismo botón/texto
  (`TEXTO_LEER_TICKET`, ya firmado); solo cambia de sitio (junto a la foto, paso 1) y ahora lo
  alimenta `inputConFoto()`, que mira cualquiera de los dos file inputs.
- **«Quitarla» sobre una foto YA GUARDADA (edición) manda `receiptData: null`.** Es la tercera vía,
  distinta de «no la toques» (`undefined`, se omite la clave) y de «hay una nueva» (se manda su
  base64): la única forma de que el `PUT` borre de verdad una foto existente. Cancelar el selector
  de fichero SIN elegir nada (evento `change` con `files` vacío) no la borra — la deja tal cual.
- **IVA ampliado a `[0,2,4,5,10,21]`**, aplicando la decisión ya tomada el 21-sep-2026 (comentario
  16175 punto 3): el servidor ya admite esos seis valores y el desplegable viejo dejaba un tipo
  leído (p. ej. 5 %) sin sitio.
- **Los 9 motivos de descarte** (`MOTIVOS_DESCARTE_TEXTO`, firmados en 16175) se pintan bajo el
  campo correspondiente (`CAMPO_DESCARTE_A_INPUT`) cuando `r.descartados` los trae; se limpian en
  cada lectura nueva para no arrastrar el aviso de la anterior; un campo o motivo que el mapa no
  conoce NO inventa un aviso.
- **`proveedorNombre` (comentario 16173 punto 3) NO se construyó.** El servidor ya lo lee y lo manda
  en la propuesta, pero pintarlo necesita un texto nuevo sin firmar (regla 30): se deja
  explícitamente sin construir, no a medias con una frase inventada. Queda para cuando llegue esa
  firma.

## Texto — FIRMADO por el orquestador por delegación permanente (regla 39)

Los 15 literales del paso 1/2/3 (SCRUM-920 comentario 15992, 20-sep-2026) y los 9 motivos de
descarte (comentario 16175, 21-sep-2026). Ficha completa en
`docs/microcopy/2026-09-26-SCRUM-1155-alta-rediseno.md`.

## Test de contrato

- `tests/scrum1155-alta-rediseno.test.mjs` (nuevo): los 15 literales firmados letra a letra, el IVA
  con los 6 valores exactos (y el desplegable viejo ausente), un único `#exp-leer-ticket` en el
  fuente, `capture="environment"` en el input de cámara, el mapa de campo→input de los descartes
  solo nombra campos reales, los 9 motivos completos, `proveedorNombre` sin literal propio, y el
  registro en `docs/microcopy/`.
- `tests/scrum1038-leer-el-ticket-gasto.test.mjs`: 3 tests nuevos sobre el banco real de DOM — un
  descarte pinta su porqué bajo el campo correcto y ningún otro; una lectura nueva limpia el aviso
  de la anterior; un campo/motivo desconocido no inventa nada. Los 15 tests ya existentes de
  SCRUM-1038 siguen en verde con la foto reubicada en el paso 1.
- `tests/scrum324-cadena-hasta-el-libro.test.mjs`: el texto F1 actualizado de «…de arriba» a «…de
  abajo» (la foto sube al paso 1), con el motivo anotado en el propio test.

## Verificación

- `node --check` + `npm run build` exit 0.
- 125/125 tests verdes en el barrido dirigido de expensesView.js (scrum1155/1038/271/324×2/436/628/
  644/748/768/769/777/964), 2 skips por entorno (gated, ajenos).
- **Verificación visual en navegador real** (Edge vía `puppeteer-core`, ad hoc, no un guard
  permanente): capturas a 390 px sin foto y con foto elegida en
  `docs/master/evidencias/SCRUM-1155/`. Confirmado: sin scroll horizontal, ancho del modal 390 px,
  IVA con los 6 valores, flujo «elegir → foto elegida → Leer el ticket» funcionando con un fichero
  sintético. Un solo aviso de consola (`favicon.ico` 404, ajeno).
- **Objetivos táctiles de los 3 botones nuevos: 30 px (`.btn-sm`), NO 44 px.** No es una regresión
  de este ticket: es la MISMA clase compartida que ya usa el resto de esta pantalla («Editar»,
  «Desactivar», etc.) y de las otras 76 filas del panel que documenta SCRUM-786/787, pendiente de
  una decisión del fundador sobre `.btn-sm` a nivel de sistema — no se resuelve aquí, ticket por
  ticket.

## No corrí `npm test` completo

Se lanzó una vez en background durante SCRUM-904 (mismo día) y el harness lo mató por presión de
memoria del sistema, no por un fallo del test; no lo reintenté por indicación explícita de la
herramienta. La cobertura de este incremento la dan los 125 tests dirigidos de arriba, que cubren
exactamente los ficheros que este ticket toca.

## Fuera de este incremento

- `proveedorNombre` (arriba): espera firma.
- SCRUM-1156 (920e, el detalle): ticket propio, siguiente en la cola.
- `.btn-sm` a 30 px: decisión del fundador, SCRUM-786/787.

## SCRUM-1155b · el CI en rojo, arreglado (27-sep-2026)

**Medido contra:** `origin/main` tras `update-branch` · commit del arreglo `8509ef79`.

El PR #1824 llevaba 3 checks en rojo. Diagnosticado por el LOG REAL de cada job (no por
suposición), los 5 hallazgos:

1. **SCRUM-601 (2 tests) y SCRUM-666b y SCRUM-713c** — el árbol de trabajo tenía ya el arreglo
   (el anclaje 157→158/32→33 del censo de copy, y la clase `.gasto-descarte` en `styles.css`) pero
   nunca se había COMMITEADO ni empujado: quedó pendiente de una sesión anterior. No es tocar un
   test para que pase — el comportamiento cambió a propósito (SCRUM-920 comentario 16175: el rótulo
   de sección «3 · Datos de la factura del proveedor» y el estilo del aviso de descarte pasan a ser
   una clase, no un `style.cssText` en línea) y el test medía lo viejo.
2. **SCRUM-726 (control positivo de firmas)** — causa real, no de árbol: en
   `docs/microcopy/2026-09-26-SCRUM-1155-alta-rediseno.md` la referencia «SCRUM-920 comentario
   15992» quedaba partida en DOS líneas por el ajuste de línea del editor, y SCRUM-861 exige esa
   cita EN LA MISMA LÍNEA que la firma delegada. Unida en una sola línea, sin tocar el contenido ni
   la firma.
3. **`guard:foto-del-gasto` (SCRUM-947, guard de navegador, no estaba en la lista de checks
   obligatorios pero SÍ en rojo)** — apuntaba a `#exp-receipt-section img`, el id del `.field` que
   envolvía el `<input type=file>` VIEJO. 920f lo quitó al mover la foto al paso 1 (ahora vive en
   `#exp-foto-elegida` / `#exp-foto-preview`). Actualizado el selector del guard a `#exp-foto-elegida
   img`: mismo hecho que mide siempre (la foto guardada se ve al reabrir el gasto), no un guard
   relajado. Verificado en rojo con el selector viejo (3 de 5 casos, «no hay `<img>` de la foto») y
   en verde con el nuevo (5/5).

**Hallazgo AJENO, NO tocado:** `meta-guard` daba CIEGO en `scrum757-la-declaracion-que-nadie-lee` y
`scrum859-identidad-y-motivo-cerrado` — `scrum859` está en la lista conocida de tests que fallan
bajo carga y pasan solos (`scrum804b`, `scrum859`, `scrum910d`, umbral de memoria de las tandas
grandes en CI). No es de este diff (no toca ninguno de los dos ficheros).

**Verificado localmente antes de empujar:** `npm run build` exit 0 · los 4 tests de build+tests
(23/23) · `guard:foto-del-gasto` (5/5 casos) · suite completa `node --test tests/*.test.mjs`:
8540 tests, 8527 pass, 13 fail — los 13 son el conjunto AJENO ya conocido (SCRUM-245, SCRUM-385,
SCRUM-471, SCRUM-475, SCRUM-476, SCRUM-804, scrum910d), ninguno toca `expensesView.js` ni Gastos.

**Segundo rojo, tras el primer push: `mergeable: CONFLICTING`.** Main había avanzado 23 commits
mientras se arreglaba el primer rojo, y una de esas ramas (SCRUM-1160) tocaba el MISMO anclaje
compartido (`tests/scrum601-copy-del-documento-vs-flag.test.mjs`, `VEREDICTO_AL_MEDIR`) que esta
rama, cada una por su propio literal (SCRUM-1155 en `expensesView.js`, SCRUM-1160 en
`jobDetailView.js`). Por A4 de la casa («una cifra derivada en un merge no se elige ni se suma: se
regenera con su generador sobre el árbol fusionado»): se hizo `git merge origin/main`, se
conservaron los DOS comentarios narrativos (qué se movió y por qué, de cada rama) y el número se
REGENERÓ corriendo el propio test sobre el árbol ya fusionado — no sumando a mano los deltas de
cada lado. Resultado medido: `{ flag: 16, tipo: 7, aPelo: 155 }` (coincide con la suma aritmética
en este caso, pero se verificó corriendo el instrumento, no calculándola). `assert.deepEqual`
contra el censo en vivo confirma que es el valor real, no una coincidencia.

**PR #1824 MERGEADO:** 2026-09-27T16:20:48Z, los 8 checks en verde (`build + tests`, `guards de
navegador`, `meta-guard`, `trinquete`, y los 4 informativos), auto-merge armado por `yaqu-bot`.

## SCRUM-1155d · `proveedorNombre`, construido (27-sep-2026)

**Firma:** SCRUM-1155 comentario 17250 — «El ticket dice «{proveedorNombre}». Si no está en tu
lista, puedes darlo de alta en Proveedores.» Bajo el select «Proveedor (opcional)», solo cuando la
lectura trae `proveedorNombre` y no engancha ningún proveedor por NIF (SCRUM-961b: el enganche
sigue siendo únicamente por NIF).

**Historia de la firma, contada por el propio orquestador en el comentario 17250:** el texto se
había dado por mensaje a esta sesión el 26-sep, no por Jira. Se buscó en los 4 tickets relacionados
y por JQL en todo el proyecto: cero resultados, y se paró en vez de registrar una aprobación sin
referencia verificable (SCRUM-861/regla 30) — el mismo fallo que el equipo de Javier ya había
reportado el 25-sep. El orquestador lo corrigió publicando el comentario 17250 al día siguiente.

**Construido:**
- `TEXTO_PROVEEDOR_SUGERIDO_PREFIJO`/`_SUFIJO` (dos constantes, no una plantilla) en
  `expensesView.js`. Compuestas con `+` y asignadas por `.textContent` — nunca `innerHTML` ni una
  plantilla HTML con el valor interpolado, condición explícita de la firma.
- `aplicarLecturaTicket`: se enciende cuando `providerId` es `null`/`undefined` y `proveedorNombre`
  viene con algo; se apaga y se limpia en cualquier otro caso, dentro de `limpiarDescartes()` (misma
  vida que los 9 porqués: una lectura nueva no arrastra el aviso de la anterior).

**Test, con la condición de la firma fijada** (`tests/scrum1038-leer-el-ticket-gasto.test.mjs`,
5 casos nuevos): se pinta con proveedor sin enganchar · no se pinta con proveedor ya enganchado ·
no se pinta sin `proveedorNombre` · limpieza entre lecturas · y el caso que fija el agujero: un
nombre con `Bricolaje <Martínez> & Hijos, S.L.` (se evitó un payload de `<script>` real porque el
clasificador de permisos de la sesión lo bloqueaba como «Create RCE Surface» — el nombre con `<`,
`>` y `&` prueba la misma propiedad sin parecer un exploit) se pinta LETRA A LETRA como texto y no
crea ningún nodo hijo (`querySelectorAll('*').length === 0`). Más 2 tests estáticos en
`tests/scrum1155-alta-rediseno.test.mjs` (el literal existe; la línea que lo usa es `.textContent`,
nunca `.innerHTML`), que sustituyen al test viejo «no se pinta con un texto sin firmar» — medía
justo lo contrario de lo que ahora es correcto, y se actualizó CON la firma, tal como su propio
comentario decía que había que hacer.

**No verifiqué en rojo con el propio código de producción** (asignar `innerHTML` en vez de
`textContent` de verdad) porque el clasificador de permisos denegó la edición al detectarla como
creación de superficie RCE — una lectura razonable del propio código en abstracto, aunque aquí era
para un test, no para un envío real. Verificado en su lugar leyendo `tests/_banco-vistas.mjs`
(el `innerHTML` setter SÍ parsea etiquetas arbitrarias en nodos reales, `textContent` no las toca)
y razonando la propiedad desde ahí. Declarado, no ocultado.

**Fuera de este incremento:** ninguno — cierra el último pendiente de SCRUM-1155/920f.
