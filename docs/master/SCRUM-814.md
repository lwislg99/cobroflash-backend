# SCRUM-814 · La emisión por tramos decide FUERA de la transacción — y se pierde dinero

**Fecha:** 7-sep-2026 · **Carril:** dinero (emisión de factura) · **Gate:** PASO 0, medición + decisión · **Prioridad:** Highest

**Medido contra:** `origin/main` = `af08201502a3978a484de3933132dfcdf26df790` · 2026-09-07T13:25:00+02:00
**Preámbulo:** `./node_modules/.bin/prisma generate` rc=0 · `git rev-list --count HEAD..origin/main` = **0** · `npm run build` rc=0

> ⛔ Esto es **medir y decidir**, no arreglar. No se toca `prisma/schema.prisma` ni el camino de
> emisión (regla 38). El arreglo espera al ALTER, si es que hace falta.

---

## VEREDICTO: **EL DEFECTO EXISTE**, y no es una etiqueta mal puesta: son 484 € que no se pueden facturar

---

## 1 · Dónde se cuenta y dónde empieza la transacción

`src/modules/system/app/routes/quotesAdmin.routes.ts`, `POST /admin/quotes/:id/invoice`:

| línea | qué pasa |
| :-: | --- |
| `:157` | `const quote = await prisma.quote.findFirst({ … include: { Invoice: true } })` — **la lectura** |
| `:174` | `const existingInvoices = quote.Invoice \|\| []` |
| **`:177`** | **`const stage = plan[existingInvoices.length] ?? null`** — la decisión, con el recuento de `:157` |
| `:209` | `const invoice = await prisma.$transaction(async (tx) => {` — **la transacción abre aquí** |

**32 líneas de distancia**, y dentro de la transacción **no se vuelve a contar**: sólo se pide
número (`allocateInvoiceNumber`) y se crea la fila. Envolver la creación en una transacción no
protege una decisión tomada antes de abrirla.

Los otros dos caminos con la misma forma: `jobs.routes.ts:1272` y `quotes.routes.ts:654`.

## 2 · 🔴 El control que decide, corrido — plan 30/70

```
CONTROL POSITIVO · dos peticiones SECUENCIALES:
   1ª → HTTP 201   2ª → HTTP 201
     2026-CF-001 · tramo «Anticipo» · 363 €
     2026-CF-002 · tramo «Final» · 847 €
   ¿avanza de tramo?  SÍ — 2 facturas, 2 tramos distintos ✔

🔴 DOS PETICIONES SIMULTÁNEAS al mismo presupuesto:
   A → HTTP 201 (arrancó 0 ms tras la señal)   B → HTTP 201 (arrancó 0 ms tras la señal)
     2026-CF-003 · tramo «Anticipo» · 363 €
     2026-CF-004 · tramo «Anticipo» · 363 €
   (salieron con 0 ms de desfase: la carrera es real)
   VEREDICTO: 🔴 DOS FACTURAS DEL MISMO TRAMO («Anticipo»). 3 de 3 repeticiones.

LA CONSECUENCIA · 3ª petición, la que emitiría el tramo que falta:
   → HTTP 409 · "Ya se han emitido todas las facturas de este presupuesto."
   facturado en total: 726 € sobre un presupuesto de 1210.00 €
   → 484.00 € que ya NO se pueden facturar.
```

**El plan es 30/70 a propósito.** Con dos tramos iguales las dos facturas valen lo mismo, la suma
cuadra con el total y el defecto parece una etiqueta mal puesta. Con 30/70 se ve lo que de verdad
pasa. Y las dos facturas salen **selladas** (`2026-CF-00x`, con huella VeriFactu): por la regla 29
no se editan ni se borran — sólo R1.

## 3 · 🔴 Dos correcciones a mi propio banco, y la primera casi cierra la pregunta

1. **`Promise.all` en un solo node NO es «dos peticiones simultáneas»**: comparten bucle de eventos
   y pool de conexiones. Mi primera medición dijo **«no se reproduce»**, y era falsa. Un falso
   negativo en el camino del dinero es el peor resultado posible, porque cierra la pregunta. Con
   **dos procesos** y hora de salida común se reproduce 3 de 3. El banco lleva **suelo**: si
   arrancan con más de 120 ms de diferencia, dice «NO HA HABIDO CARRERA» y **no concluye nada**.
