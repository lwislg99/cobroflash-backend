# SCRUM-1560 · los datos de muestra del censo táctil eran IMPOSIBLES: ahora tienen la forma del servidor

## 17-oct-2026 · S3 · contrato por ruta, vistas de detalle con id, y el antes/después

**Medido contra:** `origin/main` = `4aae2b7d8099e641acc72c795ba6261941543111` · 2026-10-17T20:12:50Z

Ancla de `node scripts/equipo/ancla.mjs` · rama `scrum-1560-datos-de-muestra-con-forma-del-servidor`.

A9: comprobación → `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`

### Lo que había
`DATOS` de `scripts/censo-objetivo-tactil-panel.mjs` servía ocho rutas y a todas las demás les
devolvía `[]` (lo midió la sonda de SCRUM-1559, `evidencias/scrum1559/sonda-fixture-relleno.mjs`):
28 rutas reales caían en ese relleno (varias son OBJETO en el servidor), seis recibían el dato de
OTRA ruta y cinco vistas de detalle se montaban sin id (`/admin/jobs/NaN`, `/admin/partes/undefined`…).

### El arreglo (sólo el instrumento; ninguna vista tocada)
- `scripts/_datos-del-censo.mjs` (nuevo, fila S3 en `dos-equipos.md` §3.3): **47 contratos**, uno
  por ruta, cada uno con `forma` (objeto/array), las `claves` de primer nivel que el servidor manda
  siempre, los elementos de las listas (también las anidadas, `elementosDe`), y su `fuente` =
  fichero:línea del `res.json`. Las formas se leyeron del servidor el 17-oct; las cité con fichero y
  línea, y las dudosas las comprobé yo (`/admin/cobros` es un ARRAY: el comentario de
  `tests/_banco-vistas.mjs:1432` que dice `{ cobros, cubos }` está desfasado; no lo toco).
- Las rutas casan con `^…$` sobre el pathname, y no con un `includes`. Por eso
  `/admin/jobs/1/gastos` ya no recibe el Trabajo, ni `/admin/products/frequent-concepts` el catálogo.
- Cada respuesta se comprueba contra su contrato **al servirla**. Si un dato no cumple, el censo
  lanza. Una ruta SIN contrato recibe `null`, se lista y hace salir al censo con 2: no hay relleno.
- Las cinco vistas de detalle se montan con el id que les da `app.js` (`ARGUMENTOS_DEL_CENSO`).
- `censo-objetivo-tactil-panel.mjs` usa ese módulo e imprime `DATOS DE MUESTRA · rutas servidas
  con su contrato: 45 · SIN contrato: 0`.

**No se tocan, decidido por el orquestador:** los tres fixtures que el censo comparte con
`guard-objetivo-tactil` (`TRABAJO_DE_MUESTRA`, `CLIENTES_DE_MUESTRA`, `DETALLE_360_DE_MUESTRA`, en
`_pagina-panel.mjs`). Cambiarlos movería el guard. Se sirven tal cual, con su forma comprobada, y
lo que les falta frente al servidor está en `PENDIENTE_EN_LO_COMPARTIDO`.

**Hallazgo que no estaba en el encargo:** Planes recibía `{ plans: [], currentPlan: null,
founding: null }`, y el servidor no da eso nunca: lista fija de un plan, `currentPlan` cae a
`'trial'` y `founding` es siempre un objeto (`subscriptions.routes.ts:35`, `founding.ts:99`). La
vista pintaba 3 nodos; ahora pinta 43.

### Control en los dos sentidos (el test)
- El comprobador cae con cada forma mala (array por objeto, objeto por array, `null`, clave que
  falta, elemento que no es objeto, elemento o elemento anidado sin su clave) y pasa con la buena,
  incluido el array vacío.
- 🔴 **El rojo de antes:** las 16 respuestas que daba el censo viejo, ruta por ruta, caen contra el
  contrato. **La primera versión del contrato absolvía una:** `frequent-concepts` aceptaba el
  catálogo de productos, porque los dos son `{ ok, items }`. Lo cazó este control antes de empujar,
  y por eso existe `elementosDe`.
