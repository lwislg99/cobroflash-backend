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

### Lo que esto NO sabe
- Los contratos son una COPIA fechada del servidor, no una lectura. Si el servidor cambia, este
  fichero no se entera: la `fuente` está para volver a mirarla.
- `/admin/merchant` sólo exige `id` y `name`. `getMerchantProfile` no se abrió.
- `platform-funnel` se sirve como al dueño de la plataforma. Cualquier otro negocio recibe un 403.
- Los datos propios que `guard:objetivo-tactil` le pasa a cada superficie siguen sin medir.

Sondas: `evidencias/scrum1560/sonda-vistas.mjs` (nodos, errores y rutas sin contrato por vista, con
`antes|ahora`) · `sonda-undefined.mjs` · `diff-censo.mjs` · `por-dueno.mjs`.