2. **Mi control positivo dio verde con cero facturas**: `new Set([]).size === [].length` es
   `0 === 0` → «avanza de tramo ✔». Ahora exige el número (2 facturas, 2 tramos) o aborta.

---

# LA DECISIÓN — las tres preguntas, medidas

## Pregunta 1 · ¿Cómo se identifica un tramo hoy en la fila de la factura?

**Con una etiqueta de texto libre, y sólo en la mitad de los casos.** Ésta es la pregunta que
decide, y su respuesta cambia el ALTER.

```
model Invoice · única marca de tramo:
  stageLabel String? @map("stage_label")   // SCRUM-27: etiqueta del tramo, congelada al crear

grep stageIndex en src/ → sólo parámetro de función en invoiceLines.service.ts. NO hay columna.
```

Los **tres** caminos de emisión la escriben igual:

```ts
stageLabel: isCustomPlan ? stage.label : null   // quotesAdmin:221 · jobs:1272 · quotes:654
```

O sea: **en un plan preset la columna se queda a NULL**. Y es texto libre, no un índice: dos tramos
distintos pueden llamarse igual, y el mismo tramo puede renombrarse en el presupuesto.

## Pregunta 2 · ¿Cuántas filas violarían la restricción, contado ANTES de crearla?

**En el banco, tras una sola carrera: 1 grupo.** La consulta es ésta y hay que correrla en las tres
bases **antes** de proponer ningún índice — crear primero y ver si falla no es medir, es apostar:

```sql
SELECT "quoteId", stage_label, count(*) AS filas
FROM invoices WHERE "quoteId" IS NOT NULL
GROUP BY "quoteId", stage_label HAVING count(*) > 1 ORDER BY filas DESC;
```

*(Ojo al nombre: `quoteId` no lleva `@map`, así que en la base va entrecomillado; `stageLabel` sí
lleva `@map("stage_label")`.)*

**No puedo contarlo en producción desde aquí** y no me lo invento: no tengo acceso, y no voy a
pedir una cadena de conexión. Esa cuenta la tiene que dar Javier con este SQL. Lo que sí está
medido es que **el banco quedó con una violación tras una única carrera**, y en producción esas
filas serían facturas emitidas que la regla 29 no deja borrar: si hay violaciones, el `CREATE
UNIQUE INDEX` **falla**, y arreglarlas exige R1, no un `DELETE`.

## Pregunta 3 · Con el cerrojo tomado, ¿el recuento dentro de la transacción vería la otra factura?

**Sí. Medido corriendo, no deducido:**

```
A · cerrojo tomado
A · factura insertada (aún SIN commit)
B · pide el cerrojo…
A · commit
B · cerrojo tomado (A ya ha hecho commit)
B · cuenta DENTRO de la transacción: 1
```

**La razón, no la intuición:** `pg_advisory_xact_lock` es de transacción y se libera **en el
commit**, así que B no entra hasta que A ya escribió y confirmó. Y el nivel es **READ COMMITTED**
—el que fija el proyecto, declarado en `invoiceNumber.service.ts:260`—, donde **cada sentencia toma
su propia instantánea**: el `count` de B se ejecuta después de esperar, así que ve lo de A. Con
REPEATABLE READ **no lo vería** (la instantánea se toma al abrir la transacción, antes de esperar
el cerrojo), y ése es el detalle que convierte esto en frágil si alguien sube el nivel.

---

## LA DECISIÓN, y corrige tu propuesta

Pediste **las dos**. Midiendo, **A tal y como está planteada no se puede hacer**:

```
A.1 · índice único ("quoteId", stage_label):
     caso 1 · plan CUSTOM, dos facturas «Anticipo»  → RECHAZADA (P2002) ✔ el índice la para
     caso 2 · plan PRESET, dos facturas NULL        → 🔴 ENTRA — en Postgres dos NULL no chocan
```