- Cada contrato cumple con su dato, su ejemplo casa con ÉL y no con otro, y su fuente existe.
- En el banco: las 28 vistas montan, 0 rutas sin contrato, 0 rutas con `NaN`/`undefined`, y 0
  vistas que pinten «undefined» o «NaN».

### Antes / después — 🔴 TODO LO QUE SUBE, SUBE PORQUE AHORA SE VE MÁS PANTALLA
Medido sobre el MISMO árbol (main con 1559b), con dos copias del censo que vuelcan sus resultados.
Las dos reproducen las cifras reales (61/82 y 96/141), que es el control de que la copia mide lo
mismo. `evidencias/scrum1560/diff-censo-antes-vs-despues.txt`.

| Cifra | Antes | Después |
|---|---|---|
| vistas montadas y medidas | 18 | **27** (+ Albaranes, Detalle de factura, Trabajos, Libro registro, Detalle de parte, Planes, Detalle de presupuesto, Solicitudes, Equipo) |
| NO medidas | 10 | **1**: Partes de oficina. Monta, pero con 1 pendiente pinta 12 nodos (< 20); no se infla el dato para pasar el umbral |
| distintos < 44 px | 61 | **96** (+37 nuevos, −2 que eran del dato imposible) |
| mediciones cortas | 82 | **141** |
| con `.btn-sm` | 32 | 54 |
| textos «undefined»/«NaN» pintados | **16, en 6 vistas** | **0** (`undefined-antes.txt` / `undefined-ahora.txt`) |
| Clientes 929 / 390 (medidos / cortos) | 32/18 · 28/2 | **32/18 · 28/2: sin cambio, es el control** |

Elemento a elemento: **297 emparejados · 137 nuevos (65 cortos) · 12 desaparecidos · 2 cambian de
veredicto · 0 cambian de área.**
- **Los 12 desaparecidos, con su causa:**
  - 6 «Ir →» del checklist de Inicio. El dato dice ahora `onboarding.precios/firma = true` y trae
    actividad reciente, que encaja con el catálogo y con el presupuesto aceptado de la 360.
  - 4 de estados vacíos: «Crear un presupuesto» en Facturas y «🚀 Crear mi primer presupuesto» en
    Presupuestos. Esas listas ya no son `[]`.
  - 2 «Quién lo ejecuta» de la ficha de Trabajo. Sólo salían con el equipo vacío
    («EQUIPO CIEGO» en el catch), y el servidor siempre manda al dueño primero.
- **Los 2 que cambian de veredicto son a mejor:** «Presupuestos (1)» y «Facturas (1)» de la 360, a
  390 px, pasan de 41 a 59. Con las pestañas de Trabajos y WhatsApp servidas, la fila cambia.

### Los 37 cortos nuevos, por DUEÑO (`evidencias/scrum1560/nuevos-cortos-por-dueno.txt`)
El dueño sale de `.claude/carriles.json` (regla del fichero). **S2\*** = por la fila general
`public/**`, sin fila propia. Aquí NO se arregla ninguno.

**A · no llegan a 44 a 390 px — defecto de verdad (29)**

