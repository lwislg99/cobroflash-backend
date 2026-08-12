# SCRUM-323 · E2 · PASO 0: el mapa — y el bloqueo del ticket ya está resuelto

**Medido contra:** `origin/main` = `75b2b01820f71bdb1bf2b3244b19f801d69e24f6` · 2026-08-12T09:46:54+02:00
**Medido en:** host `DESKTOP-T5MONF5` (el de esta sesión)
**Rama:** `scrum-323-mapa-contable` · **Cero construcción, cero schema, cero código.**

> Host y fecha en la primera línea: un recuento sin población se lee como el estado del proyecto
> (SCRUM-476 y la reconciliación de SCRUM-351).

---

## 🔴 1 · No existe el diseño del bloque E en el repo

`docs/diseno/` tiene **`bloque-a` · `bloque-b` · `bloque-c` · `bloque-d` · `bloque-g`**. **No hay
`bloque-e.md`.**

La convención está escrita en la cabecera de los que sí existen: **copia VERBATIM de la descripción
de la epic en Jira**, con origen, fecha de copia y aviso de caducidad — las hizo SCRUM-411.

**Consecuencia para la instrucción «si un ticket y un diseño discrepan, gana el diseño»: aquí no se
puede aplicar,** porque el diseño de E solo existe en Jira (epic **SCRUM-280** + la descripción de
**SCRUM-323**). No lo he copiado yo: copiar una epic es lo que hace SCRUM-411 y no es este encargo.

## 🔴 2 · El «BLOQUEO DURO» que declara el ticket **ya se decidió**, y eso encoge E2 entero

La descripción de SCRUM-323 dice, hoy, en Jira:

> «⚠️ **BLOQUEO DURO: decisión del fundador — libro o asiento.** Ver SCRUM-280 punto 4. Esta tarea
> **no se puede construir** sin esa decisión, porque las dos versiones no se parecen en nada.»

**Está resuelto desde el 7-ago-2026** y consta en el repo — `docs/master/SCRUM-280.md`:

> **«Se entrega el LIBRO DE REGISTRO. No se entrega el asiento contable.»**
> Decidido **por el ASESOR, por delegación expresa del fundador** (se firma como suyo: quien delega
> no decide).

**Y esto no es un detalle administrativo: desmonta la premisa del título de E2.** «El problema no es
el formato, es el plan contable» describe el **CAMINO 2** —producir el asiento, con plan de cuentas
y partida doble—, que es justo **el que no se eligió**. La cuenta de 12 caracteres del `SUENLACE`,
el mapeo cliente→subcuenta y la tabla de proveedores **pertenecen al camino descartado**.

> Con el Camino 1 sobre la mesa, la pregunta de E2 deja de ser «¿qué formato contable generamos?» y
> pasa a ser **«¿el libro que ya entregamos le sirve al programa del despacho como ORIGEN DE
> DATOS?»**. Son dos tickets de tamaños incomparables.

⚠️ **El ticket de Jira está desactualizado respecto a la decisión.** No lo edito (no cierro ni
modifico tickets), pero queda dicho: quien lo lea hoy empieza a construir el camino caro.

---

## 3 · Qué exporta HOY el producto para una gestoría — **derivado del código**

Dos cosas distintas, y solo una es «el libro».

### ① El paquete genérico — `GET /admin/exports/datos.zip`

Pantalla: **Finanzas › «Descargar datos»** (`public/dashboard/index.html`, `data-view="export"` →
`exportView.js`). Router **admin-only** (`mountAdmin(app, '/admin/exports', requireRole('admin'), …)`).
Seis CSV, con estas **cabeceras literales** (`src/modules/exports/domain/exportData.ts`):

