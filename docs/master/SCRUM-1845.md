# SCRUM-1845

**Medido contra:** `origin/main` = `f23697aa1c7a7b9715ded3be545a50aaa1597706` · 2026-11-25T02:42:46Z

A9: aviso → cicatriz J4 «crucé el 130k del encargo sin nada escrito: el arranque ya costaba 108.927 y leí la lista, las fechas, las etiquetas y los diffs en el chat antes de delegar la escritura; medí 140.802» — no se pudo comprobar: es la misma falta por segunda vez en el mismo día (arranque 108.913, 143.930 tras el censo con el tope en 140k); apuntarla no la corrigió, y nada mide el contexto de una sesión desde dentro después de cada llamada

Puesto J4 (jv-j4cj), por encargo del orquestador. **Solo medición**: qué objetivos del panel siguen por debajo de 44 px de toque, por pantalla y por carril, y qué queda una vez descontado lo que ya curan los PR abiertos de hoy. No se toca `public/`, `scripts/` ni `tests/`. El comentario con las dos listas está en Jira, SCRUM-1845 c.22722.

## Población y controles

- **Instrumento:** `npm run censo:tactil-panel` (`scripts/censo-objetivo-tactil-panel.mjs`), sobre un árbol en `f23697aa`, con `dist/` compilado con `tsc --noCheck` (el árbol anidado no lo trae; la primera pasada dio `MODULE_NOT_FOUND` en `dist/modules/billing/domain/metodoDeCobro.js` y no se contó). Salida 0.
- **Lo que mide:** 29 vistas `render…View` que publica el banco; 28 montadas; 16 pestañas abiertas de 23. Son **88 páginas×anchura** con la sonda cazada en las 88 (sondas no cazadas: 0), y la sonda tapada se leyó «caja 40 · toque 30» en 88 de 88.
- **Anchuras: 929 y 390** (`ANCHOS` del censo). El encargo decía 390/1280; 1280 no lo mide este censo.
- **Resultado:** **115 elementos DISTINTOS** por debajo de 44 px y 206 mediciones (pantalla × anchura × elemento). 38 de los distintos llevan `.btn-sm`.
- **Qué cuenta como «distinto»:** `pantalla|posición` (`scripts/_censo-distintos.mjs`, `cortosDistintos`). Por eso las pantallas suman el total por construcción, y la misma pieza montada por dos vistas cuenta dos veces.
- **Selector y texto de cada uno:** el censo no los imprime por pantalla. Para no tocar `scripts/`, un hook de carga (`node --import`, desde TEMP y fuera del árbol) envolvió `cortosDistintos` en memoria y volcó su mapa a JSON. **Control:** el volcado trae 115 entradas en una sola llamada, sobre las mismas 88 páginas, y el censo de esa pasada imprimió 115.
- **Lo curado en PR:** el mismo censo, con el mismo volcado, sobre tres árboles desechables en las puntas: #3425 (`46dce9f3d0fed6a327c082ec022d53eae70d7181`, SCRUM-1841) da **110**; #3426 (`ff08fd780494103beed2b4ccf8287eea7a2094f2`, SCRUM-1843) da **112**; la rama `scrum-1844b-anadir-miembro-44` (`f3a3f29ae54576dfa50bf0132c2ebd59500b3d5b`, SCRUM-1844) da **114**. ⚠️ Escribí «sin PR» y era falso: el PR **#3429** existía desde las 2026-11-25T02:38:47Z, y mi `gh pr list --head` de hacia las 02:40 no lo devolvió. Lo cazó el control del sufijo antes de empujar. Su punta es ya `fb8a10df3585df2eed61b1f9c2026abeca5c90b8`, y esa NO la he medido. Ninguna de las tres toca `src/`. Se cruzaron como multiconjunto por pantalla+selector+texto: **9 curados (5 + 3 + 1)** y **0 cortos nuevos** en ninguna punta.
- **Suma:** 115 = **106 pendientes** + 9 curados. Por carril, los pendientes son J2 33, J3 21, J1 13, S2 38 y S4 1, que suman 106.
- **Carril:** `node scripts/carriles.mjs de public/dashboard/js/<fichero>.js`, y el fichero se sacó buscando la función `render…View` en `public/dashboard/js/`. `public/dashboard/css/styles.css` → S2 (contenedor).

