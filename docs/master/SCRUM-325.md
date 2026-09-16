# SCRUM-325 · E4: el libro de A6, por trimestre y en un fichero

**Fecha:** 7-ago-2026 · **Carril:** E (entrega al asesor) · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `cb2399788aebe786608491734390b45e8b067d1e` · 2026-08-07T18:15:10Z

**Tanda:** ver el final de la entrada.

> **ENTREGA lo que A6 (SCRUM-296) CONSTRUYE.** Aquí no se suma, no se reparte IVA y no se toca un
> asiento. Si una cifra del CSV no cuadra con el libro, el defecto está en la entrega — nunca al
> revés. Al amparo de [[SCRUM-280]] (Camino 1).

---

## 🔴 LOS TRES HUECOS, antes que nada

Van arriba a propósito. Un hueco escrito al final de una entrada de 200 líneas es un hueco que se
lee tarde, y ésa fue la lección de la cabecera de `MIGRATIONS_PENDING.md`.

### ① Esto NO es todavía el formato de Libros Registro de la AEAT

El ticket pide «el formato de Libros Registro de la AEAT». **Lo entregado no lo es**, y llamarlo así
sería declarar una conformidad que nadie ha verificado.

**Qué falta, exactamente:** contrastar las columnas, su orden y sus valores admitidos contra la
**especificación oficial de la AEAT**, que **no está en este repo**. No hay en el árbol ningún
documento, XSD ni tabla contra la que comparar — se buscó (`docs/`, `src/`) y no aparece.

Por eso, **decisión del asesor (7-ago-2026)**: se llama **«Facturas emitidas»** y es **un CSV con
las columnas del libro**. Ni el nombre del fichero, ni el código, ni la UI dicen «AEAT» ni «Libro
Registro» — y hay un test que lo ata (`el nombre del fichero … NO promete conformidad`).

> **Es el contador de F3 otra vez:** un número —o un nombre— que afirma más de lo que nadie ha
> comprobado. La palabra es la promesa (regla 7).

**Siguiente acción concreta:** meter la especificación oficial en el repo (o un extracto citado con
su fuente y fecha), contrastar columna a columna, y solo entonces decidir el nombre.

### ② NO hay libro de facturas RECIBIDAS — y está BLOQUEADO POR E3 (SCRUM-324)

**La dependencia, que hoy no estaba escrita en ningún sitio:** el libro de recibidas necesita que
el **MODELO del gasto** tenga campos fiscales, y ese modelo es de **E3 (SCRUM-324)**, su dueño.
Mientras `Expense` no los tenga, este ticket no puede entregar recibidas sin inventárselas.

**Los cinco campos que faltan**, medidos en SCRUM-321 (E0, Q2) sobre el DMMF:

| # | Campo | Estado hoy |
| --- | --- | --- |
| 1 | **NIF del proveedor** | ❌ `Provider` no tiene **ningún** campo que case con `tax\|nif\|cif\|vat` |
| 2 | **Base imponible** | ❌ solo existe `Expense.amount`, y nada declara si es base o total |
| 3 | **Tipo de IVA** | ❌ cero campos `iva\|vat\|base\|cuota\|tax` en `Expense` |
| 4 | **Cuota de IVA** | ❌ ídem |
| 5 | **¿Es deducible?** | ❌ el campo no existe |

*(Y además, aunque no sean de los cinco: número y serie de la factura del proveedor, y retención de
IRPF.)*

**De los 8 datos que pide un asiento de compra hay 2 completos, 1 a medias y 5 que no existen. Un
gasto de YaQu hoy es un apunte de caja para calcular margen, no un asiento.**

Rellenar esas columnas con `amount` y un IVA supuesto sería **inventarle a alguien sus datos
fiscales y entregárselos a Hacienda con su nombre encima**. Se declara y no se entrega.

Lo ata un test: `LIBROS_DISPONIBLES` tiene **un** elemento, y si aparece un segundo el rojo dice que
`Expense` tiene que haber ganado antes esos campos — que es schema, y el schema no es de este ticket.

### ③ `annulled` PISA el estado de cobro — apareció al partir la columna

«Estado» se partió en dos columnas (**Cobro** y **Anulada**, aprobadas el 7-ago-2026) porque
`Invoice.status` mezclaba dos ejes en una palabra. Al separarlos salió un hueco del MODELO:

