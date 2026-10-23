# SCRUM-1576 · ¿Qué más lee el cliente o el proveedor VIVO donde debería leer lo guardado en el documento?

**Medido contra:** `origin/main` = `0077bd1d51a7cb64b1c18d85781117b71936fd38` · 2026-10-22T10:00:30Z (censo y clasificación sobre `8ad167195af03cf4153337ccc1bf1b80d04c10f8`, 09:47:44Z; tests, censo y sonda repetidos tras `git merge origin/main`)
A9: comprobación → `tests/scrum1576-cobros-y-recibo-leen-el-cliente-de-la-factura.test.mjs`

Puesto J2 (`jv-j2s`) · árbol `j2s-lectores` · rama `scrum-1576-lectores-del-vivo`. Encargo del orquestador
`cobroflash-backend-5f`, ticket abierto por él (SCRUM-1576, sin comentarios al leerlo). Origen: los lectores que
SCRUM-1058c (PR #2656) dejó fuera de su GO (c.20207).

## 1 · El censo (AST)

`docs/master/evidencias/SCRUM-1576/censo.mjs`, con el compilador de TypeScript, sobre los **328** `.ts` de
`src/` (contados también con `find`: 328). Tres patrones: **R** (consulta sobre un documento con
`customer`/`provider` en su `include`/`select`/`where`), **S** (`customer.find*`/`provider.find*` en una función
que también consulta un documento) y **V** (el resto de lecturas de ficha).

- Resultado: **134 lecturas en 62 ficheros** (R 60 · S 34 · V 40). Salida en `censo-salida.txt`.
- **Positivo SEMBRADO**: una fuente fabricada dentro del instrumento con un R y un S, más una consulta de
  control que NO debe salir. Con la semilla: `MIDE`, salida 0. Con `--sin-semilla`: `CIEGO`, salida 2.
- ⚠️ **Error propio, cazado antes de clasificar:** la primera versión sólo tenía R y S, y **no veía el libro de
  recibidas**, el lector que ya conocíamos de 1058c: lee el gasto por un helper de otro fichero
  (`leerLibroRecibidas`) y al proveedor en otra función. Por eso existe V: la población entera de lecturas de
  ficha, que se lee a mano. El testigo «recibidas → provider.findMany» lo imprime el censo, pero **no es su
  control** (se jubilaría el día que alguien arregle ese lector): el control es la semilla.
- **No mide:** SQL crudo (`$queryRaw`) y lecturas de ficha que no pasen por `prisma.<modelo>.find*`.

## 2 · La clasificación

Las 134 líneas, repartidas sin solapes entre cinco agentes de solo lectura (33+19+26+26+30; 134 únicas).
Resultado en `evidencias/SCRUM-1576/clasificacion.md`, con el carril de cada lector:

- **(a) arreglable leyendo lo guardado: 14 lectores.** Dos de mi carril, **arreglados aquí** (§3). Los demás:
  `exports/invoices.csv` (S1, exportación: STOP), lista y detalle de facturas del panel y paquete de disputa
  (J1), buscador (S1), sobre del paquete de evidencias (J1, fiscal: STOP, ya en SCRUM-431/438) y seis del
  albarán (S1: lista, ficha, página pública de firma, PDF, precarga offline y el sobre, que es STOP).
- **(b) falta guardar el dato (esquema, regla 40): 9 filas de la tabla.** El libro de recibidas (J1, fiscal), los gastos (lista,
  ficha, `gastos.csv`, la deducibilidad al dar de alta), el PDF del presupuesto ACEPTADO que se regenera en
  cada apertura (sólo guarda un texto del cliente en `evidenciaFirma` cuando hubo firma), `presupuestos.csv`,
  `cobros.csv`, la fila de cobro de la pantalla Cobros, `trabajos.csv` y el parte firmado.
- **(c) no es defecto: el resto.** Envíos al contacto de HOY, emparejar entrantes por teléfono, autorizar,
  buscar, la propia ficha, y los lectores que ya pasan por `clienteDelDocumento` (PDF, XML, libros).
- **Hallazgo transversal (grep, no AST):** las cinco columnas congeladas de `Albaran` se escriben al emitir y
  **ningún lector de `src/` las lee**; sólo `albaranDuplicado.ts:90-92` las nombra, para vaciarlas.

## 3 · Lo arreglado en mi carril (J2), con rojo primero

| lector | antes | después |
|---|---|---|
| `GET /admin/cobros`: fila de una factura (`cobros.service.ts`) | `inv.customer.name` (vivo) | `clienteDelDocumento(inv, ficha).name` |
| `GET /recibo/:token`: pie «Cobro #N · Cliente: X» (`receipt.routes.ts`) | `ch.customer.name` (vivo) | si el cobro tiene factura, `clienteDelDocumento`; si no, la ficha |

Ningún texto cambia: cambia de dónde sale el nombre. Ninguna consulta cambia: la factura ya traía sus
columnas (`include` devuelve todos sus escalares). No toca emisión, libros ni exportaciones.

`tests/scrum1576-cobros-y-recibo-leen-el-cliente-de-la-factura.test.mjs`, por la ruta montada (banco de
SCRUM-597; el doble respeta `include`/`select`; las columnas las escribe `congelarDesdeFicha`):

| | casos | pass | fail |
|---|---|---|---|
| sin el arreglo | 7 | 5 | 2 (los dos 🔴) |
| con el arreglo | 7 | 7 | 0 |

Vecinos: los 49 ficheros que nombran cobros, recibo o el congelado, más scrum237, 976, 1415, 622, 850 y
1294, contra `dist/` de `tsc --noCheck`: **384 casos, 380 pass, 0 fail, 4 skip**, antes y después del merge.
Los 4 skip son de `QA_DB_TEST`, entre ellos el de `/recibo` de SCRUM-74: **no se han corrido**.
`guards:entrada`: 15 de 15. Los 5 de árbol entero de SCRUM-1560: 38 de 38. `tsc --noEmit`: 17 errores,
ninguno en los dos ficheros tocados (cliente de Prisma compartido por detrás; el tipado real lo da CI).
**No visto en yaqu.app** (no lo he intentado).

## 4 · Reproducido por la ruta real, fuera de mi carril (sin tocar)

`evidencias/SCRUM-1576/reproducir.mjs`: la ficha cambia después de la factura y se pide la ruta. Cada caso
lleva su control (con la ficha del día tiene que salir lo del día, o dice CIEGO).

| ruta | ficha del día | ficha de hoy | veredicto |
|---|---|---|---|
| `/admin/exports/invoices.csv`, columna «Cliente» | Fusionado | Principal | LEE EL VIVO |
| `/admin/invoices`, lo que pinta `invoicesView.js:652` | Fusionado | Principal (y en la misma respuesta, `customerName: Fusionado`) | LEE EL VIVO |
| `/admin/search`, factura | Fusionado | Principal | LEE EL VIVO |

Población: 3 casos · 0 CIEGO · ninguna escritura en el banco. El resto de la lista (a) **está leído, no corrido**.

## 22-oct-2026 · SCRUM-1576b · J1 · lista, ficha y paquete de disputa de facturas nombran al cliente congelado

**Medido contra:** `origin/main` = `82f3ea4115723db78ca56c4b2e1c426a810a0433` · 2026-10-22T13:58:26Z (arreglo y mutaciones sobre `0077bd1d51a7cb64b1c18d85781117b71936fd38`, 10:27Z, sesión `jv-j1u`; rojo/verde repetidos por `jv-j1y` tras `git merge origin/main`)
A9: comprobación → `tests/scrum1576b-facturas-pintan-el-cliente-congelado.test.mjs`

**Skill UI:** cargada (`yaqu-premium-ui`, y `yaqu-verifactu-sif` por tocar la ruta del paquete de disputa). Ningún texto nuevo, ninguna clase ni token nuevos: cambia de dónde sale el nombre.

Puesto J1 · árbol `j1u-1576b` · rama `scrum-1576b-facturas-pintan-el-cliente-congelado`. Los tres lectores (a) de
J1 que el §2 de arriba deja fuera del carril de J2.

| lector | antes | después |
|---|---|---|
| lista de facturas (`invoicesView.js`, celda del cliente) | la ficha viva | `customerName` de la factura si no es `null`; si no, la ficha |
| ficha de la factura (`invoiceDetailView.js`, fila «Cliente») | la ficha viva | la misma regla |
| paquete de disputa (`invoicesAdmin.routes.ts`, `dispute-package`) | `invoice.customer` (vivo) | `clienteDelDocumento(invoice, invoice.customer)` para nombre, teléfono y email |

Es la regla de `clienteDelDocumento`: una factura vieja sin columnas congeladas sigue pintando la ficha. Teléfono y
email de la ficha de la factura siguen VIVOS a propósito: son el destino de los envíos (clase (c) del §2). La ruta
del paquete de disputa no es camino de emisión: no sella, no escribe, sólo lee lo guardado.

`tests/scrum1576b-facturas-pintan-el-cliente-congelado.test.mjs`: ruta real (`_banco-camino-real`) → JSON → vista
(`_banco-vistas`); la ficha cambia después de la factura.

| | casos | pass | fail |
|---|---|---|---|
| sin el arreglo (los tres ficheros en `e1bb76d75`, `dist/` recompilado) | 10 | 7 | 3 (los tres 🔴) |
| con el arreglo | 10 | 10 | 0 |

Mutación (`jv-j1u`, sobre `0077bd1d`, no repetida tras el merge): deshacer cada uno de los tres arreglos por separado
da 9/1, y cae SÓLO su caso. Main no tocó ninguno de los tres ficheros ni los dos bancos entre `0077bd1d` y `82f3ea41`
(`git diff --stat`, vacío).

Vecinos, tras el merge, contra `dist/` de `tsc --noCheck`: el test, `scrum1576` (J2), `scrum811c` (el de SCRUM-1340),
`scrum854`, `scrum976`, `scrum267`, `scrum273`, `scrum262` y `scrum553`. Antes de este tramo: **104 casos, 101 pass, 3 fail**
(811c, 854 y 976: la rama toca `public/` y no escribía en `docs/master/`). La pasada de `tests:que-cubren` de `jv-j1u`
(654 ficheros, 5.801 casos, sobre `0077bd1d`) dio 10 fallos: 5 de entorno (árbol anidado sin `node_modules`, ruta 8.3:
scrum1199 ×2, scrum1298b ×2, scrum476), 2 suyos ya arreglados en la rama (262, 553) y los 3 de arriba. **No repetida tras el merge.**

**Sin tocar, a propósito:**
- (b) el libro de recibidas lee al proveedor vivo (`src/modules/fiscal/librosAeat/librosAeat.repo.ts:105`): falta guardar el dato, esquema (regla 40).
- STOP: el sobre del paquete de evidencias lee al cliente vivo (`src/modules/fiscal/evidencias/paquete.repo.ts:85`): fiscal, ya en SCRUM-431/438.

**Errores propios:**
- `jv-j1u` trajo A23 DESPUÉS de escribir el test; su primera mutación se hizo con el arreglo sin comitear (A23 #9), y se restauró por copia y `cmp`.
- `jv-j1u` puso en el fixture teléfonos reales y un `<th>` pegado: los cazaron `scrum262` y `scrum553`, y están arreglados en el tercer commit.
- `jv-j1y` sacó el `norma.mjs` de `main` con `git --work-tree=… checkout origin/main --`, que escribe el ÍNDICE del worktree propio: cinco ficheros de `docs/equipo/` quedaron `MM`. Se devolvió con `git restore --staged` y se comprobó con `git status` (0 líneas).
- El traspaso llamaba «scrum1340» a un test que no existe con ese nombre: es `scrum811c-skill-ui-declarada` (lo cita por SCRUM-1340). Se buscó por contenido antes de lanzar nada.

**No visto en yaqu.app:** producción no despliega desde el 20-oct 15:35Z (despliegues pausados en Railway). No lo he intentado.

## 23-oct-2026 · SCRUM-1576c · J2 · el albarán y el buscador, reproducidos por la ruta real (lista para S1, sin arreglar nada)

**Medido contra:** `origin/main` = `00179a513a5fb11ca12d61fe25b1b2dec26b51ca` · 2026-10-23T09:26:49Z (cabecera `Date:` de GitHub; `dist/` de `tsc --noCheck` sobre ese commit)
A9: comprobación → `docs/master/evidencias/SCRUM-1576/reproducir-albaran.mjs`

Puesto J2 (`jv-j2y`) · árbol `jv-j2y` · rama `scrum-1576c-albaran-y-buscador-por-ruta`. Encargo del orquestador
`cobroflash-backend-62`: los lectores (a) que el §2 dejó «leído, no corrido» y que son de **S1** (equipo de Luis).
**No se toca ninguno**: aquí sólo se mide, y la lista va a S1.

**Instrumento:** `evidencias/SCRUM-1576/reproducir-albaran.mjs`, hermano de `reproducir.mjs` (mismo banco de
SCRUM-597, `dist/app.js` entero con el doble de Prisma; ninguna base). El albarán se EMITE con la ficha del día —sus
cinco columnas congeladas las escribe `congelarDesdeFicha`, la función de la casa— y después la ficha cambia
(Fusionado / Fusionado SL / B11111111 → Principal / Principal SA / B22222222). Cada ruta se pide dos veces.
- **Control de cada caso:** con la ficha del día tiene que salir lo del día; si no, `CIEGO` y salida 2.
- **Control de que el control muerde:** `--ciego` pide un valor imposible → **10 de 10 CIEGO, salida 2** (medido).
- **Discriminación:** el PDF de un albarán FIRMADO v:3 saca el nombre del sobre (SCRUM-452) y **sale `LEE LO GUARDADO`**:
  la sonda sabe decir las dos cosas.
- Salida completa: `evidencias/SCRUM-1576/reproducir-albaran-salida.txt`. **Población: 10 casos · LEE EL VIVO 9 · LEE LO GUARDADO 1 (el control) · CIEGO 0.**

| # | lector (carril S1) | ruta | qué ve quién | día → hoy | veredicto |
|---|---|---|---|---|---|
| 1 | `albaranes.routes.ts:154` → `albaranesListado.ts:234` | `GET /admin/albaranes` | panel, columna «cliente» | Fusionado SL → Principal SA | LEE EL VIVO |
| 2 | `albaranes.routes.ts:865` | `GET /admin/albaranes/:id` | panel, ficha del albarán (`customer.name`) | Fusionado → Principal | LEE EL VIVO |
| 3 | `albaranPublic.routes.ts:244` | `GET /albaran/:token` (emitido) | cliente: «Hola, X» y el firmante precargado | Fusionado → Principal | LEE EL VIVO |
| 3b | el mismo `loadContext` | `GET /albaran/:token` (ya firmado v:3) | cliente: «Gracias, X» | Fusionado → Principal | LEE EL VIVO |
| 4 | `albaran.service.ts:800` (`ensureAlbaranPdf`) | `GET /admin/albaranes/:id/pdf` (emitido sin firmar) | PDF, «Receptor» | Fusionado SL → Principal SA | LEE EL VIVO |
| 4n | el mismo | el mismo | PDF, NIF del receptor | B11111111 → B22222222 | LEE EL VIVO |
| 4c | el mismo (control) | el mismo, albarán firmado v:3 | PDF, «Receptor» | Fusionado SL → Fusionado SL | LEE LO GUARDADO |
| 5 | `precarga.service.ts:335` | `GET /admin/precarga` | móvil del técnico, `clienteNombre` | Fusionado → Principal | LEE EL VIVO |
| 6 | `albaran.service.ts:642` (`buildFirmaEvidencia`) | `POST /albaran/:token/firmar` | nadie directo: `evidenciaFirma.contenidoCongelado.cliente` que se SELLA | Fusionado SL → Principal SA | LEE EL VIVO · **STOP** (sellado, SCRUM-577) |
| 7 | `search.routes.ts:86` | `GET /admin/search?q=` | panel, buscador (factura) | Fusionado → Principal | LEE EL VIVO |

**Lo que dice cada fila, con lo que NO dice:**
- 1, 2, 3, 5: las cinco columnas congeladas del `Albaran` están en la fila del doble (que las devuelve a quien las pide)
  y ninguna de las cuatro rutas las usa: la lista y la precarga ni las piden en su `select`. Confirma por ruta el hallazgo del §2, que era de `grep`.
- 3b: en un albarán YA FIRMADO, la página pública saluda con el nombre de hoy mientras el sobre sella el de entonces.
- 4n: el NIF del receptor en el PDF sale vivo **también en el firmado v:3** (se ve en la salida del 4c); SCRUM-452 lo
  declaró a propósito porque el sobre no congela el NIF. Para el EMITIDO sin firmar, la columna `customerTaxId` sí lo guarda.
- 6: si la ficha cambia entre EMITIR y FIRMAR, el sobre sella la ficha del momento de la firma, no la de la emisión.
  **Si eso es defecto o es lo correcto (quien firma, firma con el nombre de ese día) es criterio de S1/fundador, no mío.**
  Y tocarlo es el sellado: STOP.
- 7: repite el caso 3 de `reproducir.mjs` (ya «medido» en la clasificación; la ficha de mi encargo lo daba por no corrido).
- **No medido:** el PDF del albarán con trazo de firma en `in_situ` (canal distinto, misma función 642, no corrido);
  versiones v:1/v:2 del PDF (no corridas); yaqu.app (no lo he intentado: necesitaría un albarán de verdad y cambiarle la ficha).

**Ninguna escritura fuera del doble.** El PDF se escribió en `storage/albaranes` del directorio temporal de la sesión
(la sonda se lanza desde fuera del árbol), no en el repositorio.

**Error propio:** la primera pasada dio 3 CIEGO por mis extractores (el saludo se llevaba el emoji y el PDF parte
«Receptor:» y el nombre en dos trozos). Al arreglarlos pasé el cambio por `node -e` en bash, y bash se comió la barra de
`\s`: la expresión excluía la letra «s» y salió «Fu» → 4 CIEGO. Es la cicatriz de J2 del 1-oct y del 8-oct, por
tercera vez. **Lo cazó el control de cada caso**, no yo: por eso la línea A9 apunta a la sonda. Corregido con la
herramienta de edición.