**Lo que NO está medido** (no cuenta como cero):

- `renderPartesOficinaView`: solo da 12 nodos con sus datos de muestra.
- Tres pestañas no se abren en el banco: Partes (Trabajo), Plantillas (Presupuestos) e Historial (Plantillas).
- **90 interactivos ocultos en 8 pantallas.** Entre ellos están los menús «⋯»: **`.overflow-item` no lo ha medido este censo**, y los 42 px de «Marcar como pendiente» son dato del encargo, no medida mía.
- Los curados son los de las puntas de hoy: si esos PR cambian antes de mergear, la cifra cambia con ellos.

## Lo que se movió después de medir (control del sufijo, antes de empujar)

- `origin/main` pasó a `5b3adb14b473d798be639c3f54ddec4db7e4bc16`, 15 commits por delante de lo medido. De `public/dashboard` solo cambia `public/dashboard/js/customerDetailView.js` (+256 / −1). **La fila de la ficha 360 (J2, 12 pendientes) NO está medida de nuevo sobre ese main**; las demás pantallas no cambian de fichero.
- #3425 y #3426 siguen abiertos con las puntas que medí. 1844b es ya el PR #3429, con otra punta (arriba).

## Tabla por pantalla y carril

| pantalla | fichero | carril | cortos | en 929 | en 390 | curados en PR/rama | pendientes |
|---|---|---|---:|---:|---:|---:|---:|
| `renderInvoicesView` | `invoicesView.js` | J1 | 10 | 10 | 5 | 0 | 10 |
| `renderInvoiceDetailView` | `invoiceDetailView.js` | J1 | 6 | 6 | 6 | 3 | 3 |
| `renderCustomersView` | `customersView.js` | J2 | 21 | 21 | 0 | 0 | 21 |
| `renderCustomer360View` | `customerDetailView.js` | J2 | 17 | 17 | 11 | 5 | 12 |
| `renderSettingsView` | `settingsView.js` | J3 | 10 | 10 | 9 | 0 | 10 |
| `renderPlansView` | `plansView.js` | J3 | 7 | 7 | 6 | 0 | 7 |
| `renderTeamView` | `teamView.js` | J3 | 5 | 5 | 5 | 1 | 4 |
| `renderExportView` | `exportView.js` | S2 | 7 | 7 | 4 | 0 | 7 |
| `renderQuotesListView` | `quotesListView.js` | S2 | 7 | 7 | 4 | 0 | 7 |
| `renderAlbaranesView` | `albaranesView.js` | S2 | 4 | 4 | 0 | 0 | 4 |
| `renderFacturasRecibidasView` | `facturasRecibidasView.js` | S2 | 4 | 4 | 2 | 0 | 4 |
| `renderProvidersView` | `providersView.js` | S2 | 4 | 4 | 0 | 0 | 4 |
| `renderProductsView` | `productsView.js` | S2 | 3 | 3 | 3 | 0 | 3 |
| `renderDocumentoSueltoView` | `quotesView.js` | S2 | 2 | 2 | 0 | 0 | 2 |
| `renderQuoteDetailView` | `quotesDetailView.js` | S2 | 2 | 2 | 1 | 0 | 2 |
| `renderQuotesView` | `quotesView.js` | S2 | 2 | 2 | 0 | 0 | 2 |
| `renderExpenseDetailView` | `expensesView.js` | S2 | 1 | 1 | 1 | 0 | 1 |
| `renderQuoteRequestsView` | `quoteRequestsView.js` | S2 | 1 | 1 | 1 | 0 | 1 |
| `renderReportsView` | `reportsView.js` | S2 | 1 | 1 | 1 | 0 | 1 |
| `renderParteDetailView` | `parteDetailView.js` | S4 | 1 | 1 | 0 | 0 | 1 |
| **total** | | | **115** | 115 | 59 | **9** | **106** |

## Lista J (pendientes por puesto, de más a menos)

