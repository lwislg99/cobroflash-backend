# SCRUM-497 · Que un dato personal no sobreviva a una supresión

**Fecha:** 12-ago-2026 · **Carril:** RGPD · supresión · **Gate:** sin gate, corre en `npm test`

**Medido contra:** `origin/main` = `3b30191b7afbb62b8f5b4173e742ef27dca7f9c9` · 2026-08-12T12:53:31+01:00

> Cierra el hueco que declaró SCRUM-495 y **los 3 rojos que dejó vivos**. Los dos tickets cierran en
> el mismo merge, en la rama `scrum-495-tres-registros`.

## 1 · La víctima

Un profesional ejerce su derecho de supresión. El sistema deja constancia de que lo hizo
—`merchant_anonimizado` en `auditLog`, con actor y base legal— y **las direcciones de correo de sus
clientes siguen en claro** en `email_messages`. La constancia de haber cumplido, sin haber cumplido.

## 2 · PASO 0

`main` = `31041a77` **antes** del `fetch` y `4f20e291` **después**. Siguió moviéndose durante la
sesión —`91b519e1` → `3b30191b`— y se trajo dentro cada vez, nunca rebase.

Búsqueda **por contenido**, con control positivo del método para que el patrón discrimine (uno que
casa con un comentario acierta en todas las ramas y no dice nada):

| Qué se buscó | Dónde | Resultado |
| --- | --- | --- |
| `CAMPOS_PERSONALES` (control positivo del patrón) | `main`, en `src/` | **5 apariciones** — el patrón sí encuentra la lista |
| `emailMessage`/`toEmail` en `anonimizarMerchant.ts` | `main` | **no está** |
| ídem, en **toda la historia de todas las ramas** (`git log --all -S`) | — | **ningún commit lo añade** |
| `emailMessage` en `borradoMerchant.ts`, todas las ramas | — | **ningún commit lo añade** |
| control positivo del método `-S` | — | encuentra `a4581144`, el commit que creó la lista |

Nadie lo había arreglado. **La premisa se sostiene**, y se re-leyó `suprimirMerchant` en el árbol ya
mergeado para confirmarlo.

**Rama viva del otro carril, comprobada y no tocada:** `scrum-475-firma-del-webhook` ·
`7ec55340` · Javier Pereira Fernández · 12-ago 10:08 +0100. **No se solapa**: medido con
`git diff --name-only` sobre los cuatro ficheros de este ticket → vacío.

Los **3 rojos** re-medidos con `dist/` reconstruido y el cliente regenerado desde este worktree:
`SCRUM-192` y `SCRUM-314` ×2. Los mismos.

## 3 · 🔴 El orden, que era la mitad del encargo

**1º `CAMPOS_PERSONALES` + su guard. 2º `ORDEN_BORRADO_MERCHANT`.** Se ha respetado, y no es
ceremonia:

| | cierra los 3 rojos | cierra el hueco |
| --- | --- | --- |
| `ORDEN_BORRADO_MERCHANT` | **sí** | no |
| `CAMPOS_PERSONALES` | no | **sí** |

> **El arreglo que pone la suite en verde no siempre es el arreglo que cierra el agujero. Cuando son
> distintos, hacer el que da verde APAGA la única señal que quedaba.**

Haciendo primero el segundo, la suite se habría puesto verde y el hueco habría quedado invisible.
Hecho en este orden, si me hubiera quedado sin margen tras el primer paso, la entrega habría sido
«tres rojos vivos y el hueco cerrado» — que es la buena.

## 4 · Qué entra

### 4.1 · `CAMPOS_PERSONALES` cubre `email_messages.to_email`

Se **anonimiza**, no se borra: la fila es la constancia del envío (art. 17.3.b) y lo que desaparece
es la dirección. Un registro de envíos sin destinatario sigue acreditando el envío, que es para lo
que existe.

**Solo `toEmail`.** `providerId` es el identificador que da el proveedor —no es dato del interesado y
es lo que permite cruzar un rebote con su fila— y `kind`/`status`/las fechas son el hecho, no la
persona.