| Dueño | Fichero | Elementos (929 / 390 px) |
|---|---|---|
| J1 | `invoiceDetailView.js` | «← Volver a facturas» 31,0/31,0 · «Marcar como cobrada» 30,5/30,5 · «Descargar PDF» 30,5/30,5 · «Enviar por WhatsApp» 30,5/30,5 |
| J1 vista · S2\* componente | `documentoAsignados.js` | `INPUT.doc-asignados-casilla` 21,0/21,0 (en el detalle de factura) |
| J2 | `cobrosView.js` | enlace «factura F-2026-0021» 19,0/17,0 |
| J3 | `plansView.js` | «Quiero mi plaza founding» 41,9/41,9 · «Mensual» 29,9/29,9 · «Anual -17%» 29,9/29,9 |
| J3 | `teamView.js` | «+ Añadir miembro» 31,0/30,7 · «Ver su trabajo →» ×2 30,8/30,9 · «Editar» 30,7/30,9 · «Suspender» 30,7/30,9 |
| S2 | `homeView.js` | «Ver resumen» 30,9/30,6 · «✕» 30,9/30,6 · «Ver facturas →» 30,7/30,5 |
| S2\* | `quotesDetailView.js` | «📄 PDF», «⎘ Duplicar», «← Volver» 31,0/31,0 · «↻ Reenviar por WhatsApp», «↻ Reenviar por correo» 30,5/30,5 · «Aceptar presupuesto», «Rechazar presupuesto» 30,5/30,6 · «+ Añadir gasto a este trabajo» 30,6/30,7 |
| S2\* | `documentoAsignados.js` | `INPUT.doc-asignados-casilla` 21,0/21,0 (en el detalle de presupuesto) |
| S2\* | `quoteRequestsView.js` | «+ Crear presupuesto» 30,7/30,9 · «✓ Marcar gestionada» 30,7/30,9 |
| S2\* | `albaranesView.js` | `A.alb-numero` «A-2026-0031» —/17,0 (sólo se pinta a 390) |

**B · sólo < 44 a 929 y ≥ 36: cumplen el guard en escritorio, no se tocan (6)**: J2
`customerDetailView.js` «Trabajos (1)» y «WhatsApp (1)» 41,0/59,0 · J3 `plansView.js` «Suscribirme»
39,8/44,6 · S2\* `albaranesView.js` «Nuevo albarán» 37,0/45,0 · S2\* `quotesDetailView.js` «Crear
revisión» 36,7/44,6 · S2\* `quotesListView.js` «Ver detalle» 36,8/44,7.

**C · < 36 a 929, cumplen a 390 (2)**: J1 `invoicesView.js` `INPUT.inv-row-check` 14,0/— (no se
pinta a 390) · S2\* `albaranesView.js` «Enviar para firmar» 30,8/44,6.

### Correcciones a lo escrito antes
- En `SCRUM-1559.md` puse «controles de S2» para los cortos que aparecieron. «⬇ Clientes CSV»
  (`customersView.js`) es de **J2** y los de Facturas («⬇ CSV» y la casilla de 14 px) de **J1**: lo
  midió el orquestador contra `dos-equipos.md`. Ya están pasados a su equipo.

### Errores propios, cazados antes de empujar
- El contrato de `frequent-concepts` absolvía el catálogo: arriba.
- Mi primer reparto por dueño daba la ficha de factura a **S2**. El buscador del fichero de la vista
  casaba con `typeof window.renderInvoiceDetailView === 'function'` de `app.js`, y no con su
  definición en `invoiceDetailView.js` (J1). Corregido en `por-dueno.mjs`. Sin ese cambio habría
  repartido mal 5 de los 37.

### Errores propios que cazó el obligatorio (#2541, primer push 9266d662)
Cuatro guards que ya existían cayeron, todos con razón:
- `scrum195` y `scrum414`: `caminoDe` usaba `new URL` sin `try`. Su error lleva la cadena entera
  dentro. Ahora quita el origen y la consulta con texto, y las cifras no se mueven (96/141, 0 sin
  contrato).
- `scrum694`: el test se fabricaba su propio filtro de comentarios por regex. Ahora usa
  `tests/_solo-codigo.mjs`.
- `scrum710b`: las 42 `fuente` iban como `fichero:línea`, que es un anclaje por POSICIÓN y caduca
  en cuanto se edita por encima. Ahora llevan el fichero y `get` = el literal de su `router.get(…)`.
  El test comprueba que ese literal sigue en ese fichero, y está probado en rojo: con un `get` falso,
  cae. (En este registro las citas con línea se quedan: lo que hacen es fechar la medida.)
- Segundo push (4d49b2f1), `scrum737`: la cabecera del test decía «Antes 28 rutas…», una cifra
  del árbol sin fecha. Ahora lleva la fecha y el sha de la medida.
Los dos rojos de «guards de navegador» (informativo) NO son de este cambio: `objetivo-tactil` es
«⬇ Clientes CSV» (J2, ya conocido) y `cls-barra-anuncio` es de la landing.