1. **J2 · 33** — Clientes `customersView.js` 21 · ficha 360 `customerDetailView.js` 12 (+5 curados en #3425). Cura: **Clientes**, por el contenedor de la lista (`.btn-sm`, `.btn-primary`, `.input`/`select`, `.contacto-link` de 37–41,8 a 44). **360**: ampliar lo de 1841 a los 6 `BUTTON` de 39 px (Presupuestos/Facturas/Trabajos), los 2 `.btn-ghost.btn-sm`, los 3 `.contacto-link` y el `.input`.
2. **J3 · 21** — Ajustes `settingsView.js` 10 · Planes `plansView.js` 7 · Equipo `teamView.js` 4 (+1 curado en 1844b). De los 10 de Ajustes, 7 solo se ven al abrir las pestañas Facturación, Avisos, Marca y Equipo, y 4 son `INPUT` de 17 px (casillas). Cura: **Ajustes**, por el contenedor del panel de pestaña; las casillas, con la etiqueta como área de toque de 44 en vez de agrandar la casilla. **Planes**, por su contenedor (`.plan-btn` y 3 enlaces). **Equipo**: ampliar 1844b a los 3 `.btn-ghost.btn-sm` y al `.btn-danger.btn-sm` de la fila de miembro.
3. **J1 · 13** — Facturas `invoicesView.js` 10 · ficha de la factura `invoiceDetailView.js` 3 (+3 curados en #3426). Cura: **lista**, por el contenedor de filtros y filas (3 `.input`, 1 `select`, la casilla de fila `.inv-row-check`, 2 `.btn-ghost.btn-sm`, `.btn-primary`, `A.btn-secondary.btn-sm`). **Ficha**: ampliar 1843 a sus 2 `.input` y al `.btn-secondary.btn-sm` que queda.
4. J4, J5, J6: 0.

## Lista de Luis (pendientes por puesto S)

1. **S2 · 38** — Exportar 7 · Presupuestos (lista) 7 · Albaranes 4 · Facturas recibidas 4 · Proveedores 4 · Productos 3 · Documento suelto 2 · Detalle de presupuesto 2 · Presupuestos 2 · Detalle de gasto 1 · Solicitudes 1 · Informes 1. Cura: por el contenedor de cada vista, como 1148/1841. ⚠️ `renderQuotesView` y `renderDocumentoSueltoView`, los dos en `quotesView.js`, dan los MISMOS 2 botones: el censo los cuenta por pantalla, así que un solo arreglo puede cubrir 4 de los 115.
2. **S4 · 1** — Detalle de parte `parteDetailView.js` (un `.btn.btn-secondary`).
3. S0, S1, S3, S5: 0.

## GLOBAL — estilos compartidos (`public/dashboard/css/styles.css`, contenedor de S2)

- **`.btn-sm`**: 38 de los 115 distintos (33 %), con toque de 30,5 a 37 px, en J1, J2, J3 y S2.
- **`.input` / `select.input`**: toque de 34,6 a 39 px, en 9 pantallas.
- **`.btn-primary` / `.btn-secondary` sin `-sm`**: de 36 a 37 px, en varias pantallas de J1, J2 y S2.
- **`.overflow-item`** (menú «⋯»): NO medido por este censo, porque el menú está cerrado. Según el encargo, 42 px en «Marcar como pendiente».

Curarlos en la hoja compartida movería a la vez cortos de cuatro carriles. Eso lo decide S2 o un jefe, no una vista. Si se hace, las curas por contenedor de arriba se quedan en lo que la regla global no alcance.

## Detalle por pantalla (tachado = curado en la punta que se nombra)

**`renderInvoicesView`** · `invoicesView.js` · J1 · 10 pendientes

- `A.btn-secondary.btn-sm` «⬇ CSV» · caja 30 · toque 31 · 390/929
- `BUTTON.btn-primary` «Nueva facturaN» · caja 36 · toque 37 · 929
- `INPUT.input` «(sin texto)» · caja 34 · toque 35 · 390/929
- `SELECT.input` «Todos los estadosPendientesPagadas» · caja 36 · toque 37 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 37 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 37 · 390/929
- `INPUT` «(sin texto)» · caja 13 · toque 14 · 929
- `INPUT.inv-row-check` «(sin texto)» · caja 13 · toque 14 · 929
- `BUTTON.btn-ghost.btn-sm` «Ver detalle» · caja 30 · toque 30.8 · 929
- `BUTTON.btn-ghost.btn-sm` «Ver detalle» · caja 30 · toque 31 · 929

**`renderInvoiceDetailView`** · `invoiceDetailView.js` · J1 · 3 pendientes (+3 curados)

- `BUTTON.btn-secondary.btn-sm` «← Volver a facturas» · caja 30 · toque 31 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 36 · 390/929
- ~~`BUTTON.btn-primary.btn-sm` «Marcar como cobrada» · caja 30 · toque 30.7 · 390/929~~ curado en #3426 (1843)
- ~~`BUTTON.btn-secondary.btn-sm` «Descargar PDF» · caja 30 · toque 30.7 · 390/929~~ curado en #3426 (1843)
- ~~`BUTTON.btn-secondary.btn-sm` «Enviar por WhatsApp» · caja 30 · toque 30.7 · 390/929~~ curado en #3426 (1843)
- `INPUT.input` «(sin texto)» · caja 34 · toque 34.7 · 390/929

**`renderCustomersView`** · `customersView.js` · J2 · 21 pendientes

- `BUTTON.btn-secondary.btn-sm` «⬆ Importar clientes» · caja 36 · toque 37 · 929
- `A.btn-secondary.btn-sm` «⬇ Clientes CSV» · caja 36 · toque 37 · 929
- `BUTTON.btn-primary` «Nuevo clienteN» · caja 36 · toque 37 · 929
- `INPUT.input` «(sin texto)» · caja 38 · toque 39 · 929
- `SELECT.input` «Todas las etiquetasadministradormo» · caja 38 · toque 39 · 929
- `SELECT.input` «Más recientesNombre A-ZMás pendien» · caja 38 · toque 39 · 929
- `A.contacto-link` «34000000001» · caja 41.8 · toque 41.8 · 929
- `A.contacto-link.contacto-link--icono` «💬» · caja 36 · toque 37 · 929
- `BUTTON.btn-secondary.btn-sm` «Editar» · caja 36 · toque 36.9 · 929
- `BUTTON.btn-secondary.btn-sm` «Portal» · caja 36 · toque 36.9 · 929
- `BUTTON.btn-ghost.btn-sm` «📊 Historial» · caja 36 · toque 36.9 · 929
- `A.contacto-link` «34000000002» · caja 41.8 · toque 41.8 · 929
- `A.contacto-link.contacto-link--icono` «💬» · caja 36 · toque 37 · 929
- `BUTTON.btn-secondary.btn-sm` «Editar» · caja 36 · toque 36.9 · 929
- `BUTTON.btn-secondary.btn-sm` «Portal» · caja 36 · toque 36.9 · 929
- `BUTTON.btn-ghost.btn-sm` «📊 Historial» · caja 36 · toque 36.9 · 929
- `A.contacto-link` «34000000003» · caja 41.8 · toque 41.8 · 929
- `A.contacto-link.contacto-link--icono` «💬» · caja 36 · toque 37 · 929
- `BUTTON.btn-secondary.btn-sm` «Editar» · caja 36 · toque 36.8 · 929
- `BUTTON.btn-secondary.btn-sm` «Portal» · caja 36 · toque 36.8 · 929
- `BUTTON.btn-ghost.btn-sm` «📊 Historial» · caja 36 · toque 36.8 · 929

**`renderCustomer360View`** · `customerDetailView.js` · J2 · 12 pendientes (+5 curados)

- `BUTTON.btn-ghost.btn-sm` «← Volver a Clientes» · caja 30 · toque 30.5 · 390/929
- `A.contacto-link` «34000000001» · caja 36 · toque 37 · 929
- `A.contacto-link` «💬 WhatsApp» · caja 36 · toque 37 · 929
- `A.contacto-link` «admin@fincassoler.es» · caja 36 · toque 37 · 929
- ~~`BUTTON.btn-secondary.btn-sm` «✎ Editar» · caja 30 · toque 30.7 · 390/929~~ curado en #3425 (1841)
- ~~`BUTTON.btn-secondary.btn-sm` «🔗 Portal» · caja 30 · toque 30.7 · 390/929~~ curado en #3425 (1841)
- ~~`BUTTON.btn-secondary.btn-sm` «📇 Guardar en mis contactos» · caja 30 · toque 30.7 · 390/929~~ curado en #3425 (1841)
- ~~`BUTTON.btn-secondary.btn-sm` «Fusionar con otro cliente» · caja 30 · toque 31 · 929~~ curado en #3425 (1841)
- ~~`BUTTON.btn-primary.btn-sm` «+ Nuevo presupuesto» · caja 30 · toque 31 · 929~~ curado en #3425 (1841)
- `INPUT.input` «(sin texto)» · caja 38 · toque 38.9 · 929
- `BUTTON` «Presupuestos (1)» · caja 38 · toque 39 · 390/929
- `BUTTON` «Facturas (1)» · caja 38 · toque 39 · 390/929
- `BUTTON` «Trabajos (1)» · caja 38 · toque 39 · 390/929
- `BUTTON` «WhatsApp (1)» · caja 38 · toque 39 · 390/929
- `BUTTON` «Sitios» · caja 38 · toque 39 · 390/929
- `BUTTON` «Notas» · caja 38 · toque 39 · 390/929
- `BUTTON.btn-ghost.btn-sm` «Ver →» · caja 30 · toque 30.6 · 390/929

**`renderSettingsView`** · `settingsView.js` · J3 · 10 pendientes

- `INPUT.j3e-a636e53` «(sin texto)» · caja 40 · toque 40.5 · 390/929
- `BUTTON.j3e-86abdab.btn.btn-primary.btn-sm` «Copiar link» · caja 30 · toque 30.5 · 390/929
- `BUTTON.btn.btn-secondary` «Añadir condición» · caja 36 · toque 36.9 · 929
- `INPUT` «(sin texto)» · caja 16 · toque 17 · 390/929
- `INPUT` «(sin texto)» · caja 16 · toque 17 · 390/929
- `INPUT` «(sin texto)» · caja 16 · toque 17 · 390/929
- `BUTTON.btn-ghost.btn-sm` «Vista previa» · caja 30 · toque 30.6 · 390/929
- `BUTTON.btn.btn-secondary.btn-sm` «⬆ Subir logo» · caja 30 · toque 30.5 · 390/929
- `BUTTON.btn-secondary.btn-sm` «Sin color (por defecto)» · caja 30 · toque 30.6 · 390/929
- `INPUT` «(sin texto)» · caja 16 · toque 17 · 390/929

**`renderPlansView`** · `plansView.js` · J3 · 7 pendientes

- `A.j3e-4a12b6e` «presupuestos» · caja 15 · toque 16 · 390/929
- `A.j3e-4a12b6e` «cobros» · caja 15 · toque 16 · 390/929
- `A.j3e-4a12b6e` «gastos» · caja 15 · toque 16 · 390/929
- `BUTTON.j3e-3350dfb.plan-btn` «Quiero mi plaza founding — 9,90 €/» · caja 39 · toque 39.6 · 390/929
- `BUTTON.j3e-fbb8fe6` «Mensual» · caja 28 · toque 28.6 · 390/929
- `BUTTON.j3e-c3d1d19` «Anual-17%» · caja 28 · toque 28.6 · 390/929
- `BUTTON.j3e-bc1a03e.btn-primary.plan-btn` «Suscribirme — 19,90 €/mes» · caja 39 · toque 39.7 · 929

**`renderTeamView`** · `teamView.js` · J3 · 4 pendientes (+1 curados)

- ~~`BUTTON.btn-primary.btn-sm` «+ Añadir miembro» · caja 30 · toque 30.7 · 390/929~~ curado en rama 1844b @f3a3f29a (1844)
- `BUTTON.btn-ghost.btn-sm` «Ver su trabajo →» · caja 30 · toque 30.9 · 390/929
- `BUTTON.btn-ghost.btn-sm` «Ver su trabajo →» · caja 30 · toque 30.8 · 390/929
- `BUTTON.btn-ghost.btn-sm` «Editar» · caja 30 · toque 30.8 · 390/929
- `BUTTON.btn-danger.btn-sm` «Suspender» · caja 30 · toque 30.8 · 390/929

**`renderExportView`** · `exportView.js` · S2 · 7 pendientes

- `INPUT.input` «(sin texto)» · caja 36 · toque 36.7 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 36.7 · 390/929
- `BUTTON.btn-primary` «Descargar ZIP» · caja 36 · toque 36.9 · 929
- `INPUT.input` «(sin texto)» · caja 34 · toque 35 · 390/929
- `SELECT.input` «T1T2T3T4» · caja 36 · toque 37 · 390/929
- `BUTTON.btn-secondary` «Descargar CSV» · caja 36 · toque 37 · 929
- `BUTTON.btn-secondary` «Descargar todo» · caja 36 · toque 36.7 · 929

**`renderQuotesListView`** · `quotesListView.js` · S2 · 7 pendientes

- `A.btn-secondary.btn-sm` «⬇ CSV» · caja 36 · toque 37 · 929
- `BUTTON.btn-primary` «Nuevo presupuestoN» · caja 36 · toque 37 · 929
- `INPUT.input` «(sin texto)» · caja 34 · toque 35 · 390/929
- `SELECT.input` «Todos los estadosPendiente de apro» · caja 36 · toque 37 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 37 · 390/929
- `INPUT.input` «(sin texto)» · caja 36 · toque 37 · 390/929
- `BUTTON.btn-secondary.btn-sm` «Ver detalle» · caja 36 · toque 36.8 · 929

**`renderAlbaranesView`** · `albaranesView.js` · S2 · 4 pendientes

- `BUTTON.btn.btn-primary` «Nuevo albaránN» · caja 36 · toque 37 · 929
- `INPUT.input.alb-buscador` «(sin texto)» · caja 34 · toque 35 · 929
- `SELECT.input.alb-sel-cobro` «Facturación: todos (1)Sin facturar» · caja 36 · toque 37 · 929
- `A.alb-enlace` «Reforma de baño» · caja 16 · toque 17 · 929

**`renderFacturasRecibidasView`** · `facturasRecibidasView.js` · S2 · 4 pendientes

- `INPUT.input` «(sin texto)» · caja 34 · toque 34.6 · 390/929
- `SELECT.input` «T1T2T3T4» · caja 36 · toque 36.6 · 390/929
- `BUTTON.btn-secondary` «Consultar» · caja 36 · toque 36.7 · 929
- `BUTTON.btn-secondary` «Descargar CSV» · caja 36 · toque 36.7 · 929

**`renderProvidersView`** · `providersView.js` · S2 · 4 pendientes

- `BUTTON.btn.btn-secondary` «Recargar» · caja 36 · toque 36.9 · 929
- `BUTTON.btn.btn-primary` «Crear proveedor» · caja 36 · toque 36.9 · 929
- `BUTTON.btn.btn-secondary.btn-sm` «Editar» · caja 30 · toque 30.7 · 929
- `BUTTON.btn.btn-secondary.btn-sm` «Activar» · caja 30 · toque 30.7 · 929

**`renderProductsView`** · `productsView.js` · S2 · 3 pendientes

- `INPUT.input` «(sin texto)» · caja 34 · toque 35 · 390/929
- `INPUT.segmented-input` «(sin texto)» · caja 16 · toque 16.5 · 390/929
- `INPUT.segmented-input` «(sin texto)» · caja 16 · toque 16.5 · 390/929

**`renderDocumentoSueltoView`** · `quotesView.js` · S2 · 2 pendientes

- `BUTTON.btn.btn-secondary.quote-ver-documento` «Ver documento» · caja 36 · toque 36.6 · 929
- `BUTTON.btn.btn-primary` «Continuar» · caja 36 · toque 36.6 · 929

**`renderQuoteDetailView`** · `quotesDetailView.js` · S2 · 2 pendientes

- `INPUT.input` «(sin texto)» · caja 34 · toque 34.9 · 390/929
- `BUTTON.btn.btn-ghost` «Crear revisión» · caja 36 · toque 36.7 · 929

**`renderQuotesView`** · `quotesView.js` · S2 · 2 pendientes

- `BUTTON.btn.btn-secondary.quote-ver-documento` «Ver documento» · caja 36 · toque 36.9 · 929
- `BUTTON.btn.btn-primary` «Continuar» · caja 36 · toque 36.9 · 929

**`renderExpenseDetailView`** · `expensesView.js` · S2 · 1 pendientes

- `A.gasto-trab-enlace` «Reforma de baño» · caja 44 · toque 36 · 390/929

**`renderQuoteRequestsView`** · `quoteRequestsView.js` · S2 · 1 pendientes

- `SELECT` «PendientesTodasCompletadas» · caja 32 · toque 32.5 · 390/929

**`renderReportsView`** · `reportsView.js` · S2 · 1 pendientes

- `SELECT` «20262025202420232022» · caja 32 · toque 33 · 390/929

**`renderParteDetailView`** · `parteDetailView.js` · S4 · 1 pendientes

- `BUTTON.btn.btn-secondary` «Volver al trabajo» · caja 36 · toque 36.8 · 929
