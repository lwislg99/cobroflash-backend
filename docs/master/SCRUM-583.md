# SCRUM-583 · CONT-10 · Exportar contactos — **EL TICKET SE CAE: ya está construido**

**Fecha:** 2-sep-2026 · **Carril:** portabilidad (R11) · **Gate:** no aplica — no se toca código

**Medido contra:** `origin/main` = `69300b6662752e8fe624b1f6ee6b555f02e3a3f2` · 2026-09-02T17:46:03Z

> **Veredicto: no se construye nada.** La pregunta P5 del lote del 24-ago —«¿existe ya la
> exportación de clientes en otro sitio del producto? Si existe, el ticket se cae»— tiene
> respuesta: **existe, es alcanzable, tiene el formato correcto para Excel en español y está
> cubierta por guards**. Incluidos el suelo y el canario que este ticket pedía construir.

---

## 1 · PASO 0

### ENTRADA · sí la hay, y es alcanzable

**No es «existe el endpoint y no hay puerta».** La cadena está entera y se comprobó eslabón a
eslabón:

| paso | dónde | comprobado |
| --- | --- | --- |
| 1 · menú | `public/dashboard/index.html:131` — `data-view="reports"` («Informes») | grep |
| 2 · botón | `public/dashboard/js/reportsView.js:57` — `⬇ Clientes CSV` | **por AST: `appendChild(btnCust)` con 0 `if` por encima → incondicional** |
| 3 · ruta | `GET /admin/exports/customers.csv` (`exports.routes.ts:411`), admin-only | `adminOnlyRoutes.ts:83` |
| 4 · datos | `buildClientes()` en `exports/domain/exportData.ts` | **ejecutado contra `yaqu_dev_javier`: 7 filas, 8 columnas** |
| 5 · formato | `sendCsv()` → BOM + `csvRow` | **bytes reales `EF BB BF`** |

Y hay un **segundo camino** para R11: la pantalla «Descargar datos» (`exportView.js`) con el ZIP,
que incluye `clientes.csv`.

### MECANISMO · construido, y además protegido

El motor no sólo existe: **ya tiene guards**, y son justo los que este ticket pedía escribir.

`tests/scrum25-exports.test.mjs` (gateado por `QA_DB_TEST=1`) comprueba:

* **el BOM**, mirando los **bytes crudos** con el mismo motivo escrito: «si no, Excel rompe los
  acentos». Y con una nota que vale su peso: `Response.text()` descarta el BOM al decodificar
  (spec WHATWG), así que mirar el texto habría dado un falso verde.
* **el canario**: `clientes.csv` trae `Cliente S25 A` — literalmente el suelo que este ticket
  pedía («cuenta filas y comprueba que un cliente concreto ESTÁ, con su nombre»), y con la razón
  escrita: sin él, la comprobación de tenancy pasaría en vacío.
* admin-only para los seis CSV, el filtro por rango y el contenido del ZIP.

`tests/scrum104-clientes-referenciados.test.mjs` cubre la divergencia deliberada entre
`buildClientes` (la cartera, por fecha de alta) y `buildClientesReferenciados` (los del paquete).

---

## 2 · Lo que se midió del formato, que es el motivo del ticket

El encargo avisaba de que «casi nadie comprueba que el CSV se ABRA». Se comprobó, **ejecutando**:

| propiedad | medido | resultado |
| --- | --- | --- |
| separador | `CSV_SEPARADOR` | **`;`** — y con el motivo escrito: Excel ES usa el separador de lista del sistema |
| BOM | bytes de `sendCsv` | **`EF BB BF`** |
| decimales | `csvNum` | coma decimal, sin punto de miles (para que Excel no lo lea como texto) |
| tildes y eñes | fila real | `María García` íntegro |

### El caso que rompe todo separador

Se probó con **un parser CSV fiel** (RFC 4180, que respeta comillas), no con un `split`:

| valor en el nombre | ¿se recupera intacto? |
| --- | :-: |
| `Talleres Perez; SL` | ✅ |
| `Garcia, Maria` | ✅ |
| `Bar "El Rincon"` | ✅ |
| `Calle Mayor 3\n2 izq` | ✅ |
| `A; "B"` | ✅ |
| `Linea A\rLinea B` (retorno **solo**) | ⚠️ **no** — ver huecos |

> 🔴 **Mi primer medidor dijo que el `;` partía el fichero, y era FALSO.** Partía yo el resultado
> con un `split(';')` ingenuo que no respeta comillas — el valor estaba bien escapado como
> `"Talleres Perez; SL"`. Es el mismo error que cometí esta tarde midiendo un PDF con los nombres
> de campo equivocados: **el instrumento equivocado produce el hallazgo equivocado**, y en las dos
> direcciones. Por eso el parser lleva su propio suelo (`"x;y"` tiene que leerse como una celda)
> antes de creerse ningún veredicto.

---

## 3 · Las columnas de hoy, y por qué no se heredan defectos

`CLIENTES_HEADER` (8): `Nombre` · `Razón social` · `NIF/CIF` · `Teléfono` · `Email` · `Notas` ·
`Baja WhatsApp` · `Fecha de alta`.

El encargo avisaba de no heredar los defectos del CSV del tarifario (SCRUM-635: «exporta el IVA
que ya no se pide y esconde el coste»). **No aplica**: el export de clientes no comparte lista de
columnas con el de productos — sólo comparten el motor (`csvRow`, `csvEscape`, `sendCsv`), que es
justo lo que sí conviene compartir.

---

## 4 · Huecos declarados

* **Los cinco campos de facturación NO salen en el export, y hoy no pueden salir**:
  `billing_address`, `billing_city`, `billing_postal_code`, `billing_province`, `billing_country`
  **todavía no existen en `prisma/schema.prisma`** (medido: 0 apariciones). S1 los trae en
  `scrum-579-direccion-facturacion`. **Cuando entren, `CLIENTES_HEADER` y `clienteRow` habrá que
  ampliarlos** — son datos del cliente y R11 dice que el profesional se lleva lo suyo. **No lo
  resuelvo por mi cuenta, como se me pidió: queda para coordinar.**
* **Un `\r` sin `\n` dentro de un nombre o notas queda SIN escapar.** `csvEscape` entrecomilla por
  `;`, `"` y `\n`, pero no por `\r` solo, y Excel lo interpreta como salto de línea: partiría la
  fila. **No lo arreglo (regla 9): `csvEscape` es del motor compartido y tocarlo cambia los SEIS
  exports a la vez.** Sin víctima hoy —un `\r` suelto llega copiando de sistemas antiguos— pero
  queda escrito.
* **Los guards del export están GATEADOS** (`QA_DB_TEST=1`, `npm run test:staging:gated`): no
  corren en `npm test`. Una regresión del CSV de clientes **no la caza la tanda normal**. Es
  coherente con el diseño de la casa (necesitan BD), pero conviene saberlo antes de fiarse del
  verde de `npm test` para este camino.

---

## 5 · Qué NO se ha hecho, y por qué

**No se ha escrito una línea de código.** El carril lo decía: «cerrar un ticket porque ya estaba
hecho vale exactamente lo mismo que cerrarlo construyéndolo, y cuesta mucho menos». Construir un
segundo exportador de clientes habría añadido superficie, una segunda lista de columnas que
mantener y una segunda forma de divergir.

**No se pidió microcopy**: no hace falta rótulo nuevo, el botón ya existe y su texto ya está en
producción.

**No se ejecutó la suite gateada**: requiere tomar el turno de staging, y no había nada que
verificar en ella que no estuviera ya medido por ejecución directa contra dev.