**Un índice único sobre `(quoteId, stage_label)` no protege los planes preset**, que son los que no
escriben etiqueta. Protegería sólo los custom, y dejaría el agujero abierto justo donde la columna
está vacía — un guard que da verde por no mirar, en la base.

| | veredicto |
| --- | --- |
| **B · recontar dentro de la transacción, bajo el cerrojo que ya existe** | ✅ **funciona hoy, sin tocar esquema.** Medido: el recuento ve la factura de la otra petición |
| **A · restricción única sobre `(quoteId, stage_label)`** | ❌ **imposible como red de seguridad**: NULL en presets. Y necesitaría filas limpias para poder crearse |
| **A′ · restricción única sobre `(quoteId, stageIndex)` con una columna NUEVA** | ✔ posible, pero **es otro ALTER**: una columna `stage_index` que hoy no existe, que hay que empezar a escribir en los tres caminos, y que las facturas históricas tendrían a NULL |

**Mi recomendación, medida:** hacer **B ahora** —cierra la carrera sin ALTER, sin esperar a Javier
y sin riesgo sobre facturas emitidas— y **no pedir el ALTER de A todavía**. Si quieres el cinturón
y los tirantes, el ticket de A′ se abre aparte, porque no es «añadir un índice»: es añadir una
columna, empezar a escribirla en tres sitios y decidir qué pasa con el histórico a NULL. Meterlo en
el mismo PR convertiría un arreglo de 15 líneas en una migración con backfill.

Y una condición para B, porque es su punto débil: el recuento **debe quedar atado a un test de
carrera** —el de `evidencias/scrum814/`, con su suelo— o dentro de un año alguien vuelve a sacar la
cuenta fuera de la transacción y nada lo dice.

## El banco

- [`evidencias/scrum814/carrera-de-tramos.mjs`](evidencias/scrum814/carrera-de-tramos.mjs) —
  la carrera de dos procesos contra el handler real. Salida: [`salida.txt`](evidencias/scrum814/salida.txt)
- [`evidencias/scrum814/una-peticion.mjs`](evidencias/scrum814/una-peticion.mjs) — una petición, disparada en el instante acordado
- [`evidencias/scrum814/los-dos-caminos.mjs`](evidencias/scrum814/los-dos-caminos.mjs) —
  las tres preguntas de arriba. Salida: [`salida-los-dos-caminos.txt`](evidencias/scrum814/salida-los-dos-caminos.txt)

Los tres exigen `DATABASE_URL` **por entorno**, validada con `parseBDSegura`: sólo loopback y sólo
una base terminada en `_test`. Ninguno contiene una cadena de conexión, y no arrancan sin destino
comprobado — este banco **emite facturas**.

## Lo que NO se ha tocado

`prisma/schema.prisma` · el camino de emisión · ningún texto de microcopy. El índice de la
pregunta 2 se creó **parcial y sobre un banco desechable**, y se tiró en la misma ejecución.

---

# APÉNDICE · 7-sep-2026 · EL ARREGLO (vía ①), y la vía ② que se PARA

> Lo de arriba es el PASO 0: medir y decidir. Esto es lo que ENTRA en el PR. Nada de lo anterior
> se borra ni se corrige: se confirma. Las dos mediciones se hicieron por separado y coinciden.

**Medido contra:** `origin/main` = `eef60aa65fb74419bfbf28963179a433673509f3` · 2026-09-07 21:34:56 +0100
**Base:** `acela.proxy.rlwy.net/yaqu_dev_javier` — BASE DE PRUEBAS DEL CARRIL del worktree
`cobroflash-backend`, acreditada con `node scripts/comprobar-claves-bd.mjs` **antes** de correr nada.
**No es staging y no es producción**, que era la prohibición del encargo.

---

## 1 · Qué entra: recontar DENTRO de la transacción, bajo el cerrojo que ya existe

`src/modules/system/app/routes/quotesAdmin.routes.ts`, `POST /admin/quotes/:id/invoice`.

**El cambio de forma, que es el cambio de verdad:** el tramo deja de ser un VALOR calculado una
vez arriba y pasa a ser una FUNCIÓN del recuento (`tramoTrasEmitidas(emitidas)`). Con eso, volver
a decidir dentro de la transacción no es duplicar lógica: es llamar otra vez a lo mismo con el
recuento bueno.

