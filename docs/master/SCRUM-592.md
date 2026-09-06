# SCRUM-592 · DOC-02 · Numeración correlativa con serie anual — presupuestos y albaranes

**Fecha:** 4-sep-2026 · **Carril:** documentos · **Gate:** el de concurrencia con `QA_DB_TEST=1`; el resto en `npm test`

**Medido contra:** `origin/main` = `c9cf435b20287ad7a0dc02a3a17d3fe182dfa372` · 2026-09-04T15:15:57Z

**Tanda:** 5159 tests, 5071 pass, 0 fail, 88 skipped — medida DESPUES del ultimo cambio, entrada incluida.

---

## La víctima

Los presupuestos de un profesional salían `#26`, `#28`, `#32`: con saltos y sin serie. Cuando su
cliente le preguntaba por «el presupuesto 32», él no podía decir de cuántos era ni de qué año.

**Y no era una impresión.** Medido en `yaqu_dev_javier`: el merchant 1 tenía `[1, 13, 14, 15, 16]`
— **faltaban del 2 al 12**.

---

## PASO 0

**ENTRADA.** El número lo ve el profesional en el panel y el cliente en tres sitios: impreso en el
PDF (`Nº {number}`), en la plantilla de WhatsApp y en los avisos internos.

**MECANISMO — 🔴 ya existía entero, y eso redefinió el trabajo.**

| pieza | qué garantizaba ya |
|---|---|
| `quoteNumber.service.ts` | `{ increment: 1 }` atómico dentro de la transacción |
| `albaranNumber.service.ts` | `pg_advisory_xact_lock` (SCRUM-234) **y serie anual funcionando** |
| `invoiceNumber.service.ts` | serie anual + `nextRectInvoiceNumber` — **rectificativas ya previstas** |

Lo que faltaba no era el contador: era **la serie anual del presupuesto y el formato**. `Merchant`
ya tenía `albaranSeriesYear`; no tenía `quoteSeriesYear`. Ésa es la única columna nueva.

---

## 🔴 Lo que de verdad cambia: el `increment` deja de bastar

Ese increment es atómico y bastaba mientras el contador **sólo subía**. Con reinicio anual hay que
**leer** el año y **decidir** si el siguiente es `nextQuoteNumber` o `1` — un read-then-write que
en READ COMMITTED **no serializa**: dos creaciones simultáneas del primer presupuesto del año
leerían las dos «serie vacía» y escribirían las dos el 1.

No es una hipótesis mía: es lo que `allocateAlbaranNumber` dejó escrito al cerrar SCRUM-234,
*«también tiene reinicio anual, así que también va con cerrojo y no con `{ increment: 1 }`»*. Se
sigue esa decisión en vez de inventar otra: mismo `pg_advisory_xact_lock`, mismo `SERIE_LOCK_NS`.

**Probado con diez reservas simultáneas contra Postgres: `[1..10]`, ni un duplicado ni un salto.**

---

## P-DOC-7 · Los existentes se renumeran

Decidido por el fundador el 4-sep-2026. Ni el presupuesto ni el albarán son documentos fiscales,
así que hay libertad, y la elección es **una sola numeración, no dos formatos conviviendo**.

**Lo que hizo posible decidirlo es la medición del censo 2:**

- el número está **impreso** dentro del PDF y en el **nombre del fichero** generado;
- **viaja al cliente** como variable de la plantilla de WhatsApp;
- 🔴 **pero los enlaces van por `id`, no por número — 4 de 4 medidos.**

> **Ningún PDF deja de abrirse.** El daño posible es de **BÚSQUEDA** —el cliente dice «el #16» y el
> profesional no lo encuentra—, y eso es reversible. Romper un enlace no lo sería. Ésa es la
> diferencia sobre la que se apoya toda esta decisión.

**El orden es por FECHA DE CREACIÓN, no por id**, y no es lo mismo: medido en dev, los dos órdenes
**difieren**. El id es un contador global de la plataforma y puede no seguir el orden en que ese
profesional creó sus documentos.

**Aplicado en desarrollo:** `[1, 13, 14, 15, 16]` → `[1, 2, 3, 4, 5]`. Y **ejecutado dos veces**:
la segunda pasada cambia **0**. Staging y producción esperan a que producción vuelva a desplegar.

**Producción no se ha tocado ni nombrado.** Su medición queda escrita en
`docs/sql/scrum-592-medicion-produccion.sql`, sólo lectura, para que la corra el fundador — y
**verificada ejecutándola contra desarrollo**, porque escribí mal los nombres de columna a la
primera (`quotes` usa `merchantId` y `albaranes` usa `merchant_id`) y un fichero que falla en
producción no es una entrega.