### 🔴 TRAMPA PARA S0 · «los guards de árbol entero que sólo corre la tanda del CI»
Lo que pasó el 17-oct con #2541: `npm run guards:entrada` dijo VERDE («La entrada puede
empujarse») antes de cada push, y el obligatorio lo tumbó tres veces seguidas, cada vez por otro
guard de la MISMA familia. No fue descuido ni mala suerte: el control previo no cubre a los que de
verdad cazan esto.

**La familia** (los cinco me cayeron a mí en este PR):

| Guard | Qué caza en `tests/` y `scripts/` |
|---|---|
| `scrum195-url-bd-sin-fuga` y `scrum414-url-a-mano` | un `new URL(…)` cuyo error es alcanzable (lleva la cadena entera dentro) |
| `scrum694-los-guards-migrados` | un guard que se fabrica su propio filtro de comentarios por regex, en vez de usar `tests/_solo-codigo.mjs` |
| `scrum710b-anclaje-por-identidad` | un `fichero.ext:NNN` en el código: un anclaje por POSICIÓN que caduca en cuanto se edita por encima. Se ancla al literal (en 1560, el `get` de cada contrato) |
| `scrum737-cifra-con-arbol-y-hora` | una cifra del árbol en un comentario SIN fecha ni sha («Antes 28 rutas…») |

**Por qué `guards:entrada` no los ve:** su lista es CERRADA. La eligió el orquestador, guard a guard
(`scripts/guards-entrada.mjs`, `GUARDS`), con un techo de tiempo (SCRUM-976). Sólo entra lo que
pasa sin `dist`, sin base y en segundos. Estos cinco recorren el árbol entero y no están; tampoco
`scrum1294` (la línea A9), que le cayó a S2 y a mí. **El verde de `guards:entrada` dice «los de su
lista pasan», no «el CI pasará».** ⛔ No se meten en la lista (decisión del orquestador,
17-oct): son lentos, y en esta máquina el comando ya sale CIEGO a los 90 s.

**La regla que sale de aquí:** en un comentario de `tests/` o `scripts/`, toda cifra del árbol lleva
su FECHA o su SHA, igual que el ancla de un registro. Lo que no se puede fechar no se escribe como
número (`scrum737` da las cinco salidas: derivar, reformular, atar, anclar, retirar). Y antes de
empujar un fichero nuevo de `tests/` o `scripts/`, se corren estos cinco a mano además de
`guards:entrada`:
`node --test tests/scrum195-url-bd-sin-fuga.test.mjs tests/scrum414-url-a-mano.test.mjs tests/scrum694-los-guards-migrados.test.mjs tests/scrum710b-anclaje-por-identidad.test.mjs tests/scrum737-cifra-con-arbol-y-hora.test.mjs tests/scrum1294-a9-leccion-en-a10.test.mjs`

### Lo que esto NO sabe
- Los contratos son una COPIA fechada del servidor, no una lectura. Si el servidor cambia, este
  fichero no se entera: la `fuente` está para volver a mirarla.
- `/admin/merchant` sólo exige `id` y `name`. `getMerchantProfile` no se abrió.
- `platform-funnel` se sirve como al dueño de la plataforma. Cualquier otro negocio recibe un 403.
- Los datos propios que `guard:objetivo-tactil` le pasa a cada superficie siguen sin medir.

Sondas: `evidencias/scrum1560/sonda-vistas.mjs` (nodos, errores y rutas sin contrato por vista, con
`antes|ahora`) · `sonda-undefined.mjs` · `diff-censo.mjs` · `por-dueno.mjs`.

## 17-oct-2026 · S3 · 1560c — la ficha del gasto, medida (la mitad que dejó #2545)

**Medido contra:** `origin/main` = `44f3a6bf229837bc5249b4dc8056790f7b6d0e41` · 2026-10-17T22:38:42Z

Rama `scrum-1560c-censo-ficha-del-gasto`.

A9: comprobación → `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`

**Qué faltaba.** S2 arregló en #2545 que la ficha sin id pidiera `/admin/expenses/undefined`: ahora
sin id no pide NADA y vuelve con el contenedor vacío. El censo la montaba sin argumento, así que la
ficha salía en «NO MEDIDAS» con 1 nodo y el motivo genérico («a medias o vacía con estos datos»).