```
antes                                     ahora
──────────────────────────────────────    ──────────────────────────────────────────────────
:174  existingInvoices = quote.Invoice    tramoPrevio = tramoTrasEmitidas(existing.length)
:177  stage = plan[existing.length]       (409 rápido si no hay tramo — sin abrir transacción)
:209  $transaction(tx => {                $transaction(tx => {
        allocateInvoiceNumber(tx…)          tomarCerrojoDeSerie(tx, merchantId)   ← el cerrojo
        tx.invoice.create(…)                emitidas = tx.invoice.count({quoteId, merchantId})
      })                                    tramo = tramoTrasEmitidas(emitidas)  ← la decisión
                                            if (!tramo) return null              ← 409, sin número
                                            allocateInvoiceNumber(tx…)
                                            tx.invoice.create(…)
                                          })
```

### 🔴 NO ES UN CERROJO NUEVO, y no se ha tocado el que hay

`tomarCerrojoDeSerie` **ya existe** (`src/modules/jobs/domain/albaranIdempotencia.ts:114`, SCRUM-358)
y es literalmente `pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` — el mismo namespace `1749` que
toma `allocateInvoiceNumber`. Tomarlo dos veces en la misma transacción es inocuo: es re-entrante y
se libera al commit. `allocateInvoiceNumber` y `@@unique([merchantId, number])` quedan **intactos**.

La casa ya tenía escrita esta lección, aplicada al alta de albarán, y se ha reusado en vez de
escribir una segunda: *«la pregunta va DENTRO del cerrojo, y ANTES de reservar el número: si se
reservara primero y luego se descubriera que no procede, ese número quedaría consumido y sin
documento — un HUECO EN LA SERIE»*.

### Por qué el recuento va ANTES de pedir número, y no después

Contar **después** también cerraría la carrera, pero para rechazar habría que deshacer un número ya
reservado. Contando **antes**, la salida por `return null` cierra una transacción que **no ha escrito
ni una fila** (dos sentencias de sólo lectura: el cerrojo y el `count`). No hay nada que deshacer y
no hay hueco que justificar ante Hacienda.

### La carrera perdida NO inventa microcopy

Quien pierde la carrera y se encuentra el plan agotado recibe **el mismo 409 de siempre**:
`motivoSinTramo(plan)` → `no_more_invoices_for_payment_terms` + *«Ya se han emitido todas las
facturas de este presupuesto.»* (SCRUM-151). **No se ha redactado ninguna frase nueva** (regla 30),
ni hay estado ni flag nuevo, ni dependencia nueva.

---

## 2 · 🔴 LOS DOS SENTIDOS, CORRIDOS · `tests/scrum814-carrera-del-tramo.gated.test.mjs`

Mismo banco, misma base, mismo comando. Lo único que cambia entre las dos tandas es el fuente de
la ruta, y se acredita por sha256 para que no haya duda de qué se corrió:

| | sha256 de `quotesAdmin.routes.ts` |
| --- | --- |
| mecanismo VIEJO (el de `origin/main`) | `cd03c6de347080dedb1d684aa5d677d807e6fe83aa2f4119ff8da233231f7b78` |
| con el arreglo | `339bbfce91b63534a08826bbd0684fad75abda3a83073959b2d014a3e6afc108` |

```
🔴 ROJO · mecanismo VIEJO · exit 1 · pass 1 · fail 2

  ✖ dos peticiones simultáneas NO pueden emitir el MISMO tramo
    ℹ desfase de salida: 1 ms · A → 201 · B → 201
      actual   ['Anticipo', 'Anticipo']        ← DOS FACTURAS DEL MISMO TRAMO
      expected ['Anticipo', 'Final']
      números: J-20260907-6XZL, J-20260907-VJRA   ← distintos: el cerrojo de serie SÍ funciona

  ✖ plan 30/70: lo facturable NO puede quedar por debajo del presupuesto
    ℹ desfase de salida: 0 ms · A → 201 · B → 201
      actual   ['Anticipo 363.00', 'Anticipo 363.00']   ← 726 € de 1210 €
      expected ['Anticipo 363.00', 'Final 847.00']

  ✔ dos peticiones SECUENCIALES siguen emitiendo «Anticipo» y luego «Final»
```

