# SCRUM-729 · Una factura EMITIDA reimprime el cliente DE HOY, no el del día que se emitió

**Fecha:** 7-sep-2026 · **Carril:** fiscal (documento emitido) · **Gate:** medición, sin código de arreglo

**Medido contra:** `origin/main` = `e8ae10697d61fef37f87156cc227eecae4a9a39d` · 2026-09-07T10:52:00+02:00

> ⛔ **Esto es medir, no arreglar.** No se ha tocado el camino de emisión (regla 38: leer sí,
> modificar no) ni `prisma/schema.prisma`. Ni una línea.

---

## 0 · PASO 0 — el defecto vive HOY en `main`

No es una foto vieja. La prueba de abajo se corrió contra `e8ae1069` (7-sep-2026, PR #1133), con
`prisma generate` rc=0 y `npm run build` rc=0 **antes** de medir nada.

```
model Invoice, en main hoy:  campos de cliente congelados → 0
```

`Invoice` **sí** congela `number`, `total`, `currency`, `lines`, `suplidos`, `albaranRefs`,
`qrData` y `stageLabel` («congelada al crear la factura»). El cliente **no**: se lee en vivo por
la relación `customer` cada vez que se produce el documento.

El propio esquema ya lo tenía escrito, en el comentario de `shippingAddress` (SCRUM-602):

> *«Que el nombre y el NIF de la factura sigan leyéndose en vivo es deuda VIEJA (SCRUM-729): no
> se propaga a un campo nuevo para que "case".»*

Estaba **declarado**. Lo que faltaba era la demostración corriendo, que es esto.

---

## 1 · La prueba, CORRIDA — Postgres desechable, camino real

Banco portátil en loopback (`127.0.0.1:55432`, base `yaqu_729_test`), esquema derivado del
`schema.prisma` de main con el binario local (`./node_modules/.bin/prisma migrate diff
--from-empty`, **nunca** `npx`, SCRUM-385). Se ejecuta `ensureInvoicePdf` de `dist/` —el camino
real— y se compara el **texto** del PDF.

**La secuencia**, sobre una factura ya EMITIDA y SELLADA (`vfEstado: 'sellado'`, con `vfHash`):

1. se **borra el fichero** del disco — `ensureInvoicePdf` regenera cuando falta, y **ésa es la
   vía por la que esto muerde de verdad en Railway**: el disco es efímero, así que el PDF se
   rehace solo, meses después de emitir;
2. se regenera;
3. se compara.

La fila de `invoices` **no se toca en ningún momento**: el único `update` de toda la prueba va
contra `customers`.

### 🔴 El control positivo, que es lo que hace que la prueba valga

```
🔴 CONTROL POSITIVO · dos regeneraciones SIN tocar al cliente:
  [1ª]                      fichero regenerado          · 5518 bytes · 598 caracteres de texto
  [2ª, sin tocar nada]      fichero BORRADO y regenerado · 5518 bytes · 598 caracteres de texto
   ¿el TEXTO del PDF sale idéntico en las dos?  SÍ
```

Sin cambiar nada del cliente, **el PDF sale idéntico**. Así que lo que se mide abajo es el dato
del cliente y no el ruido de la regeneración.

### El resultado

```
AHORA se cambian NOMBRE, DENOMINACIÓN LEGAL y NIF del cliente.
La fila de la factura NO se toca: ni un update sobre `invoices`.
  [3ª, tras cambiar el cliente]  fichero BORRADO y regenerado · 5528 bytes · 601 caracteres

   ¿el PDF sale distinto que antes del cambio?  SÍ
  NOMBRE  antes: «Ferreteria Pepe»     SÍ salía · después: YA NO sale / «Suministros Norte»     APARECE
  LEGAL   antes: «Ferreteria Pepe SL»  SÍ salía · después: YA NO sale / «Suministros Norte SLU» APARECE
  NIF     antes: «B99999999»           no salía · después: YA NO sale / «B11111111»             no aparece
```

**Los dos textos, tal y como se imprimen bajo el rótulo CLIENTE:**

| | bloque «CLIENTE» del PDF |
| --- | --- |
| **antes** | `CLIENTE` `Ferreteria Pepe SL` `pepe@ferre.test` `600111222` |
| **después** | `CLIENTE` `Suministros Norte SLU` `pepe@ferre.test` `600111222` |

Misma factura. Mismo número. Misma huella VeriFactu. **Otro destinatario impreso.**

---

## 2 · 🔴 El hallazgo que corrige el enunciado: el NIF del cliente NO SE IMPRIME

El encargo daba por hecho «cambia el NOMBRE y el NIF». El nombre, confirmado. El NIF, **no**: no
cambia porque **no sale en el PDF de factura, ni antes ni después**.

No es una conjetura de la medición: está en el tipo, por identidad de propiedad.

```ts
// src/modules/invoicing/infra/pdf/pdf.service.ts:252 — generateInvoicePdf
customer: { name: string; legalName?: string | null; email?: string | null; phone?: string | null };
//         ↑ no hay `taxId`
```

Y quien la llama tampoco lo pasa (`src/lib/invoicing.ts`): `{ name, legalName, email, phone }`.

`taxId` del cliente **sí** viaja en otro documento —el albarán (`albaranPdf.service.ts`)— y por eso
el ticket lo daba por presente aquí. Son dos maquetas distintas.

> ⚠️ Esto es una avería DISTINTA y probablemente más gorda: una factura completa (F1) sin NIF del
> destinatario. **No se abre ticket desde aquí** ni se arregla en esta tanda; queda anotado para
> que lo decida el fundador con el asesor. Si mañana se congelan cinco columnas de cliente, la de
> `taxId` se congelaría **sin que ningún documento la imprima todavía**.

---

## 3 · El alcance, por lectura del árbol

| documento | ¿lee el cliente en vivo al reimprimir? | campos |
| --- | :-: | --- |
| **factura** (`ensureInvoicePdf`) | **SÍ** | `name`, `legalName`, `email`, `phone` |
| **albarán** (`albaranPdf.service.ts`) | **SÍ** | `name`/`legalName`, `taxId`, `email`, `phone` |
| **presupuesto** | correcto | no es documento emitido: debe reflejar al cliente actual |

---

## 4 · Lo propuesto, y NO aplicado

Cinco columnas **nullable y sin default** en `invoices` —y las mismas en `albaranes`— con el
nombre, la denominación legal, el NIF, el email y el teléfono **copiados al emitir**.

Nullable sin default por el motivo de siempre en esta casa: un default convertiría todas las
facturas históricas en «este era el cliente», que no lo ha dicho nadie. `NULL` = «no consta».

El escritor que las rellene es **camino de emisión** → STOP del fundador (AA1.4). El ALTER está
pedido a Javier; este documento sólo aporta la medición que lo justifica.

---

## 5 · Notas de banco de pruebas (hallazgo, sin ticket)

El banco portátil **no sobrevive intacto a la limpieza del temporal**: se llevó
`pgsql/share/` entero —`timezone` y `timezonesets` incluidos— dejando `bin/` y `lib/`. El
servidor arrancaba y moría con `FATAL: configuration file … contains errors`, que no se parece
en nada a la causa.

**Sí tiene arreglo barato**, y es el que se aplicó: el `pg.zip` vive en el scratchpad de la
sesión, y re-extraer **sólo `pgsql/share/**`** (1.412 ficheros, segundos) devuelve el banco sin
volver a bajar 338 MB ni re-inicializar el cluster. Los datos (`pgb/datos`) sobrevivieron.

---

## 6 · Lo que NO se ha tocado

- `prisma/schema.prisma` — ni una línea.
- El camino de emisión — sólo se **llama** y se **lee** (regla 38).
- Ningún texto de microcopy.

---
---

# 9-sep-2026 · EL ESCRITOR — el arreglo, con el plan aprobado por el fundador

**Rama:** `scrum-729-el-escritor-del-cliente` · **Base:** `origin/main` =
`16997ef40e309368d9d1a725e355787c891a4154` · 2026-09-09T10:10:41+02:00
**Preámbulo:** `prisma generate` rc=0 · `npm run build` rc=0 · árbol limpio

> **REGLA 38.** Esto MODIFICA el camino de emisión fiscal. Se entregó el plan, el fundador lo
> aprobó sin recortes el 9-sep-2026, y sólo entonces se escribió la primera línea.

## 1 · Lo que había que decidir, y lo que se decidió

| Pregunta del plan | Respuesta |
|---|---|
| ¿Dónde se congela? | En **un envoltorio nuevo**, `crearFacturaEmitida`, por el que pasan los siete sitios |
| ¿Se rellenan las ya emitidas? | **NO.** Ni una fila |
| ¿El PDF lee siempre de la columna? | **Sí, y los otros tres lectores también** |
| ¿Migrar los siete a `emitInvoice`? | **RECHAZADO** — cambiaría CUÁNDO se sella |

## 2 · La línea única no se buscó: se creó

El censo (`tests/_embudo-factura.mjs`, SCRUM-203) dijo que no había una función donde congelar:
había **siete** `tx.invoice.create`. `emitInvoice` es sólo **uno** de ellos —los otros seis llaman
a `allocateInvoiceNumber` por su cuenta—, así que poner ahí el escritor habría cubierto 1 de 7 y
dejado los otros seis emitiendo con las cinco columnas vacías.

`src/modules/invoicing/domain/crearFacturaEmitida.ts` es ese sitio. Los siete pasan por él:

| # | fichero | qué emite | coste del congelado |
|---|---|---|---|
| 1 | `invoicing.service.ts` (`emitInvoice`) | recapitulativa, albarán, parcial, suelta | +1 viaje en el llamador |
| 2 | `lib/invoicing.ts` | cobro pagado → factura | **0** — `ensureInvoiceForCharge` ya cargaba la ficha |
| 3 | `jobs.routes.ts` | «cobrar el resto» | +1 viaje |
| 4 | `quotes.routes.ts` | tramo al aceptar el presupuesto | +1 viaje |
| 5 | `invoicesAdmin.routes.ts` (suelta) | factura suelta de admin | **0** — se ensanchó el `select` de tenencia |
| 6 | `invoicesAdmin.routes.ts` (R1) | rectificativa | **0** salvo si la original es anterior |
| 7 | `quotesAdmin.routes.ts` ×2 | tramo admin y documento entero | +1 viaje |

**Y CERO dentro del cerrojo, en los siete.** La lectura va antes de `prisma.$transaction`; la
escritura viaja en el `INSERT` que ya se hacía. Los 7 viajes de la sección crítica siguen siendo 7.

### El mecanismo, que es lo que hace que no dependa de acordarse

- **Compila o no compila.** El congelado es parámetro OBLIGATORIO de `emitInvoice` y del
  envoltorio, y el tipo `DatosDeFacturaEmitida` EXCLUYE los cinco campos: no se pueden colar por el
  `data`. **Probado en rojo**: quitando `clienteCongelado` de un solo llamador,
  `npm run build` da `error TS2345`, rc=2.
- **Y el censo del embudo.** Ahora exige **cero `invoice.create` directos en `src/`** fuera del
  envoltorio. Medido: queda **uno**, el del propio envoltorio.

## 3 · El censo se regeneró, no se eligió (y dos guards ajenos con él)

El guard de SCRUM-203 se puso **rojo** con razón: el `create` del envoltorio hace `{ ...datos }` y
el `number` dejó de verse ahí. Se arregló **el analizador**, no lo que el guard exige: cada llamada
a `crearFacturaEmitida` se juzga con el MISMO criterio que antes su `create`, y el `create` de
dentro se admite por RUTA (no por nombre) y sólo mientras sea el único.

`CENSO_SRC` pasa de 7 a 8 entradas — regenerado con el analizador de la casa, no deducido. Las 7 de
siempre más la implementación. **El censo sale reforzado**: antes comprobaba 7 creaciones; ahora
comprueba las 7 llamadas *más* que no exista ninguna otra puerta.

Dos guards ajenos cruzaban «llamadas al embudo == creaciones» (SCRUM-771 §CENSO y SCRUM-778
§SUELO) y cayeron por el mismo 7≠8. Se resolvió marcando la implementación **en el analizador
oficial**, para que ninguno de los dos tenga que repetir una lista de rutas.

## 4 · Los cuatro lectores, y el que de verdad dolía

| lector | antes | ahora |
|---|---|---|
| `ensureInvoicePdf` | ficha viva | columna |
| `ensureInvoiceForCharge` | ficha viva | columna |
| regenerar PDF (admin) | ficha viva **y sin `legalName`** | columna, con `legalName` |
| **XML de la AEAT** | ficha viva, del ejercicio entero, al exportar | columna |

El tercero arreglaba de paso un defecto suelto: la misma factura salía **distinta según por dónde
se pidiera el PDF** (SCRUM-577 pasó `legalName` a dos de los tres generadores y no al de admin).
Entra aquí por decisión del fundador: es el mismo defecto —un destinatario que depende de por
dónde se mire— por otra puerta.

### 🔴 El cuarto: el registro de la AEAT dependía de la ficha de HOY

En `verifactu.service.ts` el NIF del cliente no se imprime: **decide**. Con
`MODO_SIN_DESTINATARIO = 'SIN_DICTAMEN'`, una factura sin NIF de cliente queda **FUERA** del
registro. Leyendo en vivo al exportar:

- rellenar el NIF de un cliente en septiembre **metía** en el registro una factura de marzo;
- borrarlo o corregirlo la **sacaba**, o le cambiaba el `TipoFactura` a `F2`.

Y `TipoFactura` es uno de los **ocho** campos de `computeVeriFactuHash`. Al sellar sale de
`invoice.type` (congelado); al exportar salía de la ficha viva. Editar un cliente podía dejar el
XML declarando un `TipoFactura` distinto del que va dentro de la huella que ese mismo XML firma.

## 5 · Sin backfill, y la razón que no estaba en el ticket

Cero filas rellenadas. Además de «no consta ≠ inventar», hay una razón medida: un backfill con la
ficha de hoy escribiría un NIF que el día de la emisión **no constaba**, y por el párrafo de
arriba esas facturas **entrarían** al registro de la AEAT. Un backfill no es un relleno: es
fabricar declaraciones fiscales.

**Cuántas quedan con las cinco a NULL: todas.** El ALTER entró sin `DEFAULT` y sin relleno, y
antes de este PR ni una línea de `src/` leía o escribía esas columnas (medido: 0 referencias). En
producción son **55 filas en `invoices`** (`docs/MIGRATIONS_PENDING.md`, 7-10-ago-2026, contando
todos los merchants y todos los años); el número de HOY no es medible desde sesión (precedente:
`docs/master/SCRUM-762.md` §④) y la consulta exacta es la ① de `docs/sql/scrum-729-verificar.sql`.

Es un conjunto **cerrado y que no crece**: son exactamente los documentos que existían el día del
despliegue.

## 6 · Por qué `NULL` es una frontera segura — con el «porque» dentro

`columna a NULL entonces ficha viva` es, leído tal cual, un fallback sobre NULL. Sólo vale
**PORQUE**:

1. el escritor **no puede producir un NULL** — escribe en el MISMO `INSERT` y `Customer.name` es
   `String` no nulo; y
2. el **censo del embudo vigila esa incapacidad**, exigiendo cero `invoice.create` fuera del
   envoltorio.

Sin las dos, el enunciado del ticket tenía razón y ese respaldo habría sido el defecto disfrazado.

⚠️ Y el lector pregunta por `customerName`, **no** por `customerTaxId`: preguntar por el NIF haría
que TODA factura a un particular —el caso normal en oficios, SCRUM-215— se leyera como «anterior
al escritor» y volviera a leer en vivo. El defecto entero, colado por la puerta del caso más
común. Tiene su test.

## 7 · La rectificativa hereda, y por qué no es una excepción

Una R1 congelada con la ficha de HOY declararía un destinatario distinto del de la factura que
corrige, y a la AEAT le llegan las dos. Hoy eso no pasa porque las dos leen en vivo: **mienten
igual y al menos coinciden**. Así que la R1 **hereda** el congelado de la original.

No es una excepción a «se congela al emitir»: el destinatario de una rectificativa no es una
decisión, es por definición el de la factura que corrige. Si la original es anterior al escritor,
no hay nada que heredar y se congela la ficha viva.

## 8 · Los cuatro controles, corridos — y los tres ROJOS

`tests/scrum729-el-escritor-del-cliente.test.mjs`, **15 pruebas, sin gate y sin base**: los tres
reconstructores reciben el cliente de Prisma por parámetro, así que se les pasa un doble y se
ejecuta el camino real. **Ni una firma se cambió para poder mirar.**

```
✔ 🔴 ④ EL QUE DECIDE: el XML de la AEAT NO cambia al cambiar el NIF del cliente
✔ 🔴 ④-bis: y CAE con el mecanismo viejo (columnas a NULL = leer en vivo)
✔ 🔴 ④-ter: el NIF de hoy ya no decide si la factura ENTRA en el registro
✔ SUELO: el extractor lee texto de verdad del PDF generado
✔ 🔴 ① CONTROL POSITIVO: cambia la ficha y el PDF de la emitida NO cambia
✔ 🔴 ③ ROJO POR MECANISMO: con el escritor revertido, ① vuelve a caer
✔ ② CONTROL NEGATIVO: una factura ANTERIOR (cinco columnas a NULL) sigue saliendo
✔ 🔴 el envoltorio escribe los CINCO campos en el MISMO insert
✔ 🔴 `customerName` NUNCA sale nulo del escritor
✔ `congelarCliente` falla ANTES de pedir número si el cliente no existe
✔ la RECTIFICATIVA hereda el destinatario de la factura que rectifica
✔ el lector, en sus tres desenlaces (columna · ficha viva · lanza)
✔ 🔴 un particular SIN NIF sigue contando como congelado
```

**Y los rojos, inyectando el fallo de verdad en `src/` y restaurando después:**

| rojo inyectado | qué cae | discrimina |
|---|---|---|
| quitar `clienteCongelado` de UN llamador | `npm run build` rc=2, `TS2345` | el tipo, antes de correr nada |
| `verifactu.service.ts` vuelve a leer `inv.customer` | ④ y ④-ter, **y sólo esos dos** | sí |
| `lib/invoicing.ts` vuelve a leer `inv.customer` | ①, **y sólo ése** | sí |

El suelo del extractor no es decorativo: PDFKit escribe el texto en **HEX**, y un extractor que
busque paréntesis devuelve cero caracteres siempre — y dos vacíos comparados dan «idéntico».

## 9 · Lo que NO entra, declarado

- **`albaranes`** tiene las mismas cinco columnas y el mismo hueco. **Va al PR siguiente**
  (decisión del fundador). Aquí no se ha tocado.
- **El presupuesto NO se congela**: es una oferta viva y que refleje la ficha actual es lo
  esperable (§3 de este mismo documento, arriba).
- **El NIF del cliente sigue sin imprimirse en el PDF**: `generateInvoicePdf` no tiene `taxId` en
  su lista blanca (SCRUM-577) y eso es contenido fiscal del documento — no se añade de paso. Se
  congela igual, porque el XML de la AEAT sí lo usa.
- **`prisma/schema.prisma`**: ni una línea. Las diez líneas de los `@map` ya estaban en main.
- **El cuarto viaje** de la reserva (`invoiceNumber.service.ts:509`) no se toca y no abre ticket:
  queda documentado con su curva y su umbral en `docs/mapa-huecos-sin-automatizar.md`.