---

## El `@@unique` que falta, y por qué NO va aquí

`Invoice` y `Albaran` llevan `@@unique` sobre su número; **`Quote` no lleva ninguna**. La
correlatividad del presupuesto vive **sólo en el código**: un `INSERT` a mano o un segundo camino
duplicaría sin que nada lo impida.

Va como ticket propio de los dos fundadores, y **el orden importa**: primero se renumera, después
se añade la restricción. Al revés, puede fallar sobre datos que hoy duplican — y «ningún duplicado
en dev» no es producción.

🔴 **Este código no depende de que esa restricción exista.** El cerrojo es la garantía; el
`unique` sería la red. Cuando llegue, aquí no hay que tocar nada. Y mientras, un guard vigila que
**sólo un fichero escriba el contador**.

---

## La factura: medida, no tocada

Formato actual `2026-CF-001`, con **prefijo por merchant** (`invoiceSeriesPrefix`), que es un campo
real y configurable: migrarla a `F260001` **lo perdería**. Su numeración es camino de emisión, y
mientras exista el justificante —definido «sin numeración de factura»— no puede llevar un número
con formato de factura. **No se toca hasta que se resuelva ese expediente.**

---

## Evidencia

- **Concurrencia:** 2 y 10 reservas simultáneas → correlativas, sin duplicados ni saltos.
- **Reinicio anual:** con la fecha **fijada**, en la pieza pura y **contra la base** — `P260001`
  el 31-dic y `P270001` el 1-ene, con el contador quedando en la serie de 2027.
- **Idempotencia:** probada en la pieza pura **y ejecutada dos veces contra la base**.
- **Control negativo:** crear un cliente no mueve ningún contador (probado contra la base), y un
  censo por árbol exige que **sólo `quoteNumber.service.ts`** escriba el contador.
- **Suelo:** en el censo de documentos, en el de ficheros y en el formateador.

---

## 🔴 Hallazgo: el cerrojo serializa, y eso tiene un coste medible

El test de diez simultáneas falló la primera vez, y **no por una carrera**: el cerrojo hace que las
diez esperen en fila, así que la décima acumula diez veces la latencia. Contra la base remota de
desarrollo eso son **~5.200 ms**, y Prisma cierra la transacción a los 5.000 por defecto.

No es un defecto de este ticket —**albaranes y facturas tienen el mismo patrón desde SCRUM-234**—
pero está medido y se dice: con una base lejana, una ráfaga de creaciones del mismo merchant puede
agotar el timeout por defecto. En el test se subió el margen **para que midiera la carrera y no la
latencia**; dejarlo en 5.000 habría dado un rojo que dice «duplicado» cuando lo que hay es «lento».

---

## Lo que NO se hizo

- **No se tocó la numeración de facturas** ni ningún camino de emisión.
- **No se aplicó el ALTER** en staging ni en producción.
- **No se renumeró** staging ni producción.
- **No se añadió el `@@unique`**, por el orden explicado.

---

# APÉNDICE (6-sep-2026) · DOC-02, la mitad que falta: la FACTURA — medición y propuesta, SIN código

**Fecha:** 6-sep-2026 · **Carril:** documentos / fiscal · **Gate:** el de concurrencia con `QA_DB_TEST=1`

**Medido contra:** `origin/main` = `16bd95731883a6c84ceb57820a493c8fe1500f6d` · 2026-09-06T08:48:11+01:00

> **Esta entrada no lleva código de producto.** El trabajo que falta cae **dentro del camino de
> emisión** (`src/modules/invoicing/`), que es STOP. Se trae el diff medido y se para.

---

## PASO 0 · ¿ESTÁ HECHO YA?

