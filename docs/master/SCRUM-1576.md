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