**Como los dos ejes compartían un solo campo, en cuanto una factura se anula se pierde si estaba
cobrada.** Por eso «Cobro» sale **vacío** para `annulled` y no «Pendiente»: escribir «Pendiente»
afirmaría que no se cobró, y eso no consta. Un hueco dice «no se sabe»; una palabra afirma.

Recuperar ese dato es un **cambio de modelo** (dos campos, o un histórico de estados) y **no es de
este ticket**. Queda declarado y con test que lo fija.

---

## Lo que se construye

`GET /admin/libros/expedidas.csv?año=AAAA&trimestre=N` → CSV del trimestre, con las columnas del
libro. Enlazado desde **Finanzas › Descargar datos**, que es donde esa página vive hoy.

**⚠️ NO se mueve nada a «Tus datos», y es deliberado.** Ese submenú existe como rótulo y está
**vacío**; `settingsSubmenus.js` declara *cuándo* se muda («cuando “Tus datos” tenga contenido
propio: portabilidad, borrar cuenta») y por qué. Adelantarlo sería decidir por ese fichero.

**Y la página NO se rehace** (punto 0.2 del encargo): esto añade una card a la que ya existe.

### Lo que se reutiliza en vez de duplicarse

* **`rangoTrimestre` de A5 (SCRUM-295).** Si el libro y el modelo 303 definieran «trimestre» por su
  cuenta, un día dirían cosas distintas del mismo periodo y el profesional tendría **dos documentos
  oficiales que se contradicen**. Hay test que ata el import y prohíbe construir fechas a mano.
* **El formato CSV de SCRUM-86** (`;`, coma decimal sin punto de miles, CRLF, **BOM UTF-8**). El BOM
  es lo que hace legible una Ñ en Excel español; aquí se **hereda**, no se reimplementa.

### Las decisiones de formato que no son obvias

* **Una fila por TIPO DE IVA**, no por factura: una factura con 21 % y 10 % son dos apuntes. El
  desglose lo trae A6 en `porTipo` — no se recalcula.
* **El total va SOLO en la primera fila del desglose.** Repetirlo haría que sumar la columna diera
  el total **multiplicado por el número de tipos** de la factura.
* **Un importe ilegible sale VACÍO, nunca `0,00`.** Un cero afirma «facturó cero»; un hueco dice «no
  se sabe». Regla heredada de A5/A6.
* **Año y trimestre son OBLIGATORIOS.** El export de SCRUM-244 sin fechas descarga todo el histórico
  (medido en SCRUM-321 Q1); aquí eso sería peor que inútil — un fichero que dice ser de un periodo y
  trae otro es justo lo que no se puede entregar.

---

## Los cinco rojos, ejecutados

Con la inyección **verificada en disco** y el árbol restaurado en cada uno.

| | Mutación | Resultado |
| --- | --- | --- |
| **R1** | quitar una columna del formato | 🔴 cae **nombrándola**, en el censo de columnas y en la fila congelada |
| **R2** | `>` en vez de `>=` en el borde del periodo | 🔴 `una factura del ÚLTIMO instante del trimestre (2026-09-30T22:59:59.999Z) se queda FUERA` |
| **R3** | quitar el BOM de `csvBody` | 🔴 en **bytes**: `primeros bytes: 91,80,69` en vez de `EF,BB,BF` |
| **R4** | desactivar el suelo | 🔴 `un fallo del lector se está entregando como un trimestre sin facturación` |
| **R5** | sustituir `leerLibroRegistro` | 🔴 `EL LIBRO YA NO SALE DE leerLibroRegistro (SCRUM-296 / A6)` |

### 🔴 R2 me cazó a mí primero, y la lección se queda escrita en el test

La primera versión ancló el borde en `'2026-09-30T23:59:59.900Z'` (UTC) y **salió ROJA con el código
CORRECTO**: el trimestre acaba a las 23:59:59.999 **hora de Madrid**, o sea `22:59:59.999Z`, así que
ese instante UTC ya es 1 de octubre en local.

> **Escribir una frontera fiscal a mano en la zona equivocada convierte el test en un generador de
> falsos rojos justo donde invita a «arreglar» un periodo que estaba bien.**

Los bordes se **derivan** de `rangoTrimestre`, no se escriben a mano.

### El suelo, que es el asunto de este ticket