### 4.2 · 🔴 El guard, que es el entregable de verdad

`CAMPOS_PERSONALES` era **la única de las tres listas del merchant sin vigilancia**, y por eso fue la
única que no saltó cuando nació la tabla: las otras dos dieron 11 rojos, ésta ninguno.

Y está **atado al HECHO** —*«ninguna columna con dato personal queda sin clasificar»*— no a la lista
de hoy. El hecho tiene dos mitades y decirlo importa:

* **DERIVADO** del esquema: qué modelos y columnas existen y de qué tipo son. Es lo que hace que un
  modelo nuevo con un `email` dentro ponga el guard en rojo el mismo día.
* **DECLARADO** en `tests/_censo-datos-personales.mjs`: **qué nombres de columna cuentan como dato
  personal**. Eso no se puede derivar —es una calificación jurídica, no una propiedad del texto— y
  por eso está escrito y no adivinado. Misma elección que `INTOCABLES`.

**El filtro de tipo (solo `String`) no es cosmético.** Sin él entran por llamarse «email»
`notifyEmailOnPaid`, `notifyEmailOnQuoteAccepted`, `notifyEmailWeeklyDigest` (Booleanos: banderas) y
`lifecycleEmailsSent` (un Json de qué correos se mandaron: el hecho). **Cuatro falsos positivos
medidos**, y un trinquete lleno de ruido deja de señalar lo que importa.

### 4.3 · `ORDEN_BORRADO_MERCHANT` incluye `emailMessage` — caen los 3 rojos

Va en el bloque de rastros y **antes de `invoice`/`quote`/`customer`**: sus `related_type`/`related_id`
apuntan a una factura o a un presupuesto y su `customer_id` a un cliente, **todo sin FK ninguna**. Si
cayera después, quedarían filas apuntando a ids que ya no existen y nada protestaría.

### 4.4 · `barridoDemo` · MEDIDO, no decidido por simetría

| Lo medido | |
| --- | --- |
| qué hace | `deleteMany` por cada modelo de `ORDEN_BORRADO_MERCHANT`, más los colgados de `charge` y las sesiones del bot por teléfono |
| para qué | **resetear los datos de EJEMPLO** para que `seed-demo` los vuelva a poner. El merchant demo **sobrevive** (su propia cabecera lo dice) |
| ¿es una supresión del art. 17? | **No.** No hay interesado que ejerza un derecho ni obligación de conservar un asiento de ejemplo |

**Veredicto: para el demo, BORRAR DE VERDAD es lo correcto.** Anonimizar dejaría filas redactadas
acumulándose en el demo cada vez que se re-siembra, y eso haría **mentir al botón «Eliminar datos de
ejemplo»** —diría que la cuenta quedó limpia con filas dentro—, que es exactamente el defecto que
cerró SCRUM-314. Va escrito donde se decide, junto a la lista.

## 5 · 🔴 EL HALLAZGO · `to_email` era el número 16 de dieciséis

Al atar el guard al hecho, el censo derivado destapó mucho más que un campo. **30 columnas personales
en el esquema**, y el reparto suma:

| Cubo | Cuántas | |
| --- | --- | --- |
| **cubiertas** por `CAMPOS_PERSONALES` | **13** | se anonimizan en la supresión |
| **fuera, declaradas con motivo** | **2** | `product.name` y `quoteTemplate.name`: el nombre de un servicio o de una plantilla no es el de una persona |
| **🔴 SIN DECIDIR** | **15** | son datos personales, **hoy NO se anonimizan**, y nadie ha decidido si deben |

13 + 2 + 15 = 30. **Las categorías suman su total**, o no es un censo.

Los quince, con la pregunta que hay que contestar —el guard **exige la pregunta, no solo el nombre**,
y me cazó tres `ídem` que había escrito por pereza:

| Columna | La pregunta |
| --- | --- |
| `teamMember.name` · `teamMember.email` | ¿los datos de un EMPLEADO se van con la baja del profesional? Y su correo es además su vía de acceso |
| `provider.*` (name, email, phone, legalName, taxId, notes) | ¿el proveedor es un tercero con su propia relación, o dato del merchant? ¿su NIF va en las facturas recibidas que el 17.3.b conserva? |
| `merchant.iban` · `merchant.bizumPhone` | ¿dato personal, o parte del registro de cobros que el 17.3.b conserva? |
| `job.direccion` · `job.notes` | la dirección DONDE se trabajó es casi siempre el domicilio del cliente |
| `quote.internalNotes` · `expense.notes` | texto libre; y el de `quote` va dentro de un documento que puede estar sellado (regla 29) |
| `botSession.phone` | el teléfono del cliente que escribió por WhatsApp, antes de ser cliente |

**No se arreglan aquí**: cada uno es una calificación jurídica distinta y es del fundador. Lo que este
ticket garantiza es que están **nombrados** y que **no puede aparecer un dieciseisavo sin que salte**.

## 6 · Verificación

| | Qué | |
| --- | --- | --- |
| **🔴 EL TEST QUE DECIDE SI VALE** | un **modelo sintético** con un teléfono dentro pone el guard en rojo. Si solo cayera con `to_email` estaría atado a la lista y habría que rehacerlo | ✅ |
| **🔴 CONTROL POSITIVO** | tras `suprimirMerchant`: la dirección se redacta **Y la fila sigue** (`updateMany`, nunca `deleteMany`). **Las dos en el mismo test**: solo con la primera, un borrado la pasaría | ✅ |
| **🔴 AUTOPRUEBA** | sobre esquema sintético: ve un `email`, un `email?` y un `toEmail`; **no** ve un Boolean, un Json, un `Decimal` ni el interior de un `enum` | ✅ |
| **SUELO** | con `CAMPOS_PERSONALES` **vacía**, el guard falla y nombra las 13 que hoy cubre | ✅ |
| **SUELO** | si la derivación ve <25 columnas → *ESCÁNER CIEGO*, no verde | ✅ |
| **TRINQUETE** | 15, y **cero es sospecha**: el suelo va primero y dice que lo primero a descartar es que el censo dejó de ver | ✅ |
| **CONTROL NEGATIVO** | un modelo sintético sin datos personales no pone nada en rojo | ✅ |
| **DOS INSTRUMENTOS** | la derivación sobre el TEXTO del esquema (estado) **y** `suprimirMerchant` ejercitado con un `db` de mentira (comportamiento) | ✅ |
| **Sin BD y sin red** | ni una conexión | ✅ |

### El rojo por el mecanismo, sobre la lista nueva

Quitando `toEmail` de `CAMPOS_PERSONALES`, cae **dos veces** y **nombrando el dato**:

```
🔴 HAY COLUMNAS CON DATO PERSONAL QUE NADIE HA CLASIFICADO:
   emailMessage.toEmail
🔴 LA SUPRESIÓN NO TOCA `emailMessage`.
```

**Hoy eso pasaba en silencio.** Probado por inyección y revertido.

## 7 · Tres tests ajenos ENDURECIDOS — nunca aflojados

| Test | Qué le pasaba | Qué se hizo |
| --- | --- | --- |
| `scrum244-supresion-y-anonimizado` | doblaba `['merchant','customer','auditLog']` **a mano**; al aparecer un modelo nuevo en la lista, la ruta llamó a un doble inexistente y dio **500 esperando 200** | el **doble** se deriva de `CAMPOS_PERSONALES`; las **expectativas siguen a mano** |
| `scrum440-tenencia-supresion` | idéntico, y su CONTROL POSITIVO decía *«el dueño ya no puede pedir su supresión»* cuando lo único roto era su propio fixture | ídem |
| `scrum498-cifra-derivada` | su ensayo del día D exigía literalmente `dice 21 y son 22`. **El día D llegó** y su propio aserto se quedó viejo: el defecto que ese fichero existe para cazar, dentro de él | las cifras del aserto se **derivan** del recuento; la forma exigida (fichero, línea, «dice X y son Y») no se relaja |

