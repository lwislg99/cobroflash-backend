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
---

# 7-sep-2026 · EL ARREGLO — camino B, y lo que se llevó por delante

**Medido contra:** `origin/main` = `3a487daaac1654ba0d03cdae3b6e91cb31221b83` (mezclado dentro de la rama, AA2)
**Preámbulo:** `prisma generate` rc=0 · `HEAD..origin/main` = 0 · **`npm run build` rc=0**

> Decisión del fundador sobre la medición de arriba: **B ahora, A no se pide, A′ ticket aparte.**
> `prisma/schema.prisma` NO se toca. El cerrojo de serie de SCRUM-728 y `@@unique([merchantId,
> number])` NO se tocan: funcionan y no eran el problema.

## 1 · El cambio, en una frase

El recuento de tramos ya emitidos pasa **dentro de la transacción**, después de tomar el
`pg_advisory_xact_lock(SERIE_LOCK_NS, merchantId)` que ya existía y **antes** de pedir número. Si
lo que encuentra no coincide con lo que esta petición preparó, la transacción se deshace entera y
la ruta contesta **409 `stage_taken_concurrently`**.

- El cerrojo se toma **antes** de pedir número por la misma razón que SCRUM-246 y SCRUM-771: las
  comprobaciones van antes de consumir un número de la serie. Que el rollback también lo devuelva
  es un detalle del motor; el orden se lee.
- `SERIE_LOCK_NS` se **importa**, no se copia. Dos sitios que sepan el número del cerrojo acaban
  sabiendo números distintos.
- **Se aborta, no se recalcula.** Recalcular el tramo ahí dentro obligaría a meter
  `stageLinesReconciled`, `exigirLineasFacturables` y `exigirTiposDeIvaEmitibles` en la
  transacción: medio camino de emisión movido para arreglar una carrera. Quien pierde, reintenta
  y recibe el tramo siguiente.
- Código **propio** para el 409, distinto de `no_more_invoices_for_payment_terms`: uno dice
  «vuelve a pedirlo» y el otro «no queda nada». Un solo código obligaría a parsear el texto.

## 2 · La verificación

| control | resultado |
| --- | --- |
| 🔴 **rojo con el mecanismo viejo** | quitando el recuento: `RONDA 1: DOS FACTURAS DEL MISMO TRAMO ["Anticipo","Anticipo"]`. El positivo y el negativo **siguen verdes** en ese rojo: el test discrimina |
| 🔴 **3 carreras seguidas** | ninguna emite dos veces el mismo tramo. Una gana con 201, la otra pierde con `stage_taken_concurrently` |
| 🔴 **suelo de carrera** | si arrancan con >120 ms de diferencia el test **falla declarándose ciego**; en las corridas buenas, 0-27 ms |
| ✅ **positivo** | dos secuenciales → «Anticipo» 363 € y «Final» 847 €, exigiendo el **número** (2 facturas, 2 tramos), no longitudes que pueden ser `0 === 0` |
| ✅ **negativo** | el 409 `no_more_invoices_for_payment_terms` sigue saliendo cuando de verdad están todas |
| ✅ **dinero** | tras la carrera, reintentando: 363 + 847 = **1210 €**. Antes se quedaban 484 € sin poder facturarse |

**Y el recuento queda ATADO**, que era mi propia condición al recomendar B:

- `tests/scrum814-carrera-de-tramos-postgres.test.mjs` — la carrera real, con banco, y **lanza el
  mismo `docs/master/evidencias/scrum814/una-peticion.mjs`** que produjo la evidencia del defecto.
- `tests/scrum814-recuento-dentro.test.mjs` — **sin gate, corre siempre en `npm test`**, por AST:
  vigila que el recuento siga dentro de la transacción, que el cerrojo se tome antes, que
  `SERIE_LOCK_NS` se importe y que el test con banco siga existiendo con su suelo. Un ticket cuyo
  único guard está detrás de un gate es un ticket cuyo guard el CI no ejecuta nunca (SCRUM-296).
  Probado en rojo por las **dos** vías por las que esto regresa: quitando el recuento, y
  moviéndolo detrás de `allocateInvoiceNumber`.