| fichero | columnas |
|---|---|
| `clientes.csv` | Nombre · Razón social · NIF/CIF · Teléfono · Email · Notas · Baja WhatsApp · Fecha de alta |
| `facturas.csv` | Número · Fecha · Cliente · Email cliente · Base · IVA · Total · Moneda · Estado · Pagada en · VeriFactu |
| `cobros.csv` | Cobro # · Fecha · Cliente · Concepto · Importe · Moneda · Método (paid_via) · Estado · Cobrado en · Referencia |
| `trabajos.csv` | Trabajo # · Título · Estado · Cliente · Operario · Fecha prevista · Total aceptado · Total cobrado · Pendiente · Estado de cobro · Alta |
| `gastos.csv` | Fecha · Concepto · Categoría · Importe · Moneda · Proveedor · Presupuesto ID · Registrado por · Notas |
| `presupuestos.csv` | ID · Fecha · Cliente · Email · Teléfono · Total · Moneda · Estado · Aceptada en · Condiciones de pago |

**Esto no es un libro de registro**: mezcla documentos fiscales con operativa interna (trabajos,
presupuestos, operarios) y **no lleva desglose por tipo de IVA por línea**.

### ② El LIBRO — `GET /admin/libros/expedidas.csv` · `…/recibidas.csv`, por trimestre

Es lo que A6 (SCRUM-296) construye y E4 (SCRUM-325) entrega. Columnas literales
(`src/modules/fiscal/librosAeat/librosAeat.ts`):

**Expedidas (11):** Fecha de expedición · Serie y número · Tipo de factura · NIF del destinatario ·
Nombre del destinatario · Base imponible · Tipo de IVA (%) · Cuota de IVA · Total de la factura ·
**Cobro** · **Anulada**

> Las dos últimas están partidas por eje **por decisión del asesor (7-ago)**: `status` mezclaba
> cobro y anulación, y «Pendiente» a secas se lee como «pendiente de EMITIR».

**Recibidas (12):** Serie y número del proveedor · Fecha de expedición del proveedor · **Fecha del
apunte** · NIF del proveedor · Nombre del proveedor · Concepto · Base imponible · Tipo de IVA (%) ·
Cuota de IVA soportada · **¿Deducible?** · Importe del apunte · Moneda

### 🔴 Y un hallazgo de camino: **la UI solo pide UNA de las dos**

`public/dashboard/js/exportView.js:319` descarga **`expedidas.csv`**. **Ninguna pantalla pide
`recibidas.csv`** — barrido sobre `public/`. La ruta existe, sus 12 columnas existen, y el
profesional **no tiene por dónde pedirla**.

Un despacho necesita **los dos libros**; con uno solo, el IVA soportado no llega. Es el patrón
«mecanismo sin entrada» otra vez. **Regla 9: se reporta, no se arregla aquí.**

Y de paso, con el mismo barrido: **`/admin/modelo-303` y `/admin/evidencias.zip` no los pide
ninguna pantalla** tampoco.

---

## 4 · Qué le falta para que un programa de gestoría lo ingiera

⚠️ **Marcado en tres niveles:** `[FUENTE]` verificado en fuente externa citada · `[TICKET]`
afirmación de la descripción de SCRUM-323 que **yo no he verificado** · `[SUPOSICIÓN]` mía.

### Para el CAMINO 1 (lo decidido): el libro como origen de datos

| falta | por qué |
|---|---|
| **`recibidas.csv` no se puede pedir** | sin él no hay IVA soportado. **Medido arriba.** |
| **Una sola línea por factura** | el libro da un tipo de IVA por fila; una factura con **dos tipos** (21 % + 10 %) necesita dos líneas enlazadas por el mismo número. **No he medido cómo se emite hoy ese caso** — `[SUPOSICIÓN]` de que hace falta comprobarlo antes de prometer nada |
| **Validación de NIF con dígito de control** | `[TICKET]`: un NIF inválido rompe la importación en silencio |
| **Duplicados de factura recibida** | `[TICKET]`: el mismo ticket fotografiado dos veces desde la furgoneta entra dos veces |
| **Codificación y separador del CSV** | un CSV UTF-8 con comas se abre mal en un Excel español (espera `;` y suele asumir Windows-1252). `[SUPOSICIÓN]`: no he medido con qué separador y codificación sale el nuestro |