Un periodo sin facturas y un lector que no supo mirar producen **el mismo fichero en blanco**, y
significan lo contrario: el primero es correcto, **el segundo se le manda a Hacienda diciendo que no
facturaste**. `LibroRegistro.miradas` es lo que los separa —A6 lo expone justo para esto— y aquí se
EXIGE: sin ese número no se emite fichero, se lanza. Con su control por el otro lado: un libro
legible y vacío **no** lanza, o el suelo no distinguiría nada, solo rechazaría.

---

## Microcopy

**Aprobadas el 7-ago-2026:** las nueve primeras cabeceras (Fecha de expedición · Serie y número ·
Tipo de factura · NIF del destinatario · Nombre del destinatario · Base imponible · Tipo de IVA (%) ·
Cuota de IVA · Total de la factura), el nombre **«Facturas emitidas»** y el fichero
`yaqu-emitidas-AAAA-TN.csv`.

**«Estado» se partió en DOS columnas** (aprobado el 7-ago-2026), una por eje:

| Columna | Valores |
| --- | --- |
| **Cobro** | `Pendiente` · `Cobrada` · *(vacío si está anulada — ver hueco ③)* |
| **Anulada** | `Sí` · `—` |

**No hay estado de EMISIÓN**: una factura con número está emitida por definición — el número *es* la
identidad fiscal. «Estado: Pendiente» a secas se leía como «pendiente de EMITIR», el malentendido más
caro posible en un documento que sale de casa. Familia de SCRUM-372.

**El conjunto real de `Invoice.status` = {`pending`, `paid`, `annulled`}**, verificado antes de
aprobar los rótulos y por dos barridos independientes: AST sobre `src/` (7 escrituras a
`invoice.create/update/updateMany/upsert`, **cero** asignaciones no literales) más el
`@default("pending")` del schema; y revisión de las tres semillas (`seed-demo` ×2, `seed-video` ×1),
que solo escriben `paid` y `pending`. **Un cuarto valor sin columna asignada se pone rojo
nombrándolo** (`celdasDeEstado`), y hay un test que compara el mapa con lo que el código escribe de
verdad — una tabla que se desincroniza de su fuente es el mismo defecto en otra capa.

> ⚠️ **`already_paid` NO es un valor de `Invoice.status`.** Es un campo de RESPUESTA de la API
> (`invoice.routes.ts:88`, la respuesta idempotente de «esta factura ya estaba pagada»). Aparece en
> **cualquier grep de `status:`** del módulo de facturación y se lee como si fuera un estado — casi
> cuela en esta misma medición. **Si vas a censar estados, cuenta ESCRITURAS al modelo, no
> apariciones de la palabra.** Queda anotado aquí y en `MAPA_ESTADO`; no se anotó en
> `invoice.routes.ts` porque ese fichero contiene `router.post('/issue')` y es camino de emisión
> (regla 38): un comentario ahí es un diff en ese fichero y necesita GO.

### El periodo

**Sin rango de años** (decisión del asesor, 7-ago-2026): el `2000-2100` que había me lo inventé yo, y
**una regla que nadie decidió acaba rechazando algo legítimo**. Se exige año **entero** y trimestre
**T1-T4** — este último sí tiene motivo: `rangoTrimestre` recorta fuera de rango en silencio
(`Math.min(4, Math.max(1, …))`), así que un T7 se convertiría en T4 y el fichero diría ser de un
periodo que no se pidió.

Microcopy **aprobada**: «No reconozco ese periodo. Elige un trimestre (T1 a T4) y un año.» —
verificada contra lo que el validador rechaza de verdad, caso a caso.

**🔴 Y lo que de verdad protege del error de dedo:** un periodo **válido y vacío** ya no sale en
silencio. Quien teclea 2062 en vez de 2026 recibía el mismo fichero que quien no facturó ese
trimestre — dos situaciones, una sola pantalla, el defecto de siempre. El servidor manda el recuento
en `X-Yaqu-Filas` (y `X-Yaqu-Miradas`) y la pantalla lo dice. **El fichero se sigue entregando**: un
libro vacío es una respuesta legítima y a veces es justo lo que se necesita como constancia.

**Pendientes de aprobar:** el aviso de periodo vacío (propuesta: «No hay facturas emitidas en ese
periodo.»), el texto descriptivo de la card, los rótulos de los dos campos de periodo, el rótulo del
botón y los mensajes de resultado y de error.