**SÍ, salvo la factura.** SCRUM-592 se mergeó el 4-sep-2026 (PR #1017, commit `271e461f`) y cubre
presupuestos y albaranes. **No me he fiado del documento: lo he ejecutado.**

| requisito del encargo | hoy | cómo se midió |
|---|---|---|
| `P260001` | ✅ `P260001` | `formatoNumeroDocumento(SERIES.presupuesto, 2026, 1)` ejecutado |
| `AB260001` | ✅ `AB260001` / `AB270001` | `formatAlbaranNumber(2026,1)` y `(2027,1)` ejecutados |
| **`F260001`** | ❌ **`2026-CF-001`** | `formatInvoiceNumber('CF',2026,1,false)` ejecutado |
| Rectificativa en serie propia | ✅ `2026-CF-R-003` | ejecutado; ver abajo |
| Correlatividad · sin duplicar · sin saltar | ✅ **probado contra Postgres real** | 4 tests gateados, ver abajo |
| Reinicio anual limpio | ✅ presupuesto y factura | contra la base y ejecutado |
| Justificante sin formato de factura | ✅ `J-20260906-UK5S` | ejecutado con el flag OFF |
| Migración P-DOC-7 (presupuestos) | ✅ **decidida y ejecutada en dev** | máster de 592 + medición de hoy |

---

## 🔴 TRES DATOS DEL ENCARGO QUE HOY YA NO SON CIERTOS

No es una corrección de estilo: si se construye contra ellos, se construye contra un árbol que no
existe.

**1 · «Hoy los presupuestos salen numerados #26, #28, #32».** Falso desde el 4-sep. Medido hoy en
`yaqu_dev_javier`, **sólo lectura**:

```
PRESUPUESTOS  total: 15
  merchant 1: 12 · P260001 … P260012 · HUECOS: (ninguno)
  merchant 2:  3 · P260001 … P260003 · HUECOS: (ninguno)
```

Los `[1, 13, 14, 15, 16]` con los que nació el ticket ya se renumeraron.

**2 · «Albarán → hoy: ALB-2026-006».** En dev **no hay ni un albarán** (total: 0). Y el generador
emite `AB260001` desde el 4-sep; `esAlbaranRenumerado` reconoce el formato viejo para los que
pudiera haber en otras bases.

**3 · «Rectificativa POR DECIDIR — no existe».** **Existe, y con serie propia.** Ejecutado:

```
número rectificativa   = 2026-CF-R-003
contadores movidos     = [{"invoiceSeriesYear":2026,"nextRectInvoiceNumber":4}]
→ nextInvoiceNumber INTACTO = 8   (la R no gasta número de F)
R1 con el flag OFF     = RECHAZADA (invoicing_es_disabled)
```

Tiene **contador propio** (`nextRectInvoiceNumber`), **reinicio anual propio**, y está **prohibida
en modo justificante** — una R1 sólo rectifica una factura emitida (regla 29). Lo que sigue sin
decidirse no es si existe: es **qué letra le tocaría** si la factura pasara a `[LETRA][AA][NNNN]`.

**4 · Y uno que SÍ era cierto, confirmado:** «hoy un merchant español real está en modo
justificante». Medido ejecutando `getEmissionMode` sobre las filas de dev — **son cinco**:

```
INVOICING_ES_ENABLED por defecto = false
  #1   ES demo=true  → modo = demo
  #2   ES demo=false → modo = receipt
  #114 ES demo=false → modo = receipt
  #173 ES demo=false → modo = receipt
  #210 ES demo=false → modo = receipt
  #742 ES demo=false → modo = receipt
```

---

## LO QUE SÍ HE PROBADO YO, NO HEREDADO

**Concurrencia REAL contra Postgres** (`QA_DB_TEST=1`, sólo este fichero — **no** la tanda gateada,
que toma el turno de staging). El propio test se niega a arrancar si la clave no apunta a
`yaqu_dev_javier`:

```
ok 1 - SCRUM-592 · 🔴 DOS reservas SIMULTÁNEAS no cogen el mismo número
ok 2 - SCRUM-592 · 🔴 y con DIEZ a la vez tampoco: ni un duplicado ni un salto
ok 3 - SCRUM-592 · el reinicio anual, CONTRA LA BASE y con la fecha fijada
ok 4 - SCRUM-592 · 🔴 CONTROL NEGATIVO: crear un CLIENTE no mueve ningún contador
# tests 4 · pass 4 · fail 0 · skipped 0 · exit 0
```

**El justificante, con el flag OFF, por el camino real** (`allocateInvoiceNumber`, BD doblada):

```
número                                = J-20260906-UK5S
¿es justificante (J-)?                = true
¿lo reconoce el formato nuevo (P/AB)? = null
¿empieza por F + 2 dígitos?           = false
contadores movidos                    = []          ← ninguno
nextInvoiceNumber tras esto           = 1
```

✅ **Control positivo del mismo instrumento:** el MISMO merchant con el flag ON sí saca serie
fiscal (`2026-CF-001`) y sí mueve el contador. Sin eso, el `[]` de arriba no distinguiría «no
mueve nada» de «mi doble no registra nada».

**Y ese invariante ya tiene guard**, no depende de esta medición: SCRUM-81 (5 casos) y SCRUM-396
(«emitir un justificante NO avanza ningún contador de la serie fiscal») — **25 tests, 25 en verde**.

---

## 🔴 POR QUÉ PARO: EL TRABAJO QUE FALTA ESTÁ DENTRO DEL CAMINO DE EMISIÓN

El formato de la factura lo compone **una sola función**, y vive dentro de `invoicing/`:

`src/modules/invoicing/domain/invoiceNumber.service.ts:183`

```ts
export function formatInvoiceNumber(prefix, year, seq, rectifying = false) {
  const p = ...;
  return `${year}-${p}${rectifying ? '-R' : ''}-${String(seq).padStart(3, '0')}`;
}
```

Medí si había colocación fuera: **no la hay.** Se puede añadir la letra al módulo compartido
—`src/core/documentos/formatoNumero.ts`, que está fuera—, pero **usarla exige editar
`formatInvoiceNumber`**, y eso es modificar el camino de emisión. Diff preparado, no aplicado:

```diff
--- src/core/documentos/formatoNumero.ts        (FUERA de invoicing/ — se podría hacer)
 export const SERIES = {
   presupuesto: 'P',
   albaran: 'AB',
+  factura: 'F',
+  rectificativa: 'R',      // ⚠️ la letra de la R es LA DECISIÓN ABIERTA
 } as const;

--- src/modules/invoicing/domain/invoiceNumber.service.ts   ⛔ STOP — camino de emisión
 export function formatInvoiceNumber(prefix, year, seq, rectifying = false) {
-  const p = ...;
-  return `${year}-${p}${rectifying ? '-R' : ''}-${String(seq).padStart(3, '0')}`;
+  return formatoNumeroDocumento(
+    rectifying ? SERIES.rectificativa : SERIES.factura, year, seq,
+  );
 }
```

**Buena noticia medida:** el resto del árbol **no se rompe**, y no por suerte. `huecosSerie.ts`
(SCRUM-291) dejó escrito que **no parsea el número: lo COMPONE** con `formatInvoiceNumber`, «la
MISMA función que los compuso al emitirlos… si mañana cambia el formato, cambia en un sitio y esto
lo sigue solo». Ese cambio de una línea **es** el cambio de formato entero.

---

## 🔴 EL COSTE REAL, MEDIDO: `F260001` BORRA UNA FUNCIÓN QUE EL PROFESIONAL USA

`Merchant.invoiceSeriesPrefix` **no es un detalle interno**. Tiene superficie en cinco sitios de
`src/` y **tres del navegador**:

```
src/app.ts · src/core/validation/schemas.ts · src/modules/system/merchantAdmin.ts
src/modules/invoicing/domain/invoiceNumber.service.ts
public/admin.html · public/dashboard/js/settingsView.js · public/dashboard/js/settingsSubmenus.js
```

Es **un campo que el profesional configura en Configuración**. Y en dev **2 de 6 merchants tienen
un prefijo propio** (`FG`, `QA`); los otros cuatro el de fábrica (`CF`).

Peor: **SCRUM-291 construyó un mecanismo entero para protegerlo** — `bloqueoCambioDeSerie` impide
cambiar el prefijo cuando ya hay facturas emitidas, porque cambiarlo rompe la correlatividad que la
AEAT exige dentro de una serie. Adoptar `F260001` deja ese mecanismo **vigilando un campo que ya no
decide nada**: una prohibición sin objeto.

---

## 🔴 Y LA REGLA 29 **FUERZA** LA CONVIVENCIA — aquí no hay elección

Con presupuestos y albaranes hubo libertad porque **no son documentos fiscales** y se pudo
renumerar. **Con las facturas no.** Medido en dev:

```
FACTURAS  total: 5 → 2026-FG-001[F1] … 2026-FG-005[F1]   justificantes (J-): 0
```

Son **facturas emitidas**. No se editan, no se borran y **no se renumeran jamás**. O sea que
`F260001` **no puede ser una renumeración**: sólo puede ser un **corte**, y los dos formatos van a
convivir sí o sí.

⚠️ Y hay un efecto medible: `huecosDeLaSerie` compone con el prefijo ACTUAL, así que una factura
emitida con el formato viejo saldría reportada como **`ajenos`** — que es justo la categoría que
SCRUM-291 inventó para esto. No es un fallo: es el aviso funcionando. Pero hay que saber que el
panel de huecos enseñará cinco `ajenos` desde el día del corte.

---

## LA PROPUESTA — y NO decido: esto es del fundador

**Las tres opciones, con su coste medido:**

| | qué es | coste | pega |
|---|---|---|---|
| **A** · corte por AÑO | `F270001` desde 1-ene-2027; 2026 se queda en `2026-FG-00x` | 1 línea + la letra | el corte es limpio y **coincide con el reinicio anual que ya existe**; hay que decidir la letra de la R |
| **B** · corte por FECHA | `F26xxxx` desde el día D | igual + una fecha en el código | parte la serie **dentro** del mismo año fiscal: dos formatos en el mismo ejercicio |
| **C** · no tocar la factura | se queda `2026-CF-001` | cero | el encargo no se cumple, pero **el prefijo del profesional sobrevive** |

🔴 **Recomendación (no decisión): A, y sólo si se acepta perder el prefijo por merchant.** El corte
por año es el único que no parte un ejercicio, y encaja con el reinicio anual que ya funciona y
está probado contra la base. **B** mete dos formatos en el mismo ejercicio, que es exactamente el
riesgo que hizo descartar el reinicio mensual el 24-ago.

**Y hay una pregunta previa que no es mía:** el máster define el justificante «sin numeración de
factura», y **cinco merchants ES reales están hoy en ese modo**. Mientras eso siga así, el formato
`F` sólo lo verían el demo y los no-ES. **Adoptarlo ahora cambia la numeración de casi nadie y
borra una función de todos.** Ése es el expediente que SCRUM-592 dejó abierto, y sigue abierto.

### La letra de la rectificativa

Hoy es `2026-CF-**R**-001` — la `R` ya existe como marca dentro del número. Si se adopta
`[LETRA][AA][NNNN]`, hay dos formas y **ninguna es obvia**:

- `R260001` — serie propia de primer nivel, coherente con `P`/`AB`. Pero **pierde el vínculo
  visual** con la factura que rectifica.
- `FR260001` — dos letras, como `AB`. El parser ya ordena las letras **de más larga a más corta**
  precisamente para que `AB` no le robe el prefijo a una serie de una letra, así que **soportarlo
  no cuesta nada**: ya está previsto en el código, no en un comentario.

**No la elijo.** Lo que sí digo, medido: el módulo compartido **ya tolera series de dos letras**, y
el contador y el reinicio anual de la R **ya existen**. Lo único que falta es la letra.

---

## OTRO HUECO MEDIDO, Y SU PRECONDICIÓN YA SE CUMPLE

`Quote` **no tiene `@@unique`** sobre su número. Medido en `prisma/schema.prisma`:

| modelo | red de la base |
|---|---|
| `Albaran` | ✅ `@@unique([merchantId, numero])` |
| `Invoice` | ✅ `@@unique([merchantId, number])` |
| **`Quote`** | ❌ **ninguna** — sólo lo sostiene el `pg_advisory_xact_lock` |

El máster de 592 lo dejó escrito: *«primero se renumera, después se añade — al revés puede fallar
sobre datos que hoy duplican»*. **Esa precondición ya se cumple en dev**: los 15 presupuestos están
renumerados, sin huecos y **sin duplicados** (merchant 1: 1..12; merchant 2: 1..3).

Así que se puede proponer — pero **`prisma/schema.prisma` es del fundador**, así que va como diff y
paro:

```diff
 model Quote {
   quoteNumber Int? @map("quote_number")
+  @@unique([merchantId, quoteNumber])
 }
```

⚠️ **Antes de aplicarlo hay que medir producción**, y yo no la toco. Ya existe el fichero de
lectura `docs/sql/scrum-592-medicion-produccion.sql`, que dejó escrito el propio ticket.

---

## HUECOS DECLARADOS

- **No he medido staging ni producción.** Ni una consulta. Todo lo de aquí es `yaqu_dev_javier`,
  **sólo lectura**, con el guard por DESTINO que se niega a arrancar contra otra base.
- **No he renumerado nada** ni he aplicado ningún ALTER.
- **La concurrencia de la FACTURA no la he provocado.** Sólo la del presupuesto, que es la que
  tiene test gateado. El generador de facturas usa el mismo `pg_advisory_xact_lock` y el mismo
  `SERIE_LOCK_NS` —leído, no supuesto—, pero **eso es una inferencia, no una medición**: no hay un
  test que ponga diez emisiones de factura a competir. Lo digo en vez de darlo por bueno.
- **El coste del cerrojo sigue vigente** y no es de este ticket: SCRUM-592 midió que diez reservas
  en fila contra la base remota rozan los ~5.200 ms, por encima del timeout de 5.000 de Prisma. Con
  facturas pasaría lo mismo.
- **No he tocado la letra de la rectificativa**, ni la he elegido.
- **`invoiceSeriesPrefix` seguiría existiendo en la BD y en Configuración** aunque se adopte `F`:
  retirarlo de la pantalla es microcopy y superficie, y va aparte.