### Para el CAMINO 2 (descartado, y por eso NO es trabajo de hoy)

`[FUENTE]` **a3ASESOR** (`SUENLACE.DAT`): fichero **ASCII de ancho fijo**; el campo **Cuenta ocupa
12 caracteres en las posiciones 16-27**, con niveles de 6 a 12; el tipo de registro va en la
posición 15 (0 sin IVA, 1 cabecera de factura con IVA, 2 rectificativa, 3 observaciones). Se importa
desde *Utilidades / Importación-Exportación / Enlace contable*.
Fuente: [Enlace contable de entrada — Descripción de registros (Wolters Kluwer, PDF oficial)](https://media.a3software.com/a3responde/files/5081-Enlace_contable_descripcion_registros_WEB.pdf)
y [a3Responde — «Formato del fichero SUENLACE.DAT incorrecto»](https://a3responde.wolterskluwer.es/documentos/a3asesor-eco/enlace-contable-de-entrada-formato-del-fichero-suenlace-dat-incorrecto.html).

`[TICKET]`, **no verificado por mí**: que el nº de factura del `SUENLACE` ocupe **10 caracteres** y
que una serie `YAQU-2026-000147` se trunque cruzando enlaces; que **ContaPlus/Sage 50** use
`XDIARIO.TXT` + `XSUBCTA.TXT` y que **ContaSol** importe ese mismo ASCII; que **Cegid/Informàtica3**
use `Conta3` y **Aplifisa** un formato propio. Son afirmaciones de la descripción del ticket, que ya
corrigió dos atribuciones erróneas de la v1 — **conviene que las confirme quien tenga acceso a los
programas**, no yo desde aquí.

> **La cuenta contable es el muro, y no es nuestro:** el `43000012` de «Reformas García» **lo pone
> el despacho**, y cada uno numera a su manera. Por eso el Camino 2 exige importar el plan contable
> del asesor y mantener un mapeo cliente→subcuenta. **Está descartado; queda escrito para que nadie
> lo redescubra desde cero.**

---

## 5 · La pregunta para el asesor — redactada, **sin contestar**

> Le entregamos hoy, por trimestre y en CSV, el **libro de registro** de facturas **emitidas** (fecha
> de expedición, serie y número, tipo de factura, NIF y nombre del destinatario, base, tipo y cuota
> de IVA, total, si está cobrada y si está anulada) y tenemos construido el de **recibidas** (con
> fecha de apunte, NIF y nombre del proveedor, base, tipo, cuota soportada y si es deducible).
>
> **①** Con esos dos ficheros, ¿puede su programa **incorporarlos como origen de datos** sin que
> usted tenga que repuntear, o necesita sí o sí el asiento con las cuentas de su plan contable?
> **②** Si le sirven, ¿en qué **formato y con qué codificación y separador** los quiere, y **qué
> columna le falta** de las de arriba?
> **③** Una factura con **dos tipos de IVA**, ¿cómo la quiere: una fila por tipo con el mismo
> número, o una fila con las bases y cuotas en columnas separadas?
> **④** ¿Prefiere el fichero **por trimestre natural** o por el periodo que usted marque?

⚠️ **No contesto ninguna de las cuatro.** El plan contable es dictamen, no producto — y la elección
de formato es decisión del fundador con las dos respuestas delante.

---

## Lo que NO se ha hecho

**Cero líneas de código. Cero schema. Cero diseño.** No he creado `docs/diseno/bloque-e.md` (es de
SCRUM-411), no he editado ningún ticket de Jira, no he tocado el camino de emisión ni ninguna base.
No he elegido formato: eso es del fundador, y este encargo entrega un mapa.