---
---

# SCRUM-325 / E4 · segunda entrega · PASO 0 del bloque E — medición, sin escribir una línea

**Medido contra:** `origin/main` = `8bc048788d04bbbe74d77b3abd629ab972f02f73` · 2026-08-10T15:11:50+02:00
**Rama:** `scrum-e4-medir` · `git diff` sobre `src/` y `prisma/` **vacío**

> Encargo: medir **entrada Y mecanismo** antes de diseñar, porque llevamos seis casos de repartir
> cosas ya construidas. **La sospecha era correcta: E4 está construido y mergeado.** Y la medición
> mueve el alcance de sitio.

---

## ① E4 ya existe, y funciona

`scrum-325-libros-por-periodo-rebasada` **está dentro de `main`**. 425 líneas vivas en
`src/modules/fiscal/librosAeat/`:

| fichero | líneas | qué hace |
|---|---|---|
| `librosAeat.ts` | 237 | columnas, mapa de estados, suelo, filtro de periodo, filas por tipo de IVA |
| `librosAeat.routes.ts` | 81 | `GET /admin/libros/expedidas.csv?año&trimestre` |
| `librosAeat.repo.ts` | 56 | resuelve `clienteId` → NIF y nombre |
| `librosAeatCsv.ts` | 51 | CSV **heredando** el formato de SCRUM-86 (no escribe un segundo) |

Montada y gateada en `app.ts:444` con `requireRole('admin')`. Año y trimestre **obligatorios**
(400 si faltan). Suelo real: `exigirLibroLegible` exige `miradas`, porque *«un periodo sin facturas
y un lector que no supo mirar producen el mismo fichero en blanco»*. Y `null` sale **celda vacía,
nunca `0,00`**.

**Queda una rama suelta de Javier** (`scrum-325-libros-por-periodo`, 1 commit, 7-ago) que **no**
está en main: es su copia pre-rebase. Comprobado que no se perdió nada — sus 12 tests están todos
en main, que tiene 15. No la toco: las ramas las borra el fundador.

---

## ② 🔴 Los 9 campos de SCRUM-324, RECONTADOS tras la migración de ayer

SCRUM-324 dejó escrito que construir E3 **no** desbloquea E4. Sigue siendo cierto — pero **la
migración del 10-ago sí lo desbloquea casi entero**, y eso hay que recontarlo, no recordarlo:

| # | Campo | Estado en SCRUM-324 (7-ago) | **Estado HOY** |
|---|---|---|---|
| 1 | Fecha | ✅ `Expense.date` | ✅ |
| 2 | Importe total | ⚠️ `amount` sin declarar qué es | ✅ ahora `baseAmount` + `vatAmount` lo declaran |
| 3 | NIF del proveedor | ❌ | ✅ **`Provider.taxId`** |
| 4 | Base imponible | ❌ | ✅ **`Expense.baseAmount`** |
| 5 | Tipo de IVA | ❌ | ✅ **`Expense.vatRate`** |
| 6 | Cuota de IVA | ❌ | ✅ **`Expense.vatAmount`** (guardada, no derivada) |
| 7 | ¿Deducible? | ❌ | ⚠️ **`Expense.vatDeducible`, pero ver ④** |
| 8 | **Razón social del proveedor** | ❌ | 🔴 **SIGUE FALTANDO** |
| 9 | Nº y serie del proveedor | ❌ | ✅ **`Expense.providerInvoiceNumber`** |

**8 de 9 desbloqueados.** El que falta es el **#8**, y está medido contra el schema: `Provider`
tiene `name` (comercial) y `taxId`, **pero no `legalName`** — mientras que `Customer` sí distingue
`name` de `legalName`. Un libro de recibidas identifica al proveedor por su **razón social**, no
por cómo lo llame el profesional en su libreta.

> Es **una** columna: `Provider.legalName String? @map("legal_name")`, calcada de `Customer`.
> Schema = dominio del fundador. No entra aquí.

---

## ③ 🔴 PERO EL BLOQUEO REAL NO ES ÉSE, Y ES MÁS GRANDE: nadie construye asientos de compra

Aunque mañana entrara `legalName`, **E4 seguiría sin poder entregar el libro de recibidas**, y el
motivo está en la frontera que el propio módulo declara en su cabecera:

> *«A6 decide QUÉ es un asiento (base, cuota, desglose por tipo, enlaces). Aquí solo se decide CÓMO
> SALE. Si algún día una cifra de aquí no cuadra con el libro, el defecto está en este fichero —
> nunca al revés, porque aquí no se suma nada.»*

Medido: A6 expone `construirLibroRegistro` / `LibroRegistro` / `AsientoLibro` **solo para
facturas emitidas**. Barrido de `src/`: **no existe** `leerLibroRecibidas`, ni `libroRecibidas`, ni
`asientoCompra`, ni nada equivalente. Las cuatro lecturas de `expense.findMany` que hay son de
gastos, informes y export — **ninguna construye un asiento**.

**Conclusión de alcance, y es la que importa:** que E4 lea `Expense` y arme los asientos sería
**que E calcule**, que es exactamente lo que el reparto prohíbe («E ENTREGA lo fiscal, A lo
CALCULA»). El libro de recibidas necesita **un ticket de A6** que lo construya, igual que
SCRUM-296 construyó el de emitidas. E4 lo formatea después.

---

## ④ Dos huecos que NINGUNA de las dos entradas menciona, y que la migración NO cubre

**(a) `vatDeducible` es un booleano, y la deducibilidad no siempre es sí/no.** El libro de
recibidas registra la **cuota deducible como IMPORTE**, no como un sí/no — y hay casos de
deducción **parcial** (el habitual, los vehículos). Con `Boolean?` solo se puede expresar «toda» o
«nada»: no cabe «la mitad». Si la respuesta es que hace falta un importe, es **otra columna**
(`vatDeducibleAmount`), no un cambio de código.

**(b) No hay número de recepción.** `providerInvoiceNumber` es el número **del proveedor**. Un
libro de recibidas numera además sus propios asientos en orden de recepción, y ese contador sería
**nuestro**. Hoy no existe.

Los dos son **preguntas de norma, no de código**, así que no los decido: van al asesor.

---

## ⑤ 🔴 Y el hallazgo que más afecta al ANCLA del bloque

El bloque E se ancla en E4 porque *«es el que cualquier despacho sabe leer y no depende del plan
contable de nadie»*. Pues bien — **eso es justo lo que nadie ha verificado**, y el propio código lo
dice desde el 7-ago:

> *«NO se llama "Libro Registro de la AEAT" en ninguna parte del código ni de la UI. Ese nombre es
> una PROMESA, y no hay en este árbol ningún documento oficial contra el que se haya contrastado el
> formato. Las columnas son las del libro de A6, ordenadas como las pide un libro de expedidas;
> declararlo conforme es una decisión del fundador, no de este fichero.»*

**Lo he comprobado y sigue siendo cierto:** barrido de `docs/` y `src/` — no hay ninguna
especificación oficial del formato, ni diseño de registro, ni cita del BOE. Las únicas
coincidencias son entradas del propio máster citándose entre ellas.

Así que las once columnas de `COLUMNAS_EXPEDIDAS` son **razonables y están bien construidas**, pero
**no están contrastadas contra nada**. Para un ancla que existe precisamente para que «cualquier
despacho lo sepa leer», eso es el eslabón flojo — y no se arregla escribiendo código.

---

## Lo que hace falta para que E4 sea el ancla de verdad, en orden

| # | Qué | Quién |
|---|---|---|
| 1 | **La especificación oficial del formato** contra la que contrastar las columnas de emitidas | asesor / fundador — **sin esto, «formato AEAT» sigue siendo una promesa** |
| 2 | ¿Cuota deducible como **importe**? ¿Hay **número de recepción**? | asesor |
| 3 | `Provider.legalName` | fundador (schema) |
| 4 | Que **A6 construya el libro de recibidas** (hermano de SCRUM-296) | carril A |
| 5 | E4 formatea recibidas y lo añade a `LIBROS_DISPONIBLES` | **este carril** |

**Los cuatro primeros no son míos.** El quinto es de una tarde, y no puede empezar antes que el
cuarto sin romper la frontera que hace fiable el módulo entero.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión (regla 38) · microcopy (regla 30) · el 303 (A5) y
los libros de A6. `git diff` sobre `src/` y `prisma/`: **vacío**. Suite de partida: 2472 tests,
0 fallos.