```
✅ VERDE · con el arreglo · exit 0 · pass 3 · fail 0

  ✔ dos peticiones simultáneas NO pueden emitir el MISMO tramo
    ℹ desfase de salida: 0 ms · A → 201 · B → 201
    ℹ tramos emitidos: Anticipo + Final · números J-20260907-9IOY, J-20260907-NBRB

  ✔ plan 30/70: lo facturable NO puede quedar por debajo del presupuesto
    ℹ desfase de salida: 0 ms · A → 201 · B → 201
    ℹ facturado 1210.00 € de 1210.00 € · tercera → 409 no_more_invoices_for_payment_terms

  ✔ dos peticiones SECUENCIALES siguen emitiendo «Anticipo» y luego «Final»
    ℹ secuencial: Anticipo 605 → Final 605
```

**Las dos peticiones siguen saliendo con 201.** Cerrar la carrera no convierte una emisión legítima
en un error: la que llega segunda emite el tramo que de verdad toca.

### El suelo del banco, y por qué está ahí

- **Dos PROCESOS, no dos promesas.** `Promise.all` en un solo node comparte bucle y agente HTTP.
  El cliente vive en `tests/fixtures/scrum814-peticion-simultanea.mjs` y su única cita con el otro
  es el reloj.
- **La hora de salida se COMPRUEBA**: por encima de **120 ms** de desfase el test **falla**
  diciendo que no se concluye nada. Medido: 0–1 ms en las cuatro tandas.
- **Y se exige que los dos hijos estuvieran listos ANTES de la hora de salida.** Un hijo que
  arranca tarde no corrió ninguna carrera.
- **El positivo se exige POR EL NÚMERO**: `assert.equal(facturas.length, 2)` y luego los tramos y
  los importes uno a uno. Nunca `new Set(x).size === x.length`, que sobre el vacío es `0 === 0`.
- **El negativo sigue en pie**: la tercera petición contesta 409 con su código y su texto, y no
  crea nada. El texto se **importa** de `motivoSinTramo`, no se copia.

### Límite declarado del banco

Los documentos que emite son **justificantes `J-`**, no facturas fiscales: el merchant del fixture
es ES con NIF pero **sin** `INVOICING_ES_ENABLED` (regla 24), que es el estado real de hoy. La
carrera vive en la **decisión del tramo**, que es anterior a la bifurcación fiscal/justificante y
se ejercita igual; lo que este banco **no** ejercita es la cadena VeriFactu. La medición de PASO 0
(arriba) sí llegó a `2026-CF-00x` sellados, sobre un Postgres desechable local.

### Lo que este banco añade a lo que ya había

`docs/master/evidencias/scrum814/*.mjs` **no lo ejecuta nadie**: no lo referencian ni `tests/` ni
`package.json` (comprobado). Era la condición que pedía la decisión de arriba — *«el recuento debe
quedar atado a un test de carrera o dentro de un año alguien vuelve a sacar la cuenta fuera de la
transacción y nada lo dice»*. Ahora está **dentro de la tanda**, gateado como el resto de los que
piden base, y declarando su motivo de salto.

---

## 3 · ⛔ VÍA ② · LA RESTRICCIÓN ÚNICA: SE PARA Y SE DESCRIBE

La obligación era medir **si el tramo ya es representable como columna antes de escribir nada**.
Medido, y **no lo es**:

| | |
| --- | --- |
| `Invoice.stageLabel` (`stage_label`, `String?`) | única marca de tramo. **Se escribe SÓLO en planes custom**: los tres caminos hacen `stageLabel: isCustomPlan ? stage.label : null` |
| índice de tramo (ordinal) | **no existe columna**. `stageIndex` en `src/` es sólo un parámetro de función |
| índices de `invoices` | únicamente `@@unique([merchantId, number])`. Ninguno sobre `quoteId` |