**Qué se ha hecho** (sólo `scripts/_datos-del-censo.mjs` y su test; ninguna vista tocada):
contrato de `GET /admin/expenses/:id` (`{ ok, item }`, `item` = `gasto()`, la misma fila que la lista
según `getExpense`), `IDS.gasto = 51`, y `renderExpenseDetailView: [IDS.gasto]` en `ARGUMENTOS_DEL_CENSO`.
`gasto()` existía desde 1560 y no lo usaba nadie: ahora sí.

**Antes → después** (`npm run censo:tactil-panel`, salida 0 las dos veces; todo lo que se mueve SUBE
porque el instrumento ve una pantalla más, no porque nada empeore):

| cifra | antes | después |
|---|---|---|
| vistas montadas y medidas | 27 | **28** |
| NO medidas | 2 | **1** (queda Partes de oficina, la de siempre) |
| rutas servidas con contrato | 45 | **46** |
| superficies × anchuras con sonda | 54 (0 fallidas) | **56** (0 fallidas) |
| cortos DISTINTOS | 96 | **97** |
| mediciones cortas | 141 | **143** |
| cortos sin `.btn-sm` | 42 | **43** |
| cortos con `.btn-sm` | 54 | 54 (sin cambio) |

La ficha: 6 medidos a 929 y a 390, **1 corto**: `A.gasto-trab-enlace` «Reforma de baño», 36,0 px a
las dos anchuras. Es de `expensesView.js` (S2, SCRUM-1156c): se dice, no se toca.

**Lo que esto NO sabe.** `comprobarForma` mira `ok` e `item`, no los campos de dentro de `item`. La
ficha se mide SIN foto (con foto pide `/:id/foto`, que no es JSON) y CON trabajo: la variante sin
trabajo («Vincular a un trabajo») no se mide.

## 17-oct-2026 · S3 · 1560d — los tres fixtures compartidos, con la forma del servidor

**Medido contra:** `origin/main` = `44f3a6bf229837bc5249b4dc8056790f7b6d0e41` · 2026-10-17T22:38:42Z

Rama `scrum-1560d-fixtures-compartidos-con-forma`, apilada sobre 1560c (las dos añaden a este
registro; por separado chocarían). Lo que en SCRUM-1560 quedó en `PENDIENTE_EN_LO_COMPARTIDO`, con
el GO del orquestador (17-oct, «1559, 1559b y 1560 están DENTRO»).

A9: comprobación → `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`

**Qué tenían, frente al servidor** (leído en el router y su serializador, no supuesto):
- `TRABAJO_DE_MUESTRA` contra `serializeJobDetail` (`jobs.routes.ts`): llevaba `title`, y el servidor
  manda `titulo`; de sus 27 claves llevaba 5 (más `title`, que no es suya). Ahora las 27, en el MISMO escenario (Trabajo sin
  presupuesto: `quote`, `charge` y el eje de cobro a `null`, entrega `sin_eje`), y el `customer` del
  detalle con `email`, `taxId`, `notes` y `numeroWhatsApp`.
- `CLIENTES_DE_MUESTRA` contra `CUSTOMER_SELECT_NO_TOKEN` (`customerAdmin.ts`): de 25 claves llevaba 7.
  Y Carmen Ruiz tenía `tags: []`, que el servidor no puede devolver (`normalizarTags` lo deja en `null`).
- `DETALLE_360_DE_MUESTRA` contra `GET /:id/detail` (`customersAdmin.routes.ts`): su cliente era la
  fila de la LISTA (otro `select`: sin `portalToken`/`portalUrl`, con `merchantId`…); importes en
  número donde la base da `Decimal` (viaja como texto); sin `acceptedAt` ni `paidAt`; `stats` con 5 de
  8 cifras y diciendo 3 presupuestos con 1 en la lista.
- Y uno MÍO, de 1560: el `job()` de `/admin/jobs` tenía `estadoCobro: 'pendiente'` y `tipoOperacion:
  'servicio'`. La forma cumplía; los valores no existen (`'Pendiente'`, `'TRABAJO_UNICO'`).