> **Derivar el FIXTURE, nunca la EXPECTATIVA.** Derivar también lo esperado haría el test cuadrar
> solo y dejaría de avisar el día que cambie QUÉ se redacta, que es lo que hay que vigilar.

Y **doce frases en prosa** decían «21 modelos con `merchantId`» cuando son 22. No las encontré yo
esta vez: las nombró `SCRUM-498`, que entró en `main` a mitad de sesión y es el guard que caza
exactamente el hallazgo que reporté como «fuera de carril» en SCRUM-495. Corregidas una a una, con la
cifra **contada**.

## 8 · El test de SCRUM-495 que se retira, porque hizo su trabajo

Declaraba el hueco afirmando lo que HABÍA y estaba escrito para caer el día que alguien lo arreglase,
con el mensaje *«ENHORABUENA: el hueco ya no existe. Borra este test»*. **Cayó.** Su sitio lo ocupa
algo mejor que una declaración: el guard atado al hecho. No se sustituye por otro aserto equivalente
—sería un segundo vigilante del mismo hecho— y en su lugar queda el eslabón entre los dos tickets.

## 9 · Números

| | tests | pass | fail | skipped |
| --- | --- | --- | --- | --- |
| **línea base** — el conjunto de tests **de `main`** sobre este árbol, medida aparte | 3.473 | 3.396 | **0** | 77 |
| **después** — la tanda entera de esta rama | 3.492 | 3.415 | **0** | 77 |
| diferencia | **+19** | **+19** | 0 | **0** |

**De 11 rojos (SCRUM-495) a 3, y de 3 a CERO.**

Los **+19 cuadran exactamente** y son los tres ficheros que esta rama tiene y `main` todavía no:
**8** de `scrum497-dato-personal-no-sobrevive` (este ticket) · **6** de `scrum495-tres-registros` ·
**5** de `scrum475-schema-vs-sql`. Ni un salto nuevo: los 77 son los mismos gateados por BD.

* `npm run guards:entrada` — 4 guards · 17 tests · 0 fallos.
* `tests/scrum393-marcadores-de-conflicto.test.mjs` — 6 · 0 (tres merges con conflicto en
  `deriva-prod.sql`, resueltos **regenerando** y no a mano; ni un marcador).

## 10 · Lo que NO se ha tocado

`prisma/schema.prisma` (cero líneas: las 24 del modelo vienen del fundador) · la FORMA de
`email_messages` · ninguna base de datos ni un comando que escriba · ninguna cadena de conexión
escrita, pedida, impresa ni inventada · `public/` · `scrum-475-firma-del-webhook` y todo el receptor
de Resend · el criterio de DETECCIÓN de ningún guard ajeno: los que saltaron tenían razón.

## 11 · Huecos declarados

* 🔴 **Quince datos personales siguen sin anonimizar**, nombrados con su pregunta en el trinquete
  (§5). Es el hallazgo, y cada uno es una decisión del fundador con el asesor.
* **El vocabulario es DECLARADO, no derivado.** Un campo personal que se llame de una forma que no
  esté en la lista —`respondentEmail`, por ejemplo— **no lo ve el guard**. Está dicho en un aserto
  para que el límite se vea en vez de descubrirse el día que falle. Casar por subcadena metería
  `templateName` y `nameSearch`: el coste de ampliarlo es ese.
* **Nada verificado contra una base.** El control positivo usa un `db` de mentira; que el
  `updateMany` funcione contra Postgres lo cubre el gateado de `scrum244` (`LIBRO_PG_URL`), que no se
  ha lanzado aquí.
* **`borrarMerchant` sigue gateado OFF** y su retirada la paró SCRUM-485: el `emailMessage` que se le
  añade al ORDEN no cambia nada hoy, solo deja de ser un hueco el día que se encienda.
* **La supresión no la ha ejercido nadie todavía**: `MERCHANT_DELETE_ENABLED` está en `false`.