## 3 · Lo que el arreglo destapó, y no era mío

**El censo de procedencia de SCRUM-387 estaba ciego tras cualquier template literal con `${}`.**
Al meter el `` $executeRaw`…${SERIE_LOCK_NS}…` `` el número de marcas sin procedencia **bajó** de
9 a 8 — o sea, la avería tenía forma de mejora. `ts.createScanner` a pelo no sabe de gramática y
necesita `reScanTemplateToken`; sin eso se descarrila. Medido sobre el mismo fichero:

```
sin el template  → 143 comentarios vistos, 1 con marca de aprobación
con el template  →  72 comentarios vistos, 0 con marca      ← CIEGO
```

Migrado a `getLeadingCommentRanges`, aparecieron **ocho marcas de aprobación sin procedencia que
llevaban ocultas** (`SIN_PROCEDENCIA` 9 → 17), enumeradas una a una en el propio scrum387. Ninguna
es de este ticket: es deuda vieja que el instrumento no alcanzaba. SCRUM-718 ya había medido que
ese escáner «pierde el 37,7 % de los comentarios» y había dejado scrum387 como carril ajeno; su
lista de usuarios y su control positivo se actualizan aquí.

📌 Lo cazó **la mitad del trinquete que vigila que el número no baje en silencio** — la que hasta
hoy parecía la menos útil.

## 4 · Los otros tres censos que hubo que atender

- **SCRUM-289** (origen de la factura): el nuevo `invoice.count` queda clasificado como
  `POBLACION` — «tramos de ESTE presupuesto»; una factura suelta no pertenece a ninguno.
- **SCRUM-348** (tenencia): la primera versión filtraba sólo por `quoteId` y habría sido la
  **sexta** deuda por procedencia con el tope en 5. En vez de subir el tope se le puso su
  `merchantId`, que estaba a mano en `quote` (regla 2). Un tope que se sube en cuanto estorba deja
  de ser un tope.
- **SCRUM-601** (copy): `aPelo` 151 → 152 por el mensaje del 409, movido **en el mismo commit** y
  con su motivo escrito.

## 5 · ⚠️ Microcopy: PROPUESTA, no aprobada (regla 30)

Un texto nuevo, el del 409:

> «Se acaba de emitir otra factura de este presupuesto. Vuelve a intentarlo y saldrá el tramo
> siguiente.»

Va **sin firmar**. Un 409 sin mensaje dejaría la pantalla muda ante una carrera —el profesional
vería un error sin saber que basta reintentar—, así que el texto va, declarado como pendiente en
vez de colado en silencio. Firma o corrección, y se aplica.

## 6 · El hueco que este ticket NO cierra, medido

La misma forma —contar fuera, decidir fuera, transacción después— está en otros **dos** caminos:

| fichero | línea | quién lo dispara |
| --- | :-: | --- |
| `src/modules/quotes/app/routes/quotes.routes.ts` | `:654` | **el CLIENTE FINAL**, aceptando el presupuesto desde WhatsApp (C1) |
| `src/modules/jobs/app/routes/jobs.routes.ts` | `:1272` | consolidar albaranes de un trabajo |

El primero preocupa más que el que se arregla aquí: lo dispara alguien sin login que puede pulsar
dos veces. **No se tocan en este PR** porque el encargo nombraba `quotesAdmin.routes.ts` y ampliar
el alcance de un arreglo de dinero por mi cuenta es lo contrario de lo que pide la casa. El arreglo
es el mismo patrón en cada uno; con un «sí» van en este PR o en el siguiente.

## 7 · Lo que NO se ha tocado

`prisma/schema.prisma` · el cerrojo de SCRUM-728 · `@@unique([merchantId, number])` · el veredicto
ni los umbrales de ningún censo salvo los tres declarados arriba, cada uno con su motivo.