Los tres contratos exigen ahora sus claves enteras; `PENDIENTE_EN_LO_COMPARTIDO` se retira. El test
nuevo hace caer los tres fixtures VIEJOS contra su contrato (control: un contrato que los
absolviera no mediría nada).

**Antes → después.** Antes = `scrum-1560c` (main + la ficha del gasto); después = esta rama.

| instrumento | cifra | antes | después |
|---|---|---|---|
| `censo:tactil-panel` | ficha del Trabajo, medidos a 929 / 390 | 11 / 11 | **12 / 12** (SUBE: el instrumento ve un control más) |
| `censo:tactil-panel` | ficha del Trabajo, cortos a 929 / 390 | 1 / 0 | 1 / 0 (sin cambio) |
| `censo:tactil-panel` | cortos DISTINTOS · mediciones cortas | 97 · 143 | 97 · 143 (sin cambio) |
| `censo:tactil-panel` | el resto de vistas, Clientes y 360 incluidas | — | sin cambio, fila a fila |
| `guard:objetivo-tactil` | salida y hallazgos | 1 · 2 | 1 · 2 (sin cambio: los dos de «⬇ Clientes CSV», de J2) |
| `guard:objetivo-tactil` | el resto de su salida | — | idéntica, línea a línea |

El control que sube: «💬 WhatsApp» (`a.detail-rail-enlace`, `https://wa.me/…`) en el bloque Cliente
de la ficha del Trabajo. Lo pinta `numeroWhatsApp` (SCRUM-1171), que el fixture no traía: la ficha
medida nunca había enseñado ese botón. Llega a 44 px.

**Que no se mueva casi nada, ¿es ceguera?** Medido, no supuesto (`sonda-pantallas.mjs` en el
temporal de la sesión): el HTML servido de la 360 CAMBIA (otro sha1; son cifras de `stats`, sin un
interactivo más ni menos) y el de Clientes sale IDÉNTICO byte a byte. Control positivo de esa
igualdad, mutando un campo cada vez sobre el fixture nuevo: `tags: ['vip']` y `mobile` cambian el
HTML; `tags: []`, `waOptOut: true`, `legalName` y `saldoPendiente` no. La lista no pinta esos campos;
la sonda sí ve los que pinta.

**Lo que esto NO sabe.** `comprobarForma` mira las claves de primer nivel (y los elementos de
`quotes`/`invoices` de la 360), no los objetos anidados (`customer`, `stats`, `entregaPendiente`).
Los contratos siguen siendo una COPIA fechada del servidor.

## 18-oct-2026 · S3 · 1560e — una vista que el censo no puede medir dice QUÉ AÑADIR y DÓNDE

**Medido contra:** `origin/main` = `44f3a6bf229837bc5249b4dc8056790f7b6d0e41` · 2026-10-18T00:02:58Z

Rama `scrum-1560e-vista-que-no-pide-nada`, apilada sobre 1560d. Base medida: `44f3a6bf` + 1560c + 1560d.

A9: comprobación → `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`