Y por eso `UNIQUE (quoteId, stage_label)` **no vale como red de seguridad**: en un plan **preset**
las dos filas llevan `NULL`, y en PostgreSQL **dos NULL no chocan**. Protegería los custom y dejaría
el agujero abierto justo donde la columna está vacía — un guard que da verde por no mirar, en la base.

**Hace falta una columna NUEVA, así que aquí se para.** `prisma/schema.prisma` es del fundador y no
se inventa ni el nombre ni el tipo. Lo que sí se puede dejar dicho es **qué tiene que cumplir** y
**qué hay que decidir**, que es lo que convierte esto en un ticket y no en una idea:

1. **Qué guarda:** el ORDINAL del tramo dentro del plan del presupuesto — el `stage.index` que ya
   viaja por los tres caminos de emisión. No la etiqueta: la etiqueta es texto libre, se puede
   repetir entre tramos y se puede renombrar en el presupuesto.
2. **Quién la escribe:** los TRES caminos que emiten por tramo, o la restricción no cubre a los
   otros dos (§4). Empezar a escribirla es **tocar el camino de emisión** → GO del fundador.
3. **La restricción:** unicidad sobre `(quoteId, esa columna)`, y **decidir si es parcial**
   (`WHERE quoteId IS NOT NULL AND <col> IS NOT NULL`) para no atrapar al histórico.
4. **El histórico:** todas las facturas ya emitidas quedarían a NULL. No se rellenan por inferencia
   —de un `stageLabel` vacío no sale un ordinal— y **no se editan** (regla 29).
5. **Antes de crear el índice, contar las violaciones en las TRES bases.** Con el SQL que ya deja
   escrito la sección «Pregunta 2» de arriba. Si hay violaciones, el `CREATE UNIQUE INDEX`
   **falla**, y limpiarlas exige R1, nunca `DELETE`.

**Por qué las dos vías y no una:** la ① sola depende de que nadie vuelva a sacar la cuenta fuera de
la transacción — que es exactamente el defecto de hoy. Lo que hoy la sostiene es el test de §2, que
sí está dentro de la tanda. La ② sola no llega hasta que el fundador aplique la migración.

---

## 4 · Hallazgos de OTRO alcance (regla 37): la misma forma, en dos caminos más

Se **reportan y no se arreglan**: son otras rutas y otros carriles, y uno de ellos es superficie
pública. Confirman el censo que ya hizo el PASO 0.

| camino | fichero | qué hace igual |
| --- | --- | --- |
| **C1** · el cliente final acepta el presupuesto | `src/modules/quotes/app/routes/quotes.routes.ts:583` | `plan[existingInvoices.length]` decidido fuera de la transacción, que abre en `:639` |
| **C2** · «cobrar el resto» desde el Trabajo | `src/modules/jobs/app/routes/jobs.routes.ts:1243` | `plan[emitted]`, con `emitted` leído en `:1228`; la transacción abre en `:1263` |

Además, `POST /admin/quotes/:id/invoice-manual` (`quotesAdmin.routes.ts:441`, `:376` en `main`) comprueba
`existingInvoices.length > 0` con la misma lectura previa: dos altas manuales simultáneas verían
las dos un cero. Es la misma familia, y la vía ② las cubriría a las tres de golpe — que es
precisamente el argumento a favor de que lo diga la base.

## 5 · Coste dentro de la sección crítica (SCRUM-728)

El arreglo mete **una sentencia más** bajo el cerrojo: un `count` sobre `invoices` filtrando
`(quoteId, merchantId)`. No hay índice sobre `quoteId`, pero el `@@unique([merchantId, number])`
da prefijo por `merchantId`, así que el coste va acotado por las facturas **de ese merchant**, no
por la tabla. La ruta ya hacía esa misma lectura fuera de la transacción (`include: { Invoice: true }`).
No se ha fijado `timeout` ni `maxWait` en ninguna transacción (③ de SCRUM-728 sigue en cero).

## 6 · Lo que NO se ha tocado

`prisma/schema.prisma` · `allocateInvoiceNumber` y su cerrojo · `@@unique([merchantId, number])` ·
las facturas ya emitidas · los caminos C1 y C2 · ningún estado, flag, texto o dependencia nueva ·
producción y staging (todo contra la base de pruebas del carril, acreditada antes de correr).