**El defecto.** Cuando entró la ficha del gasto (#2545), el censo la apuntó en «NO MEDIDAS» con
«a medias o vacía con estos datos». Era falso: se montaba sin su id, no pedía nada y volvía vacía.
Salió con 0, y el resumen del CI sólo copia el NÚMERO (pasó de 1 a 2 sin nombre). Y el test de 1560
(«ninguna vista pide una ruta sin contrato») lo pasaba una vista que no pide NADA.

**La señal, medida antes de construir** (29 vistas): la aridad NO sirve (el editor de presupuestos
y Partes de oficina declaran parámetros opcionales y se montan bien); «pidió 0 rutas y pintó menos
de 20 nodos» sí: 1 de 29 antes de #2549 (justo la ficha del gasto), 0 hoy.

**Lo decidido por el orquestador (17-oct):** que INFORME y no bloquee; que diga la lista; se arreglan
las que haya; obligatorio sólo con la lista a cero y acordado antes con J. Y que cada aviso diga qué
añadir y dónde.

**Qué hace ahora** (`censo-objetivo-tactil-panel.mjs` + `_datos-del-censo.mjs`; salida del censo
sin cambiar: informa):
- cuenta las peticiones POR VISTA (`pedidasDe`) y separa «no pidió nada» de «pidió y pintó poco»;
- «no pidió nada» → aviso con la vista, los parámetros que declara y la línea para
  `ARGUMENTOS_DEL_CENSO` de `scripts/_datos-del-censo.mjs`;
- ruta sin contrato → aviso con la entrada de `CONTRATOS` a medio rellenar, la regex ya escrita;
- la línea «vistas que publica el banco…», la que copia el resumen del CI, lleva ahora los NOMBRES
  de las no medidas, y cuántas «sin argumentos» y cuántas rutas sin contrato. `ci.yml` no se toca.

**Control en rojo**, sobre el árbol real y restaurado después:
| se quita | qué dice el censo | salida |
|---|---|---|
| `renderExpenseDetailView: [IDS.gasto]` | «sin argumentos: 1» y «QUÉ AÑADIR · … ARGUMENTOS_DEL_CENSO: `renderExpenseDetailView: [<expenseId>],`» | 0 (informa) |
| el contrato de `/admin/expenses/:id` | «rutas SIN contrato: 1» y la entrada con `ruta: /^\/admin\/expenses\/\d+$/` | 2 (como desde 1560) |

Los tests nuevos son SINTÉTICOS (vistas y rutas de mentira): van en la tanda obligatoria y no pueden
caer por una vista de otro equipo. Tres mutaciones, las tres caen: el aviso sin «ARGUMENTOS_DEL_CENSO»,
la regex `\d+` cambiada por `.*` (sobrevivía hasta añadir el caso `/1/2/notas`) y la línea sin nombres.

**LA CIFRA de hoy:** vistas sin argumentos **0** · rutas sin contrato **0** · NO medidas **1**
(Partes de oficina: 12 nodos con 1 petición servida; son filas `div` clicables, la vista es así).
El paso ② (arreglar las que haya) está vacío: la lista ya está a cero.

**Lo que esto NO sabe.** Una vista que no pide nada y pinta 20 nodos o más (un estado vacío
grande) no se marca: su caso es otro, y no hay ninguna hoy. El umbral de 20 nodos sigue
confundiendo una vista pequeña con una vacía (Partes de oficina).

## 23-oct-2026 · S3 · 1560g — el caso del banco exige que cada vista y cada panel PINTE

Rama desde `origin/main` = `7d13cdd85`. Es la (b) de SCRUM-1560f (#2732), decidida por el orquestador el 23-oct.
1560f midió por mutación que el caso «🔴 en el banco: … ni pinta «undefined»» seguía 12/12 en verde con
Trabajos, Configuración o Cobros sin pintar nada: una pantalla vacía no pinta «undefined».

### Lo que cambia (sólo `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`)

* Cada una de las 29 vistas tiene que pintar al menos un nodo.
* Cada panel `data-submenu` de Configuración también, salvo los de `PANELES_SIN_PINTAR_DECLARADOS`,
  cada uno con su motivo. Si uno empieza a pintar, su línea CADUCA y el caso cae hasta que se quite.
  Con menos de 5 paneles vistos, CIEGO.
* ⚠️ Corrección a la instrucción que llegó: `publica` y `cumplimiento` no son vistas, son paneles de
  `renderSettingsView`, que pinta 186 nodos. «Nodos > 0 por vista» a secas no se habría puesto rojo nunca.

| declarado | por qué no puede pintar con el banco de hoy | lo cerraría |
|---|---|---|
| `publica` | `/admin/merchant` de muestra = `{ id, name }`; `settingsView.js` corta con `if (m.slug === undefined) return` | completar ese contrato: la (a) de 1560f, sin decidir |
| `cumplimiento` | sólo pinta `if (window.appModoEmision)`; ese global lo pone `app.js:52` desde `/auth/me` al ARRANCAR, y el banco no arranca la app | que el banco dé la sesión: la (a′), abajo |

### Rojos (A23), sobre `202779fe4` con el árbol entero comiteado

| inyección | numstat | cae |
|---|---|---|
| R1 · `return;` al principio de `renderJobsView` | 1/1 `jobsView.js` | «vistas que no pintan NADA» |
| R2 · `publica` fuera de la declaración | 0/1 el test | «paneles … que no pintan NADA y no están en PANELES_SIN_PINTAR_DECLARADOS» |
| R3 · el merchant de muestra con `slug` | 1/1 `_datos-del-censo.mjs` | «declarados sin pintar que YA pintan: quita su línea»: con `slug`, `publica` pinta (la (a) cerraría ese panel y NO el otro) |
| R4 · el selector de paneles no ve ninguno | 1/1 el test | CIEGO «Configuración da 0 panel(es)» |

Restaurado con `git restore --source=HEAD` tras cada uno, y el árbol limpio al acabar. El guion de estas cuatro
no se comitea: es un banco con lista propia, y SCRUM-1387 no lo admite. Lo permanente es el catálogo:

**`MUTACIONES_QUE_ME_TUMBAN` (2, del PRODUCTO):** ① `renderJobsView` no pinta; ② el panel `datos` se queda vacío
(deja de colocarse su única tarjeta) sin estar declarado. Corridas con las funciones del meta-guard
(`evidencias/SCRUM-935d/e-uno-guard.mjs`): **con este test, 2 VIVAS** (limpia 3,3 s, ~3 s cada una); **con el test de
`main` y las mismas dos declaraciones, 2 MUDAS**. Coste en el meta-guard: unos 9-10 s por pasada en local. El job
de hoy acaba a 1.608 s de un corte de 1.650.

### 🔴 La (a′) · «EL BANCO DA LA SESIÓN» — escrita, NO empezada (decisión del orquestador, 23-oct)

El banco monta las vistas sin pasar por el arranque de `app.js`, que es quien pone los globales de la sesión
desde `/auth/me`. El más gordo es `window.appModoEmision`: en el banco vale `undefined` («no se sabe»), un estado que
**en producción no existe**, porque ningún usuario real tiene la app sin modo de emisión. Todo lo que se haya medido en estas
vistas con el banco puede estar midiendo una pantalla que nadie ve. Lo leen 11 ficheros de `public/dashboard/js/`
(contados a 23-oct sobre `7d13cdd85`, lecturas sin la asignación):
`albaranAccion.js` (2) · `homeView.js` (2) · `invoicesView.js` (1) · `jobDetailView.js` (2) · `onboardingView.js` (2) ·
`plansView.js` (2) · `puertaSerie.js` (2) · `reportsView.js` (1) · `rotulosDelDocumento.js` (2) · `settingsView.js` (8) · `tutorial.js` (1).
Y `app.js` pone más globales en ese mismo arranque (`appBizumSinTelefono`, el modo del documento suelto…), sin censar.
Es un cambio de arnés con onda sobre todo lo que mide el banco: se decide aparte.

### Por qué `c-mutar.mjs` y `d-censo-tactil.mjs` salen de #2732 (1560f)

Los dos mutan el producto con una lista PROPIA (12 pares consumidor × vista; Cobros vaciada), y la regla de SCRUM-1387
(comentario 18016, del fundador) dice que un banco nuevo toma las mutaciones del catálogo. No pueden: auditan tests de
otros, que no declaran nada. El obligatorio de #2732 tumbó el primero; el segundo no lo veía, porque su nombre no lleva
«mut», y sale igual. Renombrarlos habría sido esquivar el guard por la forma. Sus salidas y el método se quedan en el
registro de 1560f, como medida fechada. El camino para volver a tenerlos ejecutables sería una excepción del fundador a 1387 para
los bancos que auditan consumidores; **NO se ha pedido** (es una regla firmada: STOP, y su cola lleva dos días sin moverse).
Lo que vigila el hallazgo de forma permanente es esta 1560g.

A9: comprobación → `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`

**Ficheros:** `tests/scrum1560-datos-de-muestra-con-forma.test.mjs`, este apartado.
